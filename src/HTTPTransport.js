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
      return {data, error};
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

const defaultHandleErrors = (request, errors) => {
  if (!errors) return;
  const error = errors[0].message;
  if (!error || error.indexOf('{"_error"') === -1) {
    return {errors};
  }
  return JSON.parse(error);
};
