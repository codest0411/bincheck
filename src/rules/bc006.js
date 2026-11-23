/**
 * BC006: Module system mismatch between bin script syntax and package.json configuration.
 *
 * @param {import('../bin-entries.js').BinEntry} entry
 * @param {import('../module-system.js').ModuleSystemAnalysis} analysis
 * @returns {Array<import('./index.js').Finding>}
 */
export function checkBC006(entry, analysis) {
  /** @type {Array<import('./index.js').Finding>} */
  const findings = [];

  if (analysis.isTypeScriptSource) {
    findings.push({
      id: 'BC006',
      severity: 'error',
      commandName: entry.name,
      file: entry.normalizedTarget,
      line: 1,
      title: 'Uncompiled TypeScript file specified as bin target',
      evidence: `Bin target points directly to TypeScript file: ${entry.normalizedTarget}`,
      whyItMatters: analysis.details,
      fixAdvice: 'Compile TypeScript sources to JavaScript in a build step and point package.json "bin" to the built .js file.'
    });
    return findings;
  }

  if (analysis.hasMismatch) {
    findings.push({
      id: 'BC006',
      severity: 'error',
      commandName: entry.name,
      file: entry.normalizedTarget,
      line: 1,
      title: `Module system syntax mismatch (${analysis.confidence} confidence)`,
      evidence: analysis.details,
      whyItMatters: 'Mismatched module systems cause immediate runtime fatal errors when users execute the command.',
      fixAdvice: analysis.packageType === 'commonjs'
        ? 'Either add `"type": "module"` to package.json, rename the file to `.mjs`, or convert syntax to CommonJS (`require`).'
        : 'Either remove `"type": "module"` from package.json, rename the file to `.cjs`, or convert syntax to ESM (`import`).'
    });
  }

  return findings;
}
