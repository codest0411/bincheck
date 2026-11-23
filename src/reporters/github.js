import { escapeGitHubWorkflow } from '../sanitize.js';

/**
 * Formats findings for GitHub Actions workflow annotations.
 *
 * @param {import('../rules/index.js').Finding[]} findings
 * @returns {string}
 */
export function renderGitHub(findings) {
  const lines = [];

  for (const finding of findings) {
    if (finding.ignored) continue;

    const level = finding.severity === 'error'
      ? 'error'
      : finding.severity === 'warn'
        ? 'warning'
        : 'notice';

    const file = escapeGitHubWorkflow(finding.file);
    const line = finding.line || 1;
    const title = escapeGitHubWorkflow(`[${finding.id}] ${finding.title}`);
    const message = escapeGitHubWorkflow(`${finding.evidence} - ${finding.whyItMatters} Fix: ${finding.fixAdvice}`);

    lines.push(`::${level} file=${file},line=${line},title=${title}::${message}`);
  }

  return lines.join('\n');
}
