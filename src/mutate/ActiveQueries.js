import {isObject} from '../utils';

export default class ActiveQueries {
  constructor(mutationName, possibleComponentObj, cachedQueries, mutationHandlers) {
    isObject(possibleComponentObj) ? this.makeDefinedComponentsToUpdate(cachedQueries, possibleComponentObj) :
      this.makeDefaultComponentsToUpdate(cachedQueries, mutationName, mutationHandlers);
  }

  makeDefinedComponentsToUpdate(cachedQueries, possibleComponentObj) {
    const possibleComponentKeys = Object.keys(possibleComponentObj);
    for (let i = 0; i < possibleComponentKeys.length; i++) {
      const op = possibleComponentKeys[i];
      if (cachedQueries[op]) {
        // remove falsy values, bring over the key or true
        this[op] = possibleComponentObj[op];
      }
    }
  }

  makeDefaultComponentsToUpdate(cachedQueries, mutationName, mutationHandlers) {
    const mutationHandlerObj = mutationHandlers[mutationName] || {};
    // if (!mutationHandlerObj) {
    //   throw new Error(`Did you forget to add mutation handlers to your queries for ${mutationName}?`)
    // }
    const handlerComponents = Object.keys(mutationHandlerObj);
    const defaultKey = '';
    for (let i = 0; i < handlerComponents.length; i++) {
      const op = handlerComponents[i];
      if (cachedQueries[op]) {
        // duck-type to see whether we should dive into the key or not
        if (cachedQueries[op].responses[defaultKey]) {
          this[op] = defaultKey;
        } else {
          throw new Error(`${op} has more than 1 instance.
          For ${mutationName}, please include a components object in your options`)
        }
      }
    }
  }
};
