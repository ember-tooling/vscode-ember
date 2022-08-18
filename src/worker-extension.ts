"use strict";

import { FileUsages } from './usages-provider';
import { provideCodeLenses } from './lenses';

import {
  workspace,
  ExtensionContext,
  window,
  commands,
  languages,
  Uri,
  StatusBarAlignment
} from "vscode";
import {
  Message,
  ErrorAction,
  CloseAction,
  LanguageClient,
  LanguageClientOptions,
  RevealOutputChannelOn,
  ExecuteCommandRequest
} from "vscode-languageclient/browser";
import { COMMANDS as ELS_COMMANDS } from './constants';

export async function activate(context: ExtensionContext) {

  const ExtStatusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 10);
  ExtStatusBarItem.text = "$(ember-logo) Ember Loading...";
  ExtStatusBarItem.tooltip = 'Ember';
  ExtStatusBarItem.command = ELS_COMMANDS.SET_STATUS_BAR_TEXT;
  ExtStatusBarItem.show();


  // Options to control the language client
  let clientOptions: LanguageClientOptions = {
    // Register the server for plain text documents
    documentSelector: ["handlebars", "javascript", "typescript"].map((el) => {
      return {
        language: el,
        scheme: 'file'
      }
    }),
    outputChannelName: "Unstable Ember Language Server",
    revealOutputChannelOn: RevealOutputChannelOn.Never,
    synchronize: {},
    initializationOptions: { editor: 'vscode' },
    errorHandler: {
      error(error: Error, message: Message | undefined, count: number): ErrorAction {
        window.showErrorMessage(`${error.toString()} | ${message?.toString()} | ${count}`);
        return ErrorAction.Shutdown;
      },
      closed() {
        return CloseAction.DoNotRestart;
      }
    }
  };

  context.subscriptions.push(
    commands.registerCommand('els.fs.readFile', async (filePath: Uri) => {

      try {
        const data = await workspace.fs.readFile(filePath);
        return String.fromCharCode.apply(null, data);
      } catch(e) {
        return null;
      }

    })
  )

  context.subscriptions.push(
    commands.registerCommand('els.fs.stat', async (filePath: Uri) => {
      try {
        const data = await workspace.fs.stat(filePath);
        return data;
      } catch(e) {
        return null;
      }
    })
  )

  context.subscriptions.push(
    commands.registerCommand('els.fs.readDirectory', async (filePath: Uri) => {
      try {
        const data = await workspace.fs.readDirectory(filePath);
        return data;
      } catch(e) {
        return null;
      }
    })
  )


    // Push the disposable to the context's subscriptions so that the
  // client can be deactivated on extension deactivation
  context.subscriptions.push(
    commands.registerCommand(ELS_COMMANDS.SET_STATUS_BAR_TEXT, async () => {
      ExtStatusBarItem.text = "$(ember-logo) " + 'Reloading projects...';
      const result = await commands.executeCommand(ELS_COMMANDS.RELOAD_PROJECT, workspace.rootPath, true);
      window.showInformationMessage(JSON.stringify(result));
      ExtStatusBarItem.text = "$(ember-logo)";
    })
  );



  // Create the language client and start the client.
  let disposable = createWorkerLanguageClient(context, clientOptions);

  async function openRelatedFile(...rawFile) {
    let url = Uri.file(rawFile.join(""));
    commands.executeCommand("vscode.open", url);
  }

  const langs = [
    "javascript",
    "typescript",
    "handlebars",
    "css",
    "less",
    "scss"
  ];
  context.subscriptions.push(
    commands.registerCommand(ELS_COMMANDS.OPEN_RELATED_FILE, openRelatedFile)
  );
  langs.forEach(language => {
    context.subscriptions.push(
      languages.registerCodeLensProvider(language, { provideCodeLenses })
    );
  });

  disposable.onReady().then(() => {
    disposable.onRequest(ExecuteCommandRequest.type.method, async ({command, arguments: args}) => {
      return commands.executeCommand(command, ...args);
    });
    console.log('execute command');
    commands.executeCommand(ELS_COMMANDS.SET_CONFIG, {local: {
      collectTemplateTokens: true,
      useBuiltinLinting: false
    }});
    ExtStatusBarItem.text = "$(ember-logo)";

    // Ember File Usages
    new FileUsages();
  });
  context.subscriptions.push(disposable.start());

}

function createWorkerLanguageClient(context: ExtensionContext, clientOptions: LanguageClientOptions) {
	// Create a worker. The worker main file implements the language server.
	const serverMain = Uri.joinPath(context.extensionUri, 'node_modules/@lifeart/ember-language-server/dist/bundled/start-worker-server.js');
  const worker = new Worker(serverMain.toString(), {
    name: '@lifeart/ember-language-server',
    type: 'classic'
  });
	// create the language server client to communicate with the server running in the worker
	return new LanguageClient('emberLanguageServer', "Unstable Ember Language Server", clientOptions, worker);
}
