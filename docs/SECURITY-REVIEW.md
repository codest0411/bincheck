# Security Review & Audit Checklist

**Date**: 2026-11-23  
**Package**: `bincheck`  
**Auditor**: Build Agent (Autonomous Senior Security Reviewer)

---

## 1. Threat Modeling & Attack Surfaces

`bincheck` operates on potentially untrusted npm packages containing arbitrary manifests, file paths, script contents, and names. The threat boundaries and mitigations are evaluated below:

| Threat / Attack Vector | Mitigation in `bincheck` | Verified |
| :--- | :--- | :---: |
| **Command Injection via Path / Options** | All processes spawned via `execFileSync` and `spawn` with array arguments; `shell: false` strictly enforced across the entire codebase. Zero usage of `child_process.exec` or shell interpolation. | PASS |
| **Path Traversal outside Package Root** | `extractBinEntries` and `fixShebang` verify `path.relative(root, target)`. Any target escaping root via `..` or absolute path is flagged as finding BC001 and never opened. Symlinks pointing outside root are detected and blocked. | PASS |
| **Arbitrary Code Execution on Audit** | Static audit runs `npm pack --dry-run --ignore-scripts` which disables `prepack`, `prepare`, and lifecycle hooks. `bincheck` never evaluates, requires, or invokes package files during static analysis. | PASS |
| **Terminal ANSI Injection** | All package-controlled metadata (names, targets, error details) pass through `sanitizeString()` which strips ANSI escape codes and control characters. | PASS |
| **Workflow Injection in CI** | `renderGitHub` sanitizes and percent-encodes command characters (`%`, `\r`, `\n`, `::`, `,`). | PASS |
| **Prototype Pollution** | `loadConfig` strictly forbids `__proto__`, `constructor`, and `prototype` keys and uses primitive `Set` / `Map` data structures. | PASS |
| **ReDoS (Regular Expression Denial of Service)** | All regex patterns are linear-time and avoid nested quantifiers. Fuzz testing validates parsing robustness under adversarial inputs. | PASS |
| **Smoke Test Sandbox Escape** | `--smoke` is strictly opt-in; creates an ephemeral sandbox in `os.tmpdir()` with clean isolated environment (`HOME`, `USERPROFILE`, and `npm_config_cache` redirected to temp sandbox; developer tokens stripped). Kills entire process tree on timeout. Temp directory deleted in `finally` block. | PASS |
| **Atomic File Modification Safety** | `--fix` only operates on regular files inside root (refuses symlinks and non-text/binary files), writes to adjacent temp file, copies mode, and executes atomic rename. Byte comparison confirms only shebang line endings/BOM are touched. | PASS |

---

## 2. Supply Chain & Release Security

- Zero runtime dependencies (`dependencies: {}`).
- All devDependencies pinned and audited (`npm audit`: 0 vulnerabilities).
- GitHub Actions workflows use least-privilege permissions and SHA-pinned actions.
- CodeQL static analysis workflow enabled.
- Dependabot configured for weekly updates.
- npm release configured with provenance and 2FA checklist.
