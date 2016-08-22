import {TypeKind} from 'graphql/type/introspection';
import {isObject, ensureTypeFromNonNull, ensureRootType, ADD, UPDATE, UPSERT, REMOVE} from '../utils';

const {LIST} = TypeKind;

const splitPathPiece = (piece) => {
  const [identifier, rawIndexer] = piece.split('[');
  const indexer = rawIndexer && rawIndexer.substr(0, rawIndexer.length - 1);
  return {identifier, indexer};
};

const getSafeHandler = (handler, idxInCache) => {
  if (handler !== UPSERT) return handler;
  return idxInCache === -1 ? ADD : UPDATE;
};

export default function createNewData(handler, cachedResult, pathArray, context) {
  const {document, docId, schema, idFieldName, removeKeys} = context;
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
      let oldVal;
      let newVal;
      if (isList) {
        const returnField = cachedResult[identifier] || [];
        const idxInCache = returnField.findIndex(doc => doc[idFieldName] === docId);
        const safeHandler = getSafeHandler(handler, idxInCache);
        oldVal = idxInCache === -1 ? null : returnField[idxInCache];
        if (safeHandler === ADD) {
          newVal = {[identifier]: [...returnField, document]};
        } else if (safeHandler === REMOVE) {
          newVal = {[identifier]: [...returnField.slice(0, idxInCache), ...returnField.slice(idxInCache + 1)]};
        } else if (safeHandler === UPDATE) {
          const oldDoc = returnField[idxInCache];
          let updatedDoc;
          if (isObject(oldDoc) && removeKeys !== true) {
            updatedDoc = {...oldDoc, ...document};
            removeKeys.forEach(key => delete updatedDoc[key]);
          } else {
            updatedDoc = document;
          }
          newVal = {
            [identifier]: [...returnField.slice(0, idxInCache), updatedDoc, ...returnField.slice(idxInCache + 1)]
          }
        }
      } else {
        oldVal = cachedResult[identifier];
        // pointfeed subscriptions
        const safeHandler = handler === UPSERT ? UPDATE : handler;
        if (safeHandler === ADD || removeKeys === true) {
          newVal = {[identifier]: document};
        }
        if (safeHandler === UPDATE) {
          const updatedDoc = {...cachedResult[identifier], ...document};
          removeKeys.forEach(key => delete updatedDoc[key]);
          newVal = {[identifier]: updatedDoc};
        }
        if (safeHandler === REMOVE) {
          // this will probably never happen, but give en an object so they don't code defensively
          newVal = isObject(cachedResult[identifier]) ? {} : null;
        }
      }
      return {oldVal, newVal};
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
