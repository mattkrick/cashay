// import {Map as iMap, fromJS} from 'immutable';
export const INSERT_NORMALIZED = '@@cashay/INSERT_NORMALIZED';
// export const INSERT_NORMALIZED_OPTIMISTIC = '@@cashay/INSERT_NORMALIZED_OPTIMISTIC';
export const SET_VARIABLES = '@@cashay/SET_VARIABLES';

import {deepAssign} from './deepAssign';

const initialState = {
  error: {},
  isFetching: false,
  data: {
    entities: {},
    result: {},
    variables: {}
  }
};

export const reducer = (state = initialState, action) => {
  switch (action.type) {
    case INSERT_NORMALIZED:
      // debugger
      return Object.assign({}, state, {
        data: Object.assign(deepAssign(state.data, action.payload.response), {
          variables: Object.assign({}, state.data.variables, {
            [action.payload.componentId]: Object.assign({},
              state.data.variables[action.payload.componentId],
              action.payload.variables)
          })
        })
      });
    case SET_VARIABLES:
      return Object.assign({}, state, {
        data: Object.assign({}, state.data, {
          variables: Object.assign({}, state.data.variables, {
            [action.payload.componentId]: Object.assign({},
              state.data.variables[action.payload.componentId],
              action.payload.variables)
          })
        })
      })

    default:
      return state;
  }
};


