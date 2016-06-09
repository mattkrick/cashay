import findTypeInQuery from './findTypeInQuery';
import getFieldState from '../normalize/getFieldState';
import {isObject} from '../utils';

export default function makeFriendlyStore(rawState, typeName, context) {
  const {operation, schema} = context;
  const recurseRawStore = (subStore, typeToFind) => {
    const friendlyStore = {};
    const typeKeys = Object.keys(subStore);
    const fieldSchema = schema.types[typeToFind];
    for (let i = 0; i < typeKeys.length; i++) {
      const typeKey = typeKeys[i];
      const rawFieldState = subStore[typeKey];
      const selection = findTypeInQuery(typeToFind, operation, schema);
      const fieldState = getFieldState(rawFieldState, fieldSchema, selection, context)
      if (isObject(fieldState) && schema.types[typeKey]) {
        fieldState[typeKey] = recurseRawStore(rawFieldState, typeKey);
      }
      friendlyStore[typeKey] = fieldState;
    }
    return friendlyStore;
  };
  recurseRawStore(rawState, typeName);
};
