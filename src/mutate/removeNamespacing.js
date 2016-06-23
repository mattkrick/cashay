import {isObject, CASHAY, DELIMITER} from '../utils';

export default function removeNamespacing(dataObj, componentId) {
  if (!isObject(dataObj)) {
    return dataObj;
  }
  const normalizedData = removeNamespacedFields(dataObj, componentId);
  const queryKeys = Object.keys(normalizedData);
  for (let i = 0; i < queryKeys.length; i++) {
    const queryKey = queryKeys[i];
    const normalizedProp = normalizedData[queryKey];
    if (isObject(normalizedProp)) {
      if (Array.isArray(normalizedProp)) {
        normalizedData[queryKey] = normalizedProp.map(prop => removeNamespacing(prop, componentId));
      } else {
        normalizedData[queryKey] = removeNamespacing(normalizedProp, componentId)
      }
    }
  }
  return normalizedData;
}

const removeNamespacedFields = (dataObj, componentId) => {
  const normalizedData = {...dataObj};
  let queryKeys = Object.keys(normalizedData);
  for (let i = 0; i < queryKeys.length; i++) {
    const queryKey = queryKeys[i];
    const [prefix, fieldComponentId, fieldNameOrAlias] = queryKey.split(DELIMITER);
    if (prefix === CASHAY) {
      if (fieldComponentId === componentId) {
        normalizedData[fieldNameOrAlias] = normalizedData[queryKey];
      }
      delete normalizedData[queryKey];
    }
  }
  return normalizedData;
};
