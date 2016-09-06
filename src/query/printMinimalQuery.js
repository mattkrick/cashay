import {print} from 'graphql/language/printer';
import {VARIABLE} from 'graphql/language/kinds';
import {getMissingRequiredVariables} from './queryHelpers';
import createVariableDefinitions from '../createVariableDefinitions';
import {ensureRootType, isLive} from '../utils';

export const printMinimalQuery = (reqAST, idFieldName, variables, op, schema) => {
  const context = {
    op,
    schema
  };
  reqAST.variableDefinitions = minimizeQueryAST(reqAST, idFieldName, variables, schema.querySchema, [], context);
  return print(reqAST)
};

const unqueriableDirectives = ['live', 'entity'];
const safeToSendDirectives = (directives) => {
  for (let i = 0; i < directives.length; i++) {
    const directive = directives[i];
    if (unqueriableDirectives.includes(directive.name.value)) {
      return false;
    }
  }
  return true;
};

// mutates initialVariableDefinitions
const minimizeQueryAST = (reqAST, idFieldName, variables, subSchema, initialVariableDefinitions = [], context) => {
  const {selections} = reqAST.selectionSet;
  for (let i = 0; i < selections.length; i++) {
    const field = selections[i];
    // if it has to go to the server, create some variable definitions and remove the pieces that don't have the required vars
    if (field.sendToServer && safeToSendDirectives(field.directives)) {
      const fieldSchema = subSchema.fields[field.name.value];
      if (field.arguments && field.arguments.length) {
        const createVarDefContext = {...context, initialVariableDefinitions};
        const {variableDefinitions} = createVariableDefinitions(field.arguments, fieldSchema, false, createVarDefContext);
        const allVarDefs = [...initialVariableDefinitions, ...variableDefinitions];
        const missingRequiredVars = getMissingRequiredVariables(allVarDefs, variables);
        const hasMissingVar = findMissingVar(field.arguments, missingRequiredVars);
        if (hasMissingVar) {
          // remove fields that aren't given the vars they need to be successful
          selections[i] = undefined;
          continue;
        } else {
          // MUTATIVE
          initialVariableDefinitions.push(...variableDefinitions);
        }
      }
      if (field.selectionSet) {
        const fieldSchemaType = ensureRootType(fieldSchema.type);
        const nextSchema = context.schema.types[fieldSchemaType.name];
        // mutates initialVariableDefinitions
        minimizeQueryAST(field, idFieldName, variables, nextSchema, initialVariableDefinitions, context);
      }
    } else if (field.name.value !== idFieldName) {
      selections[i] = undefined;
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
  // length will be >= than how it started
  return initialVariableDefinitions;
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
