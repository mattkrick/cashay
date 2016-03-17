import {FETCH_DATA_REQUEST, FETCH_DATA_SUCCESS, FETCH_DATA_ERROR} from './duck';
import {normalize} from 'normalizr';
import {parse} from 'graphql/language/parser';

export default class Cashay {
  constructor({store, transport, schema}) {
    this._store = store;
    this._transport = transport;
    this._schema = schema;
    // if memoizing is too slow, use a map inside the object & set vars as map keys so we don't stringify anything
    this._denormalizedQueries = {};
  }

  query(queryString, options = {}) {
    //if you call forceFetch in a mapStateToProps, you're gonna have a bad time
    const {variables, clientSchema, forceFetch, paginationWords, idFieldName} = options;
    // create memoized key
    const memoizedKey = `${queryString}${JSON.stringify(variables)}`;

    // return memoized result if it exists
    const storedDenormResult = this._denormalizedQueries[memoizedKey];

    // if the storedDenormResult exists & is complete & we aren't going to do a forceFetch, return it FAST
    if (storedDenormResult && storedDenormResult._isComplete && !forceFetch) {
      return storedDenormResult;
    }

    // the request query + vars combo are not stored
    const {dispatch} = this._store;
    const queryAST = parse(queryString, {noLocation: true, noSource: true});

    // denormalize queryAST from store data and create dependencies, return minimziedAST
    const context = buildExecutionContext(clientSchema, queryAST, {
      variables,
      paginationWords,
      idFieldName,
      store: this._store
    });
    //denormalizedPartialResult.isComplete = !minimizedAST; // done in denormFromStore
    const {denormalizedPartialResult, minimizedAST} = denormFromStore(queryAST, context);

    // store the possibly full result in cashay
    this._denormalizedQueries[memoizedKey] = denormalizedPartialResult;
    if (minimizedAST) {
      (async () => {
        // print (minimizedAST)
        const minimizedQueryString = print(minimizedAST);

        // send minimizedQueryString to server and await minimizedQueryResponse
        const minimizedQueryResponse = await this._transport(minimizedQueryString, variables);

        // normalize response and add the memoizedKey to every object as a dep
        const normalizedMinimizedQueryResponse = normalizeAndAddDeps(minimizedQueryResponse, context, memoizedKey);

        // get current state data
        const cashayDataStore = this._store.getState().getIn(['cashay', 'data']);

        // walk the minimized response & at each location, find it in the current state. if it exists, add its deps
        const flushSet = makeFlushSet(normalizedMinimizedQueryResponse, cashayDataStore);

        // invalidate all denormalized results that depended on this data
        for (let entry of flushSet) {
          // is it safe to hot patch here instead of starting from scratch? i think not
          // eg queryA and queryB. B' causes A to invalidate, A' now requires something B' didn't give it
          this._denormalizedQueries[entry] = undefined;
        }

        // combine partial query with the new minimal response (a little hacky to get a result before the dispatch)
        const {minimalResult, minimizedAST} = combinePartialAndMinimal(denormalizedPartialResult, normalizedMinimizedQueryResponse);
        this._denormalizedQueries[memoizedKey] = minimalResult;

        // stick normalize data in store
        dispatch({
          type: '@@cashay/INSERT_NORMALIZED',
          payload: {
            response: normalizedMinimizedQueryResponse

          }
        });
      })();
    }
    return this._denormalizedQueries[memoizedKey];
  }
}
