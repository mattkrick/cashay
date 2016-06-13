import {ensureRootType, makeNamespaceString} from './utils';
import {VARIABLE, OBJECT} from 'graphql/language/kinds';
import {VariableDefinition} from './helperClasses';

export default function createVariableDefinitions(argsToDefine, fieldSchema, isNamespaced, context) {
  const bagArgs = (argsToDefine, fieldSchema) => {
    const {component, variableDefinitions} = context;
    for (let i = 0; i < argsToDefine.length; i++) {
      const arg = argsToDefine[i];
      const argName = arg.name.value;
      const argKind = arg.value.kind;
      if (argKind === VARIABLE) {
        const variableName = arg.value.name.value;
        const variableDefOfArg = variableDefinitions.find(def => def.variable.name.value === variableName);
        if (!isNamespaced) {
          if (!variableDefOfArg) {
            const newVariableDef = makeVariableDefinition(argName, variableName, fieldSchema);
            variableDefinitions.push(newVariableDef);
          }
        } else {
          // namespace the variable definitions & create the enhancer for each
          const namespaceKey = makeNamespaceString(component, variableName);
          if (!variableDefOfArg) {
            const newVariableDef = makeVariableDefinition(argName, namespaceKey, fieldSchema);
            variableDefinitions.push(newVariableDef);
          }
          const {componentStateVars, variableEnhancers} = context;
          const variableEnhancer = enhancerFactory(componentStateVars, variableName, namespaceKey);
          variableEnhancers.push(variableEnhancer);
        }
      } else if (argKind === OBJECT) {
        const argSchema = fieldSchema.args[argName];
        const rootArgType = ensureRootType(argSchema.type);
        const subSchema = context.schema.types[rootArgType.name];
        bagArgs(arg.value.fields, subSchema);
      }
    }
  };
  bagArgs(argsToDefine, fieldSchema);

};

const makeVariableDefinition = (argName, variableName, fieldSchema) => {
  // we're not sure whether we're inside an arg or an input object
  const fields = fieldSchema.args || fieldSchema.inputFields;
  const argSchema = fields[argName];
  if (!argSchema) {
    throw new Error(`Invalid argument: ${argName}`);
  }
  return new VariableDefinition(variableName, argSchema.type);
};

const enhancerFactory = (componentStateVars, variableName, namespaceKey) => {
  return variablesObj => {
    return {
      ...variablesObj,
      [namespaceKey]: componentStateVars[variableName]
    }
  }
};
