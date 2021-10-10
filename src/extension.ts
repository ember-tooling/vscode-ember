/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
"use strict";

import * as path from "path";
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
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
  RevealOutputChannelOn,
  ExecuteCommandRequest
} from "vscode-languageclient/node";
import { provideCodeLenses } from './lenses';
let ExtStatusBarItem: StatusBarItem;
export async function activate(context: ExtensionContext) {
  // The server is implemented in node
  let serverModule = path.join(context.extensionPath, "./start-server.js");
  let config = workspace.getConfiguration("els");
  // The debug options for the server
  let debugOptions = { execArgv: ["--nolazy", "--inspect=6004"] };
  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  let serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions
    }
  };

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


  context.subscriptions.push(
    commands.registerCommand('els.fs.readFile', async (filePath: Uri) => {

      try {
        const data = await workspace.fs.readFile(filePath);
        return data.toString();
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
  let disposable = new LanguageClient(
    "emberLanguageServer",
    "Unstable Ember Language Server",
    serverOptions,
    clientOptions
  );

  const fileUsagesProvider = new UsagesProvider();

  disposable.onReady().then(() => {
    disposable.onRequest(ExecuteCommandRequest.type.method, async ({command, arguments: args}) => {
      return commands.executeCommand(command, ...args);
    });
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

