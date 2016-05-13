export const INSERT_NORMALIZED = '@@cashay/INSERT_NORMALIZED';
export const SET_VARIABLES = '@@cashay/SET_VARIABLES';

import {deepAssign} from './deepAssign';

const initialState = {
  // TODO simplify. isFetching is the same as !cachedResponse._isComplete
  error: {},
  data: {
    entities: {},
    result: {},
    variables: {}
  }
};

export const reducer = (state = initialState, action) => {
  switch (action.type) {
    case INSERT_NORMALIZED:
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


