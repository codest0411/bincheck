import test from 'node:test';
import assert from 'node:assert/strict';
import { renderHuman } from '../../src/reporters/human.js';
import { renderJson } from '../../src/reporters/json.js';
import { renderGitHub } from '../../src/reporters/github.js';
import { renderSarif } from '../../src/reporters/sarif.js';

const mockFindings = [
  {
    id: 'BC003',
    severity: /** @type {'error'} */ ('error'),
    commandName: 'cli',
    file: 'bin/cli.js',
    line: 1,
    title: 'CRLF shebang: special characters % \r \n ::',
    evidence: 'Shebang ends with \r\n',
    whyItMatters: 'Breaks execution on Linux',
    fixAdvice: 'Convert to LF',
    ignored: false
  },
  {
    id: 'BC008',
    severity: /** @type {'warn'} */ ('warn'),
    commandName: 'cli',
    file: 'bin/cli.js',
    line: 1,
    title: 'Missing LF in .gitattributes',
    evidence: 'No eol=lf',
    whyItMatters: 'Checkout risk',
    fixAdvice: 'Add eol=lf',
    ignored: false
  }
];

test('reporters: renderHuman produces readable output', () => {
  const out = renderHuman(mockFindings, { noColor: true });
  assert.ok(out.includes('=== bincheck audit report ==='));
  assert.ok(out.includes('[ERROR]'));
  assert.ok(out.includes('[WARN] '));
  assert.ok(out.includes('Summary: 1 error(s), 1 warning(s)'));
});

test('reporters: renderJson produces valid JSON with correct counts', () => {
  const jsonStr = renderJson(mockFindings);
  const parsed = JSON.parse(jsonStr);

  assert.equal(parsed.generator, 'bincheck');
  assert.equal(parsed.counts.errors, 1);
  assert.equal(parsed.counts.warnings, 1);
  assert.equal(parsed.findings.length, 2);
});

test('reporters: renderGitHub escapes workflow control characters', () => {
  const gh = renderGitHub(mockFindings);
  assert.ok(gh.includes('::error file=bin/cli.js,line=1,title=[BC003] '));
  // Control characters must be percent-encoded
  assert.ok(!gh.includes('\r'));
  assert.ok(gh.includes('%25'));
  assert.ok(gh.includes('%3A'));
});

test('reporters: renderSarif produces compliant SARIF v2.1.0 log', () => {
  const sarifStr = renderSarif(mockFindings);
  const sarif = JSON.parse(sarifStr);

  assert.equal(sarif.version, '2.1.0');
  assert.equal(sarif.runs.length, 1);
  assert.equal(sarif.runs[0].results.length, 2);
  assert.equal(sarif.runs[0].results[0].ruleId, 'BC003');
});
