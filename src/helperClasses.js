import {
  OPERATION_DEFINITION,
  DOCUMENT,
  SELECTION_SET,
  NAME,
  ARGUMENT,
  VARIABLE,
  NAMED_TYPE,
  FIELD,
  INLINE_FRAGMENT,
  VARIABLE_DEFINITION,
  LIST,
  LIST_TYPE
} from 'graphql/language/kinds';
import {SET_VARIABLES} from './duck';
import {denormalizeStore} from './denormalize/denormalizeStore';
import {makeArgsAndDefs} from './mutate/mutationHelpers';
import {parse, ensureRootType, ensureTypeFromNonNull} from './utils';

export class CachedMutation {
  constructor() {
    this.setKey = undefined;
    this.fullMutation = undefined;
    this.singles = {};
  }
}

export class CachedQuery {
  constructor(queryFunction, queryString, options, response) {
    this.ast = parse(queryString);
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

class SelectionSet {
  constructor(selections = []) {
    this.kind = SELECTION_SET;
    this.selections = selections;
  }
}

export class Name {
  constructor(value) {
    this.kind = NAME;
    this.value = value;
  }
}

class TypeCondition {
  constructor(condition) {
    this.kind = NAMED_TYPE;
    this.name = new Name(condition);
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
      selectionSet: new SelectionSet([{
        alias: null,
        arguments: mutationArgs,
        // TODO add directives support
        directives: [],
        kind: FIELD,
        name: new Name(mutationName),
        selectionSet: new SelectionSet()
      }])
    }
  }
}

export class RequestArgument {
  constructor(nameValue, valueKind, valueValue) {
    this.kind = ARGUMENT;
    this.name = new Name(nameValue);
    this.value = {
      kind: valueKind
    };
    if (valueKind === VARIABLE) {
      this.value.name = new Name(valueValue);
    } else {
      this.value.value = valueValue
    }
  }
}

export class VariableDefinition {
  constructor(variableName, argType) {
    debugger
    let argTypeNN = ensureTypeFromNonNull(argType);
    const rootType = ensureRootType(argTypeNN);
    const varDefType = {
      kind: NAMED_TYPE,
      name: new Name(rootType.name)
    };
    this.kind = VARIABLE_DEFINITION;
    this.type = argTypeNN.kind !== LIST ? varDefType : {
      kind: LIST_TYPE,
      type: varDefType
    };
    this.variable = {
      kind: VARIABLE,
      name: new Name(variableName)
    }
  }
}

export class InlineFragment {
  constructor(condition) {
    this.directives = [];
    this.kind = INLINE_FRAGMENT;
    this.selectionSet = new SelectionSet();
    this.typeCondition = new TypeCondition(condition);
  }
}
