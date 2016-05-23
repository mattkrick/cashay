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

//TODO filter out interfaces
const makeMinimalSchema = schema => {
  removeNullsFromObject(schema);
  const queryName = schema.queryType && schema.queryType.name;
  const mutationName = schema.mutationType && schema.mutationType.name;
  const subscriptionName = schema.subscriptionType && schema.subscriptionType.name;
  const filteredTypes = schema.types.filter(type => !type.name.startsWith('__'));

  for (let type of filteredTypes) {
    if (type.fields) {
      for (let field of type.fields) {
        if (field.args) {
          if (field.args.length) {
            field.args = objArrayToHashMap(field.args);
          } else {
            delete field.args;
          }
        }
      }
      type.fields = objArrayToHashMap(type.fields);
    }
    if (type.enumValues) {
      type.enumValues = objArrayToHashMap(type.enumValues);
    }
    if (type.inputFields) {
      type.inputFields = objArrayToHashMap(type.inputFields)
    }
    if (type.possibleTypes) {
      type.possibleTypes = objArrayToHashMap(type.possibleTypes);
    }
    if (type.interfaces) {
      if (type.interfaces.length) {
        type.interfaces = objArrayToHashMap(type.interfaces);
      } else {
        delete type.interfaces;
      }
    }
  }
  const filteredTypesMap = objArrayToHashMap(filteredTypes);
  const filteredDirectives = schema.directives.filter(directive => {
    return directive.name !== 'deprecated';
  });
  for (let directive of filteredDirectives) {
    directive.args = objArrayToHashMap(directive.args);
  }
  const filteredDirectivesMap = objArrayToHashMap(filteredDirectives);
  const querySchema = filteredTypesMap[queryName];
  delete filteredTypesMap[queryName];
  const mutationSchema = filteredTypesMap[mutationName];
  delete filteredTypesMap[mutationName];
  const subscriptionSchema = filteredTypesMap[subscriptionName];
  delete filteredTypesMap[subscriptionName];

  const finalResult = {
    querySchema,
    types: filteredTypesMap,
    directives: filteredDirectivesMap
  };
  if (mutationSchema) {
    finalResult.mutationSchema = mutationSchema;
  }
  if (subscriptionSchema) {
    finalResult.subscriptionSchema = subscriptionSchema;
  }
  return finalResult;
};

const objArrayToHashMap = arr => {
  const hashMap = {};
  for (let field of arr) {
    hashMap[field.name] = field;
  }
  return hashMap;
};

