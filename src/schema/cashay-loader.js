module.exports = function(content) {
  // Allow webpack to be smart about required dependencies:
  this.cacheable && this.cacheable();
  const callback = this.async();
  // Execute the supplied javascript, receive promise:
  const doc = this.exec(content, this.resource);
  doc(this.resourceQuery).then(function (schema) {
    // Await the yield of a cashay schema:
    callback(null, "module.exports = " + JSON.stringify(schema));
  });
};
