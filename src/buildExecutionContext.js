import {OPERATION_DEFINITION, FRAGMENT_DEFINITION} from 'graphql/language/kinds';

export const defaultPaginationWords = {
  before: 'before',
  after: 'after',
  first: 'first',
  last: 'last'
};

export const buildExecutionContext = (schema, queryAST, options) => {
  const {operation, fragments} = teardownDocumentAST(queryAST);

  // TODO: Open to PR for defaultValue. Useful if someone called the same query with & without it delcaring it
  return {
    schema,
    fragments,
    operation,
    paginationWords: Object.assign(defaultPaginationWords, options.paginationWords),
    variables: options.variables,
    idFieldName: options.idFieldName || 'id',
    cashayDataState: options.cashayDataState
  };
};

export const teardownDocumentAST = queryAST => {
  let operation;
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
