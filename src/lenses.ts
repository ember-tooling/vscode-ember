"use strict";

import {
  CodeLens,
  Range,
  TextDocument,
  CancellationToken,
  commands,
  Position
} from "vscode";

import { COMMANDS as ELS_COMMNDS } from './constants';

function normalizePath(str: string): string {
    return str.split("\\").join("/");
}

function lenseNameFromPath(document, f) {
    let normPath = normalizePath(f);
    let fsPath = normalizePath(document.uri.fsPath);
    const isActive = fsPath === normPath;
    const isTest = normPath.includes("/tests/");
    const isAddon = normPath.includes("/addon/");
    const isComponent = normPath.includes("/components/");
    let name = normPath.endsWith(".hbs") ? "template" : "script";
    if (
      normPath.endsWith(".css") ||
      normPath.endsWith(".less") ||
      normPath.endsWith(".scss")
    ) {
      name = "style";
    }
    if (!isComponent) {
      if (normPath.includes("/routes/")) {
        name = "route";
      } else if (normPath.includes("/controllers/")) {
        name = "controller";
      }
    }
    if (isAddon) {
      name = `addon:${name}`;
    }
    if (isTest) {
      if (["script", "template"].includes(name)) {
        name = "test";
      } else {
        name = `${name}:test`;
      }
    }
    if (isActive) {
      name = "_" + name + "_";
    } else {
      name = " " + name + " ";
    }
    return name;
}

export  async function provideCodeLenses(
    document: TextDocument,
    token: CancellationToken
  ) {
    let relatedFiles: any = [];
    try {
      relatedFiles = await commands.executeCommand(
        ELS_COMMNDS.GET_RELATED_FILES,
        document.uri.fsPath
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
    return relatedFiles.map(f => {
      const name = lenseNameFromPath(document, f);
      return new CodeLens(new Range(new Position(0, 0), new Position(0, 0)), {
        title: name,
        tooltip: "Ember: " + f,
        command: ELS_COMMNDS.OPEN_RELATED_FILE,
        arguments: f.split("")
      });
    });
  }