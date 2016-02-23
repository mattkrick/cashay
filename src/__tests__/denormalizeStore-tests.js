import test from 'ava';
import 'babel-register';
import 'babel-polyfill';
import {parse} from 'graphql/language/parser';
import {buildExecutionContext} from '../buildExecutionContext';
import {unionQueryString, unionResponse, unionStore} from './unionExample';
import clientSchema from './clientSchema.json';
import {denormalizeStore} from '../denormalizeStore';
import {nestedQueryString, nestedResponse, nestedStore, nestedPaginationWords, nestedVariableValues} from './nestedExample';

test('denormalize store from union request', t => {
  t.plan(1);
  const queryAST = parse(unionQueryString, {noLocation: true, noSource: true});
  const unionOptions = {
    variableValues: nestedVariableValues,
    paginationWords: nestedPaginationWords,
    idFieldName: '_id',
    store: unionStore
  };
  const context = buildExecutionContext(clientSchema, queryAST, unionOptions);
  const denormalizedResponse = denormalizeStore(context);
  t.same(denormalizedResponse, unionResponse.data);
});

test('denormalize store from nested request', t => {
  const queryAST = parse(nestedQueryString, {noLocation: true, noSource: true});
  const nestedOptions = {
    variableValues: nestedVariableValues,
    paginationWords: nestedPaginationWords,
    idFieldName: '_id',
    store: nestedStore
  };
  const context = buildExecutionContext(clientSchema, queryAST, nestedOptions);
  const denormalizedResponse = denormalizeStore(context);
  t.same(denormalizedResponse, nestedResponse);
});

//TOOD test adding __typename and idField to query auto
