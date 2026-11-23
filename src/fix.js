import fs from 'node:fs';
import path from 'node:path';

const MAX_FIX_SIZE = 5 * 1024 * 1024; // 5 MB size cap

/**
 * @typedef {Object} FixResult
 * @property {boolean} changed Whether any byte modification was made
 * @property {boolean} removedBOM True if UTF-8 BOM was stripped
 * @property {boolean} removedCR True if CR was removed from the shebang line
 * @property {string} message Summary message of action taken
 */

/**
 * Safely repairs CR and BOM on the shebang line of a bin file atomically.
 *
 * @param {string} packageRoot Absolute path to root of the package
 * @param {string} absoluteFilePath Absolute path to file to repair
 * @returns {FixResult}
 */
export function fixShebang(packageRoot, absoluteFilePath) {
  const resolvedRoot = path.resolve(packageRoot);
  const resolvedFile = path.resolve(absoluteFilePath);

  // 1. Root boundary check
  const rel = path.relative(resolvedRoot, resolvedFile);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`Refusing to fix file outside package root: ${absoluteFilePath}`);
  }

  // 2. Symlink and file type check via lstat
  let stat;
  try {
    stat = fs.lstatSync(resolvedFile);
  } catch (err) {
    throw new Error(`Cannot stat file for fix: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (stat.isSymbolicLink()) {
    throw new Error(`Refusing to fix symbolic link: ${absoluteFilePath}`);
  }

  if (!stat.isFile()) {
    throw new Error(`Refusing to fix non-regular file: ${absoluteFilePath}`);
  }

  if (stat.size > MAX_FIX_SIZE) {
    throw new Error(`File size (${stat.size} bytes) exceeds maximum fix size limit of ${MAX_FIX_SIZE} bytes.`);
  }

  const rawBytes = fs.readFileSync(resolvedFile);

  // 3. Binary file check (null byte inspection in first 1024 bytes)
  for (let i = 0; i < Math.min(rawBytes.length, 1024); i++) {
    if (rawBytes[i] === 0x00) {
      throw new Error(`Refusing to fix non-text or binary file: ${absoluteFilePath}`);
    }
  }

  // 4. Check for BOM
  let hasBOM = false;
  let dataOffset = 0;
  if (rawBytes.length >= 3 && rawBytes[0] === 0xEF && rawBytes[1] === 0xBB && rawBytes[2] === 0xBF) {
    hasBOM = true;
    dataOffset = 3;
  }

  // 5. Scan first line for shebang and CRLF
  let lineEndIdx = -1;
  let hasCR = false;

  for (let i = dataOffset; i < rawBytes.length; i++) {
    if (rawBytes[i] === 0x0A) { // \n
      lineEndIdx = i;
      if (i > dataOffset && rawBytes[i - 1] === 0x0D) {
        hasCR = true;
      }
      break;
    } else if (rawBytes[i] === 0x0D) { // \r
      hasCR = true;
      if (i + 1 < rawBytes.length && rawBytes[i + 1] === 0x0A) {
        lineEndIdx = i + 1;
      } else {
        lineEndIdx = i;
      }
      break;
    }
  }

  if (!hasBOM && !hasCR) {
    return {
      changed: false,
      removedBOM: false,
      removedCR: false,
      message: 'File already has clean LF shebang and no BOM.'
    };
  }

  // Check if first line starts with #!
  const firstLineBytes = lineEndIdx !== -1
    ? rawBytes.subarray(dataOffset, lineEndIdx + 1)
    : rawBytes.subarray(dataOffset);

  const firstLineStr = firstLineBytes.toString('utf8');
  if (!firstLineStr.trimStart().startsWith('#!')) {
    // Not a shebang file, do not touch line endings
    if (!hasBOM) {
      return {
        changed: false,
        removedBOM: false,
        removedCR: false,
        message: 'No shebang present and no BOM detected; leaving file unchanged.'
      };
    }
  }

  // Build fixed buffer
  const chunks = [];

  if (lineEndIdx !== -1) {
    // Strip trailing \r and \n from first line, then append single \n
    let cleanFirstLine = firstLineStr.replace(/[\r\n]+$/, '') + '\n';
    chunks.push(Buffer.from(cleanFirstLine, 'utf8'));

    // Append remainder of file completely untouched
    if (lineEndIdx + 1 < rawBytes.length) {
      chunks.push(rawBytes.subarray(lineEndIdx + 1));
    }
  } else {
    // Single line without newline
    let cleanFirstLine = firstLineStr.replace(/[\r\n]+$/, '') + '\n';
    chunks.push(Buffer.from(cleanFirstLine, 'utf8'));
  }

  const fixedBuffer = Buffer.concat(chunks);

  // 6. Atomic write: write to temp file next to target, then rename
  const tempPath = path.join(
    path.dirname(resolvedFile),
    `.${path.basename(resolvedFile)}.bincheck-tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  try {
    fs.writeFileSync(tempPath, fixedBuffer);
    fs.chmodSync(tempPath, stat.mode);
    fs.renameSync(tempPath, resolvedFile);
  } catch (err) {
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch {
      // ignore unlink error
    }
    throw new Error(`Failed to atomically save repaired file: ${err instanceof Error ? err.message : String(err)}`);
  }

  return {
    changed: true,
    removedBOM: hasBOM,
    removedCR: hasCR,
    message: `Repaired ${hasBOM ? 'BOM ' : ''}${hasBOM && hasCR ? 'and ' : ''}${hasCR ? 'CRLF line ending' : ''} in shebang.`
  };
}
