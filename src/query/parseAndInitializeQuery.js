import {FRAGMENT_SPREAD, INLINE_FRAGMENT} from 'graphql/language/kinds';
import {convertFragmentToInline, parse, clone, ensureRootType, TYPENAME, teardownDocumentAST} from '../utils';
import {TypeKind} from 'graphql/type/introspection';
import {Field} from '../helperClasses';

const {UNION} = TypeKind;

const initializeQueryAST = (operationSelections, fragments, fieldSchema, schema, idFieldName) => {
  for (let i = 0; i < operationSelections.length; i++) {
    // convert fragment spreads into inline so we can minimize queries later
    let selection = operationSelections[i];
    const catalogFields = [idFieldName, TYPENAME];
    if (selection.kind === FRAGMENT_SPREAD) {
      const fragment = clone(fragments[selection.name.value]);
      selection = operationSelections[i] = convertFragmentToInline(fragment);
    }
    // if it's an inline fragment, set schema to the typecondition, or fieldSchema if null
    if (selection.kind === INLINE_FRAGMENT) {
      const subSchema = selection.typeCondition ? schema.types[selection.typeCondition.name.value] : fieldSchema;
      const children = selection.selectionSet.selections;
      for (let fieldToRemove of catalogFields) {
        const idx = children.findIndex(child => child.name && child.name.value === fieldToRemove);
        if (idx !== -1) {
          children.splice(idx, 1);
        }
      }
      initializeQueryAST(selection.selectionSet.selections, fragments, subSchema, schema, idFieldName);
    } else {
      const selectionName = selection.name.value;
      if (selection.arguments && selection.arguments.length) {
        selection.arguments.sort((a,b) => a.name.value > b.name.value);
      }
      if (selection.selectionSet) {
        const children = selection.selectionSet.selections;
        const typeSchema = fieldSchema.fields[selectionName];
        const rootFieldSchema = ensureRootType(typeSchema.type);
        const subSchema = schema.types[rootFieldSchema.name];
        const fieldsToAdd = subSchema.kind === UNION ? catalogFields : subSchema.fields[idFieldName] ? [idFieldName] : [];
        for (let fieldToAdd of fieldsToAdd) {
          const child = children.find(child => child.name && child.name.value === fieldToAdd);
          if (!child) {
            children.push(new Field({name: fieldToAdd}))
          }
        }
        initializeQueryAST(selection.selectionSet.selections, fragments, subSchema, schema, idFieldName);
      }
    }
  }
};

export default function parseAndInitializeQuery(queryString, schema, idFieldName) {
  const ast = parse(queryString);
  const {operation, fragments} = teardownDocumentAST(ast);
  initializeQueryAST(operation.selectionSet.selections, fragments, schema.querySchema, schema, idFieldName);
  ast.definitions = [operation];
  return ast;
};
