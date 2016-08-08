import {parse} from 'graphql/language/parser';
import {print} from 'graphql/language/printer';
import {teardownDocumentAST} from '../utils';
/**
 * This is a stupid little function that sorts fields by alias & then by name
 * That way, testing equality is easy
 */
export const parseSortPrint = graphQLString => {
  const ast = parse(graphQLString, {noLocation: true, noSource: true});
  return sortPrint(ast);
};

export const sortPrint = ast => {
  const {operation} = teardownDocumentAST(ast.definitions);
  recurse(operation.selectionSet.selections);
  return print(ast);
};

export const sortAST = ast => {
  const {operation} = teardownDocumentAST(ast.definitions);
  recurse(operation.selectionSet.selections);
  return ast;
};

const recurse = astSelections => {
  for (let selection of astSelections) {
    if (selection.selectionSet) {
      recurse(selection.selectionSet.selections);
    }
  }
  astSelections.sort(sortFields);
};

// if true, b moves forward
const sortFields = (a,b) => {
  if (a.alias) {
    if (b.alias) {
      // if both have aliases, sort them alphabetically
      return a.alias.value > b.alias.value
    }
    // if a has an alias, put it ahead of b
    return false;
  } else if (b.alias) {
    // if b has an alias, put it ahead of a
    return true;
  }
  if (a.name) {
    if (b.name) {
      // if both have names, sort them alphabetically
      return a.name.value > b.name.value;
    }
    // if a has a name, put it ahead of b
    return false;
  } else if (b.name) {
    // if b has a name, put it ahead of a
    return true;
  }
  if (a.selectionSet) {
    if (b.selectionSet) {
      // if both are inline frags, sort by the length
      return a.selectionSet.selections.length > b.selectionSet.selections.length
    }
    return false;
  } else if (b.selectionSet) {
    return true
  }
};
// inline frags don't have names, so just stick em at the end
// const sortField = field => (field.alias && field.alias.value) ||
// (field.name && field.name.value) ||
// (field.selectionSet.selections[0].name && field.selectionSet.selections[0].name.value) ||
// Infinity;
