import {INSERT_QUERY, INSERT_MUTATION, SET_ERROR} from './normalize/duck';
import denormalizeStore from './normalize/denormalizeStore';
import {rebuildOriginalArgs} from './normalize/denormalizeHelpers';
import normalizeResponse from './normalize/normalizeResponse';
import {printMinimalQuery} from './query/printMinimalQuery';
import {shortenNormalizedResponse, invalidateMutationsOnNewQuery, equalPendingQueries} from './query/queryHelpers';
import {checkMutationInSchema} from './utils';
import mergeStores from './normalize/mergeStores';
import {CachedMutation, CachedQuery, MutationShell} from './helperClasses';
import flushDependencies from './query/flushDependencies';
import {parse, buildExecutionContext, getVariables, clone, ensureRootType} from './utils';
import namespaceMutation from './mutate/namespaceMutation';
import createMutationFromQuery from './mutate/createMutationFromQuery';
import removeNamespacing from './mutate/removeNamespacing';
import makeFriendlyStore from './mutate/makeFriendlyStore';
import addDeps from './normalize/addDeps';
import mergeMutations from './mutate/mergeMutations';
import {print} from 'graphql/language/printer';
import ActiveComponentsObj from './mutate/ActiveComponentsObj';
import makeArgsFromVars from './mutate/makeArgsFromVars';

const defaultGetToState = store => store.getState().cashay;
const defaultPaginationWords = {
  before: 'before',
  after: 'after',
  first: 'first',
  last: 'last'
};

class Cashay {
  constructor() {
    // many mutations can share the same mutationName, making it hard to cache stuff without adding complexity
    // we can assume that a mutationName + the components it affects = a unique, reproduceable fullMutation
    // const example = {
    //   [mutationName]: {
    //     activeComponentsObj: {
    //       [component]: key || Boolean
    //     },
    //     fullMutation: MutationString,
    //     variableEnhancers: [variableEnhancerFn],
    //     singles: {
    //       [component]: {
    //          ast: MutationAST,
    //          variableEnhancers: [variableEnhancerFn]
    //       }
    //     }
    //   }
    // }
    this.cachedMutations = {};

    // the object to hold the denormalized query responses
    // const example = {
    //   [component]: {
    //     ast,
    //     refetch: FunctionToRefetchQuery,
    //     response: DenormalizedResponse,
    //     response: {
    //       [key]: DenormalizedResponse // if a key exists
    //     }
    //   }
    // }
    this.cachedQueries = {};

    // const example = {
    //   [subscriptionString]: {
    //     ast: SubscriptionAST,
    //     response: DenormalizedResponseWithUnsub
    //   }
    // };
    this.cachedSubscriptions = {};

    // a flag thrown by the invalidate function and reset when that query is added to the queue
    this._willInvalidateListener = false;

    // const example = {
    //   [mutationName]: {
    //     [component]: mutationHandlerFn
    //   }
    // }
    this.mutationHandlers = {};

    // denormalized deps is an object with entities for keys. 
    // The value of each entity is an object with uids for keys.
    // the value of each UID is a set of components
    // const example = {
    //   Pets: {
    //     1: {
    //       [component]: ['key1', 'key2']
    //     }
    //   }
    // }
    this.denormalizedDeps = {};

    // not stored in _cachedQueries in able to compare old vs new deps
    // const example = {
    //   [component]: Set(...['Pets.1', 'Pets.2']),
    //   [ifKeyComponent]: {
    //     [key]: Set(...['Pets.1', 'Pets.2'])
    //   }
    // }
    this.normalizedDeps = {};

    this.pendingQueries = new Set();
  }


  create({store, transport, schema, getToState, paginationWords, idFieldName = 'id', debug}) {
    // the redux store
    this.store = store || this.store;

    // if a user-defined function is supplied, use it. otherwise, use what we already have (or the deafult)
    this.getState = getToState ? () => getToState(this.store) : this.getState || (() => defaultGetToState(this.store));

    // the reserved arguments for cusor-based pagination
    this.paginationWords = Object.assign({}, defaultPaginationWords, paginationWords);

    // the field that contains the UID
    this.idFieldName = idFieldName || this.idFieldName;

    // the default function to send the queryString to the server (usually HTTP or WS)
    this.transport = transport || this.transport;

    // the client graphQL schema
    this.schema = schema || this.schema;
  }

