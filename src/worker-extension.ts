"use strict";
import {
  workspace,
  ExtensionContext,
  StatusBarItem,
  window,
  commands,
  languages,
  InputBoxOptions,
  StatusBarAlignment,
  Uri,
  CodeLens,
  Range,
  TreeItem,
  TextDocument,
  CancellationToken,
  Position,
  Event,
  TreeView,
  TreeDataProvider,
  EventEmitter,
  TreeItemCollapsibleState,
} from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  RevealOutputChannelOn,
} from "vscode-languageclient/browser";

type MatchResultType =
  | "helper"
  | "service"
  | "route"
  | "controller"
  | "modifier"
  | "template"
  | "component"
  | "model"
  | "transform"
  | "adapter"
  | "serializer";

type MatchResultScope = "addon" | "application";

type MatchResultKind = "test" | "script" | "template" | "style";

interface MatchResult {
  type: MatchResultType;
  name: string;
  scope: MatchResultScope;
  kind: MatchResultKind;
}

interface Result {
  meta: MatchResult;
  path: string;
}

function normalizePath(str: string): string {
  return str.split("\\").join("/");
}

function getActiveMeta(document, results: Result[]): MatchResult | null {
  let fsPath = normalizePath(document.uri.fsPath);

  for (let i = 0; i < results.length; i++) {
    let normPath = normalizePath(results[i].path);
    if (normPath === fsPath) {
      return results[i].meta;
    }
  }

  return null;
}
function lenseNameFromPath(document, f: Result, meta: MatchResult | null) {
  let normPath = normalizePath(f.path);
  let fsPath = normalizePath(document.uri.fsPath);
  const isActive = fsPath === normPath;
  const isAddonApp = normPath.includes("/app/");
  const isDummyApp = normPath.includes("/tests/dummy/");
  const isAddonExport = f.meta.scope === "addon";
  const isRoutePath = ["route", "controller", "template"].includes(f.meta.type);
  const typeKey = isRoutePath ? `:${f.meta.type}:` : ":";
  let scope = isAddonExport && isAddonApp ? "addon-app" : f.meta.scope;
  if (isDummyApp) {
    scope = "dummy-app";
    if (f.meta.kind === "test") {
      f.meta.kind = "script";
    }
  }
  const key = `${scope}${typeKey}${f.meta.kind}`;
  let name = key.replace("application:", "");
  name = name.replace("template:template", "template");
  if (meta && !isRoutePath) {
    name = name.replace(`${meta.type}:`, "");
  }
  name = name.replace(`${f.meta.type}:script`, f.meta.type);
  if (isActive) {
    name = "_" + name + "_";
  }
  return name.trim();
}

async function provideCodeLenses(
  document: TextDocument,
  token: CancellationToken
) {
  let relatedFiles: any = [];
  try {
    relatedFiles = await commands.executeCommand(
      ELS_COMMANDS.GET_RELATED_FILES,
      document.uri.fsPath,
      { includeMeta: true }
    );
    if (token.isCancellationRequested) {
      return;
    }
    // window.showInformationMessage(JSON.stringify(relatedFiles));
  } catch (e) {
    // window.showErrorMessage(e.toString());
  }
  if (relatedFiles.length === 1) {
    return;
  }
  const meta = getActiveMeta(document, relatedFiles);
  const lenseNames = relatedFiles.map((f: Result) => {
    const name = lenseNameFromPath(document, f, meta);
    return { name, path: f.path.split(""), tooltip: f.path };
  });
  return lenseNames.map(({ name, path, tooltip }) => {
    return new CodeLens(new Range(new Position(0, 0), new Position(0, 0)), {
      title: name,
      tooltip: "Ember: " + tooltip,
      command: ELS_COMMANDS.OPEN_RELATED_FILE,
      arguments: path,
    });
  });
}

