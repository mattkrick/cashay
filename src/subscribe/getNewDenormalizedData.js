import {TypeKind} from 'graphql/type/introspection';
import {isObject, ensureTypeFromNonNull, ensureRootType, ADD, UPDATE, REMOVE} from '../utils';

const {LIST} = TypeKind;

const splitPathPiece = (piece) => {
  const [identifier, rawIndexer] = piece.split('[');
  const indexer = rawIndexer && rawIndexer.substr(0, rawIndexer.length - 1);
  return {identifier, indexer};
};

export default function createNewData(handler, cachedResult, pathArray, context) {
  const {document, schema, idFieldName, removeKeys} = context;
  const subSchema = schema.subscriptionSchema;
  const walkPathRecursion = (cachedResult, pathArray, subSchema) => {
    const {identifier, indexer} = splitPathPiece(pathArray[0]);
    const fieldSchemaType = ensureTypeFromNonNull(subSchema.fields[identifier].type);
    const isList = fieldSchemaType.kind === LIST;
    if (indexer && !isList) {
      throw new Error(`Expected an array, but ${fieldSchemaType.name} is an ${fieldSchemaType.kind}. 
      Do not provide an indexer (eg '[123]') for adding/removing. Array of arrays are not supported`);
    }
    if (pathArray.length === 1) {
      // if length is 1, we're in the operation object, so we always return an object full of subscription types
      if (handler === ADD) {
        // ignore the indexer, since we will add it to the end, anyways
        if (isList) {
          const returnField = cachedResult[identifier] || [];
          return {[identifier]: [...returnField, document]};
        }
        // pointfeed subscription
        return {[identifier]: document};
      }
      if (handler === REMOVE) {
        // TODO not sure if any of this handler is correct
        // ignore the indexer, since we will remove whatever object has the id of "document"
        if (isList) {
          const returnField = cachedResult[identifier] || [];
          const idxToRemove = returnField.findIndex(field => field[idFieldName] === document);
          if (idxToRemove === -1) {
            throw new Error(`Cannot find object with id: ${indexer} in path: ${pathArray} in array: ${returnField}`);
          }
          return {[identifier]: [...returnField.slice(0, idxToRemove), ...returnField.slice(idxToRemove + 1)]};
        }
        // pointfeed subscription. this will probably never happen, but give en an object so they don't code defensively
        return isObject(cachedResult[identifier]) ? {} : null;
      }
      if (handler === UPDATE) {
        if (isList) {
          if (!indexer) {
            throw new Error(`Cannot update an array, document ID not specified in path: ${pathArray}`)
          }
          const returnField = cachedResult[identifier] || [];
          const idxToUpdate = returnField.findIndex(field => field[idFieldName] === indexer);
          if (idxToUpdate === -1) {
            throw new Error(`Cannot find object with id: ${indexer} in path: ${pathArray} in array: ${returnField}`);
          }
          const oldDoc = returnField[idxToUpdate];
          let updatedDoc;
          if (isObject(oldDoc)) {
            updatedDoc = {...oldDoc, ...document};
            removeKeys.forEach(key => delete updatedDoc[key]);
          } else {
            updatedDoc = document;
          }
          return {
            [identifier]: [...returnField.slice(0, idxToUpdate), updatedDoc, ...returnField.slice(idxToUpdate + 1)]
          }
        }
        const updatedDoc = {...cachedResult[identifier], ...document};
        removeKeys.forEach(key => delete updatedDoc[key]);
        return {[identifier]: updatedDoc};
      }
    }
    // TODO THIS IS ALL UNTESTED
    const rootFieldSchemaType = ensureRootType(fieldSchemaType);
    const typeSchema = schema.types[rootFieldSchemaType.name];
    const nextObj = cachedResult[identifier];
    if (Array.isArray(nextObj) && !indexer) {
      throw new Error(`${pathArray} does not include an indexer, but ${nextObj} is an array. Include an indexer.`)
    } else if (!Array.isArray(nextObj) && indexer) {
      throw new Error(`An indexer was provided: ${indexer} but the object is not an array: ${nextObj}. Don't include the indexer`)
    }
    const field = indexer ? nextObj.find(obj => obj.id === indexer) : nextObj;
    const fieldResult = walkPathRecursion(field, pathArray.slice(1), typeSchema);
    return {...field, ...fieldResult};
  };
  return walkPathRecursion(cachedResult, pathArray, subSchema);
};
