import {ensureRootType} from '../utils';
import {FRAGMENT_SPREAD, INLINE_FRAGMENT} from 'graphql/language/kinds';
import {clone, convertFragmentToInline, teardownDocumentAST, makeNamespaceString} from '../utils';
import {Name} from '../helperClasses';
import createVariableDefinitions from '../createVariableDefinitions';

export default function namespaceMutation(mutationAST, op, opStateVars = {}, schema) {
  const {operation, fragments} = teardownDocumentAST(mutationAST.definitions);
  const mainMutation = operation.selectionSet.selections[0];
  const fieldSchema = schema.mutationSchema.fields[mainMutation.name.value];
  const startingContext = {op, opStateVars, schema, fragments, initialVariableDefinitions: []};
  // query-level fields are joined, not namespaced, so we have to treat them differently
  const {variableDefinitions: initialVariableDefinitions, variableEnhancers} =
    createVariableDefinitions(mainMutation.arguments, fieldSchema, false, startingContext);
  const context = {...startingContext, fragments, initialVariableDefinitions};
  operation.variableDefinitions = initialVariableDefinitions;
  const rootSchemaType = ensureRootType(fieldSchema.type);
  const subSchema = schema.types[rootSchemaType.name];
  if (mainMutation.selectionSet) {
    // MUTATES SELECTIONS, CONTEXT VARIABLE DEFS, AND VARIABLE ENHANCERS. AND IT'S REALLY HARD TO MAKE IT FUNCTIONAL & PERFORMANT
    namespaceAndInlineFrags(mainMutation.selectionSet.selections, subSchema, variableEnhancers, context);
  }

  // just take the operation & leave behind the fragment spreads, since we inlined them
  mutationAST.definitions = [operation];
  return {namespaceAST: mutationAST, variableEnhancers}
};

const namespaceAndInlineFrags = (fieldSelections, typeSchema, variableEnhancers, context) => {
  for (let i = 0; i < fieldSelections.length; i++) {
    let selection = fieldSelections[i];
    if (selection.kind === FRAGMENT_SPREAD) {
      const fragment = clone(context.fragments[selection.name.value]);
      fieldSelections[i] = selection = convertFragmentToInline(fragment);
    }
    if (selection.kind === INLINE_FRAGMENT) {
      // if the fragment is unnecessary, remove it
      if (selection.typeCondition === null) {
        fieldSelections.push(...selection.selectionSet.selections);
        // since we're pushing to the looped array, going in reverse won't save us from not having to change i
        fieldSelections.splice(i--, 1);
      } else {
        namespaceAndInlineFrags(selection.selectionSet.selections, typeSchema, variableEnhancers, context);
      }
      continue;
    }
    const selectionName = selection.name.value;
    if (selectionName.startsWith('__')) continue;
    const fieldSchema = typeSchema.fields[selectionName];
    if (selection.arguments && selection.arguments.length) {
      const aliasOrFieldName = selection.alias && selection.alias.value || selection.name.value;
      const namespaceAlias = makeNamespaceString(context.op, aliasOrFieldName);
      selection.alias = new Name(namespaceAlias);
      const mutations = createVariableDefinitions(selection.arguments, fieldSchema, true, context);
      context.initialVariableDefinitions.push(...mutations.variableDefinitions);
      variableEnhancers.push(...mutations.variableEnhancers);
    } else {
      // guarantee that props without args are also without aliases
      // that way, we can share fields across mutations & not make the server repeat the same action twice
      selection.alias = null;
    }
    if (selection.selectionSet) {
      const fieldType = ensureRootType(fieldSchema.type);
      const subSchema = context.schema.types[fieldType.name];
      namespaceAndInlineFrags(selection.selectionSet.selections, subSchema, variableEnhancers, context);
    }
  }
};
