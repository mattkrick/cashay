[![npm version](https://badge.fury.io/js/cashay.svg)](https://badge.fury.io/js/cashay)
#cashay
relay for the rest of us

WIP. Be a pal. Make a PR.

##Installation
`npm i -S cashay`

##Setup

Just like relay, the goal is to get the benefits of graphql while minimizing client payload.
To do so, we'll write a script that writes the GraphQL schema to a JSON file.
Since this is specific to your project, you'll need to write this yourself. 
For example, I put the clientSchema in my `build` folder.
I also drain my database connection pool that is filled when the `rootSchema` is accessed.
As an example, my file looks like this:

```
// updateSchema.js
require('babel-register');
require('babel-polyfill');

const path = require('path');
const rootSchema = require('../src/server/graphql/rootSchema');
const graphql = require('graphql').graphql;
const introspectionQuery = require('graphql/utilities').introspectionQuery;
const r = require('../src/server/database/rethinkdriver');

(async () => {
  const result = await graphql(rootSchema, introspectionQuery);
  if (result.errors) {
    console.log(result.errors)
  } else {
    fs.writeFileSync(path.join(__dirname, '../build/clientSchema.json'), JSON.stringify(result, null, 2));
  }
  r.getPool().drain();
})();
```
I recommend writing an npm script and execute it whenever your GraphQL schema changes.
If you want to get fancy, you can put a watcher on your GraphQL folder to run it on file change.

Next, we'll need to inject our `clientSchema` into a babel plugin:

```
// createPlugin.js
const createPlugin = require('cashay/lib/babel-plugin');
const schema = require('../build/schema.json');
module.exports = createPlugin(schema);
```

Now, we need to include that plugin in our `.babelrc`:

```
{
  "plugins": [
    ["./createCashayPlugin.js"]
  ]
}
```
Success! Now Babel will statically analyze all of our queries and give each one a bespoke schema.
This means our client bundle stays tiny.

##Usage 

Cashay provides 3 useful items:

`import {CashayQL, Cashay, cashayReducer} from 'cashay';`

Prefixing all your query strings with `CashayQL` tells Babel to do its magic. For example:

```
const queryString = CashayQL`
query {
	getComments {
    id
    body
  }
}`
```

`Cashay` is a class that takes a redux store and transport (AKA fetch function).

`const cashay = new Cashay(store, graphQLFetcher);`

Your transport should call your GraphQL endpoint. 
If you call multiple GraphQL servers, you'll need multiple transports.

```
export const fetchGraphQL = async graphParams => {
  const authToken = localStorage.getItem(authTokenName);
  const res = await fetch('http://localhost:3000/graphql', {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify(graphParams)
  });
  const {data, errors} = await res.json();
  const  = resJSON;
  return {data, error: getPrettyErrors(errors)}
}
```

`cashayReducer` is as easy; just add it to your `combineReducers`. 
 
 
##API
 
`cashay.query(queryString, options)`

Calling `query` will fetch your queryString from the graphQL server and put it in your redux store.
Currently, it's very naive.

##Contributing

There is a LOT of work to be done. Join the fun, check out the issues, and make a PR.

##License

MIT





