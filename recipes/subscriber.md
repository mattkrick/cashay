# Subscriber

```
subscriber(channel, key, handlers)
```

- `channel`: The alias or field name next to your @live directive. 
This typically serves as the base channel for your sub. In `post/123` it would be `post`.
- `key`: The variables that you passed into the `subscribe` call. In `post/123` it would be `123`. 
- `handlers`: An object containing the following:
  - `add(doc, handlerOptions)`: A function that takes a new doc. Cashay will append it to the end of the stream.
  - `update(doc, handlerOptions)`: A function that takes a doc diff. 
 You only need to supply it with the fields that have changed.
  - `upsert(doc, handlerOptions)`: A function that will call `update` if the doc exists, else `add`.
 Preferred over `add` since `add` could sneak some duplicates in if a socket reconnects.
  - `remove(id, handlerOptions)`: A function that will remove the document with the given ID
  - `setStatus(newStatus)`: A function that will set the status of your subscription to whatever you want.
  This is useful, for example, if the docs coming down the wire are already in the DB, then you can set it to
  `initializing` and your front-end can react accordingly.

As shown above, each handler takes an object called `handlerOptions`, which has a single field: 
- `removeKeys`: If you'd like to remove a key from an object, pass in an array of fields to remove.
e.g. `['milk', 'soda']`.

Basic example:
```js
function subscriber(channel, key, handlers) {
  // compose your channel name how you like. I like the conventional REST-ish slash delimiter (eg `comments/123`)
  const channelName = `${channel}/${key}`;
  
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
      update(data.fields, {removeKeys: data.removeKeys});
    }
  });
  
  // you can do anything else here, too
  socket.on('unsubscribe', unsubChannel => {
    if (unsubChannel === channelName) {
      console.log(`unsubbed from ${unsubChannel}`);
    }
  });
  
  // you should return a function that will end this subscription
  return () => socket.unsubscribe(channelName);
}
```
