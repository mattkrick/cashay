import {ensureRootType} from '../utils';
import {TypeKind} from 'graphql/type/introspection';

const {SCALAR} = TypeKind;

export default function isMutationResponseScalar(schema, mutationName) {
  const mutationFieldSchema = schema.mutationSchema.fields[mutationName];
  const mutationResponseType = ensureRootType(mutationFieldSchema.type);
  const mutationResponseSchema = schema.types[mutationResponseType.name];
  return mutationResponseSchema.kind === SCALAR;
}
