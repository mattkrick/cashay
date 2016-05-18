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

// export const createMutationString = function(mutationName, componentIdsToUpdate) {
//   const cachedMutationObj = this._cachedMutations[mutationName];
//   // const cachedSingles = cachedMutationObj.singles;
//
//   // return quickly without needing to save to cache for single components
//   if (componentIdsToUpdate.length === 1) {
//     return cachedMutationObj.singles[componentIdsToUpdate[0]];
//   }
//
//   // if the components we want are the ones we cached, grab the mutation string from the cache
//   const cachedMutationString = getCachedMutationString(cachedMutationObj, componentIdsToUpdate);
//   if (cachedMutationString) {
//     return cachedMutationString;
//   }
//
//   // do the super expensive AST parse and merge
//   const fullMutation = mergeMutationASTs(cachedMutationObj.singles, this._schema);
//   Object.assign(cachedMutationObj, {
//     fullMutation,
//     setKey: new Set([componentIdsToUpdate])
//   });
//   return fullMutation;
// };
//
// const getCachedMutationString = (cachedMutationObj, componentIdsToUpdate) => {
//   if (cachedMutationObj && cachedMutationObj.setKey.size === componentIdsToUpdate.length) {
//     for (let componentId of componentIdsToUpdate) {
//       if (!cachedMutationObj.setKey.has(componentId)) {
//         return
//       }
//     }
//     return cachedMutationObj.fullMutation;
//   }
// };

export default (cachedSingles) => {
  const firstSingle = cachedSingles.pop();
  // deep copy to create the base AST (slow, but faster than a parse!)
  const mergedAST = clone(firstSingle);
  const mainOperation = mergedAST.definitions[0];
  const mainMutation = mainOperation.selectionSet.selections[0];
  // now add the new ASTs one-by-one
  for (let single of cachedSingles) {
    const nextOperation = single.definitions[0];
    const nextMutation = nextOperation.selectionSet.selections[0];
    mergeVariableDefinitions(mainOperation.variableDefinitions, nextOperation.variableDefinitions);
    mergeNewAST(mainMutation, nextMutation);
  }
  return print(mergedAST);
};

const mergeVariableDefinitions = (mainVarDefs, nextVarDefs) => {
  for (let varDef of nextVarDefs) {
    const nextName = varDef.variable.name.value;
    const varDefInMain = mainVarDefs.find(def => def.variable.name.value === nextName);
    if (!varDefInMain) {
      mainVarDefs.push(varDef);
    }
  }
};

const mergeNewAST = (target, src) => {
  if (target.name.value !== src.name.value) {
    throw new Error(`Cannot merge two different mutations: 
    ${target.name.value} and ${src.name.value}.
    Did you include the wrong componentId in the mutation call?
    Make sure each mutation operation only calls a single mutation 
    and that customMutations are correct.`)
  }
  mergeMutationArgs(target.arguments, src.arguments);
  mergeSelections(target.selectionSet.selections, src.selectionSet.selections);
};


const mergeSelections = (targetSelections, srcSelections) => {
  for (let selection of srcSelections) {
    mergeSingleProp(targetSelections, selection)
  }
};

const mergeSingleProp = (targetSelections, srcProp) => {
  debugger
  if (srcProp.kind === INLINE_FRAGMENT) {
    if (srcProp.typeCondition === null) {
      mergeSelections(targetSelections, srcProp);
    } else {
      const srcTypeCondition = srcProp.typeCondition.name.value;
      let targetFragment = targetSelections.find(field => field.kind === INLINE_FRAGMENT && field.typeCondition.name.value === srcTypeCondition);
      if (!targetFragment) {
        targetSelections.push(srcProp);
      } else {
        mergeSingleProp(targetFragment.selectionSet.selections, srcProp);
      }
    }
    return;
  }
  if (srcProp.alias) {
    // alias means args, which means we can't join anything
    targetSelections.push(srcProp);
  } else {
    const propName = srcProp.name.value;
    const propInTarget = targetSelections.find(selection => !selection.alias && selection.name.value === propName);
    if (propInTarget) {
      if (propInTarget.selectionSet) {
        mergeSelections(propInTarget.selectionSet.selections, srcProp.selectionSet.selections)
      }
    } else {
      targetSelections.push(srcProp);
    }
  }
};

