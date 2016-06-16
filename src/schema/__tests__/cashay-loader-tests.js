import 'babel-register';
import test from 'ava';

import cashayLoader from '../cashay-loader';



test('cashay-loader is function', t => {
  t.plan(1);

  t.is(typeof cashayLoader, 'function');
});

test.cb('cashay-loader w/o resourceQuery returns raw module object', t => {
  t.plan(2);

  class MockLoaderParent {
    constructor(loader, testCallback) {
      this.loader = loader;
      this.callback = testCallback;
    }
    async() { return this.callback; }
    cacheable() { return; }
    exec(content, resource) {
      return new Promise((resolve) => resolve({ querySchema: "test document" }));
    }
    load(testContent) { return this.loader(testContent); }
  }

  const callback = (errors, doc) => {
    t.is(errors, null);
    t.regex(doc, /^module.exports = {/);
    t.end();
  }

  const loader = new MockLoaderParent(cashayLoader, callback);
  loader.load();
});

test.cb('cashay-loader w/o resourceQuery returns raw module object', t => {
  t.plan(2);

  class MockLoaderParent {
    constructor(loader, testCallback) {
      this.loader = loader;
      this.callback = testCallback;
      this.resourceQuery = "?thisIsATest";
    }
    async() { return this.callback; }
    cacheable() { return; }
    exec(content, resource) {
      return () =>
        new Promise((resolve) => resolve({ querySchema: "test document" }));
    }
    load(testContent) { return this.loader(testContent); }
  }

  const callback = (errors, doc) => {
    t.is(errors, null);
    t.regex(doc, /^module.exports = {/);
    t.end();
  }

  const loader = new MockLoaderParent(cashayLoader, callback);
  loader.load();
});
