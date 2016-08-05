import {print} from 'graphql/language/printer';
import makeArgsFromVars from './makeArgsFromVars';
import {MutationShell} from '../helperClasses';
import createVariableDefinitions from '../createVariableDefinitions';

export default function createBasicMutation(mutationName, schema, variables) {
  const mutationFieldSchema = schema.mutationSchema.fields[mutationName];
  if (!mutationFieldSchema) {
    throw new Error(`${mutationName} not found in your mutation schema! Did you include it?`)
  }
  const mutationArgs = makeArgsFromVars(mutationFieldSchema, variables);
  const context = {schema, initialVariableDefinitions: []};
  const {variableDefinitions} = createVariableDefinitions(mutationArgs, mutationFieldSchema, false, context);
  const mutationAST = new MutationShell(mutationName, mutationArgs, variableDefinitions, true);
  return print(mutationAST);
}
