import test from 'ava';
import 'babel-register';
import {buildExecutionContext} from '../../buildExecutionContext';
import denormalizeStore from '../denormalizeStore';
import {
  unionQueryString,
  unionStoreFull,
  unionResponse,
  unionStoreMissingOwnerMembers,
  unionMissingOwnerMembersDenormalized
} from './data-union';
import {paginationWords} from './data';
import clientSchema from '../../../__tests__/clientSchema.json';
import {back1Query, back1StoreNoCursor, back1NoCursorDenormalizedFn} from './data-pagination';

import {parse} from '../../utils';
import parseAndInitializeQuery from '../../query/parseAndInitializeQuery';

const idFieldName = '_id';

test('normalize store from recursive union request', t => {
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

test('normalize store with missing scalar data', t => {
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

test('normalize store with missing entity and array', t => {
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

// get subset of pagination docs saved

// get 3 pagination results when only 2 are local
