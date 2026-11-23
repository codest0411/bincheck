# Competitive Landscape & Prior Art Analysis

**Date**: 2026-11-23  
**Package**: `bincheck`

---

## 1. Overview of Prior Art

Multiple tools exist in the JavaScript/Node.js ecosystem that touch upon package validation, linting, or shebang correctness. Below is an honest, factual assessment of what each tool does and does not do.

### A. `publint`
- **URL**: [https://publint.dev](https://publint.dev) ([GitHub](https://github.com/bluwy/publint))
- **Primary Purpose**: Validates `package.json` `exports` and `main` fields for ESM/CJS compatibility across packaging formats and bundlers.
- **What it does for bins**: Has rule `BIN_FILE_NOT_EXECUTABLE` which checks whether the file listed in the `bin` field starts with a shebang (e.g., `#!/usr/bin/env node`).
- **What it does NOT do**:
  - Does NOT audit line endings (`\r\n` CRLF) in the shebang or file.
  - Does NOT check for UTF-8 Byte Order Marks (BOM) before the shebang.
  - Does NOT check `.gitattributes` or Git index status to detect Windows checkout CRLF risks.
  - Does NOT provide an automatic `--fix` mode.
  - Does NOT provide an isolated `--smoke` execution test of the packaged CLI in a clean sandbox.
  - Does NOT check for command shadowing against standard system binaries.

### B. `eslint-plugin-n` (formerly `eslint-plugin-node`)
- **URL**: [https://github.com/eslint-community/eslint-plugin-n](https://github.com/eslint-community/eslint-plugin-n)
- **Primary Purpose**: ESLint rules for Node.js best practices and syntax features.
- **What it does for bins**: Provides `n/hashbang` (formerly `n/shebang`), which verifies that files mapped in `package.json` `"bin"` contain a valid hashbang line (`#!/usr/bin/env node`) and that non-bin files do not.
- **What it does NOT do**:
  - Runs on source files before build/packaging, NOT on the exact tarball that `npm publish` would produce.
  - Does not detect whether a bundler or compiler (e.g., `tsup`, `esbuild`, `tsc`) stripped or omitted the shebang in the dist output.
  - Does not inspect git attributes, git index executable bits, or CRLF line endings.
  - Does not verify whether files are excluded by `.npmignore` / `files`.

### C. `npm-packlist`
- **URL**: [https://github.com/npm/npm-packlist](https://github.com/npm/npm-packlist)
- **Primary Purpose**: The official file-walking library used internally by `npm pack` to determine which files will be included in the tarball based on `package.json` `files`, `.npmignore`, and `.gitignore`.
- **What it does for bins**: Determines whether a bin file is included in the package tarball.
- **What it does NOT do**:
  - Performs no validation of file contents, shebangs, line endings, BOMs, or permissions. It is solely an inclusion list generator.

### D. `are-the-types-wrong` (attw)
- **URL**: [https://github.com/arethetypeswrong/arethetypeswrong.github.io](https://github.com/arethetypeswrong/arethetypeswrong.github.io)
- **Primary Purpose**: Analyzes TypeScript declaration files (`.d.ts`) against package exports to detect dual-package hazard issues and broken type resolutions.
- **What it does for bins**: Nothing. It strictly inspects TypeScript type declarations and export maps.

### E. `pre-commit-hooks` (e.g. `check-shebang-scripts-are-executable`, `mixed-line-ending`)
- **URL**: [https://github.com/pre-commit/pre-commit-hooks](https://github.com/pre-commit/pre-commit-hooks)
- **Primary Purpose**: Generic Git pre-commit hooks for multi-language repositories.
- **What it does**: Checks that scripts with shebangs have executable permissions (`+x`) on Unix; checks for mixed line endings in git commits.
- **What it does NOT do**:
  - Has zero awareness of npm `package.json`, `bin` fields, `directories.bin`, or npm tarball contents.
  - Does not understand Node-specific shebang conventions (`/usr/bin/env node` vs `node`), `env -S` portability, or npm shimming.

### F. `stank` and `funk`
- **URL**: [https://github.com/mcandre/stank](https://github.com/mcandre/stank) / [https://github.com/mcandre/funk](https://github.com/mcandre/funk)
- **Primary Purpose**: Shell script sniffers written in Go that check for shebang consistency in general shell scripts.
- **What it does NOT do**:
  - Independent of Node.js ecosystem, npm packaging, and package manifests.

---

## 2. Feature Comparison Matrix

| Feature | `bincheck` | `publint` | `eslint-plugin-n` | `npm-packlist` | `pre-commit` |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Tarball-level inspection (`npm pack --dry-run`) | **Yes** | Yes | No | Yes (listing only) | No |
| Shebang line existence check | **Yes** | Yes | Yes | No | Yes |
| CRLF shebang detection (`\r\n`) | **Yes** | No | No | No | Partial (`mixed-line-ending`) |
| UTF-8 BOM detection | **Yes** | No | No | No | No |
| `.gitattributes` LF enforcement audit | **Yes** | No | No | No | No |
| Git index executable-bit audit (`git ls-files -s`) | **Yes** | No | No | No | Yes |
| Missing/excluded bin target check | **Yes** | Yes | No | No | No |
| Module-system heuristic check (ESM vs CJS) | **Yes** | No | No | No | No |
| System binary shadowing check | **Yes** | No | No | No | No |
| Safe, atomic `--fix` for CR / BOM | **Yes** | No | Partial (ESLint fix) | No | No |
| Isolated, sandboxed `--smoke` test | **Yes** | No | No | No | No |
| Multiple output formats (human, JSON, GitHub, SARIF) | **Yes** | Partial | Partial | No | No |

---

## 3. Honest Differentiation

`bincheck` does not attempt to replace general linter plugins like `eslint-plugin-n` or broad package validators like `publint`. Instead, `bincheck` addresses the specific, recurring failure mode where a developer authors or bundles a CLI on Windows or macOS and publishes a broken tarball to the npm registry. By combining `npm pack --dry-run` tarball inclusion verification, byte-level shebang and line-ending inspection, `.gitattributes` validation, atomic shebang repairing, and an opt-in sandboxed smoke execution test, `bincheck` serves as a dedicated pre-publish safety harness for npm CLI authors.
