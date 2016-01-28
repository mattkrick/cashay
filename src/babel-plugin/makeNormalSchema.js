import {visit, QueryDocumentKeys} from 'graphql/language/visitor';
import {TypeKind} from 'graphql/type/introspection';
import {Schema, arrayOf, unionOf} from 'normalizr';

const {OperationDefinition, Document} = QueryDocumentKeys;
const {UNION, LIST, OBJECT} = TypeKind;

class NormalizrSchema {
  define(obj) {
    Object.assign(this, obj);
  }
}

const getNormalizrValue = (schema, {kind, ofType, name}) => {
  if (kind === OBJECT) {
    const childType = schema.types.find(field => field.name === name);
    const isEntity = childType.fields.some(field => field.name === 'id');
    if (isEntity) {
      return new Schema(name);
    }
  } else {
    let normalizingFn;
    if (kind === LIST) {
      normalizingFn = arrayOf;
    } else if (kind === UNION) {
      normalizingFn = unionOf;
    }
    if (normalizingFn) {
      return normalizingFn(new Schema(ofType.name))
    }
  }
};

const getNestedSchema = (obj, stack) => {
  const firstEntity = obj[stack[0]];
  const remainingStack = stack.slice(1);
  const lastEntity = remainingStack.reduce((reduction, level) => {
    return reduction.getItemSchema()[level];
  }, firstEntity);
  return lastEntity.getItemSchema();
}

export const makeNormalSchema = (doc,schema) => {
  schema = schema.data.__schema;
  const normalizrSchema = new NormalizrSchema();
  const stack = [];
  let operationSchema;

  visit(doc, {
    Document(node) {
      if (node.definitions.length > 1) {
        console.error('Multiple operations not supported (yet?)');
      }
    },
    OperationDefinition(node){
      const operationKey = `${node.operation}Type`;
      const operationName = schema[operationKey].name;
      if (!operationName) {
        console.error(`${operationKey} does not exist in your schema! Try queryType, mutationType, or subscriptionType`)
      }
      operationSchema = schema.types.find(type => type.name === operationName);
    },
    Field: {
      enter(node) {
        if (node.selectionSet) {
          let childField;
          let parentEntity;
          const fieldKey = node.name.value;
          childField = operationSchema.fields.find(field => field.name === fieldKey);
          if (childField) { /* Is it a query? */
            parentEntity = normalizrSchema;
          } else {
            parentEntity = getNestedSchema(normalizrSchema, stack);
            const parentTypeName = parentEntity.getKey();
            const parentType = schema.types.find(field => field.name === parentTypeName);
            childField = parentType.fields.find(field => field.name === fieldKey);
          }
          const fieldValue = getNormalizrValue(schema, childField.type);
          if (fieldValue) {
            parentEntity.define({[fieldKey]: fieldValue})
          }
          stack.push(fieldKey);
        }
      },
      leave(node) {
        if (node.selectionSet) {
          stack.pop();
        }
      }
    }
  });
  return normalizrSchema;
}
