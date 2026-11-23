import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { runAllRules } from '../../src/rules/index.js';
import { checkBC001 } from '../../src/rules/bc001.js';
import { checkBC002 } from '../../src/rules/bc002.js';
import { checkBC003 } from '../../src/rules/bc003.js';
import { checkBC004 } from '../../src/rules/bc004.js';
import { checkBC005 } from '../../src/rules/bc005.js';
import { checkBC006 } from '../../src/rules/bc006.js';
import { checkBC007 } from '../../src/rules/bc007.js';
import { checkBC008 } from '../../src/rules/bc008.js';
import { checkBC009 } from '../../src/rules/bc009.js';
import { checkBC010 } from '../../src/rules/bc010.js';
import { createTempDir, cleanupDir, writePackageFiles, initIsolatedGitRepo } from '../helpers/test-utils.js';

test('rules: healthy package produces no errors or warnings', () => {
  const tempDir = createTempDir('rules-healthy-');
  try {
    initIsolatedGitRepo(tempDir);
    writePackageFiles(tempDir, {
      name: 'healthy-cli',
      version: '1.0.0',
      type: 'module',
      bin: { 'healthy-cli': './bin/cli.js' },
      files: ['bin/']
    }, {
      'bin/cli.js': '#!/usr/bin/env node\nconsole.log("hello");\n',
      '.gitattributes': 'bin/* text eol=lf\n'
    });

    const findings = runAllRules({
      packageRoot: tempDir,
      packageJson: { name: 'healthy-cli', type: 'module', bin: { 'healthy-cli': './bin/cli.js' }, files: ['bin/'] },
      binEntries: [
        {
          name: 'healthy-cli',
          target: './bin/cli.js',
          normalizedTarget: 'bin/cli.js',
          absolutePath: path.join(tempDir, 'bin/cli.js'),
          escapesRoot: false,
          existsOnDisk: true,
          isSymlink: false,
          isRegularFile: true,
          size: 40
        }
      ],
      packFiles: new Set(['bin/cli.js', 'package.json'])
    });

    const errors = findings.filter(f => f.severity === 'error');
    const warnings = findings.filter(f => f.severity === 'warn');

    assert.equal(errors.length, 0);
    assert.equal(warnings.length, 0);
  } finally {
    cleanupDir(tempDir);
  }
});

test('rules: direct invocation of BC002, BC003, BC004', () => {
  const entry = {
    name: 'cli',
    target: './cli.js',
    normalizedTarget: 'cli.js',
    absolutePath: 'D:/pkg/cli.js',
    escapesRoot: false,
    existsOnDisk: true,
    isSymlink: false,
    isRegularFile: true,
    size: 20
  };

  // BC002
  assert.equal(checkBC002(entry, { hasShebang: true }).length, 0);
  const f2 = checkBC002(entry, { hasShebang: false, rawLine: 'not a shebang' });
  assert.equal(f2[0].id, 'BC002');

  // BC003
  assert.equal(checkBC003(entry, { hasCR: false }).length, 0);
  const f3 = checkBC003(entry, { hasCR: true });
  assert.equal(f3[0].id, 'BC003');

  // BC004
  assert.equal(checkBC004(entry, { hasBOM: false }).length, 0);
  const f4 = checkBC004(entry, { hasBOM: true });
  assert.equal(f4[0].id, 'BC004');

  // BC008
  assert.equal(checkBC008(entry, { inGitRepo: false }).length, 0);
  assert.equal(checkBC008(entry, { inGitRepo: true, isEnforcedLf: true }).length, 0);
  const f8 = checkBC008(entry, { inGitRepo: true, isEnforcedLf: false, attributes: {} });
  assert.equal(f8[0].id, 'BC008');
});

