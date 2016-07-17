import defaultHandleErrors from './defaultHandleErrors';

export default class Transport {
  constructor(sendToServer, handleErrors = defaultHandleErrors) {
    this.sendToServer = sendToServer;
    this.handleErrors = handleErrors;
  }

  async handleQuery(request) {
    const {data, errors} = await this.sendToServer(request);
    const error = this.handleErrors(request, errors);
    return error ? {data, error} : {data};
  }
}
