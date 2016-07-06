import {TypeKind} from 'graphql/type/introspection';
import {ensureTypeFromNonNull} from '../utils';
const {UNION, LIST, OBJECT, SCALAR} = TypeKind;

export default function getReturnType(typeName, schema) {
  const subscriptionType = schema.subscriptionSchema.fields[typeName].type;
  const subscriptionTypeNN = ensureTypeFromNonNull(subscriptionType);
  
  if (subscriptionTypeNN.kind === OBJECT || subscriptionTypeNN.kind === UNION) {
    return OBJECT;
  }
  if (subscriptionTypeNN.kind === SCALAR) {
    return SCALAR;
  }
  if (subscriptionTypeNN.kind === LIST) {
    return LIST;
  }
  throw new Error(`Subscription ${typeName} is a ${subscriptionTypeNN.kind}, 
  but may only be UNION, LIST, SCALAR, or OBJECT`)
}
