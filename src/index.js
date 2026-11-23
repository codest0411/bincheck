import fs from 'node:fs';
import path from 'node:path';
import { getPackList } from './pack-list.js';
import { extractBinEntries } from './bin-entries.js';
import { inspectShebang } from './shebang.js';
import { fixShebang } from './fix.js';
import { runSmokeTest } from './smoke.js';
import { loadConfig } from './config.js';
import { runAllRules } from './rules/index.js';
import { renderHuman } from './reporters/human.js';
import { renderJson } from './reporters/json.js';
import { renderGitHub } from './reporters/github.js';
import { renderSarif } from './reporters/sarif.js';

/**
 * @typedef {Object} AuditOptions
 * @property {string} [config] Explicit path to config file
 * @property {'error' | 'warn' | 'never'} [failOn] Severity threshold causing failure
 * @property {boolean} [fix=false] Atomically repair CRLF and BOM in shebangs
 * @property {boolean} [smoke=false] Execute smoke test on binaries in isolated sandbox
 * @property {string[]} [smokeArgs=['--help']] Arguments for smoke test
 * @property {number} [timeoutMs=5000] Timeout for smoke tests
 */

/**
 * Programmatic API to audit an npm package for bin and shebang errors.
 *
 * @param {string} [targetDir=process.cwd()] Directory containing package.json
 * @param {AuditOptions} [options={}]
 */
export async function audit(targetDir = process.cwd(), options = {}) {
  const resolvedDir = path.resolve(targetDir);
  const pkgPath = path.join(resolvedDir, 'package.json');

  if (!fs.existsSync(pkgPath)) {
    throw new Error(`Directory does not contain a package.json file: ${resolvedDir}`);
  }

  let pkgJson;
  try {
    pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch (err) {
    throw new Error(`Failed to read or parse package.json: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Load configuration
  const config = loadConfig(options.config, resolvedDir);
  const effectiveFailOn = options.failOn || config.failOn || 'error';

  // 1. Pack list inspection via dry-run
  const packResult = getPackList(resolvedDir);

  // 2. Extract bin entries
  const binEntries = extractBinEntries(resolvedDir, pkgJson);

  // 3. Optional --fix
  const fixResults = [];
  if (options.fix) {
    for (const entry of binEntries) {
      if (entry.existsOnDisk && !entry.escapesRoot && entry.isRegularFile) {
        try {
          const res = fixShebang(resolvedDir, entry.absolutePath);
          if (res.changed) {
            fixResults.push({ file: entry.normalizedTarget, ...res });
          }
        } catch {
          // ignore fix error, rules will report it
        }
      }
    }
  }

  // 4. Run rules
  const findings = runAllRules({
    packageRoot: resolvedDir,
    packageJson: pkgJson,
    binEntries,
    packFiles: packResult.files,
    ignoreMap: config.ignore
  });

  // 5. Optional --smoke
  /** @type {import('./smoke.js').SmokeResult[]} */
  let smokeResults = [];
  if (options.smoke) {
    smokeResults = await runSmokeTest(resolvedDir, options.smokeArgs || ['--help'], options.timeoutMs || 5000);
  }

  // Determine exit code
  let exitCode = 0;
  if (effectiveFailOn !== 'never') {
    const hasFailErrors = findings.some(f => !f.ignored && f.severity === 'error');
    const hasFailWarns = findings.some(f => !f.ignored && f.severity === 'warn');

    if (effectiveFailOn === 'error' && hasFailErrors) {
      exitCode = 1;
    } else if (effectiveFailOn === 'warn' && (hasFailErrors || hasFailWarns)) {
      exitCode = 1;
    }
  }

  if (options.smoke && smokeResults.some(s => s.exitCode !== 0 || s.timedOut)) {
    exitCode = 1;
  }

  return {
    packageRoot: resolvedDir,
    packageJson: pkgJson,
    binEntries,
    packResult,
    findings,
    fixResults,
    smokeResults,
    exitCode
  };
}

export {
  getPackList,
  extractBinEntries,
  inspectShebang,
  fixShebang,
  runSmokeTest,
  loadConfig,
  runAllRules,
  renderHuman,
  renderJson,
  renderGitHub,
  renderSarif
};
