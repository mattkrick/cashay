import fs from 'fs';
import clientSchema from './src/__tests__/clientSchema.json';
import {parseSortPrint, sortPrint} from './src/__tests__/parseSortPrint';
import normalizeResponse from './src/normalize/normalizeResponse';
import namespaceMutation from './src/mutate/namespaceMutation';
import mergeMutations from './src/mutate/mergeMutations'
import {parse, clone, buildExecutionContext} from './src/utils';
import {queryPostCount, storedPostCount} from './src/normalize/__tests__/data';
// import {parseSortPrint, sortPrint} from './__tests__/parseSortPrint';
// import {print} from 'graphql/language/printer';
// import createMutationFromQuery from './src/mutate/createMutationFromQuery';

import {
  unionStoreFull,
  unionResponse,
  unionQueryString,
  unionStoreMissingOwner
} from './src/normalize/__tests__/data-union';
import mergeStores from './src/normalize/mergeStores';
import {
  back3Query,
  back3Response,
  back3Store,
  back2After3Query,
  back1After3Response,
  back2After3StoreFn,
  back4,
  back1After3Store,
  back1After4Query,
  back1After4Response,
  back1After4StoreFn,
  back4ResponseFn,
} from './src/normalize/__tests__/data-pagination-back';

import {
  front3Store,
  front2After3StoreFn,
  front1After3Response,
  front3LocalResponseFn,
  front1After4StoreFn
} from './src/normalize/__tests__/data-pagination-front';

import {
  fullPostStore,
  front4PostStore,
  back4PostStore,
  back1Store,
  front3Back1Store,
  back1Query,
  back1StoreNoCursor,
  back1QueryBadArgs,
  front4PostStoreNoCursors,
  back4PostStoreNoLastCursor,
  back1NoCursorDenormalizedFn,
  front1After3DenormalizedFn
} from './src/normalize/__tests__/data-pagination';
import parseAndInitializeQuery from './src/query/parseAndInitializeQuery';
import {
  fragmentQueryString,
  inlineQueryString,
  inlineQueryStringWithoutId,
  unionQueryStringWithoutTypename,
  queryWithUnsortedArgs,
} from './src/query/__tests__/parseAndInitializeQuery-data';
import denormalizeStore from './src/normalize/denormalizeStore';
import {
  paginationWords,
  emptyInitialState,
  queryWithSortedArgs,
  responseFromSortedArgs,
  storeFromSortedArgs
} from './src/normalize/__tests__/data';
import {front2After3Query, front4Query, front3Response} from './src/normalize/__tests__/data-pagination-front';
import removeNamespacing from './src/mutate/removeNamespacing';

import {
  createCommentWithId,
  createCommentDifferentArg,
  mixHardSoftArgs,
  createMembers,
  nestedFragmentSpreads,
  postSpanishTitle,
  postSpanishTitleVars,
  mixPostFieldArgs,
  badArg
} from './src/mutate/__tests__/namespaceMutation-data';

import {
  mutationForCommentQueryNoVars,
  queryCommentsForPostId,
} from './src/mutate/__tests__/createMutationFromQuery-data';
import createMutationFromQuery from './src/mutate/createMutationFromQuery';

import {
  parseAndNamespace,
  createPostWithIncompleteArgs,
  createPostWithPostId,createCommentWithId2
} from './src/mutate/__tests__/mergeMutations-data';
const idFieldName = '_id';
const queryPostWithInlineFieldVars = `
  query($first: Int!, $defaultLanguage: String, $secondaryLanguage: String) {
    getRecentPosts(count: $first) {
      ... on PostType {
        title(language: $defaultLanguage),
        secondaryTitle: title(language: $secondaryLanguage)
      }
    }
  }`;
const mutatePostWithInlineFieldVars = `
  mutation {
    createPost {
      post {
        ... on PostType {
          title(language: $defaultLanguage),
          secondaryTitle: title(language: $secondaryLanguage)
        }
      }
    }
  }`;
const queryAST = parse(queryPostWithInlineFieldVars);
const expected = parseSortPrint(mutatePostWithInlineFieldVars);
const actualAST = createMutationFromQuery(queryAST.definitions[0], 'createPost', {}, clientSchema);
const actual = sortPrint(actualAST);
fs.writeFileSync('./actualResult.json', JSON.stringify(actual, null, 2));
fs.writeFileSync('./expectedResult.json', JSON.stringify(expected, null, 2));
