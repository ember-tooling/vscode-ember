import {
    workspace
  } from "vscode";

export async function isGlimmerXProject(): Promise<boolean> {
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
  
export  async function isEmberCliProject(): Promise<boolean> {
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
  