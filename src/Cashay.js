import {FETCH_DATA_REQUEST, FETCH_DATA_SUCCESS, FETCH_DATA_ERROR} from './duck';
import {normalize} from 'normalizr';
//import {denormalize} from './denormalize';

export default class Cashay {
  constructor({store, transport}) {
    this._store = store;
    this._transport = transport;
  }

  async query(queryString, options) {
    const {string, schema} = queryString;
    const {dispatch} = this._store;

    // see what data we have in the store
    const cahsayDataState = this._store.getState().getIn(['cashay', 'data']);
    const schemaKeys = Object.keys(schema);
    console.log('going through keys')
    schemaKeys.forEach(key => {
      if (schema[key].constructor.name === 'EntitySchema') {
        console.log('checking key', key)
        const entityId = cahsayDataState.getIn(['result', key]);
        console.log('entId', entityId, cahsayDataState)
        if (entityId) {
          const subStateName = schema[key].getKey();
          const obj = cahsayDataState.getIn(['entities', subStateName, entityId]);
          console.log('CACHED RES', obj);
        }
      }
    })

    dispatch({type: FETCH_DATA_REQUEST});
    const {error, data} = await this._transport({query: string});
    if (error) {
      return dispatch({
        type: FETCH_DATA_ERROR,
        error
      })
    }
    console.log('RESP', data)
    const payload = normalize(data, schema);
    //const ans = denormalize(payload, schema);
    dispatch({
      type: FETCH_DATA_SUCCESS,
      payload
    });
  }
}

