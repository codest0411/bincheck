import test from 'node:test';
import assert from 'node:assert/strict';
import { parseShebangFromBuffer } from '../../src/shebang.js';

test('shebang: standard #!/usr/bin/env node with LF', () => {
  const buf = Buffer.from('#!/usr/bin/env node\nconsole.log(1);');
  const res = parseShebangFromBuffer(buf);

  assert.equal(res.hasShebang, true);
  assert.equal(res.hasBOM, false);
  assert.equal(res.hasCR, false);
  assert.equal(res.lineEnding, 'LF');
  assert.equal(res.isPortableNode, true);
  assert.equal(res.interpreter, 'node');
  assert.equal(res.usesEnv, true);
});

test('shebang: CRLF line ending detected', () => {
  const buf = Buffer.from('#!/usr/bin/env node\r\nconsole.log(1);');
  const res = parseShebangFromBuffer(buf);

  assert.equal(res.hasShebang, true);
  assert.equal(res.hasCR, true);
  assert.equal(res.lineEnding, 'CRLF');
});

test('shebang: UTF-8 BOM before shebang detected', () => {
  const buf = Buffer.concat([
    Buffer.from([0xEF, 0xBB, 0xBF]),
    Buffer.from('#!/usr/bin/env node\n')
  ]);
  const res = parseShebangFromBuffer(buf);

  assert.equal(res.hasBOM, true);
  assert.equal(res.hasShebang, true);
  assert.equal(res.isPortableNode, true);
});

test('shebang: BOM and CRLF combined', () => {
  const buf = Buffer.concat([
    Buffer.from([0xEF, 0xBB, 0xBF]),
    Buffer.from('#!/usr/bin/env node\r\n')
  ]);
  const res = parseShebangFromBuffer(buf);

  assert.equal(res.hasBOM, true);
  assert.equal(res.hasCR, true);
  assert.equal(res.lineEnding, 'CRLF');
});

test('shebang: empty buffer', () => {
  const res = parseShebangFromBuffer(Buffer.alloc(0));
  assert.equal(res.hasShebang, false);
  assert.equal(res.hasBOM, false);
});

test('shebang: only #!', () => {
  const res = parseShebangFromBuffer(Buffer.from('#!'));
  assert.equal(res.hasShebang, true);
  assert.equal(res.cleanShebang, '');
});

test('shebang: space after #! and env flags', () => {
  const buf = Buffer.from('#! /usr/bin/env -S node --inspect\n');
  const res = parseShebangFromBuffer(buf);

  assert.equal(res.hasShebang, true);
  assert.equal(res.usesEnv, true);
  assert.equal(res.usesEnvSplit, true);
  assert.equal(res.interpreter, 'node');
  assert.deepEqual(res.args, ['--inspect']);
});

test('shebang: absolute interpreter path', () => {
  const buf = Buffer.from('#!/usr/local/bin/node\n');
  const res = parseShebangFromBuffer(buf);

  assert.equal(res.isAbsoluteInterpreter, true);
  assert.equal(res.interpreter, '/usr/local/bin/node');
});

test('shebang: fuzz random buffers never throw', () => {
  const random = (size) => {
    const b = Buffer.alloc(size);
    for (let i = 0; i < size; i++) {
      b[i] = Math.floor(Math.random() * 256);
    }
    return b;
  };

  const start = Date.now();
  for (let i = 0; i < 500; i++) {
    const size = Math.floor(Math.random() * 2000);
    const buf = random(size);
    assert.doesNotThrow(() => parseShebangFromBuffer(buf));
  }
  const duration = Date.now() - start;
  assert.ok(duration < 2000, `Fuzz took too long: ${duration}ms`);
});
