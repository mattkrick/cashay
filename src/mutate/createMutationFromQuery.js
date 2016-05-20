import {ensureRootType} from '../utils';
import {MutationShell, RequestArgument, Field} from '../helperClasses';
import {clone} from '../utils';
import {mergeSelections} from './mergeMutations';
import {VARIABLE, INLINE_FRAGMENT} from 'graphql/language/kinds';
import {TypeKind} from 'graphql/type/introspection';

const {SCALAR} = TypeKind;

export default (queryAST, mutationName, mutationVariables = {}, schema) => {
  const operation = queryAST.definitions[0];
  //createComment
  const mutationFieldSchema = schema.mutationSchema.fields[mutationName];
  const mutationRootReturnType = ensureRootType(mutationFieldSchema.type);
  const mutationReturnSchema = schema.types[mutationRootReturnType.name];

  const mutationArgs = makeArgsFromVars(mutationFieldSchema, mutationVariables);
  const mutationAST = new MutationShell(mutationName, mutationArgs);

  // Assume the mutationReturnSchema is a single type (opposed to a payload full of many types)
  const selectionsInQuery = findTypeInQuery(mutationReturnSchema.name, operation, schema);
  const simpleObject = trySimpleObject(selectionsInQuery);
  if (simpleObject) {
    mutationAST.definitions[0].selectionSet.selections[0].selectionSet.selections = simpleObject;
    return mutationAST;
  }
  return tryPayloadObject(mutationAST, operation, mutationReturnSchema, schema);
};

/**
 * Uses a BFS since types are likely high up the tree & scalars can possibly break early
 */
const findTypeInQuery = (typeName, queryAST, schema, matchName) => {
  const bag = [];
  const queue = [];
  let next = {
    reqAST: queryAST,
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
          const rootFieldType = ensureRootType(fieldSchema.type);
          subSchema = ensureRootType(schema.types[rootFieldType.name]);
          if (subSchema.name === typeName) {
            if (matchName) {
              bag[0] = clone(selection);
              const fieldNameOrAlias = selection.alias && selection.alias.value || selectionName;
              if (matchName === fieldNameOrAlias) {
                return bag;
              }
            } else {
              bag.push(clone(selection.selectionSet.selections));
            }
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
  return bag;
};

const trySimpleObject = selectionsInQuery => {
  if (selectionsInQuery.length) {
    const newSelections = selectionsInQuery.pop();
    for (let srcSelections of selectionsInQuery) {
      mergeSelections(newSelections, srcSelections);
    }
    return newSelections;
  }
};

const tryPayloadObject = (mutationAST, operation, mutationReturnSchema, schema) => {
  const payloadFieldKeys = Object.keys(mutationReturnSchema.fields);
  for (let payloadFieldKey of payloadFieldKeys) {
    const payloadField = mutationReturnSchema.fields[payloadFieldKey];
    const rootPayloadFieldType = ensureRootType(payloadField.type);
    // 2 strings probably don't refer to the same field, so for scalars the name has to match, too
    const matchName = rootPayloadFieldType.kind === SCALAR && payloadField.name;
    const selectionsInQuery = findTypeInQuery(rootPayloadFieldType.name, operation, schema, matchName);
    if (selectionsInQuery.length) {
      let mutationField;
      if (matchName) {
        mutationField = new Field({name: matchName});
      } else {
        const newSelections = selectionsInQuery.pop();
        for (let srcSelections of selectionsInQuery) {
          mergeSelections(newSelections, srcSelections);
        }
        // make a payload field into a mutation field
        mutationField = new Field({name: payloadField.name, selections: newSelections});
      }
      mutationAST.definitions[0].selectionSet.selections[0].selectionSet.selections.push(mutationField);
    }
  }
  return mutationAST;
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
