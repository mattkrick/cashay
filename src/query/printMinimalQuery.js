import {print} from 'graphql/language/printer';
import {INLINE_FRAGMENT, VARIABLE} from 'graphql/language/kinds';
import {getMissingRequiredVariables} from './queryHelpers';
import createVariableDefinitions from '../createVariableDefinitions';

export const printMinimalQuery = (reqAST, idFieldName, variables, component, schema) => {
  // remove variableDefinitions that are no longer in use, flag is set during denorm
  // reqAST.variableDefinitions = reqAST.variableDefinitions.filter(varDef => varDef._inUse === true);
  // const minimizedVariableDefinitions = makeVariableDefinitions(reqAST, variables);
  // TODO bagArgs
  const context = {
    component,
    schema,
    variableDefinitions: []
  };
  debugger
  const fieldSchema = schema.querySchema[reqAST.name];
  minimizeQueryAST(reqAST, idFieldName, fieldSchema, context);
  return print(reqAST)
};

const minimizeQueryAST = (reqAST, idFieldName, fieldSchema, context) => {
  // if the value is a scalar, we're done here
  if (!reqAST.selectionSet) {
    return;
  }
  const {selections} = reqAST.selectionSet;

  for (let i = 0; i < selections.length; i++) {
    const field = selections[i];
    if (field.arguments) {
      createVariableDefinitions(field.arguments, fieldSchema, false, context);
      const missingRequiredVars = getMissingRequiredVariables(context.variableDefinitions, variables);
      const hasMissingVar = findMissingVar(field.arguments, missingRequiredVars);
      if (hasMissingVar) {
        // remove fields that aren't given the vars they need to be successful
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
      debugger
      const subSchema = fieldSchema.fields[field.name.value];
      minimizeQueryAST(field, idFieldName, subSchema, context);
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
      if (missingRequiredVars.includes(fieldArg.name.value)) {
        return true;
      }
    }
  }
};
