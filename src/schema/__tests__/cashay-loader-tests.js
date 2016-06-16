import 'babel-register';
import test from 'ava';

import cashayLoader from '../cashay-loader';

class MockLoaderParent {
  constructor(loader, testCallback) {
    this.loader = loader;
    this.callback = testCallback;
  }
  async() { return this.callback; }
  cacheable() { return; }
  exec(content, resource) {
    return () =>
      new Promise((resolve) => resolve({ querySchema: "test document" }));
  }
  load(testContent) { return this.loader(testContent); }
}

test('cashay-loader is function', t => {
  t.plan(1);

  t.is(typeof cashayLoader, 'function');
});

test.cb('cashay-loader returns raw module object', t => {
  t.plan(2);

  const callback = (errors, doc) => {
    t.is(errors, null);
    t.regex(doc, /^module.exports = {/);
    t.end();
  }

  const loader = new MockLoaderParent(cashayLoader, callback);
  loader.load();
});
