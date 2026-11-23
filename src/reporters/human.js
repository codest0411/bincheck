import { sanitizeString } from '../sanitize.js';

/**
 * Renders findings in human-readable terminal output.
 *
 * @param {import('../rules/index.js').Finding[]} findings
 * @param {Object} options
 * @param {boolean} [options.noColor=false]
 * @returns {string}
 */
export function renderHuman(findings, options = {}) {
  const noColor = options.noColor || false;

  const c = {
    red: (/** @type {string} */ s) => (noColor ? s : `\x1b[31m${s}\x1b[0m`),
    yellow: (/** @type {string} */ s) => (noColor ? s : `\x1b[33m${s}\x1b[0m`),
    blue: (/** @type {string} */ s) => (noColor ? s : `\x1b[34m${s}\x1b[0m`),
    dim: (/** @type {string} */ s) => (noColor ? s : `\x1b[2m${s}\x1b[0m`),
    bold: (/** @type {string} */ s) => (noColor ? s : `\x1b[1m${s}\x1b[0m`),
    green: (/** @type {string} */ s) => (noColor ? s : `\x1b[32m${s}\x1b[0m`)
  };

  const lines = [];
  lines.push('');
  lines.push(c.bold('=== bincheck audit report ==='));
  lines.push('');

  let errorCount = 0;
  let warnCount = 0;
  let infoCount = 0;
  let ignoredCount = 0;

  for (const finding of findings) {
    if (finding.ignored) {
      ignoredCount++;
      continue;
    }

    if (finding.severity === 'error') errorCount++;
    else if (finding.severity === 'warn') warnCount++;
    else if (finding.severity === 'info') infoCount++;

    const badge = finding.severity === 'error'
      ? c.red('[ERROR]')
      : finding.severity === 'warn'
        ? c.yellow('[WARN] ')
        : c.blue('[INFO] ');

    const titleStr = sanitizeString(finding.title);
    const idStr = c.dim(`(${finding.id})`);
    const fileLoc = c.dim(`${sanitizeString(finding.file)}:${finding.line}`);

    lines.push(`${badge} ${c.bold(titleStr)} ${idStr}`);
    lines.push(`        File:     ${fileLoc} [cmd: ${sanitizeString(finding.commandName)}]`);
    lines.push(`        Evidence: ${sanitizeString(finding.evidence)}`);
    if (finding.severity !== 'info') {
      lines.push(`        Impact:   ${sanitizeString(finding.whyItMatters)}`);
      lines.push(`        Fix:      ${c.bold(sanitizeString(finding.fixAdvice))}`);
    }
    lines.push('');
  }

  const summaryParts = [];
  if (errorCount > 0) summaryParts.push(c.red(`${errorCount} error(s)`));
  if (warnCount > 0) summaryParts.push(c.yellow(`${warnCount} warning(s)`));
  if (infoCount > 0) summaryParts.push(c.blue(`${infoCount} note(s)`));
  if (ignoredCount > 0) summaryParts.push(c.dim(`${ignoredCount} ignored`));

  if (errorCount === 0 && warnCount === 0) {
    lines.push(c.green('✔ No critical bin issues detected.'));
  } else {
    lines.push(`Summary: ${summaryParts.join(', ')}`);
  }
  lines.push('');

  return lines.join('\n');
}
