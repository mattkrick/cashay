import test from 'ava';
import 'babel-register';
import 'babel-polyfill';
import {mergeDeepWithArrs} from '../mergeDeep';
import {front5Response, front5Query, front5Normalized, back5Response, back5Query, back5Normalized} from './frontAndBacks';
import clientSchema from './clientSchema.json';
import {normalizeResponse} from '../normalizeResponse';

const target = {
  foo: [{id: 1}, {id: 2, a: {a1: 2}}, {id: 3}],
  bar: {
    d: 4,
    e: 5
  }
};

const source = {
  foo: [{id: 2, a: {a1: 2}}, {id: 3}, {id: 4}],
  bar: {
    g: 7
  },
  baz: 1
};

const expected = {
  foo: [{id: 1}, {id: 2, a: {a1: 2}}, {id: 3}, {id: 4}],
  bar: {
    d: 4,
    e: 5,
    g: 7
  },
  baz: 1
};

test('merges plain objects & arrays', t => {
  t.plan(1);
  const actual = mergeDeepWithArrs(target, source);
  t.same(actual, expected);
});

test('merge front and back to full', t => {
  const queryASTfront = parse(front5Query, {noLocation: true, noSource: true});
  const contextFront = buildExecutionContext(clientSchema, queryASTfront, {idFieldName: '_id'});
  const normalizedResponseFront = normalizeResponse(front5Response.data, contextFront);
  const queryASTBack = parse(back5Query, {noLocation: true, noSource: true});
  const contextBack = buildExecutionContext(clientSchema, queryASTBack, {idFieldName: '_id'});
  const normalizedResponseBack = normalizeResponse(back5Response.data, contextBack);
  const newState = mergeDeepWithArrs(normalizedResponseFront, normalizedResponseBack);
});
//TODO merge into full if front & back overlap

//Maybe back shouldn't be reversed. Instead, we should prepend new things onto it instead of appending.
