import {SET_VARIABLES} from '../normalize/duck';

export default function setSubVariablesFactory(component, key, dispatch, getState, cachedSubscription, startSubscription) {
  return cb => {
    let stateVariables;
    if (key) {
      const currentVariables = this.getState().data.variables[component][key];
      const variables = Object.assign({}, currentVariables, cb(currentVariables));
      stateVariables = {[component]: {[key]: variables}};
    } else {
      const currentVariables = this.getState().data.variables[component];
      const variables = Object.assign({}, currentVariables, cb(currentVariables));
      stateVariables = {[component]: variables};
    }

    // stop the old sub
    cachedSubscription.unsubscribe();

    //start the new sub
    cachedSubscription.unsubscribe = startSubscription(stateVariables, cachedSubscription.response.data);

    // store the vars in the store so we can restart the sub from a peristed state
    dispatch({
      type: SET_VARIABLES,
      payload: {
        variables: stateVariables
      }
    });
  }
};
