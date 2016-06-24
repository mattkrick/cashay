# Server-side rending

Cashay supports server-side rending out of the box.

First, you'll need to create a redux store:
```
const store = createStore(reducer, {});
```

Second, you need to create the Cashay singleton:
```
import {cashay, ServerSideTransport} from 'cashay';
const cashaySchema = require('cashay!./utils/getCashaySchema.js');
cashay.create({
  store,
  schema: cashaySchema,
  transport: new ServerSideTransport(...)
});
```
_Note: if you use a bundler like webpack, make sure that this file is included in the bundle.
You'll want the `cashay` that you `import` here
to be the same `cashay` that you use in your components. (singletons are no fun like that)_

Third, you'll want to stringify your state to send it down the wire:
```
const initialState = `window.__INITIAL_STATE__ = ${JSON.stringify(store.getState())}`;

// assume you use a react jsx template for SSR
 <html>
   <body>
    ...
    <script dangerouslySetInnerHTML={{__html: initialState}} />
   </body>
 </html>
```

Finally, when it arrives on the client, you'll want to rehydrate the state:

```
const initialState = window.__INITIAL_STATE__;
store = createStore(reducer, initialState);
```

And there you have it!
