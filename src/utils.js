import {INLINE_FRAGMENT, FRAGMENT_SPREAD} from 'graphql/language/kinds';
import {TypeKind} from 'graphql/type/introspection';
import {parse as gqlParse} from 'graphql/language/parser';
import {teardownDocumentAST} from './buildExecutionContext';

const {NON_NULL} = TypeKind;

export const ensureTypeFromNonNull = type => type.kind === NON_NULL ? type.ofType : type;

//const ensureTypeFromList = type => type.kind === LIST ? ensureTypeFromNonNull(type.ofType) : type;
export const ensureRootType = type => {
  while (type.ofType) type = type.ofType;
  return type;
};

export const getRegularArgsKey = regularArgs => {
  return regularArgs && (Object.keys(regularArgs).length ? JSON.stringify(regularArgs) : '');
};

export const isObject = val => val && typeof val === 'object';

export const clone = obj => JSON.parse(JSON.stringify(obj));

export const checkMutationInSchema = (rootMutation, mutationName) => {
  const mutationSchema = rootMutation.fields[mutationName];
  if (!mutationSchema) {
    throw new Error(`Invalid mutation: ${mutationName}.\nDid you make a typo?`);
  }
};

export const convertFragmentToInline = fragment => {
  delete fragment.name;
  fragment.kind = INLINE_FRAGMENT;
  return fragment;
};

export const parse = graphQLString => gqlParse(graphQLString, {noLocation: true, noSource: true});

export const arraysShallowEqual = (arr1, arr2) => {
  if (arr1.length !== arr2.length) return false;
  const set2 = new Set(arr2);
  for (let val of arr1) {
    if (!set2.has(val)) return false;
  }
  return true;
};

export const inlineAllFragments = (operationSelections, fragments) => {
  for (let i = 0; i < operationSelections.length; i++) {
    const selection = operationSelections[i];
    if (selection.kind === FRAGMENT_SPREAD) {
      const fragment = clone(fragments[selection.name.value]);
      operationSelections[i] = convertFragmentToInline(fragment);
    }
    if (selection.selectionSet) {
      inlineAllFragments(selection.selectionSet.selections, fragments);
    }
  }
};

export const parseAndInline = queryString => {
  const ast = parse(queryString);
  const {operation, fragments} = teardownDocumentAST(ast);
  inlineAllFragments(operation.selectionSet.selections, fragments);
  // TODO also need to add "id" and "__typename" and sort all args
  ast.definitions = [operation];
  return ast;
}
