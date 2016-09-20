import {INLINE_FRAGMENT} from 'graphql/language/kinds';
import {TypeKind} from 'graphql/type/introspection';
import getFieldState from './getFieldState';
import {
  defaultResolveChannelKeyFactory,
  isLive,
  makeFullChannel,
  NORM_DELIMITER
} from '../utils';
const {UNION, LIST, SCALAR, ENUM} = TypeKind;

export const handleMissingData = (visitObject, field, nnFieldType, cachedDirective, context) => {
  if (!cachedDirective) {
    sendChildrenToServer(field);
  }
  if (nnFieldType.kind === SCALAR) {
    return null;
  } else if (nnFieldType.kind === LIST) {
    return [];
  } else if (nnFieldType.kind === ENUM) {
    return '';
  } else {
    const typeSchema = context.schema.types[nnFieldType.name];
    if (nnFieldType.kind === UNION) {
      // since we don't know what the shape will look like, make it look like everything
      // that way, we don't have to code defensively in the view layer
      const {possibleTypes} = typeSchema;
      const possibleTypesKeys = Object.keys(possibleTypes);
      const unionResponse = {};
      for (let i = 0; i < possibleTypesKeys.length; i++) {
        const possibleTypeKey = possibleTypesKeys[i];
        const typeSchema = context.schema.types[possibleTypeKey];
        Object.assign(unionResponse, visitObject(unionResponse, field, typeSchema, context));
      }
      return {...unionResponse, __typename: null};
    }
    return visitObject({}, field, typeSchema, context);
  }
};

export const calculateSendToServer = (field, idFieldName) => {
  const {selections} = field.selectionSet;
  for (let i = 0; i < selections.length; i++) {
    const selection = selections[i];
    if (selection.kind === INLINE_FRAGMENT) {
      calculateSendToServer(selection, idFieldName);
    }
    if (selection.sendToServer) {
      field.sendToServer = true;
    }
  }
};

export const sendChildrenToServer = reqAST => {
  reqAST.sendToServer = true;
  if (!reqAST.selectionSet) {
    return;
  }
  reqAST.selectionSet.selections.forEach(child => {
    sendChildrenToServer(child);
  })
};

export const rebuildOriginalArgs = reqAST => {
  if (reqAST.originalArguments) {
    reqAST.arguments = reqAST.originalArguments;
  }
  if (reqAST.selectionSet) {
    const fields = reqAST.selectionSet.selections;
    for (let i = 0; i < fields.length; i++) {
      rebuildOriginalArgs(fields[i]);
    }
  }
};

export const splitNormalString = (normalString) => {
  const splitPoint = normalString.indexOf(NORM_DELIMITER);
  if (splitPoint !== -1) {
    return [normalString.substr(0, splitPoint), normalString.substr(splitPoint + NORM_DELIMITER.length)]
  } else {
    return [normalString];
  }
};

export const maybeLiveQuery = (source, fieldSchema, field, nnFieldType, context) => {
  const fieldName = field.name.value;
  if (!isLive(field.directives)) {
    // if there's no results stored or being fetched, save some time & don't bother with the args
    return getFieldState(source[fieldName], fieldSchema, field, context);
  }
  const aliasOrFieldName = field.alias && field.alias.value || fieldName;
  const {resolveChannelKey, subscriber, idFieldName, getState, queryDep, subscribe, subscriptionDeps, variables} = context;
  const result = getState().result;
  const topLevelSource = source === result;
  const fieldResolveChannelKey = resolveChannelKey && resolveChannelKey[aliasOrFieldName];
  const fieldSubscriber = subscriber && subscriber[aliasOrFieldName];
  const bestSubscriber = fieldSubscriber || context.defaultSubscriber;
  const makeChannelKey = fieldResolveChannelKey || defaultResolveChannelKeyFactory(idFieldName, topLevelSource);
  const channelKey = makeChannelKey(source, variables);
  const initialState = subscribe(aliasOrFieldName, channelKey, bestSubscriber, {returnType: nnFieldType});
  const subDep = makeFullChannel(aliasOrFieldName, channelKey);
  subscriptionDeps[subDep] = subscriptionDeps[subDep] || new Set();
  subscriptionDeps[subDep].add(queryDep);
  return result[aliasOrFieldName] && result[aliasOrFieldName][channelKey] || initialState.data;
};
