import mergeStores from './mergeStores';
import {separateArgs} from './separateArgs';
import {getSubReqAST} from './getSubReqAST';
import {ensureRootType, getRegularArgsKey, isObject} from '../utils';
import {TypeKind} from 'graphql/type/introspection';
const {UNION} = TypeKind;

const mapResponseToResult = (nestedResult, response, fieldSchema, reqASTArgs, context) => {
  const {regularArgs, paginationArgs} = separateArgs(fieldSchema, reqASTArgs, context);
  const regularArgsString = getRegularArgsKey(regularArgs);
  if (paginationArgs) {
    const {first, last} = paginationArgs;
    const arrName = first ? 'front' : last ? 'back' : 'full';
    response = {[arrName]: response};
  }
  if (regularArgs === false) {
    return response;
  } else {
    const resultObj = {[regularArgsString]: response};
    return (isObject(nestedResult) && !Array.isArray(nestedResult)) ? mergeStores(nestedResult, resultObj) : resultObj;
  }
};

const visitObject = (bag, subResponse, reqAST, subSchema, context) => {
  return Object.keys(subResponse).reduce((reduction, key) => {
    if (key.startsWith('__')) return reduction;
    let subReqAST = getSubReqAST(key, reqAST, context.fragments);
    const name = subReqAST.name.value;
    const field = subSchema.fields[name];
    if (!field) {
      throw new Error(`No field exists for ${field}. Did you update your schema?`)
    }
    let fieldType = ensureRootType(field.type);
    let fieldSchema = context.schema.types[fieldType.name];
    // handle first recursion where things are stored in the query
    fieldSchema = fieldSchema || subSchema.types[fieldType.name];
    const normalizedResponse = visit(bag, subResponse[key], subReqAST, fieldSchema, context);
    if (field.args) {
      reduction[name] = mapResponseToResult(reduction[name], normalizedResponse, field, subReqAST.arguments, context);
    } else {
      reduction[name] = normalizedResponse;
    }
    return reduction;
  }, {})
};
const visitEntity = (bag, subResponse, reqAST, subSchema, context, id) => {
  const entityKey = subSchema.name;
  bag[entityKey] = bag[entityKey] || {};
  bag[entityKey][id] = bag[entityKey][id] || {};
  let normalized = visitObject(bag, subResponse, reqAST, subSchema, context);
  bag[entityKey][id] = mergeStores(bag[entityKey][id], normalized);
  return `${entityKey}:${id}`;
};

const visitIterable = (bag, subResponse, reqAST, subSchema, context) => {
  if (reqAST.arguments && reqAST.arguments.length) {
    const {first, last} = context.paginationWords;
    const count = reqAST.arguments.find(arg => arg.name.value === first || arg.name.value === last);
    if (count !== undefined) {
      const countVal = +count.value.value;
      if (subResponse.length < countVal) {
        // assign an EOF to an array is OK because the final merged result stores this metadata in the key (ie "full")
        subResponse.EOF = true;
      }
    }
  }
  const normalizedSubResponse = subResponse.map(res => visit(bag, res, reqAST, subSchema, context));
  if (subResponse.EOF) {
    normalizedSubResponse.EOF = true;
  }
  return normalizedSubResponse
};

const visitUnion = (bag, subResponse, reqAST, subSchema, context) => {
  const concreteSubScema = context.schema.types[subResponse.__typename];
  return visit(bag, subResponse, reqAST, concreteSubScema, context);
};

const visit = (bag, subResponse, reqAST, subSchema, context) => {
  if (!isObject(subResponse)) {
    return subResponse;
  }
  if (Array.isArray(subResponse)) {
    return visitIterable(bag, subResponse, reqAST, subSchema, context);
  }
  if (subSchema.kind === UNION) {
    return visitUnion(bag, subResponse, reqAST, subSchema, context);
  }
  const {idFieldName} = context;
  if (subSchema.fields[idFieldName]) {
    const id = subResponse[idFieldName];
    return visitEntity(bag, subResponse, reqAST, subSchema, context, id);
  }
  return visitObject(bag, subResponse, reqAST, subSchema, context);
  
};

export default (response, context) => {
  const entities = {};
  const result = visit(entities, response, context.operation, context.schema.querySchema, context);
  return {
    entities,
    result
  };
};
