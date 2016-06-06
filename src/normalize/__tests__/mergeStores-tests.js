import test from 'ava';
import 'babel-register';
import mergeStores from '../mergeStores';

import {
  front3Store,
  front2After3StoreFn,
  front1After3Store,
  front1After4StoreFn
} from './data-pagination-front';
import {
  back3Store,
  back1After4StoreFn
} from './data-pagination-back';

import {
  fullPostStore,
  front4PostStore,
  back4PostStore,
  back1Store,
  front3Back1Store
} from './data-pagination';

test('merge docs 1-3 with doc 4 that has EOF == true', t => {
  const firstDocs = front3Store;
  const lastDoc = front2After3StoreFn();
  const actual = mergeStores(firstDocs, lastDoc);
  const expected = fullPostStore;
  t.deepEqual(actual, expected);
});

test('merge docs 1-3 with doc 4', t => {
  const firstDocs = front3Store;
  const lastDoc = front1After3Store;
  const actual = mergeStores(firstDocs, lastDoc);
  const expected = front4PostStore;
  t.deepEqual(actual, expected);
});

test('merge docs 1-4 with an empty doc 5 request (front)', t => {
  const firstDocs = front4PostStore;
  const lastDoc = front1After4StoreFn();
  const actual = mergeStores(firstDocs, lastDoc);
  const expected = fullPostStore;
  t.deepEqual(actual, expected);
});

test('merge docs 1-4 with an empty doc 5 request (back)', t => {
  const firstDocs = back4PostStore;
  const lastDoc = back1After4StoreFn();
  const actual = mergeStores(firstDocs, lastDoc);
  const expected = fullPostStore;
  t.deepEqual(actual, expected);
});

test('merge docs 1-3 with back 1', t => {
  const firstDocs = front3Store;
  const lastDoc = back1Store;
  const actual = mergeStores(firstDocs, lastDoc);
  const expected = front3Back1Store;
  t.deepEqual(actual, expected);
});

test('merge docs 1-3 with back 1-3', t => {
  const firstDocs = front3Store;
  const lastDoc = back3Store;
  const actual = mergeStores(firstDocs, lastDoc);
  const expected = fullPostStore;
  t.deepEqual(actual, expected);
});

test('merge permutation: target: back, src: back', t => {
  const state = {back: [3, 4, 5]};
  const src = {back: [0, 1, 2]};
  const actual = mergeStores(state, src);
  const expected = {back: [0, 1, 2, 3, 4, 5]};
  t.deepEqual(actual, expected);
});

test('merge permutation: target: back, src: front, EOF: false', t => {
  const state = {back: [3, 4, 5]};
  const src = {front: [0, 1, 2]};
  const actual = mergeStores(state, src);
  const expected = {front: [0, 1, 2], back: [3, 4, 5]};
  t.deepEqual(actual, expected);
});

test('merge permutation: target: back, src: front, EOF: true', t => {
  const state = {back: [3, 4, 5]};
  const src = {front: [1, 2, 3]};
  const actual = mergeStores(state, src);
  const expected = {full: [1, 2, 3, 4, 5]};
  t.deepEqual(actual, expected);
});

test('merge permutation: target: back, src: full', t => {
  const state = {back: [3, 4, 5]};
  const src = {full: [0, 1, 2]};
  const actual = mergeStores(state, src);
  const expected = {full: [0, 1, 2]};
  t.deepEqual(actual, expected);
});

test('merge permutation: target: back, src: front, back, EOF: false', t => {
  const state = {back: [3, 4, 5]};
  const src = {front: [0, 1], back: [2, 3]};
  const actual = mergeStores(state, src);
  const expected = {front: [0, 1], back: [2, 3, 4, 5]};
  t.deepEqual(actual, expected);
});

test('merge permutation: target: back, src: front, back, EOF: true', t => {
  const state = {back: [3, 4, 5]};
  const src = {front: [0, 1], back: [1, 2, 3]};
  const actual = mergeStores(state, src);
  const expected = {full: [0, 1, 2, 3, 4, 5]};
  t.deepEqual(actual, expected);
});

test('merge permutation: target: front, src: back, EOF: false', t => {
  const state = {front: [0, 1, 2]};
  const src = {back: [3, 4, 5]};
  const actual = mergeStores(state, src);
  const expected = {front: [0, 1, 2], back: [3, 4, 5]};
  t.deepEqual(actual, expected);
});

test('merge permutation: target: front, src: back, EOF: true', t => {
  const state = {front: [0, 1, 2]};
  const src = {back: [2, 3, 4, 5]};
  const actual = mergeStores(state, src);
  const expected = {full: [0, 1, 2, 3, 4, 5]};
  t.deepEqual(actual, expected);
});

test('merge permutation: target: front, src: front', t => {
  const state = {front: [1, 2, 3]};
  const src = {front: [3, 4, 5]};
  const actual = mergeStores(state, src);
  const expected = {front: [1, 2, 3, 4, 5]};
  t.deepEqual(actual, expected);
});