  /**
   * a method given to a mutation callback that turns on a global.
   * if true, then we know to queue up a requery
   */
  _invalidate() {
    this._willInvalidateListener = true;
  }

  getTransport() {
    return this.transport;
  }

  /**
   * A method that accepts a GraphQL query and returns a result using only local data.
   * If it cannot complete the request on local data alone, it also asks the server for the data that it does not have.
   *
   * @param {String} queryString The GraphQL query string, exactly as you'd send it to a GraphQL server
   * @param {Object} options The optional objects to include with the query
   *
   * @property {String} options.component A string to match the component.
   * @property {String} options.key A string to uniquely match the component insance.
   * @property {Boolean} options.forceFetch is true if the query is to ignore all local data and fetch new data
   * @property {Function} options.transport The function used to send the data request to GraphQL, if different from default
   * @property {Object} options.variables are the variables sent along with the query
   * @property {Object} options.mutationHandlers the functions used to change the local data when a mutation occurs
   * @property {Object} options.customMutations if mutations are too complex to be autogenerated (rare), write them here
   *
   * @returns {Object} The denormalized object like GraphQL would return, with additional `isComplete` and `firstRun` flags
   *
   */
  query(queryString, options = {}) {
    //if you call forceFetch in a mapStateToProps, you're gonna have a bad time (it'll refresh on EVERY dispatch)
    const {key} = options;
    const forceFetch = Boolean(options.forceFetch);

    // Each component can have only 1 unique queryString/variable combo. This keeps memory use minimal.
    // if 2 components have the same queryString/variable but a different component, it'll fetch twice
    const component = options.component || queryString;

    // get the result, containing a response, queryString, and options to re-call the query
    const fastResult = this.cachedQueries[component];

    // if we got local data cached already, send it back fast
    if (!forceFetch && fastResult && fastResult.response) {
      if (!key) {
        return fastResult.response;
      } else if (fastResult.response[key]) {
        return fastResult.response[key];
      }
    }

    // Make sure we got everything we need
    if (!this.store || !this.schema) {
      throw new Error('Cashay requires a store & schema')
    }

    // save the query so we can call it from anywhere
    if (!fastResult) {
      const refetch = key => {
        this.query(queryString, {
          key,
          forceFetch: true,
          transport: options.transport || this.getTransport()
        });
      };
      this.cachedQueries[component] = new CachedQuery(queryString, this.schema, this.idFieldName, refetch);
      invalidateMutationsOnNewQuery(component, this.cachedMutations);
    }

    const cachedQuery = this.cachedQueries[component];

    const cashayDataState = this.getState().data;
    // override singleton defaults with query-specific values
    const variables = getVariables(options.variables, cashayDataState, component, key, cachedQuery.response);

    // create an AST that we can mutate
    const {paginationWords, idFieldName, schema} = this;
    const context = buildExecutionContext(cachedQuery.ast, {
      cashayDataState,
      variables,
      paginationWords,
      idFieldName,
      schema
    });
    // create a response with a denormalized response and a function to set the variables
    cachedQuery.createResponse(context, component, key, this.store.dispatch, this.getState, forceFetch);
    const cachedResponse = key ? cachedQuery.response[key] : cachedQuery.response;

    // if this is a different query string but the same base query
    // eg in this one we request 1 more field
    // we'll want to add dependencies since we don't know when the server response will come back
    if (!cachedResponse.firstRun) {
      // normalize the cachedResponse so we can add dependencies and stick it in the store
      const normalizedPartialResponse = normalizeResponse(cachedResponse.data, context);
      addDeps(normalizedPartialResponse, component, key, this.normalizedDeps, this.denormalizedDeps);
    }

    // if we need more data, get it from the server
    if (!cachedResponse.isComplete) {
      // if a variable is a function, it may need info that comes from the updated cachedResponse
      context.variables = getVariables(options.variables, cashayDataState, component, key, cachedResponse);

      //  async query the server (no need to track the promise it returns, as it will change the redux state)
      const transport = options.transport || this.transport;
      if (transport) {
        this.queryServer(transport, context, component, key);
      }
    }
    if (options.mutationHandlers && component === queryString) {
      throw new Error(`'component' option is required when including 'mutationHandlers' for: ${queryString}`);
    }
    this._prepareMutations(component, cashayDataState.variables[component], options);
    return cachedResponse;
  }

