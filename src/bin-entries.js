import fs from 'node:fs';
import path from 'node:path';
import { normalizePath } from './sanitize.js';

/**
 * @typedef {Object} BinEntry
 * @property {string} name Command name exposed to users
 * @property {string} target Relative path to the bin file as declared in package.json
 * @property {string} normalizedTarget POSIX-normalized relative path from package root
 * @property {string} absolutePath Absolute path on disk
 * @property {boolean} escapesRoot Whether the target path resolves outside package root
 * @property {boolean} existsOnDisk Whether the file exists on disk
 * @property {boolean} isSymlink Whether the file is a symbolic link
 * @property {boolean} isRegularFile Whether the file is a regular file
 * @property {number} size File size in bytes (0 if not on disk)
 * @property {string} [error] Error description if path is invalid
 */

/**
 * Extracts and validates all declared bin entries from a package.json object.
 * Supports string `bin`, object `bin`, and `directories.bin`.
 *
 * @param {string} packageDir Absolute root path of the package
 * @param {Record<string, any>} pkgJson Parsed package.json object
 * @returns {BinEntry[]} List of bin targets
 */
export function extractBinEntries(packageDir, pkgJson) {
  const resolvedRoot = path.resolve(packageDir);
  /** @type {BinEntry[]} */
  const entries = [];

  /**
   * Helper to resolve and assess a single bin target.
   * @param {string} name Command name
   * @param {string} target Declared file path
   */
  function registerEntry(name, target) {
    if (typeof target !== 'string' || !target.trim()) {
      entries.push({
        name,
        target: String(target),
        normalizedTarget: '',
        absolutePath: '',
        escapesRoot: false,
        existsOnDisk: false,
        isSymlink: false,
        isRegularFile: false,
        size: 0,
        error: 'Target path must be a non-empty string'
      });
      return;
    }

    const trimmed = target.trim();
    const resolvedTarget = path.resolve(resolvedRoot, trimmed);
    const relFromRoot = path.relative(resolvedRoot, resolvedTarget);
    const escapes = relFromRoot.startsWith('..') || path.isAbsolute(relFromRoot);
    const norm = normalizePath(relFromRoot);

    let exists = false;
    let isSymlink = false;
    let isRegularFile = false;
    let size = 0;
    let error;

    if (!escapes) {
      try {
        const lstat = fs.lstatSync(resolvedTarget);
        exists = true;
        isSymlink = lstat.isSymbolicLink();
        isRegularFile = lstat.isFile();
        size = lstat.size;

        if (isSymlink) {
          // Verify symlink destination does not escape package root
          try {
            const real = fs.realpathSync(resolvedTarget);
            const realRel = path.relative(resolvedRoot, real);
            if (realRel.startsWith('..') || path.isAbsolute(realRel)) {
              error = 'Symbolic link target escapes package root directory';
            }
          } catch (e) {
            error = `Broken symlink target: ${e instanceof Error ? e.message : String(e)}`;
          }
        }
      } catch {
        exists = false;
      }
    } else {
      error = 'Target path escapes the package root directory';
    }

    entries.push({
      name,
      target: trimmed,
      normalizedTarget: norm,
      absolutePath: resolvedTarget,
      escapesRoot: escapes,
      existsOnDisk: exists,
      isSymlink,
      isRegularFile,
      size,
      error
    });
  }

  // 1. Check "bin" as string
  if (typeof pkgJson.bin === 'string') {
    let defaultName = pkgJson.name || 'unnamed-bin';
    if (defaultName.startsWith('@') && defaultName.includes('/')) {
      defaultName = defaultName.split('/')[1];
    }
    registerEntry(defaultName, pkgJson.bin);
  } else if (pkgJson.bin && typeof pkgJson.bin === 'object' && !Array.isArray(pkgJson.bin)) {
    // 2. Check "bin" as object dictionary
    for (const [name, target] of Object.entries(pkgJson.bin)) {
      registerEntry(name, target);
    }
  }

  // 3. Check "directories.bin"
  if (pkgJson.directories && typeof pkgJson.directories.bin === 'string') {
    const dirBinPath = path.resolve(resolvedRoot, pkgJson.directories.bin);
    const relDir = path.relative(resolvedRoot, dirBinPath);
    if (!relDir.startsWith('..') && fs.existsSync(dirBinPath)) {
      try {
        const files = fs.readdirSync(dirBinPath);
        for (const file of files) {
          const fullPath = path.join(dirBinPath, file);
          const stat = fs.statSync(fullPath);
          if (stat.isFile()) {
            registerEntry(file, path.relative(resolvedRoot, fullPath));
          }
        }
      } catch {
        // Silently continue if directory unreadable
      }
    }
  }

  return entries;
}
