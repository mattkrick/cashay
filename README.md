[![npm version](https://badge.fury.io/js/cashay.svg)](https://badge.fury.io/js/cashay)
[![Build Status](https://travis-ci.org/mattkrick/cashay.svg?branch=master)](https://travis-ci.org/mattkrick/cashay)
[![Coverage Status](https://coveralls.io/repos/github/mattkrick/cashay/badge.svg?branch=master)](https://coveralls.io/github/mattkrick/cashay?branch=master)
[![Gitter](https://badges.gitter.im/mattkrick/cashay.svg)](https://gitter.im/mattkrick/cashay?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge)

# Cashay
Relay for the rest of us

## Installation
`npm i -S cashay`

## How's it different?
This is my honest comparison. If I'm leaving out any features out, make a PR!

|                                               | Cashay | Apollo | Relay |
|-----------------------------------------------|--------|--------|-------|
| Uses Redux                                    | Yes    | Yes    | No    |
| Local state & domain state in the same store  | Yes    | Yes    | No    |
| Uses your GraphQL client schema               | Yes    | No     | No    |
| Supports the full GraphQL spec                | No     | Yes    | No    |
| No big changes to your GraphQL server         | Yes    | Yes    | No    |
| Writes your mutations for you                 | Yes    | No     | No    |
| Allows for more than append/prepend mutations | Yes    | Yes    | No    |
| Works with all frontends                      | Yes    | Yes    | No    |
| Aggregates queries from child routes          | No     | No     | Yes   |
| Supports Subscriptions                        | Yes    | Yes    | No    |
| Supports local transforms like sort, filter   | Yes    | No     | No    |
| Caches denormalized result for fast renders   | Yes    | No     | ?     |
| Supports Query Batching                       | No     | Yes    | Yes   |
| Built-in SSR                                  | No     | Yes    | No    |

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
- *`httpTransport`: An instance of an [HTTPTransport](./recipes/transports.md)
to send off the query + variables to your GraphQL server.
- `priorityTransport`: An instance of a [Transport](./recipes/transports.md).
If it exists, Cashay will use this over the `httpTransport`.
- `idFieldName`: The name of your primary key. Defaults to `id`.
- `coerceTypes`: an object full of methods names matching GraphQL types. It takes in a single scalar value
and returns the output. This is useful for things like converting dates from strings to numbers or Date types.
By default, it includes one function: `DateTime = val => new Date(val)`,
which coerces everything of type `DateTime` to a Date.
- `paginationWords`: The reserved words that you use for pagination. Defaults to an object with 4 properties:
`first, last, after, before`.
If, for example, your backend uses `count` instead of `first`, you'd send in `{first: 'count'}`.
- `getToState`: A function to get to the cashay sub-state inside the redux state.
Defaults to `store => store.getState().cashay`
- `subscriber(channel, key, handlers)`: A default function to handle incoming subscription data.
See [Subscriptions](./recipes/subscriptions.md).

Now, whenever you need to query or mutate some data, just import your shiny new singleton!

## API

### Queries

```js
const {data, setVariables, status} = cashay.query(queryString, options)
```


Options:
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
- `customMutations`: Cashay writes mutations for you and guarantees no under fetching.
But if you don't trust it, you can write your own here.
- `mutationHandlers`: An object where each method is the name of a mutation that changes the query. See below.

Each option below is an object full of field names for keys and functions for values.
- `subscriber(channel, key, handlers)`: See [subscriber recipe](./recipes/subscriber.md)
- `resolveChannelKey(source, args)`: See [@live recipe](./recipes/at-live.md)
- `resolveCached(source,args)`: See [@cached recipe](./recipes/at-cached.md)
A function to return a document that already exists in your state (likely from a sub)
- `sort(a,b)`: See [transforms recipe](./recipes/transforms.md)
- `filter(doc)`: See [transforms recipe](./recipes/transforms.md)


#### Mutation Handlers
```js
mutationHandler(optimisticVariables, queryResponse, currentResponse, getEntities, invalidate)
```

A mutation handler is called twice per mutation:
once with `optimisticVariables` (for optimistic updates),
and again with `serverData` when the mutation response comes back.

If a return value is provided, it will be normalized & merged with the state.
If there is no return value, the state won't change.

- `optimisticVariables`: The variables you send to the server when you call a mutation. You can use this to optimistically update the UI. Is `null` when the function is called after recieving a resonse from the server.
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
Then, a good practice to hardcode `tableName` to `Posts` that op.
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
Cashay makes them simpler by allowing you to inline them with the `@live` directive
and manage them with your custom `subscriber` callback that you write yourself.
Cashay doesn't dictate your socket package, your server, or your message protocol (DDP or otherwise)
because doing so would tightly couple your front end to your server. That's not cool.

For examples, see the [subscriber](./recipes/subscriber.md) and
[@live](./recipes/at-live.md) recipes.

```
cashay.unsubscribe(channel, key = '')
```
Calls the result of your `subscriber`.


Cashay also provides a lower level subscribe API for advanced use cases.
If you need to ensure that a component is subscribed,
or need to subscribe without supplying data to the view layer, this is for you.
```
const {data, status, unsubscribe} = cashay.subscribe(channel, key, subscriber)
```
- `data`: The array of denormalized docs or diffs from the server.
The values are raw and strict JSON (ie datetimes are not instances of `Date`)
- `status`:
  - `SUBSCRIBING`: Subscribe has been called, but the subscriber has not completed yet
  - `READY`: The subscriber has completed & new docs are ready to be processed
  - `UNSUBSCRIBED`: The unsubscribe function has been called
  - user-defined: Whatever you pass in via the `setStatus` handler
- `unsubscribe`: The function that you returned from your `subscriber`

## Recipes

[See recipes](./recipes/index.md)

## Examples (PR to list yours)

- [Cashay-playground](https://github.com/mattkrick/cashay-playground), no time to actively maintain :sob:
- [Action by Parabol](https://github.com/ParabolInc/action/), paid to maintain :smile:

## Contributing

Cashay is a young project, so there are sure to be plenty of bugs to squash and edge cases to capture.
Bugs will be fixed with the following priority:
- Submit an issue: LOW
- Submit a PR with a failing test case: HIGH
- Submit a PR with a passing test case (ie fix it yourself): SUPER HIGH HIGH FIVE!

## Roadmap to 1.0

- [ ] Fixing mutations API
- [ ] Persisted data and TTL on documents
- [X] Subscriptions
- [X] Support native directives
- [ ] Test coverage at 95%

## Deviations from the GraphQL spec

The following edge cases are valid per the GraphQL spec, but are not supported in Cashay:
- List of Lists (eg `GraphQLList(GraphQLList(Foo))`). I can't think of a good reason to ever do this.
Storing a 2D graph like this is wrong.
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
