import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIsolatedEnv } from '../../src/smoke.js';
import { createTempDir, cleanupDir } from '../helpers/test-utils.js';

test('smoke: buildIsolatedEnv constructs isolated sandbox environment', () => {
  const tempDir = createTempDir('smoke-unit-');
  try {
    const env = buildIsolatedEnv(tempDir);
    assert.equal(env.HOME, tempDir);
    assert.equal(env.USERPROFILE, tempDir);
    assert.equal(env.TMPDIR, tempDir);
    assert.ok(env.npm_config_cache?.includes('npm-cache'));
  } finally {
    cleanupDir(tempDir);
  }
});
