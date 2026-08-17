import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import convexPlugin from '@convex-dev/eslint-plugin';

export default tseslint.config(
  { ignores: ['dist', 'convex/_generated/**'] },
  ...convexPlugin.configs.recommended,
  {
    files: ['convex/**/*.ts'],
    rules: {
      // Project still uses Id-typed db.get/patch/delete; enabling this without
      // typed linting floods false positives across every Convex function.
      '@convex-dev/explicit-table-ids': 'off',
    },
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  }
);
