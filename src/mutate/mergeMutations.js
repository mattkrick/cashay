import {
  OBJECT,
  INLINE_FRAGMENT
} from 'graphql/language/kinds';
import {clone} from '../utils';
import {print} from 'graphql/language/printer';

export default function mergeMutations(cachedSingles) {
  const firstSingle = cachedSingles.pop();

  // deep copy to create the base AST (slow, but faster than a parse!)
  const mergedAST = clone(firstSingle);
  const mainOperation = mergedAST.definitions[0];
  const mainMutation = mainOperation.selectionSet.selections[0];
  
  // now add the new ASTs one-by-one
  for (let i = 0; i < cachedSingles.length; i++) {
    const single = cachedSingles[i];
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

/**
 * Mutates the targetSelections by adding srcSelections & excluding the duplicates
 */
export const mergeSelections = (targetSelections, srcSelections) => {
  for (let i = 0; i < srcSelections.length; i++) {
    const selection = srcSelections[i];
    mergeSingleProp(targetSelections, selection)
  }
};

const mergeSingleProp = (targetSelections, srcProp) => {
  if (srcProp.kind === INLINE_FRAGMENT) {
    // typeCondition is guaranteed to exist thanks to namespaceMutation
    const srcTypeCondition = srcProp.typeCondition.name.value;
    let targetFragment = targetSelections.find(field => field.kind === INLINE_FRAGMENT && field.typeCondition.name.value === srcTypeCondition);
    if (!targetFragment) {
      // by pushing a clone, we don't have to clone the srcProp beforehand, making for the smallest amount of cloning possible
      targetSelections.push(clone(srcProp));
    } else {
      mergeSelections(targetFragment.selectionSet.selections, srcProp.selectionSet.selections);
    }
    return;
  }
  if (srcProp.alias) {
    // alias infers args, which means we can't join anything
    targetSelections.push(clone(srcProp));
  } else {
    const propName = srcProp.name.value;
    const propInTarget = targetSelections.find(selection => !selection.alias && selection.name.value === propName);
    if (propInTarget) {
      if (propInTarget.selectionSet) {
        mergeSelections(propInTarget.selectionSet.selections, srcProp.selectionSet.selections)
      }
    } else {
      targetSelections.push(clone(srcProp));
    }
  }
};

/**
 * For the mutation itself, try to merge args
 * but for children of the mutation, don't
 */
const mergeMutationArgs = (targetArgs, srcArgs) => {
  for (let i = 0; i < srcArgs.length; i++) {
    const srcArg = srcArgs[i];
    const targetArg = targetArgs.find(arg => arg.name.value === srcArg.name.value);
    if (targetArg) {
      if (targetArg.value.kind === OBJECT) {
        if (srcArg.value.kind === OBJECT) {
          // handle input objects
          mergeMutationArgs(targetArg.value.fields, srcArg.value.fields);
        } else {
          throw new Error(`Conflicting kind for argument: ${targetArg.name.value}`)
        }
      } else if (targetArg.value.value !== srcArg.value.value) {
        throw new Error(`Conflicting values for argument: ${targetArg.name.value}`)
      }
    } else {
      targetArgs.push(clone(srcArg));
    }
  }
};
