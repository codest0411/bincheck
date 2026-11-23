import { runNpm } from './npm-exec.js';
import { normalizePath } from './sanitize.js';

/**
 * @typedef {Object} PackFileInfo
 * @property {string} path POSIX-normalized relative file path
 * @property {number} size File size in bytes
 * @property {number} [mode] File permissions mode
 */

/**
 * @typedef {Object} PackListResult
 * @property {Set<string>} files Set of normalized relative paths in the dry-run tarball
 * @property {PackFileInfo[]} fileDetails Detailed file descriptors from npm pack
 * @property {string} packageName Package name from dry-run manifest
 * @property {string} version Package version from dry-run manifest
 */

/**
 * Runs npm pack --dry-run --json --ignore-scripts to inspect exact tarball contents.
 *
 * @param {string} packageDir Absolute path to package directory
 * @param {Record<string, string | undefined>} [env] Environment variables
 * @returns {PackListResult} File list and package information
 */
export function getPackList(packageDir, env = process.env) {
  let stdout;
  try {
    stdout = runNpm(['pack', '--dry-run', '--json', '--ignore-scripts'], {
      cwd: packageDir,
      env
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to inspect package tarball with npm pack: ${errorMsg}`);
  }

  // Extract JSON payload even if npm prints notices/warnings
  const firstBracket = stdout.indexOf('[');
  const lastBracket = stdout.lastIndexOf(']');
  if (firstBracket === -1 || lastBracket === -1 || lastBracket < firstBracket) {
    throw new Error('npm pack --dry-run --json did not return valid JSON array.');
  }

  const jsonText = stdout.slice(firstBracket, lastBracket + 1);
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    throw new Error(`Failed to parse npm pack JSON output: ${e instanceof Error ? e.message : String(e)}`);
  }

  const packData = Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : null;
  if (!packData || !Array.isArray(packData.files)) {
    throw new Error('Unexpected npm pack JSON structure: missing files list.');
  }

  const filesSet = new Set();
  const fileDetails = [];

  for (const file of packData.files) {
    if (file && typeof file.path === 'string') {
      const norm = normalizePath(file.path);
      filesSet.add(norm);
      fileDetails.push({
        path: norm,
        size: typeof file.size === 'number' ? file.size : 0,
        mode: typeof file.mode === 'number' ? file.mode : undefined
      });
    }
  }

  return {
    files: filesSet,
    fileDetails,
    packageName: packData.name || '',
    version: packData.version || ''
  };
}
