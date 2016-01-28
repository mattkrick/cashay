import {Map, List, fromJS} from 'immutable';

export const SET_DATA = 'SET_DATA';

const initialState = Map({
  error: Map(),
  isFetching: false,
  data: Map({
    entities: Map(),
    result: Map()
  })
});

export function reducer(state = initialState, action) {
  switch (action.type) {
    case SET_DATA:
      return state.merge({
        data: action.payload
      })
    default:
      return state;
  }
}


