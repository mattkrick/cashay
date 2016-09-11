import mergeStores from './mergeStores';

export const ADD_SUBSCRIPTION = '@@cashay/ADD_SUBSCRIPTION';
export const UPDATE_SUBSCRIPTION = '@@cashay/UPDATE_SUBSCRIPTION';
export const REMOVE_SUBSCRIPTION = '@@cashay/REMOVE_SUBSCRIPTION';
export const INSERT_QUERY = '@@cashay/INSERT_QUERY';
export const INSERT_MUTATION = '@@cashay/INSERT_MUTATION';
export const SET_VARIABLES = '@@cashay/SET_VARIABLES';
export const SET_ERROR = '@@cashay/SET_ERROR';
export const SET_STATUS = '@@cashay/SET_STATUS';
export const CLEAR = '@@cashay/CLEAR';

const initialState = {
  entities: {
    // [GraphQLObjectTypeName] : {
    //   [args?]: Array.isArray(GraphQLObjectType) ? {
    //     [FRONT]: [],
    //     [BACK]: [],
    //     [FULL]: [],
    //   } : {}
    // }
  },
  error: null,
  ops: {
    // [op]: {
    //   [key]: {
    //     variables: {},
    //     status: '',
    //     error: {}
    //   }
    // }
  },
  result: {}
};

export default function reducer(state = initialState, action) {
  const {type} = action;
  if (type.startsWith('@@cashay')) {
    if (type === CLEAR) return initialState;
    const isMutation = type === INSERT_MUTATION;
    return mergeStores(state, action.payload, isMutation);
  } else {
    return state;
  }
};
