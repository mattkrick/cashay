import 'babel-register';
import 'babel-polyfill';
import test from 'ava';
import clientSchema from '../../../__tests__/clientSchema.json';
import {mergeMutationASTs} from '../mergeMutations';
import {parseSortPrint} from '../../../__tests__/parseSortPrint';

import {
  creatCommentWithId,
  createPostWithPostTitleAndCount,
  creatCommentWithContent,
  createPostWithDifferentId,
  createPostWithIncompleteArgs,
  createPostWithPostId,
  createPostWithSpanishTitle,
  createPostWithCrazyFrags,
  createPostWithCrazyFrags2
} from './mergeMutations-data';

/* Tests */
test('throws when merging 2 different mutations', t => {
  const cachedSingles = {
    commentWithId: creatCommentWithId,
    postTitleCount: createPostWithPostTitleAndCount
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
    commentWithId: creatCommentWithId,
    commentWithContent: creatCommentWithContent
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
    postTitleCount: createPostWithPostTitleAndCount,
    postWithId: createPostWithPostId
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
    postWithId: createPostWithPostId,
    postWithIncompleteArgs: createPostWithIncompleteArgs
  };
  const actual = parseSortPrint(mergeMutationASTs(cachedSingles, clientSchema));
  t.is(actual, expected);
});

test('throw if incomplete mutation args have different values', t => {
  const cachedSingles = {
    postWithIncompleteArgs: createPostWithIncompleteArgs,
    postWithDifferentId: createPostWithDifferentId
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
    postTitleCount: createPostWithPostTitleAndCount,
    postSpanishTitle: createPostWithSpanishTitle
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
    postSpanishTitle: createPostWithSpanishTitle,
    postTitleCount: createPostWithPostTitleAndCount
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
    postCrazyFrags1: createPostWithCrazyFrags,
    postCrazyFrags2: createPostWithCrazyFrags2
  };
  const actual = parseSortPrint(mergeMutationASTs(cachedSingles, clientSchema));
  t.is(actual, expected);
});
