import {TypeKind} from 'graphql/type/introspection';
import {FRAGMENT_SPREAD, INLINE_FRAGMENT} from 'graphql/language/kinds';
import {isObject, ensureRootType, ensureTypeFromNonNull} from './utils';
import {
  getFieldState,
  convertFragmentToInline,
  calculateSendToServer,
  sendChildrenToServer
} from './denormalizeHelpers';

const {UNION, LIST, OBJECT, SCALAR} = TypeKind;

const handleMissingData = (aliasOrFieldName, field, fieldSchema, context) => {
  const fieldType = ensureTypeFromNonNull(fieldSchema.type);
  if (fieldType.kind === SCALAR) {
    return null;
  } else if (fieldType.kind === LIST) {
    // TODO don't return a list? if there's a list, then we don't know the difference between missing data & no data
    return [];
  } else {
    const newFieldSchema = context.schema.types.find(type => type.name === fieldType.name);
    if (fieldType.kind === UNION) {
      // since we don't know what the shape will look like, make it look like everything
      return newFieldSchema.possibleTypes.reduce((reduction, objType) => {
        const newFieldSchema = context.schema.types.find(type => type.name === objType.name);
        // take the old, add the new, keep typename null
        return Object.assign(reduction, visit(reduction, field, newFieldSchema, context), {__typename: null});
        // sure to work, but less efficient
        // return {...reduction, ...visit(reduction, field, newFieldSchema, context)};
      }, {});
    }
    return visit({}, field, newFieldSchema, context);
  }
};

const visitObject = (subState = {}, reqAST, subSchema, context, baseReduction = {}) => {
  const reducedSelected = reqAST.selectionSet.selections.reduce((reduction, field, idx, selectionArr) => {
    if (field.kind === FRAGMENT_SPREAD) {
      const fragment = context.fragments[field.name.value];
      selectionArr[idx] = field = convertFragmentToInline(fragment);
    }
    if (field.kind === INLINE_FRAGMENT) {
      if (field.typeCondition.name.value === subSchema.name) {
        // only follow through if it's the correct union subtype
        visitObject(subState, field, subSchema, context, reduction);
      }
    } else if (field.name.value === '__typename') {
      reduction.__typename = subSchema.name;
    } else {
      const fieldName = field.name.value;
      const aliasOrFieldName = field.alias && field.alias.value || fieldName;
      const fieldSchema = subSchema.fields.find(field => field.name === fieldName);
      const hasData = subState.hasOwnProperty(fieldName);

      if (hasData) {
        let fieldState = subState[fieldName];
        if (fieldSchema.args && fieldSchema.args.length) {
          fieldState = getFieldState(fieldState, fieldSchema, field, context);
        }
        // const typeSchema = context.schema.types.find(type => type.name === fieldSchema.type.name);
        reduction[aliasOrFieldName] = visit(fieldState, field, fieldSchema, context);
        if (field.selectionSet) {
          calculateSendToServer(field, context.idFieldName)
        }
      } else {
        reduction[aliasOrFieldName] = handleMissingData(aliasOrFieldName, field, fieldSchema, context);
        field.sendToServer = true;
      }
    }
    return reduction
  }, baseReduction);
  reqAST.selectionSet.selections = reqAST.selectionSet.selections.filter(x => x !== 'xxx');
  return reducedSelected;
};

const visitNormalizedString = (subState, reqAST, subSchema, context) => {
  const [typeName, docId] = subState.split(':');
  const doc = context.store.entities[typeName][docId];
  const fieldSchema = context.schema.types.find(type => type.name === typeName);
  return visit(doc, reqAST, fieldSchema, context);
};

const visitIterable = (subState, reqAST, subSchema, context) => {

  // recurse into the root type, since it could be nonnull(list(nonnull(rootType))). Doesn't work with list of lists
  const fieldType = ensureRootType(subSchema.type);

  if (Array.isArray(subState)) {
    // get the schema for the root type, could be a union
    const fieldSchema = context.schema.types.find(type => type.name === fieldType.name);

    // for each value in the array, get the denormalized item
    return subState.map(res => visit(res, reqAST, fieldSchema, context));
  }
  // recursively climb down the tree, flagging each branch with sendToServer
  sendChildrenToServer(reqAST);

  // return an empty array as a placeholder for the data that will come from the server
  return [];
};

const visit = (subState, reqAST, subSchema, context) => {
  // debugger
  // By implementing a ternary here, we can get rid of a pointless O(n) find in visitObject
  const objectType = subSchema.kind ? subSchema.kind : subSchema.type.kind;

  switch (objectType) {
    case OBJECT:
      if (typeof subState === 'string') {
        return visitNormalizedString(subState, reqAST, subSchema, context);
      }
      return visitObject(subState, reqAST, subSchema, context);
    case UNION:
      return visitNormalizedString(subState, reqAST, subSchema, context);
    case LIST:
      return visitIterable(subState, reqAST, subSchema, context);
    default:
      return subState
  }
};

export const denormalizeStore = context => {
  // if we have nothing in the local state for this query, send it right to the server
  let firstRun = true;

  // Lookup the root schema for the queryType (hardcoded name in the return of the introspection query)
  const operationSchema = context.schema.types.find(type => type.name === context.schema.queryType.name);

  // a query operation can have multiple queries, gotta catch 'em all
  const queryReduction = context.operation.selectionSet.selections.reduce((reduction, selection) => {
    const queryName = selection.name.value;

    // aliases are common for executing the same query twice (eg getPerson(id:1) getPerson(id:2))
    const aliasOrName = selection.alias && selection.alias.value || queryName;

    // get the query schema to know the expected type and args
    let querySchema = operationSchema.fields.find(field => field.name === queryName);

    // look into the current redux state to see if we can borrow any data from it
    let queryInState = context.store.result[queryName];

    // if there's no results stored or being fetched, save some time & don't bother with the args
    let fieldState;
    if (queryInState) {
      if (isObject(queryInState)) {
        fieldState = getFieldState(queryInState, querySchema, selection, context);
      } else {
        fieldState = queryInState;
      }
    }

    // if a result exists in the state, this isn't the first time the query was called.
    // a firstRun flag means there's no need to try to minimize the query pre-server fetch & no need to add deps
    if (fieldState) {
      firstRun = false;
    }
    // const query
    // get the expected return value, devs can be silly, so if the had the return value in a nonnull, remove it.
    const subSchema = querySchema.type.kind === LIST ?
      querySchema : ensureTypeFromNonNull(context.schema.types.find(type => type.name === querySchema.type.name));

    // recursively visit each branch, flag missing branches with a sendToServer flag
    reduction[aliasOrName] = visit(fieldState, selection, subSchema, context);

    //shallowly climb the tree checking for the sendToServer flag. if it's present on a child, add it to the parent.
    calculateSendToServer(selection, context.idFieldName);
    return reduction
  }, {});

  // add a sendToServerFlag to the operation if any of the queries need data from the server
  calculateSendToServer(context.operation, context.idFieldName);

  // return what the user expects GraphQL to return

  return {
    data: queryReduction,
    // this is handy if the user wants to do something when a query is run for the first time
    _firstRun: firstRun,
    // this is handy if the user wants to know if the data is complete as requested (eg top-level spinners)
    _isComplete: !context.operation.sendToServer
  };
};
