import {INSERT_NORMALIZED, SET_VARIABLES} from './duck';
import {parse} from 'graphql/language/parser';
import {denormalizeStore} from './denormalizeStore';
import {normalizeResponse} from './normalizeResponse';
import {printMinimalQuery} from './minimizeQueryAST';
import {buildExecutionContext} from './buildExecutionContext';
import {makeNormalizedDeps, shortenNormalizedResponse} from './queryHelpers';
import {isObject} from './utils';

const defaultGetToState = store => store.getState().cashay;

export default class Cashay {
  constructor({store, transport, schema, getToState}) {
    // the redux store
    this._store = store;

    //how to get from the store to cashay
    this._getToState = getToState || defaultGetToState;

    // the default function to send the queryString to the server (usually HTTP or WS)
    this._transport = transport;

    // the client graphQL schema
    this._schema = schema;

    // the object to hold the denormalized query responses
    this._denormalizedResults = {};

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

    // TODO store queryASTs in a WeakMap?
  }

  _invalidate() {
    this._willInvalidateListener = true;
  }

  /**
   * A method that accepts a GraphQL query and returns a result using only local data.
   * If it cannot complete the request on local data alone, it also asks the server for the data that it does not have.
   *
   * @param {String} queryString The GraphQL query string, exactly as you'd send it to a GraphQL server
   * @param {Object} options The optional objects to include with the query
   *
   * @property {String} options.componentId A string to uniquely match the queryString to the component.
   * Only necessary if the queryString will be used on multiple components.
   * @property {Boolean} options.forceFetch is true if the query is to ignore all local data and fetch new data
   * @property {String} options.idFieldName is the name of the field that contains the unique ID (default is 'id')
   * @property {Object} options.paginationWords is an object that contains custom names for 'before, after, first, last'
   * @property {Function} options.transport The function used to send the data request to GraphQL, if different from default
   * @property {Object} options.variables are the variables sent along with the query
   *
   * @param {Object} mutationListeners the functions used to change the local data when a mutation occurs
   *
   * @returns {Object} The denormalized object like GraphQL would return, with an additional `_isComplete` flag
   *
   */
  query(queryString, options = {}, mutationListeners) {
    //if you call forceFetch in a mapStateToProps, you're gonna have a bad time (it'll refresh on EVERY dispatch)
    const {forceFetch} = options;

    // Each component can have only 1 unique queryString/variable combo. This keeps memory use minimal.
    // if 2 components have the same queryString/variable but a different componentId, it'll fetch twice
    const componentId = options.componentId || queryString;
    const variables = this._getToState(this._store).data.variables[componentId] || options.variables;

    // get the result, containing a response, queryString, options to re-call the query, and a fetchCameBack boolean
    const cachedResult = this._denormalizedResults[componentId];

    // if we care about local data & the vars are the same & the response is complete, return FAST
    // fetchCameBack is false when a req is sent to the server & true when it comes back
    // it's necessary because calling dispatch from within a mapStateToProps will cause that mapStateToProps to rerender
    // if a dispatch occurs before the server replies, we can use the cached incomplete data
    if (!forceFetch && cachedResult && (!cachedResult.fetchCameBack || cachedResult.response._isComplete)) {
      if (cachedResult.variables === variables || JSON.stringify(cachedResult.variables) === JSON.stringify(variables)) {
        console.log('cache hit');
        return cachedResult.response;
      }
    }

    // troubleshooting
    if (!cachedResult) {
      console.log(`cache miss (no cached resulted)`)
    } else if (cachedResult.fetchCameBack) {
      console.log('cache miss (new data from server)')
    }

    // parse the queryString into an AST and break it into tasty little chunks
    const {paginationWords, idFieldName} = options;
    const context = buildExecutionContext(this._schema, queryString, {
      variables,
      paginationWords,
      idFieldName,
      store: this._getToState(this._store).data
    });

    // create a denormalized document from local data that also turns frags to inline & flags missing objects in context.operation
    // the response also contains _isComplete and _firstRun booleans. 
    // _isComplete is true if the request is resolved locally
    // _firstRun is true if the none of the queries within the request have been executed before
    //TODO maybe don't denormalize if it's a forceFetch? Just return what we have, if anything.
    const denormalizedPartialResponse = denormalizeStore(context);

    // if we're force fetching, always mark the result as incomplete since we'll get new data from the server
    denormalizedPartialResponse._isComplete = !forceFetch && denormalizedPartialResponse._isComplete;
    denormalizedPartialResponse.setVariables = this._setVariablesFactory(componentId, variables);

    const transport = this._getTransport(options);

    // if we need more data, get it from the server
    if (!denormalizedPartialResponse._isComplete) {

      // remove variableDefinitions that are no longer in use
      context.operation.variableDefinitions = context.operation.variableDefinitions.filter(varDef => varDef._inUse === true);
      
      // given an operation enhanced with sendToServer flags, print minimal query
      // should forceFetch minimize based on pending queries?
      const serverQueryString = (forceFetch || denormalizedPartialResponse._firstRun) ?
        queryString : printMinimalQuery(context.operation, idFieldName);

      //  async query the server (no need to track the promise it returns, as it will change the redux state)
      this._queryServer(transport, context, serverQueryString, componentId);
    }

    // normalize the localResponse so we prevent duplicate requests by merging with the store
    const normalizedPartialResponse = normalizeResponse(denormalizedPartialResponse.data, context);

    // if this is a different query string but the same query
    // eg in this one we request 1 more field
    if (!denormalizedPartialResponse._firstRun) {
      this._addDeps(normalizedPartialResponse, context.dependencyKey);
    }

    // store the possibly full result in cashay
    this._denormalizedResults[componentId] = {
      response: denormalizedPartialResponse,
      // keep options that are shared across variable combos (for listeners)
      options: {
        paginationWords: context.paginationWords,
        idFieldName: context.idFieldName,
        variables,
        transport
      },
      queryString,
      fetchCameBack: denormalizedPartialResponse._isComplete
    };

    // go through a Map of function pointers to make sure we dont have listeners for this componentId
    // TODO someone could use the same listeners for different components
    if (isObject(mutationListeners) && !this._ensuredListeners.has(mutationListeners)) {
      // add the mutation listeners to the Cashay singleton
      this._ensureListeners(componentId, mutationListeners);
    }
    return denormalizedPartialResponse;

    // by putting nulls and empty arrays in the state, we're lying to the next query that wants data
    // that means we don't know what data is real & what is fake
    // this causes a problem with things that just return in the result, since there are no deps on the result

    // if we've already got all the data, we don't need to adjust the state
    // if (!denormalizedPartialResponse._isComplete) {
    //   this._store.dispatch({
    //     type: '@@cashay/INSERT_NORMALIZED_OPTIMISTIC',
    //     payload: {
    //       response: normalizedPartialResponse
    //     }
    //   });
    // }
  }

