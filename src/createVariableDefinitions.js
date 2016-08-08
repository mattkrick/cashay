import {ensureRootType, makeNamespaceString} from './utils';
import {VARIABLE, OBJECT} from 'graphql/language/kinds';
import {VariableDefinition} from './helperClasses';

export default function createVariableDefinitions(argsToDefine, fieldSchema, isNamespaced, context) {
  const {initialVariableDefinitions, op, opStateVars, schema} = context;
  const variableDefinitions = [];
  const variableEnhancers = [];
  const bagArgs = (argsToDefine, fieldSchema) => {
    for (let i = 0; i < argsToDefine.length; i++) {
      const arg = argsToDefine[i];
      const argName = arg.name.value;
      const argKind = arg.value.kind;
      if (argKind === VARIABLE) {
        const variableName = arg.value.name.value;
        const variableDefOfArg = initialVariableDefinitions.find(def => def.variable.name.value === variableName);
        if (isNamespaced) {
          // namespace the variable definitions & create the enhancer for each
          const namespaceKey = makeNamespaceString(op, variableName);
          if (!variableDefOfArg) {
            const newVariableDef = makeVariableDefinition(argName, namespaceKey, fieldSchema);
            variableDefinitions.push(newVariableDef);
          }
          const variableEnhancer = enhancerFactory(opStateVars, variableName, namespaceKey);
          variableEnhancers.push(variableEnhancer);
        } else if (!variableDefOfArg) {
          const newVariableDef = makeVariableDefinition(argName, variableName, fieldSchema);
          variableDefinitions.push(newVariableDef);
        }
      } else if (argKind === OBJECT) {
        const argSchema = fieldSchema.args[argName];
        const rootArgType = ensureRootType(argSchema.type);
        const subSchema = schema.types[rootArgType.name];
        bagArgs(arg.value.fields, subSchema);
      }
    }
  };
  bagArgs(argsToDefine, fieldSchema);
  return {variableDefinitions, variableEnhancers};

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

const enhancerFactory = (opStateVars, variableName, namespaceKey) => {
  return variablesObj => {
    return {
      ...variablesObj,
      [namespaceKey]: opStateVars[variableName]
    }
  }
};
