import {ensureRootType} from '../utils';
import {
  VARIABLE,
  FRAGMENT_SPREAD,
  INLINE_FRAGMENT,
  OBJECT
} from 'graphql/language/kinds';
import {clone, convertFragmentToInline} from '../utils';
import {teardownDocumentAST} from '../buildExecutionContext';
import {Name, VariableDefinition} from '../helperClasses';

const makeNamespaceString = (componentId, name, delim = '_') => `CASHAY${delim}${componentId}${delim}${name}`;

export default (namespaceAST, componentId, stateVars, schema) => {
  const variableEnhancers = [];
  const {operation, fragments} = teardownDocumentAST(namespaceAST);
  const variableDefinitions = operation.variableDefinitions || [];
  const mainMutation = operation.selectionSet.selections[0];
  const fieldSchema = schema.mutationSchema.fields[mainMutation.name.value];
  const context = {
    variableDefinitions,
    stateVars,
    componentId,
    fragments,
    schema,
    variableEnhancers
  };
  bagArgs(mainMutation.arguments, fieldSchema, true, context);
  const rootSchemaType = ensureRootType(fieldSchema.type);
  const subSchema = schema.types[rootSchemaType.name];
  namespaceAndInlineFrags(mainMutation.selectionSet.selections, subSchema, context);
  namespaceAST.definitions = [operation];
  return {namespaceAST, variableEnhancers}
};

const namespaceAndInlineFrags = (fieldSelections, typeSchema, context) => {
  // let fieldSelectionLen = fieldSelections.length;
  for (let i = 0; i < fieldSelections.length; i++) {
    let selection = fieldSelections[i];
    if (selection.kind === FRAGMENT_SPREAD) {
      const fragment = clone(context.fragments[selection.name.value]);
      fieldSelections[i] = selection = convertFragmentToInline(fragment);
    }
    if (selection.kind === INLINE_FRAGMENT) {
      debugger
      // if the fragment is unnecessary, remove it
      if (selection.typeCondition === null) {
        fieldSelections.push(...selection.selectionSet.selections);
        fieldSelections.splice(i--,1);
        
        // fieldSelectionLen += selection.selectionSet.selections.length;
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
      const namespaceAlias = makeNamespaceString(context.componentId, aliasOrFieldName);
      selection.alias = new Name(namespaceAlias);
      bagArgs(selection.arguments, fieldSchema, false, context);
    } else {
      // guarantee that props without args are also without aliases
      // that way, we can share fields across mutations & not make the server repeat the same action twice
      selection.alias = null;
    }
    if (selection.selectionSet) {
      const fieldType = ensureRootType(fieldSchema.type);
      typeSchema = context.schema.types[fieldType.name];
      namespaceAndInlineFrags(selection.selectionSet.selections, typeSchema, context);
    }
  }
};

const enhancerFactory = (stateVars, componentId, variableName, namespaceKey) => {
  return variablesObj => {
    return {
      ...variablesObj,
      [namespaceKey]: stateVars[componentId][variableName]
    }
  }
};

const bagArgs = (argsToDefine, fieldSchema, isMain, context) => {
  const {variableDefinitions, componentId} = context;
  for (let arg of argsToDefine) {
    const argName = arg.name.value;
    if (arg.value.kind === VARIABLE) {
      const variableName = arg.value.name.value;
      const namespaceKey = makeNamespaceString(componentId, variableName);
      const variableDefOfArg = variableDefinitions.find(def => def.variable.name.value === variableName);
      if (!variableDefOfArg) {
        const varDefKey = isMain ? variableName : namespaceKey;
        const newVariableDef = makeVariableDefinition(argName, varDefKey, fieldSchema);
        variableDefinitions.push(newVariableDef);
      }
      if (!isMain) {
        const {stateVars, variableEnhancers} = context;
        const variableEnhancer = enhancerFactory(stateVars, componentId, variableName, namespaceKey);
        variableEnhancers.push(variableEnhancer);
      }
    } else if (arg.value.kind === OBJECT) {
      const argSchema = fieldSchema.args[argName];
      const rootArgType = ensureRootType(argSchema.type);
      const subSchema = context.schema.types[rootArgType.name];
      bagArgs(arg.value.fields, subSchema, isMain, context);
    }
  }
};

const makeVariableDefinition = (argName, variableName, fieldSchema) => {
  // we're not sure whether we're inside an arg or an input object
  const fields = fieldSchema.args || fieldSchema.inputFields;
  const argSchema = fields[argName];
  if (!argSchema) {
    throw new Error(`Invalid mutation argument: ${argName}`);
  }
  return new VariableDefinition(variableName, argSchema.type);
};
