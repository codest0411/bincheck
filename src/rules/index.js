import { checkBC001 } from './bc001.js';
import { checkBC002 } from './bc002.js';
import { checkBC003 } from './bc003.js';
import { checkBC004 } from './bc004.js';
import { checkBC005 } from './bc005.js';
import { checkBC006 } from './bc006.js';
import { checkBC007 } from './bc007.js';
import { checkBC008 } from './bc008.js';
import { checkBC009 } from './bc009.js';
import { checkBC010 } from './bc010.js';
import { inspectShebang } from '../shebang.js';
import { analyzeModuleSystem } from '../module-system.js';
import { checkGitIndex } from '../git-index.js';
import { checkGitAttributes } from '../gitattrs.js';

/**
 * @typedef {Object} Finding
 * @property {string} id Unique rule identifier (e.g. BC001)
 * @property {'error' | 'warn' | 'info'} severity Finding severity
 * @property {string} commandName CLI command name associated with finding
 * @property {string} file POSIX relative path to the relevant file
 * @property {number} line Line number (typically 1 for shebang)
 * @property {string} title Concise description of the finding
 * @property {string} evidence Empirical evidence observed
 * @property {string} whyItMatters Architectural explanation of failure mode
 * @property {string} fixAdvice Recommended fix instruction
 * @property {boolean} [ignored] Whether finding was suppressed by user configuration
 * @property {string} [ignoreReason] Mandatory justification reason for suppression
 */

/**
 * Executes all rules against declared bin entries and tarball contents.
 *
 * @param {Object} context
 * @param {string} context.packageRoot Root directory of the package
 * @param {Record<string, any>} context.packageJson Parsed package.json
 * @param {import('../bin-entries.js').BinEntry[]} context.binEntries Declared bin targets
 * @param {Set<string>} context.packFiles Set of files included in npm pack tarball
 * @param {Map<string, string>} [context.ignoreMap] Map of ignored rule IDs to justifications
 * @returns {Finding[]}
 */
export function runAllRules(context) {
  const { packageRoot, packageJson, binEntries, packFiles, ignoreMap = new Map() } = context;
  /** @type {Finding[]} */
  const rawFindings = [];
  const shebangMap = new Map();

  for (const entry of binEntries) {
    // BC001: Exists on disk and tarball inclusion
    const bc001Findings = checkBC001(entry, packFiles, packageRoot);
    rawFindings.push(...bc001Findings);

    if (entry.existsOnDisk && !entry.escapesRoot && entry.isRegularFile) {
      // Parse shebang
      const shebangInfo = inspectShebang(entry.absolutePath);
      shebangMap.set(entry.normalizedTarget, shebangInfo);

      // BC002: Shebang existence
      rawFindings.push(...checkBC002(entry, shebangInfo));

      // BC003: CRLF in shebang
      rawFindings.push(...checkBC003(entry, shebangInfo));

      // BC004: UTF-8 BOM
      rawFindings.push(...checkBC004(entry, shebangInfo));

      // BC005: Portability
      rawFindings.push(...checkBC005(entry, shebangInfo));

      // BC006: Module system mismatch
      const modAnalysis = analyzeModuleSystem(entry.absolutePath, packageJson);
      rawFindings.push(...checkBC006(entry, modAnalysis));

      // BC007: Git index mode
      const indexResult = checkGitIndex(packageRoot, entry.normalizedTarget, entry.absolutePath);
      rawFindings.push(...checkBC007(entry, indexResult));

      // BC008: Git attributes LF check
      const attrResult = checkGitAttributes(packageRoot, entry.normalizedTarget);
      rawFindings.push(...checkBC008(entry, attrResult));
    }

    // BC009: Command naming, shadowing, and aliases
    rawFindings.push(...checkBC009(entry, binEntries));
  }

  // BC010: Summary table
  rawFindings.push(...checkBC010(binEntries, packFiles, shebangMap));

  // Apply ignore map justifications
  return rawFindings.map(finding => {
    const reason = ignoreMap.get(finding.id.toUpperCase());
    if (reason) {
      return {
        ...finding,
        ignored: true,
        ignoreReason: reason
      };
    }
    return finding;
  });
}
