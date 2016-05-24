require('babel-register');

const path = require('path');
const rootSchema = require('../__tests__/schema').default;
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

// console.log(rootSchema)
graphql(rootSchema, introspectionQuery).then(result => {
  if (result.errors) {
    console.log(result.errors)
  } else {
    try {
      fs.writeFileSync(path.join(__dirname, '../__tests__/graphiqlSchema.json'), JSON.stringify(result.data.__schema, null, 2));
    }catch(e) {
      console.log(e)
    }
  }
});
