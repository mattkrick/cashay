import 'babel-register';
import test from 'ava';
import removeNamespacing from '../removeNamespacing';

/* variableDefinitions Tests */
test('removes 2 irrelevant namespaces: 1 prefixed, 1 not', t => {
  const input = {
    "data": {
      "createPost": {
        "post": {
          "CASHAY_component1_title": "FOOIE EN ESPANOL!",
          "CASHAY_component1_reverseTitle": "EIOOF",
          "title": "FOOIE"
        }
      }
    }
  };
  const expected = {
    "data": {
      "createPost": {
        "post": {
          "title": "FOOIE EN ESPANOL!",
          "reverseTitle": "EIOOF"
        }
      }
    }
  };
  const actual = removeNamespacing(input, 'component1');
  t.deepEqual(actual, expected);
});
