import {INLINE_FRAGMENT} from 'graphql/language/kinds';
import {ensureRootType, getVariableValue, parseCachedType} from '../utils'
/**
 * Traverses a query AST operation looking for a specific type (for objects) or name (for scalars)
 * Uses a BFS since return values are likely high up the tree & scalars can break as soon as a matching name is found
 *
 * @param {String} typeName the type of GraphQL object to look for
 * @param {Object} operation the request AST's definition to traverse
 * @param {Object} schema the cashay client schema
 * @param {String} [matchName] if provided, it will match by typeName AND matchName (used for scalars)
 *
 * @returns {Array} a bag full of selections whose children will be added to the mutation response
 */
export default function findTypeInQuery(typeName, operation, schema, matchName) {
  const bag = [];
  const queue = [];
  let next = {
    operation,
    typeSchema: schema.querySchema
  };
  while (next) {
    const {operation, typeSchema} = next;
    if (operation.selectionSet) {
      const {selections} = operation.selectionSet;
      for (let i = 0; i < selections.length; i++) {
        const selection = selections[i];
        let subSchema;
        if (selection.kind === INLINE_FRAGMENT) {
          subSchema = typeSchema;
        } else {
          const selectionName = selection.name.value;
          const cachedDirective = selection.directives.find(d => d.name.value === 'cached');
          if (cachedDirective) {
            const typeArg = cachedDirective.arguments.find(arg => arg.name.value === 'type');
            // this will throw if type isn't static
            const typeName = getVariableValue(typeArg);
            const {type} = parseCachedType(typeName);
            subSchema = schema.types[type]
          } else {
            const fieldSchema = typeSchema.fields[selectionName];
            const rootFieldType = ensureRootType(fieldSchema.type);
            subSchema = schema.types[rootFieldType.name];
          }
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
          operation: selection,
          typeSchema: subSchema
        })
      }
    }
    next = queue.shift();
  }
  return bag;
};
