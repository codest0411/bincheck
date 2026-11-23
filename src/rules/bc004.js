/**
 * BC004: UTF-8 Byte Order Mark (BOM) detected before shebang.
 *
 * @param {import('../bin-entries.js').BinEntry} entry
 * @param {import('../shebang.js').ShebangInfo} shebangInfo
 * @returns {Array<import('./index.js').Finding>}
 */
export function checkBC004(entry, shebangInfo) {
  if (!shebangInfo.hasBOM) {
    return [];
  }

  return [{
    id: 'BC004',
    severity: 'error',
    commandName: entry.name,
    file: entry.normalizedTarget,
    line: 1,
    title: 'UTF-8 BOM detected before shebang',
    evidence: 'File begins with byte sequence 0xEF 0xBB 0xBF (UTF-8 Byte Order Mark).',
    whyItMatters: 'Operating systems require "#!" at byte 0. When a BOM precedes it, the kernel fails with ENOEXEC (Exec format error). Additionally, npm install fails to identify or fix line endings because buffer[0] is not "#".',
    fixAdvice: 'Remove the UTF-8 BOM (run "bincheck --fix" or save as UTF-8 without BOM in your editor).'
  }];
}
