import fs from 'fs';
import clientSchema from './__tests__/clientSchema.json';
import {mergeMutationASTs} from './src/mutate/mergeMutations';
import {parseSortPrint} from './__tests__/parseSortPrint';

import {parse} from './src/utils';
import {print} from 'graphql/language/printer';

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
} from './src/mutate/__tests__/mergeMutations-data';

import {namespaceSingleMutation} from './src/mutate/namespaceMutation';
const ast = parse(createPostWithCrazyFrags);
const state = {
  variables: {
    component1: {
      language: 'spanish'
    }
  }
}
const {operation, variableEnhancers} = namespaceSingleMutation(ast,'component1', state, clientSchema);
const str = print(operation)
console.log(str)
// fs.writeFileSync('./debugResults.js', `
// Actual:
//  ${JSON.stringify(actual, null, 2).split("\n").join("\n    ")}
//
//  Expected:
//  ${JSON.stringify(expected, null, 2).split("\n").join("\n    ")}
//
// `)
// console.log(foo)
