import {INLINE_FRAGMENT} from 'graphql/language/kinds';
import {TypeKind} from 'graphql/type/introspection';
import getFieldState from './getFieldState';
import {
  defaultResolveChannelKeyFactory,
  isLive,
  makeFullChannel,
  NORM_DELIMITER
} from '../utils';
const {UNION, LIST, SCALAR, ENUM} = TypeKind;

export const handleMissingData = (visitObject, field, nnFieldType, context, isEntity) => {
  sendChildrenToServer(field);
  if (nnFieldType.kind === SCALAR) {
    return null;
  } else if (nnFieldType.kind === LIST) {
    return [];
  } else if (nnFieldType.kind === ENUM) {
    return '';
  } else {
    const typeSchema = context.schema.types[nnFieldType.name];
    if (nnFieldType.kind === UNION) {
      // since we don't know what the shape will look like, make it look like everything
      // that way, we don't have to code defensively in the view layer
      const {possibleTypes} = typeSchema;
      const possibleTypesKeys = Object.keys(possibleTypes);
      const unionResponse = {};
      for (let i = 0; i < possibleTypesKeys.length; i++) {
        const possibleTypeKey = possibleTypesKeys[i];
        const typeSchema = context.schema.types[possibleTypeKey];
        Object.assign(unionResponse, visitObject(unionResponse, field, typeSchema, context));
      }
      return {...unionResponse, __typename: null};
    }
    return visitObject({}, field, typeSchema, context, isEntity);
  }
};

export const calculateSendToServer = (field, idFieldName) => {
  const {selections} = field.selectionSet;
  for (let i = 0; i < selections.length; i++) {
    const selection = selections[i];
    if (selection.kind === INLINE_FRAGMENT) {
      calculateSendToServer(selection, idFieldName);
    }
    if (selection.sendToServer) {
      field.sendToServer = true;
    }
  }
};

export const sendChildrenToServer = reqAST => {
  reqAST.sendToServer = true;
  if (!reqAST.selectionSet) {
    return;
  }
  reqAST.selectionSet.selections.forEach(child => {
    sendChildrenToServer(child);
  })
};

export const rebuildOriginalArgs = reqAST => {
  if (reqAST.originalArguments) {
    reqAST.arguments = reqAST.originalArguments;
  }
  if (!reqAST.selectionSet) {
    return;
  }
  for (let child of reqAST.selectionSet.selections) {
    rebuildOriginalArgs(child);
  }
};

export const getDocFromNormalString = (normalString) => {
  const splitPoint = normalString.indexOf(NORM_DELIMITER);
  const typeName = normalString.substr(0, splitPoint);
  const docId = normalString.substr(splitPoint + NORM_DELIMITER.length);
  return {typeName, docId};
};

const makeUsefulSource = (source, result) => {
  return source === result ? null : source;
};

const stringifyEntity = (type, id) => `${type}${NORM_DELIMITER}${id}`;

const getEntity = (filterFunction, isArray, possibleTypes, entities, idFieldName, argDocs) => {
  const result = isArray ? [] : {};
  for (let t = 0; t < possibleTypes.length; t++) {
    const type = possibleTypes[t];
    const typeEntities = entities[type];
    if (!typeEntities) continue;
    const docIds = argDocs || Object.keys(typeEntities);
    for (let i = 0; i < docIds.length; i++) {
      const docId = docIds[i];
      const doc = typeEntities[docId];
      if (filterFunction(doc)) {
        const stringifiedDoc = stringifyEntity(type, doc[idFieldName]);
        if (isArray) {
          result.push(stringifiedDoc);
        } else {
          return stringifiedDoc;
        }
      }
    }
  }
  // if not everything loaded & we just wanted 1, we want to return an object
  return result;
};

const initCachedDeps = (cachedDeps, type, queryDep, resolver) => {
  cachedDeps[type] = cachedDeps[type] || {};
  cachedDeps[type][queryDep] = cachedDeps[type][queryDep] || new Set();
  cachedDeps[type][queryDep].add(resolver);
};

export const getCachedFieldState = (source, cachedDirectiveArgs, field, context) => {
  const {cachedDeps, directives = {}, getState, idFieldName, queryDep} = context;
  const {type} = cachedDirectiveArgs;
  const typeSchema = context.schema.types[type];
  const {entities, result} = getState();
  const usefulSource = makeUsefulSource(source, result);
  const aliasOrFieldName = field.alias && field.alias.value || field.name.value;
  const {resolveCached, resolveCachedList} = directives[aliasOrFieldName] || {};

  const possibleTypes = typeSchema.kind === UNION ? Object.keys(typeSchema.possibleTypes) : [type];
  if (resolveCachedList) {
    // they want a list!
    initCachedDeps(cachedDeps, type, queryDep, resolveCachedList);
    return getEntity(resolveCachedList(usefulSource, cachedDirectiveArgs), true, possibleTypes, entities, idFieldName);

  } else if (resolveCached) {
    // they want a single doc!
    initCachedDeps(cachedDeps, type, queryDep, resolveCached);
    return getEntity(resolveCached(usefulSource, cachedDirectiveArgs), false, possibleTypes, entities, idFieldName);
  } else {
    const {id, ids} = cachedDirectiveArgs;
    if (!id && !ids) {
      throw new Error(`Must supply either id, ids or resolveCached, resolveCachedList for ${aliasOrFieldName}`);
    }
    if (possibleTypes.length === 1) {
      // not a union!
      if (id) return stringifyEntity(type, id);
      if (ids) return ids.map(id => stringifyEntity(type, id));
    } else {
      const filterFunction = () => Boolean;
      const docIds = ids || [id];
      const isArray = Boolean(ids);
      return getEntity(filterFunction, isArray, possibleTypes, entities, idFieldName, docIds)
    }
  }
};

export const maybeLiveQuery = (source, fieldSchema, field, nnFieldType, context) => {
  const fieldName = field.name.value;
  if (!isLive(field.directives)) {
    // if there's no results stored or being fetched, save some time & don't bother with the args
    return getFieldState(source[fieldName], fieldSchema, field, context);
  }
  const aliasOrFieldName = field.alias && field.alias.value || fieldName;
  const {directives = {}, idFieldName, getState, queryDep, subscribe, subscriptionDeps, variables} = context;
  const result = getState().result;
  const usefulSource = makeUsefulSource(source, result);
  const {resolveChannelKey, subscriber} = directives[aliasOrFieldName] || {};
  const bestSubscriber = subscriber || context.defaultSubscriber;
  const makeChannelKey = resolveChannelKey || defaultResolveChannelKeyFactory(idFieldName);
  const channelKey = makeChannelKey(usefulSource, variables);
  const initialState = subscribe(aliasOrFieldName, channelKey, bestSubscriber, {returnType: nnFieldType});
  const subDep = makeFullChannel(aliasOrFieldName, channelKey);
  subscriptionDeps[subDep] = subscriptionDeps[subDep] || new Set();
  subscriptionDeps[subDep].add(queryDep);
  return result[aliasOrFieldName] && result[aliasOrFieldName][channelKey] || initialState;
};
