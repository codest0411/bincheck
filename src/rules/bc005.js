/**
 * BC005: Non-portable shebang interpreter path or unusual flags.
 *
 * @param {import('../bin-entries.js').BinEntry} entry
 * @param {import('../shebang.js').ShebangInfo} shebangInfo
 * @returns {Array<import('./index.js').Finding>}
 */
export function checkBC005(entry, shebangInfo) {
  if (!shebangInfo.hasShebang) {
    return [];
  }

  /** @type {Array<import('./index.js').Finding>} */
  const findings = [];

  if (shebangInfo.isAbsoluteInterpreter) {
    findings.push({
      id: 'BC005',
      severity: 'warn',
      commandName: entry.name,
      file: entry.normalizedTarget,
      line: 1,
      title: 'Non-portable absolute interpreter path in shebang',
      evidence: `Shebang uses absolute path: "#!${shebangInfo.interpreter}".`,
      whyItMatters: 'Hardcoded absolute paths like /usr/bin/node or /usr/local/bin/node fail on environments where Node.js is installed in alternate locations (such as NixOS, Alpine, FreeBSD, or user version managers like nvm and fnm).',
      fixAdvice: 'Change shebang to portable format: "#!/usr/bin/env node".'
    });
  } else if (shebangInfo.usesEnvSplit) {
    // env -S is used
    findings.push({
      id: 'BC005',
      severity: 'info',
      commandName: entry.name,
      file: entry.normalizedTarget,
      line: 1,
      title: 'Shebang uses "env -S" for split arguments',
      evidence: `Shebang: "#!${shebangInfo.rawLine.trim()}".`,
      whyItMatters: '"env -S" was standardized in POSIX.1-2024 and is supported in GNU Coreutils >= 8.30 (2018), macOS >= 10.15, and FreeBSD. However, ultra-minimal systems (e.g. standard BusyBox) may not support -S.',
      fixAdvice: 'If broad compatibility with embedded or legacy environments is needed, pass flags via node configuration or command-line wrappers instead of "env -S".'
    });
  } else if (shebangInfo.usesEnv && shebangInfo.interpreter !== 'node') {
    findings.push({
      id: 'BC005',
      severity: 'warn',
      commandName: entry.name,
      file: entry.normalizedTarget,
      line: 1,
      title: 'Unusual interpreter specified in shebang',
      evidence: `Interpreter invoked via env is "${shebangInfo.interpreter}" rather than "node".`,
      whyItMatters: 'npm CLI packages are expected to run under the Node.js runtime. Running another interpreter may require extra host dependencies.',
      fixAdvice: 'Verify that this script is intended to run under this specific interpreter.'
    });
  }

  return findings;
}
