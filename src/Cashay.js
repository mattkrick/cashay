import {INSERT_NORMALIZED, SET_VARIABLES} from './duck';
import {denormalizeStore} from './denormalizeStore';
import {rebuildOriginalArgs} from './denormalizeHelpers';
import {normalizeResponse} from './normalizeResponse';
import {printMinimalQuery} from './minimizeQueryAST';
import {buildExecutionContext} from './buildExecutionContext';
import {makeNormalizedDeps, shortenNormalizedResponse} from './queryHelpers';
import {isObject} from './utils';
import {deepAssign} from './deepAssign';
import {createMutationString} from './createMutationString';

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

    // an object of with mutationNames as keys and a map for a prop
    // the map has the componentId for the key and an object with a mutation (strong) and resolve (fn) for a values
    this._listenersByMutation = {};

    // a set of componentIds to quickly make sure we've got some listeners
    this._ensuredListeners = new Set();

    // key = mutationName, prop = {setKey: Set(), fullMutation: string}
    this._cachedMutations = {};
    // lookup table for connecting the mutation result to the entities it affects
    // this._mutationStringToType = {};

    // denormalized deps is an object with entities for keys. 
    // The value of each entity is an object with uids for keys.
    // the value of each UID is a set of componentIds
    // const example = {
    //   Pets: {
    //     1: Set("componentId1", "componentId2")
    //   }
    // }
    this._denormalizedDeps = {};

    // normalizedDeps is an Object where each key is a componentId
    // it's not stored in _denormalizedResults in able to compare old vs new deps
    // the value is a Set of locations in the _denormalizedDeps (eg ['Pets','1'])
    this._normalizedDeps = {};

    // TODO store queryASTs in a WeakMap?
  }

  /**
   * a method given to a mutation callback that turns on a global.
   * if true, then we know to queue up a requery
   */
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

    // get the result, containing a response, queryString, options to re-call the query, and a fetchCameBack boolean
    const cachedResult = this._denormalizedResults[componentId];

    // if we got local data cached already, send it back fast
    if (cachedResult && !forceFetch) {
      return cachedResult.response;
    }

    // parse the queryString into an AST and break it into tasty little chunks
    // in the future, babel will parse the query at compile time to speed this up
    const variables = this._getToState(this._store).data.variables[componentId] || options.variables;
    const {paginationWords, idFieldName} = options;
    const context = buildExecutionContext(this._schema, queryString, {
      variables,
      paginationWords,
      idFieldName,
      cashayDataState: this._getToState(this._store).data
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

    // normalize the denormalizedPartialResponse so we prevent duplicate requests by merging with the store
    const normalizedPartialResponse = normalizeResponse(denormalizedPartialResponse.data, context);

    // if we need more data, get it from the server
    if (!denormalizedPartialResponse._isComplete) {

      // remove variableDefinitions that are no longer in use, flag is set during denorm
      context.operation.variableDefinitions = context.operation.variableDefinitions.filter(varDef => varDef._inUse === true);

      // given an operation enhanced with sendToServer flags, print minimal query
      // should forceFetch minimize based on pending queries?
      const serverQueryString = (forceFetch || denormalizedPartialResponse._firstRun) ?
        queryString : printMinimalQuery(context.operation, idFieldName);

      //  async query the server (no need to track the promise it returns, as it will change the redux state)
      this._queryServer(transport, context, serverQueryString, componentId, normalizedPartialResponse);
    }


    // if this is a different query string but the same query
    // eg in this one we request 1 more field
    // we'll want to run this if the rsponse came back complete locally
    // as well as any partial data, since we don't know when the server response will come back
    // and stuff could get invalidated before then
    if (!denormalizedPartialResponse._firstRun) {
      this._addDeps(normalizedPartialResponse, componentId);
    }

    // store the possibly full result in cashay
    this._denormalizedResults[componentId] = {
      response: denormalizedPartialResponse,
      // keep options that are shared across variable combos (for listeners)
      options: {
        paginationWords: context.paginationWords,
        idFieldName: context.idFieldName,
        transport
      },
      queryString
    };

    // go through a Set of function pointers to make sure we dont have listeners for this componentId
    if (isObject(mutationListeners) && !this._ensuredListeners.has(componentId)) {
      // add the mutation listeners to the Cashay object
      this._ensureListeners(componentId, mutationListeners);
    }
    return denormalizedPartialResponse;
  }

  /**
   * Creates a function to allow for the user to change the variables without mutating the old
   * variables or having to type the componentId. This allows for pretty painless state++ behavior
   */
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

  /**
   * A method used to get missing data from the server.
   * Once the data comes back, it is normalized, old dependencies are removed, new ones are created,
   * and the data that comes back from the server is compared to local data to minimize invalidations
   *
   * @param {function} transport the transport function to send the query + vars to a GraphQL endpoint
   * @param {object} context the context to normalize data, including the requestAST and schema
   * @param {string} minimizedQueryString the query string to send to the GraphQL endpoint
   * @param {string} componentId an ID specific to the queryString/variable combo (defaults to the queryString)
   * @param {object} normalizedPartialResponse the local data that we already have to fulfill the request
   *
   * @return {undefined}
   */
  async _queryServer(transport, context, minimizedQueryString, componentId, normalizedPartialResponse) {
    const {variables} = context;

    // send minimizedQueryString to server and await minimizedQueryResponse
    const minimizedQueryResponse = await transport(minimizedQueryString, variables);

    // handle errors coming back from the server
    if (!minimizedQueryResponse.data) {
      console.log(JSON.stringify(minimizedQueryResponse.errors));
      this._denormalizedResults[componentId].error = JSON.stringify(minimizedQueryResponse.errors);
      // TODO put error in redux state
      return;
    }

    // normalize response to get ready to dispatch it into the state tree
    const normalizedMinimizedQueryResponse = normalizeResponse(minimizedQueryResponse.data, context);

    // combine the partial response with the server response to fully respond to the query
    const fullNormalizedResponse = deepAssign(normalizedPartialResponse, normalizedMinimizedQueryResponse);

    // it's possible that we adjusted the arguments for the operation we sent to server
    // for example, instead of asking for 20 docs, we asked for 5 at index 15.
    // now, we want to ask for the 20 again
    rebuildOriginalArgs(context.operation);

    // read from a pseudo store (eliminates a requery)
    // even if the requery wasn't expensive, doing it here means we don't have to keep track of the fetching status
    // eg if fetching is true, then we always return the cached result
    const reducedContext = Object.assign(context, {cashayDataState: fullNormalizedResponse});
    const fullDenormalizedResponse = denormalizeStore(reducedContext);
    // ignore the result from above, it was using the mutated content from the initial request
    fullDenormalizedResponse._isComplete = true;

    // attach a function to the response that supplies the currentVariables so the user can create a new vars object
    fullDenormalizedResponse.setVariables = this._setVariablesFactory(componentId, variables);

    this._denormalizedResults[componentId] = {
      response: fullDenormalizedResponse,
      options: {
        paginationWords: context.paginationWords,
        idFieldName: context.idFieldName,
        transport
      },
      queryString: context.queryString
    };

    // add denormalizedDeps so we can invalidate when other queries come in
    // add normalizedDeps to find those deps when a denormalizedReponse is mutated
    // the data fetched from server is only part of the story, so we need the full normalized response
    this._addDeps(fullNormalizedResponse, componentId);

    // get current state data
    const cashayDataState = this._getToState(this._store).data;

    // now, remove the objects that look identical to the ones already in the state
    // if the incoming entity (eg Person.123) looks exactly like the one already in the store, then
    // we don't have to invalidate and rerender
    const normalizedResponseForStore = shortenNormalizedResponse(normalizedMinimizedQueryResponse, cashayDataState);

    // walk the normalized response & grab the deps for each entity. put em all in a Set & flush it down the toilet
    const flushSet = this._makeFlushSet(normalizedResponseForStore, componentId);

    // TODO: if no mutations ever occur, such as pagination of read-only docs, when should we run GC?
    for (let flushedComponentId of flushSet) {
      this._denormalizedResults[flushedComponentId] = undefined;
      // this._listenersByMutation.add.delete(flushedComponentId);
      // TODO when a component is dismounted, delete from _ensuredListeners and _listenersByMutation
      // Ideally check normalizedDeps for the componentId & if there are none, then remove listeners
    }

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

  _addDeps(normalizedResponse, componentId) {
    // get the previous set
    const oldNormalizedDeps = this._normalizedDeps[componentId];

    // create a set of normalized locations in entities (eg 'Post.123')
    const newNormalizedDeps = this._normalizedDeps[componentId] = makeNormalizedDeps(normalizedResponse.entities);

    let newUniques;
    if (!oldNormalizedDeps) {
      newUniques = newNormalizedDeps;
    } else {
      // create 2 Sets that are the left/right diff of old and new
      newUniques = new Set();
      for (let dep of newNormalizedDeps) {
        if (oldNormalizedDeps.has(dep)) {
          oldNormalizedDeps.delete(dep);
        } else {
          newUniques.add(dep);
        }
      }

      // remove old deps
      for (let dep of oldNormalizedDeps) {
        const [entity, item] = dep.split('.');
        this._denormalizedDeps[entity][item].delete(componentId);
      }
    }

    // add new deps
    for (let dep of newUniques) {
      const [entity, item] = dep.split('.');
      this._denormalizedDeps[entity] = this._denormalizedDeps[entity] || {};
      this._denormalizedDeps[entity][item] = this._denormalizedDeps[entity][item] || new Set();
      this._denormalizedDeps[entity][item].add(componentId);
    }
  }

  _ensureListeners(componentId, mutationListeners) {
    // add mutation listeners
    const operationName = this._schema.mutationType.name;
    const rootMutation = this._schema.types.find(type => type.name === operationName);
    Object.keys(mutationListeners).forEach(mutationName => {
      const mutationSchema = rootMutation.fields.find(field => field.name === mutationName);
      if (!mutationSchema) {
        console.error(`Invalid mutation: ${mutationName}.\nDid you make a typo?`);
      }
      this._listenersByMutation[mutationName] = this._listenersByMutation[mutationName] || new Map();
      this._listenersByMutation[mutationName].set(componentId, mutationListeners[mutationName]);
    });
  }

  _getTransport(options) {
    const transport = options.transport || this._transport;
    if (typeof transport !== 'function') {
      throw new Error('No transport function provided');
    }
    return transport;
  }

  /**
   * Crawl the dependency tree snagging up everything that will be invalidated
   * No safety checks required.
   * The tree is guaranteed to have everything we look for because of _addDeps
   *
   */
  _makeFlushSet(normalizedResponse, componentId) {
    const {entities} = normalizedResponse;
    let flushSet = new Set();
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

    // no need to flush the callee
    flushSet.delete(componentId);
    return flushSet;
  }

  /**
   *
   * An external method to be used whenever someone wants to
   *
   */
  mutate(mutationName, possibleComponentIds, options = {}) {

    const {variables} = options;
    const componentIdsToUpdate = makeComponentsToUpdate(mutationName, possibleComponentIds, this._denormalizedResults);
    if (!componentIdsToUpdate) {
      throw new Error(`Mutation has no queries to update: ${mutationName}`);
    }
    const mutationString = createMutationString.call(this, mutationName, componentIdsToUpdate);
    
    // optimistcally update
    this._addListenersHandler(mutationName, componentIdsToUpdate, null, variables);

    // async call the server
    this._mutateServer(mutationName, componentIdsToUpdate, mutationString, variables);
  }

  
  async _mutateServer(mutationName, componentIdsToUpdate, mutationString, variables) {
    const transport = this._getTransport(options);
    const docFromServer = await transport(mutationString, variables);
    // update state with new doc from server
    this._addListenersHandler(mutationName, componentIdsToUpdate, docFromServer);

    // the queries to forcefully refetch
    while (this._invalidationQueue.length) {
      const queryToRefetch = this._invalidationQueue.shift();
      queryToRefetch();
    }
  }
  
  _addListenersHandler(mutationName, componentIdsToUpdate, docFromServer, variables) {
    const listenerMap = this._listenersByMutation[mutationName];
    const cashayDataState = this._getToState(this._store).data;
    let allNormalizedChanges = {};
    // for every component that listens the the mutationName
    for (let componentId of componentIdsToUpdate) {
      const {resolve} = listenerMap.get(componentId);
        // find current cached result for this particular componentId
      const cachedResult = this._denormalizedResults[componentId];
      const {queryString, response, options: {paginationWords, idFieldName, transport}} = cachedResult;

      // for the denormalized response, mutate it in place or return undefined if no mutation was made
      const modifiedResponse = docFromServer ?
        // if it's from the server, send the doc we got back
        resolve(null, docFromServer, response, this._invalidate) :
        // otherwise, treat it as an optimistic update
        resolve(variables, null, response, this._invalidate);

      // see if we want to rerun the listening query again. if so, put it in a map & we'll run them after
      // this means there's a possible 3 updates: optimistic, doc from server, full array from server (invalidated)
      if (this._willInvalidateListener) {
        this._willInvalidateListener = false;
        this._invalidationQueue.set(componentId, () => {
          console.log('querySTring mutated?', componentId);
          this.query(queryString, {
            componentId,
            paginationWords,
            idFieldName,
            transport,
            forceFetch: true
          })
        })
      }

      // this must come back after the invalidateListener check because they could invalidate without returning something
      if (!modifiedResponse) {
        continue;
      }
      // TODO: normalizing requires context, requires the queryAST, but we don't wanna parse that over & over!
      // let's parse for alpha, then figure out whether to store it or do something intelligent
      // like store the AST for hot queries
      // if a mutation was made, normalize it & send it off to the store
      const context = buildExecutionContext(this._schema, queryString, {
        variables: cashayDataState.variables[componentId],
        paginationWords,
        idFieldName,
        cashayDataState
      });

      const normalizedModifiedResponse = normalizeResponse(modifiedResponse, context);
      allNormalizedChanges = deepAssign(allNormalizedChanges, normalizedModifiedResponse);
    }

    const normalizedResponseForStore = shortenNormalizedResponse(allNormalizedChanges, cashayDataState);
    // merge the normalized optimistic result with the state
    // dont invalidate other queries, they might not want it.
    // if they want it, they'll ask for it in their own listener
    this._store.dispatch({
      type: '@@cashay/INSERT_NORMALIZED',
      payload: {
        response: normalizedResponseForStore
      }
    });
  }
}

const makeComponentsToUpdate = (mutationName, possibleComponentIds, denormalizedResults) => {
  const componentIds = [];
  // if there are no provided queries to update, try updating them all
  if (!possibleComponentIds) {
    const listenerMap = this._listenersByMutation[mutationName];
    for (let [componentId] of listenerMap) {
      if (denormalizedResults[componentId]) {
        componentIds.push(componentId);
      }
    }
    // if only 1 component is provided, add it if the query is currently in use
  } else if (!Array.isArray(possibleComponentIds)) {
    if (denormalizedResults[possibleComponentIds]) {
      componentIds.push(possibleComponentIds);
    }
    // if a list of components is provided, only select those that have queries in use
  } else {
    for (let componentId of possibleComponentIds) {
      if (denormalizedResults[componentId]) {
        componentIds.push(componentId);
      }
    }
  }
  return componentIds.length && componentIds;
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
//   addCommentToPost(optimisticVariables, docFromServer, currentResponse, invalidate) {
//     let newComment = docFromServer;
//     if (optimisticVariables) {
//       const {title, postId} = optimisticVariables;
//       newComment = {
//         title,
//         postId,
//         createdAt: Date.now()
//       }
//     }
//
//     const postIndex = currentResponse.getPosts.findIndex(post => post.id === newComment.postId);
//     if (postIndex !== -1) {
//       const parentPost = currentResponse.getPosts[postIndex];
//       const placeBefore = parentPost.comments.findIndex(comment => comment.reputation < newComment.reputation);
//       if (placeBefore !== -1) {
//         return parentPost.comments.splice(placeBefore, 0, newComment);
//       }
//     }
//   }
// }
// }
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

// var isObject = val => val && typeof val === 'object';

// const {proxy, accessLog} = detectAccess({});
//
// function mockMutatationListener(proxy) {
//   console.log(proxy.foo);
//   console.log(proxy.foo.bar);
//   console.log(proxy.bar);
// }
// mockMutatationListener(proxy);