test('merge permutation: target: front, src: full', t => {
  const state = {front: [1, 2, 3]};
  const src = {full: [3, 4, 5]};
  const actual = mergeStores(state, src);
  const expected = {full: [3, 4, 5]};
  t.deepEqual(actual, expected);
});

test('merge permutation: target: front, src: front, back, EOF: false', t => {
  const state = {front: [1, 2, 3]};
  const src = {front: [3, 4], back: [5]};
  const actual = mergeStores(state, src);
  const expected = {front: [1, 2, 3, 4], back: [5]};
  t.deepEqual(actual, expected);
});

test('merge permutation: target: front, src: front, back, EOF: true', t => {
  const state = {front: [1, 2, 3]};
  const src = {front: [3, 4], back: [4, 5]};
  const actual = mergeStores(state, src);
  const expected = {full: [1, 2, 3, 4, 5]};
  t.deepEqual(actual, expected);
});

test('merge permutation: target: front, back, src: back, EOF: false', t => {
  const state = {front: [1, 2, 3], back: [5]};
  const src = {back: [4]};
  const actual = mergeStores(state, src);
  const expected = {front: [1, 2, 3], back: [4, 5]};
  t.deepEqual(actual, expected);
});

test('merge permutation: target: front, back, src: back, EOF: true', t => {
  const state = {front: [1, 2, 3], back: [5]};
  const src = {back: [3, 4]};
  const actual = mergeStores(state, src);
  const expected = {full: [1, 2, 3, 4, 5]};
  t.deepEqual(actual, expected);
});

test('merge permutation: target: front, back, src: front, EOF: false', t => {
  const state = {front: [1, 2, 3], back: [5]};
  const src = {front: [4]};
  const actual = mergeStores(state, src);
  const expected = {front: [1, 2, 3, 4], back: [5]};
  t.deepEqual(actual, expected);
});

test('merge permutation: target: front, back, src: front, EOF: true', t => {
  const state = {front: [1, 2, 3], back: [5]};
  const src = {front: [4, 5]};
  const actual = mergeStores(state, src);
  const expected = {full: [1, 2, 3, 4, 5]};
  t.deepEqual(actual, expected);
});

test('merge permutation: target: front, back, src: full', t => {
  const state = {front: [1, 2, 3], back: [5]};
  const src = {full: [1, 2, 3, 4]};
  const actual = mergeStores(state, src);
  const expected = {full: [1, 2, 3, 4]};
  t.deepEqual(actual, expected);
});

test('merge permutation: target: front, back, src: front, back, EOF: false', t => {
  const state = {front: [1, 2], back: [5]};
  const src = {front: [3], back: [4]};
  const actual = mergeStores(state, src);
  const expected = {front: [1, 2, 3], back: [4, 5]};
  t.deepEqual(actual, expected);
});

test('merge permutation: target: front, back, src: front, back, EOF: true', t => {
  const state = {front: [1, 2], back: [5]};
  const src = {front: [3, 4], back: [4]};
  const actual = mergeStores(state, src);
  const expected = {full: [1, 2, 3, 4, 5]};
  t.deepEqual(actual, expected);
});

test('merge permutation: target: full, src: back', t => {
  const state = {full: [1, 2, 3]};
  const src = {back: [4, 5]};
  const actual = mergeStores(state, src);
  const expected = {full: [1, 2, 3, 4, 5]};
  t.deepEqual(actual, expected);
});

test('merge permutation: target: full, src: front', t => {
  const state = {full: [1, 2, 3]};
  const src = {front: [0, 3]};
  const actual = mergeStores(state, src);
  const expected = {full: [0, 1, 2, 3]};
  t.deepEqual(actual, expected);
});

test('merge permutation: target: full, src: full', t => {
  const state = {full: [1, 2, 3]};
  const src = {full: [0, 3, 4, 5, 2]};
  const actual = mergeStores(state, src);
  const expected = {full: [1, 2, 3, 0, 4, 5]};
  t.deepEqual(actual, expected);
});

//   test('array mutation: delete a doc', t => {
//     const state = {full: [1, 2, 3]};
//     const src = {full: [1, 2]};
//     const actual = mergeStores(state, src, true);
//     const expected = {full: [1, 2]};
//     t.deepEqual(actual, expected);
//   });
//
// test('array mutation: move a doc', t => {
//   const state = {full: [1, 2, 3]};
//   const src = {full: [1, 3, 2]};
//   const actual = mergeStores(state, src, true);
//   const expected = {full: [1, 3, 2]};
//   t.deepEqual(actual, expected);
// });
//
// test('array mutation: replace a doc', t => {
//   const state = {full: [1, 2, 3]};
//   const src = {full: [1, 4, 3]};
//   const actual = mergeStores(state, src, true);
//   const expected = {full: [1, 4, 3]};
//   t.deepEqual(actual, expected);
// });
//
// test('array mutation: replace 2 docs with 3 new docs', t => {
//   const state = {full: [1, 2, 3]};
//   const src = {full: [9, 2, 8, 6]};
//   const actual = mergeStores(state, src, true);
//   const expected = {full: [9, 2, 8, 6]};
//   t.deepEqual(actual, expected);
// });