  _setVariablesFactory = (componentId, currentVariables) => {
    return cb => {
      const variables = Object.assign({}, currentVariables, cb(currentVariables));
      
      // invalidate the cache
      this._denormalizedResults[componentId] = undefined;

      // use dispatch to trigger a recompute.
      this._store.dispatch({
        type: SET_VARIABLES,
        payload: {
          componentId,
          variables
        }
      });
    }
  };

  /*
   *
   * QUERY HELPER TO GET DATA FROM SERVER (ASYNC)
   *
   **/
  async _queryServer(transport, context, minimizedQueryString, componentId) {
    const {variables, dependencyKey} = context;
    // send minimizedQueryString to server and await minimizedQueryResponse
    const minimizedQueryResponse = await transport(minimizedQueryString, variables);

    if (!minimizedQueryResponse.data) {
      console.log(JSON.stringify(minimizedQueryResponse.errors));
      // console.log(`Error with query: \n ${minimizedQueryString}`);
      return;
    }
    // normalize response to get ready to dispatch it into the state tree
    const normalizedMinimizedQueryResponse = normalizeResponse(minimizedQueryResponse.data, context);


    // add denormalizedDeps so we can invalidate when other queries come in
    // add normalizedDeps to find those deps when a denormalizedReponse is mutated
    this._addDeps(normalizedMinimizedQueryResponse, dependencyKey);

    // get current state data
    const cashayDataStore = this._getToState(this._store).data;

    // now, remove the objects that look identical to the ones already in the state
    // if the incoming entity (eg Person.123) looks exactly like the one already in the store, then
    // we don't have to invalidate and rerender

    const normalizedResponseForStore = shortenNormalizedResponse(normalizedMinimizedQueryResponse, cashayDataStore);

    // walk the normalized response & grab the deps for each entity. put em all in a Set & flush it down the toilet
    const flushSet = this._makeFlushSet(normalizedResponseForStore, dependencyKey);
    debugger
    // TODO: if no mutations ever occur, such as pagination of read-only docs, when should we run GC?
    for (let entry of flushSet) {
      const {queryString, variables} = entry;
      this._denormalizedResults[componentId] = undefined;
      this._listeners.add.delete(queryString);
      //this._listeners.update.delete(queryString);
      //this._listeners.delete.delete(queryString);
    }

    // combine partial query with the new minimal response (a little hacky to get a result before the dispatch)
    // fullResult should come with an _isComplete flag set to true
    // const fullResult = mergeDeepWithArrs(denormalizedPartialResponse, normalizedMinimizedQueryResponse);
    // this._denormalizedResults[context.dependencyKey.queryString].set(variables, fullResult);

    // yay, the full result is coming! time to start listening to dispatches again
    this._denormalizedResults[componentId].fetchCameBack = true;
    // stick normalize data in store and recreate any invalidated denormalized structures
    this._store.dispatch({
      type: INSERT_NORMALIZED,
      payload: {
        response: normalizedMinimizedQueryResponse,
        componentId,
        variables
      }
    });
  }

