export default function hasMatchingVariables(variables, matchingSet) {
  const varKeys = Object.keys(variables);
  if (varKeys.length !== matchingSet.size) return false;
  for (let i = 0; i < varKeys.length; i++) {
    const varKey = varKeys[i];
    if (!matchingSet.has(varKey)) return false;
  }
  return true;
};
