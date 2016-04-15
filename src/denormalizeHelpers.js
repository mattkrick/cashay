import {TypeKind} from 'graphql/type/introspection';
import {INLINE_FRAGMENT, STRING, NAME, ARGUMENT, INT, VARIABLE} from 'graphql/language/kinds';
import {getRegularArgsKey, ensureTypeFromNonNull} from './utils';
import {separateArgs} from './separateArgs';

/**
 * given a parent field state & some args, drill down to the data using the args as a map
 *
 * @param {object} fieldState the parent field in the redux state.
 * @param {object} fieldSchema the portion of the clientSchema relating to the fieldState
 * @param {object} selection the original query that holds the arguments
 * @param {object} context
 *
 * @returns {*} the an object, or array, or scalar from the normalized store
 * */
export const getFieldState = (fieldState, fieldSchema, selection, context) => {
  const {arguments: fieldArgs} = selection;
  const {regularArgs, paginationArgs} = separateArgs(fieldSchema, fieldArgs, context);
  if (regularArgs) {
    const regularArgsString = getRegularArgsKey(regularArgs);
    fieldState = fieldState[regularArgsString];
  }
  if (paginationArgs) {
    const {before, after, first, last} = paginationArgs;
    // try to use the full array. if it doesn't exist, see if we're going backwards & use the back array, else front
    const usefulArray = fieldState.full || (last ? fieldState.back : fieldState.front);

    if (!usefulArray) {
      debugger
      console.log('no local data')
      return;
    }
    const cursor = before || after;
    let cursorIdx;
    if (cursor) {
      cursorIdx = usefulArray.find(doc => {
        const [typeName, docId] = doc.split(':');
        const storedDoc = context.store.entities[typeName][docId];
        return storedDoc.cursor === cursor
      });
      if (!cursorIdx) {
        console.error('invalid cursor');
      }
    } else {
      cursorIdx = last ? 1 : -1;
    }
    // if last is provided, then first is not and we need to go from last to first
    let missingDocCount;
    if (last) {
      // TODO copy working example from else statement
      // const minIdx = cursorIdx - last;
      // missingDocCount = -minIdx;
      // const realStartIdx = Math.max(0, minIdx);
      // fieldState = usefulArray.slice(realStartIdx, cursorIdx);
      // if (missingDocCount > 0) {
      //   const desiredDocCount = fieldArgs.find(arg => arg.name.value === context.paginationWords.last);
      //   if (missingDocCount < last) {
      //     fieldArgs[context.paginationWords.last] = missingDocCount;
      //     fieldArgs[context.paginationWords.before] = usefulArray[0].cursor;
      //   }
      // }
    } else {
      const maxIdx = cursorIdx + first;
      const isFull = usefulArray === fieldState.full;
      missingDocCount = maxIdx + 1 - usefulArray.length;
      fieldState = usefulArray.slice(cursorIdx + 1, cursorIdx + 1 + first);
      debugger
      // if there's a document missing & we don't have all the documents yet, get more!
      if (missingDocCount > 0 && !isFull) {
        console.log(`not enough data, need to fetch ${missingDocCount} more`);

        // if we have a partial response & the backend accepts a cursor, only ask for the missing pieces
        if (missingDocCount < first && fieldSchema.args.find(arg => arg.name === context.paginationWords.after)) {
          sendChildrenToServer(selection);
          const countArg = fieldArgs.find(arg => arg.name.value === context.paginationWords.first);
          countArg.value = {
            kind: INT,
            value: missingDocCount
          };
          const cursorNormalizedString = usefulArray[usefulArray.length - 1];
          const [typeName, docId] = cursorNormalizedString.split(':');
          const storedDoc = context.store.entities[typeName][docId];
          if (!storedDoc.cursor) {
            console.error(`No cursor was included for ${cursorNormalizedString}. Please include the cursor field for the ${fieldSchema.name} query`)
          }
          const newCursorArg = {
            kind: ARGUMENT,
            name: {
              kind: NAME,
              value: context.paginationWords.after,
              name: undefined
            },
            value: {
              kind: STRING,
              value: storedDoc.cursor
            }
          };
          const cursorArgIdx = fieldArgs.findIndex(arg => arg.name.value === context.paginationWords.after);
          if (cursorArgIdx > -1) {
            fieldArgs[cursorArgIdx] = newCursorArg;
          } else {
            fieldArgs.push(newCursorArg);
          }
        }
      }
    }
  }
  fieldArgs.forEach(arg => {
    if (arg.value.kind === VARIABLE) {
      const argInOperation = context.operation.variableDefinitions.find(varDef => {
        return varDef.variable.name.value === arg.value.name.value
      });
      // if calling denormalize from the _queryServer, it's possible we already nuked the arg from the operation
      if (argInOperation) {
        argInOperation._inUse = true;
      }
    }
  });
  return fieldState;
};

export const convertFragmentToInline = fragment => {
  delete fragment.name;
  fragment.kind = INLINE_FRAGMENT;
  return fragment;
};

export const calculateSendToServer = (field, idFieldName) => {
  const {selections} = field.selectionSet;
  for (let i = 0; i < selections.length; i++) {
    const selection = selections[i];
    if (selection.kind === INLINE_FRAGMENT) {
      calculateSendToServer(selection, idFieldName);
    }
    if (selection.sendToServer) {
      field.sendToServer = true;
    }
  }
};

export const sendChildrenToServer = reqAST => {
  reqAST.sendToServer = true;
  if (!reqAST.selectionSet) {
    return;
  }
  reqAST.selectionSet.selections.forEach(child => {
    sendChildrenToServer(child);
  })
};

// TODO: move this logic to the vistor
//let unionHasTypeNameChild = false;
//if (fieldSchema.type.kind === UNION) {
//
//  const fieldHasTypeName = field.selectionSet.selections.find(selection => selection.name.value === '__typename');
//  if (!fieldHasTypeName) {
//    field.selectionSet.selection.shift({
//      "kind": "Field",
//      "alias": null,
//      "name": {
//        "kind": "Name",
//        "value": "__typename",
//        "loc": null
//      },
//      "arguments": [],
//      "directives": [],
//      "selectionSet": null,
//      "loc": null
//    })
//  }
//}
