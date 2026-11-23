/**
 * BC002: First line of bin script is not a valid shebang.
 *
 * @param {import('../bin-entries.js').BinEntry} entry
 * @param {import('../shebang.js').ShebangInfo} shebangInfo
 * @returns {Array<import('./index.js').Finding>}
 */
export function checkBC002(entry, shebangInfo) {
  if (shebangInfo.hasShebang) {
    return [];
  }

  return [{
    id: 'BC002',
    severity: 'error',
    commandName: entry.name,
    file: entry.normalizedTarget,
    line: 1,
    title: 'Missing shebang line',
    evidence: shebangInfo.rawLine.trim()
      ? `First line starts with: "${shebangInfo.rawLine.slice(0, 60).replace(/\r?\n/, '')}"`
      : 'File is empty or does not begin with #!.',
    whyItMatters: 'Operating systems cannot determine which interpreter to run without a shebang. On Unix, executing the script fails with format errors. On Windows, npm cmd-shim omits the node.exe executable wrapper.',
    fixAdvice: 'Add "#!/usr/bin/env node" as the very first line of the file.'
  }];
}
