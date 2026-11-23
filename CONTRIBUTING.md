# Contributing to bincheck

We appreciate contributions to improve bincheck.

## Development Workflow

1. Ensure Node.js 20+ is installed.
2. Clone this repository and run `npm install`.
3. Make changes in `src/` or `test/`.
4. Validate changes:
   ```sh
   npm run lint
   npm run typecheck
   npm test
   npm run test:coverage
   ```
5. All pull requests must maintain >= 90% line coverage and zero runtime dependencies.
