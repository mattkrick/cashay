import {SET_VARIABLES} from '../duck';

/**
 * Creates a function to allow for the user to change the variables without mutating the old
 * variables or having to type the componentId. This allows for pretty painless state++ behavior
 */
export default (componentId, currentVariables, cachedQuery, dispatch) => {
  return cb => {
    const variables = Object.assign({}, currentVariables, cb(currentVariables));

    // invalidate the cache
    cachedQuery.response = undefined;

    // use dispatch to trigger a recompute.
    dispatch({
      type: SET_VARIABLES,
      payload: {
        componentId,
        variables
      }
    });
  }
};
