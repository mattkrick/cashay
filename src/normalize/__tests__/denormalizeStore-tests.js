import test from 'ava';
import 'babel-register';
import {buildExecutionContext} from '../../utils';
import denormalizeStore from '../denormalizeStore';
import {
  unionQueryString,
  unionStoreFull,
  unionResponse,
  unionStoreMissingOwnerMembers,
  unionMissingOwnerMembersDenormalized
} from './data-union';
import {
  paginationWords,
  emptyInitialState,
  queryWithSortedArgs,
  responseFromSortedArgs,
  storeFromSortedArgs,
  queryPostCount,
  storedPostCount
} from './data';
import clientSchema from '../../__tests__/clientSchema.json';
import {
  back1Query,
  back1StoreNoCursor,
  back1NoCursorDenormalizedFn,
  back1QueryBadArgs,
  back1Store,
  back1Skip1Query,
  fullPostStore,
  front1After3DenormalizedFn,
  front4PostStore,
  front4PostStoreNoCursors,
  back4PostStoreNoLastCursor
} from './data-pagination';

import {back1After3Query,back1After3ResponseFn, back2After3Query} from './data-pagination-back'
import {front2After3Query, front3Store, front4Query, front3LocalResponseFn} from './data-pagination-front';
import {parse} from '../../utils';
import parseAndInitializeQuery from '../../query/parseAndInitializeQuery';

const idFieldName = '_id';

test('denormalize store from recursive union request', t => {
  const queryAST = parseAndInitializeQuery(unionQueryString, clientSchema, idFieldName);
  const context = buildExecutionContext(queryAST, {
    cashayDataState: unionStoreFull,
    idFieldName,
    schema: clientSchema,
    paginationWords
  });
  const {data: actual} = denormalizeStore(context);
  const {data: expected} = unionResponse;
  t.deepEqual(actual, expected);
});

test('denormalize store when the query returns a scalar (String)', t => {
  const queryAST = parseAndInitializeQuery(queryPostCount, clientSchema, idFieldName);
  const context = buildExecutionContext(queryAST, {
    cashayDataState: storedPostCount,
    idFieldName,
    schema: clientSchema,
    paginationWords
  });
  const {data: actual} = denormalizeStore(context);
  const expected = {"postCount": 4};
  t.deepEqual(actual, expected);
});

test('denormalize store with missing scalar data', t => {
  const queryAST = parseAndInitializeQuery(back1Query, clientSchema, idFieldName);
  const context = buildExecutionContext(queryAST, {
    cashayDataState: back1StoreNoCursor,
    idFieldName,
    schema: clientSchema,
    paginationWords
  });
  const {data: actual} = denormalizeStore(context);
  const expected = back1NoCursorDenormalizedFn();
  t.deepEqual(actual, expected);
});

test('denormalize store with missing entity and array', t => {
  const queryAST = parseAndInitializeQuery(unionQueryString, clientSchema, idFieldName);
  const context = buildExecutionContext(queryAST, {
    cashayDataState: unionStoreMissingOwnerMembers,
    idFieldName,
    schema: clientSchema,
    paginationWords
  });
  const {data: actual} = denormalizeStore(context);
  const expected = unionMissingOwnerMembersDenormalized;
  t.deepEqual(actual, expected);
});

test('throws on bad pagination args', t => {
  const queryAST = parseAndInitializeQuery(back1QueryBadArgs, clientSchema, idFieldName);
  const context = buildExecutionContext(queryAST, {
    cashayDataState: back1Store,
    idFieldName,
    schema: clientSchema,
    paginationWords
  });
  t.throws(() => denormalizeStore(context), 'Pagination options are: `before, last` `after, first`, `first`, and `last`');
});

test('denormalize store with scalar fields with args', t => {
  const queryAST = parseAndInitializeQuery(queryWithSortedArgs, clientSchema, idFieldName);
  const context = buildExecutionContext(queryAST, {
    cashayDataState: storeFromSortedArgs,
    idFieldName,
    schema: clientSchema,
    paginationWords,
    variables: {reverse: true, lang: "spanish"}
  });
  const {data: actual} = denormalizeStore(context);
  const {data: expected} = responseFromSortedArgs;
  t.deepEqual(actual, expected);
});

test('get a page from a full store (back)', t => {
  const queryAST = parseAndInitializeQuery(back1After3Query, clientSchema, idFieldName);
  const context = buildExecutionContext(queryAST, {
    cashayDataState: fullPostStore,
    idFieldName,
    schema: clientSchema,
    paginationWords,
    variables: {reverse: true, lang: "spanish"}
  });
  const {data: actual} = denormalizeStore(context);
  const {data: expected} = back1After3ResponseFn();
  t.deepEqual(actual, expected);
});

test('request next 2 docs when first 3 docs are in the store', t => {
  const queryAST = parseAndInitializeQuery(front2After3Query, clientSchema, idFieldName);
  const context = buildExecutionContext(queryAST, {
    cashayDataState: front4PostStore,
    idFieldName,
    schema: clientSchema,
    paginationWords,
    variables: {reverse: true, lang: "spanish"}
  });
  const {data: actual} = denormalizeStore(context);
  const {data: expected} = front1After3DenormalizedFn();
  t.deepEqual(actual, expected);
});

test('throw if no cursor is found for the afterCursor doc', t => {
  const queryAST = parseAndInitializeQuery(front2After3Query, clientSchema, idFieldName);
  const context = buildExecutionContext(queryAST, {
    cashayDataState: front4PostStoreNoCursors,
    idFieldName,
    schema: clientSchema,
    paginationWords,
    variables: {reverse: true, lang: "spanish"}
  });
  t.throws(() => denormalizeStore(context));
});

test('throw if no new cursor is found for the updated beforeCursor doc', t => {
  const queryAST = parseAndInitializeQuery(back2After3Query, clientSchema, idFieldName);
  const context = buildExecutionContext(queryAST, {
    cashayDataState: back4PostStoreNoLastCursor,
    idFieldName,
    schema: clientSchema,
    paginationWords,
    variables: {reverse: true, lang: "spanish"}
  });
  t.throws(() => denormalizeStore(context));
});

test('have 3, request 4, turn the request into 1 with a skip3 cursor', t => {
  const queryAST = parseAndInitializeQuery(front4Query, clientSchema, idFieldName);
  const context = buildExecutionContext(queryAST, {
    cashayDataState: front3Store,
    idFieldName,
    schema: clientSchema,
    paginationWords,
    variables: {reverse: true, lang: "spanish"}
  });
  const {data: actual} = denormalizeStore(context);
  const {data: expected} = front3LocalResponseFn();
  t.deepEqual(actual, expected);
});

test('request an array that does not exist in the state', t => {
  const queryAST = parseAndInitializeQuery(back1Query, clientSchema, idFieldName);
  const context = buildExecutionContext(queryAST, {
    cashayDataState: emptyInitialState,
    idFieldName,
    schema: clientSchema,
    paginationWords,
    variables: {reverse: true, lang: "spanish"}
  });
  const {data: actual} = denormalizeStore(context);
  const expected = {"getRecentPosts": []};
  t.deepEqual(actual, expected);
});
// get subset of pagination docs saved

// get 3 pagination results when only 2 are local
