import {isObject, FRONT, BACK, FULL} from '../utils';

const paginationArrayNames = new Set([FRONT, BACK, FULL]);

/**
 * check for overlap in docs, intelligently append keys
 * all the logic in here is to mitigate the problems with cursor-based pagination (duplicates, etc)
 * pagination should never have the same document twice
 * the question is, do we maintain the old order, or the new?
 * maintaining the old order ensures less jumping around & that the user won't have to scroll past the same thing twice
 * so if the new stuff has references to old stuff, delete em
 * then, stick em on the end
 */
const mergeSameArrays = (targetArray, srcArray, isAppend) => {
  const srcSet = new Set(srcArray);
  for (let entry of targetArray) {
    srcSet.delete(entry);
  }
  const reducedSrcArr = [...srcSet];
  return isAppend ? targetArray.concat(reducedSrcArr) : reducedSrcArr.concat(targetArray);
};

/**
 * merging front and back is a little volatile because per mergeSameArrays, we keep the original order
 * it's possible, for example, for a post to get downvoted to hell, causing it to first appear in the front
 * but then later in the back. such is a pitfall of cursor-based arrays
 */
const mergeDifferentArrays = (front, back) => {
  const frontSet = new Set(front);
  let isComplete = false;
  for (let i = 0; i < back.length; i++) {
    const entry = back[i];
    if (frontSet.has(entry)) {
      isComplete = true;
      frontSet.delete(entry);
    }
  }
  if (isComplete) {
    const reducedFront = [...frontSet];
    return reducedFront.concat(back);
  }
};

const handleArrays = (target, src) => {
  // merge similar
  const pageTarget = {};
  const pageSrc = {};
  for (let arrType of paginationArrayNames) {
    pageTarget[arrType] = Array.isArray(target[arrType]);
    pageSrc[arrType] = Array.isArray(src[arrType]);
  }
  if (pageTarget[FULL]) {
    if (pageSrc[FULL]) {
      target[FULL] = mergeSameArrays(target[FULL], src[FULL], true);
    } else if (pageSrc[FRONT]) {
      target[FULL] = mergeSameArrays(target[FULL], src[FRONT], false);
    } else if (pageSrc[BACK]) {
      target[FULL] = mergeSameArrays(target[FULL], src[BACK], true);
    }
  } else {
    if (pageSrc[FULL]) {
      target[FULL] = src[FULL];
    } else {
      if (pageTarget[FRONT] && pageSrc[FRONT]) {
        const targetArr = src[FRONT].EOF ? FULL : FRONT;
        target[targetArr] = mergeSameArrays(target[FRONT], src[FRONT], true);
      }
      if (pageTarget[BACK] && pageSrc[BACK]) {
        const targetArr = src[BACK].BOF ? FULL : BACK;
        target[targetArr] = mergeSameArrays(target[BACK], src[BACK], false);
      }
    }
  }

  if (!target[FRONT] && src[FRONT]) {
    target[FRONT] = src[FRONT];
  }
  if (!target[BACK] && src[BACK]) {
    target[BACK] = src[BACK];
  }

  // check to see if target has all the docs (but only if we got something new recently)
  if (target[FRONT] && target[BACK] && (src[FRONT] || src[BACK])) {
    const full = mergeDifferentArrays(target[FRONT], target[BACK]);
    if (full) {
      target[FULL] = full;
    }
  }
  if (target[FULL]) {
    delete target[FRONT];
    delete target[BACK];
  }
};

const detectCashayArray = (src, allSrcKeys) => {
  // front & back (2) or full (1), any more than that & it's not cashay's
  if (allSrcKeys.length < 1 || allSrcKeys.length > 2) return false;
  let isCashayArray = true;
  for (let i = 0; i < allSrcKeys.length; i++) {
    const srcKey = allSrcKeys[i];
    if (!paginationArrayNames.has(srcKey) || !Array.isArray(src[srcKey])) {
      isCashayArray = false;
      break;
    }
  }
  return isCashayArray
};

export default function mergeStores(state, src, isMutation) {
  // first shallow copy the state as a simple way to get the primitives, we'll later overwrite the pointers
  const target = {...state};
  const srcKeys = Object.keys(src);
  const isCashayArray = detectCashayArray(src, srcKeys);
  if (isCashayArray && !isMutation) {
    debugger
    handleArrays(target, src)
  } else {
    for (let i = 0; i < srcKeys.length; i++) {
      const key = srcKeys[i];
      const srcProp = src[key];
      const targetProp = target[key];
      if (isObject(srcProp) && isObject(targetProp)) {
        const srcIsArray = Array.isArray(srcProp);
        const stateIsArray = Array.isArray(targetProp);
        if (!srcIsArray && !stateIsArray) {
          // if both the state and src are objects, merge them
          target[key] = {...mergeStores(targetProp, srcProp, isMutation)};
        } else if (isCashayArray) {
          if (key === FRONT) {
            const oldCount = srcProp.count;
            const targetPropCopy = targetProp.slice();
            targetPropCopy.splice(0, oldCount, ...srcProp);
            target[key] = targetPropCopy;
          } else if (key === BACK) {
            const oldCount = srcProp.count;
            const targetPropCopy = targetProp.slice();
            const spliceStart = targetPropCopy.length - oldCount;
            targetPropCopy.splice(spliceStart, targetPropCopy.length, ...srcProp);
            target[key] = targetPropCopy;
          }
        } else {
          // if the src is not the same as the state, use the pointer from src
          target[key] = srcProp;
        }
      } else {
        // if it was an object, but now it's not, overwrite the object
        // if it wasn't an object, but now it is, use the pointer from src
        target[key] = srcProp;
      }
    }
  }
  return target;
};
