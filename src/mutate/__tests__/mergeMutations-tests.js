import 'babel-register';
import test from 'ava';
import mergeMutations from '../mergeMutations';
import {parseSortPrint} from '../../__tests__/parseSortPrint';

import {
  parseAndNamespace,
  createCommentWithId,
  createPostWithPostTitleAndCount,
  createCommentWithContent,
  createPostWithDifferentId,
  createPostWithIncompleteArgs,
  createPostWithPostId,
  createPostWithSpanishTitle,
  typedInlineFrag1,
  typedInlineFrag2,
  createCommentWithId2,
  createPostWithBadArgKind
} from './mergeMutations-data';

/* Tests */
test('throws when merging 2 different mutations', t => {
  const cachedSingles = parseAndNamespace([createCommentWithId, createPostWithPostTitleAndCount]);
  t.throws(() => mergeMutations(cachedSingles));
});

test('throws when args are of a different kind', t => {
  const cachedSingles = parseAndNamespace([createPostWithBadArgKind, createPostWithIncompleteArgs]);
  t.throws(() => mergeMutations(cachedSingles));
});

test('merge fields from 2 simple mutation results', t => {
  const expectedRaw = `
  mutation($postId: String!, $content: String!) {
    createComment(postId: $postId, content: $content) {
      content
      _id
    }
  }`;
  const expected = parseSortPrint(expectedRaw);
  const cachedSingles = parseAndNamespace([createCommentWithId, createCommentWithContent]);
  const actual = parseSortPrint(mergeMutations(cachedSingles));
  t.is(actual, expected);
});

test('merge nested fields from 2 simple payloads', t => {
  const expectedRaw = `
  mutation {
    createPost(newPost: {_id: "129", author: "a123", content: "X", title:"Y", category:"hot stuff"}) {
      post {
        _id
        title
      }
      postCount
    }
  }`;
  const expected = parseSortPrint(expectedRaw);
  const cachedSingles = parseAndNamespace([createPostWithPostTitleAndCount, createPostWithPostId]);
  const actual = parseSortPrint(mergeMutations(cachedSingles));
  t.is(actual, expected);
});

test('merge mutation args', t => {
  const expectedRaw = `
  mutation {
    createPost(newPost: {_id: "129", author: "a123", content: "X", title:"Y", category:"hot stuff"}) {
      post {
        _id
      }
    }
  }`;
  const expected = parseSortPrint(expectedRaw);
  const cachedSingles = parseAndNamespace([createPostWithPostId, createPostWithIncompleteArgs]);
  const actual = parseSortPrint(mergeMutations(cachedSingles));
  t.is(actual, expected);
});

test('throw if incomplete mutation args have different values', t => {
  const cachedSingles = parseAndNamespace([createPostWithIncompleteArgs, createPostWithDifferentId]);
  t.throws(() => mergeMutations(cachedSingles));
});

test('add an alias when fields have conflicting args', t => {
  const expectedRaw = `
  mutation {
    createPost(newPost: {_id: "129", author: "a123", content: "X", title:"Y", category:"hot stuff"}) {
      post {
        CASHAY_component1_title: title(language:"spanish")
        title
      }
      postCount
    }
  }`;
  const expected = parseSortPrint(expectedRaw);
  const cachedSingles = parseAndNamespace([createPostWithPostTitleAndCount, createPostWithSpanishTitle]);
  const actual = parseSortPrint(mergeMutations(cachedSingles));
  t.is(actual, expected);
});

test('add an alias when fields have conflicting args (reverse order)', t => {
  const expectedRaw = `
  mutation {
    createPost(newPost: {_id: "129", author: "a123", content: "X", title:"Y", category:"hot stuff"}) {
      post {
        CASHAY_component0_title: title(language:"spanish")
        title
      }
      postCount
    }
  }`;
  const expected = parseSortPrint(expectedRaw);
  const cachedSingles = parseAndNamespace([createPostWithSpanishTitle, createPostWithPostTitleAndCount]);
  const actual = parseSortPrint(mergeMutations(cachedSingles));
  t.is(actual, expected);
});

test('merge a typed inline fragment into an existing one', t => {
  const expectedRaw = `
  mutation {
    createPost(newPost: {_id: "129"}) {
      post {
        ... on PostType {
          title
          category
        }
      }
    }
  }`;
  const expected = parseSortPrint(expectedRaw);
  const cachedSingles = parseAndNamespace([typedInlineFrag1, typedInlineFrag2]);
  const actual = parseSortPrint(mergeMutations(cachedSingles));
  t.is(actual, expected);
});

test('merge a typed inline fragment when the target does not have one', t => {
  const expectedRaw = `
  mutation {
    createPost(newPost: {_id: "129", author: "a123", content: "X", title:"Y", category:"hot stuff"}) {
      post {
        _id
        ... on PostType {
          title
        }
      }
    }
  }`;
  const expected = parseSortPrint(expectedRaw);
  const cachedSingles = parseAndNamespace([typedInlineFrag1, createPostWithPostId]);
  const actual = parseSortPrint(mergeMutations(cachedSingles));
  t.is(actual, expected);
});

test('merge a new variableDefinition', t => {
  const expectedRaw = `
  mutation($postId: String!, $content: String!, $_id: String!) {
    createComment(postId: $postId, content: $content, _id: $_id) {
      _id,
    }
  }`;
  const expected = parseSortPrint(expectedRaw);
  const cachedSingles = parseAndNamespace([createCommentWithId2, createCommentWithId]);
  const actual = parseSortPrint(mergeMutations(cachedSingles));
  t.is(actual, expected);
});
