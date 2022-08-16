// This work-around needs for working the VSCode's debugging
try {
  module.exports = require('@lifeart/ember-language-server/lib/server').default;
}
catch {
  module.exports = require('@lifeart/ember-language-server/dist/bundled/node-server').default;
}
