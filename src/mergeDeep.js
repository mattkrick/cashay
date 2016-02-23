export const isObject = (val) => val && typeof val === 'object';

//TODO this should take a front or back to know whether to append or prepend
export const mergeArrays = (target, src, shouldPrepend) => {
  //check for overlap in docs, intelligently append keys
  //const primaryKey = src[0].cursor ? 'cursor' : 'id';
  if (shouldPrepend) {
    const maxTraversals = Math.min(target.length, src.length);
    let arrayFront = src;
    for (let i = 0; i < maxTraversals; i++) {
      if (target[i] === src[src.length - 1]) {
        arrayFront = src.slice(0, i);
        break;
      }
    }
  } else {
    const maxTraversals = Math.max(0, target.length - src.length);
    let arrayFront = target;
    for (let i = target.length - 1; i >= maxTraversals; i--) {
      if (target[i] === src[0]) {
        //if (target[i][primaryKey] === src[0][primaryKey]) {
        arrayFront = target.slice(0, i);
        break;
        //TODO verify afterFields are equal? only if we do janky mutations
      }
    }
  }
  return arrayFront.concat(src);
};

export const mergeDeepWithArrs = (target, src, {mergeArrays}, shouldPrepend) => {
  const srcIsArr = Array.isArray(src);
  if (srcIsArr) {
    const targetIsArr = Array.isArray(target);
    if (targetIsArr) {
      target = mergeArrays(target, src, shouldPrepend);
    } else {
      //target is obj or scalar, src replaces it
      target = src;
    }
  } else {
    Object.keys(src).forEach(key => {
      if (isObject(target[key]) && isObject(src[key])) {
        target[key] = mergeDeepWithArrs(target[key], src[key], {mergeArrays}, key === 'back');
      } else {
        target[key] = src[key];
      }
    });
    if (Array.isArray(target.front) && Array.isArray(target.back)) {
      debugger
      // make sure the arrays changed (performance only)
      if (Array.isArray(src.front) || Array.isArray(src.back)) {
        const minFromBack = target.back[target.back.length - 1];
        const maxTraversals = Math.max(0, target.back.length - target.front.length);
        for (let i = target.front.length - 1; i >= maxTraversals; i--) {
          if (minFromBack === target.front[i]) {
            target.full = target.front.slice(0, i).concat(target.back.reverse());
            delete target.front;
            delete target.back;
            break;
          }
        }
      }
    }
  }
  return target;
};