  /**
   * A method used to get missing data from the server.
   * Once the data comes back, it is normalized, old dependencies are removed, new ones are created,
   * and the data that comes back from the server is compared to local data to minimize invalidations
   *
   * @param {function} transport the transport class to send the query + vars to a GraphQL endpoint
   * @param {object} context the context to normalize data, including the requestAST and schema
   * @param {string} component an ID specific to the queryString/variable combo (defaults to the queryString)
   * @param {key} key A unique key to match the component instance, only used where you would use React's key
   * (eg in a component that you called map on in the parent component).
   *
   * @return {undefined}
   */
  async queryServer(transport, context, component, key) {
    const {variables, operation, idFieldName, schema} = context;
    const {dispatch} = this.store;
    const minimizedQueryString = printMinimalQuery(operation, idFieldName, variables, component, schema);
    // bail if we can't do anything with the variables that we were given
    if (!minimizedQueryString) return;
    const basePendingQuery = this.pendingQueries[minimizedQueryString];
    if (basePendingQuery) {
      if (!equalPendingQueries(basePendingQuery, {component, key, variables})) {
        // bounce identical queries for different components
        this.pendingQueries[minimizedQueryString].push({component, key, variables: clone(variables)});
      }
      // if it's the same component, it'll get updates when they come
      return;
    }
    const pendingQuery = this.pendingQueries[minimizedQueryString] = [{component, key, variables: clone(variables)}];


    // send minimizedQueryString to server and await minimizedQueryResponse
    const {error, data} = await transport.handleQuery({query: minimizedQueryString, variables});

    // handle errors coming back from the server
    if (error) {
      for (let i = 0; i < pendingQuery.length; i++) {
        const {key, component} = pendingQuery[i];
        const cachedQuery = this.cachedQueries[component];
        const cachedResponse = key ? cachedQuery.response[key] : cachedQuery.response;
        cachedResponse.error = error;
      }
      return dispatch({type: SET_ERROR, error});
    }

    //re-create the denormalizedPartialResponse because it went stale when we called the server
    rebuildOriginalArgs(context.operation);
    const {data: denormalizedLocalResponse} = denormalizeStore(context);
    const normalizedLocalResponse = normalizeResponse(denormalizedLocalResponse, context);

    // normalize response to get ready to dispatch it into the state tree
    const normalizedServerResponse = normalizeResponse(data, context);

    // reset the variables that normalizeResponse mutated TODO no longer necessary?
    context.variables = pendingQuery[pendingQuery.length - 1].variables;

    // now, remove the objects that look identical to the ones already in the state
    // that way, if the incoming entity (eg Person.123) looks exactly like the one already in the store
    // we don't have to invalidate and rerender
    const normalizedServerResponseForStore = shortenNormalizedResponse(normalizedServerResponse, this.getState().data);

    // if the server didn't give us any new stuff, we already set the vars, so we're done here
    if (!normalizedServerResponseForStore) return;

    // combine the partial response with the server response to fully respond to the query
    const fullNormalizedResponse = mergeStores(normalizedLocalResponse, normalizedServerResponse);

    // it's possible that we adjusted the arguments for the operation we sent to server
    // for example, instead of asking for 20 docs, we asked for 5 at index 15.
    // now, we want to ask for the 20 again (but locally)
    rebuildOriginalArgs(context.operation);

    // since we debounced all duplicate queries, we still have to update all their deps
    for (let i = 0; i < pendingQuery.length; i++) {
      const {component, key, variables} = pendingQuery[i];
      // add denormalizedDeps so we can invalidate when other queries come in
      // add normalizedDeps to find those deps when a denormalizedReponse is mutated
      // the data fetched from server is only part of the story, so we need the full normalized response
      addDeps(fullNormalizedResponse, component, key, this.normalizedDeps, this.denormalizedDeps);

      // remove the responses from this.cachedQueries where necessary
      flushDependencies(normalizedServerResponseForStore.entities, component, key, this.denormalizedDeps, this.cachedQueries);

      // stick normalize data in store and recreate any invalidated denormalized structures
      const stateVariables = key ? {[component]: {[key]: variables}} : {[component]: variables};
      dispatch({
        type: INSERT_QUERY,
        payload: {
          response: i === 0 && normalizedServerResponseForStore,
          variables: stateVariables
        }
      });
    }

    this.pendingQueries[minimizedQueryString] = undefined;
  }

