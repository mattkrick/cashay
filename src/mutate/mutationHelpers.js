
export const makeComponentsToUpdate = (mutationName, possibleComponentIds, denormalizedResults, mutationHandlers) => {
  const componentIds = [];
  // if there are no provided queries to update, try updating them all
  if (!possibleComponentIds) {
    const mutationHandlerObj = mutationHandlers[mutationName];
    const handlerComponents = Object.keys(mutationHandlerObj);
    for (let componentId of handlerComponents) {
      if (denormalizedResults[componentId]) {
        componentIds.push(componentId);
      }
    }
    // if only 1 component is provided, add it if the query is currently in use
  } else if (!Array.isArray(possibleComponentIds)) {
    if (denormalizedResults[possibleComponentIds]) {
      componentIds.push(possibleComponentIds);
    }
    // if a list of components is provided, only select those that have queries in use
  } else {
    for (let componentId of possibleComponentIds) {
      if (denormalizedResults[componentId]) {
        componentIds.push(componentId);
      }
    }
  }
  return componentIds.length && componentIds;
};

export const makeArgsAndDefs = (mutationFieldSchema, variables) => {
  const mutationArgs = [];
  const variableDefinitions = [];
  for (let schemaArg of mutationFieldSchema.args) {
    if (variables[schemaArg.name]) {
      const argType = ensureTypeFromNonNull(schemaArg.type);
      variableDefinitions.push(new VariableDefinition(argType.name, schemaArg.name));
      mutationArgs.push(new RequestArgument(schemaArg.name, VARIABLE, schemaArg.name));
    }
  }
  return {mutationArgs, variableDefinitions};
};
