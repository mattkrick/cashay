import {INLINE_FRAGMENT} from 'graphql/language/kinds';
import {ensureRootType, clone} from '../utils'
/**
 * Uses a BFS since types are likely high up the tree & scalars can break as soon as a matching name is found
 *
 */
export default function findTypeInQuery(typeName, queryAST, schema, matchName) {
  const bag = [];
  const queue = [];
  let next = {
    reqAST: queryAST,
    typeSchema: schema.querySchema
  };
  while (next) {
    const {reqAST, typeSchema} = next;
    if (reqAST.selectionSet) {
      for (let selection of reqAST.selectionSet.selections) {
        let subSchema;
        if (selection.kind === INLINE_FRAGMENT) {
          subSchema = typeSchema;
        } else {
          const selectionName = selection.name.value;
          const fieldSchema = typeSchema.fields[selectionName];
          const rootFieldType = ensureRootType(fieldSchema.type);
          subSchema = ensureRootType(schema.types[rootFieldType.name]);
          if (subSchema.name === typeName) {
            if (matchName) {
              const fieldNameOrAlias = selection.alias && selection.alias.value || selectionName;
              if (matchName === fieldNameOrAlias) {
                bag[0] = selection;
                return bag;
              }
            } else {
              bag.push(selection);
            }
          }
        }
        queue.push({
          reqAST: selection,
          typeSchema: subSchema
        })
      }
    }
    next = queue.shift();
  }
  return bag;
};
