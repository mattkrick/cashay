import {ensureRootType} from '../utils';
import {FRAGMENT_SPREAD, INLINE_FRAGMENT} from 'graphql/language/kinds';
import {clone, convertFragmentToInline, teardownDocumentAST, makeNamespaceString} from '../utils';
import {Name} from '../helperClasses';
import createVariableDefinitions from '../createVariableDefinitions';

export default function namespaceMutation(mutationAST, component, componentStateVars, schema) {
  const variableEnhancers = [];
  const {operation, fragments} = teardownDocumentAST(mutationAST);
  const variableDefinitions = [];
  const mainMutation = operation.selectionSet.selections[0];
  const fieldSchema = schema.mutationSchema.fields[mainMutation.name.value];
  const context = {
    variableDefinitions,
    componentStateVars,
    component,
    fragments,
    schema,
    variableEnhancers
  };
  createVariableDefinitions(mainMutation.arguments, fieldSchema, false, context);
  operation.variableDefinitions = variableDefinitions;
  const rootSchemaType = ensureRootType(fieldSchema.type);
  const subSchema = schema.types[rootSchemaType.name];
  if (mainMutation.selectionSet) {
    namespaceAndInlineFrags(mainMutation.selectionSet.selections, subSchema, context);
  }

  // just take the operation & leave behind the fragment spreads, since we inlined them
  mutationAST.definitions = [operation];
  return {namespaceAST: mutationAST, variableEnhancers}
};

const namespaceAndInlineFrags = (fieldSelections, typeSchema, context) => {
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
        namespaceAndInlineFrags(selection.selectionSet.selections, typeSchema, context);
      }
      continue;
    }
    const selectionName = selection.name.value;
    if (selectionName.startsWith('__')) continue;
    const fieldSchema = typeSchema.fields[selectionName];
    if (selection.arguments && selection.arguments.length) {
      const aliasOrFieldName = selection.alias && selection.alias.value || selection.name.value;
      const namespaceAlias = makeNamespaceString(context.component, aliasOrFieldName);
      selection.alias = new Name(namespaceAlias);
      createVariableDefinitions(selection.arguments, fieldSchema, true, context);
    } else {
      // guarantee that props without args are also without aliases
      // that way, we can share fields across mutations & not make the server repeat the same action twice
      selection.alias = null;
    }
    if (selection.selectionSet) {
      const fieldType = ensureRootType(fieldSchema.type);
      const subSchema = context.schema.types[fieldType.name];
      namespaceAndInlineFrags(selection.selectionSet.selections, subSchema, context);
    }
  }
};
