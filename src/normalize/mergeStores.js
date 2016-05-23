import {isObject} from '../utils';

/**
 * check for overlap in docs, intelligently append keys
 * all the logic in here is to mitigate the problems with cursor-based pagination (duplicates, etc)
 */
const mergeSameArrays = (targetArray, srcArray, isAppend) => {
  // pagination should never have the same document twice
  // the question is, do we maintain the old order, or the new?
  // maintaining the old order ensures less jumping around & that the user won't have to scroll past the same thing twice
  // so if the new stuff has references to old stuff, delete em
  // then, stick em on the end
  const srcSet = new Set(srcArray);
  for (let entry of targetArray) {
    srcSet.delete(entry);
  }
  const reducedSrcArr = [...srcSet];
  return isAppend ? targetArray.concat(reducedSrcArr) : reducedSrcArr.concat(targetArray);
};

const mergeDifferentArrays = (front, back) => {
  // merging front and back is a little volatile because per mergeSameArrays, we keep the original order
  // it's possible, for example, for a post to get downvoted to hell, causing it to first appear in the front
  // but then later in the back. such is a pitfall of cursor-based arrays
  const frontSet = new Set(front);
  let isComplete = false;
  for (let entry of back) {
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

const handleArrays = (target, src, paginationArrayNames) => {
  // merge similar
  const pageTarget = {};
  const pageSrc = {};
  let isEOF = !!target.full;
  for (let arrType of paginationArrayNames) {
    pageTarget[arrType] = Array.isArray(target[arrType]);
    pageSrc[arrType] = Array.isArray(src[arrType]);
    if (src[arrType] && src[arrType].EOF) {
      isEOF = true;
    }
  }
  if (pageTarget.full) {
    if (pageSrc.full) {
      target.full = mergeSameArrays(target.full, src.full, true);
    } else if (pageSrc.front) {
      target.full = mergeSameArrays(target.full, src.front, false);
    } else if (pageSrc.back) {
      target.full = mergeSameArrays(target.full, src.back, true);
    }
  } else {
    if (pageSrc.full) {
      target.full = src.full;
    } else {
      if (pageTarget.front && pageSrc.front) {
        const targetArr = src.front.EOF ? 'full' : 'front';
        target[targetArr] = mergeSameArrays(target.front, src.front, true);
      }
      if (pageTarget.back && pageSrc.back) {
        const targetArr = src.back.EOF ? 'full' : 'back';
        target[targetArr] = mergeSameArrays(target.back, src.back, false);
      }
    }
  }
  if (!target.front && src.front) {
    target.front = src.front;
  }
  if (!target.back && src.back) {
    target.back = src.back;
  }
  if (target.front && target.back && (src.front || src.back)) {
    const full = mergeDifferentArrays(target.front, target.back);
    if (full) {
      target.full = full;
    }
  }
  if (target.full) {
    delete target.front;
    delete target.back;
  }
};

export default function mergeStores(state, src) {
  // first shallow copy the state as a simple way to get the primitives, we'll later overwrite the pointers
  const target = {...state};
  const paginationArrayNames = new Set(['front', 'back', 'full']);
  const allSrcKeys = Object.keys(src);
  const srcKeys = allSrcKeys.filter(key => !paginationArrayNames.has(key) || !Array.isArray(src[key]));
  if (srcKeys.length < allSrcKeys.length) {
    handleArrays(target, src, paginationArrayNames)
  }

  for (let key of srcKeys) {
    // throw in a short circuit if we merged front & back & removed them
    if (!src.hasOwnProperty(key)) continue;
    const srcProp = src[key];
    const targetProp = target[key];
    if (isObject(srcProp) && isObject(targetProp)) {
      const srcIsArray = Array.isArray(srcProp);
      const stateIsArray = Array.isArray(targetProp);
      if (!srcIsArray && !stateIsArray) {
        // if both the state and src are objects, merge them
        target[key] = {...mergeStores(targetProp, srcProp)};
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
  return target;
};
