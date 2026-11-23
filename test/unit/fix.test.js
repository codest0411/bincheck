import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fixShebang } from '../../src/fix.js';
import { createTempDir, cleanupDir } from '../helpers/test-utils.js';

test('fix: strips BOM and CRLF while preserving all other bytes exactly', () => {
  const tempDir = createTempDir('fix-bytes-');
  try {
    const filePath = path.join(tempDir, 'cli.js');
    const restOfBody = Buffer.from('const x = 1;\r\nconst y = 2;\n// comment\r\n');
    const badFile = Buffer.concat([
      Buffer.from([0xEF, 0xBB, 0xBF]),
      Buffer.from('#!/usr/bin/env node\r\n'),
      restOfBody
    ]);

    fs.writeFileSync(filePath, badFile);

    const res = fixShebang(tempDir, filePath);
    assert.equal(res.changed, true);
    assert.equal(res.removedBOM, true);
    assert.equal(res.removedCR, true);

    const fixed = fs.readFileSync(filePath);

    // Shebang is now LF without BOM
    const expectedFirstLine = Buffer.from('#!/usr/bin/env node\n');
    assert.deepEqual(fixed.subarray(0, expectedFirstLine.length), expectedFirstLine);

    // The remaining bytes of the file are byte-for-byte identical to the original
    assert.deepEqual(fixed.subarray(expectedFirstLine.length), restOfBody);

    // Idempotent on second run
    const res2 = fixShebang(tempDir, filePath);
    assert.equal(res2.changed, false);
  } finally {
    cleanupDir(tempDir);
  }
});

test('fix: leaves clean file unchanged', () => {
  const tempDir = createTempDir('fix-clean-');
  try {
    const filePath = path.join(tempDir, 'cli.js');
    fs.writeFileSync(filePath, '#!/usr/bin/env node\nconsole.log(1);\n');

    const res = fixShebang(tempDir, filePath);
    assert.equal(res.changed, false);
  } finally {
    cleanupDir(tempDir);
  }
});

test('fix: non-shebang file without BOM is left untouched', () => {
  const tempDir = createTempDir('fix-noshebang-');
  try {
    const filePath = path.join(tempDir, 'cli.js');
    fs.writeFileSync(filePath, 'const x = 1;\r\n');

    const res = fixShebang(tempDir, filePath);
    assert.equal(res.changed, false);
  } finally {
    cleanupDir(tempDir);
  }
});

test('fix: single line shebang without trailing newline is repaired', () => {
  const tempDir = createTempDir('fix-single-');
  try {
    const filePath = path.join(tempDir, 'cli.js');
    fs.writeFileSync(filePath, '#!/usr/bin/env node\r');

    const res = fixShebang(tempDir, filePath);
    assert.equal(res.changed, true);
    assert.equal(fs.readFileSync(filePath, 'utf8'), '#!/usr/bin/env node\n');
  } finally {
    cleanupDir(tempDir);
  }
});

test('fix: preserves file mode permissions', () => {
  const tempDir = createTempDir('fix-mode-');
  try {
    const filePath = path.join(tempDir, 'cli.js');
    fs.writeFileSync(filePath, '#!/usr/bin/env node\r\n');
    const originalMode = fs.statSync(filePath).mode;

    fixShebang(tempDir, filePath);

    const newMode = fs.statSync(filePath).mode;
    assert.equal(newMode, originalMode);
  } finally {
    cleanupDir(tempDir);
  }
});

test('fix: refuses to modify file outside package root', () => {
  const tempDir = createTempDir('fix-outside-');
  try {
    const outsideFile = path.join(tempDir, '..', 'outside.js');
    fs.writeFileSync(outsideFile, '#!/usr/bin/env node\r\n');

    assert.throws(
      () => fixShebang(tempDir, outsideFile),
      /outside package root/
    );

    try {
      if (fs.existsSync(outsideFile)) fs.unlinkSync(outsideFile);
    } catch {
      // ignore
    }
  } finally {
    cleanupDir(tempDir);
  }
});

test('fix: refuses to modify binary files', () => {
  const tempDir = createTempDir('fix-binary-');
  try {
    const binFile = path.join(tempDir, 'tool.exe');
    fs.writeFileSync(binFile, Buffer.from([0x00, 0x01, 0x02, 0x03]));

    assert.throws(
      () => fixShebang(tempDir, binFile),
      /non-text or binary/
    );
  } finally {
    cleanupDir(tempDir);
  }
});
