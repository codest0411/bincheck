/**
 * BC008: Bin file line endings not enforced to LF by .gitattributes.
 *
 * @param {import('../bin-entries.js').BinEntry} entry
 * @param {import('../gitattrs.js').GitAttrResult} attrResult
 * @returns {Array<import('./index.js').Finding>}
 */
export function checkBC008(entry, attrResult) {
  if (attrResult.inGitRepo && !attrResult.isEnforcedLf) {
    return [{
      id: 'BC008',
      severity: 'warn',
      commandName: entry.name,
      file: entry.normalizedTarget,
      line: 1,
      title: 'Line ending not enforced to LF in .gitattributes',
      evidence: `Git attributes for "${entry.normalizedTarget}" do not enforce eol=lf (current attributes: ${JSON.stringify(attrResult.attributes)}).`,
      whyItMatters: 'If git core.autocrlf is enabled on Windows checkouts, git will convert LF to CRLF in working copies. When an author publishes from a Windows machine with CRLF checkouts, npm publishes the corrupted CRLF shebang directly into the release tarball.',
      fixAdvice: 'Add the following line to your .gitattributes file:\n  ' + entry.normalizedTarget + ' text eol=lf'
    }];
  }

  return [];
}