test('rules: BC001 branches (missing, excluded by files array, escapes root)', () => {
  const tempDir = createTempDir('rules-bc001-');
  try {
    writePackageFiles(tempDir, {
      name: 'pkg',
      files: ['src/']
    }, {
      'bin/cli.js': 'console.log(1);'
    });

    // 1. Escapes root
    const escapesEntry = {
      name: 'bad',
      target: '../outside.js',
      normalizedTarget: '',
      absolutePath: '',
      escapesRoot: true,
      existsOnDisk: false,
      isSymlink: false,
      isRegularFile: false,
      size: 0
    };
    const f1 = checkBC001(escapesEntry, new Set(), tempDir);
    assert.equal(f1[0].id, 'BC001');
    assert.ok(f1[0].title.includes('escapes package root'));

    // 2. Missing on disk
    const missingEntry = {
      name: 'missing',
      target: './missing.js',
      normalizedTarget: 'missing.js',
      absolutePath: path.join(tempDir, 'missing.js'),
      escapesRoot: false,
      existsOnDisk: false,
      isSymlink: false,
      isRegularFile: false,
      size: 0
    };
    const f2 = checkBC001(missingEntry, new Set(), tempDir);
    assert.equal(f2[0].id, 'BC001');
    assert.ok(f2[0].title.includes('does not exist on disk'));

    // 3. Exists on disk but excluded from tarball
    const excludedEntry = {
      name: 'cli',
      target: './bin/cli.js',
      normalizedTarget: 'bin/cli.js',
      absolutePath: path.join(tempDir, 'bin/cli.js'),
      escapesRoot: false,
      existsOnDisk: true,
      isSymlink: false,
      isRegularFile: true,
      size: 15
    };
    const f3 = checkBC001(excludedEntry, new Set(['src/index.js']), tempDir);
    assert.equal(f3[0].id, 'BC001');
    assert.ok(f3[0].title.includes('excluded from npm publish tarball'));
  } finally {
    cleanupDir(tempDir);
  }
});

test('rules: BC005 branches (env -S, unusual interpreter, absolute path)', () => {
  const entry = {
    name: 'cli',
    target: './cli.js',
    normalizedTarget: 'cli.js',
    absolutePath: 'D:/pkg/cli.js',
    escapesRoot: false,
    existsOnDisk: true,
    isSymlink: false,
    isRegularFile: true,
    size: 20
  };

  // 1. env -S
  const f1 = checkBC005(entry, {
    hasShebang: true,
    hasBOM: false,
    hasCR: false,
    rawLine: '#!/usr/bin/env -S node --inspect',
    cleanShebang: '/usr/bin/env -S node --inspect',
    interpreter: 'node',
    args: ['--inspect'],
    usesEnv: true,
    usesEnvSplit: true,
    isPortableNode: false,
    isAbsoluteInterpreter: false,
    lineEnding: 'LF',
    isBinary: false
  });
  assert.equal(f1[0].id, 'BC005');
  assert.equal(f1[0].severity, 'info');

  // 2. Unusual interpreter (e.g. python)
  const f2 = checkBC005(entry, {
    hasShebang: true,
    hasBOM: false,
    hasCR: false,
    rawLine: '#!/usr/bin/env python3',
    cleanShebang: '/usr/bin/env python3',
    interpreter: 'python3',
    args: [],
    usesEnv: true,
    usesEnvSplit: false,
    isPortableNode: false,
    isAbsoluteInterpreter: false,
    lineEnding: 'LF',
    isBinary: false
  });
  assert.equal(f2[0].id, 'BC005');
  assert.equal(f2[0].severity, 'warn');
  assert.ok(f2[0].title.includes('Unusual interpreter'));

  // 3. Absolute interpreter path
  const f3 = checkBC005(entry, {
    hasShebang: true,
    hasBOM: false,
    hasCR: false,
    rawLine: '#!/usr/bin/node',
    cleanShebang: '/usr/bin/node',
    interpreter: '/usr/bin/node',
    args: [],
    usesEnv: false,
    usesEnvSplit: false,
    isPortableNode: false,
    isAbsoluteInterpreter: true,
    lineEnding: 'LF',
    isBinary: false
  });
  assert.equal(f3[0].id, 'BC005');
  assert.equal(f3[0].severity, 'warn');

  // 4. No shebang returns empty
  assert.equal(checkBC005(entry, { hasShebang: false }).length, 0);
});

test('rules: BC006 branches (uncompiled TS, syntax mismatch)', () => {
  const entry = {
    name: 'cli',
    target: './cli.ts',
    normalizedTarget: 'cli.ts',
    absolutePath: 'D:/pkg/cli.ts',
    escapesRoot: false,
    existsOnDisk: true,
    isSymlink: false,
    isRegularFile: true,
    size: 20
  };

  // 1. TypeScript uncompiled
  const f1 = checkBC006(entry, {
    isTypeScriptSource: true,
    packageType: 'module',
    detectedSyntax: 'ambiguous',
    hasMismatch: true,
    confidence: 'high',
    details: 'Uncompiled TypeScript'
  });
  assert.equal(f1[0].id, 'BC006');
  assert.ok(f1[0].title.includes('Uncompiled TypeScript'));

  // 2. Syntax mismatch in CommonJS package
  const f2 = checkBC006(entry, {
    isTypeScriptSource: false,
    packageType: 'commonjs',
    detectedSyntax: 'esm',
    hasMismatch: true,
    confidence: 'high',
    details: 'ESM syntax in CommonJS package'
  });
  assert.equal(f2[0].id, 'BC006');
  assert.ok(f2[0].title.includes('Module system syntax mismatch'));

  // 3. Syntax mismatch in ESM package
  const f3 = checkBC006(entry, {
    isTypeScriptSource: false,
    packageType: 'module',
    detectedSyntax: 'cjs',
    hasMismatch: true,
    confidence: 'high',
    details: 'CJS syntax in ESM package'
  });
  assert.equal(f3[0].id, 'BC006');
  assert.ok(f3[0].fixAdvice.includes('remove `"type": "module"`'));
});

