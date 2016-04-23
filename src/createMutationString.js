import {ensureTypeFromNonNull, ensureRootType, isObject} from './utils';
import {
  OPERATION_DEFINITION,
  DOCUMENT,
  SELECTION_SET,
  NAME,
  ARGUMENT,
  VARIABLE,
  NAMED_TYPE,
  FIELD,
  OBJECT,
  LIST
} from 'graphql/language/kinds';

export const createMutationString = (mutationName, variables) => {
  // find the mutation in the schema
  const operationName = this._schema.mutationType.name;
  const rootMutation = this._schema.types.find(type => type.name === operationName);
  const mutationSchema = rootMutation.fields.find(field => field.name === mutationName);
  const nonNullMutationType = ensureTypeFromNonNull(mutationSchema.type);
  const rootMutationType = ensureRootType(nonNullMutationType);

  // determine if it's a list to increase chances of a successful accessLog
  const isAList = nonNullMutationType.kind === LIST;

  // get the underlying type of document the mutation will return
  const returnType = this._schema.types.find(type => type.name === rootMutationType.name);

  // use variables to create the mutation arguments
  const usefulArguments = makeUsefulArguments(mutationSchema, variables);
  const variableDefinitions = makeVariableDefinitions(mutationSchema, usefulArguments);

  // figure out what all the listeners need
  const accessLogs = buildAccessLogs(isAList, this._listeners[mutationName]);
  const mergedAccessLog = mergeAccessLogs(accessLogs);
  if (!mergedAccessLog) return;

  // mix it all together in a tasty dish
  const operationSelectionSet = walkAccessLog(mergedAccessLog, returnType, this._schema);
  const mutationAST = buildMutationAST(mutationName, usefulArguments, operationSelectionSet, variableDefinitions);
  return print(mutationAST);
};

const buildMutationAST = (mutationName, usefulArguments, operationSelectionSet, variableDefinitions) => {
  const operationNameObj = {
    kind: NAME,
    value: mutationName
  };

  const operationSelection = {
    alias: operationNameObj,
    arguments: usefulArguments,
    directives: [], // TODO add directives support
    kind: FIELD,
    name: operationNameObj,
    selectionSet: operationSelectionSet
  };

  const mutationDefinition = {
    kind: OPERATION_DEFINITION,
    operation: 'mutation',
    variableDefinitions,
    selectionSet: {
      kind: SELECTION_SET,
      selections: [operationSelection] // only 1 mutation at a time here
    }
  };

  // document wrapper
  return {
    kind: DOCUMENT,
    definitions: mutationDefinition
  }
};

const buildAccessLogs = (isAList, mutationNameListener) => {
  const accessLogs = [];
  for (let [componentId, mutationListener] of mutationNameListener.entities()) {

    // get currently cached response
    const {response} = this._denormalizedResults[componentId];

    // make proxy doc to figure out what fields will be mutated
    const {proxy, accessLog} = detectAccess({});

    // make a copy of the response that we can throw away
    const responseClone = JSON.parse(JSON.stringify(response));

    // if the result coming back is an array, make the proxy an array to get into some possible conditionals
    const finalProxy = isAList ? [proxy] : proxy;

    // call listener with proxy doc
    // this would break if we need to get inside a proxy-based conditional (eg if response.foo === 5 response.bar)
    mutationListener(null, finalProxy, responseClone, () => {
    });
    if (Object.keys(accessLog)) {
      accessLogs.push(accessLog);
    }
  }
  return accessLogs;
};

const detectAccess = obj => {
  if (!isObject(obj)) return {proxy: obj, accessLog: true};
  const subProxies = {};
  const accessLog = {};
  var proxy = new Proxy(obj, {
    get: function (target, prop) {
      if (prop === 'splice' || prop === '__proto__' || typeof prop === 'symbol') return;
      target[prop] = target[prop] || {};
      if (!accessLog[prop]) {
        var recur = detectAccess(obj[prop]);
        accessLog[prop] = recur.accessLog;
        return subProxies[prop] = recur.proxy;
      } else {
        return subProxies[prop];
      }
    }
  });
  return {proxy, accessLog};
};

const makeVariableDefinitions = (mutationSchema, usefulVariables) => {
  return usefulVariables.reduce((reduction, variable)=> {
    const argType = ensureTypeFromNonNull(mutationSchema.args.find(arg => arg.name === variable.name.value).type);
    reduction.push({
      type: {
        kind: NAMED_TYPE,
        name: {
          kind: NAME,
          value: argType.name
        },
        variable: {
          kind: VARIABLE,
          name: variable.name
        }
      }
    })
  }, [])
};

const makeUsefulArguments = (mutationSchema, variables = {}) => {
  if (!mutationSchema.args || mutationSchema.args.length === 0) {
    return [];
  }

  return Object.keys(variables).reduce((reduction, variable)=> {
    const varInSchema = mutationSchema.args.find(arg => arg.name === variable);
    if (varInSchema) {
      reduction.push(createArg(variable));
    }
    return reduction;
  }, []);
};

const createArg = value => {
  const name = {
    kind: NAME,
    value
  };
  return {
    kind: ARGUMENT,
    name,
    value: {
      kind: VARIABLE,
      name
    }
  }
};

const walkAccessLog = (accessLog, typeSchema, schema) => {
  if (Object.keys(accessLog)) {
    return {
      kind: SELECTION_SET,
      selections: makeSelectionsArray(accessLog, typeSchema, schema)
    }
  }
};

const makeSelectionsArray = (accessLog, typeSchema, schema) => {
  return Object.keys(accessLog).reduce((reduction, key) => {
    const keyField = typeSchema.fields.find(field => field.name === key);
    if (!keyField) {
      console.error(`you tried to access ${key} but that's not in your ${typeSchema.name} schema!`);
    }
    const rootFieldType = ensureRootType(keyField.type);
    const keySchema = schema.types.find(type => type.name === rootFieldType.name);

    if (rootFieldType.kind === OBJECT) {
      if (Object.keys(accessLog[key]).length === 0) {
        // if we don't declare any specific subfields, but it's an object, grab em all
        accessLog[key] = keySchema.fields.reduce((reduction, field) => {
          reduction[field.name] = {};
        }, {});
      }
    }
    reduction.push({
      arguments: [],
      directives: [],
      kind: FIELD,
      name: {
        kind: NAME,
        value: key
      },
      selectionSet: walkAccessLog(accessLog[key], keySchema, schema)
    });
    return reduction;
  }, [])
};

const mergeAccessLogs = accessLogs => {
  const mergedAccessLog = accessLogs.pop();
  if (!mergedAccessLog) return;
  for (let i = accessLogs.length - 1; i >= 0; i--) {
    merge2AccessLogs(mergedAccessLog, accessLogs[i]);
  }
  return mergedAccessLog;
};

const merge2AccessLogs = (target, src) => {
  Object.keys(src).forEach(srcKey => {
    if (!target[srcKey]) {
      target[srcKey] = src[srcKey];
    } else if (Object.keys(target[srcKey])) {
      // if target[srcKey] is empty, leave it that way. empty means we'll grab ALL CHILDREN from the schema
      merge2AccessLogs(target[srcKey], src[srcKey])
    }
  })
};
