"use strict";

import { COMMANDS as ELS_COMMANDS } from './constants';
import { UsagesProvider } from './usages-provider';
import {
  workspace,
  ExtensionContext,
  StatusBarItem,
  window,
  commands,
  languages,
  InputBoxOptions,
  StatusBarAlignment,
  Uri
} from "vscode";
import { isEmberCliProject, isGlimmerXProject } from './workspace-utils';
import {
  Message,
  ErrorAction,
  CloseAction,
  LanguageClient,
  LanguageClientOptions,
  RevealOutputChannelOn
} from "vscode-languageclient/browser";
import { provideCodeLenses } from './lenses';
let ExtStatusBarItem: StatusBarItem;
export async function activate(context: ExtensionContext) {
  // The server is implemented in node
  let config: any = {
    codeLens: {
      relatedFiles:  true
    }
  };
  try {
    config = workspace.getConfiguration("els");
  } catch (e) {
    // EOL
  }
  // The debug options for the server
  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used

  if (!(await isEmberCliProject())) {
    if (!(await isGlimmerXProject())) {
      return;
    }
  }

  const syncExtensions = ["js", "ts", "hbs"];
  if (config.codeLens.relatedFiles) {
    syncExtensions.push("less", "scss", "css");
  }

  // Options to control the language client
  let clientOptions: LanguageClientOptions = {
    // Register the server for plain text documents
    documentSelector: ["handlebars", "javascript", "typescript"],
    outputChannelName: "Unstable Ember Language Server",
    revealOutputChannelOn: RevealOutputChannelOn.Never,
    initializationOptions: { editor: 'vscode' },
    errorHandler: {
      error(error: Error, message: Message | undefined, count: number): ErrorAction {
        window.showErrorMessage(`${error.toString()} | ${message?.toString()} | ${count}`);
        return ErrorAction.Shutdown;
      },
      closed() {
        return CloseAction.DoNotRestart;
      }
    },
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher(
        `**/*.{${syncExtensions.join(",")}}`
      )
    }
  };

  ExtStatusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 10);
  ExtStatusBarItem.text = "$(telescope) Ember Loading...";
  ExtStatusBarItem.command = ELS_COMMANDS.SET_STATUS_BAR_TEXT;
  ExtStatusBarItem.show();

  // Push the disposable to the context's subscriptions so that the
  // client can be deactivated on extension deactivation
  context.subscriptions.push(
    commands.registerCommand(ELS_COMMANDS.SET_STATUS_BAR_TEXT, async () => {
      ExtStatusBarItem.text = "$(telescope) " + 'Reloading projects...';
      await commands.executeCommand(ELS_COMMANDS.RELOAD_PROJECT);
      ExtStatusBarItem.text = "$(telescope) " + 'Ember';
    })
  );


  context.subscriptions.push(
    commands.registerCommand(ELS_COMMANDS.PROXY_COMMAND, async (commandName: string, commandOpts: any, callbackCommandName: string, tail: any = {}) => {
      try {
        let result = await commands.executeCommand(commandName, ...commandOpts);
        let document = workspace.rootPath;
        if (!document && workspace.workspaceFolders && workspace.workspaceFolders.length) {
          document = workspace.workspaceFolders[0].uri.fsPath;
        }
        if (window.activeTextEditor) {
          document = window.activeTextEditor.document.uri.fsPath;
        }
        commands.executeCommand(callbackCommandName, document, result, tail);
      } catch(e) {
        window.showErrorMessage(e.toString());
      }
    })
  );

  context.subscriptions.push(
    commands.registerCommand(ELS_COMMANDS.GET_USER_INPUT, async (opts: InputBoxOptions, callbackCommandName: string, tail: any) => {
      try {
        let what = await window.showInputBox(opts);
        let document = workspace.rootPath;
        if (!document && workspace.workspaceFolders && workspace.workspaceFolders.length) {
          document = workspace.workspaceFolders[0].uri.fsPath;
        }
        if (window.activeTextEditor) {
          document = window.activeTextEditor.document.uri.fsPath;
        }
        commands.executeCommand(callbackCommandName, document, what, tail);
      } catch(e) {
        window.showErrorMessage(e.toString());
      }
    })
  );

  context.subscriptions.push(
    commands.registerCommand(ELS_COMMANDS.RUN_IN_EMBER_CLI, async () => {
      let what = await window.showInputBox({
        placeHolder: "Enter ember-cli command"
      });
      if (!what) {
        return;
      }
      try {
        let document = workspace.rootPath;
        if (!document && workspace.workspaceFolders && workspace.workspaceFolders.length) {
          document = workspace.workspaceFolders[0].uri.fsPath;
        }
        if (window.activeTextEditor) {
          document = window.activeTextEditor.document.uri.fsPath;
        }
        commands.executeCommand(ELS_COMMANDS.EXECUTE_IN_EMBER_CLI, document, what);
      } catch (e) {
        window.showErrorMessage(e.toString());
      }
    })
  );
  // Create the language client and start the client.
  let disposable = createWorkerLanguageClient(context, clientOptions);

  const fileUsagesProvider = new UsagesProvider();


  disposable.onReady().then(() => {
    commands.executeCommand(ELS_COMMANDS.SET_CONFIG, config);
    ExtStatusBarItem.text = "$(telescope) " + 'Ember';

    window.onDidChangeActiveTextEditor(()=>{
      if (window.activeTextEditor) {
        fileUsagesProvider.refresh();
      }
    });
    let treeView = window.createTreeView('els.fileUsages', {
      treeDataProvider: fileUsagesProvider
    });
    fileUsagesProvider.setView(treeView);

  });
  context.subscriptions.push(disposable.start());

  async function openRelatedFile(...rawFile) {
    let url = Uri.file(rawFile.join(""));
    commands.executeCommand("vscode.open", url);
  }



  if (config.codeLens.relatedFiles) {
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
  }

}

function createWorkerLanguageClient(context: ExtensionContext, clientOptions: LanguageClientOptions) {
	// Create a worker. The worker main file implements the language server.
	const serverMain = Uri.joinPath(context.extensionUri, 'dist/web/server/browserServerMain.js');
  const worker = new Worker(serverMain.toString());
	// create the language server client to communicate with the server running in the worker
	return new LanguageClient('emberLanguageServer', "Unstable Ember Language Server", clientOptions, worker);
}
