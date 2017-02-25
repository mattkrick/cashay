import {ADD, UPDATE, UPSERT, REMOVE, REMOVAL_FLAG, shallowEqual} from '../utils';
import {
  ADD_SUBSCRIPTION,
  UPDATE_SUBSCRIPTION,
  REMOVE_SUBSCRIPTION
} from '../normalize/duck';
import normalizeResponse from '../normalize/normalizeResponse';

import {TypeKind} from 'graphql/type/introspection';

const {UNION} = TypeKind;

const getSafeHandler = (handler, idxInCache) => {
  if (handler !== UPSERT) return handler;
  return idxInCache === -1 ? ADD : UPDATE;
};

const immutableRemove = (arr, idx) => {
  return [...arr.slice(0, idx), ...arr.slice(idx + 1)]
};

const immutableUpdate = (arr, idx, updatedDoc) => {
  return [...arr.slice(0, idx), updatedDoc, ...arr.slice(idx + 1)]
};

const checkCanDelete = (document, oldDenormResult, context) => {
  const {entities, typeSchema, idFieldName} = context;
  const typeName = typeSchema.kind === UNION ? oldDenormResult.data.__typename : typeSchema.name;
  const docId = document[idFieldName];
  const oldEntity = entities[typeName] && entities[typeName][docId];
  // protect against 2 remove calls coming in quickly
  if (!oldEntity) return false;
  const docKeys = Object.keys(document);
  for (let i = 0; i < docKeys.length; i++) {
    const key = docKeys[i];
    if (oldEntity[key] !== document[key]) {
      return false;
    }
  }
  return true;
};

export default function processSubscriptionDoc(handler, document, oldDenormResult, oldNormResult, context) {
  const {idFieldName, typeSchema} = context;
  const docId = document[idFieldName];
  const isList = Array.isArray(oldDenormResult.data);
  if (isList) {
    const idxInCache = oldNormResult.findIndex(normDoc => normDoc.endsWith(docId));
    const safeHandler = getSafeHandler(handler, idxInCache);
    if (safeHandler === ADD) {
      const normalizedDoc = normalizeResponse(document, context, true);
      return {
        actionType: ADD_SUBSCRIPTION,
        denormResult: oldDenormResult.data.concat(document),
        oldDoc: null,
        newDoc: document,
        normEntities: normalizedDoc.entities,
        normResult: oldNormResult.concat(normalizedDoc.result)
      };
    } else if (safeHandler === REMOVE) {
      const oldDoc = oldDenormResult.data[idxInCache];
      // const canDelete = checkCanDelete(document, oldDenormResult, context);
      // const typeName = typeSchema.kind === UNION ? oldDoc.__typename : typeSchema.name;
      return {
        actionType: REMOVE_SUBSCRIPTION,
        denormResult: immutableRemove(oldDenormResult.data, idxInCache),
        oldDoc,
        newDoc: null,
        normEntities: {},
        // cannot safely remove here because another sub or @cached query might also use this doc
        // normEntities: canDelete ? {[typeName]: {[docId]: REMOVAL_FLAG}} : {},
        normResult: immutableRemove(oldNormResult, idxInCache)
      }
    } else if (safeHandler === UPDATE) {
      const oldDoc = oldDenormResult.data[idxInCache];
      // this shallow merge will break if the doc has nested docs
      const mergedDoc = {...oldDoc, ...document};
      if (shallowEqual(oldDoc, mergedDoc)) return;
      const normalizedDoc = normalizeResponse(mergedDoc, context, true);
      return {
        actionType: UPDATE_SUBSCRIPTION,
        denormResult: immutableUpdate(oldDenormResult.data, idxInCache, mergedDoc),
        oldDoc,
        newDoc: mergedDoc,
        normEntities: normalizedDoc.entities,
        normResult: immutableUpdate(oldNormResult, idxInCache, normalizedDoc.result)
      };
    }
  } else {
    const safeHandler = handler === UPSERT ? UPDATE : handler;
    if (safeHandler === ADD) {
      const {entities: normEntities, result: normResult} = normalizeResponse(document, context, true);
      return {
        actionType: ADD_SUBSCRIPTION,
        denormResult: document,
        oldDoc: null,
        newDoc: document,
        normEntities,
        normResult
      }
    } else if (safeHandler === UPDATE) {
      const mergedDoc = {...oldDenormResult.data, ...document};
      if (shallowEqual(oldDenormResult.data, mergedDoc)) return;
      const {entities: normEntities, result: normResult} = normalizeResponse(mergedDoc, context, true);
      return {
        actionType: UPDATE_SUBSCRIPTION,
        denormResult: mergedDoc,
        oldDoc: oldDenormResult.data,
        newDoc: mergedDoc,
        normEntities,
        normResult
      }
    } else if (safeHandler === REMOVE) {
      const typeName = typeSchema.kind === UNION ? oldDenormResult.data.__typename : typeSchema.name;
      return {
        actionType: REMOVE_SUBSCRIPTION,
        denormResult: null,
        oldDoc: oldDenormResult.data,
        newDoc: null,
        normEntities: {[typeName]: {[docId]: REMOVAL_FLAG}},
        normResult: null
      };
    }
  }
};
