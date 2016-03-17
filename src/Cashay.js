import {FETCH_DATA_REQUEST, FETCH_DATA_SUCCESS, FETCH_DATA_ERROR} from './duck';
import {normalize} from 'normalizr';
import {parse} from 'graphql/language/parser';

export default class Cashay {
  constructor({store, transport, schema}) {
    this._store = store;
    this._transport = transport;
    this._schema = schema;
    this._denormalizedQueries = {};
  }

  query(queryString, options = {}) {
    //if you call forceFetch in a mapStateToProps, you're gonna have a bad time (it'll refresh on EVERY dispatch)
    const {variables, forceFetch} = options;

    // return a map where the unique variable object is the key & the denormalized result is the value
    let denormalizedQueryMap = this._denormalizedQueries[queryString];

    if (denormalizedQueryMap) {
      const storedDenormResult = denormalizedQueryMap.get(variables);

      // if the storedDenormResult exists & is complete & we aren't going to do a forceFetch, return it FAST
      if (storedDenormResult && storedDenormResult._isComplete && !forceFetch) {
        return storedDenormResult;
      }
    } else {
      // if we've never used the queryString before, save it
      denormalizedQueryMap = this._denormalizedQueries[queryString] = new Map();
    }

    // the request query + vars combo are not stored
    const queryAST = parse(queryString, {noLocation: true, noSource: true});
    // denormalize queryAST from store data and create dependencies, return minimziedAST
    const {clientSchema, paginationWords, idFieldName} = options;
    const context = buildExecutionContext(clientSchema, queryAST, {
      variables,
      paginationWords,
      idFieldName,
      store: this._store
    });
    //denormalizedPartialResult.isComplete = !minimizedAST; // done in denormFromStore
    const {denormalizedPartialResult, minimizedAST} = denormFromStore(queryAST, context);

    // store the possibly full result in cashay
    denormalizedQueryMap.set(variables, denormalizedPartialResult);

    // if all the data is obtained locally, we're done!
    if (!minimizedAST) {
      return denormalizedQueryMap.get(variables)
    }

    // fetch the missing data
    (async () => {
      // print (minimizedAST)
      const minimizedQueryString = print(minimizedAST);

      // send minimizedQueryString to server and await minimizedQueryResponse
      const minimizedQueryResponse = await this._transport(minimizedQueryString, variables);

      // create an object unique to the queryString + vars
      const dependencyKey = {queryString, variables};

      // normalize response and add the storedDenormResults  to every object as a dep
      const normalizedMinimizedQueryResponse = normalizeAndAddDeps(minimizedQueryResponse, context, dependencyKey);

      // get current state data
      const cashayDataStore = this._store.getState().getIn(['cashay', 'data']);

      // walk the minimized response & at each location, find it in the current state. if it exists, add its deps
      const flushSet = makeFlushSet(normalizedMinimizedQueryResponse, cashayDataStore);

      // invalidate all denormalized results that depended on this data
      for (let entry of flushSet) {
        this._denormalizedQueries[entry.queryString][entry.variables] = undefined;
      }

      // combine partial query with the new minimal response (a little hacky to get a result before the dispatch)
      // fullResult should come with an _isComplete flag set to true
      const fullResult = combinePartialAndMinimal(denormalizedPartialResult, normalizedMinimizedQueryResponse);
      denormalizedQueryMap.set(variables, fullResult);

      // stick normalize data in store and recreate any invalidated denormalized structures
      this._store.dispatch({
        type: '@@cashay/INSERT_NORMALIZED',
        payload: {
          response: normalizedMinimizedQueryResponse
        }
      });
    })();
  }
}
