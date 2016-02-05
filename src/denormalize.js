import clone from 'lodash/lang/clone'
import {getStateSlice} from './getStateSlice';

function visitObject(obj, schema, bag) {
  return Object.keys(obj).reduce((reduction, key) => {
    reduction[key] = visit(obj[key], schema[key], bag);
    return reduction;
  }, {})
}

function visitArray(obj, arraySchema, bag, argForCursor) {
  const itemSchema = arraySchema.getItemSchema();
  const itemSchemaKey = itemSchema.getKey();
  const argSelectionName = arraySchema._args ? JSON.stringify(arraySchema._args) : 'noArgs';
  const argSelection = obj[argSelectionName];
  const itemArray = getStateSlice(argSelection, arraySchema._paginationArgs, bag[itemSchemaKey], argSelectionName);
  return itemArray.reduce((reduction, itemKey) => {
    reduction.push(visit(itemKey, itemSchema, bag, argSelectionName));
    return reduction;
  },[])
}

function visitEntity(entity, entitySchema, bag, argForCursor) {
  const entityKey = entitySchema.getKey();
  const item = bag[entityKey][entity];
  return Object.keys(entitySchema).reduce((reduction, field) => {
    if (field === 'cursor') {
      // select the cursor based on the parent args
      reduction[field] = item.__cursor[argForCursor];
    } else if (typeof entitySchema[field] === 'object') {
      // recurse deeper
      reduction[field] = visit(clone(item[field]), entitySchema[field], bag, null);
    } else if (entitySchema[field] === true) {
      // grab the scalar
      reduction[field] = item[field];
    }
    return reduction;
  }, {})
}

function visit(obj, schema, bag, argForCursor) {
  switch (schema.constructor.name) {
    case 'EntitySchema':
      return visitEntity(obj, schema, bag, argForCursor);
    case 'ArraySchema':
      return visitArray(obj, schema, bag, argForCursor);
    case 'Object':
      return visitObject(obj, schema, bag, argForCursor);
    default:
      return obj;
  }
}

export function denormalize(state, schema) {
  if (typeof state !== 'object' || typeof schema !== 'object') {
    throw new Error('Denormalize: the state and schema must be objects.')
  }
  const {entities: bag, result} = state;
  return visit(result, schema, bag)
}
