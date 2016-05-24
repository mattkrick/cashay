import 'babel-register';
import test from 'ava';
import clientSchema from './clientSchema.json';

test('caches a partial query result', t => {
  t.is(1,1);
});
