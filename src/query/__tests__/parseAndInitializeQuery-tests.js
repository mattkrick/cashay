import test from 'ava';
import 'babel-register';
import parseAndInitializeQuery from '../parseAndInitializeQuery';
import clientSchema from '../../__tests__/clientSchema.json';
import {parseSortPrint, sortPrint} from '../../__tests__/parseSortPrint';
import {
  fragmentQueryString,
  inlineQueryString,
  inlineQueryStringWithoutId,
  unionQueryString,
  unionQueryStringWithoutTypename,
  unionQueryStringWithExtraTypenameId,
  queryWithUnsortedArgs,
  queryWithSortedArgs
} from './parseAndInitializeQuery-data';

test('inline a fragment spread', t => {
  const initializedAST = parseAndInitializeQuery(fragmentQueryString, clientSchema, '_id');
  const actual = sortPrint(initializedAST);
  const expected = parseSortPrint(inlineQueryString);
  t.deepEqual(actual, expected);
});

test('add an id field to the request', t => {
  const initializedAST = parseAndInitializeQuery(inlineQueryStringWithoutId, clientSchema, '_id');
  const actual = sortPrint(initializedAST);
  const expected = parseSortPrint(inlineQueryString);
  t.deepEqual(actual, expected);
});

test('add a __typename field to the union request', t => {
  const initializedAST = parseAndInitializeQuery(unionQueryStringWithoutTypename, clientSchema, '_id');
  const actual = sortPrint(initializedAST);
  const expected = parseSortPrint(unionQueryString);
  t.deepEqual(actual, expected);
});

test('remove extra __typename and id fields from fragments', t => {
  const initializedAST = parseAndInitializeQuery(unionQueryStringWithExtraTypenameId, clientSchema, '_id');
  const actual = sortPrint(initializedAST);
  const expected = parseSortPrint(unionQueryString);
  t.deepEqual(actual, expected);
});

test('sort arguments by name', t => {
  const initializedAST = parseAndInitializeQuery(queryWithUnsortedArgs, clientSchema, '_id');
  const actual = sortPrint(initializedAST);
  const expected = parseSortPrint(queryWithSortedArgs);
  t.deepEqual(actual, expected);
});
