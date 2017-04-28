import {isObject, FRONT, BACK, FULL, REMOVAL_FLAG} from '../utils';

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

/**
 * An exercise in combinatorics.
 * Specific logic on how to merge arrays
 * Many of these are edge cases, like merging a paginated array with a full array
 * */
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

/**
 * A cashay array is an object that holds up to 2 arrays:
 * either full (not paginated) or front and/or back
 * */
const detectCashayArray = (src, allSrcKeys) => {
  if (allSrcKeys.length < 1 || allSrcKeys.length > 2) return false;
  for (let i = 0; i < allSrcKeys.length; i++) {
    const srcKey = allSrcKeys[i];
    if (!paginationArrayNames.has(srcKey) || !Array.isArray(src[srcKey])) {
      return false;
    }
  }
  return true;
};

/**
 * A deep merge that has exclusive logic for merging arrays suitable for pagination
 * */
export default function mergeStores(state, src, isMutation) {
  // first shallow copy the state as a simple way to get the primitives, we'll later overwrite the pointers
  if (!src) return state;
  const target = {...state};
  const srcKeys = Object.keys(src);
  const isCashayArray = detectCashayArray(src, srcKeys);
  if (isCashayArray && !isMutation) {
    handleArrays(target, src)
  } else {
    for (let i = 0; i < srcKeys.length; i++) {
      const key = srcKeys[i];
      const srcProp = src[key];
      const targetProp = target[key];
      if (isObject(srcProp) && isObject(targetProp) && !(srcProp instanceof Date)) {
        const srcIsArray = Array.isArray(srcProp);
        const stateIsArray = Array.isArray(targetProp);
        if (!srcIsArray && !stateIsArray) {
          // if both the state and src are objects, merge them
          target[key] = {...mergeStores(targetProp, srcProp, isMutation)};
        } else if (isCashayArray) {
          // this is a mutation, so the array length
          if (key === FRONT) {
            target[key] = [...targetProp.slice(0, srcProp.count), ...srcProp.slice()];
          } else if (key === BACK) {
            const spliceStart = targetProp.length - srcProp.count;
            target[key] = [...targetProp.slice(spliceStart), ...srcProp]
          }
        } else {
          // for 2 arrays that aren't cashay arrays, use a simple replace (can extend in the future)
          target[key] = srcProp;
        }
      } else {
        if (srcProp === REMOVAL_FLAG) {
          delete target[key];
        } else {
          // if there is a disagreement on the type of value, default to using the src
          target[key] = srcProp;
        }

      }
    }
  }
  return target;
};
