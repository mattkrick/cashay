import {ensureRootType, clone} from '../utils';
import {MutationShell, Field} from '../helperClasses';
import {mergeSelections} from './mergeMutations';
import {TypeKind} from 'graphql/type/introspection';
import findTypeInQuery from './findTypeInQuery';
import makeArgsFromVars from './makeArgsFromVars';

const {SCALAR} = TypeKind;


export default function createMutationFromQuery(operation, mutationName, mutationVariables = {}, schema) {
  const mutationFieldSchema = schema.mutationSchema.fields[mutationName];
  const mutationResponseType = ensureRootType(mutationFieldSchema.type);
  const mutationResponseSchema = schema.types[mutationResponseType.name];

  // generating a mutation string requires guessing at what field arguments to pass in
  // if the variables object includes something with the same name as the arg name, that's probably a fair heuristic
  const mutationArgs = makeArgsFromVars(mutationFieldSchema, mutationVariables);
  const mutationAST = new MutationShell(mutationName, mutationArgs);

  // Assume the mutationResponseSchema is a single type (opposed to a payload full of many types)
  const simpleSelections = trySimplePayload(mutationResponseSchema.name, operation, schema);
  if (simpleSelections) {
    mutationAST.definitions[0].selectionSet.selections[0].selectionSet.selections = simpleSelections;
    return mutationAST;
  }

  // guess it's full of many types!
  return tryComplexPayload(mutationAST, operation, mutationResponseSchema, schema);
};

const trySimplePayload = (typeName, operation, schema) => {
  const selectionsInQuery = findTypeInQuery(typeName, operation, schema);
  if (selectionsInQuery.length) {
    const allSelections = flattenFoundSelections(selectionsInQuery);
    // TODO for simple payloads, I think pushing a clone of allSelections is good enough
    return createMergedCopy(allSelections);
  }
};

const tryComplexPayload = (mutationAST, operation, mutationResponseSchema, schema) => {
  let atLeastOne = false;

  // the payload itself isn't used, since it's just a shell for the many fields inside
  // technically, this could (should?) be recursive, but cashay enforces best practices
  // and putting an abstract inside an abstract is wrong
  const payloadFieldKeys = Object.keys(mutationResponseSchema.fields);

  for (let i = 0; i < payloadFieldKeys.length; i++) {
    const payloadFieldKey = payloadFieldKeys[i];
    const payloadField = mutationResponseSchema.fields[payloadFieldKey];
    const rootPayloadFieldType = ensureRootType(payloadField.type);

    // For scalars, make sure the names match (don't want a million strings in the mutation request)
    const matchName = rootPayloadFieldType.kind === SCALAR && payloadField.name;
    const selectionsInQuery = findTypeInQuery(rootPayloadFieldType.name, operation, schema, matchName);
    if (selectionsInQuery.length) {
      atLeastOne = true;
      const allSelections = matchName ? selectionsInQuery : flattenFoundSelections(selectionsInQuery);
      let mutationField;
      if (matchName) {
        mutationField = new Field({name: matchName});
      } else {
        const newSelections = createMergedCopy(allSelections);
        // make a payload field into a mutation field
        mutationField = new Field({name: payloadFieldKey, selections: newSelections});
      }
      mutationAST.definitions[0].selectionSet.selections[0].selectionSet.selections.push(mutationField);
    }
  }
  if (!atLeastOne) {
    throw new Error(`Could not generate a mutation from ${operation.selectionSet.selections[0].name.value}. 
    Verify that ${mutationResponseSchema.name} is correct and the schema is updated. 
    If it includes scalars, make sure those are aliased in the query.`)
  }
  return mutationAST;
};

const flattenFoundSelections = selectionsInQuery => {
  const allSelections = [];
  for (let i = 0; i < selectionsInQuery.length; i++) {
    const {selections} = selectionsInQuery[i].selectionSet;
    allSelections.push(...selections);
  }
  return allSelections;
};

const createMergedCopy = allSelections => {
  const firstSelection = allSelections.pop();
  if (!firstSelection) return;
  const targetSelections = [clone(firstSelection)];
  mergeSelections(targetSelections, allSelections);
  return targetSelections;
};
