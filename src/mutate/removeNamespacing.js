import {isObject, CASHAY} from '../utils';

export default function removeNamespacing(dataObj, componentId) {
  const normalizedData = removeNamespacedFields(dataObj, componentId);

  // recurse
  const queryKeys = Object.keys(normalizedData);
  for (let queryKey of queryKeys) {
    const normalizedProp = normalizedData[queryKey];
    if (isObject(normalizedProp)) {
      if (Array.isArray(normalizedProp)) {
        normalizedData[queryKey] = normalizedProp.map(prop => removeNamespacing(normalizedProp, componentId));
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
  for (let queryKey of queryKeys) {
    const [prefix, fieldComponentId, fieldName] = queryKey.split('_');
    if (prefix === CASHAY) {
      if (fieldComponentId === componentId) {
        normalizedData[fieldName] = normalizedData[queryKey];
      }
      delete normalizedData[queryKey];
    }
  }
  return normalizedData;
};
