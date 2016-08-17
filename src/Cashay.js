import {
  INSERT_QUERY,
  INSERT_MUTATION,
  SET_ERROR,
  ADD_SUBSCRIPTION,
  UPDATE_SUBSCRIPTION,
  REMOVE_SUBSCRIPTION,
  SET_STATUS
} from './normalize/duck';
import denormalizeStore from './normalize/denormalizeStore';
import {rebuildOriginalArgs} from './normalize/denormalizeHelpers';
import normalizeResponse from './normalize/normalizeResponse';
import {printMinimalQuery} from './query/printMinimalQuery';
import {shortenNormalizedResponse, invalidateMutationsOnNewQuery, equalPendingQueries} from './query/queryHelpers';
import {checkMutationInSchema, getStateVars} from './utils';
import mergeStores from './normalize/mergeStores';
import {CachedMutation, CachedQuery, CachedSubscription} from './helperClasses';
import flushDependencies from './query/flushDependencies';
import {
  parse,
  buildExecutionContext,
  getVariables,
  clone,
  makeErrorFreeResponse,
  ADD,
  UPDATE,
  UPSERT,
  REMOVE,
  LOADING,
  SUBSCRIBING,
  READY,
  UNSUBSCRIBED
} from './utils';
import namespaceMutation from './mutate/namespaceMutation';
import createMutationFromQuery from './mutate/createMutationFromQuery';
import removeNamespacing from './mutate/removeNamespacing';
import makeFriendlyStore from './mutate/makeFriendlyStore';
import addDeps from './normalize/addDeps';
import mergeMutations from './mutate/mergeMutations';
import ActiveQueries from './mutate/ActiveQueries';
import createBasicMutation from './mutate/createBasicMutation';
import setSubVariablesFactory from './subscribe/setSubVariablesFactory';
import hasMatchingVariables from './mutate/hasMatchingVariables';
import createNewData from './subscribe/getNewDenormalizedData';
import isMutationResponseScalar from './mutate/isMutationResponseScalar';

const defaultGetToState = store => store.getState().cashay;
const defaultPaginationWords = {
  before: 'before',
  after: 'after',
  first: 'first',
  last: 'last'
};

const defaultCoerceTypes = {
  DateTime: val => new Date(val)
};

class Cashay {
  constructor() {
    // many mutations can share the same mutationName, making it hard to cache stuff without adding complexity
    // we can assume that a mutationName + the components it affects = a unique, reproduceable fullMutation
    // const example = {
    //   [mutationName]: {
    //     activeQueries: {
    //       [op]: key
    //     },
    //     fullMutation: MutationString,
    //     variableEnhancers: [variableEnhancerFn],
    //     singles: {
    //       [op]: {
    //          ast: MutationAST,
    //          variableEnhancers: [variableEnhancerFn]
    //       }
    //     }
    //   }
    // }
    this.cachedMutations = {};

    // the object to hold the denormalized query responses
    // const example = {
    //   [op]: {
    //     ast,
    //     refetch: FunctionToRefetchQuery,
    //     responses: {
    //       [key = '']: DenormalizedResponse
    //     }
    //   }
    // }
    this.cachedQueries = {};

    // the object to hold the subscription stream
    // const example = {
    //   [subscriptionString]: {
    //     ast: SubscriptionAST,
    //     dependencies: Set(['postSubs, commentSubs'])
    //     responses: {
    //       [key = '']: DenormalizedResponseWithUnsub
    //     }
    //   }
    // };
    this.cachedSubscriptions = {};

    // the object to hold all sub-based computations
    // const example = {
    //   inputs: [scalar, arr, obj],
    //   response: DenormalizedResponseData
    // };
    this.cachedComputed = {};

    // a flag thrown by the invalidate function and reset when that query is added to the queue
    this._willInvalidateListener = false;

    // const example = {
    //   [mutationName]: {
    //     [op]: mutationHandlerFn
    //   }
    // }
    this.mutationHandlers = {};

    // denormalized deps is an object that matches the cashayState.entities
    // instead of an object of values, it holds an object of of Sets of keys for every query affected by a change
    // the value of each UID is a set of components
    // const example = {
    //   Pets: {
    //     1: {
    //       [op]: Set(['key1', 'key2'])
    //     }
    //   }
    // }
    this.denormalizedDeps = {};

    // the deps used by mutations to determine what branches of the state tree to invalidate from a mutation
    // const example = {
    //   [op]: {
    //     [key]: Set(...['Pets.1', 'Pets.2'])
    //   }
    // }
    this.normalizedDeps = {};

    // a Set of minimized query strings. Identical strings are ignored
    // this could be improved to minimize traffic, but it favors fast and cheap for now
    this.pendingQueries = new Set();
  }

