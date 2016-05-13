import fs from 'fs';
import clientSchema from './__tests__/clientSchema.json';
import {mergeStringSet} from './src/mergeMutations';
import {parse} from 'graphql/language/parser';
import {print} from 'graphql/language/printer';

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
        _id
        title
        content
      }
      postCount
    }
  }`;
// const mutationStringSet = new Set([createPostMutation1,creatCommentMutation1]);
const mutationStringSet = new Set([creatCommentMutation1, createPostMutation1]);
const foo = mergeStringSet(mutationStringSet, clientSchema);
// fs.writeFileSync('./debugResults.js', `
// Actual:
//  ${JSON.stringify(actual, null, 2).split("\n").join("\n    ")}
//
//  Expected:
//  ${JSON.stringify(expected, null, 2).split("\n").join("\n    ")}
//
// `)
console.log(foo)
