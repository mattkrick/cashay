import fs from 'fs';
import clientSchema from './__tests__/clientSchema.json';
// import {mergeMutationASTs} from './src/mutate/mergeMutations';
import namespaceMutation from './src/mutate/namespaceMutation';
import {parseSortPrint, sortPrint} from './__tests__/parseSortPrint';

import {parse} from './src/utils';
import {print} from 'graphql/language/printer';

import {
  createCommentWithId,
  createCommentDifferentArg,
  createMembers,
  nestedFragmentSpreads,
  mixHardSoftArgs,
  postSpanishTitleVars,
  mixPostFieldArgs
} from './src/mutate/__tests__/namespaceMutation-data';

const expectedRaw = `
  mutation($CASHAY_component1_day: Boolean, $CASHAY_component1_year: Boolean) {
    createPost(newPost: {_id: "123"}) {
      post {
        CASHAY_component1_createdAt: createdAt(dateOptions: {day: $day, month: true, year: $year})
      }
    }
  }`;
const expected = parseSortPrint(expectedRaw);
const mutationAST = parse(mixPostFieldArgs);
const {namespaceAST} = namespaceMutation(mutationAST, 'component1', {}, clientSchema);
const actual = sortPrint(namespaceAST);


fs.writeFileSync('./debugResults.js', `
Actual:
 ${JSON.stringify(actual, null, 2).split("\n").join("\n    ")}

 Expected:
 ${JSON.stringify(expected, null, 2).split("\n").join("\n    ")}

`)
// console.log(foo)
