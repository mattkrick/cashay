import {FETCH_DATA_REQUEST, FETCH_DATA_SUCCESS, FETCH_DATA_ERROR} from './duck';
import {normalize} from 'normalizr';

export default class Cashay {
  constructor({store, transport}) {
    this._store = store;
    this._transport = transport;
  }
  async query(queryString, options) {
    const {string, schema} = queryString;
    const {dispatch} = this._store;

    dispatch({type: FETCH_DATA_REQUEST});
    const {error, data} = await this._transport({query: string});
    if (error) {
      return dispatch({
        type: FETCH_DATA_ERROR,
        error
      })
    }
    const payload = normalize(data, schema);
    dispatch({
      type: FETCH_DATA_SUCCESS,
      payload
    });
  }
}
