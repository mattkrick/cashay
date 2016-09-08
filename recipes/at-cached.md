# @cached

```
@cached(id: String, ids: [String]!, type: TypeName | [TypeName])
```

Often times we want a specific document, or subset of documents, that already exist on the client.
For example, let's say you have a query (or subscription) that gets every project for team member.
Then, in your "Project Details" component, you want _just_ a single project. 
And you don't want to call the server to get it.
That's what `@cached` does.

Let's start with a basic example:

```js
const string = `
query {
  teamMembers(teamId: $teamId) @live {
    id
    name
  }
  todoItem(teamId: $teamId) @live {
    id
    content
    teamMemberId
    teamMember @cached(type: "TeamMember") {
      id
      name
    } 
  } 
}`;

const options = {
  variables: {teamId},
  resolveCached: {teamMember: (source) => source.teamMemberId}
}

function mapStateToProps() {
  return {
    userQuery: cashay.query(string, options)
  }
}
```

Above we see a subscription that returns an array of `todoItem`, as well as all of our team members.
Each `todoItem` has a `teamMemberId` stored in its table, but the subscription lacks the actual `teamMember`
(since that's probably stored in the TeamMember table, and a subscription only returns a single table row).
However, we know the actual team member is on the client, so how do we get to it?
Well, you could imperatively write a function (`for each todoItem, for each teamMember...`).
But that's clunky, you'll have to memoize to to be performant, and it isn't easy to see what you're doing!
 
Instead, just use `@cached`, which will look in your state and find the `TeamMember` with the `id` 
matching the return value of `resolveCached`.
The above case works in O(1) time, since the state divided by `Type` and is hashed on `id`.

But let's say you wanted to match all documents by a certain criteria.
For example, every time a team member logs into your app, they get a new socket connection.
How can you see ALL the socket connections for each team member?

```js
const meetingContainerQuery = `
query{
  teamMembers(teamId: $teamId) @live {
    id
    name
    userId
    presence @cached(type: "[Presence]") {
      userId
    }
  }
}`;

const options = {
  resolveCached: {presence: (source) => (doc) => doc.userId === source.userId}
}
```

The first thing to note is the directive: `@cached(type: "[Presence]")`.
`Presence` is wrapped in brackets, denoting that you want to return an array.

The second thing to note is the `resolveCached` return value.
You're returning a function that returns `true` if you want to include it.
This works in O(n) time, which is great. 
Even better, your data requirements are written in a declarative fashion, so its easy to see what you component will get.
