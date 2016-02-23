const transformObjectSchema = (schema, {t, path}) => {
  const queries = Object.keys(schema).filter(key => key[0] !== '_');
  return t.objectExpression(queries.map(query => {
    return t.objectProperty(
      t.identifier(query),
      transform(schema[query], {t, path})
    );
  }))
};

const transformEntitySchema = (schema, {t,path}) => {
  return t.callExpression(
    t.memberExpression(path.node.tag, t.identifier('schema')),
    [t.stringLiteral(schema.getKey()), transformObjectSchema(schema, {t, path})]
  );
};

const transformArraySchema = (schema, {t,path}) => {
  return t.callExpression(
    t.memberExpression(path.node.tag, t.identifier('arrayOf')),
    [transform(schema.getItemSchema(), {t, path})]
  );
};

const transformUnionSchema = (schema, {t,path}) => {
  return t.callExpression(
    t.memberExpression(path.node.tag, t.identifier('unionOf')),
    [
      transform(schema.getItemSchema(), {t, path}),
      t.objectExpression([
        t.objectProperty(
          t.identifier('schemaAttribute'),
          t.stringLiteral('__typename')
        )
      ])
    ]
  );
};

export const transform = (schema, context) => {
  switch (schema.constructor.name) {
    case 'NormalizrSchema':
      return transformObjectSchema(schema, context);
    case 'EntitySchema':
      return transformEntitySchema(schema, context);
    case 'ArraySchema':
      return transformArraySchema(schema, context);
    case 'UnionSchema':
      return transformUnionSchema(schema, context);
    default:
      throw new Error(`How the heck did you make a ${schema.constructor.name}?`);
  }
};
