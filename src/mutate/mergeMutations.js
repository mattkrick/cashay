import {ensureRootType} from '../utils';
import {
  NAME,
  VARIABLE,
  VARIABLE_DEFINITION,
  NAMED_TYPE,
  OBJECT
} from 'graphql/language/kinds';
import {parse} from 'graphql/language/parser';
import {print} from 'graphql/language/printer';

export const createMutationString = function(mutationName, componentIdsToUpdate) {
  const cachedMutationObj = this._cachedMutations[mutationName];
  // const cachedSingles = cachedMutationObj.singles;

  // return quickly without needing to save to cache for single components
  if (componentIdsToUpdate.length === 1) {
    return cachedMutationObj.singles[componentIdsToUpdate[0]];
  }

  // if the components we want are the ones we cached, grab the mutation string from the cache
  const cachedMutationString = getCachedMutationString(cachedMutationObj, componentIdsToUpdate);
  if (cachedMutationString) {
    return cachedMutationString;
  }

  // do the super expensive AST parse and merge
  const fullMutation = mergeMutationASTs(cachedMutationObj.singles, this._schema);
  Object.assign(cachedMutationObj, {
    fullMutation,
    setKey: new Set([componentIdsToUpdate])
  });
  return fullMutation;
};

const getCachedMutationString = (cachedMutationObj, componentIdsToUpdate) => {
  if (cachedMutationObj && cachedMutationObj.setKey.size === componentIdsToUpdate.length) {
    for (let componentId of componentIdsToUpdate) {
      if (!cachedMutationObj.setKey.has(componentId)) {
        return
      }
    }
    return cachedMutationObj.fullMutation;
  }
};

export const mergeMutationASTs = (cachedSingles, schema) => {
  const cachedSinglesComponentIds = Object.keys(cachedSingles);
  const startingComponentId = cachedSinglesComponentIds.pop();
  // deep copy to create the base AST (slow, but faster than a parse!)
  const mergedAST = JSON.parse(JSON.stringify(cachedSingles[startingComponentId]));
  const operationDefinition = mergedAST.definitions[0];
  const variableDefinitionBag = operationDefinition.variableDefinitions || [];
  const mutationSelection = operationDefinition.selectionSet.selections[0];
  const fieldSchema = schema.mutationSchema.fields.find(field => field.name === mutationSelection.name.value);
  bagArgs(variableDefinitionBag, mutationSelection.arguments, fieldSchema);
  // now add the new ASTs one-by-one
  for (let componentId of cachedSinglesComponentIds) {
    const nextAST = cachedSingles[componentId];
    mergeNewAST(mergedAST, nextAST, componentId, variableDefinitionBag, fieldSchema, schema);
  }
  return print(mergedAST);
};

