# bincheck Rule Catalog

This catalog documents all rules implemented in `bincheck` (BC001–BC010).

---

### BC001: Missing or Excluded Bin File
- **Severity**: Error
- **Summary**: A file declared in `package.json` `"bin"` or `directories.bin` does not exist on disk, traverses outside the package root, or is excluded from the published tarball by `files`, `.npmignore`, or `.gitignore`.
- **Why it matters**: If a declared binary is omitted from the npm tarball, consumers who install the package receive a broken command symlink or shortcut pointing to a missing target.
- **Recommended Fix**: Verify the file path in `package.json`, ensure build steps emit the file before publishing, and add the path or its parent directory to the `"files"` allowlist in `package.json`.

---

### BC002: Missing Shebang Line
- **Severity**: Error
- **Summary**: The first line of the bin target script does not begin with `#!`.
- **Why it matters**: Unix operating systems require a shebang to identify the script interpreter. Without a shebang, executing the binary fails with format or syntax errors. On Windows, npm's `cmd-shim` omits the `node.exe` wrapper, attempting to execute the `.js` file directly.
- **Recommended Fix**: Add `#!/usr/bin/env node` as the very first line of the file.

---

### BC003: CRLF Carriage Return in Shebang Line
- **Severity**: Error
- **Summary**: The shebang line ends with a carriage return character (`\r\n`).
- **Why it matters**: Linux and macOS kernels do not trim `\r` from the shebang interpreter path. Invoking `#!/usr/bin/env node\r` causes the OS to look for a binary literally named `node\r`, immediately failing with `env: node\r: No such file or directory`.
- **Recommended Fix**: Save the file with Unix LF (`\n`) line endings, enforce LF in `.gitattributes`, or run `bincheck --fix`.

---

### BC004: UTF-8 Byte Order Mark (BOM)
- **Severity**: Error
- **Summary**: The bin file begins with the byte sequence `0xEF 0xBB 0xBF` (UTF-8 BOM).
- **Why it matters**: Operating system kernels require the literal byte sequence `0x23 0x21` (`#!`) at byte offset 0. Preceding bytes trigger `ENOEXEC` (Exec format error). Furthermore, npm's install-time `fix-bin` heuristic skips line-ending repair when byte 0 is not `#`.
- **Recommended Fix**: Save the file as UTF-8 without BOM or run `bincheck --fix`.

---

### BC005: Non-Portable Shebang Interpreter
- **Severity**: Warning / Info
- **Summary**: The shebang specifies an absolute interpreter path (e.g., `#!/usr/bin/node`) or uses split arguments (`env -S`).
- **Why it matters**: Hardcoded paths fail on systems where Node is installed elsewhere (NixOS, Alpine, FreeBSD, or version managers like nvm/fnm). While `env -S` was standardized in POSIX.1-2024 and is widely supported, minimal environments like standard BusyBox may not support `-S`.
- **Recommended Fix**: Standardize on `#!/usr/bin/env node`.

---

### BC006: Module System Mismatch
- **Severity**: Error
- **Summary**: A `.js` bin file uses ECMAScript `import`/`export` syntax without `"type": "module"` in `package.json`, uses CommonJS `require`/`module.exports` with `"type": "module"`, or points directly to uncompiled TypeScript (`.ts`/`.tsx`).
- **Why it matters**: Mismatched syntax causes immediate fatal errors (`SyntaxError: Cannot use import statement outside a module` or `ReferenceError: require is not defined in ES module scope`).
- **Recommended Fix**: Align `package.json` `"type"` with your syntax, use explicit extensions (`.mjs`/`.cjs`), or compile TypeScript before packaging.

---

### BC007: Executable-Bit Permission State
- **Severity**: Info
- **Summary**: The file mode in the Git index is `100644` (non-executable) rather than `100755`.
- **Why it matters**: npm automatically grants executable permissions on Unix during `npm install`. However, direct tarball consumers or alternative package managers may retain `0644`, causing `Permission denied`.
- **Recommended Fix**: Mark the file executable in Git: `git update-index --chmod=+x <file>`.

---

### BC008: Line Endings Not Enforced in `.gitattributes`
- **Severity**: Warning
- **Summary**: Git attributes do not explicitly enforce `eol=lf` for the bin file.
- **Why it matters**: If `core.autocrlf` is active on Windows, Git converts LF to CRLF during checkout. Publishing from that checkout packages CRLF shebangs into the npm release tarball.
- **Recommended Fix**: Add `<path> text eol=lf` to your `.gitattributes` file.

---

### BC009: Command Name Shadowing or Unusual Characters
- **Severity**: Info
- **Summary**: Command name shadows common system commands (e.g. `ls`, `grep`), contains spaces or leading dashes, or multiple names point to identical targets.
- **Why it matters**: Prevents unintended collision with system utilities when installed globally.
- **Recommended Fix**: Ensure CLI names are distinct and follow standard hyphenated lowercase conventions.

---

### BC010: Bin Manifest Summary
- **Severity**: Info
- **Summary**: Comprehensive manifest table detailing every command, target, shebang, line ending, and tarball inclusion status.
- **Recommended Fix**: Review during pre-publish checks.
