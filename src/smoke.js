import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, execFileSync } from 'node:child_process';
import { runNpm } from './npm-exec.js';
import { sanitizeString } from './sanitize.js';

const OUTPUT_CAP_BYTES = 64 * 1024; // 64 KB cap

/**
 * @typedef {Object} SmokeResult
 * @property {string} binName Command name tested
 * @property {number | null} exitCode Exit code of the child process
 * @property {string | null} signal Signal received (e.g. SIGTERM)
 * @property {boolean} timedOut Whether execution was terminated due to timeout
 * @property {string} stdout First lines of standard output (sanitized & capped)
 * @property {string} stderr First lines of standard error (sanitized & capped)
 * @property {boolean} shimExistsOnWindows True if .cmd shim created on Windows
 * @property {string} [error] Error message if test setup failed
 */

/**
 * Constructs an isolated minimal environment stripped of developer secrets.
 *
 * @param {string} tempBase Isolated sandbox directory
 * @returns {Record<string, string | undefined>}
 */
export function buildIsolatedEnv(tempBase) {
  const cacheDir = path.join(tempBase, 'npm-cache');
  fs.mkdirSync(cacheDir, { recursive: true });

  const minimalEnv = {
    PATH: process.env.PATH || '',
    SYSTEMROOT: process.env.SYSTEMROOT || '',
    COMSPEC: process.env.COMSPEC || '',
    PATHEXT: process.env.PATHEXT || '',
    NODE_ENV: 'test',
    HOME: tempBase,
    USERPROFILE: tempBase,
    npm_config_cache: cacheDir,
    TMPDIR: tempBase,
    TEMP: tempBase,
    TMP: tempBase
  };

  return minimalEnv;
}

/**
 * Kills a process tree safely across Windows and Unix.
 * @param {number} [pid]
 */
function killProcessTree(pid) {
  if (!pid) return;
  if (process.platform === 'win32') {
    try {
      execFileSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
    } catch {
      // ignore
    }
  } else {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // ignore
    }
  }
}

/**
 * Runs a smoke test on package binaries in an isolated sandbox.
 * NOTE: This executes package code and is intended for authors only.
 *
 * @param {string} packageDir Absolute root path of package
 * @param {string[]} [smokeArgs=['--help']] Arguments to pass to each binary
 * @param {number} [timeoutMs=5000] Execution timeout in milliseconds
 * @returns {Promise<SmokeResult[]>}
 */
