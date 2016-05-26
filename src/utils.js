import {INLINE_FRAGMENT, OPERATION_DEFINITION, FRAGMENT_DEFINITION} from 'graphql/language/kinds';
import {TypeKind} from 'graphql/type/introspection';
import {parse as gqlParse} from 'graphql/language/parser';

const {NON_NULL, LIST} = TypeKind;

export const TYPENAME = '__typename';
export const CASHAY = 'CASHAY';
export const DELIMITER = '_';

export const ensureTypeFromNonNull = type => type.kind === NON_NULL ? type.ofType : type;
// const ensureTypeFromList = type => type.kind === LIST ? ensureTypeFromNonNull(type.ofType) : type;

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
    throw new Error(`Invalid mutation: ${mutationName}.
    Did you make a typo or forget to update your schema?`);
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

export const equalObjectKeys = (obj1, obj2) => {
  const obj1Keys = Object.keys(obj1);
  const obj2Keys = Object.keys(obj2);
  if (obj1Keys.length !== obj2Keys.length) return false;
  for (let val of obj1Keys) {
    if (obj1[val] !== obj2[val]) return false
  }
  return true;
};

export const buildExecutionContext = (queryAST, {cashayDataState, variables, paginationWords, idFieldName, schema}) => {
  const clonedAST = clone(queryAST);
  const {operation, fragments} = teardownDocumentAST(clonedAST);
  return {
    cashayDataState,
    operation,
    fragments,
    variables,
    paginationWords,
    idFieldName,
    schema
  };
};

export const teardownDocumentAST = queryAST => {
  let operation;
  const fragments = queryAST.definitions.reduce((reduction, definition) => {
    if (definition.kind === OPERATION_DEFINITION) {
      if (operation) {
        throw new Error('Multiple operations not supported');
      }
      operation = definition;
    } else if (definition.kind === FRAGMENT_DEFINITION) {
      reduction[definition.name.value] = definition;
    }
    return reduction;
  }, {});
  if (!operation) {
    throw new Error('Must provide an operation.');
  }
  return {operation, fragments};
};
