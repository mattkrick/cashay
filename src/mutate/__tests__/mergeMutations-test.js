import 'babel-register';
import 'babel-polyfill';
import test from 'ava';
import clientSchema from '../../../__tests__/clientSchema.json';
import {mergeMutationASTs} from '../mergeMutations';
import {parseSortPrint} from '../../../__tests__/parseAndSort';

import {
  creatCommentMutationWithId,
  createPostMutationWithPostTitleAndCount,
  creatCommentMutationWithContent,
  createPostMutationWithDifferentId,
  createPostMutationWithIncompleteArgs,
  createPostMutationWithPostId,
  createPostMutationWithSpanishTitle,
  createPostMutationWithCrazyFrags,
  createPostMutationWithCrazyFrags2
} from './mergeMutations-data';

/* Tests */
test('throws when merging 2 different mutations', t => {
  const cachedSingles = {
    commentWithId: creatCommentMutationWithId,
    postTitleCount: createPostMutationWithPostTitleAndCount
  };
  t.throws(() => mergeMutationASTs(cachedSingles, clientSchema));
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
  const cachedSingles = {
    commentWithId: creatCommentMutationWithId,
    commentWithContent: creatCommentMutationWithContent
  };
  const actual = parseSortPrint(mergeMutationASTs(cachedSingles, clientSchema));
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
  const cachedSingles = {
    postTitleCount: createPostMutationWithPostTitleAndCount,
    postWithId: createPostMutationWithPostId
  };
  const actual = parseSortPrint(mergeMutationASTs(cachedSingles, clientSchema));

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
  const cachedSingles = {
    postWithId: createPostMutationWithPostId,
    postWithIncompleteArgs: createPostMutationWithIncompleteArgs
  };
  const actual = parseSortPrint(mergeMutationASTs(cachedSingles, clientSchema));
  t.is(actual, expected);
});

test('throw if incomplete mutation args have different values', t => {
  const cachedSingles = {
    postWithIncompleteArgs: createPostMutationWithIncompleteArgs,
    postWithDifferentId: createPostMutationWithDifferentId
  };
  t.throws(() => mergeMutationASTs(cachedSingles, clientSchema));
});

test('add an alias when fields have conflicting args', t => {
  const expectedRaw = `
  mutation {
    createPost(newPost: {_id: "129", author: "a123", content: "X", title:"Y", category:"hot stuff"}) {
      post {
        cashay_title_postSpanishTitle: title(language:"spanish")
        title
      }
      postCount
    }
  }`;
  const expected = parseSortPrint(expectedRaw);
  const cachedSingles = {
    postTitleCount: createPostMutationWithPostTitleAndCount,
    postSpanishTitle: createPostMutationWithSpanishTitle
  };
  const actual = parseSortPrint(mergeMutationASTs(cachedSingles, clientSchema));
  t.is(actual, expected);
});

test('add an alias when fields have conflicting args (reverse order)', t => {
  const expectedRaw = `
  mutation {
    createPost(newPost: {_id: "129", author: "a123", content: "X", title:"Y", category:"hot stuff"}) {
      post {
        cashay_title_postSpanishTitle: title(language:"spanish")
        title
      }
      postCount
    }
  }`;
  const expected = parseSortPrint(expectedRaw);
  const cachedSingles = {
    postSpanishTitle: createPostMutationWithSpanishTitle,
    postTitleCount: createPostMutationWithPostTitleAndCount
  };
  const actual = parseSortPrint(mergeMutationASTs(cachedSingles, clientSchema));
  t.is(actual, expected);
});

test('add an alias when fields have conflicting args within fragments', t => {
  const expectedRaw = `
  mutation {
    createPost(newPost: {_id: "129", author: "a123", content: "Hii", title:"Sao", category:"hot stuff"}) {
      post {
        ...{
          _id
        }
        ...spreadLevel1
      }
    }
  }
  fragment spreadLevel1 on PostType {
      ... {
        category
        ...spreadLevel2
      }
  }
  fragment spreadLevel2 on PostType {
    cashay_title_postCrazyFrags2: title(language:"spanish")
  }`;
  const expected = parseSortPrint(expectedRaw);
  const cachedSingles = {
    postCrazyFrags1: createPostMutationWithCrazyFrags,
    postCrazyFrags2: createPostMutationWithCrazyFrags2
  };
  const actual = parseSortPrint(mergeMutationASTs(cachedSingles, clientSchema));
  t.is(actual, expected);
});
