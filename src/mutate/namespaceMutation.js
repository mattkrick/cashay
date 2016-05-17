import {ensureRootType, ensureTypeFromNonNull} from '../utils';
import {
  VARIABLE,
  FRAGMENT_SPREAD,
  INLINE_FRAGMENT
} from 'graphql/language/kinds';
import {clone, convertFragmentToInline} from '../utils';
import {teardownDocumentAST} from '../buildExecutionContext';
import {Name, VariableDefinition} from '../helperClasses';

const makeNamespaceString = (componentId, name, delim = '_') => `'CASHAY'${delim}${componentId}${delim}${name}`;

export default (mutationAST, componentId, state, schema) => {
  const variableEnhancers = [];
  const {operation, fragments} = teardownDocumentAST(mutationAST);
  const variableDefinitions = operation.variableDefinitions || [];
  const mainMutation = operation.selectionSet.selections[0];
  const fieldSchema = schema.mutationSchema.fields.find(field => field.name === mainMutation.name.value);
  bagArgs(variableDefinitions, mainMutation.arguments, fieldSchema);
  const context = {
    variableDefinitions,
    state,
    componentId,
    fragments,
    schema,
    variableEnhancers
  };
  const rootSchemaType = ensureRootType(fieldSchema.type);
  const subSchema = schema.types.find(type => type.name === rootSchemaType.name);
  namespaceAndInlineFrags(mainMutation.selectionSet.selections, subSchema, context);
  return {operation, variableEnhancers}
};

const namespaceAndInlineFrags = (fieldSelections, typeSchema, context) => {
  for (let i = 0; i < fieldSelections.length; i++) {
    let selection = fieldSelections[i];
    if (selection.kind === FRAGMENT_SPREAD) {
      const fragment = clone(context.fragments[selection.name.value]);
      fieldSelections[i] = selection = convertFragmentToInline(fragment);
    }
    if (selection.kind === INLINE_FRAGMENT) {
      return namespaceAndInlineFrags(selection, typeSchema, context);
    }
    const fieldSchema = typeSchema.fields.find(field => field.name === selection.name.value);
    if (selection.arguments && selection.arguments.length) {
      namespaceArgs(selection, fieldSchema, context);
    } else {
      // guarantee that props without args are also without aliases
      // that way, we can share fields across mutations & not make the server repeat the same action twice
      selection.alias = null;
    }
    if (selection.selectionSet) {
      const fieldType = ensureRootType(fieldSchema.type);
      typeSchema = context.schema.types.find(type => type.name === fieldType.name);
      namespaceAndInlineFrags(selection, typeSchema, context);
    }
  }
};

const enhancerFactory = (state, componentId, variableName, namespacedKey) => {
  return variablesObj => {
    return {
      ...variablesObj,
      [namespacedKey]: state.variables[componentId][variableName]
    }
  }
};

const bagArgs = (bag, argsToDefine, fieldSchema) => {
  for (let arg of argsToDefine) {
    if (arg.value.kind === VARIABLE) {
      const variableDefName = arg.value.name.value;
      const variableDefOfArg = bag.find(def => def.variable.name.value === variableDefName);
      if (!variableDefOfArg) {
        const newVariableDef = makeVariableDefinition(variableDefName, fieldSchema);
        bag.push(newVariableDef);
      }
    }
  }
};

const makeVariableDefinition = (argName, fieldSchema) => {
  const argSchema = fieldSchema.args.find(schemaArg => schemaArg.name === argName);
  if (!argSchema) {
    throw new Error(`Invalid mutation argument: ${argName}`);
  }
  return new VariableDefinition(argName, argSchema.type);
};

const namespaceArgs = (selection, fieldSchema, context) => {
  const {state, variableEnhancers, variableDefinitions, componentId} = context;
  const aliasOrFieldName = selection.alias && selection.alias.value || selection.name.value;
  const namespaceAlias = makeNamespaceString(componentId, aliasOrFieldName);
  selection.alias = new Name(namespaceAlias);
  for (let arg of selection.arguments) {
    if (arg.value.kind !== VARIABLE) continue;
    const argName = arg.name.value;
    const namespaceKey = makeNamespaceString(componentId, argName);
    const variableEnhancer = enhancerFactory(state, componentId, argName, namespaceKey);
    variableEnhancers.push(variableEnhancer);
    const argSchema = fieldSchema.args.find(schemaArg => schemaArg.name === argName);
    const argType = ensureTypeFromNonNull(argSchema.type);
    const variableDefinition = new VariableDefinition(namespaceKey, argType);
    variableDefinitions.push(variableDefinition);
  }
};
