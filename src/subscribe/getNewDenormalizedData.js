import {isObject, ADD, UPDATE, UPSERT, REMOVE} from '../utils';
import {TypeKind} from 'graphql/type/introspection';

const {UNION} = TypeKind;

const getSafeHandler = (handler, idxInCache) => {
  if (handler !== UPSERT) return handler;
  return idxInCache === -1 ? ADD : UPDATE;
};

export default function createNewData(handler, cachedResult, document, idFieldName, removeKeys = []) {
  const docId = document[idFieldName];
  const isList = Array.isArray(cachedResult);
  let oldVal;
  let newVal;
  if (isList) {
    const idxInCache = cachedResult.findIndex(doc => doc[idFieldName] === docId);
    const safeHandler = getSafeHandler(handler, idxInCache);
    oldVal = idxInCache === -1 ? null : cachedResult[idxInCache];
    if (safeHandler === ADD) {
      newVal = [...cachedResult, document];
    } else if (safeHandler === REMOVE) {
      newVal = [...cachedResult.slice(0, idxInCache), ...cachedResult.slice(idxInCache + 1)];
    } else if (safeHandler === UPDATE) {
      let updatedDoc;
      if (isObject(oldVal) && removeKeys !== true) {
        updatedDoc = {...oldVal, ...document};
        removeKeys.forEach(key => delete updatedDoc[key]);
      } else {
        updatedDoc = document;
      }
      newVal = [...cachedResult.slice(0, idxInCache), updatedDoc, ...cachedResult.slice(idxInCache + 1)]
    }
  } else {
    oldVal = cachedResult;
    // pointfeed subscriptions
    const safeHandler = handler === UPSERT ? UPDATE : handler;
    if (safeHandler === ADD || removeKeys === true) {
      newVal = document;
    } else if (safeHandler === UPDATE) {
      newVal = {...cachedResult, ...document};
      removeKeys.forEach(key => delete newVal[key]);
    }
    if (safeHandler === REMOVE) {
      // this will probably never happen, but give en an object so they don't code defensively
      newVal = isObject(cachedResult) ? {} : null;
    }
  }
  return {oldVal, newVal};
};
