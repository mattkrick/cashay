import {STRING, INT, VARIABLE} from 'graphql/language/kinds';
import {isObject, getRegularArgsKey, FULL, FRONT, BACK} from '../utils';
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
  if (isObject(fieldState)) {
    const {skipTransform, paginationWords} = context;
    const {arguments: fieldArgs} = selection;
    const {regularArgs, paginationArgs} = separateArgs(fieldSchema, fieldArgs, context);
    if (regularArgs) {
      const regularArgsString = getRegularArgsKey(regularArgs);
      fieldState = fieldState[regularArgsString];
    }
    if (paginationArgs) {
      const arrType = fieldState[FULL] ? FULL : paginationArgs[paginationWords.last] ? BACK : FRONT;
      fieldState = handlePaginationArgs(paginationArgs, fieldState[arrType], arrType);
      if (arrType !== FULL && !skipTransform) {
        reducePaginationRequest(paginationArgs, fieldState, fieldSchema, selection, context);
      }
    }
  }
  return fieldState;
};

const handlePaginationArgs = (paginationArgs, usefulArray) => {
  const {first, last} = paginationArgs;

  // try to use the full array. if it doesn't exist, see if we're going backwards & use the back array, else front
  const count = last || first;

  // if last is provided, then first is not and we need to go from last to first
  let slicedArr;
  if (last) {
    const firstNonNullIdx = countLeftPadding(usefulArray);
    const firstDesiredDocIdx = usefulArray.length - last;
    const startIdx = Math.max(firstNonNullIdx, firstDesiredDocIdx);
    slicedArr = usefulArray.slice(startIdx, usefulArray.length);
  } else {
    const lastNonNullIdx = countRightPadding(usefulArray);
    const lastDesiredDocIdx = first - 1;
    const sliceThrough = Math.min(lastNonNullIdx, lastDesiredDocIdx);
    slicedArr = usefulArray.slice(0, sliceThrough + 1);
  }

  // assign BOF and EOF to the array, similar to hasPreviousPage, hasNextPage
  assignFieldStateMeta(slicedArr, usefulArray, count);
  return slicedArr;
};

const reducePaginationRequest = (paginationArgs, usefulArray, fieldSchema, selection, context) => {
  const {first, last} = paginationArgs;
  const count = last || first;
  const {arguments: fieldArgs} = selection;
  const {paginationWords} = context;
  const countWord = last ? paginationWords.last : paginationWords.first;

  const missingDocCount = count - usefulArray.length;
  // if we have a partial response & the backend accepts a cursor, only ask for the missing pieces
  if (missingDocCount > 0 && missingDocCount < count) {
    const cursorWord = last ? paginationWords.before : paginationWords.after;
    if (!fieldSchema.args[cursorWord]) {
      throw new Error(`Your schema does not accept an argument for your cursor named ${cursorWord}.`);
    }
    // flag all AST children with sendToServer = true
    sendChildrenToServer(selection);
    // TODO when to remove doWarn?
    const doWarn = true;
    const {bestCursor, cursorIdx} = getBestCursor(first, usefulArray, context.cashayDataState.entities, doWarn);
    const desiredDocCount = count - (cursorIdx + 1);

    // save the original arguments, we'll overwrite them with efficient ones for the server,
    // but need them later to create the denormaliezd response
    selection.originalArguments = fieldArgs.slice();

    //get the index of the count argument so we can replace it with the new one
    const countArgIdx = fieldArgs.findIndex(arg => arg.name.value === countWord);

    //  create a new count arg & override the old one
    fieldArgs[countArgIdx] = makeCountArg(countWord, desiredDocCount);

    // make a new cursor argument
    const newCursorArg = makeCursorArg(cursorWord, bestCursor);
    fieldArgs.push(newCursorArg);
  }
};

const getBestCursor = (first, usefulArray, entities, doWarn) => {
  let storedDoc;
  let i;
  if (first) {
    for (i = usefulArray.length - 1; i >= 0; i--) {
      // given something like `Post:123`, return the document from the store
      const {typeName, docId} = getDocFromNormalString(usefulArray[i]);
      storedDoc = entities[typeName][docId];
      if (storedDoc.cursor) break;
    }
  } else {
    for (i = 0; i < usefulArray.length; i++) {
      const {typeName, docId} = getDocFromNormalString(usefulArray[i]);
      storedDoc = entities[typeName][docId];
      if (storedDoc.cursor) break;
    }
  }

  if (i >= 0 && i < usefulArray.length) {
    return {bestCursor: storedDoc.cursor, cursorIdx: i};
  } else if (doWarn) {
    console.warn(`No cursor was included for the following docs: ${usefulArray}. 
        Include the 'cursor' field for those docs`)
  }
};

const countLeftPadding = array => {
  for (let i = 0; i < array.length; i++) {
    if (array[i]) {
      return i;
    }
  }
};

const countRightPadding = array => {
  for (let i = array.length - 1; i >= 0; i--) {
    if (array[i]) {
      return i;
    }
  }
};

const assignFieldStateMeta = (slicedArray, usefulArray, count) => {
  Object.assign(slicedArray, {
    EOF: slicedArray[slicedArray.length - 1] === usefulArray[usefulArray.length - 1],
    BOF: slicedArray[0] === usefulArray[0],
    count
  });
};

const makeCursorArg = (cursorName, cursorValue) => new RequestArgument(cursorName, STRING, cursorValue);
const makeCountArg = (countName, countValue) => new RequestArgument(countName, INT, countValue);
