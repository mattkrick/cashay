import {transform} from './transform';
import {parse} from 'graphql/language/parser';
import {print} from 'graphql/language/printer';
import {makeNormalSchema} from './makeNormalSchema';

const processQueryString = node => {
  if (node.quasis.length > 1) {
    throw new Error('string interpolation is not currently supported');
  } else {
    return node.quasis[0].value.cooked;
  }
}

const querySchema = (schema, t, path) => {
  const queryString = processQueryString(path.node.quasi);
  const doc = parse(queryString, {noLocation: true, noSource: true});
  const cashaySchema = makeNormalSchema(doc, schema);
  const prettyQuery = print(doc);
  return t.objectExpression([
    t.objectProperty(t.stringLiteral('schema'), transform(cashaySchema, {t, path})),
    t.objectProperty(t.stringLiteral('string'), t.stringLiteral(prettyQuery))
  ]);
}

const createPlugin = schema => {
  return ({types: t}) => ({
    visitor: {
      TaggedTemplateExpression(path) {
        if (t.isIdentifier(path.node.tag, {name: 'CashayQL'})) {
          path.replaceWith(querySchema(schema, t, path));
        }
      }
    }
  });
}

module.exports = createPlugin;
