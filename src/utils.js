import {TypeKind} from 'graphql/type/introspection';
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
  const mutationSchema = rootMutation.fields.find(field => field.name === mutationName);
  if (!mutationSchema) {
    throw new Error(`Invalid mutation: ${mutationName}.\nDid you make a typo?`);
  }
};

export const getRootOperation = (schema, operation) => {
  const operationString = `${operation}Type`;
  const operationName = schema[operationString].name;
  return schema.types.find(type => type.name === operationName);
}