  _prepareMutations(component, componentStateVars, {mutationHandlers, customMutations}) {
    const {mutationSchema} = this.schema;
    if (mutationHandlers) {
      const mutationHandlerNames = Object.keys(mutationHandlers);
      for (let i = 0; i < mutationHandlerNames.length; i++) {
        const mutationName = mutationHandlerNames[i];
        checkMutationInSchema(mutationSchema, mutationName);
        this.mutationHandlers[mutationName] = this.mutationHandlers[mutationName] || {};
        this.mutationHandlers[mutationName][component] = mutationHandlers[mutationName];
      }
    }
    if (customMutations) {
      const mutationNames = Object.keys(customMutations);
      for (let i = 0; i < mutationNames.length; i++) {
        const mutationName = mutationNames[i];
        checkMutationInSchema(mutationSchema, mutationName);
        this.cachedMutations[mutationName] = this.cachedMutations[mutationName] || new CachedMutation();
        const cachedSingles = this.cachedMutations[mutationName].singles;
        if (!cachedSingles[component]) {
          const mutationAST = parse(customMutations[mutationName]);
          const {namespaceAST, variableEnhancers} = namespaceMutation(mutationAST, component, componentStateVars, this.schema);
          cachedSingles[component] = {
            ast: namespaceAST,
            variableEnhancers
          }
        }
      }
    }
  }

  /**
   *
   * A mutationName is not unique to a mutation, but a name + possibleComponentsObj is
   *
   */
  mutate(mutationName, options = {}) {
    const {variables} = options;
    if (typeof mutationName !== 'string') {
      throw new Error(`The first argument to 'mutate' should be the name of the mutation`)
    }
    this.cachedMutations[mutationName] = this.cachedMutations[mutationName] || new CachedMutation();
    const cachedMutation = this.cachedMutations[mutationName];

    // update fullMutation, variableSet, and variableEnhancers
    this._updateCachedMutation(mutationName, options);

    // optimistcally update
    this._processMutationHandlers(mutationName, cachedMutation.activeComponentsObj, null, variables);
    // if (options.localOnly) return;

    // async call the server
    const {variableEnhancers} = this.cachedMutations[mutationName];
    const namespacedVariables = variableEnhancers.reduce((enhancer, reduction) => enhancer(reduction), variables);
    const newOptions = {...options, variables: namespacedVariables};
    return this._mutateServer(mutationName, cachedMutation.activeComponentsObj, cachedMutation.fullMutation, newOptions);
  }

  _updateCachedMutation(mutationName, options) {
    // try to return fast!
    const cachedMutation = this.cachedMutations[mutationName];
    const {variables} = options;
    if (cachedMutation.fullMutation) {
      if (hasMatchingVariables(variables, cachedMutation.variableSet)) return;
      // variable definitions and args will change, nuke the cached mutation + single ASTs
      cachedMutation.clear(true);
    } else {
      cachedMutation.activeComponentsObj = new ActiveComponentsObj(mutationName, options.components, this.cachedQueries, this.mutationHandlers);
    }

    const componentsToUpdateKeys = Object.keys(cachedMutation.activeComponentsObj);

    // if (componentsToUpdateKeys.length === 0) {
    // for mutations that dont affect the client (eg analytics)
    // cachedMutation.fullMutation = print(new MutationShell(mutationName, null, null, true));
    // debugger
    // } else {
    debugger
    this._createMutationsFromQueries(mutationName, componentsToUpdateKeys, variables);
    // }
  }