const ELS_COMMANDS = {
  OPEN_RELATED_FILE: "els.openRelatedFile",
  PROXY_COMMAND: "els.proxyCommand",
  RELOAD_PROJECT: "els.reloadProject",
  SET_STATUS_BAR_TEXT: "els.setStatusBarText",
  RUN_IN_EMBER_CLI: "els.runInEmberCLI",
  GET_USER_INPUT: "els.getUserInput",
  EXECUTE_IN_EMBER_CLI: "els.executeInEmberCLI",
  SET_CONFIG: "els.setConfig",
  GET_RELATED_FILES: "els.getRelatedFiles",
  GET_KIND_USAGES: "els.getKindUsages",
};

async function isGlimmerXProject(): Promise<boolean> {
  const emberCliBuildFile = await workspace.findFiles(
    "**/node_modules/{glimmer-lite-core,@glimmerx/core}/package.json",
    "**/{dist,tmp,.git,.cache}/**",
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

class UsagesProvider implements TreeDataProvider<Dependency> {
  constructor() {}

  private _onDidChangeTreeData: EventEmitter<Dependency | undefined> =
    new EventEmitter<Dependency | undefined>();
  readonly onDidChangeTreeData: Event<Dependency | undefined> =
    this._onDidChangeTreeData.event;
  private view!: TreeView<Dependency>;
  setView(view: TreeView<Dependency>) {
    this.view = view;
  }
  refresh() {
    this._onDidChangeTreeData.fire(null);
  }

  getTreeItem(element: Dependency): TreeItem {
    return element;
  }

  async getChildren(element?: Dependency): Promise<Dependency[]> {
    if (element) {
      return [];
    } else {
      if (!window.activeTextEditor) {
        return [];
      }
      const files: any = await commands.executeCommand(
        ELS_COMMANDS.GET_KIND_USAGES,
        window.activeTextEditor.document.uri.fsPath
      );
      if (this.view) {
        if (files.name && Array.isArray(files.usages) && files.usages.length) {
          (this.view as any).message = `${files.name} [${files.type}]`;
        } else {
          (this.view as any).message = "No other usages found..";
        }
      }
      if (files) {
        const result = await this.getDeps(files.usages);
        return result;
      } else {
        return [];
      }
    }
  }

  /**
   * Given the path to package.json, read all its dependencies and devDependencies.
   */
  private getDeps(kindUsages: any): Dependency[] {
    if (!Array.isArray(kindUsages)) {
      return [];
    }
    return kindUsages.map(({ name, type, path }) => {
      return new Dependency(name, type, path, TreeItemCollapsibleState.None);
    });
  }
}

class Dependency extends TreeItem {
  constructor(
    public readonly label: string,
    public readonly type: string,
    private fullPath: string,
    public readonly collapsibleState: TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
  }

  // @ts-expect-error
  get tooltip(): string {
    return `${this.label} [${this.type}]`;
  }

  // @ts-expect-error
  get contextValue() {
    return "file";
  }

  // @ts-expect-error
  get description(): string {
    return this.type;
  }

  // @ts-expect-error
  get command(): vscode.Command {
    return {
      title: "",
      tooltip: "Open file",
      command: "vscode.open",
      arguments: [this.resourceUri],
    };
  }

  // @ts-expect-error
  get resourceUri(): vscode.Uri {
    return Uri.file(this.fullPath);
  }
}

let ExtStatusBarItem: StatusBarItem;

export async function activate(context: ExtensionContext) {
  // The server is implemented in node
  let config = workspace.getConfiguration("els");
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
    initializationOptions: { editor: "vscode" },
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher(
        `**/*.{${syncExtensions.join(",")}}`
      ),
    },
  };

  ExtStatusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 10);
  ExtStatusBarItem.text = "$(telescope) Ember Loading...";
  ExtStatusBarItem.command = ELS_COMMANDS.SET_STATUS_BAR_TEXT;
  ExtStatusBarItem.show();

  // Push the disposable to the context's subscriptions so that the
  // client can be deactivated on extension deactivation
  context.subscriptions.push(
    commands.registerCommand(ELS_COMMANDS.SET_STATUS_BAR_TEXT, async () => {
      ExtStatusBarItem.text = "$(telescope) " + "Reloading projects...";
      await commands.executeCommand(ELS_COMMANDS.RELOAD_PROJECT);
      ExtStatusBarItem.text = "$(telescope) " + "Ember";
    })
  );

  context.subscriptions.push(
    commands.registerCommand(
      ELS_COMMANDS.PROXY_COMMAND,
      async (
        commandName: string,
        commandOpts: any,
        callbackCommandName: string,
        tail: any = {}
      ) => {
        try {
          let result = await commands.executeCommand(
            commandName,
            ...commandOpts
          );
          let document = workspace.rootPath;
          if (
            !document &&
            workspace.workspaceFolders &&
            workspace.workspaceFolders.length
          ) {
            document = workspace.workspaceFolders[0].uri.fsPath;
          }
          if (window.activeTextEditor) {
            document = window.activeTextEditor.document.uri.fsPath;
          }
          commands.executeCommand(callbackCommandName, document, result, tail);
        } catch (e) {
          window.showErrorMessage(e.toString());
        }
      }
    )
  );

  context.subscriptions.push(
    commands.registerCommand(
      ELS_COMMANDS.GET_USER_INPUT,
      async (opts: InputBoxOptions, callbackCommandName: string, tail: any) => {
        try {
          let what = await window.showInputBox(opts);
          let document = workspace.rootPath;
          if (
            !document &&
            workspace.workspaceFolders &&
            workspace.workspaceFolders.length
          ) {
            document = workspace.workspaceFolders[0].uri.fsPath;
          }
          if (window.activeTextEditor) {
            document = window.activeTextEditor.document.uri.fsPath;
          }
          commands.executeCommand(callbackCommandName, document, what, tail);
        } catch (e) {
          window.showErrorMessage(e.toString());
        }
      }
    )
  );

  context.subscriptions.push(
    commands.registerCommand(ELS_COMMANDS.RUN_IN_EMBER_CLI, async () => {
      let what = await window.showInputBox({
        placeHolder: "Enter ember-cli command",
      });
      if (!what) {
        return;
      }
      try {
        let document = workspace.rootPath;
        if (
          !document &&
          workspace.workspaceFolders &&
          workspace.workspaceFolders.length
        ) {
          document = workspace.workspaceFolders[0].uri.fsPath;
        }
        if (window.activeTextEditor) {
          document = window.activeTextEditor.document.uri.fsPath;
        }
        commands.executeCommand(
          ELS_COMMANDS.EXECUTE_IN_EMBER_CLI,
          document,
          what
        );
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
    ExtStatusBarItem.text = "$(telescope) " + "Ember";

    window.onDidChangeActiveTextEditor(() => {
      if (window.activeTextEditor) {
        fileUsagesProvider.refresh();
      }
    });
    let treeView = window.createTreeView("els.fileUsages", {
      treeDataProvider: fileUsagesProvider,
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
      "scss",
    ];
    context.subscriptions.push(
      commands.registerCommand(ELS_COMMANDS.OPEN_RELATED_FILE, openRelatedFile)
    );
    langs.forEach((language) => {
      context.subscriptions.push(
        languages.registerCodeLensProvider(language, { provideCodeLenses })
      );
    });
  }
}

function createWorkerLanguageClient(
  context: ExtensionContext,
  clientOptions: LanguageClientOptions
) {
  // Create a worker. The worker main file implements the language server.
  const serverMain = Uri.joinPath(
    context.extensionUri,
    "dist/web/server/browserServerMain.js"
  );
  const worker = new Worker(serverMain.toString());
  // create the language server client to communicate with the server running in the worker
  return new LanguageClient(
    "emberLanguageServer",
    "Unstable Ember Language Server",
    clientOptions,
    worker
  );
}
