import mergeStores from './mergeStores';
import separateArgs from './separateArgs';
import {getSubReqAST} from './getSubReqAST';
import {
  ensureRootType,
  CACHED,
  getRegularArgsKey,
  isObject,
  getFieldSchema,
  NORM_DELIMITER,
  FULL,
  FRONT,
  BACK,
  TYPENAME,
  getVariableValue,
  parseCachedType
} from '../utils';
import {VARIABLE} from 'graphql/language/kinds';
import {TypeKind} from 'graphql/type/introspection';

const {UNION} = TypeKind;

const mapResponseToResult = (nestedResult, response, fieldSchema, reqASTArgs, context) => {
  if (!fieldSchema.args) return response;
  const {paginationWords, variables} = context;
  const {regularArgs, paginationArgs} = separateArgs(fieldSchema, reqASTArgs, paginationWords, variables);
  if (paginationArgs) {
    const {first, last} = paginationArgs;
    const arrName = first !== undefined ? FRONT : last !== undefined ? BACK : FULL;
    response = {[arrName]: response};
  }
  if (regularArgs === false) {
    return response;
  } else {
    const regularArgsString = getRegularArgsKey(regularArgs);
    const resultObj = {[regularArgsString]: response};
    return (isObject(nestedResult) && !Array.isArray(nestedResult)) ? mergeStores(nestedResult, resultObj) : resultObj;
  }
};

const visitObject = (bag, subResponse, reqAST, subSchema, context) => {
  const keys = Object.keys(subResponse);
  const reduction = {};
  const typenameField = reqAST && reqAST.selectionSet.selections.find(field => field.name.value === TYPENAME);
  const typenameAlias = typenameField && typenameField.alias && typenameField.alias.value || TYPENAME;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (key === typenameAlias) continue;
    if (reqAST) {
      const subReqAST = getSubReqAST(key, reqAST, subResponse[typenameAlias]);
      const name = subReqAST.name.value;
      const cachedDirective = subReqAST.directives.find(d => d.name.value === CACHED);
      if (cachedDirective) {
        const typeArg = cachedDirective.arguments.find(arg => arg.name.value === 'type');
        const typeName = getVariableValue(typeArg, context.variables);
        const {type} = parseCachedType(typeName);
        const typeSchema = context.schema.types[type];
        visit(bag, subResponse[key], subReqAST, typeSchema, context);
      } else {
        const fieldSchema = getFieldSchema(subReqAST, subSchema, context.schema);
        const fieldType = ensureRootType(fieldSchema.type);
        // handle first recursion where things are stored in the query (sloppy)
        const typeSchema = context.schema.types[fieldType.name] || subSchema.types[fieldType.name];
        const normalizedResponse = visit(bag, subResponse[key], subReqAST, typeSchema, context);
        reduction[name] = mapResponseToResult(reduction[name], normalizedResponse, fieldSchema, subReqAST.arguments, context);
      }
    } else {
      // this is for subscriptions, since we don't explicitly have a request AST
      const fieldSchema = subSchema.fields[key];
      const fieldType = ensureRootType(fieldSchema.type);
      const typeSchema = context.schema.types[fieldType.name];
      reduction[key] = visit(bag, subResponse[key], undefined, typeSchema, context);
    }
  }
  return reduction;
};
const visitEntity = (bag, subResponse, reqAST, subSchema, context, id) => {
  const entityKey = subSchema.name;
  bag[entityKey] = bag[entityKey] || {};
  bag[entityKey][id] = bag[entityKey][id] || {};
  let normalized = visitObject(bag, subResponse, reqAST, subSchema, context);
  bag[entityKey][id] = mergeStores(bag[entityKey][id], normalized);
  return `${entityKey}${NORM_DELIMITER}${id}`;
};

const visitIterable = (bag, subResponse, reqAST, subSchema, context) => {
  const normalizedSubResponse = subResponse.map(res => visit(bag, res, reqAST, subSchema, context));
  if (reqAST && reqAST.arguments && reqAST.arguments.length) {
    const {first, last} = context.paginationWords;
    const paginationFlags = [{word: first, flag: 'EOF'}, {word: last, flag: 'BOF'}];
    for (let i = 0; i < paginationFlags.length; i++) {
      const {word, flag} = paginationFlags[i];
      const count = reqAST.arguments.find(arg => arg.name.value === word);
      // allow count === 0
      if (count !== undefined) {
        let countVal;
        if (count.value.kind === VARIABLE) {
          const variableDefName = count.value.name.value;
          countVal = +context.variables[variableDefName];

          // pass the count onto the normalized response to perform a slice during the state merge
          normalizedSubResponse.count = subResponse.count;

          // MUTATES CONTEXT VARIABLES. update the difference in the variables (passed on to redux state)
          context.variables[variableDefName] = subResponse.length;

          // MUTATES ORIGINAL DENORMALIZED RESPONSE. kinda ugly, but saves an additional tree walk.
          subResponse.count = subResponse.length;

        } else {
          countVal = +count.value.value;
        }
        if (normalizedSubResponse.length < countVal) {
          normalizedSubResponse[flag] = true;
        }
        break;
      }
    }
  }
  return normalizedSubResponse
};

const visitUnion = (bag, subResponse, reqAST, subSchema, context) => {
  const typenameField = reqAST.selectionSet.selections.find(field => field.name.value === TYPENAME);
  const typenameAlias = typenameField.alias && typenameField.alias.value || TYPENAME;
  const concreteSubScema = context.schema.types[subResponse[typenameAlias]];
  return visit(bag, subResponse, reqAST, concreteSubScema, context);
};

const visit = (bag, subResponse, reqAST, subSchema, context) => {
  if (!isObject(subResponse) || subResponse instanceof Date) {
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

export default (response, context, isSubscription) => {
  const entities = {};
  let result;
  if (isSubscription) {
    result = visitEntity(entities, response, null, context.typeSchema, context, response[context.idFieldName]);
  } else {
    result = visitObject(entities, response, context.operation, context.schema.querySchema, context);
  }
  return {
    entities,
    result
  };
};
