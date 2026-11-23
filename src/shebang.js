import fs from 'node:fs';

/**
 * @typedef {Object} ShebangInfo
 * @property {boolean} hasBOM Whether file starts with UTF-8 BOM (\xEF\xBB\xBF)
 * @property {boolean} hasShebang Whether a shebang line exists
 * @property {string} rawLine Raw first line as read from bytes
 * @property {string} cleanShebang First line with BOM, leading #!, and trailing CR/LF stripped
 * @property {string} interpreter Interpreter binary (e.g. "node", "/usr/bin/node")
 * @property {string[]} args Arguments passed to interpreter or env
 * @property {boolean} usesEnv Whether shebang invokes /usr/bin/env
 * @property {boolean} usesEnvSplit Whether shebang uses env -S for argument passing
 * @property {boolean} isPortableNode True if recommended #!/usr/bin/env node
 * @property {boolean} isAbsoluteInterpreter True if interpreter is an absolute path (e.g. /usr/bin/node)
 * @property {boolean} hasCR Whether carriage return (\r) is present on shebang line
 * @property {string} lineEnding 'CRLF' | 'LF' | 'CR' | 'NONE'
 * @property {boolean} isBinary True if null bytes detected in sample
 */

const MAX_HEADER_BYTES = 4096;

/**
 * Inspects the shebang, BOM, and line endings of a file safely reading at most MAX_HEADER_BYTES.
 *
 * @param {string} filePath Absolute path to file
 * @returns {ShebangInfo} Parsed shebang characteristics
 */
export function inspectShebang(filePath) {
  let fd;
  const buffer = Buffer.alloc(MAX_HEADER_BYTES);
  let bytesRead;

  try {
    fd = fs.openSync(filePath, 'r');
    bytesRead = fs.readSync(fd, buffer, 0, MAX_HEADER_BYTES, 0);
  } catch {
    return {
      hasBOM: false,
      hasShebang: false,
      rawLine: '',
      cleanShebang: '',
      interpreter: '',
      args: [],
      usesEnv: false,
      usesEnvSplit: false,
      isPortableNode: false,
      isAbsoluteInterpreter: false,
      hasCR: false,
      lineEnding: 'NONE',
      isBinary: false
    };
  } finally {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch {
        // ignore close error
      }
    }
  }

  return parseShebangFromBuffer(buffer.subarray(0, bytesRead));
}

/**
 * Parses shebang characteristics from a raw buffer.
 *
 * @param {Buffer} buffer Raw byte slice of file beginning
 * @returns {ShebangInfo} Parsed details
 */
export function parseShebangFromBuffer(buffer) {
  if (buffer.length === 0) {
    return {
      hasBOM: false,
      hasShebang: false,
      rawLine: '',
      cleanShebang: '',
      interpreter: '',
      args: [],
      usesEnv: false,
      usesEnvSplit: false,
      isPortableNode: false,
      isAbsoluteInterpreter: false,
      hasCR: false,
      lineEnding: 'NONE',
      isBinary: false
    };
  }

  // Detect binary content (null bytes)
  let isBinary = false;
  for (let i = 0; i < Math.min(buffer.length, 512); i++) {
    if (buffer[i] === 0) {
      isBinary = true;
      break;
    }
  }

  // Check UTF-8 BOM: 0xEF 0xBB 0xBF
  let offset = 0;
  let hasBOM = false;
  if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    hasBOM = true;
    offset = 3;
  }

  // Find end of first line (\n or \r)
  let newlineIdx = -1;
  let lineEnding = 'NONE';
  let hasCR = false;

  for (let i = offset; i < buffer.length; i++) {
    if (buffer[i] === 0x0A) { // \n
      newlineIdx = i;
      if (i > offset && buffer[i - 1] === 0x0D) {
        lineEnding = 'CRLF';
        hasCR = true;
      } else {
        lineEnding = 'LF';
      }
      break;
    } else if (buffer[i] === 0x0D) { // \r
      hasCR = true;
      if (i + 1 < buffer.length && buffer[i + 1] === 0x0A) {
        newlineIdx = i + 1;
        lineEnding = 'CRLF';
        break;
      } else {
        // Lone CR
        newlineIdx = i;
        lineEnding = 'CR';
        break;
      }
    }
  }

  let lineBytes;
  if (newlineIdx !== -1) {
    lineBytes = buffer.subarray(offset, newlineIdx + (lineEnding === 'CRLF' ? 0 : 1));
  } else {
    lineBytes = buffer.subarray(offset);
  }

  const rawLine = lineBytes.toString('utf8');
  const trimmedLine = rawLine.replace(/[\r\n]+$/, '');

  // Check shebang syntax: must start with #!
  const hasShebang = trimmedLine.startsWith('#!');
  if (!hasShebang) {
    return {
      hasBOM,
      hasShebang: false,
      rawLine,
      cleanShebang: '',
      interpreter: '',
      args: [],
      usesEnv: false,
      usesEnvSplit: false,
      isPortableNode: false,
      isAbsoluteInterpreter: false,
      hasCR,
      lineEnding,
      isBinary
    };
  }

  const cleanShebang = trimmedLine.slice(2).trim();
  // Split tokens safely
  const tokens = cleanShebang.split(/\s+/).filter(Boolean);
  const firstToken = tokens[0] || '';

  let usesEnv = false;
  let usesEnvSplit = false;
  let interpreter = firstToken;
  let args = tokens.slice(1);

  if (firstToken === '/usr/bin/env' || firstToken === 'env') {
    usesEnv = true;
    if (args.length > 0 && args[0] === '-S') {
      usesEnvSplit = true;
      interpreter = args[1] || '';
      args = args.slice(2);
    } else {
      interpreter = args[0] || '';
      args = args.slice(1);
    }
  }

  const isAbsoluteInterpreter = firstToken.startsWith('/') && !usesEnv;
  const isPortableNode = (
    cleanShebang === '/usr/bin/env node' ||
    cleanShebang === '/usr/bin/env -S node'
  );

  return {
    hasBOM,
    hasShebang: true,
    rawLine,
    cleanShebang,
    interpreter,
    args,
    usesEnv,
    usesEnvSplit,
    isPortableNode,
    isAbsoluteInterpreter,
    hasCR,
    lineEnding,
    isBinary
  };
}
