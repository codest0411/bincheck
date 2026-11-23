/**
 * BC010: Summary manifest of all bin entries analyzed.
 *
 * @param {import('../bin-entries.js').BinEntry[]} entries
 * @param {Set<string>} packFiles
 * @param {Map<string, import('../shebang.js').ShebangInfo>} shebangMap
 * @returns {Array<import('./index.js').Finding>}
 */
export function checkBC010(entries, packFiles, shebangMap) {
  if (entries.length === 0) {
    return [{
      id: 'BC010',
      severity: 'info',
      commandName: 'none',
      file: 'package.json',
      line: 1,
      title: 'No bin entries declared',
      evidence: 'No "bin" or "directories.bin" entries found in package.json.',
      whyItMatters: 'This package does not expose any CLI executables.',
      fixAdvice: 'If this package is intended as a library only, no action is needed.'
    }];
  }

  const rows = [];
  for (const entry of entries) {
    const shebangInfo = shebangMap.get(entry.normalizedTarget);
    const inTarball = packFiles.has(entry.normalizedTarget) ? 'YES' : 'NO';
    const shebangText = shebangInfo?.hasShebang ? shebangInfo.cleanShebang : '(none)';
    const eolText = shebangInfo?.lineEnding || '(unknown)';

    rows.push(`${entry.name} -> ${entry.normalizedTarget} [shebang: ${shebangText}, eol: ${eolText}, in-tarball: ${inTarball}]`);
  }

  return [{
    id: 'BC010',
    severity: 'info',
    commandName: entries[0]?.name || 'summary',
    file: 'package.json',
    line: 1,
    title: `Bin manifest summary (${entries.length} ${entries.length === 1 ? 'command' : 'commands'})`,
    evidence: rows.join('; '),
    whyItMatters: 'Overview of all binaries, shebangs, line endings, and publish inclusion status.',
    fixAdvice: 'Review the manifest summary table to confirm published commands.'
  }];
}
