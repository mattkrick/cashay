import {INLINE_FRAGMENT} from 'graphql/language/kinds';
import {TypeKind} from 'graphql/type/introspection';
import {ensureTypeFromNonNull} from '../utils';

const {UNION, LIST, OBJECT, SCALAR} = TypeKind;

export const handleMissingData = (visit, aliasOrFieldName, field, fieldSchema, context) => {
  field.sendToServer = true;
  const fieldType = ensureTypeFromNonNull(fieldSchema.type);
  if (fieldType.kind === SCALAR) {
    return null;
  } else if (fieldType.kind === LIST) {
    return [];
  } else {
    const newFieldSchema = context.schema.types[fieldType.name];
    if (fieldType.kind === UNION) {
      // since we don't know what the shape will look like, make it look like everything
      // that way, we don't have to code defensively in the view layer
      const {possibleTypes} = newFieldSchema;
      const possibleTypesKeys = Object.keys(possibleTypes);
      const unionResponse = {};
      for (let possibleTypeKey of possibleTypesKeys) {
        const objType = possibleTypes[possibleTypeKey];
        const newFieldSchema = context.schema.types[objType.name];
        Object.assign(unionResponse, visit(unionResponse, field, newFieldSchema, context), {__typename: null});
      }
      return unionResponse;
    }
    return visit({}, field, newFieldSchema, context);
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
  reqAST.selectionSet.selections.forEach(child => {
    rebuildOriginalArgs(child);
  })
};

export const getDocFromNormalString = (normalString, entities) => {
  const [typeName, docId] = normalString.split(':');
  return entities[typeName][docId];
};

// TODO: move this logic to the vistor
//let unionHasTypeNameChild = false;
//if (fieldSchema.type.kind === UNION) {
//
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
