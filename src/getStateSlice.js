const getCursorIndex = (stateEntity, idArray, cursorToFind, argForCursor) => {
  idArray.findIndex(id => stateEntity[id].__cursor[argForCursor] === cursorToFind);
}

export const getStateSlice = ({full, front, back}, paginationArgs = {}, stateEntity, argForCursor) => {
  const {before, after, first, last} = paginationArgs;
  const useableArray = full || front || back.slice().reverse();
  const cursor = after || before;
  const cursorIdx = cursor && useableArray.findIndex(id => stateEntity[id].__cursor[argForCursor] === cursor) || 0;
  if (after) {
    if (first) {
      return useableArray.slice(cursorIdx + 1, cursorIdx + 1 + first);
    } else if (last) {
      // shouldn't happen
      const start = Math.max(0, useableArray.length - last + 1)
      return useableArray.slice(start);
    } else /* no limits */{
      return useableArray.slice(cursorIdx + 1);
    }
  } else if (before) {
    if (first) {
      // shouldn't happen
      return useableArray.slice(0, first);
    } else if (last) {
      const start = Math.max(0, cursorIdx - last);
      return useableArray.slice(start, cursorIdx)
    } else /* no limits */{
      return useableArray.slice(0, cursorIdx);
    }
  } else /* no cursor */{
    if (first) {
      return useableArray.slice(0, first);
    } else if (last) {
      const start = Math.max(0, useableArray.length - last)
      return useableArray.slice(start);
    } else /* no limits no cursor*/ {
      return useableArray;
    }
  }
}
