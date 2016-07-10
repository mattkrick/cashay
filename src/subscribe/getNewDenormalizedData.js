import getReturnType from './getReturnType';
import {TypeKind} from 'graphql/type/introspection';
import mergeStores from '../normalize/mergeStores';
import {without} from '../utils';

const {LIST, OBJECT, SCALAR} = TypeKind;

const mergeError = (path, field, reduction) => {
  return new Error(`Cannot merge path: ${path} because ${field} does not exist in ${reduction}`)
};

const walkPath = (cachedResult, pathArray, idFieldName) => {
  const newResult = {...cachedResult};
  const field = pathArray.shift();

  const subResponse = pathArray.reduce((reduction, field) => {
    if (field.startsWith('[')) {
      const id = field.substr(1, field.length - 2);
      return reduction.find(doc => doc[idFieldName] === id);
    }
    return reduction[field];
  }, cachedResult);
  return {field, subResponse};
};

const splitPath = path => {
  if (!path) return;
  const fields = path.split('.');
  const fieldsAndArrays = [];
  for (let i = 0; i < fields.length; i++) {
    const fieldWithMaybeArray = fields[i];
    const values = fieldWithMaybeArray.split('[');
    fieldsAndArrays.push(values[0]);
    if (values[1]) {
      fieldsAndArrays.push(`[${values[1]}`)
    }
  }
  return fieldsAndArrays;
};

export const addDenormalizedData = (schema, cachedResult, document, pathArray, idFieldName) => {
  let subResult = cachedResult;
  while (pathArray.length >1) {
    const nextLocation = pathArray.shift();
    if (nextLocation.startsWith('[')) {
      const id = nextLocation.substr(1, nextLocation.length - 2);
      subResult = subResult.find(doc => doc[idFieldName] === id);
    } else {
      subResult = subResult[nextLocation];
    }
  }
  const lastLocation = pathArray.shift();
  if (Array.isArray(subResult[lastLocation])) {

  }
  if (path) {

  } else {

    if (returnType === LIST) {
      if (path) {
        const pathArray = splitPath(path);
        // get rid of the entity, since we just care about which document in the array
        pathArray.shift();
        const {field, subResponse} = walkPath(cachedResponse, path, idFieldName);

      }
      const cachedResult = cachedResponse.data || [];
      return [...cachedResult, document];
    }
    // if (returnType === OBJECT || returnType === SCALAR) {
    return document;
    // }
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
