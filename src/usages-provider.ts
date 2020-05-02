import * as vscode from 'vscode';
import { COMMANDS as ELS_COMMANDS } from './constants';


export class UsagesProvider implements vscode.TreeDataProvider<Dependency> {
  constructor() { }

  private _onDidChangeTreeData: vscode.EventEmitter<Dependency | undefined> = new vscode.EventEmitter<Dependency | undefined>();
  readonly onDidChangeTreeData: vscode.Event<Dependency | undefined> = this._onDidChangeTreeData.event;

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
      const files = await vscode.commands.executeCommand(ELS_COMMANDS.GET_RELATED_FILES, vscode.window.activeTextEditor.document.uri.fsPath);
      if (files) {
        const result = await this.getDeps(files as string[]);
        return result;
      } else {
        return [];
      }
    }
  }

  /**
   * Given the path to package.json, read all its dependencies and devDependencies.
   */
  private getDeps(relatedFiles: string[]): Dependency[] {
    return relatedFiles.map((filePath) => {
      const normalized = filePath.split('\\').join('/');
      const name = normalized.split('/').pop();
      return new Dependency(name, normalized, vscode.TreeItemCollapsibleState.None);
    });
  }
}

class Dependency extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    private fullPath: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
  }


  get tooltip(): string {
    return `${this.label}-${this.fullPath}`;
  }

  get contextValue() {
    return 'file';
  }

  get description(): string {
    return this.fullPath;
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
