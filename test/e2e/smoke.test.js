import test from 'node:test';
import assert from 'node:assert/strict';
import { runSmokeTest } from '../../src/smoke.js';
import { createTempDir, cleanupDir, writePackageFiles } from '../helpers/test-utils.js';

test('smoke: harmless fixture bin executes cleanly with exit code 0', async () => {
  const tempDir = createTempDir('smoke-harmless-');
  try {
    writePackageFiles(tempDir, {
      name: 'smoke-clean',
      version: '1.0.0',
      type: 'module',
      bin: { 'smoke-clean': './cli.js' },
      files: ['cli.js']
    }, {
      'cli.js': '#!/usr/bin/env node\nconsole.log("Usage: smoke-clean --help");\nprocess.exit(0);\n'
    });

    const results = await runSmokeTest(tempDir, ['--help'], 10000);
    assert.equal(results.length, 1);
    assert.equal(results[0].binName, 'smoke-clean');
    assert.equal(results[0].exitCode, 0);
    assert.ok(results[0].stdout.includes('Usage: smoke-clean --help'));
  } finally {
    cleanupDir(tempDir);
  }
});

test('smoke: bin that hangs is terminated at timeout', async () => {
  const tempDir = createTempDir('smoke-hang-');
  try {
    writePackageFiles(tempDir, {
      name: 'smoke-hang',
      version: '1.0.0',
      type: 'module',
      bin: { 'smoke-hang': './hang.js' },
      files: ['hang.js']
    }, {
      'hang.js': '#!/usr/bin/env node\nsetInterval(() => {}, 1000);\n'
    });

    // 1000ms timeout
    const results = await runSmokeTest(tempDir, ['--help'], 1000);
    assert.equal(results.length, 1);
    assert.equal(results[0].timedOut, true);
  } finally {
    cleanupDir(tempDir);
  }
});

test('smoke: environment isolation hides developer tokens and user home', async () => {
  const tempDir = createTempDir('smoke-env-');
  const oldToken = process.env.SECRET_DEV_TOKEN;
  const originalHome = (process.env.HOME || '').replace(/\\/g, '/');
  const originalProfile = (process.env.USERPROFILE || '').replace(/\\/g, '/');
  try {
    process.env.SECRET_DEV_TOKEN = 'SUPER_SECRET_VALUE_12345';

    writePackageFiles(tempDir, {
      name: 'smoke-env-test',
      version: '1.0.0',
      type: 'module',
      bin: { 'smoke-env': './env.js' },
      files: ['env.js']
    }, {
      'env.js': `#!/usr/bin/env node
const token = process.env.SECRET_DEV_TOKEN || 'HIDDEN';
console.log('TOKEN=' + token);
const home = (process.env.HOME || '').replace(/\\\\/g, '/');
const profile = (process.env.USERPROFILE || '').replace(/\\\\/g, '/');
console.log('HOME_IS_ORIGINAL=' + (home === '${originalHome}'));
console.log('PROFILE_IS_ORIGINAL=' + (profile === '${originalProfile}'));
`
    });

    const results = await runSmokeTest(tempDir, ['--help'], 10000);
    assert.equal(results.length, 1);
    assert.ok(results[0].stdout.includes('TOKEN=HIDDEN'), 'Secret dev token must NOT be leaked');
    assert.ok(results[0].stdout.includes('HOME_IS_ORIGINAL=false'), 'HOME must point to isolated sandbox');
    assert.ok(results[0].stdout.includes('PROFILE_IS_ORIGINAL=false'), 'USERPROFILE must point to isolated sandbox');
  } finally {
    if (oldToken !== undefined) {
      process.env.SECRET_DEV_TOKEN = oldToken;
    } else {
      delete process.env.SECRET_DEV_TOKEN;
    }
    cleanupDir(tempDir);
  }
});
