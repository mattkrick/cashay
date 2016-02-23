import {TypeKind} from 'graphql/type/introspection';
const {NON_NULL} = TypeKind;

export const getNestedSchema = (obj, stack) => {
  return stack.reduce((reduction, level) => {
    const nextLevel = reduction[level];
    return nextLevel.getItemSchema ? nextLevel.getItemSchema() : nextLevel;
  }, obj);
};

export const ensureTypeFromNonNull = type => type.kind === NON_NULL ? type.ofType : type;

//const ensureTypeFromList = type => type.kind === LIST ? ensureTypeFromNonNull(type.ofType) : type;
export const ensureRootType = type => {
  while (type.ofType) type = type.ofType;
  return type;
};

export const getRegularArgsKey = regularArgs => {
  return regularArgs && (Object.keys(regularArgs).length ? JSON.stringify(regularArgs) : '');
};
