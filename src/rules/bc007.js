/**
 * BC007: Executable-bit state in Git index and filesystem.
 *
 * @param {import('../bin-entries.js').BinEntry} entry
 * @param {import('../git-index.js').GitIndexResult} indexResult
 * @returns {Array<import('./index.js').Finding>}
 */
export function checkBC007(entry, indexResult) {
  /** @type {Array<import('./index.js').Finding>} */
  const findings = [];

  if (indexResult.inGitRepo && indexResult.inIndex) {
    if (!indexResult.isExecutableInGit) {
      findings.push({
        id: 'BC007',
        severity: 'info',
        commandName: entry.name,
        file: entry.normalizedTarget,
        line: 1,
        title: 'Git index mode lacks executable bit (100644 instead of 100755)',
        evidence: `Git index mode for this file is ${indexResult.mode || '100644'}.`,
        whyItMatters: 'Note: npm install automatically grants executable permissions on Unix during bin linking. However, direct consumers of Git repositories, tarball extractors without npm, or alternative package managers might preserve 100644 mode and fail with "Permission denied".',
        fixAdvice: 'Mark the file executable in Git: "git update-index --chmod=+x ' + entry.normalizedTarget + '"'
      });
    }
  }

  return findings;
}
