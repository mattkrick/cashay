import {INLINE_FRAGMENT, OPERATION_DEFINITION, FRAGMENT_DEFINITION, VARIABLE} from 'graphql/language/kinds';
import {TypeKind} from 'graphql/type/introspection';
import {parse as gqlParse} from 'graphql/language/parser';

const {NON_NULL, UNION} = TypeKind;

export const TYPENAME = '__typename';
export const CASHAY = 'CASHAY';
export const DELIMITER = '_';
export const NORM_DELIMITER = '::';
export const REMOVAL_FLAG = '___CASHAY_REMOVAL_FLAG___';

/* redux store array constants */
export const FRONT = 'front';
export const BACK = 'back';
export const FULL = 'full';

/* subscription handler names */
export const ADD = 'add';
export const UPDATE = 'update';
export const UPSERT = 'upsert';
export const REMOVE = 'remove';

/* default pagination argsuments */
export const FIRST = 'first';
export const LAST = 'last';
export const BEFORE = 'before';
export const AFTER = 'after';

/* status for queries */
export const LOADING = 'loading';
export const COMPLETE = 'complete';

/* status for subscriptions */
export const SUBSCRIBING = 'subscribing';
export const READY = 'ready';
export const UNSUBSCRIBED = 'unsubscribed';

/* directives */
export const LIVE = 'live';
export const LOCAL_SORT = 'localSort';
export const LOCAL_FILTER = 'localFilter';
export const LOCAL = 'local';
export const CACHED = `cached`;
export const CACHED_ARGS = ['id', 'ids', 'type'];


export const ensureTypeFromNonNull = type => type.kind === NON_NULL ? type.ofType : type;

export const ensureRootType = type => {
  while (type.ofType) type = type.ofType;
  return type;
};

export const getRegularArgsKey = regularArgs => {
  return regularArgs && (Object.keys(regularArgs).length ? JSON.stringify(regularArgs) : '');
};

export const isObject = val => val && typeof val === 'object';

export const clone = obj => JSON.parse(JSON.stringify(obj));

// export const scalarSafeClone = maybeObj => isObject(maybeObj) ? clone(maybeObj) : maybeObj;

export const shallowPlus1Clone = obj => {
  if (!isObject(obj)) return obj;
  const dataKeys = Object.keys(obj);
  const newObj = {};
  for (let i = 0; i < dataKeys.length; i++) {
    const key = dataKeys[i];
    const prop = obj[key];
    let propClone = prop;
    if (Array.isArray(prop)) {
      propClone = prop.slice();
    } else if (isObject(prop)) {
      propClone = {...prop};
    }
    newObj[key] = propClone;
  }
  return newObj;
};

export const makeErrorFreeResponse = cachedResponse => {
  const {status, setVariables} = cachedResponse;
  return {
    data: shallowPlus1Clone(cachedResponse.data),
    setVariables,
    status
  }
};

export const checkMutationInSchema = (rootMutation, mutationName) => {
  const mutationSchema = rootMutation.fields[mutationName];
  if (!mutationSchema) {
    throw new Error(`Invalid mutation: ${mutationName}.
    Did you make a typo or forget to update your schema?`);
  }
};

export const convertFragmentToInline = fragment => {
  delete fragment.name;
  fragment.kind = INLINE_FRAGMENT;
  return fragment;
};

export const parse = graphQLString => gqlParse(graphQLString, {noLocation: true, noSource: true});

export const buildExecutionContext = (queryAST, params) => {
  const clonedAST = clone(queryAST);
  const {operation, fragments} = teardownDocumentAST(clonedAST.definitions);
  return {operation, fragments, ...params};
};

export const teardownDocumentAST = astDefinitions => {
  let operation;
  const fragments = {};
  for (let i = 0; i < astDefinitions.length; i++) {
    const definition = astDefinitions[i];
    if (definition.kind === OPERATION_DEFINITION) {
      if (operation) {
        throw new Error('Multiple operations not supported');
      }
      operation = definition;
    } else if (definition.kind === FRAGMENT_DEFINITION) {
      fragments[definition.name.value] = definition;
    }
  }
  if (!operation) {
    throw new Error('Must provide an operation.');
  }
  return {operation, fragments};
};

/**
 * stateVars is the name for the variables stored in the redux state, which are the most current variables for an op.
 * @param {Object} cashayState the result of this.getState(), usually equivalent to store.getState().cashay
 * @param {Object} op the name of the container full of keys
 * @param {Object} key the key for the specified op, defaults to ''
 * */
