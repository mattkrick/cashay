import {OPERATION_DEFINITION, FRAGMENT_DEFINITION} from 'graphql/language/kinds';

export const buildExecutionContext = (queryAST, cashayDataState, variables, paginationWords, idFieldName) => {
  const clonedAST = clone(queryAST);
  const {operation, fragments} = teardownDocumentAST(clonedAST);
  return {
    cashayDataState,
    operation,
    fragments,
    variables,
    paginationWords,
    idFieldName
  };
  // TODO: Open to PR for defaultValue. Useful if someone called the same query with & without it delcaring it
};

export const teardownDocumentAST = queryAST => {
  let operation;
  // console.log(queryAST);
  const fragments = queryAST.definitions.reduce((reduction, definition) => {
    if (definition.kind === OPERATION_DEFINITION) {
      if (operation) {
        throw new Error('Multiple operations not supported');
      }
      operation = definition;
    } else if (definition.kind === FRAGMENT_DEFINITION) {
      reduction[definition.name.value] = definition;
    }
    return reduction;
  }, {});
  if (!operation) {
    throw new Error('Must provide an operation.');
  }
  return {operation, fragments};
};
