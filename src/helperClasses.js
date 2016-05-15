import {
  OPERATION_DEFINITION,
  DOCUMENT,
  SELECTION_SET,
  NAME,
  ARGUMENT,
  VARIABLE,
  NAMED_TYPE,
  FIELD
} from 'graphql/language/kinds';
import {SET_VARIABLES} from './duck';
import {denormalizeStore} from './denormalize/denormalizeStore';
import {makeArgsAndDefs} from './mutate/mutationHelpers';

export class CachedMutation {
  constructor() {
    this.setKey = undefined;
    this.fullMutation = undefined;
    this.singles = {};
  }
}

export class CachedQuery {
  constructor(queryFunction, queryString, options, response) {
    this.ast = parse(queryString, {noLocation: true, noSource: true});
    this.refetch = () => queryFunction(queryString, options);
    this.response = response;
  }

  /**
   * create a denormalized document from local data
   * it also turns frags to inline, and flags missing objects and variableDefinitions in context.operation
   * the response also contains isComplete and firstRun booleans.
   * isComplete is true if the request is resolved locally
   * firstRun is true if the none of the queries within the request have been executed before
   */
  createResponse(context, componentId, dispatch, forceFetch) {
    this.response = denormalizeStore(context);
    const {data, firstRun} = denormalizeStore(context);
    this.response = {
      data,
      firstRun,
      isComplete: forceFetch === undefined ? true : !forceFetch && !context.operation.sendToServer,
      setVariables: this.setVariablesFactory(componentId, context.variables, dispatch)
    };
  }

  setVariablesFactory(componentId, currentVariables, dispatch) {
    return cb => {
      const variables = Object.assign({}, currentVariables, cb(currentVariables));
      // invalidate the cache
      this.response = undefined;

      // use dispatch to trigger a recompute.
      dispatch({
        type: SET_VARIABLES,
        payload: {
          componentId,
          variables
        }
      });
    }
  }
}

export class MutationShell {
  constructor(mutationName, mutationFieldSchema, variables) {
    const {mutationArgs, variableDefinitions} = makeArgsAndDefs(mutationFieldSchema, variables);
    this.kind = DOCUMENT;
    this.definitions = {
      kind: OPERATION_DEFINITION,
      operation: 'mutation',
      variableDefinitions,
      selectionSet: {
        kind: SELECTION_SET,
        // only 1 mutation at a time (for now?)
        selections: [{
          alias: null,
          arguments: mutationArgs,
          // TODO add directives support
          directives: [],
          kind: FIELD,
          name: {
            kind: NAME,
            value: mutationName
          },
          selectionSet: {
            kind: SELECTION_SET,
            selections: []
          }
        }]
      }
    };
  }
}

export class RequestArgument {
  constructor(nameValue, valueKind, valueValue) {
    this.kind = ARGUMENT;
    this.name = {
      kind: NAME,
      value: nameValue
    };
    this.value = {
      kind: valueKind
    };
    if (valueKind === VARIABLE) {
      this.value.name = this.name;
    } else {
      this.value.value = valueValue
    }
  }
}

export class VariableDefinition {
  constructor(argTypeName, variableName) {
    this.type = {
      kind: NAMED_TYPE,
      name: {
        kind: NAME,
        value: argTypeName
      },
      variable: {
        kind: VARIABLE,
        name: {
          kind: NAME,
          value: variableName
        }
      }
    }
  }
}
