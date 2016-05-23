import fs from 'fs';
import clientSchema from './__tests__/clientSchema.json';
import normalizeResponse from './src/normalize/normalizeResponse';
import {buildExecutionContext} from './src/buildExecutionContext';
import namespaceMutation from './src/mutate/namespaceMutation';
import mergeMutations from './src/mutate/mergeMutations'
import {parse, clone} from './src/utils';
// import {parseSortPrint, sortPrint} from './__tests__/parseSortPrint';
// import {print} from 'graphql/language/printer';
// import createMutationFromQuery from './src/mutate/createMutationFromQuery';

import {
  unionQueryString,
  unionStoreFull,
  unionResponse
} from './src/normalize/__tests__/data-union';
import {paginationWords} from './src/normalize/__tests__/data';
import mergeStores from './src/normalize/mergeStores';
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
} from './src/normalize/__tests__/data-pagination-back';

import {
  front3Store,
  front2After3StoreFn
} from './src/normalize/__tests__/data-pagination-front';

import {
  fullPostStore,
  front4PostStore,
  back4PostStore,
  back1Store,
  front3Back1Store,
} from './src/normalize/__tests__/data-pagination';

const firstDocs = front3Store;
const lastDoc = front2After3StoreFn();
const actual = mergeStores(firstDocs, lastDoc);
const expected = fullPostStore;

debugger
fs.writeFileSync('./actualResult.json', JSON.stringify(actual, null, 2));
fs.writeFileSync('./expectedResult.json', JSON.stringify(expected, null, 2));
// console.log('string(actual) == string(expected):', JSON.stringify(actual, null, 2) === JSON.stringify(expected, null, 2))
// console.log(actual.result.getRecentPosts.front, expected.result.getRecentPosts.front)
// console.log('clone(actual) == clone(expected):', clone(actual) === clone(expected))
// console.log('actual == clone(expected):', actual === clone(expected))
// console.log('clone(actual) == expected:', clone(actual) === expected)
