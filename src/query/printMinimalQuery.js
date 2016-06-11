import {print} from 'graphql/language/printer';
import {INLINE_FRAGMENT, VARIABLE} from 'graphql/language/kinds';
import {getMissingRequiredVariables} from './queryHelpers';

export const printMinimalQuery = (reqAST, idFieldName, variables) => {
  // remove variableDefinitions that are no longer in use, flag is set during denorm
  reqAST.variableDefinitions = reqAST.variableDefinitions.filter(varDef => varDef._inUse === true);
  const missingRequiredVars = getMissingRequiredVariables(reqAST.variableDefinitions, variables);
  minimizeQueryAST(reqAST, idFieldName, missingRequiredVars);
  return print(reqAST)
};

const minimizeQueryAST = (reqAST, idFieldName, missingRequiredVars) => {
  // if the value is a scalar, we're done here
  if (!reqAST.selectionSet) {
    return;
  }
  const {selections} = reqAST.selectionSet;

  for (let i = 0; i < selections.length; i++) {
    // remove fields that aren't given the vars they need to be successful
    const field = selections[i];
    if (field.arguments) {
      const hasMissingVar = findMissingVar(field.arguments, missingRequiredVars);
      if (hasMissingVar) {
        selections[i] = undefined;
        continue;
      }
    }
    // if the child doesn't need to go to the server
    if (!field.sendToServer) {
      // if it's not the id field
      if (field.kind === INLINE_FRAGMENT || field.name.value !== idFieldName) {
        selections[i] = undefined;
      }
    } else {
      // if it does need to go to the server, remove children that don't need to
      minimizeQueryAST(field, idFieldName, missingRequiredVars);
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

const findMissingVar = (fieldArgs, missingRequiredVars) => {
  for (let i = 0; i < fieldArgs.length; i++) {
    const fieldArg = fieldArgs[i];
    if (fieldArg.value.kind === VARIABLE) {
      if (missingRequiredVars.contains(fieldArg.name.value)) {
        return true;
      }
    }
  }
};
