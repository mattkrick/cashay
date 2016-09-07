import {TypeKind} from 'graphql/type/introspection';
import {INLINE_FRAGMENT} from 'graphql/language/kinds';
import {
  ensureRootType,
  ensureTypeFromNonNull,
  CACHED,
  getFieldSchema,
  isLive,
  makeCachedArgs,
  TYPENAME
} from '../utils';
import {
  calculateSendToServer,
  handleMissingData,
  getDocFromNormalString,
  maybeLiveQuery,
  getCachedFieldState
} from './denormalizeHelpers';

const {ENUM, LIST, SCALAR} = TypeKind;

const arrayMetadata = ['BOF', 'EOF', 'count'];
const isPrimitive = (kind) => kind === SCALAR || kind === ENUM;
const visitObject = (subState = {}, reqAST, parentTypeSchema, context, reduction = {}) => {
  if (typeof subState === 'string') {
    const {typeName, docId} = getDocFromNormalString(subState);
    const {entities} = context.getState();
    // code defensively because a query with an entity may want something that the subscription hasn't returned yet
    subState = entities[typeName] && entities[typeName][docId] || {};
    parentTypeSchema = context.schema.types[typeName];
  }
  const fields = reqAST.selectionSet.selections;
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    if (field.kind === INLINE_FRAGMENT) {
      // TODO handle null typeCondition?
      if (field.typeCondition.name.value === parentTypeSchema.name) {
        // only follow through if it's the correct union subtype
        visitObject(subState, field, parentTypeSchema, context, reduction);
      }
    } else if (field.name.value === TYPENAME) {
      reduction[TYPENAME] = parentTypeSchema.name;
    } else {
      const fieldName = field.name.value;
      const aliasOrFieldName = field.alias && field.alias.value || fieldName;
      const cachedDirective = field.directives && field.directives.find(d => d.name.value === CACHED);

      if (cachedDirective) {
        const cachedDirectiveArgs = makeCachedArgs(cachedDirective.arguments, context.variables);
        const typeSchema = context.schema.types[cachedDirectiveArgs.type];
        const fieldState = getCachedFieldState(subState, cachedDirectiveArgs, field, context);
        const visitor = Array.isArray(fieldState) ? visitIterable : visitObject;
        reduction[aliasOrFieldName] = visitor(fieldState, field, typeSchema, context);
        continue;
      }
      const fieldSchema = getFieldSchema(field, parentTypeSchema, context.schema);
      const nnFieldType = ensureTypeFromNonNull(fieldSchema.type);

      const hasData = subState.hasOwnProperty(fieldName);
      if (hasData || isLive(field.directives)) {
        const fieldState = maybeLiveQuery(subState, fieldSchema, field, nnFieldType, context);
        const rootFieldType = ensureRootType(nnFieldType);
        const typeSchema = context.schema.types[rootFieldType.name];
        if (isPrimitive(nnFieldType.kind)) {
          reduction[aliasOrFieldName] = visitScalar(fieldState, context.coerceTypes[typeSchema.name])
        } else {
          const visitor = nnFieldType.kind === LIST ? visitIterable : visitObject;
          reduction[aliasOrFieldName] = visitor(fieldState, field, typeSchema, context);
          if (field.selectionSet) {
            calculateSendToServer(field, context.idFieldName)
          }
        }
      } else {
        reduction[aliasOrFieldName] = handleMissingData(visitObject, field, nnFieldType, context);
      }
    }
  }
  return reduction;
};

const visitIterable = (subState, reqAST, typeSchema, context) => {
  // for each value in the array, get the denormalized item
  const mappedState = [];
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
  return mappedState;
};

const visitScalar = (subState, coercion) => {
  return coercion ? coercion(subState) : subState;
};

export default function denormalizeStore(context) {
  const {getState, schema: {querySchema}, operation} = context;
  return visitObject(getState().result, operation, querySchema, context);
};
