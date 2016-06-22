import {RequestArgument} from '../helperClasses';
import {VARIABLE} from 'graphql/language/kinds';

export default function makeArgsFromVars(mutationFieldSchema, variables) {
  const mutationArgs = [];
  const argKeys = Object.keys(mutationFieldSchema.args);
  for (let i = 0; i < argKeys.length; i++) {
    const argKey = argKeys[i];
    const schemaArg = mutationFieldSchema.args[argKey];
    if (variables.hasOwnProperty(schemaArg.name)) {
      const newArg = new RequestArgument(schemaArg.name, VARIABLE, schemaArg.name);
      mutationArgs.push(newArg);
    }
  }
  return mutationArgs;
};
