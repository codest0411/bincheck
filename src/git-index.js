import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

/**
 * @typedef {Object} GitIndexResult
 * @property {boolean} inGitRepo Whether in a git repo
 * @property {boolean} inIndex Whether file is tracked in the git staging/index
 * @property {string} mode Git mode (e.g. "100755" or "100644")
 * @property {boolean} isExecutableInGit True if mode is 100755
 * @property {boolean} isExecutableOnDisk True if executable bit set on disk (Unix)
 */

/**
 * Inspects file permissions in both Git index and the local working tree.
 *
 * @param {string} repoDir Root directory of repository
 * @param {string} relativeFilePath Relative path to target file
 * @param {string} absoluteFilePath Absolute path to file on disk
 * @param {string} [platform=process.platform] Platform override for testing
 * @returns {GitIndexResult}
 */
export function checkGitIndex(repoDir, relativeFilePath, absoluteFilePath, platform = process.platform) {
  let isExecutableOnDisk = false;
  try {
    const stat = fs.statSync(absoluteFilePath);
    if (platform !== 'win32') {
      // Check user, group, or other exec bit on Unix
      isExecutableOnDisk = (stat.mode & 0o111) !== 0;
    }
  } catch {
    // leave as false
  }

  try {
    const stdout = execFileSync('git', ['ls-files', '-s', '--', relativeFilePath], {
      cwd: repoDir,
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
      shell: false
    });

    const trimmed = stdout.trim();
    if (!trimmed) {
      return {
        inGitRepo: true,
        inIndex: false,
        mode: '',
        isExecutableInGit: false,
        isExecutableOnDisk
      };
    }

    // Format: <mode> <hash> <stage>\t<path>
    const mode = trimmed.split(' ')[0] || '';
    const isExecutableInGit = mode === '100755';

    return {
      inGitRepo: true,
      inIndex: true,
      mode,
      isExecutableInGit,
      isExecutableOnDisk
    };
  } catch {
    return {
      inGitRepo: false,
      inIndex: false,
      mode: '',
      isExecutableInGit: false,
      isExecutableOnDisk
    };
  }
}
