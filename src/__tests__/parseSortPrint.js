import {parse} from 'graphql/language/parser';
import {print} from 'graphql/language/printer';
import {teardownDocumentAST} from '../buildExecutionContext';
/**
 * This is a stupid little function that sorts fields by alias & then by name
 * That way, testing equality is easy
 */
export const parseSortPrint = graphQLString => {
  const ast = parse(graphQLString, {noLocation: true, noSource: true});
  return sortPrint(ast);
};

export const sortPrint = ast => {
  const {operation} = teardownDocumentAST(ast);
  recurse(operation.selectionSet.selections);
  return print(ast);
};

export const sortAST = ast => {
  const {operation} = teardownDocumentAST(ast);
  recurse(operation.selectionSet.selections);
  return ast;
};

const recurse = astSelections => {
  for (let selection of astSelections) {
    if (selection.selectionSet) {
      recurse(selection.selectionSet.selections);
    }
  }
  astSelections.sort((a,b) => sortField(a) > sortField(b));
};

// inline frags don't have names, so just stick em at the end
const sortField = field => (field.alias && field.alias.value) ||
(field.name && field.name.value) ||
(field.selectionSet.selections[0].name && field.selectionSet.selections[0].name.value) || Infinity;