  _createMutationsFromQueries(mutationName, componentsToUpdateKeys, variables) {
    const cachedSingles = this.cachedMutations[mutationName].singles;
    const cachedSinglesASTs = [];
    const newVariableEnhancers = [];
    if (componentsToUpdateKeys.length) {
      for (let i = 0; i < componentsToUpdateKeys.length; i++) {
        const component = componentsToUpdateKeys[i];
        if (!cachedSingles[component]) {
          const queryOperation = this.cachedQueries[component].ast.definitions[0];
          const mutationAST = createMutationFromQuery(queryOperation, mutationName, variables, this.schema);
          const componentStateVars = this.getState().data.variables[component];
          const {namespaceAST, variableEnhancers} = namespaceMutation(mutationAST, component, componentStateVars, this.schema);
          cachedSingles[component] = {
            ast: namespaceAST,
            variableEnhancers
          }
        }
        const {ast, variableEnhancers} = cachedSingles[component];
        cachedSinglesASTs.push(ast);
        newVariableEnhancers.push(...variableEnhancers);
      }
      const cachedMutation = this.cachedMutations[mutationName];
      cachedMutation.fullMutation = mergeMutations(cachedSinglesASTs);
      cachedMutation.variableEnhancers.push(...newVariableEnhancers);
    } else {
      // TODO DEAD CODE UNTIL https://github.com/graphql/graphql-js/issues/410
      // TODO clean this up & makeArgsFromVars
      // if we don't want anything to come back to the client
      const cachedMutation = this.cachedMutations[mutationName];
      const mutationFieldSchema = this.schema.mutationSchema.fields[mutationName];
      const mutationArgs = makeArgsFromVars(mutationFieldSchema, variables);
      const mutationAST = new MutationShell(mutationName, mutationArgs, undefined, true);
      cachedMutation.fullMutation = print(mutationAST);
    }
  };

  async _mutateServer(mutationName, componentsToUpdateObj, mutationString, options) {
    const {variables} = options;
    const transport = options.transport || this.transport;
    const docFromServer = await transport.handleQuery({query: mutationString, variables});
    const {error, data} = docFromServer;

    if (error) {
      this.store.dispatch({type: SET_ERROR, error});
    } else {
      // update state with new doc from server
      this._processMutationHandlers(mutationName, componentsToUpdateObj, data);
    }
    return docFromServer;
  }

  _processMutationHandlers(mutationName, componentsToUpdateObj, dataFromServer, variables) {
    const componentHandlers = this.mutationHandlers[mutationName];
    const cashayDataState = this.getState().data;
    let allNormalizedChanges = {};
    let allVariables = {};
    const componentsToUpdateKeys = Object.keys(componentsToUpdateObj);

    // for every component that listens the the mutationName
    for (let i = 0; i < componentsToUpdateKeys.length; i++) {
      const component = componentsToUpdateKeys[i];
      const key = componentsToUpdateObj[component] === true ? undefined : componentsToUpdateObj[component];
      const componentHandler = componentHandlers[component];

      // find current cached result for this particular component
      const cachedResult = this.cachedQueries[component];

      const {ast, refetch, response} = cachedResult;
      const cachedResponseData = key ? response[key].data : response.data;
      let modifiedResponse;

      // for the denormalized response, mutate it in place or return undefined if no mutation was made
      const getType = this._getTypeFactory(component, key);
      if (dataFromServer) {
        // if it's from the server, send the doc we got back
        const normalizedDataFromServer = removeNamespacing(dataFromServer, component);
        modifiedResponse = componentHandler(null, normalizedDataFromServer, cachedResponseData, getType, this._invalidate);
      } else {

        // otherwise, treat it as an optimistic update
        modifiedResponse = componentHandler(variables, null, cachedResponseData, getType, this._invalidate);
      }

      // there's a possible 3 updates: optimistic, doc from server, full array from server (invalidated)
      if (this._willInvalidateListener) {
        this._willInvalidateListener = false;
        refetch(key);
      }

      // this must come back after the invalidateListener check because they could invalidate without returning something
      if (!modifiedResponse) {
        continue;
      }

      // create a new object to make sure react-redux's updateStatePropsIfNeeded returns true
      // also remove any existing errors since we've now had a successful operation
      if (key) {
        const {error, ...cachedResponse} = cachedResult.response[key];
        cachedResult.response[key] = cachedResponse;
      } else {
        const {error, ...cachedResponse} = cachedResult.response;
        cachedResult.response = cachedResponse;
      }

      const {schema, paginationWords, idFieldName} = this;
      let contextVars;
      if (key) {
        const stateVars = cashayDataState.variables[component][key];
        if (stateVars) {
          allVariables[component] = allVariables[component] || {};
          contextVars = allVariables[component][key] = clone(stateVars);
        }
      } else {
        const stateVars = cashayDataState.variables[component];
        if (stateVars) {
          contextVars = allVariables[component] = clone(stateVars);
        }
      }
      const context = buildExecutionContext(ast, {
        variables: contextVars,
        paginationWords,
        idFieldName,
        schema,
        cashayDataState
      });

      const normalizedModifiedResponse = normalizeResponse(modifiedResponse, context);
      allNormalizedChanges = mergeStores(allNormalizedChanges, normalizedModifiedResponse);
      allVariables = {...allVariables, ...contextVars};

    }

    const normalizedServerResponseForStore = shortenNormalizedResponse(allNormalizedChanges, cashayDataState);

    // merge the normalized optimistic result with the state
    // dont invalidate other queries, they might not want it.
    // if they want it, they'll ask for it in their own listener
    if (normalizedServerResponseForStore) {
      this.store.dispatch({
        type: INSERT_MUTATION,
        payload: {
          response: normalizedServerResponseForStore,
          variables: allVariables
        }
      });
    }
  }

