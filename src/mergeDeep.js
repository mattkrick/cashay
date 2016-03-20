export const isObject = val => val && typeof val === 'object';

const mergeArrays = (target, src) => {
  //check for overlap in docs, intelligently append keys
  const minTraversalIdx = Math.max(0, target.length - src.length);
  let cursorFound;
  let i;
  for (i = target.length - 1; i >= minTraversalIdx; i--) {
    if (target[i] === src[0]) {
      cursorFound = true;
      break;
    }
  }
  if (!cursorFound) {
    i = target.length;
  }
  return target.slice(0, i).concat(src);
};

export const mergeDeepWithArrs = (target, src) => {
  Object.keys(src).forEach(key => {
    if (isObject(target[key]) && isObject(src[key])) {
      if (Array.isArray(src[key])) {
        if (Array.isArray(target[key])) {
          const mergedArray = (key === 'back') ? mergeArrays(src[key], target[key]) : mergeArrays(target[key], src[key]);
          // if we've received fewer docs than requested, meaning we've got em all, use the full array
          if (src[key].EOF || target[key].EOF) {
            target.full = mergedArray;
            delete target.front;
            delete target.back;
          } else {
            target[key] = mergedArray;
          }
        } else {
          target[key] = src[key];
        }
      } else {
        //pass in key vars
        target[key] = mergeDeepWithArrs(target[key], src[key]);
      }
    } else {
      target[key] = src[key];
    }
  });
  //converge front and back
  if (Array.isArray(target.front) && Array.isArray(target.back)) {
    // make sure the arrays changed (performance only)
    if (Array.isArray(src.front) || Array.isArray(src.back)) {
      const minTraversalIdx = Math.max(0, target.back.length - target.front.length);
      for (let i = target.front.length - 1; i >= minTraversalIdx; i--) {
        if (target.back[0] === target.front[i]) {
          target.full = target.front.slice(0, i).concat(target.back);
          delete target.front;
          delete target.back;
          break;
        }
      }
    }
  }
  return target;
};
