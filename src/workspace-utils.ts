import * as path from 'path';
import { createRequire } from 'module';
import { workspace, Uri, WorkspaceFolder } from 'vscode';

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
export async function isEmberProject(): Promise<boolean> {
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
    folders.map((folder) => detectInFolder(folder.uri.fsPath))
  );
  return results.some((r) => r === true);
}

async function detectInFolder(folderFsPath: string): Promise<boolean> {
  // Tier 1: cheap package.json / build-file inspection.
  if (await checkBuildFile(folderFsPath)) {
    return true;
  }

  if (await checkPackageJsonDeps(folderFsPath)) {
    return true;
  }

  // Tier 2: Node resolver. Handles pnpm (incl. package-level opens),
  // npm-hoisted, and yarn classic transparently.
  if (checkViaResolver(folderFsPath)) {
    return true;
  }

  // Tier 3: explicit ancestor walk via workspace.fs. Belt-and-braces for
  // folders without a package.json or exotic resolver failures.
  if (await checkViaAncestorWalk(folderFsPath)) {
    return true;
  }

  return false;
}

/**
 * Read and parse a package.json at `<dir>/package.json`. Returns undefined if
 * the file is missing, unreadable, not valid JSON, or not a JSON object.
 */
async function readPackageJson(
  dir: string
): Promise<Record<string, unknown> | undefined> {
  const pkgUri = Uri.file(path.join(dir, 'package.json'));

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

async function checkPackageJsonDeps(folderFsPath: string): Promise<boolean> {
  const pkg = await readPackageJson(folderFsPath);
  if (!pkg) return false;

  for (const field of DEPENDENCY_FIELDS) {
    const deps = pkg[field];
    if (!deps || typeof deps !== 'object') continue;
    const depNames = Object.keys(deps as Record<string, unknown>);
    for (const marker of EMBER_MARKER_PACKAGES) {
      if (depNames.indexOf(marker) !== -1) {
        return true;
      }
    }
  }

  return false;
}

async function checkBuildFile(folderFsPath: string): Promise<boolean> {
  for (const name of EMBER_CLI_BUILD_FILES) {
    const uri = Uri.file(path.join(folderFsPath, name));
    try {
      await workspace.fs.stat(uri);
      return true;
    } catch {
      // not present, try next
    }
  }
  return false;
}

function checkViaResolver(folderFsPath: string): boolean {
  let anchoredRequire: NodeRequire;
  try {
    // The anchor file need not exist; createRequire only uses the parent
    // directory as the resolution base.
    anchoredRequire = createRequire(path.join(folderFsPath, 'noop.js'));
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

async function checkViaAncestorWalk(folderFsPath: string): Promise<boolean> {
  const seen = new Set<string>();
  let dir = folderFsPath;
  // -1 = not yet seen a monorepo root. Once set to a non-negative value,
  // counts how many more ancestors we'll visit before stopping.
  let stepsAfterMonorepoRoot = -1;

  // Cap the walk to avoid pathological filesystems. 40 levels is deeper than
  // any realistic project tree.
  for (let i = 0; i < 40; i += 1) {
    if (seen.has(dir)) break;
    seen.add(dir);

    for (const marker of EMBER_MARKER_PACKAGES) {
      const candidate = Uri.file(
        path.join(dir, 'node_modules', marker, 'package.json')
      );
      try {
        await workspace.fs.stat(candidate);
        return true;
      } catch {
        // not here, keep looking
      }
    }

    if (stepsAfterMonorepoRoot < 0) {
      // Not yet at a monorepo root: allow one more ancestor after we hit one.
      // pnpm-workspace.yaml or a package.json with a "workspaces" field marks
      // the top of the workspace; going one level above handles layouts that
      // nest the repo inside another tooling directory.
      if (await isMonorepoRoot(dir)) {
        stepsAfterMonorepoRoot = 1;
      }
    } else if (stepsAfterMonorepoRoot === 0) {
      break;
    } else {
      stepsAfterMonorepoRoot -= 1;
    }

    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return false;
}

async function isMonorepoRoot(dir: string): Promise<boolean> {
  const pnpmWorkspace = Uri.file(path.join(dir, 'pnpm-workspace.yaml'));
  try {
    await workspace.fs.stat(pnpmWorkspace);
    return true;
  } catch {
    // fall through
  }

  const pkg = await readPackageJson(dir);
  return !!pkg && 'workspaces' in pkg;
}
