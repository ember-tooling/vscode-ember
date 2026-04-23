import { workspace, Uri, WorkspaceFolder, OutputChannel } from 'vscode';

/**
 * Packages whose presence indicates an Ember-like project. If any of these
 * resolve from a workspace folder, we activate the language server.
 */
const EMBER_MARKER_PACKAGES = [
  'ember-source',
  'ember-template-lint',
  'ember-template-imports',
  'content-tag',
  'glimmer-lite-core',
  '@glimmerx/core',
] as const;

/**
 * File names at the root of a workspace folder that strongly indicate an
 * Ember CLI project.
 */
const EMBER_CLI_BUILD_FILES = [
  'ember-cli-build.js',
  'ember-cli-build.cjs',
  'ember-cli-build.mjs',
  'ember-cli-build.ts',
] as const;

const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;

/**
 * Primary entry point. Returns true if the language server should start for
 * the current workspace. Iterates all workspace folders and short-circuits on
 * the first positive signal.
 */
export async function isEmberProject(
  outputChannel: OutputChannel
): Promise<boolean> {
  const config = workspace.getConfiguration('els');
  const forceEnable = config.get<boolean>('detection.forceEnable', false);
  if (forceEnable) {
    return true;
  }

  const folders: ReadonlyArray<WorkspaceFolder> =
    workspace.workspaceFolders ?? [];
  if (folders.length === 0) {
    return false;
  }

  const results = await Promise.all(
    folders.map((folder) => detectInFolder(folder.uri))
  );

  if (!results.some((r) => r === true)) {
    const paths = folders.map((f) => f.uri.fsPath).join(', ');
    outputChannel.appendLine(
      `ELS: no Ember markers found in ${paths}; set \`els.detection.forceEnable\` to override.`
    );
    return false;
  }

  return true;
}

async function detectInFolder(folderUri: Uri): Promise<boolean> {
  // Tier 1: cheap package.json / build-file inspection.
  if (await checkBuildFile(folderUri)) {
    return true;
  }

  if (await checkPackageJsonDeps(folderUri)) {
    return true;
  }

  // Tier 2: Node resolver. Handles pnpm (incl. package-level opens),
  // npm-hoisted, and yarn classic transparently. Not available in the
  // web-worker build; guarded by a try/catch around the dynamic import.
  if (await checkViaResolver(folderUri)) {
    return true;
  }

  // Tier 3: explicit ancestor walk via workspace.fs. Belt-and-braces for
  // folders without a package.json or exotic resolver failures.
  if (await checkViaAncestorWalk(folderUri)) {
    return true;
  }

  return false;
}

/**
 * Read and parse a package.json at `<dir>/package.json`. Returns undefined if
 * the file is missing, unreadable, not valid JSON, or not a JSON object.
 */
async function readPackageJson(
  dirUri: Uri
): Promise<Record<string, unknown> | undefined> {
  const pkgUri = Uri.joinPath(dirUri, 'package.json');

  let raw: Uint8Array;
  try {
    raw = await workspace.fs.readFile(pkgUri);
  } catch {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder('utf-8').decode(raw));
  } catch {
    return undefined;
  }

  if (!parsed || typeof parsed !== 'object') {
    return undefined;
  }

  return parsed as Record<string, unknown>;
}

async function checkPackageJsonDeps(folderUri: Uri): Promise<boolean> {
  const pkg = await readPackageJson(folderUri);
  if (!pkg) return false;

  for (const field of DEPENDENCY_FIELDS) {
    const deps = pkg[field];
    if (!deps || typeof deps !== 'object') continue;
    for (const marker of EMBER_MARKER_PACKAGES) {
      if (marker in (deps as Record<string, unknown>)) {
        return true;
      }
    }
  }

  return false;
}

async function checkBuildFile(folderUri: Uri): Promise<boolean> {
  for (const name of EMBER_CLI_BUILD_FILES) {
    const uri = Uri.joinPath(folderUri, name);
    try {
      await workspace.fs.stat(uri);
      return true;
    } catch {
      // not present, try next
    }
  }
  return false;
}

async function checkViaResolver(folderUri: Uri): Promise<boolean> {
  // createRequire is a Node.js built-in and is not available in the
  // web-worker/browser build. Import it lazily so the module still loads
  // in that environment; if the import fails we fall through gracefully.
  let createRequire: ((filename: string) => NodeRequire) | undefined;
  try {
    ({ createRequire } = await import('module'));
  } catch {
    return false;
  }
  if (!createRequire) return false;

  let anchoredRequire: NodeRequire;
  try {
    // The anchor file need not exist; createRequire only uses the parent
    // directory as the resolution base.
    anchoredRequire = createRequire(Uri.joinPath(folderUri, 'noop.js').fsPath);
  } catch {
    return false;
  }

  for (const marker of EMBER_MARKER_PACKAGES) {
    try {
      anchoredRequire.resolve(`${marker}/package.json`);
      return true;
    } catch {
      // not resolvable from this anchor, try next
    }
  }

  return false;
}

async function checkViaAncestorWalk(folderUri: Uri): Promise<boolean> {
  const seen = new Set<string>();
  let dirUri = folderUri;
  // -1 = not yet seen a workspace root. Once set to a non-negative value,
  // counts how many more ancestors we'll visit before stopping.
  let stepsAfterWorkspaceRoot = -1;

  // Cap the walk to avoid pathological filesystems. 40 levels is deeper than
  // any realistic project tree.
  for (let i = 0; i < 40; i += 1) {
    const key = dirUri.toString();
    if (seen.has(key)) break;
    seen.add(key);

    for (const marker of EMBER_MARKER_PACKAGES) {
      const candidate = Uri.joinPath(
        dirUri,
        'node_modules',
        marker,
        'package.json'
      );
      try {
        await workspace.fs.stat(candidate);
        return true;
      } catch {
        // not here, keep looking
      }
    }

    if (stepsAfterWorkspaceRoot < 0) {
      // Not yet at a workspace root: once we find one, allow one more
      // ancestor above it. pnpm-workspace.yaml or a package.json with a
      // "workspaces" field marks the top of the workspace; going one level
      // above handles layouts that nest the repo inside another tooling
      // directory.
      if (await isWorkspaceRoot(dirUri)) {
        stepsAfterWorkspaceRoot = 0;
      }
    } else if (stepsAfterWorkspaceRoot === 0) {
      break;
    } else {
      stepsAfterWorkspaceRoot -= 1;
    }

    const parentPath = Uri.joinPath(dirUri, '..').fsPath;
    const parentUri = Uri.file(parentPath);
    if (parentUri.toString() === dirUri.toString()) break;
    dirUri = parentUri;
  }

  return false;
}

/**
 * Returns true if `dir` is the root of a monorepo workspace. Checks for:
 *   - pnpm: presence of a pnpm-workspace.yaml file
 *   - npm/yarn: a package.json with a "workspaces" field
 */
async function isWorkspaceRoot(dirUri: Uri): Promise<boolean> {
  const pnpmWorkspace = Uri.joinPath(dirUri, 'pnpm-workspace.yaml');
  try {
    await workspace.fs.stat(pnpmWorkspace);
    return true;
  } catch {
    // fall through
  }

  const pkg = await readPackageJson(dirUri);
  return !!pkg && 'workspaces' in pkg;
}
