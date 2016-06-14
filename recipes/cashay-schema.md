# cashay-schema

The CLI script takes an `input` and an `output`:
- `input`: The relative path to
your server schema. Alternatively, you can pass in the url to a GraphQL endpoint
- `output`: The relative path to your output file. Defaults to
`./clientSchema.json`

Options:
- `--production`: Removes whitespaces from the generated `clientSchema.json`
- `--oncomplete`: A relative path to a callback to run after
generation is complete. This is useful if you need to drain a DB connection
pool:

```js
// drainPool.js
import r from './rethinkDBDriver';
export default () => {
  r.getPoolMaster().drain();
}
```

**Pro tip: Make it an npm script:**

`"updateSchema": "cashay-schema src/schema.js src/clientSchema.json --oncomplete src/drainPool.js --production"`

