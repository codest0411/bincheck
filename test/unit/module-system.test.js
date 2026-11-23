import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { stripCommentsAndStrings, analyzeModuleSystem } from '../../src/module-system.js';
import { createTempDir, cleanupDir } from '../helpers/test-utils.js';

test('module-system: stripCommentsAndStrings strips comments and literals', () => {
  const code = `
    // import 'foo'
    /* require('bar') */
    const msg = "import { x } from 'y'";
    const tpl = \`require('baz')\`;
    import real from 'pkg';
  `;

  const clean = stripCommentsAndStrings(code);
  assert.equal(clean.includes('import real from'), true);
  assert.equal(clean.includes('foo'), false);
  assert.equal(clean.includes('bar'), false);
  assert.equal(clean.includes('{ x }'), false);
  assert.equal(clean.includes('baz'), false);
});

test('module-system: detects TypeScript sources as mismatch', () => {
  const tempDir = createTempDir('mod-ts-');
  try {
    const tsFile = path.join(tempDir, 'cli.ts');
    fs.writeFileSync(tsFile, 'console.log("hello");');

    const analysis = analyzeModuleSystem(tsFile, {});
    assert.equal(analysis.isTypeScriptSource, true);
    assert.equal(analysis.hasMismatch, true);
    assert.equal(analysis.confidence, 'high');
  } finally {
    cleanupDir(tempDir);
  }
});

test('module-system: detects ESM syntax in commonjs package', () => {
  const tempDir = createTempDir('mod-esm-');
  try {
    const jsFile = path.join(tempDir, 'cli.js');
    fs.writeFileSync(jsFile, "import fs from 'node:fs';\nconsole.log(fs);");

    const analysis = analyzeModuleSystem(jsFile, { name: 'pkg' });
    assert.equal(analysis.detectedSyntax, 'esm');
    assert.equal(analysis.hasMismatch, true);
  } finally {
    cleanupDir(tempDir);
  }
});

test('module-system: detects CommonJS syntax in ESM package', () => {
  const tempDir = createTempDir('mod-cjs-');
  try {
    const jsFile = path.join(tempDir, 'cli.js');
    fs.writeFileSync(jsFile, "const fs = require('node:fs');\nmodule.exports = fs;");

    const analysis = analyzeModuleSystem(jsFile, { name: 'pkg', type: 'module' });
    assert.equal(analysis.detectedSyntax, 'cjs');
    assert.equal(analysis.hasMismatch, true);
  } finally {
    cleanupDir(tempDir);
  }
});

test('module-system: .mjs and .cjs extensions are respected without mismatch', () => {
  const tempDir = createTempDir('mod-ext-');
  try {
    const mjsFile = path.join(tempDir, 'cli.mjs');
    fs.writeFileSync(mjsFile, "import fs from 'node:fs';");

    const analysis = analyzeModuleSystem(mjsFile, { name: 'pkg' });
    assert.equal(analysis.hasMismatch, false);
    assert.equal(analysis.detectedSyntax, 'esm');
  } finally {
    cleanupDir(tempDir);
  }
});
