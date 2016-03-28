import {FETCH_DATA_REQUEST, FETCH_DATA_SUCCESS, FETCH_DATA_ERROR} from './duck';
import {normalize} from 'normalizr';
import {parse} from 'graphql/language/parser';
import {BEGIN, COMMIT, REVERT} from 'redux-optimistic-ui';


export default class Cashay {
  constructor({store, transport, schema}) {
    // the redux store
    this._store = store;

    // the default function to send the queryString to the server (usually HTTP or WS)
    this._transport = transport;

    // the client graphQL schema
    this._schema = schema;

    // the object to hold the denormalized query responses
    this._denormalizedResponses = {};

    // an incrementing id for redux-optimistic-ui
    this._optimisticId = 0;

    // a flag thrown by the invalidate function and reset when that query is added to the queue
    this._willInvalidateListener = false;

    // a queue of queries to refetch after a mutation invalidated their data
    this._invalidationQueue = [];

    // an array of queries listening for mutations
    this._listeners = {
      add: new Map(),
      update: new Map(),
      delete: new Map()
    };

    // lookup table for connecting the mutation result to the entities it affects
    this._mutationStringToType = {};
  }

  _invalidate() {
    this._willInvalidateListener = true;
  }

  /*
   *
   * QUERY METHOD
   *
   */
  query(queryString, options = {}, mutationListeners = {}) {
    //if you call forceFetch in a mapStateToProps, you're gonna have a bad time (it'll refresh on EVERY dispatch)
    const {variables, forceFetch} = options;

    // return a map where the unique variable object is the key & the denormalized result is the value
    let denormalizedQueryMap = this._denormalizedResponses[queryString];

    if (denormalizedQueryMap) {
      const storedDenormResult = denormalizedQueryMap.get(variables);

      // if the storedDenormResult exists & is complete & we aren't going to do a forceFetch, return it FAST
      if (storedDenormResult && storedDenormResult._isComplete && !forceFetch) {
        return storedDenormResult;
      }
    } else {
      // if we've never used the queryString before, save it
      denormalizedQueryMap = this._denormalizedResponses[queryString] = new Map();
    }

    // the request query + vars combo are not stored
    const queryAST = parse(queryString, {noLocation: true, noSource: true});

    // denormalize queryAST from store data and create dependencies, return minimziedAST
    const {paginationWords, idFieldName} = options;
    //const schema = options.schema || this._schema;

    const context = buildExecutionContext(this._schema, queryAST, {
      variables,
      paginationWords,
      idFieldName,
      store: this._store
    });
    //denormalizedPartialResult.isComplete = !minimizedAST; // done in denormFromStore
    const {denormalizedPartialResult, minimizedAST} = denormFromStore(queryAST, context);

    // store the possibly full result in cashay
    denormalizedQueryMap.set(variables, denormalizedPartialResult);
    if (!denormalizedQueryMap.has('options')) {
      denormalizedQueryMap.set('options', {paginationWords, idFieldName})
    }

    // if all the data is obtained locally, we're done!
    if (!minimizedAST) {
      return denormalizedQueryMap.get(variables)
    }

    // create an object unique to the queryString + vars
    const dependencyKey = {queryString, variables};

    // otherwise, normalize the partial data so we can cache pending queries
    const normalizedPartialResult = normalizeAndAddDeps(denormalizedPartialResult, context, dependencyKey);

    // TODO: either put the normalizedPartialResult in the store or keep in in an array & run through each after minimizing
    // the minimizaing logic must work on a queryAST + schema (to walk the queryAST) + normalized data

    // fetch the missing data
    (async () => {
      // print (minimizedAST)
      const minimizedQueryString = print(minimizedAST);

      // get transport from options or default
      const transport = options.transport || this._transport;
      if (typeof transport !== 'function') {
        console.error('No transport function provided');
      }

      // send minimizedQueryString to server and await minimizedQueryResponse
      const minimizedQueryResponse = await transport(minimizedQueryString, variables);

      // normalize response and add the storedDenormResults  to every object as a dep
      const normalizedMinimizedQueryResponse = normalizeAndAddDeps(minimizedQueryResponse, context, dependencyKey);

      // get current state data
      const cashayDataStore = this._store.getState().getIn(['cashay', 'data']);

      // walk the minimized response & at each location, find it in the current state. if it exists, add its deps
      const flushSet = makeFlushSet(normalizedMinimizedQueryResponse, cashayDataStore);

      // invalidate all denormalized results that depended on this data
      // by aggresively invalidating, this serves as a garbage collector since it won't be recreated unless necessary
      // TODO: if no mutations ever occur, such as pagination of read-only docs, when should we run GC?
      for (let entry of flushSet) {
        const {queryString, variables} = entry;
        this._denormalizedResponses[queryString].delete(variables);
        this._listeners.add.delete(queryString);
        //this._listeners.update.delete(queryString);
        //this._listeners.delete.delete(queryString);
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

    // add mutation listeners for add, update, delete
    Object.keys(mutationListeners).forEach(listener => {
      const listenerMap = this._listeners[listener];

      // make sure the listener is for add, update, or delete
      if (!listenerMap) {
        console.error(`Invalid mutation rule: ${listener}.\nSee queryString: ${queryString}`);
      }

      // make sure there is only 1 listener per queeryString
      if (listenerMap.has(queryString)) {
        console.warn(`Each queryString can only have 1 set of rules per ${listener} mutation.
        Remove extra rules for secondary instances of: ${queryString}`);
      }

      // push the new listener
      listenerMap.set(queryString, mutationListeners[listener]);
    });
  }

  /*
   *
   * ADD MUTATION METHOD
   *
   */
  add(mutationString, options = {}) {
    const {variables} = options;
    //const schema = options.schema || this._schema;
    const typesMutated = getTypesMutated(mutationString, this._schema);

    (async () => {
      const transport = options.transport || this._transport;
      const docFromServer = await transport(mutationString, variables);
      // update state with new doc from server
      this._addListenersHandler(typesMutated, docFromServer);
      this._invalidationQueue.forEach(queryToRefetch => queryToRefetch());
      this._invalidationQueue = [];
    })();
    // optimistcally update
    this._addListenersHandler(typesMutated)
  }

  _addListenersHandler(typesMutated, docFromServer) {
    // for every add listener
    for (let [queryString, listenerObj] of this._listeners.add.entities()) {
      // for every type of entity mutated in the returned mutation (usually 1)
      for (let typeMutated of typesMutated) {
        const relevantListener = listenerObj[typeMutated];
        if (!relevantListener) {
          continue;
        }
        const queryMap = this._denormalizedResponses[queryString];
        let executionContext;
        // iterate through the same query with different variable objects
        for (let [variables, query] of queryMap.entities()) {
          // skip the options object
          if (variables === 'options') {
            continue;
          }

          // for every memoized denormalized response, mutate it in place or return undefined if no mutation was made
          const modifiedResponse = docFromServer ?
            // if it's from the server, send the doc we got back
            relevantListener(null, docFromServer, query, this._invalidate) :
            // otherwise, treat it as an optimistic update
            relevantListener(variables, null, query, this._invalidate);

          // see if we want to rerun the listening query again. it so, put it in a map & we'll run them after
          // this means there's a possible 3 updates: optimistic, doc from server, full array from server
          if (this._willInvalidateListener) {
            const {paginationWords, idFieldName} = queryMap.get('options');
            this._willInvalidateListener = false;
            if (!this._invalidationQueue.has(queryString)) {
              this._invalidationQueue.set(queryString, () => {
                console.log('querySTring mutated?', queryString, variables);
                this.query(queryString, {
                  variables,
                  paginationWords,
                  idFieldName,
                  forceFetch: true
                })
              })
            }
          }
          if (!modifiedResponse) {
            continue;
          }
          // if a mutation was made, normalize it & send it off to the store
          // TODO: normalizing requires context, requires the queryAST, but we don't wanna parse that over & over!
          // let's parse for alpha, then figure out whether to store it or do something intelligent
          // like only save it if it's used a lot
          if (executionContext) {
            executionContext.variables = variables;
          } else {
            // only parse the query once, regardless of how many variable-deviations there are
            const queryAST = parse(queryString, {noLocation: true, noSource: true});
            const {paginationWords, idFieldName} = queryMap.get('options');
            executionContext = buildExecutionContext(this._schema, queryAST, {
              variables,
              paginationWords,
              idFieldName,
              store: this._store
            });
          }
          const normalizedModifiedResponse = normalize(modifiedResponse, context);
          // merge the normalized optimistic result with the state
          // dont change other queries, they might not want it.
          // if they want it, they'll ask for it in their own listener
          this._store.dispatch({
            type: '@@cashay/INSERT_NORMALIZED',
            payload: {
              response: normalizedModifiedResponse
            }
          });
        }
      }
    }
  }
}

const getTypesMutated = (mutationString, schema) => {

};
