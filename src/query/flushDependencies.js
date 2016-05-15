
/**
 * walk the normalized response & grab the deps for each entity. put em all in a Set & flush it down the toilet
 */
export default (normalizedResponse, componentId, denormalizedDeps, cachedQueries) => {
  const flushSet = makeFlushSet(normalizedResponse, componentId, denormalizedDeps);
  for (let flushedComponentId of flushSet) {
    cachedQueries[flushedComponentId].response = undefined;
  }
}

/**
 * Crawl the dependency tree snagging up everything that will be invalidated
 * No safety checks required.
 * The tree is guaranteed to have everything we look for because of _addDeps
 *
 */
const makeFlushSet = (normalizedResponse, componentId, denormalizedDeps) => {
  const {entities} = normalizedResponse;
  let flushSet = new Set();
  const entityKeys = Object.keys(entities);
  for (let i = 0; i < entityKeys.length; i++) {
    const entityName = entityKeys[i];
    const entityDepObject = denormalizedDeps[entityName];
    const newEntity = entities[entityName];
    const itemKeys = Object.keys(newEntity);
    for (let j = 0; j < itemKeys.length; j++) {
      const itemName = itemKeys[j];
      const itemDepSet = entityDepObject[itemName];
      // there's gotta be a more efficient way to merge sets. gross.
      flushSet = new Set([...flushSet, ...itemDepSet]);
    }
  }

  // no need to flush the callee
  flushSet.delete(componentId);
  return flushSet;
};
