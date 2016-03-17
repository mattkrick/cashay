//import {visit, QueryDocumentKeys} from 'graphql/language/visitor';
//import {TypeKind} from 'graphql/type/introspection';
//import {Schema, arrayOf, unionOf} from 'normalizr';
//import {getNestedSchema} from '../utils';
//
//const {OperationDefinition, Document} = QueryDocumentKeys;
//const {UNION, LIST, OBJECT} = TypeKind;
//
//class CashaySchema {
//  constructor() {
//    this.__argDict = {};
//  }
//
//  define(obj) {
//    Object.assign(this, obj);
//  }
//}
//
//const paginationWords = ['before', 'after', 'first', 'last'];
//const getRootTypeName = type => {
//  while (type.ofType) type = type.ofType;
//  return type.name;
//};
//
//const separateArgs = (schemaArgs, suppliedArgs) => {
//  const regularArgs = {};
//  const paginationArgs = {};
//  schemaArgs
//    .sort((a, b) => a.name < b.name)
//    .forEach(arg => {
//      const argObject = paginationWords.some(word => arg.name !== word) ? regularArgs : paginationArgs;
//      const suppliedArg = suppliedArgs.find(suppliedArg => suppliedArg.name.value === arg.name);
//      if (suppliedArg) {
//        const hardcodedVal = suppliedArg.value.value;
//        const argValue = hardcodedVal || `$${suppliedArg.value.name.value}`;
//        argObject[arg.name] = argValue;
//      }
//    });
//  const {before, after, first, last} = paginationArgs;
//  if (before && after) {
//    console.warn(`You cannot include a before and after cursor. The before cursor will be ignored`);
//    delete paginationArgs.before;
//  }
//  if (first && last) {
//    let toDelete = paginationArgs.after ? 'last' : 'first';
//    console.warn(`You cannot include a first and last limit. The ${toDelete} limit will be ignored`);
//    delete paginationArgs[toDelete];
//  }
//
//  return {regularArgs, paginationArgs};
//};
//
//const getNormalizrValue = (schema, {args, type}, suppliedArgs) => {
//  const {kind, ofType, name} = type;
//  const {regularArgs, paginationArgs} = separateArgs(args, suppliedArgs);
//  if (kind === OBJECT) {
//    const childType = schema.types.find(field => field.name === name);
//    const isEntity = childType.fields.some(field => field.name === 'id');
//    if (isEntity) {
//      const newEntity = new Schema(name);
//      return Object.assign(newEntity, {
//        __args: Object.keys(regularArgs).length ? {...regularArgs} : undefined
//      })
//    } else {
//      //TODO handle objects w/o ids
//    }
//  } else {
//    let normalizingFn;
//    if (kind === LIST) {
//      normalizingFn = arrayOf;
//    } else if (kind === UNION) {
//      normalizingFn = unionOf;
//    }
//    if (normalizingFn) {
//      //TODO handle getting the right ofType
//      const arrOrUnion = normalizingFn(new Schema(ofType.name));
//      return Object.assign(arrOrUnion, {
//        __args: Object.keys(regularArgs).length ? {...regularArgs} : undefined,
//        __paginationArgs: Object.keys(paginationArgs).length ? {...paginationArgs} : undefined
//      });
//    }
//  }
//};
//
//const addArgsToDict = (fieldValue, cashaySchema, stack) => {
//  const argFields = ['__args', '__paginationArgs'];
//  argFields.forEach(argField => {
//    const args = fieldValue[argField];
//    if (!args) return;
//    Object.keys(args).forEach(arg => {
//      const argVal = args[arg];
//      if (argVal[0] === '$') {
//        cashaySchema.__argDict[argVal.substring(1)] = `${stack.join('.')}.${argField}.${arg}`;
//      }
//    })
//  })
//};
//
//export const makeNormalSchema = (doc, schema) => {
//  const getNestedSchema = (obj, stack) => {
//    return stack.reduce((reduction, level) => {
//      const nextLevel = reduction[level];
//      return nextLevel.getItemSchema ? nextLevel.getItemSchema() : nextLevel;
//    }, obj);
//  };
//
//  export const makeNormalSchema = (doc, schema) => {
//    schema = schema.data.__schema;
//    const cashaySchema = new CashaySchema();
//    const stack = [];
//    let operationSchema;
//
//    visit(doc, {
//      Document(node) {
//        if (node.definitions.length > 1) {
//          console.error('Multiple operations not supported (yet?)');
//        }
//      },
//      OperationDefinition(node){
//        const operationKey = `${node.operation}Type`;
//        const operationName = schema[operationKey].name;
//        if (!operationName) {
//          console.error(`${operationKey} does not exist in your schema! Try queryType, mutationType, or subscriptionType`)
//        }
//        operationSchema = schema.types.find(type => type.name === operationName);
//      },
//      Field: {
//        enter(node) {
//          const parentEntity = getNestedSchema(cashaySchema, stack);
//          if (node.selectionSet) {
//            const fieldKey = node.name.value;
//            stack.push(fieldKey);
//            let childField = operationSchema.fields.find(field => field.name === fieldKey); //check inside rootQuery
//            if (node.selectionSet) {
//              let childField;
//              const fieldKey = node.name.value;
//              childField = operationSchema.fields.find(field => field.name === fieldKey); //check inside rootQuery
//              if (!childField) { /* Is it not a query? */
//                const parentTypeName = parentEntity.getKey();
//                const parentType = schema.types.find(field => field.name === parentTypeName);
//                childField = parentType.fields.find(field => field.name === fieldKey);
//              }
//              const fieldValue = getNormalizrValue(schema, childField, node.arguments);
//              if (fieldValue) {
//                parentEntity.define({[fieldKey]: fieldValue})
//              }
//              stack.push(fieldKey);
//            } else {
//              parentEntity[node.name.value] = true;
//            }
//          },
//          leave(node)
//          {
//            if (node.selectionSet) {
//              stack.pop();
//            }
//          }
//        }
//      });
//    return cashaySchema;
//  };
//