  _addDeps(normalizedResponse, dependencyKey) {
    // create a set of normalized locations in entities (eg 'Post.123')
    const normalizedDeps = makeNormalizedDeps(normalizedResponse.entities);

    // get the previous set
    const previousNormalizedDeps = this._normalizedDeps.get(dependencyKey);

    // remove old denormalizedDeps
    if (previousNormalizedDeps) {
      // go through the remaining (obsolete) dependencies & if it isn't a new dep, remove it from the cached structure
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
    // TODO babel turns this into a try/catch. maybe move it to its own function
    for (let stackLoc of normalizedDeps) {
      const [entity, item] = stackLoc.split('.');
      this._denormalizedDeps[entity] = this._denormalizedDeps[entity] || {};
      this._denormalizedDeps[entity][item] = this._denormalizedDeps[entity][item] || new Set();
      this._denormalizedDeps[entity][item].add(dependencyKey);
    }
  }

  _ensureListeners(componentId, mutationListeners) {
    // add mutation listeners for add, update, delete
    Object.keys(mutationListeners).forEach(listener => {
      const listenerMap = this._listeners[listener];

      // make sure the listener is for add, update, or delete
      if (!listenerMap) {
        console.error(`Invalid mutation rule: ${listener}.\nSee componentId: ${componentId}`);
      }

      // make sure there is only 1 listener per componentId
      if (listenerMap.has(componentId)) {
        console.warn(`Each componentId can only have 1 set of rules per ${listener} mutation.
        Remove extra rules for secondary instances of: ${componentId}`);
      }

      // push the new listener
      listenerMap.set(componentId, mutationListeners[listener]);
    });
  }

  _getTransport(options) {
    const transport = options.transport || this._transport;
    if (typeof transport !== 'function') {
      console.error('No transport function provided');
    }
    return transport;
  }

  /*
   * Crawl the dependency tree snagging up everything that will be invalidated
   * No safety checks required.
   * The tree is guaranteed to have everything we look for because of _addDeps
   */
  _makeFlushSet(normalizedResponse, selfDependencyKey) {
    let flushSet = new Set();
    const {entities} = normalizedResponse;
    const entityKeys = Object.keys(entities);
    for (let i = 0; i < entityKeys.length; i++) {
      const entityName = entityKeys[i];
      const entityDepObject = this._denormalizedDeps[entityName];
      const newEntity = entities[entityName];
      const itemKeys = Object.keys(newEntity);
      for (let j = 0; j < itemKeys.length; j++) {
        const itemName = itemKeys[j];
        const itemDepSet = entityDepObject[itemName];
        // there's gotta be a more efficient way to merge sets. gross.
        flushSet = new Set([...flushSet, ...itemDepSet]);
      }
    }
    flushSet.delete(selfDependencyKey);
    return flushSet;
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
    for (let [componentId, listenerObj] of this._listeners.add.entities()) {
      // for every type of entity mutated in the returned mutation (usually 1)
      for (let typeMutated of typesMutated) {
        const relevantListener = listenerObj[typeMutated];
        if (!relevantListener) {
          continue;
        }
        // find current cached result for this particular componentId
        const cachedResult = this._denormalizedResults[componentId];
        let executionContext;
        const {variables, queryString, response} = cachedResult;

        // for the denormalized response, mutate it in place or return undefined if no mutation was made
        const modifiedResponse = docFromServer ?
          // if it's from the server, send the doc we got back
          relevantListener(null, docFromServer, response, this._invalidate) :
          // otherwise, treat it as an optimistic update
          relevantListener(variables, null, response, this._invalidate);

        // see if we want to rerun the listening query again. it so, put it in a map & we'll run them after
        // this means there's a possible 3 updates: optimistic, doc from server, full array from server (invalided)
        if (this._willInvalidateListener) {
          const {paginationWords, idFieldName} = cachedResult.options;
          this._willInvalidateListener = false;
          if (!this._invalidationQueue.has(componentId)) {
            this._invalidationQueue.set(componentId, () => {
              console.log('querySTring mutated?', componentId, variables);
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

const getTypesMutated = (mutationString, schema) => {

};

// const setVariables = (cb, componentId, currentVariables) => {
//   this._store.dispatch({
//     type: 'SET_VARIABLES',
//     payload: {
//       componentId,
//       newVariables: cb(currentVariables)
//     }
//   })
// };

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
