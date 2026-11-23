import { execFileSync } from 'node:child_process';

/**
 * @typedef {Object} GitAttrResult
 * @property {boolean} inGitRepo Whether directory is inside a valid git repository
 * @property {Record<string, string>} attributes Map of attribute names to values
 * @property {boolean} isEnforcedLf True if eol=lf or explicit LF rule is active
 * @property {string} [error] Error description if git command fails
 */

/**
 * Checks git attributes for a specific file using git check-attr.
 *
 * @param {string} repoDir Root directory of package/repository
 * @param {string} relativeFilePath Relative path to the target file
 * @returns {GitAttrResult}
 */
export function checkGitAttributes(repoDir, relativeFilePath) {
  try {
    const stdout = execFileSync('git', ['check-attr', '-a', '--', relativeFilePath], {
      cwd: repoDir,
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
      shell: false
    });

    /** @type {Record<string, string>} */
    const attributes = {};
    const lines = stdout.split('\n');
    for (const line of lines) {
      const parts = line.split(':');
      if (parts.length >= 3) {
        const attrName = parts[1].trim();
        const attrVal = parts.slice(2).join(':').trim();
        attributes[attrName] = attrVal;
      }
    }

    const eolVal = attributes['eol'];
    const isEnforcedLf = eolVal === 'lf';

    return {
      inGitRepo: true,
      attributes,
      isEnforcedLf
    };
  } catch (err) {
    return {
      inGitRepo: false,
      attributes: {},
      isEnforcedLf: false,
      error: err instanceof Error ? err.message : String(err)
    };
  }
}
