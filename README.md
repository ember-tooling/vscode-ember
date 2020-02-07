# vscode-ember


This is the VSCode extension to use the [Unstable Ember Language Server](https://github.com/lifeart/ember-language-server). 

`Unstable Ember Language Server` is full-featured fork of [Ember Language Server](https://github.com/emberwatch/ember-language-server). It's `stable` and `extremely` power-featured.


All `Ember Language Server` features included.

![preview](preview.gif)

## Best with

* [Glimmer Templates Syntax for VS Code](https://marketplace.visualstudio.com/items?itemName=lifeart.vscode-glimmer-syntax)
* [Prettier for Handlebars](https://marketplace.visualstudio.com/items?itemName=Alonski.prettier-for-handlebars-vscode)


## Features

- Autocomplete (including installed addons and in-repo addons)
  - Components (Curly, Angle Bracket)
  - Component Arguments (if used in template)
  - Services
  - Route/Controler transition functions route names
  - Model names (store methods, model relation definition)
  - Transform names (model definition)
  - Helpers
  - Modifiers
  - Get / Set / ... / Computed macros
  - Local paths in templates (`this...`)
  - Route autocompletion in `link-to`
  - `<LinkTo />` @route argument autocomplete


- Definition providers for (enable features like "Go To Definition" or "Peek Definition"):
  - Components (in Templates)
  - Helpers (in Templates)
  - Modfiers
  - Models
  - Transforms
  - Routes
  - Services
  - Ember-addons imports
  - Component block arguments (`as | name | `)
  - Any local paths (`this...`)
 
- Supported layouts
  - Classic 
  - Template Collocation
  - Pods
  - Module Unification

- Supported Script Files
  - JavaScript
  - TypeScript

- Diagnostics for ember-template-lint (if it is included in a project)


## Addons

* [els-a11y-addon](https://github.com/lifeart/els-a11y-addon) - Ember Language Server a11y addon.
* [els-addon-typed-templates](https://github.com/lifeart/els-addon-typed-templates) - Typed Templates for Ember.
* [els-addon-docs](https://github.com/lifeart/els-addon-docs) - Ember Language Server Addon Docs Completion Provider.
* [ember-fast-cli](https://github.com/lifeart/ember-fast-cli) - Addon for Ember-cli commands execution.

## Settings

* `els.codeLens.relatedFiles` - disable / enable related files
* `els.local.addons` - globally defined local language server addons entry folders, for example:
   
```js
{
    "els.local.addons": ["C:\\Users\\ember\\els-addon-typed-templates"],
}

```