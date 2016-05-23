import test from 'ava';
import 'babel-register';
import {buildExecutionContext} from '../../buildExecutionContext';
import denormalizeStore from '../denormalizeStore';
import {unionQueryString, unionStoreFull, unionResponse} from './data-union';
import {parse} from '../../utils';

test('normalize store from recursive union request', t => {
  const queryAST = parse(unionQueryString);
  const context = buildExecutionContext(queryAST, unionStoreFull, {idFieldName: '_id'});
  const denormalizedResponse = denormalizeStore(context);
  t.deepEqual(denormalizedResponse.data, unionResponse.data);
});

// test('normalize store with missing scalar data', t => {
//   const unionOptions = {
//     variables: nestedVariableValues,
//     paginationWords: nestedPaginationWords,
//     idFieldName: '_id',
//     store: unionNormalized
//   };
//   const context = buildExecutionContext(clientSchema, unionQueryStringExtraTwitter, unionOptions);
//   const denormalizedResponse = denormalizeStore(context);
//   same(t, denormalizedResponse.data, unionResponsePartialTwitter.data);
// });
//
// test('normalize store with initial state', t => {
//   const unionOptions = {
//     variables: nestedVariableValues,
//     paginationWords: nestedPaginationWords,
//     idFieldName: '_id',
//     store: initialState
//   };
//   const context = buildExecutionContext(clientSchema, unionQueryStringExtraTwitter, unionOptions);
//   const denormalizedResponse = denormalizeStore(context);
//   same(t, denormalizedResponse.data, initialStateResponse.data);
// });
//
// test('normalize store with missing entity', t => {
//   const unionOptions = {
//     variables: nestedVariableValues,
//     paginationWords: nestedPaginationWords,
//     idFieldName: '_id',
//     store: nestedNormalizedNoFirstAuthor
//   };
//   const context = buildExecutionContext(clientSchema, nestedQueryString, unionOptions);
//   const denormalizedResponse = denormalizeStore(context);
//   same(t, denormalizedResponse.data, nestedResponseNoFirstAuthor);
// });
//
// test('normalize store with missing array', t => {
//   const unionOptions = {
//     variables: nestedVariableValues,
//     paginationWords: nestedPaginationWords,
//     idFieldName: '_id',
//     store: nestedNormalizedNoFirstComments
//   };
//   const context = buildExecutionContext(clientSchema, nestedQueryString, unionOptions);
//   const denormalizedResponse = denormalizeStore(context);
//   same(t, denormalizedResponse.data, nestedResponseNoFirstComments);
// });
//
// test('normalize store with missing union', t => {
//   const unionOptions = {
//     variables: nestedVariableValues,
//     paginationWords: nestedPaginationWords,
//     idFieldName: '_id',
//     store: unionNormalizedMissingOwner
//   };
//   const context = buildExecutionContext(clientSchema, unionQueryStringExtraOwner, unionOptions);
//   const denormalizedResponse = denormalizeStore(context);
//   same(t, denormalizedResponse.data, unionResponseMissingOwner.data);
// });
//
// test('normalize store from nested request', t => {
//   const nestedOptions = {
//     variables: nestedVariableValues,
//     paginationWords: nestedPaginationWords,
//     idFieldName: '_id',
//     store: nestedNormalized
//   };
//   const context = buildExecutionContext(clientSchema, nestedQueryString, nestedOptions);
//   const denormalizedResponse = denormalizeStore(context);
//   same(t, denormalizedResponse.data, nestedResponse);
// });

// get subset of pagination docs saved

// get 3 pagination results when only 2 are local

//test adding __typename and idField to query auto
