"use strict";

import {
  CodeLens,
  Range,
  TextDocument,
  CancellationToken,
  commands,
  Position
} from "vscode";

export type MatchResultType =
  | 'helper'
  | 'service'
  | 'route'
  | 'controller'
  | 'modifier'
  | 'template'
  | 'component'
  | 'model'
  | 'transform'
  | 'adapter'
  | 'serializer';
type MatchResultScope = 'addon' | 'application';
type MatchResultKind = 'test' | 'script' | 'template' | 'style';
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

import { COMMANDS as ELS_COMMANDS } from './constants';

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
  const isAddonExport = f.meta.scope === 'addon';
  const isRoutePath = ['route', 'controller', 'template'].includes(f.meta.type);
  const typeKey = isRoutePath ? `:${f.meta.type}:` : ':';
  let scope = isAddonExport && isAddonApp ? 'addon-app' : f.meta.scope;
  if (isDummyApp) {
    scope = 'dummy-app'
    if (f.meta.kind === 'test') {
      f.meta.kind = 'script';
    }
  }
  const key = `${scope}${typeKey}${f.meta.kind}`;
  let name = key.replace('application:', '');
  name = name.replace('template:template', 'template');
  if (meta && !isRoutePath) {
    name = name.replace(`${meta.type}:`, '');
  }
  name = name.replace(`${f.meta.type}:script`, f.meta.type);
  if (isActive) {
    name = "_" + name + "_";
  }
  return name.trim();
}

export async function provideCodeLenses(
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
  })
  return lenseNames.map(({ name, path, tooltip }) => {
    return new CodeLens(new Range(new Position(0, 0), new Position(0, 0)), {
      title: name,
      tooltip: "Ember: " + tooltip,
      command: ELS_COMMANDS.OPEN_RELATED_FILE,
      arguments: path
    });
  });
}
