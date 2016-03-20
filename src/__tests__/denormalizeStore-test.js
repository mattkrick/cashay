import test from 'ava';
import 'babel-register';
import 'babel-polyfill';
import {parse} from 'graphql/language/parser';
import {buildExecutionContext} from '../buildExecutionContext';
import {unionQueryString, unionResponse, unionNormalized,
  unionQueryStringExtraTwitter, unionResponsePartialTwitter,
  unionNormalizedMissingOwner, unionResponseMissingOwner,
  unionQueryStringExtraOwner} from './_union';
import clientSchema from './clientSchema.json';
import {denormalizeStore} from '../denormalizeStore';
import {nestedQueryString, nestedResponse, nestedNormalized,
  nestedPaginationWords, nestedVariableValues,
  nestedNormalizedNoFirstAuthor, nestedResponseNoFirstAuthor,
  nestedNormalizedNoFirstComments, nestedResponseNoFirstComments,} from './_nested';

export const same = (t, actual, expected, message) => {
  //fs.writeFileSync('avaTests.js', `
  //Actual:
  //  ${JSON.stringify(actual, null, 2).split("\n").join("\n    ")}
  //
  //  Expected:
  //  ${JSON.stringify(expected, null, 2).split("\n").join("\n    ")}
  //
  //`)

  return t.same(actual, expected, `

    ${message}

    Actual:
    ${JSON.stringify(actual, null, 2).split("\n").join("\n    ")}

    Expected:
    ${JSON.stringify(expected, null, 2).split("\n").join("\n    ")}

  `);
};

test('denormalize store from union request', t => {
  const queryAST = parse(unionQueryString, {noLocation: true, noSource: true});
  const unionOptions = {
    variableValues: nestedVariableValues,
    paginationWords: nestedPaginationWords,
    idFieldName: '_id',
    store: unionNormalized
  };
  const context = buildExecutionContext(clientSchema, queryAST, unionOptions);
  const denormalizedResponse = denormalizeStore(context);
  t.same(denormalizedResponse, unionResponse.data);
});

test('denormalize store with missing scalar data', t => {
  const queryAST = parse(unionQueryStringExtraTwitter, {noLocation: true, noSource: true});
  const unionOptions = {
    variableValues: nestedVariableValues,
    paginationWords: nestedPaginationWords,
    idFieldName: '_id',
    store: unionNormalized
  };
  const context = buildExecutionContext(clientSchema, queryAST, unionOptions);
  const denormalizedResponse = denormalizeStore(context);
  same(t,denormalizedResponse, unionResponsePartialTwitter.data);
});

test('denormalize store with missing entity', t => {
  const queryAST = parse(nestedQueryString, {noLocation: true, noSource: true});
  const unionOptions = {
    variableValues: nestedVariableValues,
    paginationWords: nestedPaginationWords,
    idFieldName: '_id',
    store: nestedNormalizedNoFirstAuthor
  };
  const context = buildExecutionContext(clientSchema, queryAST, unionOptions);
  const denormalizedResponse = denormalizeStore(context);
  same(t,denormalizedResponse, nestedResponseNoFirstAuthor);
});

test('denormalize store with missing array', t => {
  const queryAST = parse(nestedQueryString, {noLocation: true, noSource: true});
  const unionOptions = {
    variableValues: nestedVariableValues,
    paginationWords: nestedPaginationWords,
    idFieldName: '_id',
    store: nestedNormalizedNoFirstComments
  };
  const context = buildExecutionContext(clientSchema, queryAST, unionOptions);
  const denormalizedResponse = denormalizeStore(context);
  same(t,denormalizedResponse, nestedResponseNoFirstComments);
});

test('denormalize store with missing union', t => {
  const queryAST = parse(unionQueryStringExtraOwner, {noLocation: true, noSource: true});
  const unionOptions = {
    variableValues: nestedVariableValues,
    paginationWords: nestedPaginationWords,
    idFieldName: '_id',
    store: unionNormalizedMissingOwner
  };
  const context = buildExecutionContext(clientSchema, queryAST, unionOptions);
  const denormalizedResponse = denormalizeStore(context);
  same(t,denormalizedResponse, unionResponseMissingOwner.data);
});

test('denormalize store from nested request', t => {
  const queryAST = parse(nestedQueryString, {noLocation: true, noSource: true});
  const nestedOptions = {
    variableValues: nestedVariableValues,
    paginationWords: nestedPaginationWords,
    idFieldName: '_id',
    store: nestedNormalized
  };
  const context = buildExecutionContext(clientSchema, queryAST, nestedOptions);
  const denormalizedResponse = denormalizeStore(context);
  same(t,denormalizedResponse, nestedResponse);
});

//denorm store with missing array

// denorm store with missing union


// get subset of pagination docs saved

// get 3 pagination results when only 2 are local


//test adding __typename and idField to query auto
