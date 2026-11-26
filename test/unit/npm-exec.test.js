import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { resolveNpmCli, runNpm } from '../../src/npm-exec.js';
import { createTempDir, cleanupDir } from '../helpers/test-utils.js';

test('npm-exec: resolveNpmCli locates npm via npm_execpath', () => {
  const tempDir = createTempDir('npm-test-');
  try {
    const fakeNpmCli = path.join(tempDir, 'npm-cli.js');
    fs.writeFileSync(fakeNpmCli, 'console.log("fake npm");');

    const resolved = resolveNpmCli({ npm_execpath: fakeNpmCli });
    assert.equal(resolved, fakeNpmCli);
  } finally {
    cleanupDir(tempDir);
  }
});

test('npm-exec: resolveNpmCli falls back to node directory candidates', () => {
  const tempDir = createTempDir('npm-fallback-');
  try {
    const fakeNodeExe = path.join(tempDir, 'bin', 'node.exe');
    const fakeCliPath = path.join(tempDir, 'bin', 'node_modules', 'npm', 'bin', 'npm-cli.js');
    fs.mkdirSync(path.dirname(fakeCliPath), { recursive: true });
    fs.writeFileSync(fakeCliPath, '');

    const resolved = resolveNpmCli({}, fakeNodeExe);
    assert.equal(resolved, fakeCliPath);
  } finally {
    cleanupDir(tempDir);
  }
});

test('npm-exec: resolveNpmCli throws helpful error when not found', () => {
  assert.throws(
    () => resolveNpmCli({ npm_execpath: 'nonexistent-path' }, 'C:\\nonexistent\\node.exe', () => false),
    /Unable to locate npm-cli\.js/
  );
});

test('npm-exec: runNpm executes safely with real npm', () => {
  const version = runNpm(['--version']);
  assert.match(version.trim(), /^\d+\.\d+\.\d+/);
});
