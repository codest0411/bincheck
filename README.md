# bincheck

Audit, validate, and fix npm package `bin` entries, shebangs, line endings, and publish inclusions before release.

## Problem

Package authors developing on Windows or mixed environments often publish CLI packages that break immediately for end users on macOS or Linux with errors such as:

```text
/usr/bin/env: 'node\r': No such file or directory
```

or fail on execution with:

```text
bad interpreter: No such file or directory
```

Root causes include:
- Carriage returns (`\r\n` CRLF) in the shebang line introduced by Git `core.autocrlf` or Windows editors.
- UTF-8 Byte Order Marks (BOM `0xEF, 0xBB, 0xBF`) at the start of the file before `#!`.
- Missing or non-portable shebangs (e.g. `#!/bin/node` instead of `#!/usr/bin/env node`).
- Bin scripts omitted from the published npm tarball due to `files`, `.npmignore`, or `.gitignore` rules.
- ESM and CommonJS syntax mismatches with `package.json` `"type"`.
- Bin entries referencing uncompiled `.ts` files.
- Missing LF line-ending enforcement in `.gitattributes`.

`bincheck` inspects the exact file set that `npm publish` would package and reports actionable diagnostics.

## Quick Start

Run `bincheck` in any package directory:

```sh
npx bincheck
```

Or pass a specific package directory:

```sh
npx bincheck ./packages/my-cli
```

### Prepublish Hook

Add to your `package.json` scripts:

```json
{
  "scripts": {
    "prepublishOnly": "bincheck"
  }
}
```

## Before & After Example

### Before
A CLI file created on Windows with CRLF line endings:
```text
#!/usr/bin/env node\r\n
console.log("Hello world");
```
When published and run on Linux:
```text
/usr/bin/env: 'node\r': No such file or directory
```

### With bincheck
Running `bincheck`:
```text
=== bincheck audit report ===

[ERROR] CRLF line ending in shebang (BC003)
        File:     bin/cli.js:1 [cmd: my-cli]
        Evidence: Shebang ends with \r\n (CRLF)
        Why:      Unix loaders treat \r as part of interpreter name, invoking 'node\r'
        Fix:      Convert shebang line ending to LF (\n)
```

Running `bincheck --fix`:
```text
[bincheck --fix] Successfully repaired 1 file(s):
  ✔ bin/cli.js: Repaired CRLF line ending in shebang.
```

## Rules Reference

| Rule ID | Severity | Name | Description |
|---|---|---|---|
| BC001 | Error | BinFileMissingOrExcluded | Target file does not exist on disk or is excluded from npm tarball |
| BC002 | Error | MissingShebang | First line is not a valid shebang |
| BC003 | Error | CrlfShebang | Carriage return (`\r`) in shebang line (`node\r` failure) |
| BC004 | Error | BomBeforeShebang | UTF-8 Byte Order Mark precedes shebang |
| BC005 | Warning | NonPortableShebang | Shebang uses hardcoded path instead of `/usr/bin/env` |
| BC006 | Error/Warn | ModuleSystemMismatch | Syntax (`import`/`require`) mismatches package module type or is uncompiled `.ts` |
| BC007 | Warning | ExecutableBitState | Git index mode does not mark file as executable (100755) |
| BC008 | Warning | GitAttributesLfMissing | `.gitattributes` lacks explicit `eol=lf` rule for bin files |
| BC009 | Warning | BinNamingIssue | Command name shadows common system utility or contains invalid chars |
| BC010 | Info | BinManifestSummary | Informational summary of all declared bin commands and targets |

## CLI Options

```text
Usage: bincheck [path] [options]

Arguments:
  path                     Target package directory (default: current working directory)

Options:
  --format <type>          Output format: human, json, github, sarif (default: human)
  --fix                    Automatically fix safe issues (CRLF shebangs and BOMs)
  --smoke                  Run published tarball install and help check in isolated sandbox
  --config <path>          Path to custom configuration file
  --fail-on <severity>     Exit with code 1 on severity threshold: error (default), warning
  -v, --version            Display version
  -h, --help               Display help message
```

## Automatic Fix (`--fix`)

The `--fix` option modifies files in place:
- Converts CRLF in the shebang line to LF.
- Removes UTF-8 BOM before the shebang.
- Preserves all other bytes in the file verbatim.
- Preserves file permissions and mode.
- Uses atomic file replacement (temp file write followed by rename).

```sh
npx bincheck --fix
```

## Author Smoke Testing (`--smoke`)

> **Warning**: `--smoke` creates a temporary package tarball, installs it into an isolated temporary directory, and executes each declared binary with `--help`. Only run this on code you trust.

Features of `--smoke`:
- Runs in an isolated sandbox with clean `HOME`, `USERPROFILE`, and temporary `npm_config_cache`.
- Clears developer tokens (`NPM_TOKEN`, `GITHUB_TOKEN`, etc.).
- Enforces a process timeout to kill hanging scripts cleanly.
- Caps captured output to avoid memory exhaustion.

```sh
npx bincheck --smoke
```

## Recommended .gitattributes Setup

Add this line to your repository's `.gitattributes` file to ensure Git never checks out bin scripts with CRLF endings on Windows:

```gitattributes
bin/* text eol=lf
```

## What Does npm Already Handle?

See [docs/NPM-BEHAVIOR.md](docs/NPM-BEHAVIOR.md) for empirical test findings on npm behavior:
- npm creates `.cmd` and `.ps1` shims on Windows during local install.
- npm does NOT sanitize CRLF or BOM when packaging or publishing tarballs.
- When npm installs a package with a BOM before the shebang on Linux, the install fails to detect the shebang and the executable cannot be run.
- `bincheck` catches these defects before publication.

## Comparison With Other Tools

| Feature | bincheck | publint | eslint-plugin-n | npm-packlist |
|---|---|---|---|---|
| Inspects actual publish tarball contents | Yes | Yes | No | Yes |
| Detects CRLF in shebang line | Yes | No | Yes (lint only) | No |
| Detects UTF-8 BOM before shebang | Yes | No | No | No |
| Verifies Git index executable bits | Yes | No | No | No |
| Checks `.gitattributes` line ending rule | Yes | No | No | No |
| Atomic automated repair (`--fix`) | Yes | No | Yes (CRLF only) | No |
| Tarball installation smoke test (`--smoke`) | Yes | No | No | No |
| Zero runtime dependencies | Yes | No | No | No |

## Limitations

- **Module system detection**: Uses lightweight heuristic scanning (comments and string literals stripped) rather than a full AST parser.
- **Transpiled projects**: Inspects published target files, not source TypeScript before build. Run `bincheck` after your build step.
- **Installer coverage**: Primarily targets npm packaging rules.

## License

MIT
