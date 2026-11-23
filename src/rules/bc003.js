/**
 * BC003: Carriage return (\r) present on shebang line (CRLF).
 *
 * @param {import('../bin-entries.js').BinEntry} entry
 * @param {import('../shebang.js').ShebangInfo} shebangInfo
 * @returns {Array<import('./index.js').Finding>}
 */
export function checkBC003(entry, shebangInfo) {
  if (!shebangInfo.hasCR) {
    return [];
  }

  return [{
    id: 'BC003',
    severity: 'error',
    commandName: entry.name,
    file: entry.normalizedTarget,
    line: 1,
    title: 'CRLF carriage return detected in shebang line',
    evidence: `Shebang line ends with CR+LF (\\r\\n) instead of LF (\\n).`,
    whyItMatters: 'On Linux and macOS, the kernel does not trim \\r from the interpreter path. It invokes "/usr/bin/env node\\r", which immediately crashes with "env: node\\r: No such file or directory".',
    fixAdvice: 'Convert line endings to LF (run "bincheck --fix" or use your editor to save with LF), and enforce LF in .gitattributes.'
  }];
}
