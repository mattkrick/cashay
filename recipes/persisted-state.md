# Persisted state

Cashay is just a reducer, so it doesn't need any extra logic to persist data locally.
Any tool you use to persist your redux store will work for persisting your domain state, too!

Personally, I like using [redux-persist](https://github.com/rt2zz/redux-persist).
Redux-persist works by storing each reducer in in a key-value store like
`localStorage`, `localForage`, or React-native storage.
After each action is dispatched, it will update your locally-stored copy, too.
When your app starts up, you can rehydrate the persisted data back into your redux state.

A production setup might look like this:

```
persistStore(store, {transforms: [cashayPersistTransform]}, () => {
  cashay.create({
    store,
    schema: cashaySchema,
    transport: new HTTPTransport(...);
  });
  render(
    <AppContainer>
      <Root store={store}/>
    </AppContainer>,
    document.getElementById('root')
  );
});
```

A more advanced feature is removing stale data during rehydration, such as old query data.
That's what the `cashayPersistTransform` does above.
For example, if you use Cashay for authorization,
you might want to remove an expired JWT from a `getUserWithAuthToken` query:

```
import {createTransform} from 'redux-persist';
import jwtDecode from 'jwt-decode';

const cashayDeserializer = outboundState => {
  const auth = outboundState.data.result.getUserWithAuthToken;
  if (auth) {
    const authObj = auth[''];
    const {authToken} = authObj;
    if (authToken) {
      const authTokenObj = jwtDecode(authToken);
      if (authTokenObj.exp < Date.now() / 1000) {
        authObj.authToken = null;
      }
    }
  }
  return outboundState;
};

export default createTransform(
  state => state,
  cashayDeserializer,
  {whitelist: ['cashay']}
);
```
Note: Cashay stores data using the following pattern:
```
cashay.data.result[queryName][?arguments][?pagination]
```
You can verify this path by cracking open your friendly `redux-devtools`.

In the future, when time-to-live (TTL) metadata is supported,
Cashay will include a transfrom that will automatically delete all expired documents.
