# Multi-part queries

Sometimes, it is preferable to sacrifice a round trip in exchange for a smaller payload.
In such a case, you'd want to perform a 2-part query.

In the same operation, you would have 2 queries.
The first query would be something like `getPostIds`,
which would return an array like `['123', '124', '125']`.

The second query would be something like `getPostsByIds`,
which accepts a required array of IDs `($IDs: [ID!]!)`

then your variables might look like `{IDs: (response, cashayState) => response.getPostIds}`
If you pass in a function for a variable, cashay will try to find it in the response from the query.
It's here that you can perform a filter against what you already have, eg `cashayState.entities.Posts`.

Since `IDs` will be falsy for the first pass, that query will be removed from initial server request.
Then, after the response comes back, `getPostIds` will be removed from the second server request
since that piece was returned locally.

In other words, Cashay asks for as much data as possible as soon as possible,
but never asks the server for something it already has.
