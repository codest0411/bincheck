import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { loadConfig } from '../../src/config.js';
import { createTempDir, cleanupDir } from '../helpers/test-utils.js';

test('config: loads valid .bincheckrc.json', () => {
  const tempDir = createTempDir('cfg-valid-');
  try {
    const rcPath = path.join(tempDir, '.bincheckrc.json');
    fs.writeFileSync(rcPath, JSON.stringify({
      failOn: 'warn',
      ignore: {
        'BC005': 'We explicitly use env flags for node options'
      }
    }));

    const cfg = loadConfig(undefined, tempDir);
    assert.equal(cfg.failOn, 'warn');
    assert.equal(cfg.ignore.get('BC005'), 'We explicitly use env flags for node options');
  } finally {
    cleanupDir(tempDir);
  }
});

test('config: throws if specified config file does not exist', () => {
  assert.throws(
    () => loadConfig('nonexistent-file.json'),
    /Specified config file does not exist/
  );
});

test('config: throws if config contains malformed JSON or non-object', () => {
  const tempDir = createTempDir('cfg-invalid-');
  try {
    const rcPath = path.join(tempDir, '.bincheckrc.json');
    fs.writeFileSync(rcPath, '{ invalid json');
    assert.throws(() => loadConfig(rcPath), /Malformed JSON in config file/);

    fs.writeFileSync(rcPath, '["array-root"]');
    assert.throws(() => loadConfig(rcPath), /Config file must contain a JSON object at root/);
  } finally {
    cleanupDir(tempDir);
  }
});

test('config: throws on invalid failOn setting', () => {
  const tempDir = createTempDir('cfg-failon-');
  try {
    const rcPath = path.join(tempDir, '.bincheckrc.json');
    fs.writeFileSync(rcPath, '{"failOn": "invalid"}');
    assert.throws(() => loadConfig(rcPath), /Invalid "failOn" value/);
  } finally {
    cleanupDir(tempDir);
  }
});

test('config: rejects unknown properties', () => {
  const tempDir = createTempDir('cfg-unknown-');
  try {
    const rcPath = path.join(tempDir, '.bincheckrc.json');
    fs.writeFileSync(rcPath, JSON.stringify({
      unexpected: true
    }));

    assert.throws(
      () => loadConfig(undefined, tempDir),
      /Unknown configuration key: "unexpected"/
    );
  } finally {
    cleanupDir(tempDir);
  }
});

test('config: prototype pollution keys are rejected', () => {
  const tempDir = createTempDir('cfg-proto-');
  try {
    const rcPath = path.join(tempDir, '.bincheckrc.json');
    fs.writeFileSync(rcPath, '{"__proto__": {"admin": true}}');

    assert.throws(
      () => loadConfig(undefined, tempDir),
      /Forbidden property in config/
    );
  } finally {
    cleanupDir(tempDir);
  }
});

test('config: ignore requires mandatory justification reason', () => {
  const tempDir = createTempDir('cfg-noreason-');
  try {
    const rcPath = path.join(tempDir, '.bincheckrc.json');
    fs.writeFileSync(rcPath, JSON.stringify({
      ignore: {
        'BC001': ''
      }
    }));

    assert.throws(
      () => loadConfig(undefined, tempDir),
      /requires a non-empty string justification/
    );
  } finally {
    cleanupDir(tempDir);
  }
});
