import {INLINE_FRAGMENT, OPERATION_DEFINITION, FRAGMENT_DEFINITION} from 'graphql/language/kinds';
import {TypeKind} from 'graphql/type/introspection';
import {parse as gqlParse} from 'graphql/language/parser';

const {NON_NULL} = TypeKind;

export const TYPENAME = '__typename';
export const CASHAY = 'CASHAY';
export const DELIMITER = '_';
export const NORM_DELIMITER = '::';

// redux store array constants 
export const FRONT = 'front';
export const BACK = 'back';
export const FULL = 'full';


export const ensureTypeFromNonNull = type => type.kind === NON_NULL ? type.ofType : type;

export const ensureRootType = type => {
  while (type.ofType) type = type.ofType;
  return type;
};

export const getRegularArgsKey = regularArgs => {
  return regularArgs && (Object.keys(regularArgs).length ? JSON.stringify(regularArgs) : '');
};

export const isObject = val => val && typeof val === 'object';

export const clone = obj => JSON.parse(JSON.stringify(obj));

export const checkMutationInSchema = (rootMutation, mutationName) => {
  const mutationSchema = rootMutation.fields[mutationName];
  if (!mutationSchema) {
    throw new Error(`Invalid mutation: ${mutationName}.
    Did you make a typo or forget to update your schema?`);
  }
};

export const convertFragmentToInline = fragment => {
  delete fragment.name;
  fragment.kind = INLINE_FRAGMENT;
  return fragment;
};

export const parse = graphQLString => gqlParse(graphQLString, {noLocation: true, noSource: true});

export const buildExecutionContext = (queryAST, params) => {
  const clonedAST = clone(queryAST);
  const {operation, fragments} = teardownDocumentAST(clonedAST);
  return {operation, fragments, ...params};
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

export const getVariables = (variables = {}, cashayDataState, component, key, cachedResponse) => {
  const componentVars = cashayDataState.variables[component];
  let stateVars;
  if (componentVars) {
    stateVars = key ? componentVars[key] : componentVars;
  }
  return resolveVariables(cashayDataState, stateVars, variables, key, cachedResponse);
};

const resolveVariables = (cashayDataState, stateVars, variables, key, cachedResponse) => {
  const variableNames = Object.keys(variables);
  // if (!variableNames.length) return stateVars;
  const response = key ? cachedResponse[key] : cachedResponse;
  const newVariables = {};
  for (let i = 0; i < variableNames.length; i++) {
    const variableName = variableNames[i];
    const value = variables[variableName];
    newVariables[variableName] = (typeof value === 'function') ? safeValue(response, value, cashayDataState) : value;
  }
  // make the stateVars override the likely stale UD vars, but if the UD vars have something that used to be undefined, keep it
  return {...newVariables, ...stateVars};
};

const safeValue = (response, cb, cashayDataState) => response && response.data && cb(response.data, cashayDataState);

export const makeNamespaceString = (component, name, d = DELIMITER) => `${CASHAY}${d}${component}${d}${name}`;
