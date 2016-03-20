import {TypeKind} from 'graphql/type/introspection';
import {buildExecutionContext} from './buildExecutionContext';
import {mergeDeepWithArrs, mergeArrays, isObject} from './mergeDeep';
import {separateArgs} from './separateArgs';
import {FRAGMENT_SPREAD, INLINE_FRAGMENT} from 'graphql/language/kinds';
import {ensureRootType, getRegularArgsKey, ensureTypeFromNonNull} from './utils';
const {UNION, INTERFACE, LIST, OBJECT, NON_NULL, SCALAR} = TypeKind;

const handleMissingData = (aliasOrFieldName, field, fieldSchema, context) => {
  const fieldType = ensureTypeFromNonNull(fieldSchema.type);
  if (fieldType.kind === SCALAR) {
    return null;
  } else if (fieldType.kind === LIST) {
    return [];
  } else {
    const newFieldSchema = context.schema.types.find(type => type.name === fieldType.name);
    if (fieldType.kind === UNION) {
      // since we don't know what the shape will look like, make it look like everything
      const omniPartial = newFieldSchema.possibleTypes.reduce((reduction, objType) => {
        const newFieldSchema = context.schema.types.find(type => type.name === objType.name);
        Object.assign(reduction, visit(reduction, field, newFieldSchema, context));
        return reduction;
      }, {});
      omniPartial.__typename = null;
      return omniPartial;
    }
    return visit({}, field, newFieldSchema, context);
  }
};

const getFieldState = (fieldState, regularArgs, paginationArgs) => {
  if (regularArgs) {
    const regularArgsString = getRegularArgsKey(regularArgs);
    fieldState = fieldState[regularArgsString];
  }
  if (paginationArgs) {
    const {before, after, first, last} = paginationArgs;
    let usefulArray = fieldState.full;
    let isReverse = false;
    if (usefulArray) { // if we have all the docs
      isReverse = !!last; //if we're getting stuff in reverse
    } else { // if we only have some of the docs
      usefulArray = last ? fieldState.back : fieldState.front;
    }
    if (!usefulArray) {
      console.log('no local data')
    }
    const cursor = before || after;
    let cursorIdx = -1;
    if (cursor) {
      cursorIdx = usefulArray.find(doc => {
        const [typeName, docId] = doc.split(':');
        const storedDoc = store.entities[typeName][docId];
        return storedDoc.cursor === cursor
      });
      if (!cursorIdx) {
        console.error('invalid cursor');
      }
    }
    if (isReverse) {
      const minIdx = Math.max(0, cursorIdx + 1 - last);
      fieldState = usefulArray.slice(minIdx, minIdx + last);
    } else {
      const limit = first || last; //separateArgs ensures at least 1 exists
      const maxIdx = cursorIdx + 1 + limit;
      if (usefulArray.length < maxIdx) {
        console.log('not enough data, need to fetch more');
      }
      fieldState = usefulArray.slice(cursorIdx + 1, cursorIdx + 1 + limit);
    }
  }
  return fieldState;
};

const visitObject = (subState, reqAST, subSchema, context, baseReduction = {}) => {
  return reqAST.selectionSet.selections.reduce((reduction, field) => {
    if (field.kind === INLINE_FRAGMENT) {
      debugger
      if (field.typeCondition.name.value === subSchema.name) {
        visitObject(subState, field, subSchema, context, reduction);
      }
    } else if (field.kind === FRAGMENT_SPREAD) {
      const fragment = context.fragments[field.name.value];
      visitObject(subState, fragment, subSchema, context, reduction);
    } else if (field.name.value === '__typename') {
      reduction.__typename = subSchema.name;
    } else {
      const fieldName = field.name.value;
      const aliasOrFieldName = field.alias && field.alias.value || fieldName;
      const fieldSchema = subSchema.fields.find(field => field.name === fieldName);
      const hasData = subState.hasOwnProperty(fieldName);

      if (hasData) {
        let fieldState = subState[fieldName];
        if (fieldSchema.args && fieldSchema.args.length) {
          const {regularArgs, paginationArgs} = separateArgs(fieldSchema, field.arguments, context);
          fieldState = getFieldState(fieldState, regularArgs, paginationArgs);
        }
        reduction[aliasOrFieldName] = visit(fieldState, field, fieldSchema, context);
      } else {
        reduction[aliasOrFieldName] = handleMissingData(aliasOrFieldName, field, fieldSchema, context)
      }
    }
    return reduction
  }, baseReduction);
};

const visitNormalizedString = (subState, reqAST, subSchema, context) => {
  const [typeName, docId] = subState.split(':');
  const doc = context.store.entities[typeName][docId];
  const fieldSchema = context.schema.types.find(type => type.name === typeName);
  return visit(doc, reqAST, fieldSchema, context);
};

const visitIterable = (subState, reqAST, subSchema, context) => {
  const fieldType = ensureRootType(subSchema.type);
  const fieldSchema = context.schema.types.find(type => type.name === fieldType.name);
  return subState.map(res => visit(res, reqAST, fieldSchema, context));
};

const visit = (subState, reqAST, subSchema, context) => {
  const objectType = subSchema.kind ? subSchema.kind : subSchema.type.kind;

  switch (objectType) {
    case OBJECT:
      if (typeof subState === 'string') {
        return visitNormalizedString(subState, reqAST, subSchema, context);
      }
      return visitObject(subState, reqAST, subSchema, context);
    case UNION:
      return visitNormalizedString(subState, reqAST, subSchema, context);
    case LIST:
      return visitIterable(subState, reqAST, subSchema, context);
    default:
      return subState
  }
};

export const denormalizeStore = context => {
  const operationType = `${context.operation.operation}Type`;
  const operationSchema = context.schema.types.find(type => type.name === context.schema[operationType].name);
  const queryReduction = context.operation.selectionSet.selections.reduce((reduction, selection) => {
    const queryName = selection.name.value;
    const aliasOrName = selection.alias && selection.alias.value || queryName;
    const subSchema = operationSchema.fields.find(field => field.name === queryName);
    const {regularArgs, paginationArgs} = separateArgs(subSchema, selection.arguments, context);
    const fieldState = getFieldState(context.store.result[queryName], regularArgs, paginationArgs);
    reduction[aliasOrName] = visit(fieldState, selection, subSchema, context);
    return reduction
  }, {});
  //console.log('FINAL', queryReduction);
  return queryReduction;
};