  /**
   * The primary method to begin using the singleton
   *
   * @param {Object} coerceTypes an object full of methods names matching GraphQL types. It takes in a single scalar value
   * and returns the output. This is useful for things like converting dates from strings to numbers or Date types.
   * @param {Function} getToState a function to get to the cashayState.
   * Useful if your store is not a POJO or if your reducer isn't called `cashay`
   * @param {HTTPTransport} httpTransport an instance of an HTTPTransport used to connect cashay to your server
   * @param {string} idFieldName name of the unique identifier for your documents, defaults to `id`, is `_id` for MongoDB
   * @param {Object} paginationWords reserved arguments for cusor-based pagination
   * @param {Transport} priorityTransport an instance of a Transport used to connect cashay to your server.
   * Takes prioirty over httpTransport. Useful for server-side rendering and sockets.
   * @param {Object} schema the client graphQL schema
   * @param {Object} store the redux store
   * */
  create({coerceTypes, getToState, httpTransport, idFieldName, paginationWords, priorityTransport, schema, store}) {
    this.coerceTypes = coerceTypes === undefined ? this.coerceTypes || defaultCoerceTypes : coerceTypes;
    this.store = store || this.store;
    this.getState = getToState ? () => getToState(this.store) : this.getState || (() => defaultGetToState(this.store));
    this.paginationWords = paginationWords === undefined ? this.paginationWords || defaultPaginationWords : {...defaultPaginationWords, ...paginationWords};
    this.idFieldName = idFieldName === undefined ? this.idFieldName || 'id' : idFieldName;
    this.httpTransport = httpTransport === undefined ? this.httpTransport : httpTransport;
    this.priorityTransport = priorityTransport === undefined ? this.priorityTransport : priorityTransport;
    this.schema = schema || this.schema;
  }

  /**
   * a method given to a mutation callback that turns on a global.
   * if true, then we know to queue up a requery
   */
  _invalidate() {
    this._willInvalidateListener = true;
  }

  /**
   * A method to get the best transport to send the request
   * */
  getTransport(specificTransport) {
    return specificTransport || this.priorityTransport || this.httpTransport;
  }

