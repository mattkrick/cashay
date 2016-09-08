import {
  OPERATION_DEFINITION,
  DOCUMENT,
  SELECTION_SET,
  NAME,
  ARGUMENT,
  VARIABLE,
  NAMED_TYPE,
  FIELD,
  VARIABLE_DEFINITION,
  LIST_TYPE,
  NON_NULL_TYPE
} from 'graphql/language/kinds';
import {TypeKind} from 'graphql/type/introspection';
import {SET_VARIABLES} from './normalize/duck';
import denormalizeStore from './normalize/denormalizeStore';
import parseAndInitializeQuery from './query/parseAndInitializeQuery';
import {getStateVars, parse, LOADING, COMPLETE} from './utils';

const {LIST, NON_NULL} = TypeKind;

export class CachedMutation {
  constructor() {
    this.fullMutation = undefined;
    this.activeQueries = {};
    this.variableEnhancers = [];
    this.variableSet = new Set();
    this.singles = {};
  }

  clear(clearSingles) {
    this.fullMutation = undefined;
    this.variableEnhancers = [];
    this.variableSet.clear();
    if (clearSingles) {
      this.singles = {};
    }
  }
}

export class CachedSubscription {
  constructor(subscriptionString, key, deps) {
    this.ast = parse(subscriptionString);
    this.deps = deps;
    this.responses = {
      [key]: {}
    };
  }
}

export class CachedQuery {
  constructor(queryString, schema, idFieldName, refetch, key) {
    this.ast = parseAndInitializeQuery(queryString, schema, idFieldName);
    this.refetch = refetch;
    this.responses = {
      [key]: {}
    };
  }

  /**
   * create a denormalized document from local data
   * it also turns frags to inline, and flags missing objects and variableDefinitions in context.operation
   */
  createResponse(context, op, key, dispatch, getState, forceFetch) {
    const data = denormalizeStore(context);
    const isComplete = !forceFetch && !context.operation.sendToServer;
    this.responses[key] = {
      data,
      setVariables: this.setVariablesFactory(op, key, dispatch, getState),
      status: isComplete ? COMPLETE : LOADING
    };
  }

  setVariablesFactory(op, key, dispatch, getState) {
    return cb => {
      // trigger an invalidation
      this.responses[key] = undefined;
      const cashayState = getState();
      const stateVars = getStateVars(cashayState, op, key) || {};
      const variables = {
        ...stateVars,
        ...cb(stateVars)
      };
      const payload = {ops: {[op]: {[key]: {variables}}}};

      // trigger a recompute
      dispatch({
        type: SET_VARIABLES,
        payload
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

export class Field {
  constructor({alias, args, directives, name, selections}) {
    this.kind = FIELD;
    this.alias = alias;
    this.arguments = args;
    this.directives = directives;
    this.name = new Name(name);
    this.selectionSet = selections ? new SelectionSet(selections) : null;
  }
}
export class MutationShell {
  constructor(mutationName, mutationArgs = [], variableDefinitions = [], isEmpty) {
    this.kind = DOCUMENT;
    this.definitions = [{
      kind: OPERATION_DEFINITION,
      operation: 'mutation',
      variableDefinitions,
      directives: [],
      selectionSet: new SelectionSet([new Field({
        args: mutationArgs,
        name: mutationName,
        selections: isEmpty ? null : []
      })])
    }]
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
    this.kind = VARIABLE_DEFINITION;
    this.type = processArgType(argType);
    this.variable = {
      kind: VARIABLE,
      name: new Name(variableName)
    }
  }
}

const processArgType = argType => {
  const vardefType = {};
  if (argType.kind === NON_NULL) {
    vardefType.kind = NON_NULL_TYPE;
    vardefType.type = processArgType(argType.ofType);
  } else if (argType.kind === LIST) {
    vardefType.kind = LIST_TYPE;
    vardefType.type = processArgType(argType.ofType);
  } else {
    vardefType.kind = NAMED_TYPE;
    vardefType.name = new Name(argType.name)
  }
  return vardefType;
};
