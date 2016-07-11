import getReturnType from './getReturnType';
import {TypeKind} from 'graphql/type/introspection';
import mergeStores from '../normalize/mergeStores';
import {without, ensureTypeFromNonNull} from '../utils';

const {LIST, OBJECT, SCALAR} = TypeKind;

const walkPath = (cachedResult, pathArray, context) => {
  const walkPathRecursion = (cachedResult, pathArray, subSchema) => {
    const rawFieldName = pathArray[0];
    let field;
    if (rawFieldName.startsWith('[')) {
      const id = rawFieldName.substr(1, rawFieldName.length - 2);
      field = cachedResult.find(doc => doc[idFieldName] === id);
    } else {
      field = cachedResult[rawFieldName];
    }

    const fieldSchema = subSchema.fields[field];
    const fieldSchemaType = ensureTypeFromNonNull(fieldSchema.type);

    if (pathArray.length === 0) {
      if (fieldSchemaType.kind === LIST) {
        field = field || [];
        return [...field, document];
      }
      return document;
    }
    const typeSchema = schema.types[fieldSchemaType.name];
    const fieldResult = walkPath(document, field, pathArray.slice(1), typeSchema, schema, idFieldName);
    return Array.isArray(field) ? [...field, ...fieldResult] : {...field, ...fieldResult};
  };
  const {document, schema, idFieldName} = context;
  const subSchema = schema.subscriptionSchema;
    walkPathRecursion(cachedResult, pathArray, subSchema);
};

export const addDenormalizedData = (cachedResult, pathArray, context) => {
  return walkPath(cachedResult, pathArray, context);
};

export const updateDenormalizedData = (typeName, schema, cachedResponse, document, removeKeys, idFieldName) => {
  const returnType = getReturnType(typeName, schema);
  if (returnType === SCALAR) {
    return document;
  }
  if (returnType === OBJECT) {
    const dataToMerge = without(cachedResponse.data, removeKeys);
    return mergeStores(dataToMerge, document);
  } else if (returnType === LIST) {
    const docId = document[idFieldName];
    const idxToUpdate = cachedResponse.data.findIndex(doc => doc[idFieldName] === docId);
    const dataToMerge = without(cachedResponse.data[idxToUpdate], removeKeys);
    const newDoc = mergeStores(dataToMerge, document);
    return [...cachedResponse.data.slice(0, idxToUpdate), newDoc, ...cachedResponse.data.slice(idxToUpdate + 1)]
  }
};
