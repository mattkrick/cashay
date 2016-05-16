import fs from 'fs';
import clientSchema from './__tests__/clientSchema.json';
import {mergeMutationASTs} from './src/mutate/mergeMutations';
import {parseSortPrint} from './__tests__/parseAndSort';

import {parse} from 'graphql/language/parser';
import {print} from 'graphql/language/printer';
import {
  creatCommentMutationWithId,
  createPostMutationWithPostTitleAndCount,
  creatCommentMutationWithContent,
  createPostMutationWithDifferentId,
  createPostMutationWithIncompleteArgs,
  createPostMutationWithPostId,
  createPostMutationWithSpanishTitle
} from './src/mutate/__tests__/mergeMutations-data';

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
fs.writeFileSync('./debugResults.js', `
Actual:
 ${JSON.stringify(actual, null, 2).split("\n").join("\n    ")}

 Expected:
 ${JSON.stringify(expected, null, 2).split("\n").join("\n    ")}

`)
// console.log(foo)
