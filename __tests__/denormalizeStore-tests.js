import test from 'ava';
import 'babel-register';
import 'babel-polyfill';
import {parse} from '../node_modules/graphql/language/parser';
import {buildExecutionContext} from '../buildExecutionContext';
import {unionQueryString, unionResponse, unionNormalized,
  unionQueryStringExtraTwitter, unionResponsePartialTwitter,
  unionNormalizedMissingOwner, unionResponseMissingOwner,
  unionQueryStringExtraOwner, initialState, initialStateResponse} from './_union';
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
 const unionOptions = {
   variables: nestedVariableValues,
   paginationWords: nestedPaginationWords,
   idFieldName: '_id',
   store: unionNormalized
 };
 const context = buildExecutionContext(clientSchema, unionQueryString, unionOptions);
 const denormalizedResponse = denormalizeStore(context);
 same(t,denormalizedResponse.data, unionResponse.data);
});

test('denormalize store with missing scalar data', t => {
  const unionOptions = {
    variables: nestedVariableValues,
    paginationWords: nestedPaginationWords,
    idFieldName: '_id',
    store: unionNormalized
  };
  const context = buildExecutionContext(clientSchema, unionQueryStringExtraTwitter, unionOptions);
  const denormalizedResponse = denormalizeStore(context);
  same(t,denormalizedResponse.data, unionResponsePartialTwitter.data);
});

test('denormalize store with initial state', t => {
  const unionOptions = {
    variables: nestedVariableValues,
    paginationWords: nestedPaginationWords,
    idFieldName: '_id',
    store: initialState
  };
  const context = buildExecutionContext(clientSchema, unionQueryStringExtraTwitter, unionOptions);
  const denormalizedResponse = denormalizeStore(context);
  same(t,denormalizedResponse.data, initialStateResponse.data);
});

test('denormalize store with missing entity', t => {
 const unionOptions = {
   variables: nestedVariableValues,
   paginationWords: nestedPaginationWords,
   idFieldName: '_id',
   store: nestedNormalizedNoFirstAuthor
 };
 const context = buildExecutionContext(clientSchema, nestedQueryString, unionOptions);
 const denormalizedResponse = denormalizeStore(context);
 same(t,denormalizedResponse.data, nestedResponseNoFirstAuthor);
});

test('denormalize store with missing array', t => {
 const unionOptions = {
   variables: nestedVariableValues,
   paginationWords: nestedPaginationWords,
   idFieldName: '_id',
   store: nestedNormalizedNoFirstComments
 };
 const context = buildExecutionContext(clientSchema, nestedQueryString, unionOptions);
 const denormalizedResponse = denormalizeStore(context);
 same(t,denormalizedResponse.data, nestedResponseNoFirstComments);
});

test('denormalize store with missing union', t => {
 const unionOptions = {
   variables: nestedVariableValues,
   paginationWords: nestedPaginationWords,
   idFieldName: '_id',
   store: unionNormalizedMissingOwner
 };
 const context = buildExecutionContext(clientSchema, unionQueryStringExtraOwner, unionOptions);
 const denormalizedResponse = denormalizeStore(context);
 same(t,denormalizedResponse.data, unionResponseMissingOwner.data);
});

test('denormalize store from nested request', t => {
 const nestedOptions = {
   variables: nestedVariableValues,
   paginationWords: nestedPaginationWords,
   idFieldName: '_id',
   store: nestedNormalized
 };
 const context = buildExecutionContext(clientSchema, nestedQueryString, nestedOptions);
 const denormalizedResponse = denormalizeStore(context);
 same(t,denormalizedResponse.data, nestedResponse);
});

// get subset of pagination docs saved

// get 3 pagination results when only 2 are local

//test adding __typename and idField to query auto
