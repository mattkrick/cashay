import {DELIMITER as _} from '../utils';

export default function addDeps(normalizedResponse, component, key, normalizedDeps, denormalizedDeps) {
  // get the previous set
  // create a Set of normalized locations in entities (eg 'Post.123')
  const newNormalizedDeps = makeNormalizedDeps(normalizedResponse.entities);
  let oldNormalizedDeps;
  if (key) {
    normalizedDeps[component] = normalizedDeps[component] || {};
    const componentDeps = normalizedDeps[component];
    oldNormalizedDeps = componentDeps[key];
    componentDeps[key] = newNormalizedDeps;
  } else {
    oldNormalizedDeps = normalizedDeps[component];
    normalizedDeps[component] = newNormalizedDeps;
  }

  let newUniques;
  if (!oldNormalizedDeps) {
    newUniques = newNormalizedDeps;
  } else {
    // create 2 Sets that are the left/right diff of old and new
    newUniques = new Set();
    for (let dep of newNormalizedDeps) {
      if (oldNormalizedDeps.has(dep)) {
        oldNormalizedDeps.delete(dep);
      } else {
        newUniques.add(dep);
      }
    }

    // remove old deps
    for (let dep of oldNormalizedDeps) {
      const [typeName, entityName] = dep.split(_);
      const entityDep = denormalizedDeps[typeName][entityName];
      if (key) {
        entityDep[component].delete(key);
      } else {
        entityDep.delete(component);
      }
    }
  }

  // add new deps
  for (let dep of newUniques) {
    const [typeName, entityName] = dep.split(_);
    denormalizedDeps[typeName] = denormalizedDeps[typeName] || {};
    if (key) {
      denormalizedDeps[typeName][entityName] = denormalizedDeps[typeName][entityName] || {};
      denormalizedDeps[typeName][entityName][component] = denormalizedDeps[typeName][entityName][component] || new Set();
      denormalizedDeps[typeName][entityName][component].add(key);
    } else {
      denormalizedDeps[typeName][entityName] = denormalizedDeps[typeName][entityName] || new Set();
      denormalizedDeps[typeName][entityName].add(component);
    }
  }
}

const makeNormalizedDeps = entities => {
  const typeKeys = Object.keys(entities);
  const normalizedDeps = new Set();
  for (let i = 0; i < typeKeys.length; i++) {
    const typeName = typeKeys[i];
    const entityKeys = Object.keys(entities[typeName]);
    for (let j = 0; j < entityKeys.length; j++) {
      const entityName = entityKeys[j];
      const dep = `${typeName}${_}${entityName}`;
      normalizedDeps.add(dep);
    }
  }
  return normalizedDeps;
};