export async function runSmokeTest(packageDir, smokeArgs = ['--help'], timeoutMs = 5000) {
  const tempBase = fs.mkdtempSync(path.join(os.tmpdir(), 'bincheck-smoke-'));

  try {
    const env = buildIsolatedEnv(tempBase);
    const tarballDir = path.join(tempBase, 'tarball');
    const consumerDir = path.join(tempBase, 'consumer');
    fs.mkdirSync(tarballDir, { recursive: true });
    fs.mkdirSync(consumerDir, { recursive: true });

    // 1. Pack package tarball into sandbox
    const packOut = runNpm(['pack', '--pack-destination', tarballDir, '--ignore-scripts'], {
      cwd: packageDir,
      env
    });

    const tarballFiles = fs.readdirSync(tarballDir).filter((/** @type {string} */ f) => f.endsWith('.tgz'));
    if (tarballFiles.length === 0) {
      throw new Error(`Failed to locate packed tarball in ${tarballDir}: ${packOut}`);
    }
    const tgzPath = path.join(tarballDir, tarballFiles[0]);

    // 2. Initialize consumer and install tarball
    fs.writeFileSync(
      path.join(consumerDir, 'package.json'),
      JSON.stringify({ name: 'bincheck-smoke-consumer', version: '1.0.0' }, null, 2)
    );

    runNpm(['install', '--ignore-scripts', tgzPath], {
      cwd: consumerDir,
      env
    });

    // 3. Inspect installed bin commands
    const binDir = path.join(consumerDir, 'node_modules', '.bin');
    if (!fs.existsSync(binDir)) {
      return [{
        binName: 'none',
        exitCode: null,
        signal: null,
        timedOut: false,
        stdout: '',
        stderr: 'No .bin directory was created during installation.',
        shimExistsOnWindows: false,
        error: 'Missing .bin directory in installed package'
      }];
    }

    const installedEntries = fs.readdirSync(binDir);
    const isWin = process.platform === 'win32';
    const targetCommands = new Set();

    for (const entry of installedEntries) {
      if (isWin) {
        if (entry.endsWith('.cmd')) {
          targetCommands.add(entry.slice(0, -4));
        }
      } else {
        if (!entry.endsWith('.cmd') && !entry.endsWith('.ps1')) {
          targetCommands.add(entry);
        }
      }
    }

    if (targetCommands.size === 0) {
      for (const entry of installedEntries) {
        targetCommands.add(entry.replace(/\.(cmd|ps1)$/, ''));
      }
    }

    const results = [];

    for (const binName of targetCommands) {
      const shimExists = isWin ? installedEntries.includes(`${binName}.cmd`) : true;
      const executablePath = path.join(binDir, isWin ? `${binName}.cmd` : binName);

      const smokeRes = await executeBinary(executablePath, smokeArgs, env, consumerDir, timeoutMs);
      results.push({
        binName,
        shimExistsOnWindows: shimExists,
        ...smokeRes
      });
    }

    return results;
  } finally {
    // 4. Always clean up temp directory
    try {
      fs.rmSync(tempBase, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

/**
 * Spawns the binary under restricted limits.
 *
 * @param {string} executablePath
 * @param {string[]} args
 * @param {Record<string, string | undefined>} env
 * @param {string} cwd
 * @param {number} timeoutMs
 * @returns {Promise<{ exitCode: number | null, signal: string | null, timedOut: boolean, stdout: string, stderr: string }>}
 */
function executeBinary(executablePath, args, env, cwd, timeoutMs) {
  return new Promise((resolve) => {
    let stdoutBuf = '';
    let stderrBuf = '';
    let timedOut = false;
    let finished = false;

    const isCmd = executablePath.endsWith('.cmd');
    let proc;

    if (isCmd) {
      const comspec = process.env.COMSPEC || 'cmd.exe';
      proc = spawn(comspec, ['/d', '/s', '/c', `"${executablePath}"`, ...args], {
        cwd,
        env,
        windowsVerbatimArguments: true,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe']
      });
    } else {
      proc = spawn(executablePath, args, {
        cwd,
        env,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe']
      });
    }

    const timer = setTimeout(() => {
      timedOut = true;
      if (proc.pid) {
        killProcessTree(proc.pid);
      }
      setTimeout(() => {
        if (!finished) {
          finished = true;
          try {
            proc.stdout?.destroy();
            proc.stderr?.destroy();
            proc.unref();
          } catch {}
          resolve({
            exitCode: 124,
            signal: 'SIGKILL',
            timedOut: true,
            stdout: sanitizeString(stdoutBuf.slice(0, 1000)),
            stderr: sanitizeString(stderrBuf.slice(0, 1000))
          });
        }
      }, 300);
    }, timeoutMs);
    try {
      const t = /** @type {any} */ (timer);
      if (t && typeof t.unref === 'function') {
        t.unref();
      }
    } catch {}

    proc.stdout?.on('data', (/** @type {Buffer} */ chunk) => {
      if (stdoutBuf.length < OUTPUT_CAP_BYTES) {
        stdoutBuf += chunk.toString('utf8');
      }
    });

    proc.stderr?.on('data', (/** @type {Buffer} */ chunk) => {
      if (stderrBuf.length < OUTPUT_CAP_BYTES) {
        stderrBuf += chunk.toString('utf8');
      }
    });

    proc.on('error', (/** @type {Error} */ err) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      try {
        proc.stdout?.destroy();
        proc.stderr?.destroy();
        proc.unref();
      } catch {}
      resolve({
        exitCode: 1,
        signal: null,
        timedOut: false,
        stdout: sanitizeString(stdoutBuf.slice(0, 1000)),
        stderr: sanitizeString(`Spawn error: ${err.message}`)
      });
    });

    proc.on('close', (/** @type {number | null} */ exitCode, /** @type {string | null} */ signal) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      try {
        proc.stdout?.destroy();
        proc.stderr?.destroy();
        proc.unref();
      } catch {}
      resolve({
        exitCode: timedOut ? 124 : exitCode,
        signal,
        timedOut,
        stdout: sanitizeString(stdoutBuf.slice(0, 1000)),
        stderr: sanitizeString(stderrBuf.slice(0, 1000))
      });
    });
  });
}
