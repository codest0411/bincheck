import fs from 'node:fs';
import path from 'node:path';

/**
 * BC001: A bin target does not exist on disk or is not included in the publish tarball.
 *
 * @param {import('../bin-entries.js').BinEntry} entry
 * @param {Set<string>} packFiles Set of POSIX normalized paths in tarball
 * @param {string} packageRoot
 * @returns {Array<import('./index.js').Finding>}
 */
export function checkBC001(entry, packFiles, packageRoot) {
  /** @type {Array<import('./index.js').Finding>} */
  const findings = [];

  if (entry.escapesRoot) {
    findings.push({
      id: 'BC001',
      severity: 'error',
      commandName: entry.name,
      file: entry.target,
      line: 1,
      title: 'Bin target path escapes package root',
      evidence: `Target path "${entry.target}" resolves outside package root directory.`,
      whyItMatters: 'Publishing paths that traverse outside package root causes installation failure and security boundary violations.',
      fixAdvice: 'Update package.json to point to a file inside the package root directory.'
    });
    return findings;
  }

  if (!entry.existsOnDisk) {
    findings.push({
      id: 'BC001',
      severity: 'error',
      commandName: entry.name,
      file: entry.target,
      line: 1,
      title: 'Bin target does not exist on disk',
      evidence: `File "${entry.target}" was declared in package.json but was not found on disk at "${entry.normalizedTarget}".`,
      whyItMatters: 'Users who install the package will receive a broken command symlink or shortcut pointing to a missing file.',
      fixAdvice: 'Ensure the source file exists or build artifacts are compiled before running bincheck or publishing.'
    });
    return findings;
  }

  // Check if included in packFiles
  if (!packFiles.has(entry.normalizedTarget)) {
    let exclusionReason = 'Check your "files" array in package.json, .npmignore, or .gitignore.';
    const pkgJsonPath = path.join(packageRoot, 'package.json');
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
      if (Array.isArray(pkg.files)) {
        exclusionReason = 'Your package.json "files" allowlist is configured, but does not include this bin file or its directory.';
      }
    } catch {
      // ignore
    }

    findings.push({
      id: 'BC001',
      severity: 'error',
      commandName: entry.name,
      file: entry.normalizedTarget,
      line: 1,
      title: 'Bin file is excluded from npm publish tarball',
      evidence: `File "${entry.normalizedTarget}" exists on disk, but npm pack would exclude it from the published tarball.`,
      whyItMatters: 'When published, npm tarball will not contain this file. Installing users will encounter missing file errors when running the command.',
      fixAdvice: `Add "${entry.normalizedTarget}" or its parent directory to the "files" array in package.json. ${exclusionReason}`
    });
  }

  return findings;
}