  /**
   * A method that accepts a GraphQL query and returns a result using only local data.
   * If it cannot complete the request on local data alone, it also asks the server for the data that it does not have.
   *
   * @param {string} queryString - The GraphQL query string, exactly as you'd send it to a GraphQL server
   * @param {Object} [options] - The optional objects to include with the query
   *
   * @param {string} [options.op] - A string to match the op.
   * @param {string} [options.key=''] - A string to uniquely match the op insance.
   * @param {Boolean} [options.forceFetch] - is true if the query is to ignore all local data and fetch new data
   * @param {Function} [options.transport] - The function used to send the data request to GraphQL, if different from default
   * @param {Object} [options.variables] - are the variables sent along with the query
   * @param {Object} [options.mutationHandlers] - the functions used to change the local data when a mutation occurs
   * @param {Object} [options.customMutations] - if mutations are too complex to be autogenerated (rare), write them here
   * @param {Boolean} [options.localOnly] - if you only want to query the local cache, set this to true
   *
   * @returns {Object} data, setVariables, and status
   *
   */
  query(queryString, options = {}) {
    //if you call forceFetch in a mapStateToProps, you're gonna have a bad time (it'll refresh on EVERY dispatch)
    // Each op can have only 1 unique queryString/variable combo. This keeps memory use minimal.
    // if 2 components have the same queryString/variable but a different op, it'll fetch twice
    const {forceFetch, key = '', op = queryString} = options;

    // get the result, containing a response, queryString, and options to re-call the query
    const fastResult = this.cachedQueries[op];

    // if we got local data cached already, send it back fast
    const fastResponse = !forceFetch && fastResult && fastResult.responses[key];
    if (fastResponse) return fastResponse;

    // Make sure we got everything we need
    if (!this.store || !this.schema) {
      throw new Error('Cashay requires a store & schema')
    }

    if (options.mutationHandlers && op === queryString) {
      throw new Error(`'op' is required when including 'mutationHandlers' for: ${queryString}`);
    }

    // save the query so we can call it from anywhere
    if (!fastResult) {
      const refetch = key => {
        this.query(queryString, {
          key,
          forceFetch: true,
          transport: this.getTransport(options.transport)
        });
      };
      this.cachedQueries[op] = new CachedQuery(queryString, this.schema, this.idFieldName, refetch, key);
      invalidateMutationsOnNewQuery(op, this.cachedMutations);
    }

    const cachedQuery = this.cachedQueries[op];
    const initialCachedResponse = cachedQuery.responses[key];
    const cashayState = this.getState();
    // override singleton defaults with query-specific values
    const variables = getVariables(options.variables, cashayState, op, key, initialCachedResponse);

    // create an AST that we can mutate
    const {coerceTypes, paginationWords, idFieldName, schema, store, getState} = this;
    const context = buildExecutionContext(cachedQuery.ast, {
      cashayState,
      coerceTypes,
      variables,
      paginationWords,
      idFieldName,
      schema
    });

    // create a response with denormalized data and a function to set the variables
    cachedQuery.createResponse(context, op, key, store.dispatch, getState, forceFetch);
    const cachedResponse = cachedQuery.responses[key];

    // if this is a different query string but the same base query
    // eg in this one we request 1 more field
    // we'll want to add dependencies since we don't know when the server response will come back
    // normalize the cachedResponse so we can add dependencies and stick it in the store
    const normalizedPartialResponse = normalizeResponse(cachedResponse.data, context);
    addDeps(normalizedPartialResponse, op, key, this.normalizedDeps, this.denormalizedDeps);

    // if we need more data, get it from the server
    if (cachedResponse.status === LOADING) {
      // if a variable is a function, it may need info that comes from the updated cachedResponse
      context.variables = getVariables(options.variables, cashayState, op, key, cachedResponse);

      //  async query the server (no need to track the promise it returns, as it will change the redux state)
      const transport = this.getTransport(options.transport);
      if (!transport) {
        throw new Error('Cashay requires a transport to query the server. If you want to query locally, use `localOnly: true`');
      }
      if (!options.localOnly) {
        this.queryServer(transport, context, op, key);
      }
    }

    const stateVars = getStateVars(cashayState, op, key);
    this._prepareMutations(op, stateVars, options);

    // TODO dispatch with status

    return cachedResponse;
  }

