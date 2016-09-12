import {INLINE_FRAGMENT} from 'graphql/language/kinds';

export const getSubReqAST = (key, reqAST, unionType) => {
  let subReqAST;
  const fields = reqAST.selectionSet.selections;
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    if (field.kind === INLINE_FRAGMENT) {
      if (field.typeCondition.name.value !== unionType) continue;
      subReqAST = getSubReqAST(key, field);
    } else {
      const aliasOrFieldName = field.alias && field.alias.value || field.name.value;
      if (aliasOrFieldName === key) {
        subReqAST = field;
      }
    }
    if (subReqAST) {
      return subReqAST;
    }
  }
  throw new Error(`${key} was found in the query response, but not the request.
    Did you optimistically add more fields than you originally requested?`)
};
