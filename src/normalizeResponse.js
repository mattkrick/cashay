
import {mergeDeepWithArrs, mergeArrays} from './mergeDeep';
import {separateArgs} from './separateArgs';
import {getSubReqAST} from './getSubReqAST';
import {ensureRootType, getRegularArgsKey, isObject} from './utils';
import {TypeKind} from 'graphql/type/introspection';
const {UNION, INTERFACE, LIST, OBJECT, NON_NULL, SCALAR} = TypeKind;

const mapResponseToResult = (nestedResult, response, regularArgs, paginationArgs) => {
  const regularArgsString = getRegularArgsKey(regularArgs);
  if (paginationArgs) {
    const paginationObj = {};
    const {before, after, first, last} = paginationArgs;
    const arrName = first ? 'front' : last ? 'back' : 'full';
    paginationObj[arrName] = response;
    response = paginationObj;
  }
  if (regularArgs === false) {
    return response;
  } else {
    const resultObj = {[regularArgsString]: response};
    if (isObject(nestedResult) && !Array.isArray(nestedResult)) {
      // Not sure if I need recursive merging, but playing it safe
      const mutatedNestedResult = mergeDeepWithArrs(nestedResult, resultObj, {mergeArrays});
      return mutatedNestedResult;
    } else {
      return resultObj
    }
  }
};

const visitObject = (bag, subResponse, reqAST, subSchema, context) => {
  return Object.keys(subResponse).reduce((reduction, key) => {
    if (key.startsWith('__')) return reduction;
    let subReqAST = getSubReqAST(key, reqAST, context.fragments);
    const name = subReqAST.name.value;
    const field = subSchema.fields.find(field => field.name === name);
    let fieldType = ensureRootType(field.type);
    let fieldSchema = context.schema.types.find(type => type.name === fieldType.name);
    //debugger
    // handle first recursion where things are stored in the query
    fieldSchema = fieldSchema || subSchema.types.find(type => type.name === fieldType.name);
    const normalizedResponse = visit(bag, subResponse[key], subReqAST, fieldSchema, context);
    if (field.args && field.args.length) {
      const {regularArgs, paginationArgs} = separateArgs(field, subReqAST.arguments, context);
      reduction[name] = mapResponseToResult(reduction[name], normalizedResponse, regularArgs, paginationArgs);
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
  let stored = bag[entityKey][id];
  let normalized = visitObject(bag, subResponse, reqAST, subSchema, context);
  mergeDeepWithArrs(stored, normalized, {mergeArrays});
  return `${entityKey}:${id}`;
};

const visitIterable = (bag, subResponse, reqAST, subSchema, context) => {
  if (reqAST.arguments && reqAST.arguments.length) {
    const {first, last} = context.paginationWords;
    const count = reqAST.arguments.find(arg => arg.name.value === first || arg.name.value === last);
    if (count !== undefined) {
      const countVal = +count.value.value;
      if (subResponse.length < countVal) {
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
  const concreteSubScema = context.schema.types.find(type => type.name === subResponse.__typename);
  return visit(bag, subResponse, reqAST, concreteSubScema, context);
};

const visit = (bag, subResponse, reqAST, subSchema, context) => {
  if (!isObject(subResponse)) {
    return subResponse;
  } else if (Array.isArray(subResponse)) {
    return visitIterable(bag, subResponse, reqAST, subSchema, context);
  } else if (subSchema.kind === UNION) {
    return visitUnion(bag, subResponse, reqAST, subSchema, context);
  } else {
    const isEntity = !!subSchema.fields.find(field => field.name === context.idFieldName);
    if (isEntity) {
      const id = subResponse[context.idFieldName];
      if (id) {
        return visitEntity(bag, subResponse, reqAST, subSchema, context, id);
      }
      console.warn(`Cashay: Cannot normalize ${subSchema.name}. Did not receive '${context.idFieldName}' field.`)
    }
    return visitObject(bag, subResponse, reqAST, subSchema, context);
  }
};

export const normalizeResponse = (response, context) => {
  let bag = {};
  const operationType = `${context.operation.operation}Type`;
  const operationSchema = context.schema.types.find(type => type.name === context.schema[operationType].name);
  const result = visit(bag, response, context.operation, operationSchema, context);
  const data = {
    entities: bag,
    result
  };
  return data
};
