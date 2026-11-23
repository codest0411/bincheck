# Changelog

All notable changes to `bincheck` are documented in this file.

## [0.1.0] - 2026-11-23

### Added
- Static audit for package bin entries, shebangs, CRLF endings, BOM, and module systems.
- Rules BC001 through BC010 covering tarball pack lists, shebang portability, git attributes, and command naming.
- Multi-format reporters: human, JSON, GitHub Actions workflow commands, and SARIF v2.1.0.
- Optional `--fix` flag to repair CRLF and BOM in bin files atomically.
- Optional `--smoke` flag to run binaries in an isolated sandbox environment.
- TypeScript declaration files generated under `dist/`.
