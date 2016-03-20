//import {Map, List, fromJS} from 'immutable';
//
//export const FETCH_DATA_REQUEST = '@@cashay/FETCH_DATA_REQUEST';
//export const FETCH_DATA_SUCCESS = '@@cashay/FETCH_DATA_SUCCESS';
//export const FETCH_DATA_ERROR = '@@cashay/FETCH_DATA_ERROR';
//
//const initialState = Map({
//  error: Map(),
//  isFetching: false,
//  data: Map({
//    entities: Map(),
//    result: Map()
//  })
//});
//
//export const reducer = (state = initialState, action) => {
//  switch (action.type) {
//    case FETCH_DATA_REQUEST:
//      return state.merge({
//        isFetching: true
//      });
//    case FETCH_DATA_SUCCESS:
//      return state.merge({
//        isFetching: false,
//        data: action.payload
//      });
//    case FETCH_DATA_ERROR:
//      return state.merge({
//        isFetching: false,
//        error: action.error
//      });
//    default:
//      return state;
//  }
//};
//
//
