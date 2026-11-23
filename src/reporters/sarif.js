import { sanitizeString } from '../sanitize.js';

/**
 * Renders findings in OASIS SARIF v2.1.0 format for GitHub Code Scanning tab.
 *
 * @param {import('../rules/index.js').Finding[]} findings
 * @returns {string}
 */
export function renderSarif(findings) {
  const sarifResults = [];

  for (const finding of findings) {
    if (finding.ignored) continue;

    const level = finding.severity === 'error'
      ? 'error'
      : finding.severity === 'warn'
        ? 'warning'
        : 'note';

    sarifResults.push({
      ruleId: finding.id,
      level,
      message: {
        text: sanitizeString(`${finding.title}: ${finding.evidence} (Fix: ${finding.fixAdvice})`)
      },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: sanitizeString(finding.file),
              uriBaseId: '%SRCROOT%'
            },
            region: {
              startLine: finding.line || 1,
              startColumn: 1
            }
          }
        }
      ]
    });
  }

  const sarifLog = {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'bincheck',
            informationUri: 'https://github.com/build-agent/bincheck',
            rules: [
              { id: 'BC001', name: 'BinFileMissingOrExcluded', shortDescription: { text: 'Bin target does not exist or is omitted from tarball.' } },
              { id: 'BC002', name: 'MissingShebang', shortDescription: { text: 'First line is not a shebang.' } },
              { id: 'BC003', name: 'CrlfShebang', shortDescription: { text: 'Carriage return present in shebang line.' } },
              { id: 'BC004', name: 'BomBeforeShebang', shortDescription: { text: 'UTF-8 Byte Order Mark precedes shebang.' } },
              { id: 'BC005', name: 'NonPortableShebang', shortDescription: { text: 'Absolute path or non-portable interpreter in shebang.' } },
              { id: 'BC006', name: 'ModuleSystemMismatch', shortDescription: { text: 'Module system syntax mismatches package.json type.' } },
              { id: 'BC007', name: 'ExecutableBitState', shortDescription: { text: 'File mode in git index or filesystem lacks executable bit.' } },
              { id: 'BC008', name: 'GitAttributesLfMissing', shortDescription: { text: 'Line endings are not enforced to LF by .gitattributes.' } },
              { id: 'BC009', name: 'BinNamingIssue', shortDescription: { text: 'Command name shadows system command or has invalid characters.' } },
              { id: 'BC010', name: 'BinManifestSummary', shortDescription: { text: 'Summary of all declared binaries.' } }
            ]
          }
        },
        results: sarifResults
      }
    ]
  };

  return JSON.stringify(sarifLog, null, 2);
}
