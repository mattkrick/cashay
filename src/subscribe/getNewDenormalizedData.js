import getReturnType from './getReturnType';
import {TypeKind} from 'graphql/type/introspection';
import mergeStores from '../normalize/mergeStores';
import {without, ensureTypeFromNonNull} from '../utils';

const {LIST, OBJECT, SCALAR} = TypeKind;

const getFieldAndKind = (cachedResult, rawFieldName, idFieldName) => {
  if (rawFieldName.startsWith('[')) {
    const id = rawFieldName.substr(1, rawFieldName.length - 2);
    return {
      field: cachedResult.find(doc => doc[idFieldName] === id),
      isArray: true
    }
  }
  return {
    field: cachedResult[rawFieldName],
    isArray: false
  }
};

export default function createNewData(handler, cachedResult, pathArray, context) {
  const {document, schema, idFieldName} = context;
  const subSchema = schema.subscriptionSchema;
  const walkPathRecursion = (cachedResult, pathArray, subSchema) => {
    const rawFieldName = pathArray[0];
    const {field} = getFieldAndKind(cachedResult, rawFieldName, idFieldName);
    const fieldSchema = subSchema.fields[rawFieldName];
    const fieldSchemaType = ensureTypeFromNonNull(fieldSchema.type);
    if (pathArray.length === 1) {
      // if length is 1, we're in the operation object, so we always return an object full of subscription types
      if (handler === 'ADD') {
        if (fieldSchemaType.kind === LIST) {
          const returnField = field || [];
          return {[rawFieldName]: [...returnField, document]};
        }
        return {[rawFieldName]: document};
      }
      if (handler === 'REMOVE') {
        if (fieldSchemaType.kind === LIST) {
          const returnField = field || [];
          const idxToRemove = returnField.findIndex(field => field[idFieldName] === document);
          const newReturnField = returnField.slice();
          if (idxToRemove !== -1) {
            newReturnField.splice(idxToRemove, 1);
          }
          return {[rawFieldName]: newReturnField};
        }
        return {[rawFieldName]: undefined};
      }
      if (handler === 'UPDATE') {
        if (fieldSchemaType.kind === LIST) {
          // TODO
        }
        return {
          [rawFieldName]: {
            ...field,
            ...document
          }
        }
      }
    }
    const typeSchema = schema.types[fieldSchemaType.name];
    const fieldResult = walkPathRecursion(field, pathArray.slice(1), typeSchema);
    return Array.isArray(field) ? [...field, ...fieldResult] : {...field, ...fieldResult};
  };
  return walkPathRecursion(cachedResult, pathArray, subSchema);
};

// export const addDenormalizedData = (cachedResult, pathArray, context) => {
//   return walkPath(cachedResult, pathArray, context);
// };
//

// export const updateDenormalizedData = (typeName, schema, cachedResponse, document, removeKeys, idFieldName) => {
//   const returnType = getReturnType(typeName, schema);
//   if (returnType === SCALAR) {
//     return document;
//   }
//   if (returnType === OBJECT) {
//     const dataToMerge = without(cachedResponse.data, removeKeys);
//     return mergeStores(dataToMerge, document);
//   } else if (returnType === LIST) {
//     const docId = document[idFieldName];
//     const idxToUpdate = cachedResponse.data.findIndex(doc => doc[idFieldName] === docId);
//     const dataToMerge = without(cachedResponse.data[idxToUpdate], removeKeys);
//     const newDoc = mergeStores(dataToMerge, document);
//     return [...cachedResponse.data.slice(0, idxToUpdate), newDoc, ...cachedResponse.data.slice(idxToUpdate + 1)]
//   }
// };
