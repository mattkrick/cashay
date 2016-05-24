import test from 'ava';
import 'babel-register';
import clientSchema from '../../__tests__/clientSchema.json';
import normalizeResponse from '../normalizeResponse';
import {buildExecutionContext} from '../../buildExecutionContext';
import {unionQueryString, unionStoreFull, unionResponse} from './data-union';
import {clone} from '../../utils';

import {
  front3Query,
  front3Response,
  front3Store,
  front2After3Query,
  front1After3Response,
  front2After3StoreFn,
  front1After3Query,
  front1After3Store,
  front1After4Query,
  front1After4Response,
  front1After4StoreFn
} from './data-pagination-front';
import {
  back3Query,
  back3Response,
  back3Store,
  back2After3Query,
  back1After3Response,
  back2After3StoreFn,
  back1After3Query,
  back1After3Store,
  back1After4Query,
  back1After4Response,
  back1After4StoreFn
} from './data-pagination-back';
import {parse} from '../../utils';
import {paginationWords} from './data';

test('normalizes unions', t => {
  const queryAST = parse(unionQueryString);
  const context = buildExecutionContext(queryAST, {idFieldName: '_id', schema: clientSchema, paginationWords});
  const actual = normalizeResponse(unionResponse.data, context);
  const expected = unionStoreFull;
  t.deepEqual(actual, expected);
});


test('normalize pagination: front 3', t => {
  const queryAST = parse(front3Query);
  const context = buildExecutionContext(queryAST, {idFieldName: '_id', schema: clientSchema, paginationWords});
  const actual = normalizeResponse(front3Response.data, context);
  const expected = front3Store;
  t.deepEqual(actual, expected);
});

test('normalize pagination: request 2 after 3rd cursor, receive 1', t => {
  const queryAST = parse(front2After3Query);
  const context = buildExecutionContext(queryAST, {idFieldName: '_id', schema: clientSchema, paginationWords});
  const actual = normalizeResponse(clone(front1After3Response.data), context);
  const expected = front2After3StoreFn();
  t.deepEqual(actual, expected);
});

test('normalize pagination: request 1 after 3rd cursor, receive 1', t => {
  const queryAST = parse(front1After3Query);
  const context = buildExecutionContext(queryAST, {idFieldName: '_id', schema: clientSchema, paginationWords});
  const actual = normalizeResponse(clone(front1After3Response.data), context);
  const expected = front1After3Store;
  t.deepEqual(actual, expected);
});

test('normalize pagination: request doc 5 when it doesnt exist', t => {
  const queryAST = parse(front1After4Query);
  const context = buildExecutionContext(queryAST, {idFieldName: '_id', schema: clientSchema, paginationWords});
  const actual = normalizeResponse(clone(front1After4Response.data), context);
  const expected = front1After4StoreFn();
  t.deepEqual(actual, expected);
});

test('normalize back pagination: back 3', t => {
  const queryAST = parse(back3Query);
  const context = buildExecutionContext(queryAST, {idFieldName: '_id', schema: clientSchema, paginationWords});
  const actual = normalizeResponse(back3Response.data, context);
  const expected = back3Store;
  t.deepEqual(actual, expected);
});

test('normalize back pagination: request 2 after 3rd cursor, receive 1', t => {
  const queryAST = parse(back2After3Query);
  const context = buildExecutionContext(queryAST, {idFieldName: '_id', schema: clientSchema, paginationWords});
  const actual = normalizeResponse(clone(back1After3Response.data), context);
  const expected = back2After3StoreFn();
  t.deepEqual(actual, expected);
});

test('normalize back pagination: request 1 after 3rd cursor, receive 1', t => {
  const queryAST = parse(back1After3Query);
  const context = buildExecutionContext(queryAST, {idFieldName: '_id', schema: clientSchema, paginationWords});
  const actual = normalizeResponse(clone(back1After3Response.data), context);
  const expected = back1After3Store;
  t.deepEqual(actual, expected);
});

test('normalize back pagination: request doc 5 when it doesnt exist', t => {
  const queryAST = parse(back1After4Query);
  const context = buildExecutionContext(queryAST, {idFieldName: '_id', schema: clientSchema, paginationWords});
  const actual = normalizeResponse(clone(back1After4Response.data), context);
  const expected = back1After4StoreFn();
  t.deepEqual(actual, expected);
});
