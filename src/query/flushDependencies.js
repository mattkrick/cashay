/**
 * walk the normalized response & grab the deps for each entity. put em all in a Set & flush it down the toilet
 */
export default function flushDependencies(entitiesDiff, component, key, denormalizedDeps, cachedQueries) {
  const keyFlush = makeFlushSet(entitiesDiff, component, key, denormalizedDeps);
  const componentKeys = Object.keys(keyFlush);
  for (let i = 0; i < componentKeys.length; i++) {
    const componentKey = componentKeys[i];
    const keysToFlush = keyFlush[componentKey];
    const cachedComponentQuery = cachedQueries[componentKey];
    if (cachedComponentQuery) {
      for (let flushedKey of keysToFlush) {
        cachedComponentQuery.responses[flushedKey] = undefined;
      }
    }
  }
}

/**
 * Crawl the dependency tree snagging up everything that will be invalidated
 * Safety checks required because subs affect queries, but not the other way around
 *
 */
const makeFlushSet = (entitiesDiff, component, key, denormalizedDeps) => {
  const keyFlush = {};
  const typeKeys = Object.keys(entitiesDiff);
  for (let i = 0; i < typeKeys.length; i++) {
    const typeName = typeKeys[i];
    const typeInDependencyTree = denormalizedDeps[typeName];
    if (!typeInDependencyTree) continue;
    const newType = entitiesDiff[typeName];
    const entityKeys = Object.keys(newType);
    for (let j = 0; j < entityKeys.length; j++) {
      const entityName = entityKeys[j];
      const entityInDependencyTree = typeInDependencyTree[entityName];
      if (!entityInDependencyTree) continue;
      const entityInDependencyTreeKeys = Object.keys(entityInDependencyTree);
      for (let k = 0; k < entityInDependencyTreeKeys.length; k++) {
        const dependentComponent = entityInDependencyTreeKeys[k];
        const newDependencyKeySet = entityInDependencyTree[dependentComponent];
        const incumbant = keyFlush[dependentComponent] || new Set();
        keyFlush[dependentComponent] = new Set([...incumbant, ...newDependencyKeySet]);
      }
    }
  }

  // ensure flushing the callee (if it's a sub it'll just get ignored later)
  if (!keyFlush[component]) {
    keyFlush[component] = new Set();
  }
  keyFlush[component].add(key);
  return keyFlush;
};
