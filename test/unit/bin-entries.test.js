import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { extractBinEntries } from '../../src/bin-entries.js';
import { createTempDir, cleanupDir, writePackageFiles } from '../helpers/test-utils.js';

test('bin-entries: extracts string bin with package name', () => {
  const tempDir = createTempDir('bin-str-');
  try {
    writePackageFiles(tempDir, { name: 'my-cli', bin: './cli.js' }, { 'cli.js': '#!/usr/bin/env node' });
    const pkg = JSON.parse(fs.readFileSync(path.join(tempDir, 'package.json'), 'utf8'));

    const entries = extractBinEntries(tempDir, pkg);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].name, 'my-cli');
    assert.equal(entries[0].normalizedTarget, 'cli.js');
    assert.equal(entries[0].existsOnDisk, true);
    assert.equal(entries[0].escapesRoot, false);
  } finally {
    cleanupDir(tempDir);
  }
});

test('bin-entries: handles empty target string error', () => {
  const tempDir = createTempDir('bin-empty-');
  try {
    writePackageFiles(tempDir, { name: 'my-cli', bin: { 'bad': '' } });
    const pkg = JSON.parse(fs.readFileSync(path.join(tempDir, 'package.json'), 'utf8'));

    const entries = extractBinEntries(tempDir, pkg);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].error, 'Target path must be a non-empty string');
  } finally {
    cleanupDir(tempDir);
  }
});

test('bin-entries: extracts scoped package bin name', () => {
  const tempDir = createTempDir('bin-scope-');
  try {
    writePackageFiles(tempDir, { name: '@myorg/tool', bin: './run.js' }, { 'run.js': '#!/usr/bin/env node' });
    const pkg = JSON.parse(fs.readFileSync(path.join(tempDir, 'package.json'), 'utf8'));

    const entries = extractBinEntries(tempDir, pkg);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].name, 'tool');
  } finally {
    cleanupDir(tempDir);
  }
});

test('bin-entries: extracts object bin entries', () => {
  const tempDir = createTempDir('bin-obj-');
  try {
    writePackageFiles(tempDir, {
      name: 'pkg',
      bin: {
        'cmd1': './bin/cmd1.js',
        'cmd2': './bin/cmd2.js'
      }
    }, {
      'bin/cmd1.js': '#!/usr/bin/env node',
      'bin/cmd2.js': '#!/usr/bin/env node'
    });
    const pkg = JSON.parse(fs.readFileSync(path.join(tempDir, 'package.json'), 'utf8'));

    const entries = extractBinEntries(tempDir, pkg);
    assert.equal(entries.length, 2);
    assert.equal(entries.map(e => e.name).sort().join(','), 'cmd1,cmd2');
  } finally {
    cleanupDir(tempDir);
  }
});

test('bin-entries: extracts directories.bin', () => {
  const tempDir = createTempDir('bin-dir-');
  try {
    writePackageFiles(tempDir, {
      name: 'pkg',
      directories: { bin: './executables' }
    }, {
      'executables/run-a': '#!/usr/bin/env node',
      'executables/run-b': '#!/usr/bin/env node'
    });
    const pkg = JSON.parse(fs.readFileSync(path.join(tempDir, 'package.json'), 'utf8'));

    const entries = extractBinEntries(tempDir, pkg);
    assert.equal(entries.length, 2);
    assert.equal(entries.map(e => e.name).sort().join(','), 'run-a,run-b');
  } finally {
    cleanupDir(tempDir);
  }
});

test('bin-entries: detects root directory traversal escape', () => {
  const tempDir = createTempDir('bin-escape-');
  try {
    writePackageFiles(tempDir, {
      name: 'pkg',
      bin: { 'bad': '../secret.js' }
    });
    const pkg = JSON.parse(fs.readFileSync(path.join(tempDir, 'package.json'), 'utf8'));

    const entries = extractBinEntries(tempDir, pkg);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].escapesRoot, true);
  } finally {
    cleanupDir(tempDir);
  }
});

test('bin-entries: detects symlink escaping root when symlink is supported', () => {
  const tempDir = createTempDir('bin-symlink-');
  try {
    const outsideTarget = path.join(tempDir, '..', 'external.js');
    fs.writeFileSync(outsideTarget, 'console.log(1);');

    const linkPath = path.join(tempDir, 'symlink-bin.js');
    try {
      fs.symlinkSync(outsideTarget, linkPath, 'file');
    } catch {
      // Symlink creation may require privilege on Windows, skip if not permitted
      return;
    }

    writePackageFiles(tempDir, {
      name: 'pkg',
      bin: { 'linked': './symlink-bin.js' }
    });
    const pkg = JSON.parse(fs.readFileSync(path.join(tempDir, 'package.json'), 'utf8'));

    const entries = extractBinEntries(tempDir, pkg);
    assert.equal(entries.length, 1);
    assert.ok(entries[0].error?.includes('escapes package root'));

    try { fs.unlinkSync(outsideTarget); } catch {}
  } finally {
    cleanupDir(tempDir);
  }
});
