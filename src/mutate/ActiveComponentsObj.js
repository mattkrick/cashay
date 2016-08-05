import {isObject} from '../utils';

export default class ActiveComponentsObj {
  constructor(mutationName, possibleComponentObj, cachedQueries, mutationHandlers) {
    isObject(possibleComponentObj) ? this.makeDefinedComponentsToUpdate(cachedQueries, possibleComponentObj) :
      this.makeDefaultComponentsToUpdate(cachedQueries, mutationName, mutationHandlers);
  }

  makeDefinedComponentsToUpdate(cachedQueries, possibleComponentObj) {
    const possibleComponentKeys = Object.keys(possibleComponentObj);
    for (let i = 0; i < possibleComponentKeys.length; i++) {
      const component = possibleComponentKeys[i];
      if (cachedQueries[component]) {
        // remove falsy values, bring over the key or true
        this[component] = possibleComponentObj[component];
      }
    }
  }

  makeDefaultComponentsToUpdate(cachedQueries, mutationName, mutationHandlers) {
    const mutationHandlerObj = mutationHandlers[mutationName] || {};
    // if (!mutationHandlerObj) {
    //   throw new Error(`Did you forget to add mutation handlers to your queries for ${mutationName}?`)
    // }
    const handlerComponents = Object.keys(mutationHandlerObj);
    for (let i = 0; i < handlerComponents.length; i++) {
      const component = handlerComponents[i];
      if (cachedQueries[component]) {
        // duck-type to see whether we should dive into the key or not
        if (cachedQueries[component].responses['']) {
          this[component] = true;
        } else {
          throw new Error(`${component} has more than 1 instance.
          For ${mutationName}, please include a components object in your options`)
        }
      }
    }
  }
};
