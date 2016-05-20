import {ensureRootType} from '../utils';
import {CachedMutation, CachedQuery, MutationShell, RequestArgument} from '../helperClasses';
import {ensureTypeFromNonNull, clone} from '../utils';
import {mergeSelections} from './mergeMutations';
import {
  OPERATION_DEFINITION,
  DOCUMENT,
  SELECTION_SET,
  NAME,
  ARGUMENT,
  VARIABLE,
  NAMED_TYPE,
  FIELD,
  INLINE_FRAGMENT,
  VARIABLE_DEFINITION,
  LIST_TYPE
} from 'graphql/language/kinds';

export default (queryAST, mutationName, mutationVariables = {}, schema) => {
  const operation = queryAST.definitions[0];
  //createComment
  const mutationFieldSchema = schema.mutationSchema.fields[mutationName];
  //commentType
  const mutationRootReturnType = ensureRootType(mutationFieldSchema.type);
  // commentTypeSchema
  const mutationReturnSchema = schema.types[mutationRootReturnType.name];

  const mutationArgs = makeArgsFromVars(mutationFieldSchema, mutationVariables);
  const mutationAST = new MutationShell(mutationName, mutationArgs);


  // Assume the mutationReturnSchema is a single type (opposed to a payload full of many types)
  const selectionsInQuery = findTypeInQuery(mutationReturnSchema.name, operation, schema);
  if (selectionsInQuery) {
    debugger
    const newSelections = selectionsInQuery.pop();
    for (let srcSelections of selectionsInQuery) {
      mergeSelections(newSelections, srcSelections);
    }
    mutationAST.definitions[0].selectionSet.selections[0].selectionSet.selections = newSelections;
  } else {

    // TODO treat as a payload
  }
  return mutationAST;
};

const findTypeInQuery = (typeName, initialReqAST, schema) => {
  const bag = [];
  const queue = [];
  let next = {
    reqAST: initialReqAST,
    typeSchema: schema.querySchema
  };
  while (next) {
    const {reqAST, typeSchema} = next;
    if (reqAST.selectionSet) {
      for (let selection of reqAST.selectionSet.selections) {
        let subSchema;
        if (selection.kind === INLINE_FRAGMENT) {
          subSchema = typeSchema;
        } else {
          const selectionName = selection.name.value;
          const fieldSchema = typeSchema.fields[selectionName];
          if (!fieldSchema) debugger
          const rootFieldType = ensureRootType(fieldSchema.type);
          subSchema = ensureRootType(schema.types[rootFieldType.name]);
          if (subSchema.name === typeName) {
            bag.push(clone(selection.selectionSet.selections));
          }
        }
        queue.push({
          reqAST: selection,
          typeSchema: subSchema
        })
      }
    }
    next = queue.shift();
  }
  return bag.length && bag;
};

const makeArgsFromVars = (mutationFieldSchema, variables) => {
  const mutationArgs = [];
  const argKeys = Object.keys(mutationFieldSchema.args);
  for (let argKey of argKeys) {
    const schemaArg = mutationFieldSchema.args[argKey];
    if (variables.hasOwnProperty(schemaArg.name)) {
      const newArg = new RequestArgument(schemaArg.name, VARIABLE, schemaArg.name);
      mutationArgs.push(newArg);
    }
  }
  return mutationArgs;
};
