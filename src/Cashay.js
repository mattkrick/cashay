import {FETCH_DATA_REQUEST, FETCH_DATA_SUCCESS, FETCH_DATA_ERROR} from './duck';
import {normalize} from 'normalizr';
import {parse} from 'graphql/language/parser';

export default class Cashay {
  constructor({store, transport, schema}) {
    this._store = store;
    this._transport = transport;
    this._schema = schema;
  }

  async query(queryString, options = {}) {
    //const {string, schema} = queryString;
    const {variables, clientSchema, forceFetch, paginationWords, idFieldName} = options;
    const {dispatch} = this._store;
    const cahsayDataStore = this._store.getState().getIn(['cashay', 'data']);
    const queryAST = parse(queryString, {noLocation: true, noSource: true});
    // based on query name + args, does it exist in cashay.denomralizedResults
    const denormLocationInCashayState = getDenormLocationFromQueryAST(queryAST, clientSchema, variables);
    const existsInStore = isDenormLocationInStore(this._store, denormLocationInCashayState);
    // if yes && !forceFetch, return
    if (existsInStore && !forceFetch) return;
    // denormalize queryAST from store data and create dependencies, return minimziedAST
    const context = buildExecutionContext(clientSchema, queryAST, {variables, paginationWords, idFieldName, store: this._store})
    const {dependencies, denormalizedResult, minimizedAST} = denormalizeAndCreateDependencies(queryAST, context);
    // insert denomralized JSON object in state.cashay.denormalizedResults
    dispatch({
      type: '@@cashay/INSERT_DENORMALIZED',
      payload: {
        dependencies,
        location: denormLocationInCashayState,
        result: denormalizedResult
      }
    })
    //if not complete,
    if (minimizedAST) {
      // print (minimizedAST)
      const minimizedQuerySTring = print(minimizedAST);
      // send minimizedQueryString to server and await minimizedQueryResponse
      const minimizedQueryResponse = await this._transport(minimizedQuerySTring, variables)
      // normalize response
      const context = buildExecutionContext(clientSchema, queryAST, {variables, paginationWords, idFieldName})
      const normalizedMinimizedQueryResponse = normalize(minimizedQueryResponse, context)
      // stick normalize data in store
      dispatch({
        type: '@@cashay/INSERT_NORMALIZED',
        payload: {
          response: normalizedMinimizedQueryResponse
        }
      })
      // denormalize queryAST from store data and create dependencies
      const {dependencies, denormalizedResult, minimizedAST} = denormalizeAndCreateDependencies(queryAST, this._store);
      dispatch({
        type: '@@cashay/INSERT_DENORMALIZED',
        payload: {
          dependencies,
          location: denormLocationInCashayState,
          result: denormalizedResult
        }
      })

    }


    //const partial = denormalize(cahsayDataStore.toJS(), varSchema, queryAST)
    // see what data we have in the store
    //const schemaKeys = Object.keys(schema);
    //schemaKeys.forEach(key => {
    //  if (schema[key].constructor.name === 'EntitySchema') {
    //    console.log('checking key', key)
    //    const entityId = cahsayDataState.getIn(['result', key]);
    //    console.log('entId', entityId, cahsayDataState)
    //    if (entityId) {
    //      const subStateName = schema[key].getKey();
    //      const obj = cahsayDataState.getIn(['entities', subStateName, entityId]);
    //      console.log('CACHED RES', obj);
    //    }
    //  }
    //})

    //dispatch({type: FETCH_DATA_REQUEST});
    //const {error, data} = await this._transport({query: string});
    //if (error) {
    //  return dispatch({
    //    type: FETCH_DATA_ERROR,
    //    error
    //  })
    //}
    //console.log('RESP', data)
    //const payload = normalize(data, schema);
    ////const ans = denormalize(payload, schema);
    //dispatch({
    //  type: FETCH_DATA_SUCCESS,
    //  payload
    //});
  }
}

