import path from 'path';
import fs from 'fs';
import minimist from 'minimist';
import introspectionQuery from './introspectionQuery';
import fetch from 'isomorphic-fetch';
import transformSchema from './transformSchema';

// why instanceof is still a thing is beyond me...
const graphql = require(path.join(process.cwd(), 'node_modules', 'graphql')).graphql;

const urlRegex = /^(https?|ftp):\/\/(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/i;

export default async function updateSchema() {
  const args = minimist(process.argv);
  const inputArg = args._[2] || '';
  const relativeOutputPath = process.argv[3] || './clientSchema.json';
  const outputPath = path.join(process.cwd(), relativeOutputPath);
  const spacing = args.production ? 0 : 2;
  const oncomplete = args.oncomplete && require(path.join(process.cwd(), args.oncomplete));

  const rootSchema = await getSchema(inputArg);
  const finalResult = await transformSchema(rootSchema, graphql);
  try {
    fs.writeFileSync(outputPath, JSON.stringify(finalResult, null, spacing));
    console.log(`You got yourself a schema! See it here: ${outputPath}`);
    oncomplete && oncomplete();
  } catch (e) {
    console.log(`Error writing schema to file: ${e}`)
  }
}

const getSchema = async inputArg => {
  if (urlRegex.test(inputArg)) {
    const body = JSON.stringify({query: introspectionQuery});
    const res = await fetch(inputArg, {method: 'POST', body});
    const {status, statusText} = res;
    let resJSON;
    if (status >= 200 && status < 300) {
      resJSON = await res.json();
    } else {
      console.log(`Could not reach your GraphQL server: ${inputArg}.
        Error: ${statusText}`);
      return
    }
    if (resJSON.errors) {
      console.log(`The graphQL endpoint returned the following errors: ${JSON.stringify(resJSON.errors)}`);
    }
    return resJSON.data;
  }
  const relativeInputPath = path.join(process.cwd(), inputArg);
  let rootSchema;
  try {
    rootSchema = require(relativeInputPath).default;
  } catch (e) {
    console.log('Error requiring schema', e);
  }
  return rootSchema;
};
