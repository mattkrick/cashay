import {parse} from 'graphql/language/parser';
import {print} from 'graphql/language/printer';

/**
 * This is a stupid little function that sorts fields by alias & then by name
 * That way, testing equality is easy
 */
export const parseSortPrint = mutationString => {
  const ast = parse(mutationString, {noLocation: true, noSource: true});
  const astSelections = ast.definitions[0].selectionSet.selections;
  recurse(astSelections);
  return print(ast);
};

const recurse = astSelections => {
  for (let selection of astSelections) {
    if (selection.selectionSet) {
      recurse(selection.selectionSet.selections);
    }
  }
  astSelections = astSelections.sort((a,b) => {
    if (!a.name) {
      console.log(a)
    }
    // inline frags don't have names, so just stick em at the end
    const aAliasOrFieldName = a.alias && a.alias.value || (a.name && a.name.value) || a.selectionSet.selections[0].name.value;
    const bAliasOrFieldName = b.alias && b.alias.value || (b.name && b.name.value) || b.selectionSet.selections[0].name.value;
    return aAliasOrFieldName > bAliasOrFieldName;
  });
};
