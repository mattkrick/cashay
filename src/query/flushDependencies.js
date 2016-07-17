/**
 * walk the normalized response & grab the deps for each entity. put em all in a Set & flush it down the toilet
 */
export default function flushDependencies(entities, component, key, denormalizedDeps, cachedQueries) {
  const {keyFlush, componentFlushSet} = makeFlushSet(entities, component, key, denormalizedDeps);
  for (let flushedComponentId of componentFlushSet) {
    const componentQuery = cachedQueries[flushedComponentId];
    // it might be a subscription, so wrap in a conditional
    if (componentQuery) {
      componentQuery.response = undefined;
    }
  }
  const componentKeys = Object.keys(keyFlush);
  for (let componentKey of componentKeys) {
    const keysToFlush = keyFlush[componentKey];
    const cachedComponentQuery = cachedQueries[componentKey];
    if (cachedComponentQuery) {
      for (let flushedKey of keysToFlush) {
        cachedComponentQuery.response[flushedKey] = undefined;
      }
    }
  }
}

/**
 * Crawl the dependency tree snagging up everything that will be invalidated
 * No safety checks required if just using query, but since subs might be included, we'll have to code defensively
 *
 */
const makeFlushSet = (entities, component, key, denormalizedDeps) => {
  let componentFlushSet = new Set();
  const keyFlush = {};
  const typeKeys = Object.keys(entities);
  for (let i = 0; i < typeKeys.length; i++) {
    const typeName = typeKeys[i];
    const typeInDependencyTree = denormalizedDeps[typeName];
    if (!typeInDependencyTree) continue;
    const newType = entities[typeName];
    const entityKeys = Object.keys(newType);
    for (let j = 0; j < entityKeys.length; j++) {
      const entityName = entityKeys[j];
      const entityInDependencyTree = typeInDependencyTree[entityName];
      if (!entityInDependencyTree) continue;
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

  // ensure flushing the callee
  if (key) {
    if (!keyFlush[component]) {
      keyFlush[component].add(key);
    }
  } else {
    componentFlushSet.add(component);
  }
  return {keyFlush, componentFlushSet};
};
