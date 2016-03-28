export const minimizeQueryAST = (reqAST, idFieldName) => {
  //const {selectionSet} = reqAST;
  if (!reqAST.selectionSet) {
    return
  }
  debugger
  const {selections} = reqAST.selectionSet;
  let idField;
  for (let i = 0; i < selections.length; i++) {
    const field = selections[i];
    if (field.name && field.name.value === idFieldName) {
      idField = field;
    }
    if (!field.sendToServer) {
      selections[i] = undefined;
    } else {
      minimizeQueryAST(field, idFieldName);
      if (!field.selectionSet) {
        selections[i] = undefined;
      }
    }
  }
  const minimizedFields = selections.filter(Boolean);
  if (minimizedFields.length) {
    if (idField) {
      minimizedFields.push(idField)
    }
    reqAST.selectionSet = minimizedFields;
  } else {
    reqAST.selectionSet = null;
  }
};


//import {visit, QueryDocumentKeys} from 'graphql/language/visitor';
//import {TypeKind} from 'graphql/type/introspection';
//
//export const getMinimizedQuery = (reqAST, {schema, store}) => {
//  const stack = [];
//  let operationSchema;
//
//  const minimizedQuery = visit(reqAST, {
//    Document(node) {
//      if (node.definitions.length > 1) {
//        console.error('Multiple operations not supported');
//      }
//    },
//    OperationDefinition(node){
//      const operationKey = `${node.operation}Type`;
//      console.log('OPNAME', operationKey, schema[operationKey])
//      const operationName = schema[operationKey].name;
//      if (!operationName) {
//        console.error(`${operationKey} does not exist in your schema! Try queryType, mutationType, or subscriptionType`)
//      }
//      operationSchema = schema.types.find(type => type.name === operationName);
//    },
//    Field: {
//      enter(node) {
//        //if (node.selectionSet) {
//        //  let childField;
//        //  let parentEntity;
//        //  const fieldKey = node.name.value;
//        //  childField = operationSchema.fields.find(field => field.name === fieldKey);
//        //  if (childField) { /* Is it a query? */
//        //    parentEntity = normalizrSchema;
//        //  } else {
//        //    parentEntity = getNestedSchema(normalizrSchema, stack);
//        //    const parentTypeName = parentEntity.getKey();
//        //    const parentType = schema.types.find(field => field.name === parentTypeName);
//        //    childField = parentType.fields.find(field => field.name === fieldKey);
//        //  }
//        //  const fieldValue = getNormalizrValue(schema, childField.type);
//        //  if (fieldValue) {
//        //    parentEntity.define({[fieldKey]: fieldValue})
//        //  }
//        //  stack.push(fieldKey);
//        //}
//      },
//      leave(node) {
//
//        //if (node.selectionSet) {
//        //  stack.pop();
//        //}
//      }
//    }
//  });
//  //return normalizrSchema;
//};




// const queryString = `getPosts {
//   id,
//       title,
//       comments {
//     id,
//         title
//   }
// }`
//
// const mutationRules = {
//   add: {
//     Post(optimisticVariables, docFromServer, currentResponse, invalidate) {
//       invalidate();
//     },
//     Comment(optimisticVariables, docFromServer, currentResponse, invalidate) {
//       // optimisticVariables and docFromServer are mutually exclusive
//       let newComment = docFromServer;
//       if (optimisticVariables) {
//         const {title, user} = optimisticVariables;
//         newComment = {
//           title,
//           user,
//           createdAt: Date.now()
//         }
//       }
//
//       const postIndex = currentResponse.getPosts.findIndex(post => post.id === newComment.postId);
//       if (postIndex !== -1) {
//         const parentPost = currentResponse.getPosts[postIndex];
//         const placeBefore = parentPost.comments.findIndex(comment => comment.reputation < newComment.reputation);
//         if (placeBefore !== -1) {
//           return parentPost.comments.splice(placeBefore, 0, newComment);
//         }
//       }
//     }
//   }
// };
