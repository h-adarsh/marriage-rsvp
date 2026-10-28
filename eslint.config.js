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
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-non-literal-fs-filename': 'warn',
    },
  },
];
