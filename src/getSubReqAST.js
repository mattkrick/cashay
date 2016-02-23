import {FRAGMENT_SPREAD, INLINE_FRAGMENT} from 'graphql/language/kinds';

export const getSubReqAST = (key, reqAST, fragments) => {
  let subReqAST;
  for (let i = 0; i < reqAST.selectionSet.selections.length; i++) {
    const selection = reqAST.selectionSet.selections[i];
    if (selection.kind === FRAGMENT_SPREAD) {
      subReqAST = getSubReqAST(key, fragments[selection.name.value], fragments);
    } else if (selection.kind === INLINE_FRAGMENT) {
      subReqAST = getSubReqAST(key, selection, fragments);
      if (subReqAST) return subReqAST;
    } else if (selection.alias && selection.alias.value === key || selection.name.value === key) {
      subReqAST = selection;
    }
    if (subReqAST) {
      return subReqAST;
    }
  }
};
