# Transports

A transport is a class instance that shuttles data to and from your graphql server.
For most cases, you'll probably want to transport your data via HTTP.
However, there are a couple cases where you don't need HTTP;
namely, if you're using sockets or you're on the serving and using Cashay for server-side rendering (SSR).

On the trip to the server, the transport attaches any `auth` that you might need and sends the request on its happy way.
When `data` and `errors` come back from the server, the transport transforms `errors` to `error`
and sends to result back to Cashay, which in turn populates your redux store with the results.

## `errorHandler`

Notice that GraphQL gives you `errors` and the transport gives Cashay `error`.
By default, any GraphQL errors that come back from the server are put in an object: `error = {errors}`.

But the fun doesn't end there. If you throw your own errors in your GraphQL `resolve` function,
make sure the `Error.message` is a stringified object with an `_error` key.
The `errorHandler` tries to parse the `Error.message` and if it's an object with `_error`,
it will set that parsed object as the error in the redux store. You can include multiple errors by simply adding
more keys to that `Error.message`.
I'd suggest something like `{_error: 'Invalid login', type: 'password', subtype: 'password too weak'}`

To me, this is the cleanest way to handle GraphQL's awkward error handling.
However, if you know of a better way, please PLEASE open an issue!
And in the mean time, you can simply pass in your own custom `errorHandler` as the last param for either transport.

## HTTPTransport

```js
new HTTPTransport(uri, fetchOptions, errorHandler)
```

- *`uri`: the location of your graphQL endpoint, defaults to '/graphql'
- `fetchOptions`: Any details or headers used to pass into making the HTTP fetch
- `errorHandler`: A custom function that handles your errors from GraphQL or the fetch itself

Example:
```js
import {HTTPTransport} from 'cashay';
const Authorization = `Bearer ${authToken}`;
const transport = new HTTPTransport('/myEndpoint', {headers: {Authorization}});
```

If you'd like to replace the global `cashay.httpTransport`, you can call just call `cashay.create({httpTransport: newTransport})`.
This is useful if your `fetchOptions` change, for example the client gets a renewed `authToken`.

## Transport

```js
new Transport(sendToServer, errorHandler)
```

- *`sendToServer(request)`: a function that takes in a request (where `request = {queryString, variables}`)
and returns a `Promise` that resolves with a GraphQL response.
- `errorHandler`: A custom function that handles your errors from GraphQL or the fetch itself

Example #1 Server-side Rendering (SSR):
```js
import {graphql} from 'graphql';
import Schema from './rootSchema';
import {Transport} from 'cashay';
const graphQLHandler = function({query, variables}) => {
  return graphql(Schema, query, null, null, variables);
}
const transport = new Transport(graphQLHandler);
```
This is useful for server-side rendering and don't want cashay to make an HTTP roundtrip to itself.
Alternatively, for demo apps with in-memory databases, it makes sense to keep GraphQL on the client for easy debugging.

Example #2: A socket that offers an `emit` callback

```js
import {Transport} from 'cashay';
import {socket} from './myCustomSocketDriver';

const sendToServer = request => {
  return new Promise((resolve) => {
    socket.emit('graphql', request, (error, response) => {
      resolve(response);
    });
  });
};
const transport = new Transport(sendToServer);
```

Example #3: A vanilla websocket

```js
import {Transport} from 'cashay';
import {socket} from './myCustomSocketDriver';

const sendToServer = request => {
  return new Promise((resolve) => {
    socket.emit('graphqlRequest', request);
    socket.on('graphqlResponse', response => {
      resolve(response)
    })
  });
};
const transport = new Transport(sendToServer);
```
