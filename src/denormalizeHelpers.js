import {TypeKind} from 'graphql/type/introspection';
import {INLINE_FRAGMENT} from 'graphql/language/kinds';
import {getRegularArgsKey, ensureTypeFromNonNull} from './utils';
import {separateArgs} from './separateArgs';

const {UNION, LIST, SCALAR} = TypeKind;

/**
 * given a parent field state & some args, drill down to the data using the args as a map
 *
 * @param {object} fieldState the parent field in the redux state.
 * @param {object} fieldSchema the portion of the clientSchema relating to the fieldState
 * @param {object} fieldArgs the original arguments provided by the reqAST
 * @param {object} context
 *
 * @returns {*} the an object, or array, or scalar from the normalized store
 * */
export const getFieldState = (fieldState, fieldSchema, fieldArgs, context) => {
  const {regularArgs, paginationArgs} = separateArgs(fieldSchema, fieldArgs, context);
  if (regularArgs) {
    const regularArgsString = getRegularArgsKey(regularArgs);
    fieldState = fieldState[regularArgsString];
  }
  if (paginationArgs) {
    const {before, after, first, last} = paginationArgs;
    // try to use the full array. if it doesn't exist, see if we're going backwards & use the back array, else front
    const usefulArray = fieldState.full || last ? fieldState.back : fieldState.front;

    if (!usefulArray) {
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
      const minIdx = cursorIdx - last;
      missingDocCount = -minIdx;
      const realStartIdx = Math.max(0, minIdx);
      fieldState = usefulArray.slice(realStartIdx, cursorIdx);
      if (missingDocCount > 0) {
        const desiredDocCount = fieldArgs[context.paginationWords.last];
        if (missingDocCount < desiredDocCount) {
          fieldArgs[context.paginationWords.last] = missingDocCount;
          fieldArgs[context.paginationWords.before] = usefulArray[0].cursor;
        }
      }
    } else {
      const maxIdx = cursorIdx + first;
      missingDocCount = maxIdx + 1 - usefulArray.length;
      fieldState = usefulArray.slice(cursorIdx + 1, cursorIdx + 1 + first);
      if (missingDocCount > 0) {
        console.log(`not enough data, need to fetch ${missingDocCount} more`);
        const desiredDocCount = fieldArgs[context.paginationWords.first];
        // if we have a partial response, only ask for the missing pieces
        if (missingDocCount < desiredDocCount) {
          fieldArgs[context.paginationWords.first] = missingDocCount;
          fieldArgs[context.paginationWords.after] = usefulArray[usefulArray.length - 1].cursor;
        }
      }
    }
  }
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
