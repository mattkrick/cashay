[![npm version](https://badge.fury.io/js/cashay.svg)](https://badge.fury.io/js/cashay)

[![Build Status](https://travis-ci.org/mattkrick/cashay.svg?branch=master)](https://travis-ci.org/mattkrick/cashay)

# Cashay
Relay for the rest of us

## Installation
npm i -S cashay

## How's it different from Relay?
|                                               |Cashay |Relay|
|-----------------------------------------------|-------|-----|
| Uses redux                                    | Yes   | No  |
| Local state & domain state in the same store  | Yes   | No  |
| Babelfication-free                            | Yes   | No  |
| Uses the introspection query on the client    | Yes   | No  |
| No big changes to your server                 | Yes   | No  |
| Writes your mutations for you                 | Yes   | No  |
| DRY optimistic updates                        | Yes   | No  |
| Allows for more than append/prepend mutations | Yes   | No  |
| Works with all frontends                      | Yes   | No  |
| Allows for colocation                         | No    | Yes |

## Usage

### Creating the client schema

Cashay sends a subset of the introspection query to the client. Creating it is easy because cashay givces you the script.
`updateSchema(pathToSchema = './', outputPath = './clientSchema.json', numberOfSpaces = 0)`

To make it even easier, just add an npm script like so (assuming the schema is in your `src` folder):

`"updateSchema": "node node_modules/cashay/updateSchema.js src/schema.js src/clientSchema.json"`

### Adding the reducer

Cashay is just like any other redux reducer:
```
import {createStore, compose, combineReducers} from 'redux'
import {cashayReducer} from 'cashay';
const rootReducer = combineReducers({cashay: cashayReducer});
const store = createStore(rootReducer, {});
```

### Creating the singleton

Cashay is front-end agnostic, so instead of passing it through React context or making you replace `react-redux` with something non-vanilla, you can just easily export your singleton from where you created it.
```
import clientSchema from './clientSchema.json';
import {Cashay} from 'cashay';
export const cashay = new Cashay(paramsObject);
```

The params that you can pass in are as follows:
- `store`: Your redux store
- `schema`: your client schema that cashay helped you make
- `idFieldName`: Defaults to `id`, but you can call it whatever it is in your DB (eg Mongo uses `_id`)
- `paginationWords`: The reserved words that you use for pagination. Defaults to an object with 4 properties: `first, last, after, before`. If, for example, your backend uses `count` instead of `first`, you'd send in `{first: 'count'}`.
- `transport`: A function used to send off the query + variables to your GraphQL server.
- `getToState`: A function to get to the cashay sub-state inside the redux state. Defaults to `store => store.getState().cashay`

Now, whenever you need to query or mutate some data, just import your shiny new singleton!

## API

### Queries

`cashay.query(queryString, options)`

Options include: 
- `component`: A string to match the component. Typically shares the same name as the React component. If left blank, it defaults to the `queryString`.
- `key`: A unique key to match the component instance, only used where you would use React's `key` (eg in a component that you called `map` on in the parent component). 
- `forceFetch`: A boolean to ignore local data & get some fresh stuff. Defaults to false. Don't use this in `mapStateToProps` or you'll be calling the server every time you call `dispatch`.
- `transport`: A function to override the singleton transport. Useful if this particular component needs different credentials, or uses websockets, etc.
- `variables`: the variables object to pass onto the GraphQL server
- `customMutations`: Cashay writes mutations for you and guarantees no over/under fetching. But if you don't trust it, you can write your own here.
- `mutationHandlers` An object where each method is the name of a mutation that changes the query. See below.

`mutationHandler(optimisticVariables, serverData, currentResponse, entities, invalidate)`

A mutation handler is called twice per mutation: once with `optimisticVariables` (for optimistic updates), and again with `serverData` when the mutation response comes back. Return a value to change the state. Don't return anything & the state won't change.

- `optimisticVariables`: The variables you send to the server when you call a mutation. You can use this to optimistically update the UI. Is `null` when the function is called after receving a resonse from the server.
- `serverData`: The data that came back from the server. The shape is identical to whatever the `type` is in your GraphQL schema for that mutation. It is `null` when optimistically updating.
- `currentResponse`: The response you receive from your query. The shape follows whatever you entered in `queryString`.
- `entities`: The entities stored in your redux state. This is useful in case you want to e.g. replace a deleted document with the next-best one you have locally.
- `invalidate`: A function that you can call to retrigger the query (with `forceFetch = true`). This is useful if you want to guarantee that a query has accurate data after each mutation. - 


For this example, we'll use React and `react-redux`:
```
const mapStateToProps = (state, props) => {
  return {
    cashay: cashay.query(queryString, options)
  }
};
```

Following the example above, `this.props.cashay` will be an object that has the following:
- isComplete`: A Boolean telling you if the query came back with all requested information. You can use this to determine if you want to put in a loading spinner, etc.
- firstRun`: A Boolean telling you if this is the first time that the query was run with these particular arguments.
- data`: The data objet that you expect to get back when you call your GraphQL server.
- setVariables`: A callback to run when you want to change your query variables. See below.

### Setting variables

Cashay gives you a function to make setting variables dead simple. It gives you your component's variables that are currently in the store, and then it's up to you to give it back a new variables object:

```
const {setVariables} = this.props.cashay;
    setVariables(currentVariables => {
      return {
        count: currentVariables.count + 2
      }
    })
```

### Mutations

Cashay mutations are pretty darn simple, too:

```
cashay.mutate(mutationName, options)
```

Cashay is smart. For example, it will go through all the `mutationHandlers` that are currently, active looking for any handlers for `mutationName`. Then, it intersects your mutation payload schema with the corresponding queries to automatically fetch all the fields you need. No fat queries, no problems. If two different queries need the same field but with different arguments (eg. Query1 needs `profilePic(size:SMALL)` and Query2 needs `profilePic(size:LARGE)`, it'll take care of that, too.

The options are as follows:
- `variables`: The variables object to pass onto the GraphQL server.
- `components`: An object the determine which `mutationHandlers` to call. By default, it'll call every `component` that has a `mutationHandler` that for `mutationName`. 

In the example below, we just call the `comments` component where `key === postId`. Additionally, we call the `mutationHandler` for `post` if the value is true. This allows you to write multiple mutations that have the same `mutationName` but affect different queries.
```
const {postId} = this.props;
const mutationAffectsPostComponent = true; // can be dynamic
const components = {
  comments: postId,
  post: mutationAffectsPostComponent
}
```

## Example

https://github.com/mattkrick/cashay-playground

## Contributing

Cashay is a young project, so there are sure to be plenty of bugs to squash and edge cases to capture. Bugs will be fixes with the following priority:
- Submit an issue: LOW
- Submit a PR with a failing test case: MEDIUM
- Submit a PR with a passing test case: SUPER HIGH HIGH FIVE!

##License

MIT
