const Server = require('@lifeart/ember-language-server/dist/bundled/node-server').default;
const { IPCMessageReader, IPCMessageWriter, createConnection } = require('vscode-languageserver/node');

// Create a connection for the server. The connection defaults to Node's IPC as a transport, but
// also supports stdio via command line flag
const connection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));


const server = new Server(connection, { type: 'node', fs: 'sync' });
server.listen();
