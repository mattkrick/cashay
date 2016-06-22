import fetch from 'isomorphic-fetch'

export default class HTTPTransport {
  constructor(uri = '/graphql', init = {}, handleErrors = defaultHandleErrors) {
    this.uri = uri;
    this.init = init;
    this.handleErrors = handleErrors;
  }

  async handleQuery(request) {
    const result = await this.sendToServer(request);
    const {status, statusText} = result;
    if (status >= 200 && status < 300) {
      const resJSON = await result.json();
      const {data, errors} = resJSON;
      const error = this.handleErrors(request, errors);
      return error ? {data, error} : {data};
    } else {
      return {error: {status, statusText}};
    }
  }

  sendToServer(request) {
    const payload = {
      ...this.init,
      body: JSON.stringify(request),
      headers: {
        ...this.init.headers,
        'Accept': '*/*',
        'Content-Type': 'application/json'
      },
      method: 'POST'
    };
    return fetch(this.uri, payload);

  }
}

const tryParse = str => {
  let obj;
  try {
    obj = JSON.parse(str);
  } catch (e) {
    return false;
  }
  return obj;
};

const defaultHandleErrors = (request, errors, duckField = '_error') => {
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
