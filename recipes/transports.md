# Transports

A transport is a class instance that shuttles data to and from your graphql server.
For most cases, you'll probably want to transport your data via HTTP.
However, if you're already using sockets for subscriptions, you might as well use `SocketTransport` for queries & mutations, too.
Additionally, if your app is small and you have 1 server for both your server-sider rendering (SSR) & your GraphQL instance,
it doesn't make sense to have the server call itself via HTTP, so you can simply use `ServerSideTransport`.

On the trip to the server, it attaches any `auth` that you might need and sends it on its happy way.
On the trip back from the server, it sends `data` and `error` back to Cashay, which in turn populates your redux store with the results.

## `handleErrors`

Notice that GraphQL gives you `errors` and the transport gives you `error`.
By default, any GraphQL errors that come back from the server are put in an object: `error = {errors}`.

But the fun doesn't end there. If you throw your own errors in your GraphQL `resolve` function,
make sure the `Error.message` is a stringified object with an `_error` key.
Each transport tries to parse the `Error.message` and if it's an object with `_error`,
it will set that parsed object as the error in the redux store. You can include multiple errors by simply adding
more keys to that `Error.message`.

To me, this is the cleanest way to handle GraphQL's goofy error handling.
However, if you know of a better way, please PLEASE open an issue!
And in the mean time, you can simply pass in your own custom `handleErrors`.

## HTTPTransport

```js
new HTTPTransport(uri, fetchOptions, errorHandler)
```

- *`uri`: the location of your graphQL endpoint, defaults to '/graphql'
- `fetchOptions`: Any details or headers used to pass into making the HTTP fetch
- `errorHandler`: A custom function that takes any GraphQL `errors` and converts them into a single `error` for your Redux state

Example:
```js
import {HTTPTransport} from 'cashay';
const Authorization = `Bearer ${authToken}`;
const transport = new HTTPTransport('/myEndpoint', {headers: {Authorization}});
```

If you'd like to replace the global `cashay.transport`, you can call just call `cashay.create({transport: newTransport})`.
This is useful if you use custom `fetchOptions` that include an authorization token and you need to change it or if you're
upgrading from an `HTTPTransport` to a `SocketTransport`.

## ServerSideTransport

```js
new ServerSideTransport(graphQLHandler, errorHandler)
```

- *`graphQLHandler({query, variables})`: a Promise that takes a `query` and `variables` prop, and returns the output from
a `graphql` call.
- `errorHandler`: A custom function that takes any GraphQL `errors` and converts them into a single `error` for your Redux state

Example:
```js
import {graphql} from 'graphql';
import Schema from './rootSchema';
import {ServerSideTransport} from 'cashay';
const graphQLHandler = function({query, variables}) => {
  return graphql(Schema, query, null, null, variables);
}
const transport = new ServerSideTransport(graphQLHandler);
```
This is useful if you use your server for both graphql and server-side rendering
and don't want cashay to make an HTTP roundtrip to itself.

## SocketTransport

```js
new SocketTransport(sendToServer, errorHandler)
```

- *`sendToServer(request)`: a function that takes in a request (where `request = {queryString, variables}`)
and returns a `Promise` that resolves with a GraphQL response.
- `errorHandler`: A custom function that takes any GraphQL `errors` and converts them into a single `error` for your Redux state

Example:
```js
import {SocketTransport} from 'cashay';
import {socket} from './myCustomSocketDriver';

const sendToServer = request => {
  return new Promise((resolve) => {
    // Example #1: Your socket package offers `emit` with an optional callback
    socket.emit('graphql', request, response => {
      resolve(response);
    });
    // Example #2: Your socket package is lacking & your server makes up for it
    socket.emit('graphqlRequest', request);
    socket.on('graphqlResponse', response => {
      resolve(response)
    })
  })
};
const transport = new SocketTransport(sendToServer);
```
