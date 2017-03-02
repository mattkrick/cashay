import {STRING, INT} from 'graphql/language/kinds';
import {isObject, getRegularArgsKey, FULL, FRONT, BACK} from '../utils';
import separateArgs from './separateArgs';
import {splitNormalString, sendChildrenToServer} from './denormalizeHelpers';
import {RequestArgument} from '../helperClasses';

/**
 * given a parent field state & some args, drill down to the data using the args as a map
 *
 * @param {object} fieldState the parent field in the redux state.
 * @param {object} fieldSchema the portion of the clientSchema relating to the fieldState
 * @param {object} selection the original query AST that holds the arguments
 * @param {object} context
 *
 * @returns {*} an object, or array, or scalar from the normalized store
 * */
export default function getFieldState(fieldState, fieldSchema, selection, context) {
  if (!isObject(fieldState) || !fieldSchema.args) return fieldState;
  const {arguments: fieldArgs} = selection;
  // TODO can we short circuit if there are no fieldArgs provided?
  // if (!fieldArgs) return fieldState;
  let subState = fieldState;
  const {skipTransform, paginationWords, variables} = context;
  const {regularArgs, paginationArgs} = separateArgs(fieldSchema, fieldArgs, paginationWords, variables);
  if (regularArgs) {
    const regularArgsString = getRegularArgsKey(regularArgs);
    subState = subState[regularArgsString];
  }
  if (paginationArgs) {
    const arrType = subState[FULL] ? FULL : paginationArgs[paginationWords.last] !== undefined ? BACK : FRONT;
    subState = handlePaginationArgs(paginationArgs, subState[arrType]);

    // reduce the ask from the server
    if (arrType !== FULL && !skipTransform) {
      reducePaginationRequest(paginationArgs, subState, fieldSchema, selection, context);
    }
  }
  return subState;
};

/**
 * Provide a subset of the array of documents in the state
 * @param {Object} paginationArgs an object with only 1 field: FIRST or LAST
 * @param {Array} usefulArray the array of document corresponding to the FIRST or LAST
 * */
const handlePaginationArgs = (paginationArgs, usefulArray) => {
  const {first, last} = paginationArgs;

  // try to use the full array. if it doesn't exist, see if we're going backwards & use the back array, else front
  const count = last !== undefined ? last : first;

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
  const countWord = last !== undefined ? paginationWords.last : paginationWords.first;

  const missingDocCount = count - usefulArray.length;
  // if we have a partial response & the backend accepts a cursor, only ask for the missing pieces
  if (missingDocCount > 0 && missingDocCount < count) {
    const cursorWord = last ? paginationWords.before : paginationWords.after;
    if (!fieldSchema.args[cursorWord]) {
      throw new Error(`Your schema does not accept an argument for your cursor named ${cursorWord}.`);
    }
    // flag all AST children with sendToServer = true
    // TODO write test to make sure I don't need to send children to server
    // sendChildrenToServer(selection);
    // TODO when to remove doWarn?
    const doWarn = true;
    const cashayState = context.getState();
    const {bestCursor, cursorIdx} = getBestCursor(first, usefulArray, cashayState.entities, doWarn);
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
      const [typeName, docId] = splitNormalString(usefulArray[i]);
      storedDoc = entities[typeName][docId];
      if (storedDoc.cursor !== undefined) break;
    }
  } else {
    for (i = 0; i < usefulArray.length; i++) {
      const [typeName, docId] = splitNormalString(usefulArray[i]);
      storedDoc = entities[typeName][docId];
      if (storedDoc.cursor !== undefined) break;
    }
  }

  // TODO this is incorrect, I think it should be length -1 and break this into 2 functions
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

/**
 * Assign metadata to the array.
 * The EOF, BOF are useful to the front-end developer if they want to know if there are more docs available
 * The count is useful internally to mutations so we know how a certain query has been mutated
 * @param {Array} slicedArray the subset of the usefulArray
 * @param {Array} usefulArray all the documents in that direction that are available on the client
 * @param {Number} count the number of documents desired by the front-end
 * */
const assignFieldStateMeta = (slicedArray, usefulArray, count) => {
  Object.assign(slicedArray, {
    EOF: slicedArray[slicedArray.length - 1] === usefulArray[usefulArray.length - 1],
    BOF: slicedArray[0] === usefulArray[0],
    count
  });
};

const makeCursorArg = (cursorName, cursorValue) => new RequestArgument(cursorName, STRING, cursorValue);
const makeCountArg = (countName, countValue) => new RequestArgument(countName, INT, countValue);
