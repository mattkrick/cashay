import getReturnType from './getReturnType';
import {TypeKind} from 'graphql/type/introspection';
import mergeStores from '../normalize/mergeStores';
import {without} from '../utils';

const {LIST, OBJECT, SCALAR} = TypeKind;

const mergeError = (patch, field, reduction) => {
  return new Error(`Cannot merge patch: ${patch} because ${field} does not exist in ${reduction}`)
};

const walkDenormalizedSubscription = (document, stack, subSchema) => {
  
}
export const addDenormalizedData = (typeName, schema, cachedResponse, document, patch, idFieldName) => {
  const subscriptionType = schema.subscriptionSchema.fields[typeName].type;
  const subscriptionTypeNN = ensureTypeFromNonNull(subscriptionType);
  
  const returnType = getReturnType(typeName, schema);
  if (returnType === LIST) {
    const cachedResult = cachedResponse.data || [];
    if (!patch) {
      return [...cachedResult, document]
    }
    const stack = patch.split('.');
    const field = stack.pop();
    const parentDoc = stack.reducer((reduction, field) => {
      if (Array.isArray(reduction)) {
        const subField = reduction.find(doc => doc[idFieldName] === field);
        if (!subField) throw mergeError(patch, field, reduction);
        return subField;
      }
      if (!reduction.hasOwnProperty(field)) throw mergeError(patch, field, reduction);
      return reduction[field];
    }, document);
    if (!parentDoc.hasOwnProperty(field)) throw mergeError(patch, field, parentDoc);
    
    
  }
  if (returnType === OBJECT || returnType === SCALAR) {
    return document;
  }
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
