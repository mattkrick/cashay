# Subscriptions

Subscriptions usually mean sockets, which means client state is kept on the server.
It also means tying your backend to a pubsub, whether that is built-in (like RethinkDB),
a message queue (like redis or RabbitMQ), or something built into your socket engine (SocketCluster).
 
With all these variables, it's hard to decide which strategy is universally the best.
I've decided that the best solution is the one where the query string represents how you want your data to look.
This forces your data to accurately reflect your GraphQL schema.
I'll write more here as the ideas get flushed out further.


# LEGACY PATTERNS (NOT POSSIBLE IN CURRENT VERSION)

## Single-table changefeeds

Assuming you have something like RethinkDB that will push a message every time a row in a database
table is mutated, you can subscribe to this. For every `n` times you call `cashay.subscribe`, your
server has `n` open subscriptions. This option is great because it is simple, but not so great because
the data comes in different streams. While this keeps the payload size down, you must join the streams
in the application layer, which isn't the most intuitive place to do it.

## Multi-table changefeeds

Very specific to RethinkDB, you can execute a changefeed on a table join. 
This allows for a much smaller number of subscriptions to manage.
However, it isn't as granular and requires logic on the server to diff the data
and return that diff to the client.
It also makes a mess of the GraphQL subscription, since that join is pretty static.

## Schema-triggered subscriptions

A GraphQL schema has many fields. Those fields know if the root operation is a `subscription` and can act accordingly. 
For example, inside a `Post` subscription, I can see if the incoming query wants the `comments` fields.
On that comments field, if the `ref.operation.operaton === 'subscription'` then I can open a new changefeed.
Then, I would pass in a `path` stack to grow it so I know that `comments` is a child of `Post`.

## Real-time event-driven subscriptions

An alternative approach to subscriptions is to trigger a query when a trigger is received.
For example, client A updates his avatar, which sends `NEW_AVATAR` message to Client B.
Client B then queries the new avatar for Client A.
Alternatively, Client B can retrigger a specific query with `forceFetch = true`. 
This would result in a larger payload, but less client logic. 

