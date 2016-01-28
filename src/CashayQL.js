/* Code from hueypetersen.com */

import {Schema, arrayOf, unionOf} from 'normalizr';

const CashayQL = (string, ...args) => {
  throw new Error('Cashay: Did you install your Babel plugin?');
}

Object.assign(CashayQL, {
  schema(key, definition) {
    const schema = new Schema(key);
    if (definition) {
      schema.define(definition);
    }
    return schema;
  },
  arrayOf,
  unionOf
});

export default CashayQL;
