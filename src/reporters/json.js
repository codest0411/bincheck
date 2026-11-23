import { sanitizeString } from '../sanitize.js';

/**
 * Renders findings as structured JSON.
 *
 * @param {import('../rules/index.js').Finding[]} findings
 * @param {Object} [meta={}]
 * @returns {string}
 */
export function renderJson(findings, meta = {}) {
  const sanitized = findings.map(f => ({
    id: f.id,
    severity: f.severity,
    commandName: sanitizeString(f.commandName),
    file: sanitizeString(f.file),
    line: f.line,
    title: sanitizeString(f.title),
    evidence: sanitizeString(f.evidence),
    whyItMatters: sanitizeString(f.whyItMatters),
    fixAdvice: sanitizeString(f.fixAdvice),
    ignored: f.ignored || false,
    ignoreReason: f.ignoreReason ? sanitizeString(f.ignoreReason) : undefined
  }));

  const payload = {
    generator: 'bincheck',
    timestamp: new Date().toISOString(),
    meta,
    counts: {
      total: findings.length,
      errors: findings.filter(f => !f.ignored && f.severity === 'error').length,
      warnings: findings.filter(f => !f.ignored && f.severity === 'warn').length,
      info: findings.filter(f => !f.ignored && f.severity === 'info').length,
      ignored: findings.filter(f => f.ignored).length
    },
    findings: sanitized
  };

  return JSON.stringify(payload, null, 2);
}
