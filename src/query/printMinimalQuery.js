import {print} from 'graphql/language/printer';
import {VARIABLE} from 'graphql/language/kinds';
import {getMissingRequiredVariables} from './queryHelpers';
import createVariableDefinitions from '../createVariableDefinitions';
import {ensureRootType} from '../utils';

export const printMinimalQuery = (reqAST, idFieldName, variables, component, schema) => {
  const context = {
    component,
    schema,
    variableDefinitions: []
  };
  minimizeQueryAST(reqAST, idFieldName, variables, schema.querySchema, context);
  reqAST.variableDefinitions = context.variableDefinitions;
  return print(reqAST)
};

const minimizeQueryAST = (reqAST, idFieldName, variables, subSchema, context) => {
  const {selections} = reqAST.selectionSet;
  for (let i = 0; i < selections.length; i++) {
    const field = selections[i];
    // if it has to go to the server, create some variable definitions and remove the pieces that don't have the required vars
    if (field.sendToServer) {
      const fieldSchema = subSchema.fields[field.name.value];
      if (field.arguments && field.arguments.length) {
        createVariableDefinitions(field.arguments, fieldSchema, false, context);
        const missingRequiredVars = getMissingRequiredVariables(context.variableDefinitions, variables);
        const hasMissingVar = findMissingVar(field.arguments, missingRequiredVars);
        if (hasMissingVar) {
          // remove fields that aren't given the vars they need to be successful
          selections[i] = undefined;
          continue;
        }
      }
      if (field.selectionSet) {
        const fieldSchemaType = ensureRootType(fieldSchema.type);
        const nextSchema = context.schema.types[fieldSchemaType.name];
        minimizeQueryAST(field, idFieldName, variables, nextSchema, context);
      }
    } else if (field.name.value !== idFieldName) {
      selections[i] = undefined;
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
