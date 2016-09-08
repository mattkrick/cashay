# @live

```
@live
```

A decorator for enabling subscriptions in queries.

Basic example:

```js
const string = `
query {
  simpleUser: user @live {
    id
    name
  }
}`;

const options = {
  variables: {foo: 1},
  resolveChannelKey: {
    simpleUser: (source, args) => args.foo
  }
}

function mapStateToProps() {
  return {
    userQuery: cashay.query(string, options)
  }
}
```

In this example, we have a GraphQL subscription named `user` on the server.
This subscription returns a fixed set of fields.
By returning a fixed set of fields, you can optimize how the server handles these queries (skip parsing, validation, etc).
As is common, you may only need a field or 2 for a basic component, but then ALL the fields for the User Dashboard.
In that case, set your server up so they are 2 different channels.
For example, `user/123` gives you all the fields and `simpleUser/123` just gives you `id, name, picture`.
The field alias, `simpleUser` gets passed to your `subscriber` function as the channel name to make this easy.

By default, `resolveChannelKey` will return `source.id` or the value of the first argument, 
which is almost always what you want, anyways.


Now let's study a real-world production example:
```js
const string = `
query {
  teamMembers(teamId: $teamId) @live {
    id
    name
    picture
    projects @live {
      id
      content
    }
  }  
}`

const options = {
  variables: {teamId: '123'}
}
```
The above will begin a subscription that returns an array of team members on a team.
_Then_, for each team member, it will start a subscription for her projects, resulting in n+1 subscriptions.
Since no `resolveChannelKey` was provided for `teamMembers`, 
it will take the value of first argument. Since the first arg is `teamId`, the key will be `123`.

Assume that the `projects` subscription takes in a `teamMemberId` argument on the server.
The channel will be something like `projects/${teamMemberId}`.
Since we don't know that at the time this query is called, we can't pass in an argument.
But remember, by default it will use `source.id` as the key. 
Since `teamMembers` is the source, it will use `teamMember.id`.
As new people join your team, their projects will be subscribed to, automatically.
 
If we wanted to use the teamMember's name, we would write something like: 
```js
resolveChannelKey: {
  projects: source => source.name
}
``` 
