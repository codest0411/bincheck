/**
 * Sanitizes untrusted strings originating from package files or manifests.
 * Prevents ANSI injection, terminal control code attacks, and format corruption.
 */

const ANSI_REGEX = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
const CONTROL_CHARS_REGEX = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g;

/**
 * Strips ANSI escapes and control characters from untrusted strings.
 *
 * @param {string} input Untrusted input
 * @returns {string} Sanitized string safe for terminal printing
 */
export function sanitizeString(input) {
  if (typeof input !== 'string') {
    return '';
  }
  return input
    .replace(ANSI_REGEX, '')
    .replace(CONTROL_CHARS_REGEX, '');
}

/**
 * Normalizes any Windows backslashes into POSIX forward slashes for consistent reporting.
 *
 * @param {string} filePath File path to normalize
 * @returns {string} POSIX-style relative path
 */
export function normalizePath(filePath) {
  if (typeof filePath !== 'string') return '';
  return filePath.replace(/\\/g, '/');
}

/**
 * Escapes characters for GitHub Actions workflow commands (::error::, ::warning::).
 * Ref: https://github.com/actions/toolkit/blob/main/packages/core/src/command.ts
 *
 * @param {string} str Message string
 * @returns {string} Escaped string
 */
export function escapeGitHubWorkflow(str) {
  return sanitizeString(str)
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A')
    .replace(/:/g, '%3A')
    .replace(/,/g, '%2C');
}
