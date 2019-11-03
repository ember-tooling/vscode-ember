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
    return;
  }
  // Options to control the language client
  let clientOptions: LanguageClientOptions = {
    // Register the server for plain text documents
    documentSelector: ["handlebars", "javascript", "typescript"],
    outputChannelName: "Unstable Ember Language Server",
    revealOutputChannelOn: RevealOutputChannelOn.Never
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

  // Create the language client and start the client.
  let disposable = new LanguageClient(
    "emberLanguageServer",
    "Unstable Ember Language Server",
    serverOptions,
    clientOptions
  ).start();
  context.subscriptions.push(disposable);


  const langs = ['javascript', 'handlebars', 'typescript', 'hbs'];

  
  async function openRelatedFile(...args) {
    console.log('...openRelatedFile', args);
  }

  context.subscriptions.push(commands.registerCommand('els.openRelatedFile', openRelatedFile));


  async function provideCodeLenses(document: TextDocument, token: CancellationToken) {

    return [
      new CodeLens(new Range(new Position(0, 0), new Position(0, 0)), {
        title: '> template',
        command: 'els.openRelatedFile',
        arguments: [ document.uri, 'template' ]
      }),
      new CodeLens(new Range(new Position(0, 0), new Position(0, 0)), {
        title: '> test',
        command: 'els.openRelatedFile',
        arguments: [ document.uri, 'test' ]
      }),
      new CodeLens(new Range(new Position(0, 0), new Position(0, 0)), {
        title: '> component',
        command: 'els.openRelatedFile',
        arguments: [ document.uri, 'component' ]
      })
    ]
}


  langs.forEach(language => {
    context.subscriptions.push(languages.registerCodeLensProvider(language, { provideCodeLenses }));
  });
  // commands.
  // commands.executeCommand(myCommandId, "HELLO");
}

async function isEmberCliProject(): Promise<boolean> {
  const emberCliBuildFile = await workspace.findFiles(
    "**/ember-cli-build.js",
    "**/{dist,tmp,node_modules}/**",
    100
  );

  if (emberCliBuildFile.length < 1) {
    return false;
  }

  return true;
}
