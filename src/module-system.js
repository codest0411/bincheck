import fs from 'node:fs';
import path from 'node:path';

/**
 * Strips comments and string literals from JS code to avoid false positives.
 * Runs in linear time with simple state machine.
 *
 * @param {string} source JavaScript source code
 * @returns {string} Stripped code containing only syntax tokens and whitespace
 */
export function stripCommentsAndStrings(source) {
  let result = '';
  let i = 0;
  const len = source.length;

  while (i < len) {
    const ch = source[i];
    const next = i + 1 < len ? source[i + 1] : '';

    // Single-line comment
    if (ch === '/' && next === '/') {
      i += 2;
      while (i < len && source[i] !== '\n') {
        i++;
      }
      result += ' ';
      continue;
    }

    // Multi-line comment
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < len && !(source[i] === '*' && i + 1 < len && source[i + 1] === '/')) {
        i++;
      }
      i += 2; // skip */
      result += ' ';
      continue;
    }

    // String literals: ', ", `
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      i++;
      while (i < len) {
        if (source[i] === '\\') {
          i += 2; // skip escape
          continue;
        }
        if (source[i] === quote) {
          i++;
          break;
        }
        i++;
      }
      result += ' ';
      continue;
    }

    result += ch;
    i++;
  }

  return result;
}

/**
 * @typedef {Object} ModuleSystemAnalysis
 * @property {boolean} isTypeScriptSource True if extension is .ts, .tsx, .mts, .cts
 * @property {'module' | 'commonjs'} packageType The resolved package type from package.json
 * @property {'esm' | 'cjs' | 'ambiguous'} detectedSyntax Syntax detected in bin file
 * @property {boolean} hasMismatch Whether module system mismatch was detected
 * @property {'high' | 'medium' | 'low'} confidence Confidence of the detection
 * @property {string} details Explanation of findings
 */

/**
 * Analyzes the module system of a bin file relative to package.json configuration.
 *
 * @param {string} filePath Absolute path to bin file
 * @param {Record<string, any>} pkgJson Parsed package.json
 * @returns {ModuleSystemAnalysis}
 */
export function analyzeModuleSystem(filePath, pkgJson) {
  const ext = path.extname(filePath).toLowerCase();
  const packageType = pkgJson.type === 'module' ? 'module' : 'commonjs';

  if (ext === '.ts' || ext === '.tsx' || ext === '.mts' || ext === '.cts') {
    return {
      isTypeScriptSource: true,
      packageType,
      detectedSyntax: 'ambiguous',
      hasMismatch: true,
      confidence: 'high',
      details: `Bin file points to uncompiled TypeScript source (${ext}). Node.js cannot run this without a runtime loader or transpilation step.`
    };
  }

  // Explicit extensions
  if (ext === '.mjs') {
    return {
      isTypeScriptSource: false,
      packageType,
      detectedSyntax: 'esm',
      hasMismatch: false,
      confidence: 'high',
      details: 'File uses .mjs extension (explicit ECMAScript module).'
    };
  }

  if (ext === '.cjs') {
    return {
      isTypeScriptSource: false,
      packageType,
      detectedSyntax: 'cjs',
      hasMismatch: false,
      confidence: 'high',
      details: 'File uses .cjs extension (explicit CommonJS module).'
    };
  }

  // For .js or extensionless files, read up to 64KB to detect keywords
  let sample;
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(65536);
    const read = fs.readSync(fd, buf, 0, 65536, 0);
    fs.closeSync(fd);
    sample = buf.subarray(0, read).toString('utf8');
  } catch {
    return {
      isTypeScriptSource: false,
      packageType,
      detectedSyntax: 'ambiguous',
      hasMismatch: false,
      confidence: 'low',
      details: 'Unable to read file content for module analysis.'
    };
  }

  const clean = stripCommentsAndStrings(sample);

  // Heuristics for ESM: import ..., export ...
  const hasEsmImport = /\bimport\s+(?:(?:\*\s+as\s+\w+)|(?:\{\s*[\w\s,]+\s*\})|(?:\w+))\s+from\s+/m.test(clean);
  const hasEsmExport = /\bexport\s+(?:default|const|let|var|function|class|\{)/m.test(clean);
  const isEsmSyntax = hasEsmImport || hasEsmExport;

  // Heuristics for CJS: require(...), module.exports, exports.
  const hasRequire = /\brequire\s*\(/m.test(clean);
  const hasModuleExports = /\bmodule\.exports\b/m.test(clean);
  const isCjsSyntax = hasRequire || hasModuleExports;

  if (isEsmSyntax && !isCjsSyntax) {
    const mismatch = packageType === 'commonjs' && ext === '.js';
    return {
      isTypeScriptSource: false,
      packageType,
      detectedSyntax: 'esm',
      hasMismatch: mismatch,
      confidence: 'high',
      details: mismatch
        ? 'File contains ESM import/export statements, but package.json lacks "type": "module". Node will throw SyntaxError: Cannot use import statement outside a module.'
        : 'File uses ECMAScript module syntax aligned with package.json.'
    };
  }

  if (isCjsSyntax && !isEsmSyntax) {
    const mismatch = packageType === 'module' && ext === '.js';
    return {
      isTypeScriptSource: false,
      packageType,
      detectedSyntax: 'cjs',
      hasMismatch: mismatch,
      confidence: 'high',
      details: mismatch
        ? 'File contains CommonJS require/module.exports, but package.json specifies "type": "module". Node will throw ReferenceError: require is not defined in ES module scope.'
        : 'File uses CommonJS syntax aligned with package.json.'
    };
  }

  return {
    isTypeScriptSource: false,
    packageType,
    detectedSyntax: 'ambiguous',
    hasMismatch: false,
    confidence: 'low',
    details: 'Syntax appears neutral or ambiguous (dynamic imports or minimal statements).'
  };
}
