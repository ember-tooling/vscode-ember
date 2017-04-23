# vscode-ember

This is the VSCode extension to use the [Ember Language Server](https://github.com/emberwatch/ember-language-server).  

![preview](preview.gif)

## Features

All features currently only work in Ember-CLI apps that use classic structure and are a rough first draft with a lot of room for improvements. Pods and addons are not supported yet.

- Component and helper autocompletion for inline and sub expressions
- Definition providers for (enable features like "Go To Definition" or "Peek Definition"):
  - Components (in Templates)
  - Helpers (in Templates)
  - Models
  - Transforms
- Route autocompletion in `link-to`
- Diagnostics for ember-template-lint (if it is included in a project)
