import {VARIABLE} from 'graphql/language/kinds';
import {TypeKind} from 'graphql/type/introspection';
const {LIST} = TypeKind;
import {ensureTypeFromNonNull} from '../utils';

const FIRST = 'first';
const LAST = 'last';

const getSuppliedArgs = (args, variables = {}, paginationWords) => {
  const regularArgs = {};
  const paginationArgs = {};
  const paginationWordKeys = Object.keys(paginationWords);
  let hasPagination = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const argName = arg.name.value;
    let argValue = arg.value.kind === VARIABLE ? variables[arg.value.name.value] : arg.value.value;
    if (argValue === undefined) return;
    let paginationMeaning = paginationWordKeys.find(pageWord => paginationWords[pageWord] === argName);
    if (paginationMeaning) {
      if (paginationMeaning === FIRST || paginationMeaning === LAST) {
        argValue = parseInt(argValue);
      }
      paginationArgs[paginationMeaning] = argValue;
      hasPagination = true;
    } else {
      regularArgs[argName] = argValue;
    }
  }
  if (hasPagination) {
    const {before, after, first, last} = paginationArgs;
    if (before && !last || after && !first || before && first || after && last || before && after || first && last) {
      throw new Error('Pagination options are: `before, last` `after, first`, `first`, and `last`');
    }
  }
  return {regularArgs, paginationArgs};
};

const getPossibleArgs = (schema, paginationWords) => {
    if (!schema.args) return {};
    let acceptsRegularArgs = false;
    let acceptsPaginationArgs = false;
    const paginationWordSet = Object.keys(paginationWords)
      .reduce((reduction, key) => reduction.add(paginationWords[key]), new Set());
    const argKeys = Object.keys(schema.args);
    for (let argKey of argKeys) {
      const arg = schema.args[argKey];
      if (paginationWordSet.has(arg.name)) {
        acceptsPaginationArgs = true;
      } else {
        acceptsRegularArgs = true;
      }
    }
    return {acceptsRegularArgs, acceptsPaginationArgs};
  }
  ;

export const separateArgs = (fieldSchema, reqASTArgs, {paginationWords, variables}) => {
  const responseType = ensureTypeFromNonNull(fieldSchema.type);
  // TODO for a speed boost, we could just return the result of getSuppliedArgs, the rest is for safety
  const {acceptsRegularArgs, acceptsPaginationArgs} = getPossibleArgs(fieldSchema, paginationWords);
  let {regularArgs, paginationArgs} = getSuppliedArgs(reqASTArgs, variables, paginationWords);
  regularArgs = acceptsRegularArgs && regularArgs;
  paginationArgs = acceptsPaginationArgs && paginationArgs;
  if (paginationArgs && responseType.kind !== LIST) {
    console.warn(`${responseType} is not a List. Pagination args ignored`);
    paginationArgs = false;
  }
  return {regularArgs, paginationArgs}
};
