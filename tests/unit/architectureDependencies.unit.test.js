import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const sourceDir = path.join(rootDir, 'src');
const sourceRoots = [
  sourceDir,
  path.join(rootDir, 'services', 'notification-service', 'src')
];

const importPattern = /import\s+(?:[^;]*?\s+from\s+)?['"]([^'"]+)['"]|export\s+[^;]*?\s+from\s+['"]([^'"]+)['"]/g;
const moduleInternalFilePattern = /^src\/modules\/([^/]+)\/(.+\.js)$/;

function toPosixPath(filePath) {
  return path.relative(rootDir, filePath).split(path.sep).join('/');
}

function listJavaScriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return listJavaScriptFiles(entryPath);
    }

    return entry.name.endsWith('.js') ? [entryPath] : [];
  });
}

function readImports(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const imports = [];
  let match = importPattern.exec(source);

  while (match) {
    imports.push(match[1] || match[2]);
    match = importPattern.exec(source);
  }

  return imports;
}

function resolveImport(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null;

  const resolved = path.resolve(path.dirname(fromFile), specifier);
  const resolvedFile = path.extname(resolved) ? resolved : `${resolved}.js`;

  if (!resolvedFile.startsWith(rootDir)) return null;

  return toPosixPath(resolvedFile);
}

function getModuleName(filePath) {
  const relativePath = toPosixPath(filePath);
  return relativePath.match(moduleInternalFilePattern)?.[1] || null;
}

function collectViolations(rule) {
  return sourceRoots.flatMap(listJavaScriptFiles).flatMap((filePath) => {
    const from = toPosixPath(filePath);

    return readImports(filePath)
      .map((specifier) => ({
        from,
        to: resolveImport(filePath, specifier),
        specifier
      }))
      .filter(({ to }) => to)
      .flatMap((dependency) => {
        const message = rule(dependency, filePath);
        return message ? [message] : [];
      });
  });
}

describe('architecture dependencies', () => {
  it('keeps cross-module imports behind module public APIs', () => {
    const violations = collectViolations(({ from, to }, fromFile) => {
      const sourceModule = getModuleName(fromFile);
      const targetMatch = to.match(moduleInternalFilePattern);

      if (!targetMatch) return null;

      const [, targetModule, targetFile] = targetMatch;

      if (sourceModule === targetModule) return null;
      if (targetFile === 'index.js') return null;

      return `${from} imports internal ${targetModule} file ${to}`;
    });

    expect(violations).toEqual([]);
  });

  it('prevents transport files from reaching data access directly', () => {
    const violations = collectViolations(({ from, to }) => {
      const isTransport = /(?:Routes|Controller)\.js$/.test(from);
      const isRepository = /Repository\.js$/.test(to);

      return isTransport && isRepository
        ? `${from} imports repository ${to}`
        : null;
    });

    expect(violations).toEqual([]);
  });

  it('keeps repositories independent from application and transport layers', () => {
    const violations = collectViolations(({ from, to }) => {
      const isRepository = /Repository\.js$/.test(from);
      const reachesUpperLayer = /(?:Routes|Controller|Service)\.js$/.test(to);

      return isRepository && reachesUpperLayer
        ? `${from} imports upper-layer file ${to}`
        : null;
    });

    expect(violations).toEqual([]);
  });

  it('keeps application services independent from Express', () => {
    const violations = sourceRoots.flatMap(listJavaScriptFiles).flatMap((filePath) => {
      const from = toPosixPath(filePath);
      if (!/Service\.js$/.test(from)) return [];

      return readImports(filePath)
        .filter((specifier) => specifier === 'express')
        .map(() => `${from} imports express`);
    });

    expect(violations).toEqual([]);
  });
});
