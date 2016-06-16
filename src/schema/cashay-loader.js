module.exports = function(content) {
  // Allow webpack to be smart about required dependencies:
  this.cacheable && this.cacheable();
  const callback = this.async();

  // Execute the supplied javascript:
  let doc = this.exec(content, this.resource);
  if (this.resourceQuery) {
    // if we've been given a resource query, evaluate the doc as a function
    // yielding a promise:
    doc = doc(this.resourceQuery);
  }

  doc.then(function (schema) {
    // Await the yield of a cashay schema:
    callback(null, "module.exports = " + JSON.stringify(schema));
  });
};
