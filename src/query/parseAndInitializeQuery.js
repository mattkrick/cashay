import {FRAGMENT_SPREAD, INLINE_FRAGMENT} from 'graphql/language/kinds';
import {
  convertFragmentToInline,
  parse,
  clone,
  ensureRootType,
  getFieldSchema,
  TYPENAME,
  teardownDocumentAST
} from '../utils';
import {TypeKind} from 'graphql/type/introspection';
import {Field} from '../helperClasses';

const {UNION} = TypeKind;

export default function parseAndInitializeQuery(queryString, schema, idFieldName) {
  const ast = parse(queryString);
  const {operation, fragments} = teardownDocumentAST(ast.definitions);
  const initializeQueryAST = (operationSelections, parentSchema) => {
    const catalogFields = [idFieldName, TYPENAME];
    for (let i = 0; i < operationSelections.length; i++) {
      // convert fragment spreads into inline so we can minimize queries later
      let selection = operationSelections[i];
      if (selection.kind === FRAGMENT_SPREAD) {
        const fragment = clone(fragments[selection.name.value]);
        selection = operationSelections[i] = convertFragmentToInline(fragment);
      }
      // if it's an inline fragment, set schema to the typecondition, or parentSchema if null
      if (selection.kind === INLINE_FRAGMENT) {
        const subSchema = selection.typeCondition ? schema.types[selection.typeCondition.name.value] : parentSchema;
        const children = selection.selectionSet.selections;
        for (let fieldToRemove of catalogFields) {
          const idx = children.findIndex(child => child.name && child.name.value === fieldToRemove);
          if (idx !== -1) {
            children.splice(idx, 1);
          }
        }
        initializeQueryAST(selection.selectionSet.selections, subSchema);
        return;
      }
      // sort args once here to make sure the key is the same in the store w/o sorting later
      if (selection.arguments && selection.arguments.length) {
        selection.arguments.sort((a, b) => a.name.value > b.name.value);
      }

      if (selection.selectionSet) {
        const children = selection.selectionSet.selections;
        const fieldSchema = getFieldSchema(selection, parentSchema, schema);
        const rootFieldSchema = ensureRootType(fieldSchema.type);
        const typeSchema = schema.types[rootFieldSchema.name];
        const fieldsToAdd = typeSchema.kind === UNION ? catalogFields : typeSchema.fields[idFieldName] ? [idFieldName] : [];
        for (let fieldToAdd of fieldsToAdd) {
          const child = children.find(child => child.name && child.name.value === fieldToAdd);
          if (!child) {
            children.push(new Field({name: fieldToAdd}))
          }
        }
        initializeQueryAST(selection.selectionSet.selections, fragments, typeSchema, schema, idFieldName);
      }

    }
  };
  initializeQueryAST(operation.selectionSet.selections, schema.querySchema);
  // wipe out fragments
  ast.definitions = [operation];
  return ast;
};
