// import {Map as iMap, fromJS} from 'immutable';
export const INSERT_NORMALIZED = '@@cashay/INSERT_NORMALIZED';
import {mergeDeepWithArrs} from './mergeDeep';

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
      return Object.assign({}, {
        data: mergeDeepWithArrs(state.data, action.payload.response)
      });
    default:
      return state;
  }
};


