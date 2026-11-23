import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

/**
 * Discovers the absolute path to npm-cli.js without executing a shell.
 * Prioritizes process.env.npm_execpath when available, falling back to
 * known locations relative to process.execPath.
 *
 * @param {Record<string, string | undefined>} [env=process.env]
 * @param {string} [nodePath=process.execPath]
 * @returns {string} Absolute path to npm-cli.js
 * @throws {Error} If npm-cli.js cannot be located
 */
export function resolveNpmCli(env = process.env, nodePath = process.execPath) {
  // 1. Check npm_execpath provided by npm / npx runner
  if (env.npm_execpath && typeof env.npm_execpath === 'string') {
    if (fs.existsSync(env.npm_execpath)) {
      return env.npm_execpath;
    }
  }

  // 2. Candidate paths based on Node.js installation directory
  const nodeDir = path.dirname(nodePath);
  const candidates = [
    // Standard Windows installation layout
    path.join(nodeDir, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    // Standard Unix / macOS installation layout
    path.join(nodeDir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.join(nodeDir, '..', 'lib', 'npm', 'bin', 'npm-cli.js'),
    // Global fallback paths
    '/usr/local/lib/node_modules/npm/bin/npm-cli.js',
    '/usr/lib/node_modules/npm/bin/npm-cli.js'
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error('Unable to locate npm-cli.js. Please ensure npm is installed or set npm_execpath.');
}

/**
 * Runs npm CLI safely using process.execPath directly without spawning a shell.
 * Guarantees a writable cache directory in os.tmpdir() to avoid permission conflicts.
 *
 * @param {string[]} args Command-line arguments to pass to npm
 * @param {import('node:child_process').ExecFileSyncOptions} [options={}]
 * @returns {string} Standard output from npm
 */
export function runNpm(args, options = {}) {
  const tmpCache = path.join(os.tmpdir(), 'bincheck-shared-npm-cache');
  try {
    fs.mkdirSync(tmpCache, { recursive: true });
  } catch {
    // ignore
  }

  const callerEnv = options.env || {};
  const mergedEnv = Object.assign({}, process.env, callerEnv, {
    npm_config_cache: tmpCache,
    NPM_CONFIG_CACHE: tmpCache
  });

  const hasCacheArg = args.some(a => a === '--cache' || a.startsWith('--cache='));
  const finalArgs = hasCacheArg ? args : ['--cache', tmpCache].concat(args);

  const npmCli = resolveNpmCli(mergedEnv);
  const baseExecOptions = {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    timeout: 30000
  };
  const execOptions = Object.assign(baseExecOptions, options, {
    env: mergedEnv,
    shell: false
  });

  return execFileSync(process.execPath, [npmCli].concat(finalArgs), execOptions);
}
