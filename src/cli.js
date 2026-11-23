import path from 'node:path';
import fs from 'node:fs';
import { parseArgs } from 'node:util';
import { audit } from './index.js';
import { renderHuman } from './reporters/human.js';
import { renderJson } from './reporters/json.js';
import { renderGitHub } from './reporters/github.js';
import { renderSarif } from './reporters/sarif.js';
import { sanitizeString } from './sanitize.js';

const HELP_TEXT = `
Usage: bincheck [path] [options]

Audit npm package bin entries, shebangs, line endings, and publish tarball inclusion.

Options:
  --format <type>       Output format: human, json, github, sarif (default: human)
  --fail-on <severity>  Exit 1 if findings meet threshold: error, warn, never (default: error)
  --fix                 Atomically repair CRLF and BOM in shebangs
  --smoke               Run binaries with --help in an isolated sandbox (executes package code)
  --smoke-args <args>   Space-separated arguments for smoke test (default: --help)
  --config <path>       Path to .bincheckrc.json configuration file
  --no-color            Disable ANSI color output
  -v, --version         Show bincheck version
  -h, --help            Show this help message

Exit codes:
  0  Clean (no findings at or above fail-on threshold)
  1  Findings detected at or above fail-on threshold
  2  Usage error or unhandled runtime failure
`;

/**
 * Runs the bincheck CLI.
 *
 * @param {string[]} argv Process arguments
 * @returns {Promise<number>} Exit code
 */
export async function runCli(argv = process.argv.slice(2)) {
  const optionsConfig = {
    format: { type: /** @type {const} */ ('string'), default: 'human' },
    'fail-on': { type: /** @type {const} */ ('string'), default: 'error' },
    fix: { type: /** @type {const} */ ('boolean'), default: false },
    smoke: { type: /** @type {const} */ ('boolean'), default: false },
    'smoke-args': { type: /** @type {const} */ ('string'), default: '--help' },
    config: { type: /** @type {const} */ ('string') },
    'no-color': { type: /** @type {const} */ ('boolean'), default: false },
    help: { type: /** @type {const} */ ('boolean'), short: 'h', default: false },
    version: { type: /** @type {const} */ ('boolean'), short: 'v', default: false }
  };

  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      options: optionsConfig,
      allowPositionals: true
    });
  } catch (err) {
    console.error(`bincheck: Argument error - ${err instanceof Error ? err.message : String(err)}`);
    console.error('Run "bincheck --help" for usage.');
    return 2;
  }

  const { values, positionals } = parsed;

  if (values.help) {
    console.log(HELP_TEXT.trim());
    return 0;
  }

  if (values.version) {
    const pkgPath = new URL('../package.json', import.meta.url);
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      console.log(`bincheck v${pkg.version}`);
      return 0;
    } catch {
      console.log('bincheck v0.1.0');
      return 0;
    }
  }

  const targetDir = positionals[0] || process.cwd();
  const format = values.format || 'human';
  const failOn = /** @type {'error' | 'warn' | 'never'} */ (values['fail-on'] || 'error');

  if (!['human', 'json', 'github', 'sarif'].includes(format)) {
    console.error(`bincheck: Unknown format "${format}". Supported formats: human, json, github, sarif.`);
    return 2;
  }

  if (!['error', 'warn', 'never'].includes(failOn)) {
    console.error(`bincheck: Unknown fail-on severity "${failOn}". Supported: error, warn, never.`);
    return 2;
  }

  try {
    const auditResult = await audit(targetDir, {
      config: values.config,
      failOn,
      fix: values.fix,
      smoke: values.smoke,
      smokeArgs: values['smoke-args'] ? values['smoke-args'].split(/\s+/).filter(Boolean) : ['--help']
    });

    if (auditResult.fixResults.length > 0 && format === 'human') {
      console.log(`[bincheck --fix] Successfully repaired ${auditResult.fixResults.length} file(s):`);
      for (const res of auditResult.fixResults) {
        console.log(`  ✔ ${res.file}: ${res.message}`);
      }
      console.log('');
    }

    if (values.smoke && format === 'human') {
      console.log('[bincheck --smoke] Smoke test execution results:');
      for (const smoke of auditResult.smokeResults) {
        const status = smoke.exitCode === 0 ? 'PASS' : `FAIL (exit ${smoke.exitCode})`;
        console.log(`  • Command "${smoke.binName}": ${status}`);
        if (smoke.stderr) {
          console.log(`    stderr: ${smoke.stderr.split('\n')[0]}`);
        }
      }
      console.log('');
    }

    let output = '';
    switch (format) {
      case 'json':
        output = renderJson(auditResult.findings, { targetDir: sanitizeString(path.resolve(targetDir)) });
        break;
      case 'github':
        output = renderGitHub(auditResult.findings);
        break;
      case 'sarif':
        output = renderSarif(auditResult.findings);
        break;
      case 'human':
      default:
        output = renderHuman(auditResult.findings, { noColor: values['no-color'] });
        break;
    }

    if (output) {
      console.log(output);
    }

    return auditResult.exitCode;
  } catch (err) {
    console.error(`bincheck: ${err instanceof Error ? err.message : String(err)}`);
    return 2;
  }
}
