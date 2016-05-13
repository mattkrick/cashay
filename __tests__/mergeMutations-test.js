import 'babel-register';
import 'babel-polyfill';
import test from 'ava';
import clientSchema from './clientSchema.json';
import {mergeStringSet} from '../src/mergeMutations';
import {parse} from 'graphql/language/parser';
import {print} from 'graphql/language/printer';

/* Setup */
const creatCommentMutation1 = `
  mutation($postId: String!, $content: String!) {
    createComment(postId: $postId, content: $content) {
      _id,
      content,
      karma
    }
  }`;
const creatCommentMutation2 = `
  mutation($postId: String!, $content: String!) {
    createComment(postId: $postId, content: $content) {
      _id,
      content,
      createdAt
    }
  }`;
const createPostMutation1 = `
  mutation {
    createPost(newPost: {_id: "129", author: "a123", content: "X", title:"Y", category:"hot stuff"}) {
      post {
        title
        content
      }
      postCount
    }
  }`;
const createPostMutation2 = `
  mutation {
    createPost(newPost: {_id: "129", author: "a123", content: "X", title:"Y", category:"hot stuff"}) {
      post {
        _id
      }
    }
  }`;

/* Tests */
test('throws when merging 2 different mutations', t => {
  const mutationStringSet = new Set([creatCommentMutation1, createPostMutation1]);
  t.throws(() => mergeStringSet(mutationStringSet, clientSchema));
});

test('merge fields from 2 simple mutation results', t => {
  const expectedRaw = `
  mutation($postId: String!, $content: String!) {
    createComment(postId: $postId, content: $content) {
      _id,
      content,
      createdAt,
      karma
    }
  }`;
  const expected = print(parse(expectedRaw));
  const mutationStringSet = new Set([creatCommentMutation1, creatCommentMutation2]);
  const actual = mergeStringSet(mutationStringSet, clientSchema);
  t.is(actual, expected);
});

test('merge nested fields from 2 simple payloads', t => {
  const expectedRaw = `
  mutation {
    createPost(newPost: {_id: "129", author: "a123", content: "X", title:"Y", category:"hot stuff"}) {
      post {
        _id
        title
        content
      }
      postCount
    }
  }`;
  const expected = print(parse(expectedRaw));
  const mutationStringSet = new Set([createPostMutation1, createPostMutation2]);
  const actual = mergeStringSet(mutationStringSet, clientSchema);
  t.is(actual, expected);
});

