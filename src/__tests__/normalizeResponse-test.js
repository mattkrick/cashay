import test from 'ava';
import 'babel-register';
import 'babel-polyfill';
import '../normalizeResponse';
import {unionQueryString, unionResponse, unionStore} from './unionExample';
import clientSchema from './clientSchema.json';
import {normalizeResponse} from '../normalizeResponse';
import {parse} from 'graphql/language/parser';
import {buildExecutionContext} from '../buildExecutionContext';
import {nestedQueryString, nestedResponse, nestedStore, nestedPaginationWords, nestedVariableValues} from './nestedExample';
import {front5Response, front5Query, front5Normalized, back5Response, back5Query, back5Normalized} from './frontAndBacks';

test('normalizes unions', t => {
  t.plan(1);
  const queryAST = parse(unionQueryString, {noLocation: true, noSource: true});
  const context = buildExecutionContext(clientSchema, queryAST, {idFieldName: '_id'});
  const normalizedResponse = normalizeResponse(unionResponse.data, context);
  t.same(normalizedResponse, unionStore);
});

test('normalizes nests with pagination words and variables', t => {
  t.plan(1);
  const queryAST = parse(nestedQueryString, {noLocation: true, noSource: true});
  const nestedOptions = {
    variableValues: nestedVariableValues,
    paginationWords: nestedPaginationWords,
    idFieldName: '_id'
  };
  const context = buildExecutionContext(clientSchema, queryAST, nestedOptions);
  const normalizedResponse = normalizeResponse(nestedResponse, context);
  t.same(normalizedResponse, nestedStore);
});

test('normalize front 5', t => {
  t.plan(1);
  const queryAST = parse(front5Query, {noLocation: true, noSource: true});
  const context = buildExecutionContext(clientSchema, queryAST, {idFieldName: '_id'});
  const normalizedResponse = normalizeResponse(front5Response.data, context);
  t.same(normalizedResponse, front5Normalized);
});

test('normalize back 5', t => {
  t.plan(1);
  const queryAST = parse(back5Query, {noLocation: true, noSource: true});
  const context = buildExecutionContext(clientSchema, queryAST, {idFieldName: '_id'});
  const normalizedResponse = normalizeResponse(back5Response.data, context);
  console.log(JSON.stringify(normalizedResponse, null, 2));
  t.same(normalizedResponse, back5Normalized);
});

//TODO test adding to pagination request
//TODO merge front and back when possible
