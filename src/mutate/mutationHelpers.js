import {isObject} from '../utils';

export const makeComponentsToUpdate = (mutationName, possibleComponentObj, cachedQueries, mutationHandlers) => {
  const componentsToUpdateObj = {};
  if (isObject(possibleComponentObj)) {
    const possibleComponentKeys = Object.keys(possibleComponentObj);
    for (let i = 0; i < possibleComponentKeys.length; i++) {
      const component = possibleComponentKeys[i];
      if (cachedQueries[component]) {
        // remove falsy values, bring over the key or true
        componentsToUpdateObj[component] = possibleComponentObj[component];
      }
    }
  } else {
    const mutationHandlerObj = mutationHandlers[mutationName];
    const handlerComponents = Object.keys(mutationHandlerObj);
    for (let component of handlerComponents) {
      if (cachedQueries[component]) {
        if (!cachedQueries[component].response.hasOwnProperty('data')) {
          throw new Error(`${component} has more than 1 instance.
          For ${mutationName}, please include a components object in your options`)
        }
        // todo if key isn't mentioned, true should either mean all keys, or throw an error
        componentsToUpdateObj[component] = true;
      }
    }
  }
  return componentsToUpdateObj;
};
