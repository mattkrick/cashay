import {INLINE_FRAGMENT} from 'graphql/language/kinds';

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
