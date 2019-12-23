/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
"use strict";

import * as path from "path";
import {
  workspace,
  ExtensionContext,
  CodeLens,
  Range,
  TextDocument,
  CancellationToken,
  StatusBarItem,
  window,
  commands,
  languages,
  StatusBarAlignment,
  Uri,
  Position
} from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
  RevealOutputChannelOn
} from "vscode-languageclient";
let ExtStatusBarItem: StatusBarItem;
export async function activate(context: ExtensionContext) {
  // The server is implemented in node
  let serverModule = context.asAbsolutePath(
    path.join(
      "node_modules",
      "@emberwatch",
      "ember-language-server",
      "lib",
      "start-server.js"
    )
  );
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
  // Options to control the language client
  let clientOptions: LanguageClientOptions = {
    // Register the server for plain text documents
    documentSelector: ["handlebars", "javascript", "typescript"],
    outputChannelName: "Unstable Ember Language Server",
    revealOutputChannelOn: RevealOutputChannelOn.Never,
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher('**/*.{js,ts,hbs}')
    }
  };

  const myCommandId = "els.setStatusBarText";

  ExtStatusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 10);
  ExtStatusBarItem.text = "$(telescope) Ember";
  ExtStatusBarItem.command = myCommandId;
  ExtStatusBarItem.show();
  // Push the disposable to the context's subscriptions so that the
  // client can be deactivated on extension deactivation
  context.subscriptions.push(
    commands.registerCommand(myCommandId, text => {
      ExtStatusBarItem.text = "$(telescope) " + text;
    })
  );

  context.subscriptions.push(commands.registerCommand('els.runInEmberCLI', async ()=> {
    let what = await window.showInputBox({ placeHolder: 'Enter ember-cli command' });
    if (!what) {
      return;
    }
    try {
      let document = window.activeTextEditor.document.uri.fsPath
      commands.executeCommand('els.executeInEmberCLI', document, what);
    } catch(e) {
      //
    }
  }));
  // Create the language client and start the client.
  let disposable = new LanguageClient(
    "emberLanguageServer",
    "Unstable Ember Language Server",
    serverOptions,
    clientOptions
  ).start();
  context.subscriptions.push(disposable);

  const langs = ['javascript', 'typescript', 'handlebars'];

  
  async function openRelatedFile(...rawFile) {
    let url = Uri.file(rawFile.join(''));
    commands.executeCommand('vscode.open', url);
  }

  context.subscriptions.push(commands.registerCommand('els.openRelatedFile', openRelatedFile));


  async function provideCodeLenses(document: TextDocument, token: CancellationToken) {
    let relatedFiles: any = [];
    try {
      relatedFiles = await  commands.executeCommand('els.getRelatedFiles', document.uri.fsPath);
      // window.showInformationMessage(relatedFiles[0]);
    } catch (e) {
      // window.showErrorMessage(e.toString());
    }
    if (relatedFiles.length === 1) {
      return;
    }
    return relatedFiles.map((f)=>{
      let normPath = f.split('\\').join('/');
      let fsPath = document.uri.fsPath.split('\\').join('/');
      const isActive = fsPath === normPath;
      let name = normPath.endsWith('.hbs') ? 'template' : 'script';
      if (normPath.includes('/routes/')) {
        name = 'route';
      } else if (normPath.includes('/controllers/')) {
        name = 'controller';
      } else if (normPath.includes('/tests/')) {
        name = 'test';
      }
      if (isActive) {
        name = '[_' + name + '_]';
      } else {
        name = '[ ' + name + ' ]';
      }
      return  new CodeLens(new Range(new Position(0, 0), new Position(0, 0)), {
        title: name,
        tooltip: 'Ember: ' + f,
        command: 'els.openRelatedFile',
        arguments: f.split('')
      });
    });
}


  langs.forEach(language => {
    context.subscriptions.push(languages.registerCodeLensProvider(language, { provideCodeLenses }));
  });
  // commands.
  // commands.executeCommand(myCommandId, "HELLO");
}

async function isGlimmerXProject(): Promise<boolean> {
  const emberCliBuildFile = await workspace.findFiles(
    "**/node_modules/{glimmer-lite-core,@glimmerx/core}/package.json", "**/{dist,tmp,.git,.cache}/**",
    5
  );

  if (emberCliBuildFile.length < 1) {
    return false;
  }

  return true;
}

async function isEmberCliProject(): Promise<boolean> {
  const emberCliBuildFile = await workspace.findFiles(
    "**/ember-cli-build.js",
    "**/{dist,tmp,node_modules,.git,.cache}/**",
    100
  );

  if (emberCliBuildFile.length < 1) {
    return false;
  }

  return true;
}
