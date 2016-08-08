[![npm version](https://badge.fury.io/js/cashay.svg)](https://badge.fury.io/js/cashay)
[![Build Status](https://travis-ci.org/mattkrick/cashay.svg?branch=master)](https://travis-ci.org/mattkrick/cashay)
[![Coverage Status](https://coveralls.io/repos/github/mattkrick/cashay/badge.svg?branch=master)](https://coveralls.io/github/mattkrick/cashay?branch=master)
[![Gitter](https://badges.gitter.im/mattkrick/cashay.svg)](https://gitter.im/mattkrick/cashay?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge)

# Cashay
Relay for the rest of us

## Installation
`npm i -S cashay`

## How's it different from Relay?
|                                               |Cashay |Relay|
|-----------------------------------------------|-------|-----|
| Uses redux                                    | Yes   | No  |
| Local state & domain state in the same store  | Yes   | No  |
| Babelfication-free                            | Yes   | No  |
| Uses the introspection query on the client    | Yes   | No  |
| No big changes to your GraphQL server         | Yes   | No  |
| Writes your mutations for you                 | Yes   | No  |
| DRY optimistic updates                        | Yes   | No  |
| Allows for more than append/prepend mutations | Yes   | No  |
| Works with all frontends                      | Yes   | No  |
| Aggregates queries from child routes          | No    | Yes |

## Usage

### Creating the client schema

Cashay uses a client-safe portion of your GraphQL schema,
similar to [GraphiQL](https://github.com/graphql/graphiql), but _way_ smaller.

Since schemas change rapidly during development, Cashay includes a
[Webpack](https://webpack.github.io/) loader to automatically refresh the schema
on startup. You can include the schema on your client
(likely near the instantiation of your [Cashay singleton](#creating-the-singleton))
by using a `require()` statement:

```js
const cashaySchema = require('cashay!../server/utils/getCashaySchema.js');
///            cashay-loader ^^^     ^^^ returns function for promise for schema
```

**Note:** `cashay-loader` is automatically included with Cashay, just use it!

All the loader needs is a module which exports a function that will return a
Promise for a schema that's been transformed by the Cashay's
`transformSchema()` convenience function.

Ours looks like this:

```js
// getCashaySchema.js

require('babel-register');
require('babel-polyfill');
const {transformSchema} = require('cashay');
const graphql = require('graphql').graphql;
const rootSchema = require('../graphql/rootSchema');
const r = require('../database/rethinkDriver');
module.exports = (params) => {
  if (params === '?exitRethink') {
    // optional pool draining if your schema starts a DB connection pool
    r.getPoolMaster().drain();
  }
  return transformSchema(rootSchema, graphql);
}
```
If you cannot use webpack, see the [cashay-schema](./recipes/cashay-schema.md)
recipe.

### Adding the reducer

Cashay is just like any other redux reducer:
```js
import {createStore, compose, combineReducers} from 'redux'
import {cashayReducer} from 'cashay';
const rootReducer = combineReducers({cashay: cashayReducer});
const store = createStore(rootReducer, {});
```

### Creating the singleton

Cashay is front-end agnostic, so instead of passing it through React context
or making you replace `react-redux` with something non-vanilla,
you can just import the singleton. This means it works well in SSR apps, too.
```js
// in your client index.js
const clientSchema = require('cashay!../server/utils/getCashaySchema.js');
import {cashay} from 'cashay';
cashay.create(paramsObject);

// in a Component.js
import {cashay} from 'cashay';
cashay.query(...);
```

The params that you can pass into the `create` method are as follows (*required):
- *`store`: Your redux store
- *`schema`: your client schema that cashay helped you make
- *`httpTransport`: An instance of an [HTTPTransport](./recipes/transports.md) to send off the query + variables to your GraphQL server.
- `priorityTransport`: An instance of a [Transport](./recipes/transports.md). If it exists, Cashay will use this over the `httpTransport`.
- `idFieldName`: Defaults to `id`, but you can call it whatever it is in your DB (eg Mongo uses `_id`)
- `paginationWords`: The reserved words that you use for pagination. Defaults to an object with 4 properties:
`first, last, after, before`.
If, for example, your backend uses `count` instead of `first`, you'd send in `{first: 'count'}`.
- `getToState`: A function to get to the cashay sub-state inside the redux state.
Defaults to `store => store.getState().cashay`

Now, whenever you need to query or mutate some data, just import your shiny new singleton!

## API

### Queries

```js
const {data, setVariables, status} = cashay.query(queryString, options)
```

Options include:
- `op`: A string to match the op. 
Required if you pass in `mutationHandlers`. 
Typically shares the same name as the React component. 
If left blank, it defaults to the `queryString`.
- `key`: A unique key to match the op instance, 
only used where you would use React's `key` (eg in a op that you called `map` on in the parent op).
- `forceFetch`: A Boolean to ignore local data & get some fresh stuff. 
Defaults to `false`. Don't use this in `mapStateToProps` or you'll be calling the server every time you call `dispatch`.
- `transport`: A function to override the singleton transport. 
Useful if this particular op needs different credentials, or uses websockets, etc.
- `variables`: the variables object to pass onto the GraphQL server
- `customMutations`: Cashay writes mutations for you and guarantees no over/under fetching. 
But if you don't trust it, you can write your own here.
- `mutationHandlers`: An object where each method is the name of a mutation that changes the query. See below.
- `localOnly`: A Boolean to only fetch data from the local state. Defaults to `false`. 
Useful if you only want a mutation to update the query data.

```js
mutationHandler(optimisticVariables, queryResponse, currentResponse, getEntities, invalidate)
```

A mutation handler is called twice per mutation:
once with `optimisticVariables` (for optimistic updates),
and again with `serverData` when the mutation response comes back.

If a return value is provided, it will be normalized & merged with the state.
If there is no return value, the state won't change.

- `optimisticVariables`: The variables you send to the server when you call a mutation. You can use this to optimistically update the UI. Is `null` when the function is called after receving a resonse from the server.
- `queryResponse`: The data that came back from the server. The shape is identical to whatever the `type` is in your GraphQL schema for that mutation. It is `null` when optimistically updating.
- `currentResponse`: The response you receive from your query. The shape follows whatever you entered in `queryString`. You can modify this and return it, Cashay will detect the differences.
- `getEntites(typeName)`: A function that returns all the entities for a given GraphQL type (eg `typeName = PostType`) This is useful in case you want to replace a deleted document with the next-best doc you have locally.
- `invalidate`: A function that you can call to retrigger the query (with `forceFetch = true`). This is useful if you want to guarantee that a query has accurate data after each mutation.


For this example, we'll use React and `react-redux`:
```js
const mapStateToProps = (state, props) => {
  return {
    response: cashay.query(queryString, options)
  }
};
```

Following the example above, `this.props.response` will be an object that has the following:
- `status`: `loading` if there is a fetch in progress, `complete` if otherwise. 
This is useful if you want to use a loading spinner, etc.
- `data`: The data object that you expect to get back when you call your GraphQL server.
- `setVariables`: A callback to run when you want to change your query variables. See below.

### Setting variables

Cashay gives you a function to make setting variables dead simple. 
It gives you your op's variables that are currently in the store, 
and then it's up to you to give it back a new variables object:

```js
const {setVariables} = this.props.cashay;
    setVariables(currentVariables => {
      return {
        count: currentVariables.count + 2
      }
    })
```

### Mutations

Cashay mutations are pretty darn simple, too:

```js
await cashay.mutate(mutationName, options)
```

Cashay is smart.
By default, it will go through all the `mutationHandlers` that are currently active,
looking for any handlers for `mutationName`.
Then, it intersects your mutation payload schema with the corresponding queries to automatically fetch all the fields you need.
No fat queries, no mutation fragments in your queries, no problems.
If two different queries need the same field but with different arguments
(eg. `Query1` needs `profilePic(size:SMALL)` and `Query2` needs `profilePic(size:LARGE)`,
it'll take care of that, too.
This method conveniently returns a `Promise` so you can trigger side effects like redirects and localStorage caching, too.
Note: if you return a scalar variable at the highest level of your mutation payload schema,
make sure the name in the mutation payload schema matches the name in the query to give Cashay a hint to grab it.

The options are as follows:
- `variables`: The variables object to pass onto the GraphQL server. 
Make sure the variables have the same names as what your schema expects so Cashay can automatically create the mutation for you. 
For maximum efficiency, be sure to pass in all variables that you will possibly use 
(even if that means passing it in as `undefined`). 
If you can't do these 2 things, you can write a `customMutation` (and tell me your usecase, I'm curious!).
- `ops`: An object the determines which `mutationHandlers` to call. 
If not provided, it'll call every `op` that has a `mutationHandler` for that `mutationName`.

In this example, we just want to call the `mutationHandler` for the `comments` op where `key === postId`. 
If you wanted to delete Comment #3 (where `key = 3`), you'd want to trigger the `mutationHandler` for `{comments: 3}` 
and not bother wasting CPU cycles checking `{comments: 1}` and `{comments: 2}`.
Additionally, we call the `mutationHandler` for `post` if the value is true. 
This might be common if the `post` query includes a `commentCount` that should decrement when a comment is deleted. 
This logic makes Cashay super efficient by default, 
while still being flexible enough to write multiple mutations that have the same `mutationName`, 
but affect different queries. 
For example, you might have a mutation called `deleteSomething` that accepts a `tableName` and `id` variable. 
Then, a good practice to to hardcode `tableName` to `Posts` that op. 
In doing so, you reduce the # of mutations in your schema (since `deleteSomething` can delete any doc in your db). 
Additionally, because you hardcoded in the tableName, you don't have to pass that variable down via `this.props`.

```js
const {postId} = this.props;
const mutationAffectsPostOp = true; 
const ops = {
  comments: postId,
  post: mutationAffectsPostOp
}
cashay.mutate('deleteComment', {variables: {commentId: postId}, ops})
```

### Subscriptions

Subscriptions are hard, don't let anyone tell you different.

```js
const {data, setVariables, status, unsubscribe} = cashay.subscribe(subscriptionString, subscriber, options)
```

A subscriber is a callback that you write yourself.
Cashay doesn't dictate your socket package, your server, or your message protocol (DDP or otherwise)
because doing so would tightly couple your front end to your server. That's not cool.
Cashay will supply you with 3 arguments for the callback:
- `subscriptionString`: The subscriptionString that you passed into the `subscribe` call
- `variables`: The variables that you passed into the `subscribe` call
- `handlers`: An object containing the following:
  - `add(doc, handlerOptions)`: A function that takes a new doc. Cashay will append it to the end of the stream.
  - `update(doc, handlerOptions)`: A function that takes a doc diff. 
 You only need to supply it with the fields that have changed.
  - `upsert(doc, handlerOptions)`: A function that will call `update` if the doc exists, else `add`.
 You'll use this 80% of the time over `add`, since `add` could sneak some duplicates in if a socket reconnects.
  - `remove(id, handlerOptions)`: A function that will remove the document with the given ID
  - `setStatus(newStatus)`: A function that will set the status of your subscription to whatever you want.
  This is useful, for example, if the docs coming down the wire are already in the DB, then you can set it to
  `initializing` and your front-end can react accordingly.

There are currently 2 `handlerOptions`: 
- `removeKeys`: If you'd like to remove a key from an object, pass in an array of fields to remove.
e.g. `['milk', 'soda']`.
If you'd like to completely replace the old with the new, set `removeKeys = true`.
- `path`: borrowing from [falcor's path syntax](https://netflix.github.io/falcor/documentation/paths.html),
this allows you to edit a deeply nested subdocument.
For example, let's say you subscribe to `Friends` and `PhotosForFriend`.
If it were a query, you'd do something like this:
```
subscription($id: String!) {
  friends(id: $id) {
    id,
    name,
    photos {
      date,
      url,
      likes
    }
  }
}
```
However, if these are 2 separate tables in your database, this might be difficult to do in real time.
So, you can open 2 subscriptions and patch 1 into the other.
For example, when a `photo` gets a new like, your path might look like `'friends['123'].photos['456]'`.

Basic example:
```js
const subscriber = (subscriptionString, variables, handlers) => {
  // Using the subscriptionString and variables, determine the channel to join
  // You're free to do this however you like:
  const channelName = channelLookup(subscriptionString, variables);
  
  // connect using your favorite socket client (socketCluster, socket.io, sockJS, ws)
  const socket = socketCluster.connect();
  const {upsert, update, remove} = handlers;
  
  // subscribe to the channel. Other socket APIs might just use `emit`
  socket.subscribe(channelName, {waitForAuth: true});
  
  // your server should probably send back something that tells you what to do with the data
  // in this example, the server knows if a document has been added/removed/changed in the database
  socket.on(channelName, data => {
    if (data.type === 'add') {
      upsert(data.fields);
    } else if (data.type === 'remove') {
      remove(data.id);
    } else {
      update(data.fields, {path: data.path, removeKeys: data.removeKeys});
    }
  });
  
  // you can do anything else here, too
  socket.on('unsubscribe', unsubChannel => {
    if (unsubChannel === channelName) {
      console.log(`unsubbed from ${unsubChannel}`);
    }
  });
  
  // you must return a function that will end this subscription
  return () => socket.unsubscribe(channelName);
}
```

`cashay.subscribe` has the following options:
- `variables`: the variables object to pass onto the GraphQL server
- `op`: a nickname for your subscription. 
Two components can share the same subscription by sharing the same `op` name. 

The response includes:
- `data`: the stream of documents, as they have been recieved
- `setVariables`: a shorthand for unsubscribing and subscribing to a new channel (for example, if you change users)
- `status`: 
  - `'subscribing'`: `cashay.subscribe` has been called, but `subscriber` has not been executed yet
  - `'ready'`: `subscriber` has been executed.
  - `[USER_DEFINED]`: whatever you like, just call `handler.setStatus(status)` in your `subscriber`
- `unsubscribe`: the result of calling your `subscriber`. This could also be an object of functions, if you get tricky.

## Recipes

[See recipes](./recipes/index.md)

## Examples (PR to list yours)

- [Cashay-playground](https://github.com/mattkrick/cashay-playground)
- [Action by Parabol](https://github.com/ParabolInc/action/)

## Contributing

Cashay is a young project, so there are sure to be plenty of bugs to squash and edge cases to capture.
Bugs will be fixed with the following priority:
- Submit an issue: LOW
- Submit a PR with a failing test case: HIGH
- Submit a PR with a passing test case (ie fix it yourself): SUPER HIGH HIGH FIVE!

## Roadmap to 1.0

- Subscriptions
- Fixing `getEntites` in the `mutationHandler`
- Test coverage at 95%
- Persisted data and TTL on documents
- Support directives

## Deviations from the GraphQL spec

The following edge cases are valid per the GraphQL spec, but are not supported in Cashay:
- List of Lists (eg `GraphQLList(GraphQLList(Foo))`). I can't think of a good reason to ever do this. Storing a 2D graph like this is wrong. 
- Multi-part mutations. Combine them into 1 mutation, or call them separately. Below is an example of what not to do.
```
 mutation {
  changeFoo(foo: $foo) {  // one is fine
    foo
  }
  changebar(bar: $bar) { // this one will get ignored
    bar
  }
}
```

##License

MIT
