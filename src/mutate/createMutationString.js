import {ensureTypeFromNonNull, ensureRootType, isObject} from '../utils';
import {parse} from 'graphql/language/parser';
import {teardownDocumentAST} from '../buildExecutionContext';
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

import {TypeKind} from 'graphql/type/introspection';

const {UNION: UNION_KIND, LIST: LIST_KIND, OBJECT: OBJECT_KIND, SCALAR: SCALAR_KIND} = TypeKind;

const getCachedMutationString = (cachedMutationObj, componentIdsToUpdate) => {
  if (cachedMutationObj && cachedMutationObj.setKey.size === componentIdsToUpdate.length) {
    for (let componentId of componentIdsToUpdate) {
      if (!cachedMutationObj.setKey.has(componentId)) {
        return
      }
    }
    return cachedMutationObj.fullMutation;
  }
};

const findTypeInAST = (typeToFind, rootQuery, context) => {
  const queue = [];
  // let nextSelection = context.operation;
  // let fieldSchema = rootQuery;
  let next = {
    reqAST: context.operation,
    fieldSchema: rootQuery
  };
  while (next) {
    const {reqAST, fieldSchema} = next;
    //duck-type to see if it's an operation
    // if (nextSelection.operation) {
    if (reqAST.selectionSet) {
      for (let selection of reqAST.selectionSet.selections) {
        const selectionName = selection.name.value;
        const querySchema = fieldSchema.fields.find(field => field.name === selectionName);
        const subSchema = ensureRootType(context.schema.types.find(type => type.name === querySchema.type.name));
        if (subSchema.name === typeToFind) {
          return selection
        }
        queue.push({
          reqAST: selection,
          fieldSchema: subSchema
        })
      }
    }
    next = queue.shift();
  }
};

export const createMutationString = function(mutationName, componentIdsToUpdate, variables) {
  const cachedMutationObj = this._cachedMutations[mutationName];
  const cachedMutationString = getCachedMutationString(cachedMutationObj, componentIdsToUpdate);
  if (cachedMutationString) {
    return cachedMutationString;
  }
  debugger
  // expensive duck typing
  const queryASTs = componentIdsToUpdate.map(componentId => {
    const {queryString} = this._cachedQueries[componentId];
    return parse(queryString, {noLocation: true, noSource: true});
  });

  // TODO fix mergeQueryASTs
  const documentAST = mergeQueryASTs(queryASTs);

  const context = teardownDocumentAST(documentAST);
  context.schema = this._schema;

  // BlogMutation
  // const rootMutationName = this._schema.mutationType.name;
  // const rootMutationType = this._schema.types.find(type => type.name === rootMutationName); BAD
  
  // createComment
  const mutationFieldSchema = rootMutationType.fields.find(field => field.name === mutationName);
  const mutationTypeToFind = ensureRootType(mutationFieldSchema.type);
  
  
  
  
  // const nonNullMutationType = ensureTypeFromNonNull(mutationFieldSchema.type);
  const mutationPayloadSchema = this._schema.types.find(type => type.name === rootMutationFieldType.name);
  
  // level 0 has 1 entry
  // level 1, if necessary, will have all the fields of level 0
  const payloadTypes = [[mutationPayloadSchema]];
  // TODO make an array of all the fields it could be, too
  // const rootQuery = context.schema.types.find(type => type.name === context.schema.queryType.name);
  
  const snaggedSelections = [];
  if (rootMutationFieldType.kind === OBJECT_KIND) {

    // an object containing 3 objects: object, union, scalar
    // each object contains an array of schema fields 
    // const payloadTypes = createPayloadTypes(mutationFieldSchema);

    // for each mutation schema field that is of kind.OBJECT
    for (let payloadObj of payloadTypes[OBJECT_KIND]) {
      const subsetAST = findTypeInAST(payloadObj.type.name, rootQuery, context)
      if (subsetAST) {
        snaggedSelections.push(subsetAST);
      }
    }

  } else if (nonNullMutationType.kind === LIST) {
    const subsetAST = findTypeInAST(mutationPayloadSchema.type.name, rootQuery, context)
    if (subsetAST) {
      snaggedSelections.push(subsetAST);
    }
  } else if (nonNullMutationType.kind === SCALAR_KIND) {
    //TODO
  }

  // use variables to create the mutation arguments
  // const mutationArguments = makeUsefulArguments(mutationFieldSchema, variables);
  // const variableDefinitions = makeVariableDefinitions(mutationFieldSchema, mutationArguments);
  const mutationArguments = [];
  const variableDefinitions = [];

  const mutationAST = buildMutationAST(mutationName, mutationArguments, snaggedSelections, variableDefinitions);
  const fullMutation = print(mutationAST);
  this._cachedMutations[mutationName] = {
    fullMutation,
    setKey: new Set([...componentIdsToUpdate])
  };
  return fullMutation;
};

const createPayloadTypes = mutationPayloadSchema => {
  const payloadTypes = {
    [OBJECT_KIND]: [],
    [UNION_KIND]: [],
    [SCALAR_KIND]: []
  };

  for (let field of mutationPayloadSchema.fields) {
    const fieldRootType = ensureRootType(field.type);
    payloadTypes[fieldRootType.kind].push(field);
  }
  return payloadTypes;
};

const buildMutationAST = (mutationName, mutationArguments, snaggedSelections, variableDefinitions) => {
  const operationSelectionSet = {
    kind: SELECTION_SET,
    selections: snaggedSelections
  };
  const operationNameObj = {
    kind: NAME,
    value: mutationName
  };

  const operationSelection = {
    alias: operationNameObj,
    arguments: mutationArguments,
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

const buildAccessLogs = function(isAList, mutationNameListener, variables) {
  const accessLogs = [];
  for (let [componentId, mutationListener] of mutationNameListener) {

    // get currently cached response
    const {data: responseData} = this._cachedQueries[componentId].response;

    // make proxy doc to figure out what fields will be mutated
    const {proxy, accessLog} = detectAccess({});

    // make a copy of the response that we can throw away
    const responseClone = JSON.parse(JSON.stringify(responseData));

    // if the result coming back is an array, make the proxy an array to get into some possible conditionals
    const finalProxy = isAList ? [proxy] : proxy;

    // run through a mock optimistic update
    debugger
    mutationListener(variables, null, responseClone, () => {
    });
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
    get: function(target, prop) {
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
    });
    return reduction;
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

const createSelectionSet = (accessLog, typeSchema, schema) => {
  return {
    kind: SELECTION_SET,
    selections: makeSelectionsArray(accessLog, typeSchema, schema)
  }
};

// const walkAccessLog = (accessLog, typeSchema, schema) => {
//   if (Object.keys(accessLog)) {
//     return {
//       kind: SELECTION_SET,
//       selections: makeSelectionsArray(accessLog, typeSchema, schema)
//     }
//   }
// };

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

const mergeQueryASTs = queryASTs => {
  const masterQueryAST = queryASTs.pop();
  if (!masterQueryAST) return;
  for (let i = queryASTs.length - 1; i >= 0; i--) {
    merge2AQueryASTs(masterQueryAST, queryASTs[i]);
  }
  return masterQueryAST;
};

const merge2AQueryASTs = (target, src) => {
  // Object.keys(src).forEach(srcKey => {
  //   if (!target[srcKey]) {
  //     target[srcKey] = src[srcKey];
  //   } else if (Object.keys(target[srcKey])) {
  //     // if target[srcKey] is empty, leave it that way. empty means we'll grab ALL CHILDREN from the schema
  //     merge2AQueryASTs(target[srcKey], src[srcKey])
  //   }
  // })
};
