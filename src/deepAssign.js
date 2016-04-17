import {isObject} from './utils';

/**
 * check for overlap in docs, intelligently append keys
 * all the logic in here is to mitigate the problems with cursor-based pagination (duplicates, etc)
 *
 */
const mergeArrays = (state, src, isAppend) => {
  // pagination should never have the same document twice
  // the question is, do we maintain the old order, or the new?
  // maintaining the old order ensures less jumping around & that the user won't have to scroll past the same thing twice
  // so if the new stuff has references to old stuff, delete em
  // then, stick em on the end
  const srcSet = new Set([...src]);
  for (let i = 0; i < state.length; i++) {
    srcSet.delete(state[i]);
  }
  const reducedStateArr = [...srcSet];
  return isAppend ? state.concat(reducedStateArr) : reducedStateArr.concat(state);
};

const handleArrays = (target, key, srcProp, stateProp) => {
  const mergeForward = (key === 'front' || key === 'full') ? true : key === 'back' ? false : null;
  if (mergeForward === null) {
    // this is not an array of normalized objects
    // ignore the state array, use the pointer from src
    target[key] = srcProp;
  } else {
    // if this is an array of items moving forwards, append. Else, prepend.
    const mergedArray = mergeArrays(stateProp.filter(Boolean), srcProp, mergeForward);
    // if an EOF flag exists on the array object, we know we requested more than we got
    // TODO will we need to check stateProp.EOF?
    if (srcProp.EOF) {
      delete target.front;
      delete target.back;
      target.full = mergedArray;
    } else {
      target[key] = mergedArray;
    }
  }
};

export const deepAssign = (state, src) => {
  // first shallow copy the state as a simple way to get the primitives, we'll later overwrite the pointers
  const target = Object.assign({}, state);
  Object.keys(src).forEach(key => {
    const srcProp = src[key];
    const stateProp = state[key];
    if (isObject(srcProp) && isObject(stateProp)) {
      const srcIsArray = Array.isArray(srcProp);
      const stateIsArray = Array.isArray(stateProp);
      if (srcIsArray && stateIsArray) {
        // if both the state and src are arrays, merge them
        handleArrays(target, key, srcProp, stateProp)
      } else if (!srcIsArray && !stateIsArray) {
        // if both the state and src are objects, merge them
        target[key] = Object.assign({}, deepAssign(stateProp, srcProp));
      } else {
        // if the src is not the same as the state, use the pointer from src
        target[key] = srcProp;
      }
    } else {
      // if it was an object, but now it's not, overwrite the object
      // if it wasn't an object, but now it is, use the pointer from src
      target[key] = srcProp;
    }
  });
  return target;
};

// export const mergeDeepWithArrs = (target, src) => {
//   Object.keys(src).forEach(key => {
//     if (isObject(target[key]) && isObject(src[key])) {
//       if (Array.isArray(src[key])) {
//         if (Array.isArray(target[key])) {
//           const mergedArray = (key === 'back') ? mergeArrays(src[key], target[key]) : mergeArrays(target[key], src[key]);
//           // if we've received fewer docs than requested, meaning we've got em all, use the full array
//           if (src[key].EOF || target[key].EOF) {
//             target.full = mergedArray;
//             delete target.front;
//             delete target.back;
//           } else {
//             target[key] = mergedArray;
//           }
//         } else {
//           target[key] = src[key];
//         }
//       } else {
//         //pass in key vars
//         target[key] = Object.assign({}, mergeDeepWithArrs(target[key], src[key]));
//       }
//     } else {
//       target[key] = src[key];
//     }
//   });
//   //converge front and back
//   if (Array.isArray(target.front) && Array.isArray(target.back)) {
//     // make sure the arrays changed (performance only)
//     if (Array.isArray(src.front) || Array.isArray(src.back)) {
//       const minTraversalIdx = Math.max(0, target.back.length - target.front.length);
//       for (let i = target.front.length - 1; i >= minTraversalIdx; i--) {
//         if (target.back[0] === target.front[i]) {
//           target.full = target.front.slice(0, i).concat(target.back);
//           delete target.front;
//           delete target.back;
//           break;
//         }
//       }
//     }
//   }
//   return target;
// };
