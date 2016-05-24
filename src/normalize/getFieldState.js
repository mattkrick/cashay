import {STRING, INT, VARIABLE} from 'graphql/language/kinds';
import {isObject, getRegularArgsKey} from '../utils';
import {separateArgs} from './separateArgs';
import {getDocFromNormalString, sendChildrenToServer} from './denormalizeHelpers';
import {RequestArgument} from '../helperClasses';

/**
 * given a parent field state & some args, drill down to the data using the args as a map
 *
 * @param {object} fieldState the parent field in the redux state.
 * @param {object} fieldSchema the portion of the clientSchema relating to the fieldState
 * @param {object} selection the original query that holds the arguments
 * @param {object} context
 *
 * @returns {*} an object, or array, or scalar from the normalized store
 * */
export default function getFieldState(fieldState, fieldSchema, selection, context) {
  if (!isObject(fieldState)) {
    return fieldState
  }
  const {arguments: fieldArgs} = selection;
  const {regularArgs, paginationArgs} = separateArgs(fieldSchema, fieldArgs, context);
  if (regularArgs) {
    const regularArgsString = getRegularArgsKey(regularArgs);
    fieldState = fieldState[regularArgsString];
  }
  if (paginationArgs) {
    fieldState = handlePaginationArgs(paginationArgs, fieldState, fieldSchema, selection, context);
  }
  flagUsefulArgs(fieldArgs, context);
  return fieldState;
};

const handlePaginationArgs = (paginationArgs, fieldState, fieldSchema, selection, context) => {
  const {before, after, first, last} = paginationArgs;
  const {arguments: fieldArgs} = selection;
  // try to use the full array. if it doesn't exist, see if we're going backwards & use the back array, else front
  const usefulArray = fieldState.full || (last ? fieldState.back : fieldState.front);
  const isFull = usefulArray === fieldState.full;

  // TODO dead code? i think we always guarantee an empty array
  // if (!usefulArray) {
  //   console.log('no local data')
  //   return;
  // }
  const cursor = before || after;
  const count = last || first;
  const cursorIdx = getCursorIdx(cursor, last, usefulArray, context.cashayDataState.entities);
  // if last is provided, then first is not and we need to go from last to first
  let missingDocCount;
  let normalStringWithNewCursor;
  let countWord;
  let cursorWord;
  if (last) {
    const minIdx = cursorIdx - last;
    const usefulArrayNonNull = removeLeftPadding(usefulArray);
    missingDocCount = -minIdx;
    const startIdx = minIdx < 0 ? 0 : minIdx;
    fieldState = usefulArrayNonNull.slice(startIdx, cursorIdx);
    normalStringWithNewCursor = usefulArrayNonNull[0];
    countWord = context.paginationWords.last;
    cursorWord = context.paginationWords.before;
  } else {
    const maxIdx = cursorIdx + first;
    const usefulArrayNonNull = removeRightPadding(usefulArray);
    missingDocCount = maxIdx - usefulArrayNonNull.length + 1;
    fieldState = usefulArrayNonNull.slice(cursorIdx + 1, cursorIdx + 1 + first);
    normalStringWithNewCursor = usefulArrayNonNull[usefulArrayNonNull.length - 1];
    countWord = context.paginationWords.first;
    cursorWord = context.paginationWords.after;
  }

  // assign BOF and EOF to the array, similar to hasPreviousPage, hasNextPage
  assignFieldStateMeta(fieldState, usefulArray);


  // if there's a document missing & we don't have all the documents yet, get more!
  if (missingDocCount > 0 && !isFull) {
    console.log(`not enough data, need to fetch ${missingDocCount} more`);

    // if we have a partial response & the backend accepts a cursor, only ask for the missing pieces
    if (missingDocCount < count && fieldSchema.args[cursorWord]) {
      // flag all AST children with sendToServer = true
      sendChildrenToServer(selection);

      // given something like `Post:123`, return the document from the store
      const storedDoc = getDocFromNormalString(normalStringWithNewCursor, context.cashayDataState.entities);
      if (!storedDoc.cursor) {
        throw new Error(`No cursor was included for ${normalStringWithNewCursor}. 
        Please include the cursor field for the ${fieldSchema.name} query`)
      }

      // save the original arguments, we'll overwrite them with efficient ones for the server,
      // but need them later to create the denormaliezd response
      selection.originalArguments = fieldArgs.slice();

      //get the index of the count argument so we can replace it with the new one
      const countArgIdx = fieldArgs.findIndex(arg => arg.name.value === countWord);

      //  create a new count arg & override the old one
      fieldArgs[countArgIdx] = makeCountArg(countWord, missingDocCount);

      //get the index of the cursor argument so we can replace it with the new one. it may not exist
      const cursorArgIdx = fieldArgs.findIndex(arg => arg.name.value === cursorWord);

      // make a new cursor argument
      const newCursorArg = makeCursorArg(cursorWord, storedDoc.cursor);

      // if the cursor arg exists, overwrite it. otherwise, just put it anywhere
      if (cursorArgIdx !== -1) {
        fieldArgs[cursorArgIdx] = newCursorArg;
      } else {
        fieldArgs.push(newCursorArg);
      }
    }
  }
  return fieldState;
};

const removeLeftPadding = array => {
  for (let i = 0; i < array.length; i++) {
    if (array[i]) {
      return array.slice(i);
    }
  }
};

const removeRightPadding = array => {
  for (let i = array.length - 1; i >= 0; i--) {
    if (array[i]) {
      return array.slice(0, i + 1);
    }
  }
};

const assignFieldStateMeta = (fieldState, usefulArray) => {
  Object.assign(fieldState, {
    EOF: fieldState[fieldState.length - 1] === usefulArray[usefulArray.length - 1],
    BOF: fieldState[0] === usefulArray[0]
  });
};

const getCursorIdx = (cursor, last, usefulArray, entities) => {
  let cursorIdx = last ? 1 : -1;
  if (cursor) {
    cursorIdx = usefulArray.findIndex(doc => {
      const storedDoc = getDocFromNormalString(doc, entities);
      return storedDoc.cursor === cursor
    });
    if (cursorIdx === -1) {
      throw new Error(`Invalid cursor: ${cursor}`);
    }
  }
  return cursorIdx;
};

const makeCursorArg = (cursorName, cursorValue) => new RequestArgument(cursorName, STRING, cursorValue);
const makeCountArg = (countName, countValue) => new RequestArgument(countName, INT, countValue);

const flagUsefulArgs = (fieldArgs, context) => {
  for (let arg of fieldArgs) {
    if (arg.value.kind === VARIABLE) {
      const argInOperation = context.operation.variableDefinitions.find(varDef => {
        return varDef.variable.name.value === arg.value.name.value
      });
      // if calling normalize from the queryServer, it's possible we already nuked the arg from the operation
      if (argInOperation) {
        argInOperation._inUse = true;
      }
    }
  }
};
