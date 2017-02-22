import {TypeKind} from 'graphql/type/introspection';
import {INLINE_FRAGMENT} from 'graphql/language/kinds';
import {
  ensureRootType,
  ensureTypeFromNonNull,
  CACHED,
  getFieldSchema,
  isLive,
  makeCachedArgs,
  TYPENAME,
  parseCachedType
} from '../utils';
import {
  calculateSendToServer,
  handleMissingData,
  splitNormalString,
  maybeLiveQuery
} from './denormalizeHelpers';
import getCachedFieldState from './getCachedFieldState';

const {ENUM, LIST, SCALAR} = TypeKind;

const arrayMetadata = ['BOF', 'EOF', 'count'];
const isPrimitive = (kind) => kind === SCALAR || kind === ENUM;
const visitObject = (subState = {}, reqAST, parentTypeSchema, context, reduction = {}) => {
  if (typeof subState === 'string') {
    const [typeName, docId] = splitNormalString(subState);
    const {entities} = context.getState();
    // code defensively because an @cached query may want something that the subscription hasn't returned yet
    subState = entities[typeName] && entities[typeName][docId] || {[context.idFieldName]: ''};
    parentTypeSchema = context.schema.types[typeName];
  }
  // default to subState for denorming the persisted store subscriptions
  const fields = reqAST ? reqAST.selectionSet.selections : Object.keys(subState);
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    if (!reqAST) {
      // we're mocking data from a sub
      // TODO recursively denormalize & exit early if not found
      reduction[field] = subState[field];
      continue;
    }
    if (field.kind === INLINE_FRAGMENT) {
      // TODO handle null typeCondition?
      if (field.typeCondition.name.value === parentTypeSchema.name) {
        // only follow through if it's the correct union subtype
        visitObject(subState, field, parentTypeSchema, context, reduction);
      }
      continue;
    }
    const fieldName = field.name.value;
    const aliasOrFieldName = field.alias && field.alias.value || fieldName;
    if (field.name.value === TYPENAME) {
      reduction[aliasOrFieldName] = parentTypeSchema.name;
    } else {
      const cachedDirective = field.directives && field.directives.find(d => d.name.value === CACHED);

      if (cachedDirective) {
        const cachedDirectiveArgs = makeCachedArgs(cachedDirective.arguments, context.variables, context.schema);
        const {type} = parseCachedType(cachedDirectiveArgs.type);
        const typeSchema = context.schema.types[type];
        const fieldState = getCachedFieldState(subState, cachedDirectiveArgs, field, context);
        if (Array.isArray(fieldState)) {
          reduction[aliasOrFieldName] = visitIterable(fieldState, field, typeSchema, context, aliasOrFieldName);
        } else {
          reduction[aliasOrFieldName] = visitObject(fieldState, field, typeSchema, context);
        }
        continue;
      }
      const fieldSchema = getFieldSchema(field, parentTypeSchema, context.schema);
      const nnFieldType = ensureTypeFromNonNull(fieldSchema.type);

      const hasData = subState.hasOwnProperty(fieldName);
      if (hasData || isLive(field.directives)) {
        const fieldState = maybeLiveQuery(subState, fieldSchema, field, nnFieldType, context);
        const rootFieldType = ensureRootType(nnFieldType);
        const typeSchema = context.schema.types[rootFieldType.name];
        if (isPrimitive(nnFieldType.kind) || subState[fieldName] === null) {
          reduction[aliasOrFieldName] = visitScalar(fieldState, context.coerceTypes[typeSchema.name])
        } else {
          if ((nnFieldType.kind === LIST)) {
            if (fieldState) {
              reduction[aliasOrFieldName] = visitIterable(fieldState, field, typeSchema, context, aliasOrFieldName);
            } else {
              reduction[aliasOrFieldName] = [visitObject(fieldState, field, typeSchema, context)];
            }
          } else {
            reduction[aliasOrFieldName] = visitObject(fieldState, field, typeSchema, context);
          }
        }
      } else {
        reduction[aliasOrFieldName] = handleMissingData(visitObject, field, nnFieldType, cachedDirective, context);
      }
    }
  }
  if (reqAST && fields) {
    calculateSendToServer(reqAST, context.idFieldName)
  }
  return reduction;
};

const visitIterable = (subState, reqAST, typeSchema, context, aliasOrFieldName) => {
  // for each value in the array, get the denormalized item
  let mappedState = [];
  // the array could be a bunch of objects, or primitives
  const loopFunc = isPrimitive(typeSchema.kind) ?
    res => visitScalar(res, context.coerceTypes[typeSchema.name]) :
    res => visitObject(res, reqAST, typeSchema, context);

  for (let i = 0; i < subState.length; i++) {
    mappedState[i] = loopFunc(subState[i]);
  }

  // copy over metadata for smart pagination
  for (let i = 0; i < arrayMetadata.length; i++) {
    const metadataName = arrayMetadata[i];
    if (subState[metadataName]) {
      mappedState[metadataName] = subState[metadataName];
    }
  }

  const {sort, filter} = context;
  const sortFn = sort && sort[aliasOrFieldName];
  const filterFn = filter && filter[aliasOrFieldName];
  if (filterFn) {
    mappedState = mappedState.filter(filterFn);
  }
  if (sortFn) {
    mappedState = mappedState.sort(sortFn);
  }
  return mappedState;
};

const visitScalar = (subState, coercion) => {
  return coercion ? coercion(subState) : subState;
};

export default function denormalizeStore(context) {
  const {getState, schema: {querySchema}, operation, normalizedResult} = context;
  if (normalizedResult) {
    // this is for rehydrating subscriptions
    const visitor = Array.isArray(normalizedResult) ? visitIterable : visitObject;
    return visitor(normalizedResult, null, {}, context);
  }
  return visitObject(getState().result, operation, querySchema, context);
};
