export const makeNormalizedDeps = entities => {
  const entityKeys = Object.keys(entities);
  const normalizedDeps = new Set();
  for (let i = 0; i < entityKeys.length; i++) {
    const entityName = entityKeys[i];
    const itemKeys = Object.keys(entities[entityName]);
    for (let j = 0; j < itemKeys.length; j++) {
      const itemName = itemKeys[j];
      const dep = `${entityName}.${itemName}`;
      normalizedDeps.add(dep);
    }
  }
  return normalizedDeps;
};

/*
 * reduce the fields to merge into the state
 * doing this here means a smaller flushSet and fewer invalidations
 * currently we mutate normalizedResponse. it may be worthwhile to make this pure
 * */
export const shortenNormalizedResponse = (normalizedResponse, cashayDataStore) => {
  // TODO what if a forceFetched result is the same as what's already in the store? Need to handle results, too.
  const {entities} = normalizedResponse;
  const entityKeys = Object.keys(entities);
  for (let entityName of entityKeys) {
    const storeEntity = cashayDataStore.entities[entityName];
    if (!storeEntity) {
      continue;
    }
    const newEntity = entities[entityName];
    const itemKeys = Object.keys(newEntity);
    for (let itemName of itemKeys) {
      const storeItem = storeEntity[itemName];
      if (!storeItem) {
        continue;
      }
      const newItem = newEntity[itemName];
      // storeItem could be a superset of newItem and we'd still want to remove newItem
      // so, we can't use a single stringify comparison, we have to walk each item in newItem
      // and remove items that are deepEqual (since an entity can have a nested array or object)
      deepEqualAndReduce(storeItem, newItem);
    }
  }
  return Object.keys(normalizedResponse).length && normalizedResponse;
};

/*
 * Returns a copy of the newItem that does not include any props where the value of both are equal
 */
const deepEqualAndReduce = (state, newItem, reducedNewItem = {}) => {
  const propsToCheck = Object.keys(newItem);
  for (let propName of propsToCheck) {
    const newItemProp = newItem[propName];

    // it the prop doesn't exist in state, put it there
    if (!state.hasOwnProperty(propName)) {
      reducedNewItem[propName] = newItemProp;
      continue;
    }

    // strict-equal must come after hasOwnProperty because the two could be null
    const stateProp = state[propName];
    if (stateProp === newItemProp) {
      continue;
    }

    // if they're not equal, it could be an array, object, or scalar
    if (Array.isArray(newItemProp)) {
      if (Array.isArray(stateProp) && newItemProp.length === stateProp.length) {
        //  an array of objects here is wrong. Better to be performant for those who play by the rules
        let isShallowEqual = true;
        for (let a = 0; a < newItemProp.length; a++) {
          if (newItemProp[a] !== stateProp[a]) {
            isShallowEqual = false;
            break;
          }
        }
        if (!isShallowEqual) {
          reducedNewItem[propName] = newItemProp;
        }
      } else {
        reducedNewItem[propName] = newItemProp;
      }
    } else if (typeof newItemProp === 'object' && newItemProp !== null) {
      if (typeof stateProp === 'object' && stateProp !== null) {
        // they're both objects, we must go deeper
        reducedNewItem[propName] = {};
        deepEqualAndReduce(stateProp, newItemProp, reducedNewItem[propName]);
      } else {
        reducedNewItem[propName] = newItemProp;
      }
    } else {
      // they're non-equal scalars
      reducedNewItem[propName] = newItemProp;
    }
  }
};
