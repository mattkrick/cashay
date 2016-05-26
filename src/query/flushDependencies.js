/**
 * walk the normalized response & grab the deps for each entity. put em all in a Set & flush it down the toilet
 */
export default (entities, component, key, denormalizedDeps, cachedQueries) => {
  const {keyFlush, componentFlushSet} = makeFlushSet(entities, component, key, denormalizedDeps);
  for (let flushedComponentId of componentFlushSet) {
    cachedQueries[flushedComponentId].response = undefined;
  }
  const componentKeys = Object.keys(keyFlush);
  for (let componentKey of componentKeys) {
    const keysToFlush = keyFlush[componentKey];
    const cachedComponentQuery = cachedQueries[componentKey];
    for (let flushedKey of keysToFlush) {
      cachedComponentQuery.response[flushedKey] = undefined;
    }
  }
}

/**
 * Crawl the dependency tree snagging up everything that will be invalidated
 * No safety checks required.
 * The tree is guaranteed to have everything we look for because of addDeps
 *
 */
const makeFlushSet = (entities, component, key, denormalizedDeps) => {
  let componentFlushSet = new Set();
  const keyFlush = {};
  const typeKeys = Object.keys(entities);
  for (let i = 0; i < typeKeys.length; i++) {
    const typeName = typeKeys[i];
    const typeInDependencyTree = denormalizedDeps[typeName];
    const newEntity = entities[typeName];
    const entityKeys = Object.keys(newEntity);
    for (let j = 0; j < entityKeys.length; j++) {
      const entityName = entityKeys[j];
      const entityInDependencyTree = typeInDependencyTree[entityName];
      if (key) {
        const componentInDependencyTree = entityInDependencyTree[component];
        keyFlush[component] = keyFlush[component] || new Set();
        keyFlush[component] = new Set([...keyFlush[component], ...componentInDependencyTree]);
      }
      else {
        // there's gotta be a more efficient way to merge sets. gross.
        componentFlushSet = new Set([...componentFlushSet, ...entityInDependencyTree]);
      }
    }
  }

  // no need to flush the callee
  if (key) {
    if (keyFlush[component]) {
      keyFlush[component].delete(key);
    }
  } else {
    componentFlushSet.delete(component);
  }
  return {keyFlush, componentFlushSet};
};
