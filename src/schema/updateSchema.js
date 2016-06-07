import path from 'path';
import fs from 'fs';
import minimist from 'minimist';
import introspectionQuery from './introspectionQuery';
import fetch from 'isomorphic-fetch';

// why instanceof is still a thing is beyond me...
const graphql = require(path.join(process.cwd(), 'node_modules', 'graphql')).graphql;

const urlRegex = /^(https?|ftp):\/\/(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/i;

export default async function updateSchema() {
  const args = minimist(process.argv);
  const inputArg = args._[2] || '';
  const relativeOutputPath = process.argv[3] || './clientSchema.json';
  const outputPath = path.join(process.cwd(), relativeOutputPath);
  const spacing = args.production ? 0 : 2;
  const oncomplete = args.oncomplete && require(path.join(process.cwd(), args.oncomplete)).default;

  const rootSchema = await getSchema(inputArg);
  const initialResult = await graphql(rootSchema, introspectionQuery);

  if (initialResult.errors) {
    return console.log(`Error parsing schema: ${initialResult.errors}`)
  }
  const finalResult = makeMinimalSchema(initialResult.data.__schema);
  try {
    fs.writeFileSync(outputPath, JSON.stringify(finalResult, null, spacing));
    console.log(`You got yourself a schema! See it here: ${outputPath}`);
    oncomplete && oncomplete();
  } catch (e) {
    console.log(`Error writing schema to file: ${e}`)
  }
}

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

const getSchema = async inputArg => {
  if (urlRegex.test(inputArg)) {
    const body = JSON.stringify({query: introspectionQuery});
    const res = await fetch(inputArg, {method: 'POST', body});
    const {status, statusText} = res;
    let resJSON;
    if (status >= 200 && status < 300) {
      resJSON = await res.json();
    } else {
      return console.log(`Could not reach your GraphQL server: ${inputArg}. 
        Error: ${statusText}`);
    }
    if (resJSON.errors) {
      console.log(`The graphQL endpoint returned the following errors: ${JSON.stringify(resJSON.errors)}`);
    }
    return resJSON.data;
  }
  const relativeInputPath = path.join(process.cwd(), inputArg);
  return require(relativeInputPath);
};
