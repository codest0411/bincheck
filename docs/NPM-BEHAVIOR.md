# Empirical Analysis of npm CLI & Bin Behavior

**Date**: 2026-11-23  
**Environment**: Node.js v24.13.0, npm v11.11.0 on Windows 11  

---

## 1. Executive Summary

This document records empirical tests and source code analysis of npm v11.11.0 regarding how `bin` entries, shebangs, line endings (CRLF), byte order marks (BOM), and file permissions are handled during packaging (`npm pack`) and installation (`npm install`).

### Key Findings
1. **Packaging (`npm pack` / `npm publish`) is completely passive:** npm does **not** validate, sanitize, or transform shebang lines, line endings, BOMs, or file permissions when creating tarballs or publishing packages. What is on disk is archived directly into the tarball.
2. **Windows `core.autocrlf` hazard:** When package authors develop on Windows with Git's default or enabled `core.autocrlf true`, files checked out with CRLF endings are published with CRLF shebangs (`#!/usr/bin/env node\r\n`).
3. **Consumer-side repair is partial, fragile, and Unix-only:**
   - In `bin-links/lib/fix-bin.js`, npm executes a `dos2Unix` repair **only on Unix systems** during `npm install`.
   - On Windows, no CRLF repair is ever performed on the installed files.
   - **BOM defeats npm's repair:** npm's `isWindowsHashBang` function explicitly checks `buf[0] === '#'` and `buf[1] === '!'`. A UTF-8 BOM (`0xEF 0xBB 0xBF`) precedes the `#`, causing `isWindowsHashBang` to return `false`. As a result, npm fails to repair CRLF if a BOM is present, and does not strip the BOM.
   - **Alternative installers bypass repair:** Yarn Berry, pnpm (with symlinked/hardlinked stores), Bun, Nix, and manual tarball extractors / Docker layers may not run npm's `bin-links` repair logic.
4. **Shimming on Windows (`cmd-shim`):**
   - If a shebang is missing, `cmd-shim` writes a `.cmd` that invokes the `.js` file directly instead of prefixing `node.exe`, causing execution to fail unless a Windows file association exists for `.js`.
   - If an absolute path like `#!/usr/bin/node` is used, `cmd-shim` generates broken path checks like `IF EXIST "%dp0%\/usr/bin/node.exe"`.

---

## 2. Test Matrix and Empirical Results

Five isolated test packages were constructed, packed into `.tgz` archives with `npm pack --ignore-scripts`, and installed into clean consumer projects with `npm install --ignore-scripts`:

| Case | Shebang / Condition | In Tarball | Installed on Windows | Windows Shim (`.cmd`) | Behavior on Unix / Direct Invocation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`crlf`** | `#!/usr/bin/env node\r\n` | CRLF preserved | CRLF preserved (`hasCRLF: true`) | Generates `node.exe` call | Fails with `env: node\r: No such file or directory` |
| **`bom`** | `\uFEFF#!/usr/bin/env node\n` | BOM preserved | BOM preserved (`hasBOM: true`) | Generates `node.exe` call | Fails: OS kernel sees `0xEF 0xBB 0xBF` -> `ENOEXEC` (Exec format error); npm's `fix-bin.js` skips it because `buf[0] !== '#'` |
| **`noshebang`** | *(No shebang)* | No shebang | No shebang | Invokes `cli.js` directly without `node.exe` | Fails: shell attempts to parse JS as shell script or refuses to execute |
| **`abspath`** | `#!/usr/bin/node\n` | Absolute path | Absolute path | Checks for nonexistent `"%dp0%\/usr/bin/node.exe"` | Fails on FreeBSD, NixOS, Alpine (non-standard paths) |
| **`noexec`** | Mode `0644` (no `+x`) | Mode `0644` | Mode `0644` | Works via `.cmd` shim | On Unix, npm `fix-bin.js` adds `+x`, but unpackers without npm fail with `Permission denied` |

---

## 3. npm Source Code Reference

### A. `bin-links/lib/fix-bin.js`
Located at `node_modules/npm/node_modules/bin-links/lib/fix-bin.js`:
```javascript
const isWindowsHashBang = buf =>
  buf[0] === '#'.charCodeAt(0) &&
  buf[1] === '!'.charCodeAt(0) &&
  /^#![^\n]+\r\n/.test(buf.toString())

const isWindowsHashbangFile = file => { ... }

const dos2Unix = file =>
  readFile(file, 'utf8').then(content =>
    writeFileAtomic(file, content.replace(/^(#![^\n]+)\r\n/, '$1\n')))

const fixBin = (file, mode = execMode) => chmod(file, mode)
  .then(() => isWindowsHashbangFile(file))
  .then(isWHB => isWHB ? dos2Unix(file) : null)
```

**Flaws identified:**
1. Only checks the first 2048 bytes and requires literal `#` at index 0. If a UTF-8 BOM (`\xEF\xBB\xBF`) is present, it returns `false` and does not fix line endings.
2. Only replaces the first line ending.
3. Only runs on Unix target installations during npm install.

### B. `cmd-shim/lib/index.js`
Located at `node_modules/npm/node_modules/cmd-shim/lib/index.js`:
```javascript
const shebangExpr = /^#!\s*(?:\/usr\/bin\/env\s+(?:-S\s+)?((?:[^ \t=]+=[^ \t=]+\s+)*))?([^ \t]+)(.*)$/

const writeShim = (from, to) =>
  mkdir(dirname(to), { recursive: true })
    .then(() => readFile(from, 'utf8'))
    .then(data => {
      const firstLine = data.trim().split(/\r*\n/)[0]
      const shebang = firstLine.match(shebangExpr)
      if (!shebang) return writeShim_(from, to)
      const prog = shebang[2]
      return writeShim_(from, to, prog, ...)
    })
```
When `shebang` is missing, `prog` is undefined, leading to:
```javascript
prog = `"%dp0%\\${target}"`
```
which emits a `.cmd` line executing `"%dp0%\..\pkg\cli.js"` without `node.exe`.

---

## 4. Conclusion & Value Proposition for `bincheck`

npm's built-in heuristics do not protect package publishers or multi-platform consumers. A pre-publish audit tool is essential to:
1. Guarantee that the exact files published via `npm pack` contain valid, portable shebangs.
2. Guarantee LF line endings on shebang lines and `.gitattributes` enforcement to protect against Windows checkout corruption.
3. Catch UTF-8 BOM characters that break kernel execution and defeat npm's Unix install repair.
4. Verify module-system alignment between file syntax (`import`/`require`) and `package.json` `"type"`.
5. Verify that bin target files are not omitted by `files`, `.npmignore`, or `.gitignore`.