  _getTypeFactory = (component, key) => {
    return typeName => {
      const cashayDataState = this.getState().data;
      const rawState = cashayDataState.entities[typeName];
      if (!rawState) {
        throw new Error(`${typeName} does not exist in your cashay data state entities!`);
      }

      const componentState = cashayDataState.variables[component];
      // TODO using stateVars is wrong because vars could be static in the query, instead we need to check the schema + varDefs + vars
      const stateVars = key ? componentState[key] : componentState;
      if (!stateVars) {
        return rawState;
      }
      const context = {
        paginationWords: this.paginationWords,
        variables: stateVars,
        skipTransform: true,
        schema: this.schema
      };
      return makeFriendlyStore(rawState, typeName, context);
    }
  };

  /**
   *
   */
  subscribe(subscriptionString, subscriber, options) {
    const component = options.component || subscriptionString;
    if (!this.cachedSubscriptions[component]) {
      this.cachedSubscriptions[component] = new CachedSubscription(subscriptionString);
    }
    const handlers = {
      add: this.subscriptionAdd,
      update: this.subscriptionUpdate,
      remove: this.subscriptionRemove,
      error: this.subscriptionError
    };
    const cashayDataState = this.getState().data;
    // const variables = getVariables(options.variables, cashayDataState.variables[component]);
    return subscriber(subscriptionString, handlers, variables);
  }

  subscriptionAdd(document, fastMode = true) {
    // normalize data
    // compare the normalized data to the state data, removing anything that has the same data
    // merge entities shortenedNormalizedData
    // if cashayDataState.result[subscriptionName][?variables].full is an array
    // then add the newState.result.... to the end of it
    // also, add the new data to the end of the denormalizedResponse (so fast!) if fastMode = true
    // make sure to recreate the response object so react-redux picks up the change
    // call dispatch(insert_normalized)
  }

  subscriptionUpdate(document) {
    // normalize data
    // compare the normalized data to the state data, removing anything that has the same data
    // merge entities shortenedNormalizedData
    // update the new data in denormalizedResponse (so fast!)
    // make sure to recreate the response object so react-redux picks up the change
    // call dispatch(insert_normalized)
  }

  subscriptionRemove(idToRemove) {
    //
  }

}
export default new Cashay();

const hasMatchingVariables = (variables = {}, matchingSet) => {
  const varKeys = Object.keys(variables);
  if (varKeys.length !== matchingSet.size) return false;
  for (let i = 0; i < varKeys.length; i++) {
    const varKey = varKeys[i];
    if (!matchingSet.has(varKey)) return false;
  }
  return true;
};


// const subscriber = (subscriptionString, handlers, variables) => {
//   let baseChannel;
//   for (let [key, value] of channelLookupMap.entries()) {
//     if (value === subscriptionString) {
//       baseChannel = key;
//       break;
//     }
//   }
//   const channelName = `${baseChannel}/${variables.userId}`
//   const socket = socketCluster.connect({authTokenName});
//   const {add, update, remove, error} = handlers;
//   socket.subscribe(channelName, {waitForAuth: true});
//   socket.on(channelName, data => {
//     if (!data.old_val) {
//       add(data.new_val);
//     } else if (!data.new_val) {
//       remove(data.old_val.id);
//     } else {
//       update(data.new_val);
//     }
//   });
//   socket.on('unsubscribe', unsubChannel => {
//     if (unsubChannel === channelName) {
//       console.log(`unsubbed from ${unsubChannel}`);
//     }
//   });
//   return () => socket.unsubscribe(channelName)
// };
//
// const channelLookupMap = new Map([['meeting',
//   `subscription($meetingId: ID!) {
//     subToPosts(meetingId: $meetingId) {
//       id,
//     }
//   }`]]);
