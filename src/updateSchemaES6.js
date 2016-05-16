import path from 'path';
import fs from 'fs';
import introspectionQuery from './introspectionQuery';
import {graphql} from 'graphql';

const relativeInputPath = path.join(process.cwd(), process.argv[2]);
const relativeOutputPath = process.argv[3] || './clientSchema.json';
const outputPath = path.join(process.cwd(), relativeOutputPath);
const rootSchema = require(relativeInputPath).default;
const spacing = Number(process.argv[4]) || 0;

graphql(rootSchema, introspectionQuery).then(initialResult => {
  if (initialResult.errors) {
    return console.log(`Error parsing schema: ${initialResult.errors}`)
  }
  const finalResult = makeMinimalSchema(initialResult.data.__schema);
  try {
    fs.writeFileSync(outputPath, JSON.stringify(finalResult, null, spacing));
    console.log(`You got yourself a schema! See it here: ${outputPath}`)
  } catch (e) {
    console.log(`Error writing schema to file: ${e}`)
  }
});

const isObject = val => val && typeof val === 'object';
const removeNullsFromList = list => {
  for (let item of list) {
    removeNullsFromObject(item)
  }
};
const removeNullsFromObject = obj => {
  const itemKeys = Object.keys(obj);
  for (let itemKey of itemKeys) {
    const field = obj[itemKey];
    if (Array.isArray(field)) {
      removeNullsFromList(field);
    } else if (isObject(field)) {
      removeNullsFromObject(field)
    } else if (field === null) {
      delete obj[itemKey];
    }
  }
};

const makeMinimalSchema = schema => {
  removeNullsFromObject(schema);
  const queryName = schema.queryType && schema.queryType.name;
  const mutationName = schema.mutationType && schema.mutationType.name;
  const subscriptionName = schema.subscriptionType && schema.subscriptionType.name;
  const filteredTypes = schema.types.filter(type => {
    return type.name !== queryName &&
      type.name !== mutationName &&
      type.name !== subscriptionName && !type.name.startsWith('__')
  });
  const filteredDirectives = schema.directives.filter(directive => {
    return directive.name !== 'deprecated';
  });
  const finalResult = {
    querySchema: schema.types.find(type => type.name === queryName),
    types: filteredTypes,
    directives: filteredDirectives
  };
  if (mutationName) {
    finalResult.mutationSchema = schema.types.find(type => type.name === mutationName);
  }
  if (subscriptionName) {
    finalResult.subscriptionSchema = schema.types.find(type => type.name === subscriptionName);
  }
  return finalResult;
};
