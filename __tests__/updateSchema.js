require('babel-register');

const path = require('path');
const rootSchema = require('./schema').default;
const fs = require('fs');
const graphql = require('graphql').graphql;
const introspectionQuery = require('../src/introspectionQuery').default;

graphql(rootSchema, introspectionQuery).then(result => {
  if (result.errors) {
    console.log(result.errors)
  } else {
    try {
      fs.writeFileSync(path.join(__dirname, './clientSchema.json'), JSON.stringify(result.data.__schema, null, 2));
      console.log(`Success! check out: ${__dirname}/clientSchema.json`)
    }catch(e) {
      console.log(e)
    }
  }
});
