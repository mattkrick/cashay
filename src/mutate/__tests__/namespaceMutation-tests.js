import 'babel-register';
import test from 'ava';
import clientSchema from '../../__tests__/clientSchema.json';
import namespaceMutation from '../namespaceMutation';
import {parseSortPrint, sortPrint} from '../../__tests__/parseSortPrint';
import {parse} from '../../utils';

import {
  createCommentWithId,
  createCommentDifferentArg,
  mixHardSoftArgs,
  createMembers,
  nestedFragmentSpreads,
  postSpanishTitle,
  postSpanishTitleVars,
  mixPostFieldArgs,
  badArg
} from './namespaceMutation-data';

/* variableDefinitions Tests */
test('creates simple variableDefinitions from mutation arguments, ignore hardcoded args', t => {
  const expectedRaw = `
  mutation($postId: String!) {
    createComment(postId: $postId, content: "foo") {
      _id,
    }
  }`;
  const expected = parseSortPrint(expectedRaw);
  const mutationAST = parse(createCommentWithId);
  const {namespaceAST} = namespaceMutation(mutationAST, 'component1', {}, clientSchema);
  const actual = sortPrint(namespaceAST);
  t.is(actual, expected);
});

test('throws when trying to pass in a bogus argument', t => {
  const mutationAST = parse(badArg);
  t.throws(() => namespaceMutation(mutationAST, 'component1', {}, clientSchema));
});

test('creates variableDefinitions with different names', t => {
  const expectedRaw = `
  mutation($postIdz: String!) {
    createComment(postId: $postIdz) {
      _id,
    }
  }`;
  const expected = parseSortPrint(expectedRaw);
  const mutationAST = parse(createCommentDifferentArg);
  const {namespaceAST} = namespaceMutation(mutationAST, 'component1', {}, clientSchema);
  const actual = sortPrint(namespaceAST);
  t.is(actual, expected);
});

test('allows for variables inside hardcoded object args', t => {
  const expectedRaw = `
  mutation($postIdz: String!) {
    createPost(newPost: {_id: $postIdz}) {
      _id,
    }
  }`;
  const expected = parseSortPrint(expectedRaw);
  const mutationAST = parse(mixHardSoftArgs);
  const {namespaceAST} = namespaceMutation(mutationAST, 'component1', {}, clientSchema);
  const actual = sortPrint(namespaceAST);
  t.is(actual, expected);
});

test('creates required list variableDefinitions from mutation arguments', t => {
  const expectedRaw = `mutation ($newMembers: [NewMember!]!) {
    createMembers(members: $newMembers) {
      __typename
    }
  }`;
  const expected = parseSortPrint(expectedRaw);
  const mutationAST = parse(createMembers);
  const {namespaceAST} = namespaceMutation(mutationAST, 'component1', {}, clientSchema);
  const actual = sortPrint(namespaceAST);
  t.is(actual, expected);
});

/* Inlining Tests */
test('turns all fragment spreads to inline fragments', t => {
  const expectedRaw = `
  mutation {
    createPost(newPost: {_id: "129"}) {
      post {
        ... on PostType {
          ... on PostType {
            createdAt
          }
        }
      }
    }
  }`;
  const expected = parseSortPrint(expectedRaw);
  const mutationAST = parse(nestedFragmentSpreads);
  const {namespaceAST} = namespaceMutation(mutationAST, 'component1', {}, clientSchema);
  const actual = sortPrint(namespaceAST);
  t.is(actual, expected);
});

/* Namespacing Tests */
test('aliases all fields with arguments', t => {
  const expectedRaw = `
  mutation {
    createPost(newPost: {_id: "129"}) {
      post {
        CASHAY_component1_title: title(language:"spanish"),
        CASHAY_component1_englishTitle: title(language:"english")
      }
    }
  }`;
  const expected = parseSortPrint(expectedRaw);
  const mutationAST = parse(postSpanishTitle);
  const {namespaceAST} = namespaceMutation(mutationAST, 'component1', {}, clientSchema);
  const actual = sortPrint(namespaceAST);
  t.is(actual, expected);
});

test('augments the variables object with required fields from state', t => {
  const expectedRaw = `
  mutation ($newPostId: String!, $CASHAY_component1_defaultLanguage: String, $CASHAY_component1_secondaryLanguage: String) {
    createPost(newPost: {_id: $newPostId}) {
      post {
        CASHAY_component1_title: title(language: $defaultLanguage),
        CASHAY_component1_englishTitle: title(language: $secondaryLanguage)
      }
    }
  }`;
  const expected = parseSortPrint(expectedRaw);
  const mutationAST = parse(postSpanishTitleVars);
  const stateVars = {
    defaultLanguage: 'spanish',
    secondaryLanguage: 'english'
  };
  const {namespaceAST, variableEnhancers} = namespaceMutation(mutationAST, 'component1', stateVars, clientSchema);
  const actual = sortPrint(namespaceAST);
  const actualVariables = variableEnhancers.reduce((reduction, enhancer) => enhancer(reduction), {});
  const expectedVariables = {
    CASHAY_component1_defaultLanguage: 'spanish',
    CASHAY_component1_secondaryLanguage: 'english'
  };
  t.is(actual, expected);
  t.deepEqual(actualVariables, expectedVariables);
});

test('allows for field variables inside hardcoded object args', t => {
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
  t.is(actual, expected);
});
