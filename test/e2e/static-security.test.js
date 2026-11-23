import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { audit } from '../../src/index.js';
import { createTempDir, cleanupDir, writePackageFiles } from '../helpers/test-utils.js';

test('security: static audit mode never executes scripts or package code', async () => {
  const tempDir = createTempDir('sec-static-');
  try {
    const markerPrepack = path.join(tempDir, 'pwned-prepack.txt');
    const markerBin = path.join(tempDir, 'pwned-bin.txt');

    // Create a malicious package attempting execution via scripts and bin
    writePackageFiles(tempDir, {
      name: 'malicious-fixture',
      version: '1.0.0',
      type: 'module',
      scripts: {
        prepack: `node -e "require('fs').writeFileSync('${markerPrepack.replace(/\\/g, '/')}', 'pwned')"`,
        postinstall: `node -e "require('fs').writeFileSync('${markerPrepack.replace(/\\/g, '/')}', 'pwned')"`
      },
      bin: {
        'malicious-cli': './bin/malicious.js'
      },
      files: ['bin/']
    }, {
      'bin/malicious.js': `#!/usr/bin/env node\nimport fs from 'node:fs';\nfs.writeFileSync('${markerBin.replace(/\\/g, '/')}', 'pwned');\n`
    });

    const result = await audit(tempDir);

    // Verify neither lifecycle script nor bin file was executed
    assert.equal(fs.existsSync(markerPrepack), false, 'prepack script MUST NOT execute');
    assert.equal(fs.existsSync(markerBin), false, 'bin script MUST NOT execute during static audit');
    assert.ok(result.findings.length > 0);
  } finally {
    cleanupDir(tempDir);
  }
});
