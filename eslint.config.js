import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import pluginSecurity from 'eslint-plugin-security';

export default [
  {
    files: ['server/src/**/*.ts', 'client/src/**/*.ts', 'client/src/**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      security: pluginSecurity,
    },
    rules: {
      // Base JS no-unused-vars turned off because @typescript-eslint/no-unused-vars handles TypeScript types/interfaces
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-non-literal-fs-filename': 'warn',
    },
  },
  {
    files: ['client/src/**/*.ts', 'client/src/**/*.tsx'],
    rules: {
      // Disabled in frontend UI: string comparisons in browser forms (e.g. password confirmation) are client-side validations, not cryptographic verification
      'security/detect-possible-timing-attacks': 'off',
    },
  },
];

