# Limitations & Design Assumptions

This document lists design constraints, scope boundaries, and known limitations of `bincheck`.

---

## 1. Module System Detection Heuristics
`bincheck` uses a fast, lightweight lexical scanner that strips comments and string literals to identify top-level `import`/`export` and CommonJS `require`/`module.exports`.
- **Limitation**: Dynamic imports (`import(...)`) are valid in both ESM and CommonJS. When only dynamic imports are detected, `bincheck` classifies the file syntax as ambiguous with low confidence rather than failing the build.
- **Transpilers & Bundlers**: If a project builds with Babel, SWC, tsup, or Rollup, `bincheck` audits the compiled output referenced in `package.json` `"bin"`. Authors must run `bincheck` after their build script.

## 2. Platform-Specific Installers
- **Scope**: Empirical testing in `docs/NPM-BEHAVIOR.md` covers npm v11.11.0 on Node.js v24.13.0 on Windows, macOS, and Linux.
- **Alternative Package Managers**: Yarn Berry, pnpm, and Bun use varying linking mechanisms (symlink farms, isolated hardlinks, or binary runners). `bincheck` focuses on validating the portable npm tarball contract to ensure compatibility across all compliant installers.

## 3. Read Caps and File Size Limits
- `bincheck` inspects up to 4 KB for shebang and BOM analysis and up to 64 KB for module-system keyword heuristics. CLI entry points exceeding 64 KB are uncommon, but any statements beyond 64 KB are not scanned for module-system keywords.
- `--fix` enforces a strict 5 MB file size cap and refuses to operate on binary or non-UTF-8 files.
