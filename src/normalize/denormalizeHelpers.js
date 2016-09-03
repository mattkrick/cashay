import {INLINE_FRAGMENT} from 'graphql/language/kinds';
import {TypeKind} from 'graphql/type/introspection';
import {ensureTypeFromNonNull, NORM_DELIMITER} from '../utils';

const {UNION, LIST, SCALAR, ENUM} = TypeKind;

export const handleMissingData = (visit, aliasOrFieldName, field, fieldSchema, context) => {
  sendChildrenToServer(field);
  const fieldType = ensureTypeFromNonNull(fieldSchema.type);
  if (fieldType.kind === SCALAR) {
    return null;
  } else if (fieldType.kind === LIST) {
    return [];
  } else if (fieldType.kind === ENUM) {
    return '';
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
        Object.assign(unionResponse, visit(unionResponse, field, newFieldSchema, context));
      }
      return {...unionResponse, __typename: null};
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
