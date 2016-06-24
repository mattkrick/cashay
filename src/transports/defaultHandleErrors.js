const tryParse = str => {
  let obj;
  try {
    obj = JSON.parse(str);
  } catch (e) {
    return false;
  }
  return obj;
};

export default function defaultHandleErrors(request, errors, duckField = '_error') {
  if (!errors) return;
  // expect a human to put an end-user-safe message in the message field
  const firstErrorMessage = errors[0].message;
  if (!firstErrorMessage) return {errors};
  const parsedError = tryParse(firstErrorMessage);
  if (parsedError && parsedError.hasOwnProperty(duckField)) {
    return parsedError;
  }
  return {errors};
};
