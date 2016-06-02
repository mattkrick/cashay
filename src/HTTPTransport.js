import fetch from 'isomorphic-fetch'

export default class HTTPTransport {
  constructor(uri = '/graphql', init = {}, handleErrors = defaultHandleErrors) {
    this.uri = uri;
    this.init = init;
    this.handleErrors = handleErrors;
  }
  
  async handleQuery(request) {
    const result = await this.sendToServer(request);
    const resJSON = await result.json();
    const {data, errors} = resJSON;
    const error = this.handleErrors(request, errors);
    return {data, error};
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
    debugger
    return fetch(this.uri, payload);

  }
}

const defaultHandleErrors = (request, errors) => {
  if (!errors) return;
  const CONTEXT_BEFORE = 20;
  const CONTEXT_LENGTH = 60;

  const queryLines = request.query.split('\n');
  return errors.map(({locations, message}, ii) => {
    const prefix = (ii + 1) + '. ';
    const indent = ' '.repeat(prefix.length);

    //custom errors thrown in graphql-server may not have locations
    const locationMessage = locations ?
      ('\n' + locations.map(({column, line}) => {
        const queryLine = queryLines[line - 1];
        const offset = Math.min(column - 1, CONTEXT_BEFORE);
        return [
          queryLine.substr(column - 1 - offset, CONTEXT_LENGTH),
          ' '.repeat(Math.max(0, offset)) + '^^^'
        ].map(messageLine => indent + messageLine).join('\n');
      }).join('\n')) :
      '';

    return prefix + message + locationMessage;

  }).join('\n');
};
