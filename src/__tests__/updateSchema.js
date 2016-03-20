require('babel-core/register');

const path = require('path');
const rootSchema = require('./src/schema');
const fs = require('fs');
const graphql = require('graphql').graphql;
const introspectionQuery = `
query IntrospectionQuery {
  __schema {
    queryType { name }
    mutationType { name }
    subscriptionType { name }
    types {
    ...FullType
    }
    directives {
      name
      args {
      ...InputValue
      }
      onOperation
      onFragment
      onField
    }
  }
}
fragment FullType on __Type {
  kind
  name
  fields(includeDeprecated: false) {
    name
    args {
    ...InputValue
    }
    type {
    ...TypeRef
    }
  }
  inputFields {
  ...InputValue
  }
  interfaces {
  ...TypeRef
  }
  enumValues(includeDeprecated: false) {
    name
  }
  possibleTypes {
  ...TypeRef
  }
}
fragment InputValue on __InputValue {
  name
  type { ...TypeRef }
  defaultValue
}
fragment TypeRef on __Type {
  kind
  name
  ofType {
    kind
    name
    ofType {
      kind
      name
      ofType {
        kind
        name
      }
    }
  }
}`;

graphql(rootSchema, introspectionQuery).then(result => {
  if (result.errors) {
    console.log(result.errors)
  } else {
    try {
      fs.writeFileSync(path.join(__dirname, './clientSchema.json'), JSON.stringify(result.data.__schema, null, 2));
    }catch(e) {
      console.log(e)
    }
  }
});
