import {ensureRootType, ensureTypeFromNonNull} from '../utils';
import {
  NAME,
  VARIABLE,
  VARIABLE_DEFINITION,
  NAMED_TYPE,
  OBJECT,
  FRAGMENT_SPREAD,
  INLINE_FRAGMENT
} from 'graphql/language/kinds';
import {clone, convertFragmentToInline} from '../utils';
import {parse} from '../utils';
import {print} from 'graphql/language/printer';
import {teardownDocumentAST} from '../buildExecutionContext';
import {InlineFragment, Name, VariableDefinition} from '../helperClasses';

const ALIAS_PREFIX = 'CASHAY';

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
  const mergedAST = clone(cachedSingles[startingComponentId]);
  const {operation, fragments} = teardownDocumentAST(mergedAST);
  // TODO
  const variableDefinitionBag = operation.variableDefinitions || [];
  const mutationSelection = operation.selectionSet.selections[0];
  const fieldSchema = schema.mutationSchema.fields.find(field => field.name === mutationSelection.name.value);
  bagArgs(variableDefinitionBag, mutationSelection.arguments, fieldSchema);
  // now add the new ASTs one-by-one

  for (let componentId of cachedSinglesComponentIds) {
    const nextAST = cachedSingles[componentId];
    mergeNewAST(operation, fragments, nextAST, componentId, variableDefinitionBag, fieldSchema, schema);
  }
  return print(mergedAST);
};

const mergeNewAST = (target, targetFragments, nextAST, srcComponentId, bag, fieldSchema, schema) => {
  const targetMutationSelections = target.selectionSet.selections;
  const targetMutationSelection = targetMutationSelections[0];
  const {operation, fragments} = teardownDocumentAST(nextAST);
  const srcMutationSelection = operation.selectionSet.selections[0];
  if (srcMutationSelection.name.value !== targetMutationSelection.name.value) {
    throw new Error(`Cannot merge two different mutations: 
    ${srcMutationSelection.name.value} and ${targetMutationSelection.name.value}.
    Did you include the wrong componentId in the mutation call?
    Make sure each mutation operation only calls a single mutation 
    and that customMutations are correct.`)
  }
  // aliasAndInlineFrags(srcMutationSelection.selectionSet.selections); already done in a previous step
  // mutates targetMutationSelection.arguments
  mergeMutationArgs(targetMutationSelection.arguments, srcMutationSelection.arguments);
  bagArgs(bag, srcMutationSelection.arguments, fieldSchema);
  const rootSchemaType = ensureRootType(fieldSchema.type);
  const subSchema = schema.types.find(type => type.name === rootSchemaType.name);
  const context = {
    bag,
    srcComponentId,
    schema,
    targetFragments,
    srcFragments: fragments,
    initialRun: true
  };
  const targetSelections = targetMutationSelection.selectionSet.selections;
  mergeSelections2(targetSelections, srcMutationSelection, subSchema, context);
  // mergeSelections(targetMutationSelections, 0, srcMutationSelection, subSchema, context)
};


const mergeSelections2 = (target, src, fieldSchema, context) => {
  for (let selection of src.selectionSet.selections) {
    mergeSingleProp(target, selection, fieldSchema, context)
  }
};

const mergeSingleProp = (target, srcProp, fieldSchema, context) => {
  if (srcProp.kind === INLINE_FRAGMENT) {
    if (srcProp.typeCondition === null) {
      mergeSelections2(target, srcProp, fieldSchema, context);
    } else {
      const srcPropFragType = srcProp.typeCondition.name.value;
      let targetFragment = target.find(field => field.kind === INLINE_FRAGMENT && field.typeCondition.name.value === srcPropFragType);
      if (!targetFragment) {
        targetFragment = new InlineFragment(srcPropFragType);
        target.push(targetFragment);
      }
      mergeSelections2(targetFragment, srcProp, fieldSchema, context);
    }
    return;
  }
  const alias = srcProp.alias && srcProp.alias.name; 
  if (alias) {
    // TODO bag Args
    const [prefix, field, component] = alias.split('_');
    const searchString = `${prefix}_${field}`;
    const matchingTargetProp = findSrcInTarget(srcProp, searchString, target);
    if (matchingTargetProp) {
      matchingTargetProp.alias += `_${component}`;
    } else {
      
      target.selectionSet.selections.push(srcProp)
    }
  }
  const aliasOrFieldName = srcProp.alias && srcProp.alias.value || srcProp.name.value;
};

const findSrcInTarget = (srcProp, searchString, target) => {
  let targetFound;
  for (let targetProp of target.selectionSet.selections) {
    if (targetProp.kind === INLINE_FRAGMENT) {
      targetFound = findSrcInTarget(srcProp, searchString, targetProp);
      if (targetFound) return targetFound;
    } else {
      if (!targetProp.alias || !targetProp.alias.startsWith(searchString)) continue;
      const allArgsEqual = argsAreEqual(targetProp.arguments, srcProp.arguments);
      if (allArgsEqual) return targetProp;
    }
  }
};
const mergeSelections = (target, targetIdx, srcProp, fieldSchema, context) => {
  const targetProp = target[targetIdx];
  const {srcComponentId, bag, schema, initialRun} = context;
  // use an initialRun flag to ignore arg checking the parent mutation since we already merged args
  if (!initialRun && srcProp.arguments && srcProp.arguments.length) {
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
    // const targetSelections = targetProp.selectionSet.selections;
    const srcSelections = srcProp.selectionSet.selections;
    // go in reverse in case we need to push stuff to the target & keep the idx
    for (let i = srcSelections.length - 1; i >= 0; i--) {
      const srcSelection = srcSelections[i];
      if (srcSelection.kind === FRAGMENT_SPREAD) {
        const fragment = context.srcFragments[srcSelection.name.value];
        mergeSelections(target, targetIdx, fragment, fieldSchema, context);
        continue;
      }
      debugger
      // loop through each value in target Selection
      // if value is inline or frag, look through it's children
      // if value is found in 
      const nextTargetPropIdx = srcSelection.alias ? -1 : targetSelections.findIndex(targetSelection => {
        return !targetSelection.alias && targetSelection.name && targetSelection.name.value === srcSelection.name.value;
      });
      if (nextTargetPropIdx > -1) {
        const nextTargetPropVal = targetSelections[nextTargetPropIdx].name.value;
        const field = fieldSchema.fields.find(field => field.name === nextTargetPropVal);
        if (!field) debugger
        const rootFieldSchemaType = ensureRootType(field.type);
        const subSchema = schema.types.find(type => type.name === rootFieldSchemaType.name);
        mergeSelections(targetSelections, nextTargetPropIdx, srcSelection, subSchema, context);
      } else {
        const srcSelectionClone = clone(srcSelection);
        targetSelections.push(srcSelectionClone);
      }
    }
  }
};

const argsAreEqual = (targetArgs = [], srcArgs) => {
  if (srcArgs.length !== targetArgs.length) return false;
  for (let srcArg of srcArgs) {
    const targetArg = targetArgs.find(arg => arg.name.value === srcArg.name.value);
    if (targetArg) {
      if (targetArg.value.kind === OBJECT) {
        if (srcArg.value.kind === OBJECT) {
          const equalObj = argsAreEqual(targetArg.value.fields, srcArg.value.fields);
          if (!equalObj) return false;
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

/**
 * For the mutation itself, try to merge args
 * but for children of the mutation, don't
 */
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