  /**
   * A method used to get missing data from the server.
   * Once the data comes back, it is normalized, old dependencies are removed, new ones are created,
   * and the data that comes back from the server is compared to local data to minimize invalidations
   *
   * @param {function} transport the transport class to send the query + vars to a GraphQL endpoint
   * @param {object} context the context to normalize data, including the requestAST and schema
   * @param {string} op an ID specific to the queryString/variable combo (defaults to the queryString)
   * @param {string} key A unique key to match the op instance, only used where you would use React's key
   * (eg in a component that you called map on in the parent component).
   *
   * @return {undefined}
   */
  async queryServer(transport, context, op, key) {
    const {variables, operation, idFieldName, schema} = context;
    const {dispatch} = this.store;
    const minimizedQueryString = printMinimalQuery(operation, idFieldName, variables, op, schema);
    // bail if we can't do anything with the variables that we were given
    if (!minimizedQueryString) {
      // TODO set status or error?
      return;
    }
    const basePendingQuery = this.pendingQueries[minimizedQueryString];
    if (basePendingQuery) {
      if (!equalPendingQueries(basePendingQuery, {op, key, variables})) {
        // bounce identical queries for different components
        this.pendingQueries[minimizedQueryString].push({op, key, variables: clone(variables)});
      }
      // if it's the same op, it'll get updates when they come
      return;
    }
    const pendingQuery = this.pendingQueries[minimizedQueryString] = [{op, key, variables: clone(variables)}];


    // send minimizedQueryString to server and await minimizedQueryResponse
    const {error, data} = await transport.handleQuery({query: minimizedQueryString, variables});

    // handle errors coming back from the server
    if (error) {
      const ops = {};
      for (let i = 0; i < pendingQuery.length; i++) {
        const {key, op} = pendingQuery[i];
        // TODO return new obj?
        this.cachedQueries[op].responses[key].error = error;
        ops[op] = ops[op] || {};
        ops[op][key] = ops[op][key] || {};
        ops[op][key].error = error;
      }
      const payload = {ops};
      return dispatch({type: SET_ERROR, payload});
    }
    //re-create the denormalizedPartialResponse because it went stale when we called the server
    rebuildOriginalArgs(context.operation);
    const denormalizedLocalResponse = denormalizeStore(context);
    const normalizedLocalResponse = normalizeResponse(denormalizedLocalResponse, context);

    // normalize response to get ready to dispatch it into the state tree
    const normalizedServerResponse = normalizeResponse(data, context);

    // reset the variables that normalizeResponse mutated TODO no longer necessary?
    context.variables = pendingQuery[pendingQuery.length - 1].variables;

    // now, remove the objects that look identical to the ones already in the state
    // that way, if the incoming entity (eg Person.123) looks exactly like the one already in the store
    // we don't have to invalidate and rerender
    const {entities, result} = this.getState();

    const entitiesAndResult = shortenNormalizedResponse(normalizedServerResponse, {entities, result});

    // if the server didn't give us any new stuff, we already set the vars, so we're done here
    if (!entitiesAndResult) return;

    // combine the partial response with the server response to fully respond to the query
    const fullNormalizedResponse = mergeStores(normalizedLocalResponse, normalizedServerResponse);

    // it's possible that we adjusted the arguments for the operation we sent to server
    // for example, instead of asking for 20 docs, we asked for 5 at index 15.
    // now, we want to ask for the 20 again (but locally)
    rebuildOriginalArgs(context.operation);

    // since we debounced all duplicate queries, we still have to update all their deps
    for (let i = 0; i < pendingQuery.length; i++) {
      const {op, key, variables} = pendingQuery[i];
      // add denormalizedDeps so we can invalidate when other queries come in
      // add normalizedDeps to find those deps when a denormalizedReponse is mutated
      // the data fetched from server is only part of the story, so we need the full normalized response
      addDeps(fullNormalizedResponse, op, key, this.normalizedDeps, this.denormalizedDeps);

      // remove the responses from this.cachedQueries where necessary
      flushDependencies(entitiesAndResult.entities, op, key, this.denormalizedDeps, this.cachedQueries);

      // only bother merging the first of the possibly many pending queries
      const partialPayload = i === 0 ? entitiesAndResult : {};
      const payload = {
        ...partialPayload,
        ops: {
          [op]: {
            [key]: {
              variables,
              status: 'complete',
              error: null
            }
          }
        }
      };
      dispatch({
        type: INSERT_QUERY,
        payload
      });
    }

    this.pendingQueries[minimizedQueryString] = undefined;
  }

