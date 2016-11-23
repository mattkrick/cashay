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
        this[op] = possibleComponentObj[op] === true ? '' : possibleComponentObj[op];
      }
    }
  }

  makeDefaultComponentsToUpdate(cachedQueries, mutationName, mutationHandlers) {
    const mutationHandlerObj = mutationHandlers[mutationName] || {};
    // if (!mutationHandlerObj) {
    //   throw new Error(`Did you forget to add mutation handlers to your queries for ${mutationName}?`)
    // }
    const listeningOps = Object.keys(mutationHandlerObj);
    for (let i = 0; i < listeningOps.length; i++) {
      const op = listeningOps[i];
      if (cachedQueries[op]) {
        const {responses} = cachedQueries[op];
        const listeningKeys = Object.keys(responses);
        if (listeningKeys.length === 1) {
          this[op] = listeningKeys[0];
        } else if (listeningKeys.length > 1) {
          throw new Error(`${op} has more than 1 instance.
          For ${mutationName}, please include an 'ops' object in your options`)
        }
      }
    }
  }
};
