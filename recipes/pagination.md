# Pagination

Cashay uses cursor-based pagination.
That means your backend queries should accept `last, before` and/or `first, after` arguments.
Of course, naming is up to you (although it must be consistent across your whole backend).
Each returned document should also include a field called `cursor` that contains the cursor used by your database
in conjunction with `before, after`.
- `first`: The number of documents you want to receive _starting from the beginning of the array_.
- `last`: The number of documents you want to receive _starting from the end of the array_.
- `after`: The cursor of the document prior to the one you want. `first` will start counting at `after + 1`.
- `before`: Similar to `after`, but starting from the back of the array.
 For example, you want the _least_ recent posts on a query called `getRecentPosts`.

Cashay manages cursors for you.
All you have to do is request `first` or `last` (but not both!).
Behind the scenes, it will add the cursor and reduce the amount fetched.
For example, start by requesting 10 by passing in a `variables` object like `{first: 10}`.
Then when you want more, call `setVariables` and change the value to `20`.
Cashay will see that you already have the first 10 and only request the next 10 starting with the cursor of the last document you have.
Cashay enforces best practices and only supports querys that start from the beginning or end.
It will throw an error if you try to use the cursor within your queries.

## Starting from the middle of a query

Rarely, you'll need to start from the middle of a query.
For example, you have a chat search feature that returns the search result with the 10 chat lines above & below it.
Cashay currently offers 2 ways to accomplish this:
1. Use the ultra-efficient 2-part query method as shown above
2. Treat the result as a separate array.
This will fetch possibly redundant documents (especially if you return multiple search results)
but an extra couple bytes is a fair trade for the speed & simplicity.

## Detecting if all documents have been fetched

When paginating, it is useful to detect when there are no additional new docs left on the server.
Almost always, you can accomplish this by comparing the amount requested to the amount received.
For example, if you have 15 documents on the server & request them 10 at a time,
you know you've run out when the second request for 10 only returns 5.
However, this heuristic fails when you have 20 documents on the server because after the 2nd request
the second request will have returned 10, as expected, but there are no additional documents left to fetch.
To fix this, you have 2 options:
1. Have your server return n+1 documents. In doing so, you locally return an unseen document immediately
which makes for a beautifully responsive UI.
2. Have your server return n documents + a `null`. Doing so increases the array length by 1, but is otherwise ignored.
This is likely only useful if you care more about payload size than UI.
