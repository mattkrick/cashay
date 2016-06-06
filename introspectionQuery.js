module.exports = `
query {
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
