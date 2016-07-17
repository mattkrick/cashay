import fetch from 'isomorphic-fetch'
import defaultHandleErrors from './defaultHandleErrors';
import Transport from './Transport';

export default class HTTPTransport extends Transport {
  constructor(uri = '/graphql', init = {}, handleErrors = defaultHandleErrors) {
    super();
    this.uri = uri;
    this.init = init;
    this.handleErrors = handleErrors;
    this.sendToServer =  async (request) => {
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
      const result = await fetch(this.uri, payload);
      const {status, statusText} = result;
      if (status >= 200 && status < 300) {
        return await result.json();
      } else {
        return {
          data: null,
          errors: [{_error: statusText, status}]
        };
      }
    }
  }
}
