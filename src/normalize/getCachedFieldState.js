import {parseCachedType, NORM_DELIMITER} from '../utils';
import {TypeKind} from 'graphql/type/introspection';

const {UNION} = TypeKind;

const stringifyEntity = (type, id) => `${type}${NORM_DELIMITER}${id}`;

const makeDefaultResolver = (id, idFieldName) => {
  if (Array.isArray(id)) {
    return (doc) => id.includes(doc[idFieldName])
  } else {
    return (doc) => doc[idFieldName] === id;
  }
};

const initCachedDeps = (cachedDeps, types, queryDep, resolver) => {
  // uses types in the event of a union
  for (let i = 0; i < types.length; i++) {
    const type = types[i];
    cachedDeps[type] = cachedDeps[type] || {};
    cachedDeps[type][queryDep] = cachedDeps[type][queryDep] || new Set();
    cachedDeps[type][queryDep].add(resolver);
  }
};

const resolveFromState = (resolver, possibleTypes, isArray, entities) => {
  const result = isArray ? [] : {};
  for (let t = 0; t < possibleTypes.length; t++) {
    const type = possibleTypes[t];
    const typeEntities = entities[type];
    if (!typeEntities) continue;
    const docIds = Object.keys(typeEntities);
    for (let i = 0; i < docIds.length; i++) {
      const docId = docIds[i];
      const doc = typeEntities[docId];
      if (resolver(doc)) {
        const stringifiedDoc = stringifyEntity(type, docId);
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


export default function getCachedFieldState(source, cachedDirectiveArgs, field, context) {
  const {cachedDeps, resolveCached, getState, idFieldName, queryDep} = context;
  const {type, typeIsList} = parseCachedType(cachedDirectiveArgs.type);
  const typeSchema = context.schema.types[type];
  const isUnion = typeSchema.kind === UNION;
  const possibleTypes = isUnion ? Object.keys(typeSchema.possibleTypes) : [type];
  const {entities} = getState();
  const aliasOrFieldName = field.alias && field.alias.value || field.name.value;
  const cacheResolverFactory = resolveCached && resolveCached[aliasOrFieldName];
  const resolver = cacheResolverFactory && cacheResolverFactory(source, cachedDirectiveArgs);

  if (isUnion && typeof resolver !== 'function') {
    throw new Error(`@cached requires resolveCached to return a function for union types.`);
  }

  // standard resolver function that completes in O(n) time for n docs in the state[type]
  if (typeof resolver === 'function') {
    initCachedDeps(cachedDeps, possibleTypes, queryDep, resolver);
    return resolveFromState(resolver, possibleTypes, typeIsList, entities);
  }

  // no factory means we need to make a default one based off of id/ids.
  // use resolveCached because they could just return something falsy
  if (!cacheResolverFactory) {
    const {id, ids} = cachedDirectiveArgs;
    if (!id && !ids) {
      throw new Error(`Must supply either id, ids or resolveCached for ${aliasOrFieldName}`);
    }
    const idLookup = ids || id;
    const isArray = idLookup === ids;
    if (isArray !== typeIsList) {
      const reqArg = typeIsList ? 'ids' : 'id';
      throw new Error(`Type ${cachedDirectiveArgs.type} requires a 'resolveCached' or the '${reqArg} arg`);
    }
    const depResolver = makeDefaultResolver(idLookup, idFieldName);
    initCachedDeps(cachedDeps, possibleTypes, queryDep, depResolver);
    return isArray ? ids.map(id => stringifyEntity(type, id)) : stringifyEntity(type, id);
  }

  const depResolver = makeDefaultResolver(resolver, idFieldName);
  // a resolver that looks for a single document
  if (typeof resolver === 'string') {
    if (typeIsList) {
      throw new Error(`Type ${cachedDirectiveArgs.type} requires your resolveCached to return a single id`)
    }
    initCachedDeps(cachedDeps, possibleTypes, queryDep, depResolver);
    return stringifyEntity(type, resolver);
  }

  // a resolver that looks for a series of documents
  if (Array.isArray(resolver)) {
    if (!typeIsList) {
      throw new Error(`Type ${cachedDirectiveArgs.type} requires your resolveCached to return an array`)
    }
    initCachedDeps(cachedDeps, possibleTypes, queryDep, depResolver);
    return resolver.map(id => stringifyEntity(type, id));
  }
  return {};
};
