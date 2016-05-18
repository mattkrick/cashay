import fs from 'fs';
import clientSchema from './__tests__/clientSchema.json';
// import {mergeMutationASTs} from './src/mutate/mergeMutations';
import namespaceMutation from './src/mutate/namespaceMutation';
import mergeMutations from './src/mutate/mergeMutations'
import {parseSortPrint, sortPrint} from './__tests__/parseSortPrint';
import {parse} from './src/utils';
import {print} from 'graphql/language/printer';

import {
  parseAndNamespace,
  createPostWithPostTitleAndCount,
  createPostWithPostId,
  createPostWithSpanishTitle
} from './src/mutate/__tests__/mergeMutations-data';

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
const cachedSingles = parseAndNamespace([createPostWithPostTitleAndCount,createPostWithSpanishTitle]);
const actual = parseSortPrint(mergeMutations(cachedSingles));


fs.writeFileSync('./debugResults.js', `
Actual:
 ${JSON.stringify(actual, null, 2).split("\n").join("\n    ")}

 Expected:
 ${JSON.stringify(expected, null, 2).split("\n").join("\n    ")}

`)
// console.log(foo)
