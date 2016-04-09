import {OPERATION_DEFINITION, FRAGMENT_DEFINITION} from 'graphql/language/kinds';
import {print} from 'graphql/language/printer';
import {parse} from 'graphql/language/parser';

export const defaultPaginationWords = {
  before: 'before',
  after: 'after',
  first: 'first',
  last: 'last'
};

export const buildExecutionContext = (schema, queryString, options) => {
  // the request query + vars combo are not stored
  const documentAST = parse(queryString, {noLocation: true, noSource: true});
  
  let operation;
  const fragments = documentAST.definitions.reduce((reduction, definition) => {
    if (definition.kind === OPERATION_DEFINITION) {
      if (operation) {
        console.error('Multiple operations not supported');
      }
      operation = definition;
    } else if (definition.kind === FRAGMENT_DEFINITION) {
      reduction[definition.name.value] = definition;
    }
    return reduction;
  }, {});
  if (!operation) {
    console.error('Must provide an operation.');
  }
  // TODO: Open to PR for defaultValue. Useful if someone called the same query with & without it delcaring it
  return {
    schema,
    fragments,
    operation,
    paginationWords: Object.assign(defaultPaginationWords, options.paginationWords),
    variables: options.variables,
    idFieldName: options.idFieldName || 'id',
    store: options.store,
    // create an object unique to the queryString + vars
    dependencyKey: {variables: options.variables, queryString}
  };
};

