import * as vscode from 'vscode';
import { COMMANDS as ELS_COMMANDS } from './constants';


export class UsagesProvider implements vscode.TreeDataProvider<Dependency> {
  constructor() { }

  private _onDidChangeTreeData: vscode.EventEmitter<Dependency | undefined> = new vscode.EventEmitter<Dependency | undefined>();
  readonly onDidChangeTreeData: vscode.Event<Dependency | undefined> = this._onDidChangeTreeData.event;
  private view !: vscode.TreeView<Dependency>;
  setView(view: vscode.TreeView<Dependency>) {
    this.view = view;
  }
  refresh() {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: Dependency): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: Dependency): Promise<Dependency[]> {
    if (element) {
      return [];
    } else {
      if (!vscode.window.activeTextEditor) {
        return [];
      }
      const files: any = await vscode.commands.executeCommand(ELS_COMMANDS.GET_KIND_USAGES, vscode.window.activeTextEditor.document.uri.fsPath);
      if (this.view) {
        if (files.name && Array.isArray(files.usages) && files.usages.length) {
          (this.view as any).message = `${files.name} [${files.type}]`;
        } else {
          (this.view as any).message = 'No other usages found..';
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
    return kindUsages.map(({name, type, path}) => {
      return new Dependency(name, type, path, vscode.TreeItemCollapsibleState.None);
    });
  }
}

class Dependency extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly type: string,
    private fullPath: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
  }


  get tooltip(): string {
    return `${this.label} [${this.type}]`;
  }

  get contextValue() {
    return 'file';
  }

  get description(): string {
    return this.type;
  }
  get command(): vscode.Command {
    return {
      title: '',
      tooltip: 'Open file',
      command: 'vscode.open',
      arguments: [this.resourceUri]
    }
  }

  get resourceUri(): vscode.Uri {
    return vscode.Uri.file(this.fullPath);
  }

}
