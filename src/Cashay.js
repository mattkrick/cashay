import {INSERT_NORMALIZED} from './duck';
import {parse} from 'graphql/language/parser';
import {denormalizeStore} from './denormalizeStore';
import {normalizeResponse} from './normalizeResponse';
import {printMinimalQuery} from './minimizeQueryAST';
import {buildExecutionContext} from './buildExecutionContext';

const defaultGetToState = store => store.getState().cashay;

export default class Cashay {
  constructor({store, transport, schema, getToState}) {
    // the redux store
    this._store = store;

    //how to get from the store to cahsay
    this._getToState = getToState || defaultGetToState;

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

    // a set to store the listener object so we only have to set listeners once
    this._ensuredListeners = new Set();

    // lookup table for connecting the mutation result to the entities it affects
    this._mutationStringToType = {};

    // denormalized deps is an object with entities for keys. 
    // The value of each entity is an object with uids for keys.
    // the value of each UID is a set of dependencyKeys pointing to a denormalized query that needs to be invalidated
    // const example = {
    //   Pets: {
    //     1: Set(dependencyKey1, dependencyKey2)
    //   }
    // }
    this._denormalizedDeps = {};

    // normalizedDeps is a Map where each key is a dependencyKey
    // the value is a Set of locations in the _denormalizedDeps (eg ['Pets','1']
    this._normalizedDeps = new Map();

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
        // TODO garbage collect here
        return storedDenormResult;
      }
    } else {
      // if we've never used the queryString before, save it
      denormalizedQueryMap = this._denormalizedResponses[queryString] = new Map();
    }

    const {paginationWords, idFieldName} = options;

    // parse the queryString into an AST and break it into tasty little chunks
    const context = buildExecutionContext(this._schema, queryString, {
      variables,
      paginationWords,
      idFieldName,
      store: this._store
    });

    // create a denormalized document from local data that also flags missing objects
    const denormalizedPartialResult = denormalizeStore(context);

    // operation.sendToServer means something down the tree needs to be fetched from the server
    const dataIsLocal = !context.operation.sendToServer;

    // if we're force fetching, always mark the result as incomplete since we'll get new data from the server
    denormalizedPartialResult._isComplete = !forceFetch && dataIsLocal;

    // if we need more data, get it from the server
    if (!denormalizedPartialResult._isComplete) {
      const transport = this._getTransport(options);

      // given an operation enhanced with sendToServer flags, print minimal query
      const minimizedQueryString = forceFetch ?
        context.dependencyKey.queryString : printMinimalQuery(context.operation, idFieldName);

      //  async query the server (no need to track the promise it returns, as it will change the redux state)
      this._queryServer(transport, context, minimizedQueryString);
    }

    // add denormalizedDeps so we can invalidate when other queries come in
    // add normalizedDeps to find those deps when a denormalizedReponse is mutated
    if (!this._normalizedDeps.has(context.dependencyKey)) {
      this._addDeps(denormalizedPartialResult, context.dependencyKey);
    }

    // store the possibly full result in cashay
    denormalizedQueryMap.set(variables, denormalizedPartialResult);


    if (!denormalizedQueryMap.has('options')) {

    }

    // go through a Map of function pointers to make sure we haven't listeners for this query before
    if (!this._ensuredListeners.has(mutationListeners)) {
      // keep options that are shared across variable combos (for listeners)
      denormalizedQueryMap.set('options', {paginationWords, idFieldName});

      // add the mutation listeners to the Cashay singleton
      this._ensureListeners(queryString, mutationListeners);
    }

    // if the only benefit we get from this dispatch is a few nulls & empty arrays, let's hold off until we get
    // the good stuff back from the server
    // if (!dataIsLocal) {
    //   const reduc
    //   // merge the new data 
    //   this._store.dispatch({
    //     type: '@@cashay/INSERT_NORMALIZED',
    //     payload: {
    //       response: denormalizedPartialResult
    //     }
    //   });
    // }
  }

  /*
   *
   * QUERY HELPER TO GET DATA FROM SERVER (ASYNC)
   *
   *  */
  async _queryServer(transport, context, minimizedQueryString) {
    const {variableValues: variables} = context;

    // send minimizedQueryString to server and await minimizedQueryResponse
    const minimizedQueryResponse = await transport(minimizedQueryString, variables);

    // normalize response to get ready to dispatch it into the state tree
    const normalizedMinimizedQueryResponse = normalizeResponse(minimizedQueryResponse, context);

    // add denormalizedDeps so we can invalidate when other queries come in
    // add normalizedDeps to find those deps when a denormalizedReponse is mutated
    this._addDeps(normalizedMinimizedQueryResponse, context.dependencyKey);

    // get current state data
    const cashayDataStore = this._getToState(this._store).get('data');

    // now, remove the objects that look identical to the ones already in the state
    // if the incoming entity (eg Person.123) looks exactly like the one already in the store, then
    // we don't have to invalidate and rerender 
    const normalizedResponseForStore = reduceNormalizedResponse(normalizedMinimizedQueryResponse, cashayDataStore);

    // walk the normalized response & grab the deps for each entity. put em all in a Set & flush it down the toilet
    const flushSet = this._makeFlushSet(normalizedResponseForStore);

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
  }

  _addDeps(normalizedResponse, dependencyKey) {
    const normalizedDeps = makeNormalizedDeps(normalizedResponse.entities);
    const previousNormalizedDeps = this._normalizedDeps.get(dependencyKey);

    // remove old denormalizedDeps
    if (previousNormalizedDeps) {
      // go through the remaining (obsolete) dependencies & if it isn't a new dep, remove it
      for (let stackLoc of previousNormalizedDeps) {
        if (!normalizedDeps.has(stackLoc)) {
          const [entity, item] = stackLoc.split('.');
          this._denormalizedDeps[entity][item].delete(dependencyKey);
        }
      }
    }

    //replace the old with the new
    this._normalizedDeps.set(dependencyKey, normalizedDeps);

    // go through and replace the denormalizedDeps with the new normalizedDeps
    for (let stackLoc of normalizedDeps) {
      const [entity, item] = stackLoc.split('.');
      this._denormalizedDeps[entity] = this._denormalizedDeps[entity] || {};
      this._denormalizedDeps[entity][item] = this._denormalizedDeps[entity][item] || new Set();
      this._denormalizedDeps[entity][item].add(dependencyKey);
    }
  }

  _ensureListeners(queryString, mutationListeners) {
    // add mutation listeners for add, update, delete
    Object.keys(mutationListeners).forEach(listener => {
      const listenerMap = this._listeners[listener];

      // make sure the listener is for add, update, or delete
      if (!listenerMap) {
        console.error(`Invalid mutation rule: ${listener}.\nSee queryString: ${queryString}`);
      }

      // make sure there is only 1 listener per queryString
      if (listenerMap.has(queryString)) {
        console.warn(`Each queryString can only have 1 set of rules per ${listener} mutation.
        Remove extra rules for secondary instances of: ${queryString}`);
      }

      // push the new listener
      listenerMap.set(queryString, mutationListeners[listener]);
    });
  }

  _getTransport(options) {
    const transport = options.transport || this._transport;
    if (typeof transport !== 'function') {
      console.error('No transport function provided');
    }
    return transport;
  }

  _makeFlushSet(normalizedResponse) {
    const flushSet = new Set();
    // walk the minimized normalized response & at each location, find it in this._normalizedDeps.
    // grab that Set & add it the the flushSet
    // return the flushSet
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

    (async() => {
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

const defaultSetLocationState = state => state.cashay

const getTypesMutated = (mutationString, schema) => {

};

const makeNormalizedDeps = entities => {
  const entityKeys = Object.keys(entities);
  const normalizedDeps = new Set();
  for (let i = 0; i < entityKeys.length; i++) {
    const entityName = entityKeys[i];
    const itemKeys = Object.keys(entities[entityName]);
    for (let j = 0; j < itemKeys.length; j++) {
      const itemName = itemKeys[j];
      const dep = `${entityName}.${itemName}`;
      normalizedDeps.add(dep);
    }
  }
  return normalizedDeps;
};

// const queryString = `getPosts {
//   id,
//       title,
//       comments {
//     id,
//         title
//   }
// }`
//
// const mutationRules = {
//   add: {
//     Post(optimisticVariables, docFromServer, currentResponse, invalidate) {
//       invalidate();
//     },
//     Comment(optimisticVariables, docFromServer, currentResponse, invalidate) {
//       // optimisticVariables and docFromServer are mutually exclusive
//       let newComment = docFromServer;
//       if (optimisticVariables) {
//         const {title, user} = optimisticVariables;
//         newComment = {
//           title,
//           user,
//           createdAt: Date.now()
//         }
//       }
//
//       const postIndex = currentResponse.getPosts.findIndex(post => post.id === newComment.postId);
//       if (postIndex !== -1) {
//         const parentPost = currentResponse.getPosts[postIndex];
//         const placeBefore = parentPost.comments.findIndex(comment => comment.reputation < newComment.reputation);
//         if (placeBefore !== -1) {
//           return parentPost.comments.splice(placeBefore, 0, newComment);
//         }
//       }
//     }
//   }
// };