// const findSrcInTarget = (srcPxrop, searchString, target) => {
//   let targetFound;
//   for (let targetProp of target.selectionSet.selections) {
//     if (targetProp.kind === INLINE_FRAGMENT) {
//       targetFound = findSrcInTarget(srcProp, searchString, targetProp);
//       if (targetFound) return targetFound;
//     } else {
//       if (!targetProp.alias || !targetProp.alias.startsWith(searchString)) continue;
//       const allArgsEqual = argsAreEqual(targetProp.arguments, srcProp.arguments);
//       if (allArgsEqual) return targetProp;
//     }
//   }
// };
// const mergeSelections = (target, targetIdx, srcProp, fieldSchema, context) => {
//   const targetProp = target[targetIdx];
//   const {srcComponentId, bag, schema, initialRun} = context;
//   // use an initialRun flag to ignore arg checking the parent mutation since we already merged args
//   if (!initialRun && srcProp.arguments && srcProp.arguments.length) {
//     bagArgs(bag, srcProp.arguments, fieldSchema);
//     const allArgsEqual = argsAreEqual(targetProp.arguments, srcProp.arguments);
//     if (allArgsEqual) {
//       // if targetProp has args, we're guaranteed it has an alias in the form of cashay_fieldName_componentId1...
//       targetProp.alias.value += `_${srcComponentId}`;
//     } else {
//       const aliasOrFieldName = srcProp.alias && srcProp.alias.value || srcProp.name.value;
//       // don't mutate the srcAST when giving it a cashay custom alias
//       // this prop will overwrite the targetProp when passed to the componentId's mutationHandler
//       const aliasedSrcProp = Object.assign({}, srcProp, {
//         alias: {
//           value: `cashay_${aliasOrFieldName}_${srcComponentId}`,
//           kind: NAME
//         }
//       });
//       target.push(aliasedSrcProp);
//     }
//   }
//   context.initialRun = false;
//   // if srcProp has a selectionSet, targetProp has it, too, guaranteed
//   if (srcProp.selectionSet) {
//     // const targetSelections = targetProp.selectionSet.selections;
//     const srcSelections = srcProp.selectionSet.selections;
//     // go in reverse in case we need to push stuff to the target & keep the idx
//     for (let i = srcSelections.length - 1; i >= 0; i--) {
//       const srcSelection = srcSelections[i];
//       if (srcSelection.kind === FRAGMENT_SPREAD) {
//         const fragment = context.srcFragments[srcSelection.name.value];
//         mergeSelections(target, targetIdx, fragment, fieldSchema, context);
//         continue;
//       }
//       debugger
//       // loop through each value in target Selection
//       // if value is inline or frag, look through it's children
//       // if value is found in
//       const nextTargetPropIdx = srcSelection.alias ? -1 : targetSelections.findIndex(targetSelection => {
//         return !targetSelection.alias && targetSelection.name && targetSelection.name.value === srcSelection.name.value;
//       });
//       if (nextTargetPropIdx > -1) {
//         const nextTargetPropVal = targetSelections[nextTargetPropIdx].name.value;
//         const field = fieldSchema.fields[nextTargetPropVal];
//         if (!field) debugger
//         const rootFieldSchemaType = ensureRootType(field.type);
//         const subSchema = schema.types[rootFieldSchemaType.name];
//         mergeSelections(targetSelections, nextTargetPropIdx, srcSelection, subSchema, context);
//       } else {
//         const srcSelectionClone = clone(srcSelection);
//         targetSelections.push(srcSelectionClone);
//       }
//     }
//   }
// };
//
// const argsAreEqual = (targetArgs = [], srcArgs) => {
//   if (srcArgs.length !== targetArgs.length) return false;
//   for (let srcArg of srcArgs) {
//     const targetArg = targetArgs.find(arg => arg.name.value === srcArg.name.value);
//     if (targetArg) {
//       if (targetArg.value.kind === OBJECT) {
//         if (srcArg.value.kind === OBJECT) {
//           const equalObj = argsAreEqual(targetArg.value.fields, srcArg.value.fields);
//           if (!equalObj) return false;
//         } else {
//           return false;
//         }
//       } else if (targetArg.value.value !== srcArg.value.value) {
//         return false;
//       }
//     } else {
//       return false
//     }
//   }
//   return true;
// };

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
