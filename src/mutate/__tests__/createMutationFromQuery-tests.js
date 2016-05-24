import 'babel-register';
import test from 'ava';
import clientSchema from '../../__tests__/clientSchema.json';
import createMutationFromQuery from '../createMutationFromQuery';
import {parseSortPrint, sortPrint} from '../../__tests__/parseSortPrint';
import {parse} from '../../utils';

import {
  mutationForCommentQuery,
  mutationForCommentQueryNoVars,
  mutationForMultipleComments,
  queryCommentsForPostId,
  queryMultipleComments,
  queryPost,
  mutatePost,
  queryPostWithFieldVars,
  mutatePostWithFieldVars,
  queryPostCount,
  mutatePostCount,
  queryPostCountAliased,
  queryPostWithInlineFieldVars,
  mutatePostWithInlineFieldVars,
  queryMultiplePosts,
  mutationForMultiplePosts
} from './createMutationFromQuery-data';

test('creates basic mutation from a query of many comments', t => {
  const queryAST = parse(queryCommentsForPostId);
  const expected = parseSortPrint(mutationForCommentQueryNoVars);
  const actualAST = createMutationFromQuery(queryAST, 'createComment', {}, clientSchema);
  const actual = sortPrint(actualAST);
  t.is(actual, expected);
});

test('creates arguments from mutation variables', t => {
  const queryAST = parse(queryCommentsForPostId);
  const expected = parseSortPrint(mutationForCommentQuery);
  const variables = {
    _id: 'a321',
    postId: 'p123',
    content: 'X'
  };
  const actualAST = createMutationFromQuery(queryAST, 'createComment', variables, clientSchema);
  const actual = sortPrint(actualAST);
  t.is(actual, expected);
});

test('creates basic mutation from multi-part query', t => {
  const queryAST = parse(queryMultipleComments);
  const expected = parseSortPrint(mutationForMultipleComments);
  const variables = {
    _id: 'a321',
    postId: 'p123',
    content: 'X'
  };
  const actualAST = createMutationFromQuery(queryAST, 'createComment', variables, clientSchema);
  const actual = sortPrint(actualAST);
  t.is(actual, expected);
});

test('creates payload mutation including an object', t => {
  const queryAST = parse(queryPost);
  const expected = parseSortPrint(mutatePost);
  const actualAST = createMutationFromQuery(queryAST, 'createPost', {}, clientSchema);
  const actual = sortPrint(actualAST);
  t.is(actual, expected);
});

test('throws if no mutation can be created', t => {
  const queryAST = parse(queryPostCount);
  t.throws(() => createMutationFromQuery(queryAST, 'createPost', {}, clientSchema));
});

test('creates payload mutation including a scalar matched by name', t => {
  const queryAST = parse(queryPostCountAliased);
  const expected = parseSortPrint(mutatePostCount);
  const actualAST = createMutationFromQuery(queryAST, 'createPost', {}, clientSchema);
  const actual = sortPrint(actualAST);
  t.is(actual, expected);
});

test('creates payload mutation including an object with args', t => {
  const queryAST = parse(queryPostWithFieldVars);
  const expected = parseSortPrint(mutatePostWithFieldVars);
  const actualAST = createMutationFromQuery(queryAST, 'createPost', {}, clientSchema);
  const actual = sortPrint(actualAST);
  t.is(actual, expected);
});

test('creates payload mutation when query has inline fragment', t => {
  const queryAST = parse(queryPostWithInlineFieldVars);
  const expected = parseSortPrint(mutatePostWithInlineFieldVars);
  const actualAST = createMutationFromQuery(queryAST, 'createPost', {}, clientSchema);
  const actual = sortPrint(actualAST);
  t.is(actual, expected);
});

test('creates payload mutation from multi-part query', t => {
  const queryAST = parse(queryMultiplePosts);
  const expected = parseSortPrint(mutationForMultiplePosts);
  const actualAST = createMutationFromQuery(queryAST, 'createPost', {}, clientSchema);
  const actual = sortPrint(actualAST);
  t.is(actual, expected);
});
