import {TypeKind} from 'graphql/type/introspection';
import {INLINE_FRAGMENT} from 'graphql/language/kinds';
import {ensureRootType, ensureTypeFromNonNull, TYPENAME} from '../utils';
import {
  calculateSendToServer,
  sendChildrenToServer,
  handleMissingData,
  getDocFromNormalString
} from './denormalizeHelpers';
import getFieldState from './getFieldState';


const {UNION, LIST, OBJECT} = TypeKind;

const arrayMetadata = ['BOF', 'EOF', 'count'];

const visitObject = (subState = {}, reqAST, subSchema, context, baseReduction = {}) => {
  return reqAST.selectionSet.selections.reduce((reduction, field) => {
    if (field.kind === INLINE_FRAGMENT) {
      // TODO handle null typeCondition?
      if (field.typeCondition.name.value === subSchema.name) {
        // only follow through if it's the correct union subtype
        visitObject(subState, field, subSchema, context, reduction);
      }
    } else if (field.name.value === TYPENAME) {
      reduction[TYPENAME] = subSchema.name;
    } else {
      const fieldName = field.name.value;
      const aliasOrFieldName = field.alias && field.alias.value || fieldName;
      const fieldSchema = subSchema.fields[fieldName];
      const hasData = subState.hasOwnProperty(fieldName);

      if (hasData) {
        let fieldState = subState[fieldName];
        if (fieldSchema.args) {
          fieldState = getFieldState(fieldState, fieldSchema, field, context);
        }
        reduction[aliasOrFieldName] = visit(fieldState, field, fieldSchema, context);
        if (field.selectionSet) {
          calculateSendToServer(field, context.idFieldName)
        }
      } else {
        reduction[aliasOrFieldName] = handleMissingData(visit, aliasOrFieldName, field, fieldSchema, context);
      }
    }
    return reduction
  }, baseReduction);
};

const visitNormalizedString = (subState, reqAST, subSchema, context) => {
  const {typeName, docId} = getDocFromNormalString(subState);
  const doc = context.cashayDataState.entities[typeName][docId];
  const fieldSchema = context.schema.types[typeName];
  return visit(doc, reqAST, fieldSchema, context);
};

const visitIterable = (subState, reqAST, subSchema, context) => {

  // recurse into the root type, since it could be nonnull(list(nonnull(rootType))). Doesn't work with list of lists
  const fieldType = ensureRootType(subSchema.type);

  if (Array.isArray(subState)) {
    // get the schema for the root type, could be a union
    const fieldSchema = context.schema.types[fieldType.name];

    // for each value in the array, get the denormalized item
    const mappedState = [];
    for (let i = 0; i < subState.length; i++) {
      const res = subState[i];
      mappedState[i] = visit(res, reqAST, fieldSchema, context);
    }
    for (let i = 0; i < arrayMetadata.length; i++) {
      const metadataName = arrayMetadata[i];
      if (subState[metadataName]) {
        mappedState[metadataName] = subState[metadataName];
      }
    }
    return mappedState;
  }
  // recursively climb down the tree, flagging each branch with sendToServer
  sendChildrenToServer(reqAST);

  // return an empty array as a placeholder for the data that will come from the server
  return [];
};

const visit = (subState, reqAST, subSchema, context) => {
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

export default function denormalizeStore(context) {
  // if we have nothing in the local state for this query, send it right to the server
  let firstRun = true;

  // Lookup the root schema for the queryType (hardcoded name in the return of the introspection query)
  const {querySchema} = context.schema;

  // a query operation can have multiple queries, gotta catch 'em all
  const queryReduction = context.operation.selectionSet.selections.reduce((reduction, selection) => {
    const queryName = selection.name.value;

    // aliases are common for executing the same query twice (eg getPerson(id:1) getPerson(id:2))
    const aliasOrName = selection.alias && selection.alias.value || queryName;

    // get the query schema to know the expected type and args
    let queryFieldSchema = querySchema.fields[queryName];

    // look into the current redux state to see if we can borrow any data from it
    let queryInState = context.cashayDataState.result[queryName];

    // if there's no results stored or being fetched, save some time & don't bother with the args
    const fieldState = queryInState && getFieldState(queryInState, queryFieldSchema, selection, context);

    // if a result exists in the state, this isn't the first time the query was called.
    // a firstRun flag means there's no need to try to minimize the query pre-server fetch & no need to add deps
    if (fieldState) {
      firstRun = false;
    }
    // const query
    // get the expected return value, devs can be silly, so if the had the return value in a nonnull, remove it.
    const nonNullQueryFieldSchemaType = ensureTypeFromNonNull(queryFieldSchema.type);
    const subSchema = nonNullQueryFieldSchemaType.kind === LIST ? queryFieldSchema :
      ensureTypeFromNonNull(context.schema.types[nonNullQueryFieldSchemaType.name]);

    // recursively visit each branch, flag missing branches with a sendToServer flag
    reduction[aliasOrName] = visit(fieldState, selection, subSchema, context);

    // ugly code that's necessary in case the selection is a scalar. TODO clean!
    if (selection.selectionSet) {
      //shallowly climb the tree checking for the sendToServer flag. if it's present on a child, add it to the parent.
      calculateSendToServer(selection, context.idFieldName);
    } else if (reduction[aliasOrName] === undefined) {
      selection.sendToServer = true;
    }
    return reduction
  }, {});

  // add a sendToServerFlag to the operation if any of the queries need data from the server
  calculateSendToServer(context.operation, context.idFieldName);

  // return what the user expects GraphQL to return

  return {
    data: queryReduction,
    firstRun
  };
};
