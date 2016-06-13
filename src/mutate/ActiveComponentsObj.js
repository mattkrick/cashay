import {isObject} from '../utils';
import {CachedQueryResponse} from '../helperClasses';

export default class ActiveComponentsObj {
  constructor(mutationName, possibleComponentObj, cachedQueries, mutationHandlers) {
    isObject(possibleComponentObj) ? makeDefinedComponentsToUpdate(cachedQueries, possibleComponentObj) :
      makeDefaultComponentsToUpdate(cachedQueries, mutationName, mutationHandlers);
  }
};

const makeDefinedComponentsToUpdate = (cachedQueries, possibleComponentObj) => {
  const possibleComponentKeys = Object.keys(possibleComponentObj);
  for (let i = 0; i < possibleComponentKeys.length; i++) {
    const component = possibleComponentKeys[i];
    if (cachedQueries[component]) {
      // remove falsy values, bring over the key or true
      this[component] = possibleComponentObj[component];
    }
  }
};

const makeDefaultComponentsToUpdate = (cachedQueries, mutationName, mutationHandlers) => {
  const mutationHandlerObj = mutationHandlers[mutationName];
  if (!mutationHandlerObj) {
    throw new Error(`Did you forget to add mutation handlers to your queries for ${mutationName}?`)
  }
  const handlerComponents = Object.keys(mutationHandlerObj);
  for (let i = 0; i < handlerComponents.length; i++) {
    const component = handlerComponents[i];
    if (cachedQueries[component]) {
      if (cachedQueries[component] instanceof CachedQueryResponse) {
        this[component] = true;
      } else {
        throw new Error(`${component} has more than 1 instance.
          For ${mutationName}, please include a components object in your options`)
      }
    }
  }
};
