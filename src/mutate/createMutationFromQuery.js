import {ensureRootType} from '../utils';
import {MutationShell, RequestArgument, Field} from '../helperClasses';
import {mergeSelections} from './mergeMutations';
import {VARIABLE} from 'graphql/language/kinds';
import {TypeKind} from 'graphql/type/introspection';
import findTypeInQuery from './findTypeInQuery';

const {SCALAR} = TypeKind;

export default function createMutationFromQuery(queryAST, mutationName, mutationVariables = {}, schema) {
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
  let atLeastOne = false;
  const payloadFieldKeys = Object.keys(mutationReturnSchema.fields);
  for (let i = 0; i < payloadFieldKeys.length; i++) {
    const payloadFieldKey = payloadFieldKeys[i];
    const payloadField = mutationReturnSchema.fields[payloadFieldKey];
    const rootPayloadFieldType = ensureRootType(payloadField.type);
    // 2 strings probably don't refer to the same field, so for scalars the name has to match, too
    const matchName = rootPayloadFieldType.kind === SCALAR && payloadField.name;
    const selectionsInQuery = findTypeInQuery(rootPayloadFieldType.name, operation, schema, matchName);
    if (selectionsInQuery.length) {
      atLeastOne = true;
      let mutationField;
      if (matchName) {
        mutationField = new Field({name: matchName});
      } else {
        const newSelections = selectionsInQuery.pop();
        for (let j = 0; j < selectionsInQuery.length; j++) {
          const srcSelections = selectionsInQuery[j];
          mergeSelections(newSelections, srcSelections);
        }
        // make a payload field into a mutation field
        mutationField = new Field({name: payloadField.name, selections: newSelections});
      }
      mutationAST.definitions[0].selectionSet.selections[0].selectionSet.selections.push(mutationField);
    }
  }
  if (!atLeastOne) {
    throw new Error(`Could not generate a mutation from ${operation.selectionSet.selections[0].name.value}. 
    Verify that ${mutationReturnSchema.name} is correct and the schema is updated. 
    If it includes scalars, make sure those are aliased in the query.`)
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