test('rules: BC007 non-executable Git index mode', () => {
  const entry = {
    name: 'cli',
    target: './cli.js',
    normalizedTarget: 'cli.js',
    absolutePath: 'D:/pkg/cli.js',
    escapesRoot: false,
    existsOnDisk: true,
    isSymlink: false,
    isRegularFile: true,
    size: 20
  };

  const f = checkBC007(entry, {
    inGitRepo: true,
    inIndex: true,
    mode: '100644',
    isExecutableInGit: false,
    isExecutableOnDisk: false
  });
  assert.equal(f[0].id, 'BC007');
  assert.ok(f[0].title.includes('100644 instead of 100755'));

  assert.equal(checkBC007(entry, { inGitRepo: false }).length, 0);
  assert.equal(checkBC007(entry, { inGitRepo: true, inIndex: true, isExecutableInGit: true }).length, 0);
});

test('rules: BC009 shadowing system command, unusual characters, duplicate target', () => {
  const entry1 = {
    name: 'ls',
    target: './cli.js',
    normalizedTarget: 'cli.js',
    absolutePath: 'D:/pkg/cli.js',
    escapesRoot: false,
    existsOnDisk: true,
    isSymlink: false,
    isRegularFile: true,
    size: 20
  };

  const entry2 = {
    name: '-bad command!',
    target: './cli.js',
    normalizedTarget: 'cli.js',
    absolutePath: 'D:/pkg/cli.js',
    escapesRoot: false,
    existsOnDisk: true,
    isSymlink: false,
    isRegularFile: true,
    size: 20
  };

  const f = checkBC009(entry1, [entry1, entry2]);
  assert.ok(f.some(item => item.title.includes('shadows a common system executable')));
  assert.ok(f.some(item => item.title.includes('Duplicate bin target path')));

  const fBad = checkBC009(entry2, [entry2]);
  assert.ok(fBad.some(item => item.title.includes('unusual characters')));
});

test('rules: BC010 handles empty entries list and populated entries', () => {
  const empty = checkBC010([], new Set(), new Map());
  assert.equal(empty[0].id, 'BC010');
  assert.ok(empty[0].title.includes('No bin entries declared'));

  const entry = {
    name: 'tool',
    target: './cli.js',
    normalizedTarget: 'cli.js',
    absolutePath: 'D:/pkg/cli.js',
    escapesRoot: false,
    existsOnDisk: true,
    isSymlink: false,
    isRegularFile: true,
    size: 20
  };
  const populated = checkBC010([entry], new Set(['cli.js']), new Map([['cli.js', { hasShebang: true, cleanShebang: '/usr/bin/env node', lineEnding: 'LF' }]]));
  assert.equal(populated[0].id, 'BC010');
  assert.ok(populated[0].evidence.includes('tool -> cli.js'));
});

test('rules: ignoreMap suppresses findings with justification', () => {
  const tempDir = createTempDir('rules-ignore-');
  try {
    initIsolatedGitRepo(tempDir);
    writePackageFiles(tempDir, {
      name: 'ignore-test',
      bin: { 'bad': './cli.js' }
    }, {
      'cli.js': 'console.log(1);\n'
    });

    const ignoreMap = new Map();
    ignoreMap.set('BC002', 'We run this with an external loader');

    const findings = runAllRules({
      packageRoot: tempDir,
      packageJson: { name: 'ignore-test', bin: { 'bad': './cli.js' } },
      binEntries: [
        {
          name: 'bad',
          target: './cli.js',
          normalizedTarget: 'cli.js',
          absolutePath: path.join(tempDir, 'cli.js'),
          escapesRoot: false,
          existsOnDisk: true,
          isSymlink: false,
          isRegularFile: true,
          size: 20
        }
      ],
      packFiles: new Set(['cli.js']),
      ignoreMap
    });

    const bc002 = findings.find(f => f.id === 'BC002');
    assert.ok(bc002);
    assert.equal(bc002.ignored, true);
    assert.equal(bc002.ignoreReason, 'We run this with an external loader');
  } finally {
    cleanupDir(tempDir);
  }
});
