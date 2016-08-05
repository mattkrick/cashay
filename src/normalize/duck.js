export const ADD_SUBSCRIPTION = '@@cashay/ADD_SUBSCRIPTION';
export const UPDATE_SUBSCRIPTION = '@@cashay/UPDATE_SUBSCRIPTION';
export const REMOVE_SUBSCRIPTION = '@@cashay/REMOVE_SUBSCRIPTION';
export const INSERT_QUERY = '@@cashay/INSERT_QUERY';
export const INSERT_MUTATION = '@@cashay/INSERT_MUTATION';
export const SET_VARIABLES = '@@cashay/SET_VARIABLES';
export const SET_ERROR = '@@cashay/SET_ERROR';
import mergeStores from './mergeStores';

const initialState = {
  error: null,
  data: {
    entities: {},
    result: {},
    variables: {}
  }
};

export default function reducer(state = initialState, action) {
  if (action.type === INSERT_QUERY ||
    action.type === ADD_SUBSCRIPTION ||
    action.type === UPDATE_SUBSCRIPTION ||
    action.type === REMOVE_SUBSCRIPTION) {
    const {variables, response} = action.payload;
    const newMergedState = mergeStores(state.data, response);
    return variables ? newStateWithVars(state, newMergedState, action.payload) : {...state, data: newMergedState, error: null};
  } else if (action.type === INSERT_MUTATION) {
    const newMergedState = mergeStores(state.data, action.payload.response, true);
    return newStateWithVars(state, newMergedState, action.payload);
  } else if (action.type === SET_VARIABLES) {
    return newStateWithVars(state, {...state.data}, action.payload);
  } else if (action.type === SET_ERROR) {
    return {...state, error: action.error};
  } else {
    return state;
  }
};

const newStateWithVars = (state, newDataState, {variables}) => {
  return Object.assign({}, state, {
    error: null,
    data: Object.assign(newDataState, {
      variables: Object.assign({}, state.data.variables, variables)
    })
  });
};
