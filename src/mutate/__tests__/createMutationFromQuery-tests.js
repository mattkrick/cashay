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
  const actualAST = createMutationFromQuery(queryAST.definitions[0], 'createComment', {}, clientSchema);
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
  const actualAST = createMutationFromQuery(queryAST.definitions[0], 'createComment', variables, clientSchema);
  const actual = sortPrint(actualAST);
  t.is(actual, expected);
});

test('creates basic mutation from multi-part query', t => {
  const queryMultipleComments = `
  query($postId: String!, $postId2: String!) {
    comments: getCommentsByPostId(postId: $postId) {
      _id
    }
    comments2: getCommentsByPostId(postId: $postId2) {
      createdAt
    }
  }`;
  const mutationForMultipleComments = `
  mutation {
    createComment (_id: $_id, postId: $postId, content: $content) {
      _id
      createdAt
    }
  }`;
  
  const queryAST = parse(queryMultipleComments);
  const expected = parseSortPrint(mutationForMultipleComments);
  const variables = {
    _id: 'a321',
    postId: 'p123',
    content: 'X'
  };
  const actualAST = createMutationFromQuery(queryAST.definitions[0], 'createComment', variables, clientSchema);
  const actual = sortPrint(actualAST);
  t.is(actual, expected);
});

test('creates payload mutation including an object', t => {
  const queryPost = `
  query($first: Int!) {
    getRecentPosts(count: $first) {
      _id,
    }
  }`;
  const mutatePost = `
  mutation {
    createPost {
      post {
        _id
      }
    }
  }`;
  const queryAST = parse(queryPost);
  const expected = parseSortPrint(mutatePost);
  const actualAST = createMutationFromQuery(queryAST.definitions[0], 'createPost', {}, clientSchema);
  const actual = sortPrint(actualAST);
  t.is(actual, expected);
});

test('throws if no mutation can be created', t => {
  const queryAST = parse(queryPostCount);
  t.throws(() => createMutationFromQuery(queryAST.definitions[0], 'createPost', {}, clientSchema));
});

test('creates payload mutation including a scalar matched by name', t => {
  const queryPostCountAliased = `
  query {
    postCount: getPostCount
  }`;
  const mutatePostCount = `
  mutation {
    createPost {
      postCount
    }
  }`;
  const queryAST = parse(queryPostCountAliased);
  const expected = parseSortPrint(mutatePostCount);
  const actualAST = createMutationFromQuery(queryAST.definitions[0], 'createPost', {}, clientSchema);
  const actual = sortPrint(actualAST);
  t.is(actual, expected);
});

test('creates payload mutation including an object with args', t => {
  const queryPostWithFieldVars = `
  query($first: Int!, $defaultLanguage: String, $secondaryLanguage: String) {
    getRecentPosts(count: $first) {
      title(language: $defaultLanguage),
      secondaryTitle: title(language: $secondaryLanguage)
    }
  }`;
  const mutatePostWithFieldVars = `
  mutation {
    createPost {
      post {
        title(language: $defaultLanguage),
        secondaryTitle: title(language: $secondaryLanguage)
      }
    }
  }`;
  const queryAST = parse(queryPostWithFieldVars);
  const expected = parseSortPrint(mutatePostWithFieldVars);
  const actualAST = createMutationFromQuery(queryAST.definitions[0], 'createPost', {}, clientSchema);
  const actual = sortPrint(actualAST);
  t.is(actual, expected);
});

test('creates payload mutation when query has inline fragment', t => {
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
  t.is(actual, expected);
});

test('creates payload mutation from multi-part query', t => {
  const queryAST = parse(queryMultiplePosts);
  const expected = parseSortPrint(mutationForMultiplePosts);
  const actualAST = createMutationFromQuery(queryAST.definitions[0], 'createPost', {}, clientSchema);
  const actual = sortPrint(actualAST);
  t.is(actual, expected);
});
