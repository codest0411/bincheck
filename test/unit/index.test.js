import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { audit } from '../../src/index.js';
import { createTempDir, cleanupDir, writePackageFiles, initIsolatedGitRepo } from '../helpers/test-utils.js';

test('index: audit throws when package.json does not exist', async () => {
  const tempDir = createTempDir('index-nopkg-');
  try {
    await assert.rejects(
      () => audit(tempDir),
      /Directory does not contain a package\.json file/
    );
  } finally {
    cleanupDir(tempDir);
  }
});

test('index: audit throws when package.json contains malformed JSON', async () => {
  const tempDir = createTempDir('index-badpkg-');
  try {
    fs.writeFileSync(path.join(tempDir, 'package.json'), '{ not valid json');
    await assert.rejects(
      () => audit(tempDir),
      /Failed to read or parse package\.json/
    );
  } finally {
    cleanupDir(tempDir);
  }
});

test('index: audit runs fix option successfully', async () => {
  const tempDir = createTempDir('index-fix-');
  try {
    initIsolatedGitRepo(tempDir);
    writePackageFiles(tempDir, {
      name: 'fix-test',
      version: '1.0.0',
      type: 'module',
      bin: { 'fix-test': './cli.js' },
      files: ['cli.js']
    }, {
      'cli.js': '#!/usr/bin/env node\r\nconsole.log(1);\n',
      '.gitattributes': 'cli.js text eol=lf\n'
    });

    const res = await audit(tempDir, { fix: true, failOn: 'never' });
    assert.equal(res.fixResults.length, 1);
    assert.equal(res.fixResults[0].changed, true);
  } finally {
    cleanupDir(tempDir);
  }
});

test('index: audit returns exit code 1 when warning exceeds threshold', async () => {
  const tempDir = createTempDir('index-warn-');
  try {
    initIsolatedGitRepo(tempDir);
    writePackageFiles(tempDir, {
      name: 'warn-test',
      version: '1.0.0',
      type: 'module',
      bin: { 'warn-test': './cli.js' },
      files: ['cli.js']
    }, {
      'cli.js': '#!/usr/bin/env node\nconsole.log(1);\n'
      // No .gitattributes -> triggers BC008 warning
    });

    const res = await audit(tempDir, { failOn: 'warn' });
    assert.equal(res.exitCode, 1);
  } finally {
    cleanupDir(tempDir);
  }
});
