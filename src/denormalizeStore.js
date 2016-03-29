import {TypeKind} from 'graphql/type/introspection';
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
        return {...reduction, ...visit(reduction, field, newFieldSchema, context)};
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

const convertFragmentToInline = fragment => {
  delete fragment.name;
  fragment.kind = INLINE_FRAGMENT;
  return fragment;
};

const visitObject = (subState, reqAST, subSchema, context, baseReduction = {}) => {
  const reducedSelected = reqAST.selectionSet.selections.reduce((reduction, field, idx, selectionArr) => {
    if (field.kind === FRAGMENT_SPREAD) {
      const fragment = context.fragments[field.name.value];
      selectionArr[idx] = field = convertFragmentToInline(fragment);
    }
    if (field.kind === INLINE_FRAGMENT) {
      if (field.typeCondition.name.value === subSchema.name) {
        // only follow through if it's the correct union subtype
        visitObject(subState, field, subSchema, context, reduction);
      }
    } else if (field.name.value === '__typename') {
      reduction.__typename = subSchema.name;
    } else {
      const fieldName = field.name.value;
      const aliasOrFieldName = field.alias && field.alias.value || fieldName;
      const fieldSchema = subSchema.fields.find(field => field.name === fieldName);
      // TODO: move this logic to the vistor
      //let unionHasTypeNameChild = false;
      //if (fieldSchema.type.kind === UNION) {
      //
      //  debugger
      //  const fieldHasTypeName = field.selectionSet.selections.find(selection => selection.name.value === '__typename');
      //  if (!fieldHasTypeName) {
      //    field.selectionSet.selection.shift({
      //      "kind": "Field",
      //      "alias": null,
      //      "name": {
      //        "kind": "Name",
      //        "value": "__typename",
      //        "loc": null
      //      },
      //      "arguments": [],
      //      "directives": [],
      //      "selectionSet": null,
      //      "loc": null
      //    })
      //  }
      //}
      const hasData = subState.hasOwnProperty(fieldName);

      if (hasData) {
        let fieldState = subState[fieldName];
        if (fieldSchema.args && fieldSchema.args.length) {
          const {regularArgs, paginationArgs} = separateArgs(fieldSchema, field.arguments, context);
          fieldState = getFieldState(fieldState, regularArgs, paginationArgs);
        }
        reduction[aliasOrFieldName] = visit(fieldState, field, fieldSchema, context);
        if (field.selectionSet) {
          calculateSendToServer(field, context.idFieldName)
        }
      } else {
        reduction[aliasOrFieldName] = handleMissingData(aliasOrFieldName, field, fieldSchema, context);
        field.sendToServer = true;
      }
    }
    return reduction
  }, baseReduction);
  reqAST.selectionSet.selections = reqAST.selectionSet.selections.filter(x => x !== 'xxx');
  return reducedSelected;
};

const calculateSendToServer = (field, idFieldName) => {
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
  // const minimizedSelections = selections.filter(Boolean);
  // if (minimizedSelections.length) {
  //   if (idField) {
  //     minimizedSelections.push(idField);
  //   }
  //   field.selectionSet.selections = minimizedSelections;
  //   field.sendToServer = true;
  // } else {
  //   //field.selectionSet = undefined;
  // }
};

const visitNormalizedString = (subState, reqAST, subSchema, context) => {
  const [typeName, docId] = subState.split(':');
  const doc = context.store.entities[typeName][docId];
  const fieldSchema = context.schema.types.find(type => type.name === typeName);
  return visit(doc, reqAST, fieldSchema, context);
};

//const getPropNames = (selections, bag = []) => {
//  selections.forEach(selection => {
//    if (selection.kind === INLINE_FRAGMENT) {
//      getPropNames(selection.selectionSet.selections, bag)
//    } else {
//      bag.push(selection.name.value);
//    }
//  });
//  return bag;
//};
//
//const filterPropNames = (selections, selectionSet) => {
//  selections.forEach(selection => {
//    if (selection.kind === INLINE_FRAGMENT) {
//      filterPropNames(selection.selectionSet.selections, selectionSet);
//    } else if (!selectionSet.has(selection.name.value)) {
//      //selections[selection] =
//    }
//  })
//}

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
    calculateSendToServer(selection, context.idFieldName);
    return reduction
  }, {});
  calculateSendToServer(context.operation, context.idFieldName);
  queryReduction._isComplete = !context.operation.sendToServer;
  return queryReduction;
};
