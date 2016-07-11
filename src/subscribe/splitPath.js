export default function splitPath(path) {
  if (!path) return;
  const fields = path.split('.');
  const fieldsAndArrays = [];
  for (let i = 0; i < fields.length; i++) {
    const fieldWithMaybeArray = fields[i];
    const values = fieldWithMaybeArray.split('[');
    fieldsAndArrays.push(values[0]);
    if (values[1]) {
      fieldsAndArrays.push(`[${values[1]}`)
    }
  }
  return fieldsAndArrays;
};
