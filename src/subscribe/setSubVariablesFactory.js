import {SET_VARIABLES} from '../normalize/duck';
import {getStateVars} from '../utils'
export default function setSubVariablesFactory(op, key, dispatch, getState, cachedSubscription, promiseStart) {
  return async cb => {
    const cashayState = this.getState();
    const stateVars = getStateVars(cashayState, op, key) || {};
    const resolvedVariables = Object.assign({}, stateVars, cb(stateVars));
    const payload = {ops: {[op]: {[key]: resolvedVariables}}};

    // stop the old sub
    cachedSubscription.unsubscribe();

    //start the new sub
    cachedSubscription.unsubscribe = await promiseStart(stateVars);

    // store the vars in the store so we can restart the sub from a peristed state
    dispatch({
      type: SET_VARIABLES,
      payload
    });
  }
};
