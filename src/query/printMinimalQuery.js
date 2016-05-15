import {print} from 'graphql/language/printer';
import {INLINE_FRAGMENT} from 'graphql/language/kinds';
import {DOCUMENT} from 'graphql/language/kinds';

export const printMinimalQuery = (reqAST, idFieldName) => {
  // remove variableDefinitions that are no longer in use, flag is set during denorm
  reqAST.variableDefinitions = reqAST.variableDefinitions.filter(varDef => varDef._inUse === true);
  minimizeQueryAST(reqAST, idFieldName);
  return print(reqAST);
};

const minimizeQueryAST = (reqAST, idFieldName) => {
  // if the value is a scalar, we're done here
  if (!reqAST.selectionSet) {
    return
  }
  const {selections} = reqAST.selectionSet;

  // for each child of the requested object
  for (let i = 0; i < selections.length; i++) {
    const field = selections[i];
    // if the child doesn't need to go to the server
    if (!field.sendToServer) {
      // if it's not the id field
      if (field.kind === INLINE_FRAGMENT || field.name.value !== idFieldName) {
        selections[i] = undefined;
      }
    } else {
      // if it does need to go to the server, remove children that don't need to
      minimizeQueryAST(field, idFieldName);
    }
  }

  // clean up unnecessary children
  const minimizedFields = selections.filter(Boolean);

  // if there aren't any fields or maybe just an unnecessary id field, remove the req
  const firstField = minimizedFields[0];
  if (!firstField ||
    (minimizedFields.length === 1 && !firstField.sendToServer && firstField.name && firstField.name.value === idFieldName)) {
    reqAST.selectionSet = null;
  } else {
    reqAST.selectionSet.selections = minimizedFields;
  }
};
