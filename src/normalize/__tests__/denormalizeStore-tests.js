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
  storedPostCount,
  coerceTypes
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

import {back4,back4ResponseFn, back2After3Query} from './data-pagination-back'
import {front2After3Query, front3Store, front4Query, front3LocalResponseFn} from './data-pagination-front';
import {parse} from '../../utils';
import parseAndInitializeQuery from '../../query/parseAndInitializeQuery';

const idFieldName = '_id';

test('denormalize store from recursive union request', t => {
  const queryAST = parseAndInitializeQuery(unionQueryString, clientSchema, idFieldName);
  const context = buildExecutionContext(queryAST, {
    coerceTypes,
    getState: () => unionStoreFull,
    idFieldName,
    schema: clientSchema,
    paginationWords
  });
  const actual = denormalizeStore(context);
  const {data: expected} = unionResponse;
  t.deepEqual(actual, expected);
});

test('denormalize store when the query returns a scalar (String)', t => {
  const queryAST = parseAndInitializeQuery(queryPostCount, clientSchema, idFieldName);
  const context = buildExecutionContext(queryAST, {
    coerceTypes,
    getState: () => storedPostCount,
    idFieldName,
    schema: clientSchema,
    paginationWords
  });
  const actual = denormalizeStore(context);
  const expected = {"postCount": 4};
  t.deepEqual(actual, expected);
});

test('denormalize store with missing scalar data', t => {
  const queryAST = parseAndInitializeQuery(back1Query, clientSchema, idFieldName);
  const context = buildExecutionContext(queryAST, {
    coerceTypes,
    getState: () => back1StoreNoCursor,
    idFieldName,
    schema: clientSchema,
    paginationWords
  });
  const actual = denormalizeStore(context);
  const expected = back1NoCursorDenormalizedFn();
  t.deepEqual(actual, expected);
});

test('denormalize store with missing entity and array', t => {
  const queryAST = parseAndInitializeQuery(unionQueryString, clientSchema, idFieldName);
  const context = buildExecutionContext(queryAST, {
    coerceTypes,
    getState: () => unionStoreMissingOwnerMembers,
    idFieldName,
    schema: clientSchema,
    paginationWords
  });
  const actual = denormalizeStore(context);
  const expected = unionMissingOwnerMembersDenormalized;
  t.deepEqual(actual, expected);
});

test('throws on bad pagination args', t => {
  const queryAST = parseAndInitializeQuery(back1QueryBadArgs, clientSchema, idFieldName);
  const context = buildExecutionContext(queryAST, {
    coerceTypes,
    getState: () => back1Store,
    idFieldName,
    schema: clientSchema,
    paginationWords
  });
  t.throws(() => denormalizeStore(context), 'Supplying pagination cursors to cashay is not supported. undefined');
});

test('denormalize store with scalar fields with args', t => {
  const queryAST = parseAndInitializeQuery(queryWithSortedArgs, clientSchema, idFieldName);
  const context = buildExecutionContext(queryAST, {
    coerceTypes,
    getState: () => storeFromSortedArgs,
    idFieldName,
    schema: clientSchema,
    paginationWords,
    variables: {reverse: true, lang: "spanish"}
  });
  const actual = denormalizeStore(context);
  const {data: expected} = responseFromSortedArgs;
  t.deepEqual(actual, expected);
});

test('get a page from a full store (back)', t => {
  const queryAST = parseAndInitializeQuery(back4, clientSchema, idFieldName);
  const context = buildExecutionContext(queryAST, {
    coerceTypes,
    getState: () => fullPostStore,
    idFieldName,
    schema: clientSchema,
    paginationWords,
    variables: {reverse: true, lang: "spanish"}
  });
  const actual = denormalizeStore(context);
  const {data: expected} = back4ResponseFn(4);
  t.deepEqual(actual, expected);
});

test('request an array that does not exist in the state', t => {
  const queryAST = parseAndInitializeQuery(back1Query, clientSchema, idFieldName);
  const context = buildExecutionContext(queryAST, {
    coerceTypes,
    getState: () => emptyInitialState,
    idFieldName,
    schema: clientSchema,
    paginationWords,
    variables: {reverse: true, lang: "spanish"}
  });
  const actual = denormalizeStore(context);
  const expected = {"getRecentPosts": []};
  t.deepEqual(actual, expected);
});

test('flag sendToServer = true for array of objects', t => {
  const rawQuery = `
  query {
    getPostById (_id: "p126") {
      _id
      keywordsMentioned {
        word
      }
    }
  }`;
  const queryAST = parseAndInitializeQuery(rawQuery, clientSchema, idFieldName);
  const context = buildExecutionContext(queryAST, {
    coerceTypes,
    getState: () => emptyInitialState,
    idFieldName,
    schema: clientSchema
  });
  denormalizeStore(context);
  //                                    getPostById ->           keywordsMentioned ->       word
  t.true(context.operation.selectionSet.selections[0].selectionSet.selections[1].selectionSet.selections[0].sendToServer);
});

test('Same query with another argument', t => {
  const rawQuery = `
  query {
    getCommentsByPostId {
      _id
      postId
      content
    }
  }`;
  const queryAST = parseAndInitializeQuery(rawQuery, clientSchema, idFieldName);
  const context = buildExecutionContext(queryAST, {
    variables: {"postId": "p126"},
    coerceTypes,
    getState: () => ({entities:{}, result: {getCommentsByPostId: {'"postId": "p123"':[]}}}),
    idFieldName,
    paginationWords,
    schema: clientSchema
  });
  const actual = denormalizeStore(context);
  const expected = {getCommentsByPostId:[{_id:null,postId:null,content:null}]}
  t.deepEqual(actual, expected)
});
