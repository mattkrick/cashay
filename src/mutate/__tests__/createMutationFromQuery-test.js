import 'babel-register';
import 'babel-polyfill';
import test from 'ava';
import clientSchema from '../../../__tests__/clientSchema.json';
import createMutationFromQuery from '../createMutationFromQuery';
import {parseSortPrint, sortPrint} from '../../../__tests__/parseSortPrint';
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
  mutatePostWithFieldVars
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