  _prepareMutations(op, opStateVars, {mutationHandlers, customMutations}) {
    const {mutationSchema} = this.schema;
    if (mutationHandlers) {
      const mutationHandlerNames = Object.keys(mutationHandlers);
      for (let i = 0; i < mutationHandlerNames.length; i++) {
        const mutationName = mutationHandlerNames[i];
        checkMutationInSchema(mutationSchema, mutationName);
        this.mutationHandlers[mutationName] = this.mutationHandlers[mutationName] || {};
        this.mutationHandlers[mutationName][op] = mutationHandlers[mutationName];
      }
    }
    if (customMutations) {
      const mutationNames = Object.keys(customMutations);
      for (let i = 0; i < mutationNames.length; i++) {
        const mutationName = mutationNames[i];
        checkMutationInSchema(mutationSchema, mutationName);
        this.cachedMutations[mutationName] = this.cachedMutations[mutationName] || new CachedMutation();
        const cachedSingles = this.cachedMutations[mutationName].singles;
        if (!cachedSingles[op]) {
          const mutationAST = parse(customMutations[mutationName]);
          const {namespaceAST, variableEnhancers} = namespaceMutation(mutationAST, op, opStateVars, this.schema);
          cachedSingles[op] = {
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
   * @param {string} mutationName the name of the mutation, as defined in your GraphQL schema
   * @param {Object} options all the options
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
    this._processMutationHandlers(mutationName, cachedMutation.activeQueries, null, variables);
    // if (options.localOnly) return;

    // async call the server
    const {variableEnhancers} = this.cachedMutations[mutationName];
    const namespacedVariables = variableEnhancers.reduce((enhancer, reduction) => enhancer(reduction), variables);
    const newOptions = {...options, variables: namespacedVariables};
    return this._mutateServer(mutationName, cachedMutation.activeQueries, cachedMutation.fullMutation, newOptions);
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
      cachedMutation.activeQueries = new ActiveQueries(mutationName, options.components, this.cachedQueries, this.mutationHandlers);
    }
    this._createMutationsFromQueries(mutationName, cachedMutation.activeQueries, variables);
  }

  _createMutationsFromQueries(mutationName, activeQueries, variables) {
    const cachedMutation = this.cachedMutations[mutationName];
    const cachedSingles = cachedMutation.singles;
    const cachedSinglesASTs = [];
    const newVariableEnhancers = [];
    const opsToUpdateKeys = Object.keys(activeQueries);
    if (!opsToUpdateKeys.length) {
      cachedMutation.fullMutation = createBasicMutation(mutationName, this.schema, variables);
      return;
    }
    if (isMutationResponseScalar(this.schema, mutationName)) {
      cachedMutation.fullMutation = createBasicMutation(mutationName, this.schema, variables);
    } else {
      const cashayState = this.getState();
      for (let i = 0; i < opsToUpdateKeys.length; i++) {
        const op = opsToUpdateKeys[i];
        if (!cachedSingles[op]) {
          const queryOperation = this.cachedQueries[op].ast.definitions[0];
          const mutationAST = createMutationFromQuery(queryOperation, mutationName, variables, this.schema);
          //TODO remove safety check, should be sanitized before activeQueries is saved
          const key = activeQueries[op] === true ? '' : activeQueries[op];
          const stateVars = getStateVars(cashayState, op, key);
          const {namespaceAST, variableEnhancers} = namespaceMutation(mutationAST, op, stateVars, this.schema);
          cachedSingles[op] = {
            ast: namespaceAST,
            variableEnhancers
          }
        }
        const {ast, variableEnhancers} = cachedSingles[op];
        cachedSinglesASTs.push(ast);
        newVariableEnhancers.push(...variableEnhancers);
      }
      cachedMutation.fullMutation = mergeMutations(cachedSinglesASTs);
      cachedMutation.variableEnhancers.push(...newVariableEnhancers);
    }
  };

  async _mutateServer(mutationName, componentsToUpdateObj, mutationString, options) {
    const {variables} = options;
    const transport = this.getTransport(options.transport);
    const docFromServer = await transport.handleQuery({query: mutationString, variables});
    const {error, data} = docFromServer;
    if (error) {
      const payload = {error};
      this.store.dispatch({type: SET_ERROR, payload});
    } else {
      // each mutation should return only 1 response, but it may be aliased
      // TODO remove data[mutationName]
      const queryResponse = data[mutationName] || data[Object.keys(data)[0]];
      // update state with new doc from server
      this._processMutationHandlers(mutationName, componentsToUpdateObj, queryResponse);
    }
    return docFromServer;
  }

  _processMutationHandlers(mutationName, componentsToUpdateObj, queryResponse, variables) {
    const componentHandlers = this.mutationHandlers[mutationName];
    const cashayState = this.getState();
    let allNormalizedChanges = {};
    let ops = {};
    const opsToUpdateKeys = Object.keys(componentsToUpdateObj);

    // for every op that listens the the mutationName
    for (let i = 0; i < opsToUpdateKeys.length; i++) {
      const op = opsToUpdateKeys[i];
      const key = componentsToUpdateObj[op] === true ? '' : componentsToUpdateObj[op];
      const componentHandler = componentHandlers[op];

      // find current cached result for this particular queryName
      const cachedResult = this.cachedQueries[op];
      const {ast, refetch, responses} = cachedResult;
      const cachedResponse = responses[key];
      if (!cachedResponse) {
        throw new Error(`Cache went stale & wasn't recreated. Did you forget to put a redux subscriber on ${op}?`)
      }
      let modifiedResponseData;

      // for the denormalized response, mutate it in place or return undefined if no mutation was made
      const getType = this._getTypeFactory(op, key);
      if (queryResponse) {
        // if it's from the server, send the doc we got back
        const normalizedQueryResponse = removeNamespacing(queryResponse, op);
        modifiedResponseData = componentHandler(null, normalizedQueryResponse, cachedResponse.data, getType, this._invalidate);
      } else {

        // otherwise, treat it as an optimistic update
        modifiedResponseData = componentHandler(variables, null, cachedResponse.data, getType, this._invalidate);
      }

      // there's a possible 3 updates: optimistic, doc from server, full array from server (invalidated)
      if (this._willInvalidateListener) {
        this._willInvalidateListener = false;
        refetch(key);
      }

      // this must come back after the invalidateListener check because they could invalidate without returning something
      if (!modifiedResponseData) {
        continue;
      }

      // create a new object to make sure react-redux's updateStatePropsIfNeeded returns true
      // also remove any existing errors since we've now had a successful operation
      cachedResult.responses[key] = makeErrorFreeResponse(cachedResponse);
      const {schema, paginationWords, idFieldName} = this;
      const stateVars = getStateVars(cashayState, op, key);
      const contextVars = stateVars && clone(stateVars);
      if (stateVars) {
        ops[op] = ops[op] || {};
        ops[op][key] = ops[op][key] || {};
        ops[op][key].variables = contextVars;
      }
      const context = buildExecutionContext(ast, {
        variables: contextVars,
        paginationWords,
        idFieldName,
        schema,
        cashayState
      });

      const normalizedModifiedResponse = normalizeResponse(modifiedResponseData, context);
      allNormalizedChanges = mergeStores(allNormalizedChanges, normalizedModifiedResponse);
      // TODO make sure we don't need to shallow copy this
      // allVariables = {...allVariables, ...contextVars};

    }
    const {entities, result} = cashayState;
    const entitiesAndResult = shortenNormalizedResponse(allNormalizedChanges, {entities, result});
    if (!entitiesAndResult) return;
    const payload = Object.keys(ops).length ? {...entitiesAndResult, ops} : entitiesAndResult;
    this.store.dispatch({
      type: INSERT_MUTATION,
      payload
    });
  }

  _getTypeFactory = (op, key) => {
    return typeName => {
      const cashayState = this.getState();
      const rawState = cashayState.entities[typeName];
      if (!rawState) {
        throw new Error(`${typeName} does not exist in your cashay data state entities!`);
      }

      // TODO using stateVars is wrong because vars could be static in the query, instead we need to check the schema + varDefs + vars
      const stateVars = getStateVars(cashayState, op, key);
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
    const {dependency, op = subscriptionString, key = ''} = options;
    const fastResult = this.cachedSubscriptions[op];
    const fastResponse = fastResult && fastResult.responses[key];
    if (fastResponse) {
      if (dependency) {
        fastResult.dependencies.add(dependency)
      }
      return fastResponse;
    }
    if (!fastResult) {
      this.cachedSubscriptions[op] = new CachedSubscription(subscriptionString, key);
    }
    const cachedSubscription = this.cachedSubscriptions[op];
    const cashayState = this.getState();
    const {coerceTypes, paginationWords, idFieldName, schema} = this;
    const variables = getVariables(options.variables, cashayState, op, key, cachedSubscription.responses[key]);
    const context = buildExecutionContext(cachedSubscription.ast, {
      coerceTypes,
      cashayState,
      variables,
      paginationWords,
      idFieldName,
      schema
    });
    const getCachedResult = () => cachedSubscription.responses[key].data;
    const subscriptionHandlers = this.makeSubscriptionHandlers(op, key, variables);
    // const startSubscription = (subVars) => subscriber(subscriptionString, subVars, subscriptionHandlers, getCachedResult);
    const promiseStart = (subVars) => new Promise((resolve) => {
      setTimeout(() => {
        const unsubscribe = subscriber(subscriptionString, subVars, subscriptionHandlers, getCachedResult);
        resolve(unsubscribe)
      }, 0)
    });

    promiseStart(variables).then(socketUnsub => {
      cachedSubscription.responses[key] = {
        ...cachedSubscription.responses[key],
        status: READY,
        unsubscribe: () => {
          socketUnsub();
          this.store.dispatch({
            type: SET_STATUS,
            status: UNSUBSCRIBED
          })
        }
      }
    });

    const data = denormalizeStore(context, 'subscriptionSchema');
    return cachedSubscription.responses[key] = {
      data,
      setVariables: setSubVariablesFactory(op, key, this.store.dispatch, this.getState, cachedSubscription, promiseStart),
      status: SUBSCRIBING,
      unsubscribe: null
    };
  }

  makeSubscriptionHandlers(op, key, variables) {
    const handleCreateNewData = (handler, document, docId, {path, removeKeys = []}) => {
      // removeKeys can optionally be `true`, meaning straight up replace the old with the new
      const cachedSubscription = this.cachedSubscriptions[op];
      const cashayState = this.getState();
      const {paginationWords, idFieldName, schema} = this;
      const context = buildExecutionContext(cachedSubscription.ast, {
        cashayState,
        variables,
        paginationWords,
        idFieldName,
        schema
      });
      const operations = context.operation.selectionSet.selections;
      const cachedResult = cachedSubscription.responses[key].data;
      const subscriptionNames = Object.keys(cachedResult);
      if (subscriptionNames.length > 1 && !path) {
        throw new Error(`Your subscription for ${op} has multiple operations, but no path.
         Include a 'path' option to determine how to patch in the incoming data.`);
      }
      const pathArray = path ? path.split('.') : subscriptionNames;
      const newData = createNewData(handler, cachedResult, pathArray, {
        document,
        docId,
        idFieldName,
        removeKeys,
        schema
      });
      return {newData, context};
    };

    const mergeNewData = (actionType, {newData, context}) => {
      const cachedSubscription = this.cachedSubscriptions[op];
      cachedSubscription.responses[key] = {
        ...cachedSubscription.responses[key],
        // handle multiple sub operations inside the same sub
        data: {...cachedSubscription.responses[key].data, ...newData}
      };
      const normalizedDoc = normalizeResponse(newData, context, true);
      const {entities, result} = this.getState();
      const entitiesAndResult = shortenNormalizedResponse(normalizedDoc, {entities, result});
      if (!entitiesAndResult) return;

      // remove the responses from this.cachedQueries where necessary
      flushDependencies(entitiesAndResult.entities, op, key, this.denormalizedDeps, this.cachedQueries);

      // flush dependencies for all computed values
      cachedSubscription.dependencies.forEach(dep => this.cachedComputed[dep] = undefined);

      // stick normalize data in store and recreate any invalidated denormalized structures
      const payload = {
        ...entitiesAndResult,
        ops: {
          [op]: {[key]: variables}
        }
      };
      this.store.dispatch({
        type: actionType,
        payload
      });
    };

    return {
      add: (document, options = {}) => {
        const docId = document[this.idFieldName];
        const newDataAndContext = handleCreateNewData(ADD, document, docId, options);
        mergeNewData(ADD_SUBSCRIPTION, newDataAndContext)
      },
      update: (document, options = {}) => {
        const docId = document[this.idFieldName];
        const newDataAndContext = handleCreateNewData(UPDATE, document, docId, options);
        mergeNewData(UPDATE_SUBSCRIPTION, newDataAndContext)
      },
      upsert: (document, options = {}) => {
        const docId = document[this.idFieldName];
        const newDataAndContext = handleCreateNewData(UPSERT, document, docId, options);
        mergeNewData(UPDATE_SUBSCRIPTION, newDataAndContext);
      },
      remove: (docId, options = {}) => {
        const newDataAndContext = handleCreateNewData(REMOVE, null, docId, options);
        mergeNewData(REMOVE_SUBSCRIPTION, newDataAndContext)
      },
      setStatus: (status) => {
        const cachedSub = this.cachedSubscriptions[op];
        cachedSub.responses[key] = {
          ...cachedSub.responses[key],
          status
        };
        dispatch({
          type: SET_STATUS,
          status
        })
      }
    }
  }

  computed(op, inputs = [], resolve) {
    const fastResult = this.cachedComputed[op];
    if (fastResult) {
      let returnFast = true;
      for (let i = 0; i < inputs.length; i++) {
        if (inputs[i] !== fastResult.inputs[i]) {
          returnFast = false;
          break;
        }
      }
      if (returnFast) return fastResult.response;
    }
    const response = resolve(...inputs);
    this.cachedComputed[op] = {
      inputs,
      response
    };
    return response;
  }
}
export default new Cashay();
