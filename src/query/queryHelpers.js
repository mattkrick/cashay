import {NON_NULL_TYPE} from 'graphql/language/kinds';
/*
 * reduce the fields to merge into the state
 * doing this here means a smaller flushSet and fewer invalidations
 * currently we mutate normalizedResponse. it may be worthwhile to make this pure
 * */
export const shortenNormalizedResponse = (normalizedResponse, cashayDataStore) => {
  // TODO what if a forceFetched result is the same as what's already in the store? Need to handle results, too.
  const {entities} = normalizedResponse;
  if (!entities) return;
  const typeKeys = Object.keys(entities);
  for (let i = 0; i < typeKeys.length; i++) {
    const typeName = typeKeys[i];
    const storeType = cashayDataStore.entities[typeName];
    if (!storeType) {
      continue;
    }
    const newType = entities[typeName];
    const entityKeys = Object.keys(newType);
    for (let j = 0; j < entityKeys.length; j++) {
      const entityName = entityKeys[j];
      const storeEntity = storeType[entityName];
      if (!storeEntity) {
        continue;
      }
      const newEntity = newType[entityName];
      // storeEntity could be a superset of newEntity and we'd still want to remove newEntity
      // so, we can't use a single stringify comparison, we have to walk each item in newEntity
      // and remove items that are deepEqual (since an entity can have a nested array or object)
      deepEqualAndReduce(storeEntity, newEntity);
    }
  }
  return Object.keys(normalizedResponse).length && normalizedResponse;
};

/*
 * Returns a copy of the newEntity that does not include any props where the value of both are equal
 */
const deepEqualAndReduce = (state, newEntity, reducedNewItem = {}) => {
  const propsToCheck = Object.keys(newEntity);
  for (let i = 0; i < propsToCheck.length; i++) {
    const propName = propsToCheck[i];
    const newEntityProp = newEntity[propName];

    // it the prop doesn't exist in state, put it there
    if (!state.hasOwnProperty(propName)) {
      reducedNewItem[propName] = newEntityProp;
      continue;
    }

    // strict-equal must come after hasOwnProperty because the two could be null
    const stateProp = state[propName];
    if (stateProp === newEntityProp) {
      continue;
    }

    // if they're not equal, it could be an array, object, or scalar
    if (Array.isArray(newEntityProp)) {
      if (Array.isArray(stateProp) && newEntityProp.length === stateProp.length) {
        //  an array of objects here is wrong. Better to be performant for those who play by the rules
        let isShallowEqual = true;
        for (let a = 0; a < newEntityProp.length; a++) {
          if (newEntityProp[a] !== stateProp[a]) {
            isShallowEqual = false;
            break;
          }
        }
        if (!isShallowEqual) {
          reducedNewItem[propName] = newEntityProp;
        }
      } else {
        reducedNewItem[propName] = newEntityProp;
      }
    } else if (typeof newEntityProp === 'object' && newEntityProp !== null) {
      if (typeof stateProp === 'object' && stateProp !== null) {
        // they're both objects, we must go deeper
        reducedNewItem[propName] = {};
        deepEqualAndReduce(stateProp, newEntityProp, reducedNewItem[propName]);
      } else {
        reducedNewItem[propName] = newEntityProp;
      }
    } else {
      // they're non-equal scalars
      reducedNewItem[propName] = newEntityProp;
    }
  }
};

export const invalidateMutationsOnNewQuery = (component, cachedMutations) => {
  const activeMutations = Object.keys(cachedMutations);
  for (let i = 0; i < activeMutations.length; i++) {
    const mutationName = activeMutations[i];
    const mutation = cachedMutations[mutationName];
    // TODO handle logic for keys?
    if (mutation.activeComponentsObj[component]) {
      mutation.clear();
    }
  }
};

export const getMissingRequiredVariables = (variableDefinitions, variables) => {
  const missingVars = [];
  for (let i = 0; i < variableDefinitions.length; i++) {
    const def = variableDefinitions[i];
    if (def.type.kind === NON_NULL_TYPE) {
      const defKey = def.variable.name.value;
      if (!variables[defKey]) {
        missingVars.push(defKey);
      }
    }
  }
  return missingVars;
};
