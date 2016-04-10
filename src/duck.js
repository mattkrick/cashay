// import {Map as iMap, fromJS} from 'immutable';
export const INSERT_NORMALIZED = '@@cashay/INSERT_NORMALIZED';
export const INSERT_NORMALIZED_OPTIMISTIC = '@@cashay/INSERT_NORMALIZED_OPTIMISTIC';
import {deepAssign} from './deepAssign';

const initialState = {
  error: {},
  isFetching: false,
  data: {
    entities: {},
    result: {}
  }
};

export const reducer = (state = initialState, action) => {
  switch (action.type) {
    case INSERT_NORMALIZED:
    case INSERT_NORMALIZED_OPTIMISTIC:
      debugger
      const newState = Object.assign({}, state, {
        data: deepAssign(state.data, action.payload.response)
      });
      return  newState;
    default:
      return state;
  }
};