export const getStateVars = (cashayState, op, key) => {
  // explicitly return undefined so we can use default values in functions
  return cashayState.ops[op] && cashayState.ops[op][key] && cashayState.ops[op][key].variables || undefined;
};

export const getVariables = (initialVariables = {}, cashayState, op, key, cachedResponse) => {
  const stateVars = getStateVars(cashayState, op, key) || {};
  const newInitialVariables = resolveInitialVariables(cashayState, initialVariables, cachedResponse);
  // make the stateVars override the likely stale UD vars, but if the UD vars have something that used to be undefined, keep it
  return {...newInitialVariables, ...stateVars};
};

const resolveInitialVariables = (cashayState, initialVariables, cachedResponse) => {
  const variableNames = Object.keys(initialVariables);
  const newVariables = {};
  for (let i = 0; i < variableNames.length; i++) {
    const variableName = variableNames[i];
    const value = initialVariables[variableName];
    newVariables[variableName] = (typeof value === 'function') ? safeValue(cachedResponse, value, cashayState) : value;
  }
  return newVariables;
};

const safeValue = (response, cb, cashayState) => response && response.data && cb(response.data, cashayState);

export const makeNamespaceString = (op, name, d = DELIMITER) => `${CASHAY}${d}${op}${d}${name}`;

export const without = (obj, exclusions) => {
  const objKeys = Object.keys(obj);
  const newObj = {};
  for (let i = 0; i < objKeys.length; i++) {
    const key = objKeys[i];
    if (!exclusions.includes(key)) {
      newObj[key] = obj[key];
    }
  }
  return newObj;
};

export const isLive = (directives) => Boolean(directives && directives.find(d => d.name.value === LIVE));

export const getFieldSchema = (field, maybeTypeSchema, schema) => {
  const fieldName = field.name.value;
  const liveDirective = isLive(field.directives);
  const typeSchema = liveDirective ? schema.subscriptionSchema : maybeTypeSchema;
  const fieldSchema = typeSchema.fields[fieldName];
  if (!fieldSchema) {
    throw new Error(`${fieldName} isn't in the schema. Did you update your client schema?`)
  }
  return fieldSchema;
};

export const defaultResolveChannelKeyFactory = (idFieldName, topLevelSource) => (source, args) => {
  if (!topLevelSource) {
    return source[idFieldName] || '';
  } else {
    return args[idFieldName] ? args[idFieldName] : args[Object.keys(args)[0]] || '';
  }
};

export const makeFullChannel = (channel, channelKey) => {
  return channelKey ? `${channel}${NORM_DELIMITER}${channelKey}` : channel;
};

export const makeCachedArgs = (argsArr, variables, schema) => {
  const cachedArgs = {};
  for (let i = 0; i < argsArr.length; i++) {
    const arg = argsArr[i];
    const argName = arg.name.value;
    cachedArgs[argName] = getVariableValue(arg, variables);
  }
  if (cachedArgs.id && typeof cachedArgs.id !== 'string') {
    throw new Error(`@cached 'id' arg requires a string`)
  }
  if (cachedArgs.ids && !Array.isArray(cachedArgs.ids)) {
    throw new Error(`@cached 'ids' arg requires an array`)
  }
  const {type} = parseCachedType(cachedArgs.type);
  const typeSchema = schema.types[type];
  if (!typeSchema) {
    throw new Error(`@cached type ${type} does not exist in your schema!`);
  }
  return cachedArgs;
};

export const getVariableValue = (arg, variables) => {
  return arg.value.kind === VARIABLE ? variables[arg.value.name.value] : arg.value.value;
};

export const getTypeName = (typeSchema, updatedData, doc) => {
  if (typeSchema.kind === UNION) {
    const typeName = updatedData.__typename;
    if (!typeName) {
      throw new Error(`Cannot determine typeName for incoming document ${doc}.`)
    }
    return typeName;
  }
  return typeSchema.name;
};

export const shallowEqual = (obj1, obj2) => {
  // obj1 is guaranteed to be different than obj2, so no need to check strict eq
  const obj1Keys = Object.keys(obj1);
  const obj2Keys = Object.keys(obj2);
  if (obj1Keys.length !== obj2Keys.length) return false;
  for (let i = 0; i < obj1Keys.length; i++) {
    const key = obj1Keys[i];
    if (obj1[key] !== obj2[key]) return false;
  }
  return true;
};

export const parseCachedType = (type) => {
  if (type.startsWith('[')) {
    return {
      type: type.substr(1,type.length-2),
      typeIsList: true
    }
  } else {
    return {
      type,
      typeIsList: false
    }
  }
};
