const SYSTEM_COMMANDS = new Set([
  'cd', 'ls', 'dir', 'cp', 'mv', 'rm', 'cat', 'grep', 'find', 'sed', 'awk',
  'echo', 'test', 'kill', 'ps', 'top', 'curl', 'wget', 'ssh', 'sudo', 'su',
  'sh', 'bash', 'zsh', 'node', 'npm', 'npx', 'git', 'pnpm', 'yarn'
]);

/**
 * BC009: Bin command name issues (system shadowing, unusual characters, or duplicate targets).
 *
 * @param {import('../bin-entries.js').BinEntry} entry
 * @param {import('../bin-entries.js').BinEntry[]} allEntries
 * @returns {Array<import('./index.js').Finding>}
 */
export function checkBC009(entry, allEntries) {
  /** @type {Array<import('./index.js').Finding>} */
  const findings = [];
  const name = entry.name.toLowerCase();

  // 1. Check for shadowing system command
  if (SYSTEM_COMMANDS.has(name)) {
    findings.push({
      id: 'BC009',
      severity: 'info',
      commandName: entry.name,
      file: entry.normalizedTarget,
      line: 1,
      title: `Command name "${entry.name}" shadows a common system executable`,
      evidence: `The bin command "${entry.name}" is a known standard OS/tool command.`,
      whyItMatters: 'Global installations of this package could override the user\'s standard shell utility, causing unexpected behavior or security issues in scripts.',
      fixAdvice: 'Consider choosing a distinctive name or prefix for your CLI.'
    });
  }

  // 2. Check for unusual characters (spaces, leading dashes, non-alphanumeric except dash/underscore)
  if (/^[-\s]/.test(entry.name) || /[^a-zA-Z0-9_-]/.test(entry.name)) {
    findings.push({
      id: 'BC009',
      severity: 'info',
      commandName: entry.name,
      file: entry.normalizedTarget,
      line: 1,
      title: `Command name "${entry.name}" contains unusual characters or leading punctuation`,
      evidence: `Bin command name "${entry.name}" contains spaces, leading dashes, or non-alphanumeric characters.`,
      whyItMatters: 'Unusual command names can complicate shell autocompletion, script invocation, or cross-platform alias creation.',
      fixAdvice: 'Use lowercase alphanumeric characters separated by hyphens (e.g. "my-cli").'
    });
  }

  // 3. Duplicate targets check
  const duplicates = allEntries.filter(e => e !== entry && e.normalizedTarget === entry.normalizedTarget);
  if (duplicates.length > 0) {
    findings.push({
      id: 'BC009',
      severity: 'info',
      commandName: entry.name,
      file: entry.normalizedTarget,
      line: 1,
      title: `Duplicate bin target path shared by multiple commands`,
      evidence: `Both "${entry.name}" and "${duplicates.map(d => d.name).join(', ')}" point to "${entry.normalizedTarget}".`,
      whyItMatters: 'Having multiple bin names pointing to the same file is supported by npm, but may be unintentional.',
      fixAdvice: 'Verify if multiple aliases pointing to the identical target are intended.'
    });
  }

  return findings;
}
