import {parse} from 'graphql/language/parser';
import {print} from 'graphql/language/printer';

export const parseSortPrint = mutationString => {
  const ast = parse(mutationString, {noLocation: true, noSource: true});
  const astSelections = ast.definitions[0].selectionSet.selections;
  recurse(astSelections);
  return print(ast);
};

const recurse = astSelections => {
  astSelections = astSelections.sort((a,b) => {
    const aAliasOrFieldName = a.alias && a.alias.value || a.name.value;
    const bAliasOrFieldName = b.alias && b.alias.value || b.name.value;
    return aAliasOrFieldName > bAliasOrFieldName;
  });
  for (let selection of astSelections) {
    if (selection.selectionSet) {
      recurse(selection.selectionSet.selections);
    }
  }
};
