import {DELIMITER as _} from '../utils';

export default function addDeps(normalizedResponse, op, key, normalizedDeps, denormalizedDeps) {
  // get the previous set
  // create a Set of normalized locations in entities (eg 'Post.123')
  const newNormalizedDeps = makeNormalizedDeps(normalizedResponse.entities);
  let oldNormalizedDeps;
  normalizedDeps[op] = normalizedDeps[op] || {};
  const opDeps = normalizedDeps[op];
  oldNormalizedDeps = opDeps[key];
  opDeps[key] = newNormalizedDeps;
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
      entityDep[op].delete(key);
    }
  }

  // add new deps
  for (let dep of newUniques) {
    const [typeName, entityName] = dep.split(_);
    denormalizedDeps[typeName] = denormalizedDeps[typeName] || {};
    denormalizedDeps[typeName][entityName] = denormalizedDeps[typeName][entityName] || {};
    denormalizedDeps[typeName][entityName][op] = denormalizedDeps[typeName][entityName][op] || new Set();
    denormalizedDeps[typeName][entityName][op].add(key);
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