const mergeNewAST = (target, src, srcComponentId, bag, fieldSchema, schema) => {
  const targetMutationSelections = target.definitions[0].selectionSet.selections;
  const targetMutationSelection = targetMutationSelections[0];
  const srcMutationSelection = src.definitions[0].selectionSet.selections[0];
  if (srcMutationSelection.name.value !== targetMutationSelection.name.value) {
    throw new Error(`Cannot merge two different mutations: 
    ${srcMutationSelection.name.value} and ${targetMutationSelection.name.value}.
    Did you include the wrong componentId in the mutation call?
    Make sure each mutation operation only calls a single mutation 
    and that customMutations are correct.`)
  }
  // mutates targetMutationSelection.arguments
  mergeMutationArgs(targetMutationSelection.arguments, srcMutationSelection.arguments);
  bagArgs(bag, srcMutationSelection.arguments, fieldSchema);
  const rootSchemaType = ensureRootType(fieldSchema.type);
  const subSchema = schema.types.find(type => type.name === rootSchemaType.name);
  const context = {
    bag,
    srcComponentId,
    schema,
    initialRun: true
  };
  mergeSelections(targetMutationSelections, 0, srcMutationSelection, subSchema, context)
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

const mergeSelections = (target, targetIdx, srcProp, fieldSchema, context) => {
  const targetProp = target[targetIdx];
  const {srcComponentId, bag, schema, initialRun} = context;
  // use an initialRun flag to ignore arg checking the parent mutation since we already merged args
  if (srcProp.arguments.length && !initialRun) {
    debugger
    bagArgs(bag, srcProp.arguments, fieldSchema);
    const allArgsEqual = argsAreEqual(targetProp.arguments, srcProp.arguments);
    if (allArgsEqual) {
      // if targetProp has args, we're guaranteed it has an alias in the form of cashay_fieldName_componentId1...
      targetProp.alias.value += `_${srcComponentId}`;
    } else {
      const aliasOrFieldName = srcProp.alias && srcProp.alias.value || srcProp.name.value;
      // don't mutate the srcAST when giving it a cashay custom alias
      // this prop will overwrite the targetProp when passed to the componentId's mutationHandler
      const aliasedSrcProp = Object.assign({}, srcProp, {
        alias: {
          value: `cashay_${aliasOrFieldName}_${srcComponentId}`,
          kind: NAME
        }
      });
      target.push(aliasedSrcProp);
    }
  }
  context.initialRun = false;
  // if srcProp has a selectionSet, targetProp has it, too, guaranteed
  if (srcProp.selectionSet) {
    const targetSelections = targetProp.selectionSet.selections;
    const srcSelections = srcProp.selectionSet.selections;
    // go in reverse in case we need to push stuff to the target & keep the idx
    for (let i = srcSelections.length - 1; i >= 0; i--) {
      const srcSelection = srcSelections[i];
      const nextTargetPropIdx = srcSelection.alias ? -1 : targetSelections.findIndex(targetSelection => {
        return !targetSelection.alias && targetSelection.name.value === srcSelection.name.value;
      });
      if (nextTargetPropIdx > -1) {
        const nextTargetPropVal = targetSelections[nextTargetPropIdx].name.value;
        const field = fieldSchema.fields.find(field => field.name === nextTargetPropVal);
        const rootFieldSchemaType = ensureRootType(field.type);
        const subSchema = schema.types.find(type => type.name === rootFieldSchemaType.name);
        mergeSelections(targetSelections, nextTargetPropIdx, srcSelection, subSchema, context);
      } else {
        const srcSelectionClone = JSON.parse(JSON.stringify(srcSelection));
        targetSelections.push(srcSelectionClone);
      }
    }
  }
};

const makeVariableDefinition = (argName, fieldSchema) => {
  const argSchema = fieldSchema.args.find(schemaArg => schemaArg.name === argName);
  if (!argSchema) {
    throw new Error(`invalid argument: ${argName}`);
  }
  const argType = ensureRootType(argSchema.type);
  return {
    defaultValue: null,
    kind: VARIABLE_DEFINITION,
    type: {
      kind: NAMED_TYPE,
      name: {
        kind: NAME,
        value: argType.name
      }
    },
    variable: {
      kind: VARIABLE,
      name: {
        kind: NAME,
        value: argName
      }
    }
  }
};

const argsAreEqual = (targetArgs = [], srcArgs) => {
  for (let srcArg of srcArgs) {
    const targetArg = targetArgs.find(arg => arg.name.value === srcArg.name.value);
    if (targetArg) {
      if (targetArg.value.kind === OBJECT) {
        if (srcArg.value.kind === OBJECT) {
          mergeArgs(targetArg.value.fields, srcArg.value.fields);
        } else {
          return false;
        }
      } else if (targetArg.value.value !== srcArg.value.value) {
        return false;
      }
    } else {
      return false
    }
  }
  return true;
};

const mergeMutationArgs = (targetArgs, srcArgs) => {
  for (let srcArg of srcArgs) {
    const targetArg = targetArgs.find(arg => arg.name.value === srcArg.name.value);
    if (targetArg) {
      if (targetArg.value.kind === OBJECT) {
        if (srcArg.value.kind === OBJECT) {
          mergeMutationArgs(targetArg.value.fields, srcArg.value.fields);
        } else {
          throw new Error(`Conflicting kind for argument: ${targetArg.name.value}`)
        }
      } else if (targetArg.value.value !== srcArg.value.value) {
        throw new Error(`Conflicting values for argument: ${targetArg.name.value}`)
      }
    } else {
      targetArgs.push(srcArg);
    }
  }
};

export const parseAndAlias = (mutationString, componentId) => {
  const mutationAST = parse(mutationString, {noLocation: true, noSource: true});
  const astSelections = mutationAST.definitions[0].selectionSet.selections[0].selectionSet.selections;
  parseAndAliasRecurse(astSelections, componentId);
  return mutationAST
};

const parseAndAliasRecurse = (astSelections, componentId) => {
  for (let selection of astSelections) {
    if (selection.arguments && selection.arguments.length) {
      const aliasOrFieldName = selection.alias && selection.alias.value || selection.name.value;
      selection.alias = {
        kind: NAME,
        value: `cashay_${aliasOrFieldName}_${componentId}`
      }
    } else {
      // guarantee that props without args are also without aliases
      selection.alias = null;
    }
    if (selection.selectionSet) {
      parseAndAliasRecurse(selection.selectionSet.selections, componentId);
    }
  }
};
