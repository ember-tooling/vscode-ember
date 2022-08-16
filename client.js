// This work-around needs for working the VSCode's debugging
try {
  module.exports = require('./out/src/extension');
}
catch {
  module.exports = require('./dist/node/client/nodeClientMain');
}
