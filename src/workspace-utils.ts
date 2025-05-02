import { workspace } from 'vscode';

export async function emberLikeProject(): Promise<boolean> {
  const emberCliBuildFile = await workspace.findFiles(
    '**/node_modules/{glimmer-lite-core,@glimmerx/core,content-tag,ember-template-lint,ember-source,ember-template-imports}/package.json',
    '**/{dist,tmp,.git,.cache}/**',
    1
  );

  return emberCliBuildFile.length > 0;
}

export async function isEmberCliProject(): Promise<boolean> {
  const emberCliBuildFile = await workspace.findFiles(
    '**/ember-cli-build.{js,cjs}',
    '**/{dist,tmp,node_modules,.git,.cache}/**',
    1
  );

  return emberCliBuildFile.length > 0;
}
