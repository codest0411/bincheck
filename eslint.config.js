import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
        Uint8Array: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['error', { 'argsIgnorePattern': '^_', 'varsIgnorePattern': '^_' }],
      'no-constant-condition': 'warn',
      'no-control-regex': 'off',
      'preserve-caught-error': 'off',
      'no-empty': ['error', { 'allowEmptyCatch': true }]
    }
  },
  {
    ignores: [
      'node_modules/',
      'dist/',
      'test/fixtures/'
    ]
  }
];
