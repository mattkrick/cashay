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
  LIST_TYPE
} from 'graphql/language/kinds';
import {TypeKind} from 'graphql/type/introspection';
import {SET_VARIABLES} from './normalize/duck';
import {denormalizeStore} from './normalize/denormalizeStore';
import {parse, ensureRootType, ensureTypeFromNonNull, inlineAllFragments, parseAndInitializeQuery} from './utils';
import {teardownDocumentAST} from './buildExecutionContext';

const {LIST} = TypeKind;

export class CachedMutation {
  constructor() {
    // this.setKey = undefined;
    this.fullMutation = undefined;
    this.singles = {};
    this.variableEnhancers = [];
  }
}

export class CachedQuery {
  constructor(queryFunction, queryString, options, response) {
    this.ast = parseAndInitializeQuery(queryString);
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
  constructor(mutationName, mutationArgs, variableDefinitions = []) {
    this.kind = DOCUMENT;
    this.definitions = [{
      kind: OPERATION_DEFINITION,
      operation: 'mutation',
      variableDefinitions,
      directives: [],
      selectionSet: new SelectionSet([new Field({args: mutationArgs, name: mutationName, selections: []})])
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
