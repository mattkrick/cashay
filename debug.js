import fs from 'fs';
import clientSchema from './__tests__/clientSchema.json';
// import {mergeMutationASTs} from './src/mutate/mergeMutations';
import namespaceMutation from './src/mutate/namespaceMutation';
import mergeMutations from './src/mutate/mergeMutations'
import {parseSortPrint, sortPrint} from './__tests__/parseSortPrint';
import {parse} from './src/utils';
import {print} from 'graphql/language/printer';
import createMutationFromQuery from './src/mutate/createMutationFromQuery';

import {
  mutationForCommentQuery,
  mutationForCommentQueryNoVars,
  mutationForMultipleComments,
  queryCommentsForPostId,
  queryMultipleComments,
  queryPost,
  mutatePost,
  queryPostCount,
  mutatePostCount,
  queryPostWithInlineFieldVars,
  mutatePostWithFieldVars,
  mutatePostWithInlineFieldVars

} from './src/mutate/__tests__/createMutationFromQuery-data';
const expectedAST = parse(mutatePostWithFieldVars);

const queryAST = parse(queryPostCount);
const expected = parseSortPrint(mutatePostCount);
const actualAST = createMutationFromQuery(queryAST, 'createPost', {}, clientSchema);
const actual = sortPrint(actualAST);

fs.writeFileSync('./actualResult.json', JSON.stringify(actual, null, 2).split("\n").join("\n    "));
fs.writeFileSync('./expectedResult.json', JSON.stringify(expected, null, 2).split("\n").join("\n    "));
