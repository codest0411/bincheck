import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

/**
 * Creates a unique isolated temporary directory.
 * @param {string} prefix
 * @returns {string} Absolute path
 */
export function createTempDir(prefix = 'bincheck-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/**
 * Cleans up directory recursively.
 * @param {string} dir
 */
export function cleanupDir(dir) {
  try {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    }
  } catch {
    // Ignore cleanup errors on busy Windows files
  }
}

/**
 * Creates a fully isolated test git repository with synthetic config.
 * @param {string} targetDir
 */
export function initIsolatedGitRepo(targetDir) {
  const env = {
    ...process.env,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: path.join(targetDir, '.gitconfig-isolated'),
    HOME: targetDir,
    USERPROFILE: targetDir
  };

  execFileSync('git', ['init', '-b', 'main'], { cwd: targetDir, env, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.name', 'Test Agent'], { cwd: targetDir, env, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'test@example.invalid'], { cwd: targetDir, env, stdio: 'ignore' });
  execFileSync('git', ['config', 'core.autocrlf', 'false'], { cwd: targetDir, env, stdio: 'ignore' });

  return env;
}

/**
 * Creates a test package with given files and package.json.
 * @param {string} dir
 * @param {Record<string, any>} pkgJson
 * @param {Record<string, string | Buffer>} files Map of relative paths to contents
 */
export function writePackageFiles(dir, pkgJson, files = {}) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkgJson, null, 2), 'utf8');

  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = path.join(dir, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    if (Buffer.isBuffer(content)) {
      fs.writeFileSync(fullPath, content);
    } else {
      fs.writeFileSync(fullPath, content, 'utf8');
    }
  }
}
