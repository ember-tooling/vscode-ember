# Debugging

## Debugging `vscode-ember` via VSCode
 - Run `yarn` to install dependencies
 - Run debugger `Launch Client` (press `F5`)

## Debugging `Stable Ember Language Server` via VSCode
 - Go to `ember-language-server` folder
 - Run `yarn link`
 - Go to `vscode-ember` folder
 - Run `yarn link @lifeart/ember-language-server`
 - Add `ember-language-server` folder to workspace, you will have a [multi-root workspace](https://code.visualstudio.com/docs/editor/multi-root-workspaces)
 - Run debugger `Client + Server`
