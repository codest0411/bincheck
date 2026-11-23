import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { runCli } from '../../src/cli.js';
import { createTempDir, cleanupDir, writePackageFiles, initIsolatedGitRepo } from '../helpers/test-utils.js';

test('cli: exits 0 on healthy package with human, github, and sarif formats', async () => {
  const tempDir = createTempDir('cli-clean-');
  try {
    initIsolatedGitRepo(tempDir);
    writePackageFiles(tempDir, {
      name: 'healthy-tool',
      version: '1.0.0',
      type: 'module',
      bin: { 'healthy-tool': './bin/cli.js' },
      files: ['bin/']
    }, {
      'bin/cli.js': '#!/usr/bin/env node\nconsole.log("ok");\n',
      '.gitattributes': 'bin/* text eol=lf\n'
    });

    assert.equal(await runCli([tempDir, '--format', 'human', '--no-color']), 0);
    assert.equal(await runCli([tempDir, '--format', 'github']), 0);
    assert.equal(await runCli([tempDir, '--format', 'sarif']), 0);
  } finally {
    cleanupDir(tempDir);
  }
});

test('cli: exits 1 on broken package with errors', async () => {
  const tempDir = createTempDir('cli-broken-');
  try {
    writePackageFiles(tempDir, {
      name: 'broken-tool',
      version: '1.0.0',
      bin: { 'broken-tool': './cli.js' }
    }, {
      'cli.js': 'console.log("no shebang");\n'
    });

    const code = await runCli([tempDir, '--format', 'json', '--fail-on', 'error']);
    assert.equal(code, 1);

    // With fail-on never, exits 0
    assert.equal(await runCli([tempDir, '--fail-on', 'never', '--format', 'json']), 0);
  } finally {
    cleanupDir(tempDir);
  }
});

test('cli: --fix repairs CRLF via CLI', async () => {
  const tempDir = createTempDir('cli-fix-');
  try {
    initIsolatedGitRepo(tempDir);
    writePackageFiles(tempDir, {
      name: 'fix-cli',
      version: '1.0.0',
      type: 'module',
      bin: { 'fix-cli': './bin/cli.js' },
      files: ['bin/']
    }, {
      'bin/cli.js': '#!/usr/bin/env node\r\nconsole.log(1);\n',
      '.gitattributes': 'bin/* text eol=lf\n'
    });

    const code = await runCli([tempDir, '--fix', '--fail-on', 'never']);
    assert.equal(code, 0);
  } finally {
    cleanupDir(tempDir);
  }
});

test('cli: handles directory path with spaces', async () => {
  const baseDir = createTempDir('cli-space-');
  const tempDir = path.join(baseDir, 'folder with spaces');
  try {
    initIsolatedGitRepo(baseDir);
    writePackageFiles(tempDir, {
      name: 'space-pkg',
      version: '1.0.0',
      type: 'module',
      bin: { 'space-pkg': './cli.js' },
      files: ['cli.js']
    }, {
      'cli.js': '#!/usr/bin/env node\nconsole.log(1);\n'
    });

    const code = await runCli([tempDir, '--format', 'json', '--fail-on', 'never']);
    assert.equal(code, 0);
  } finally {
    cleanupDir(baseDir);
  }
});

test('cli: help and version exit 0', async () => {
  assert.equal(await runCli(['--help']), 0);
  assert.equal(await runCli(['--version']), 0);
});

test('cli: invalid arguments or missing package.json exit 2', async () => {
  assert.equal(await runCli(['--invalid-unknown-flag']), 2);
  assert.equal(await runCli(['--format', 'invalid-format']), 2);
  assert.equal(await runCli(['--fail-on', 'invalid-fail-on']), 2);

  const emptyDir = createTempDir('cli-empty-');
  try {
    assert.equal(await runCli([emptyDir]), 2);
  } finally {
    cleanupDir(emptyDir);
  }
});
