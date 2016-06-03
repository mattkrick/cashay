export const INSERT_NORMALIZED = '@@cashay/INSERT_NORMALIZED';
export const SET_VARIABLES = '@@cashay/SET_VARIABLES';

import mergeStores from './mergeStores';

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
      if (!action.payload.key) {
        return Object.assign({}, state, {
          data: Object.assign(mergeStores(state.data, action.payload.response), {
            variables: Object.assign({}, state.data.variables, {
              [action.payload.component]: Object.assign({}, state.data.variables[action.payload.component],
                action.payload.variables)
            })
          })
        });
      } else {
        const stateDataVarsComp = Object.assign({}, state.data.variables[action.payload.component]);
        const stateDataVarsCompKey = Object.assign({}, stateDataVarsComp[action.payload.key], action.payload.variables);
        return Object.assign({}, state, {
          data: Object.assign(mergeStores(state.data, action.payload.response), {
            variables: Object.assign({}, state.data.variables, {
              [action.payload.component]: Object.assign(stateDataVarsComp, {
                [action.payload.key]: stateDataVarsCompKey
              })
            })
          })
        });
      }
    case SET_VARIABLES:
      if (!action.payload.key) {
        return Object.assign({}, state, {
          data: Object.assign({}, state.data, {
            variables: Object.assign({}, state.data.variables, {
              [action.payload.component]: Object.assign({},
                state.data.variables[action.payload.component],
                action.payload.variables)
            })
          })
        });
      } else {
        const stateDataVarsComp = Object.assign({}, state.data.variables[action.payload.component]);
        const stateDataVarsCompKey = Object.assign({}, stateDataVarsComp[action.payload.key], action.payload.variables);
        return Object.assign({}, state, {
          data: Object.assign({}, state.data, {
            variables: Object.assign({}, state.data.variables, {
              [action.payload.component]: Object.assign(stateDataVarsComp, {
                [action.payload.key]: stateDataVarsCompKey
              })
            })
          })
        });
      }

    default:
      return state;
  }
};
