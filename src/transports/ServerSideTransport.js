import defaultHandleErrors from './defaultHandleErrors';

export default class ServerSideTransport {
  constructor(graphQLHandler, handleErrors = defaultHandleErrors) {
    this.graphQLHandler = graphQLHandler;
    this.handleErrors = handleErrors;
  }

  async handleQuery(request) {
    const {data, errors} = await this.graphQLHandler(request);
    const error = this.handleErrors(request, errors);
    return error ? {data, error} : {data};
  }
}
