import {VARIABLE} from 'graphql/language/kinds';
import {TypeKind} from 'graphql/type/introspection';
import {ensureTypeFromNonNull, getVariableValue, BEFORE, AFTER} from '../utils';

const {LIST} = TypeKind;

const acceptsArgs = (fieldSchema, paginationWords, paginationWordKeys) => {
  let acceptsPaginationArgs = false;
  let acceptsRegularArgs = false;
  for (let i = 0; i < paginationWordKeys.length; i++) {
    const key = paginationWordKeys[i];
    const pageWord = paginationWords[key];
    if (fieldSchema.args[pageWord]) {
      acceptsPaginationArgs = true;
    } else {
      acceptsRegularArgs = true;
    }
  }
  return {acceptsPaginationArgs, acceptsRegularArgs};
};
/**
 * Determine whether the arguments provided are going to be used for pagination
 * @param {Object} fieldSchema a piece of the GraphQL client schema for the particular field
 * @param {Array} reqASTArgs the arguments coming from the request AST
 * @param {Object} paginationWords an object containing the 4 pagination meanings & the user-defined words they use
 * @param {Object} variables the variables to forward onto the GraphQL server
 * */
export default function separateArgs(fieldSchema, reqASTArgs, paginationWords, variables) {
  if (!fieldSchema.args) {
    throw new Error(`${fieldSchema.name} does not support arguments. Check your GraphQL query.`);
  }
  const responseType = ensureTypeFromNonNull(fieldSchema.type);
  const regularArgs = {};
  const paginationArgs = {};
  const paginationWordKeys = Object.keys(paginationWords);
  const {acceptsPaginationArgs, acceptsRegularArgs} = acceptsArgs(fieldSchema, paginationWords, paginationWordKeys);
  let hasPagination = false;
  for (let i = 0; i < reqASTArgs.length; i++) {
    const arg = reqASTArgs[i];
    // if cashay added this argument, ignore it
    // TODO figure out another way. i hate checking constructors.
    if (arg.constructor.name === 'RequestArgument') continue;
    const argName = arg.name.value;
    if (!fieldSchema.args[argName]) {
      throw new Error(`${fieldSchema.name} does not support ${argName}`)
    }
    const argValue = getVariableValue(arg, variables);
    if (argValue === undefined) continue;
    let paginationMeaning = paginationWordKeys.find(pageWord => paginationWords[pageWord] === argName);
    if (paginationMeaning) {
      if (paginationMeaning === BEFORE || paginationMeaning === AFTER) {
        throw new Error(`Supplying pagination cursors to cashay is not supported. ${variables}`)
      }
      if (hasPagination === true) {
        throw new Error(`Only one pagination argument can be supplied at a time. ${variables}`)
      }
      if (responseType.kind !== LIST) {
        throw new Error(`${fieldSchema.name} is not a List. ${variables} should not contain pagination args`);
      }
      paginationArgs[paginationMeaning] = +argValue;
      hasPagination = true;
    } else {
      regularArgs[argName] = argValue;
    }
  }
  return {
    regularArgs: acceptsRegularArgs && regularArgs,
    paginationArgs: acceptsPaginationArgs && paginationArgs
  }
};
