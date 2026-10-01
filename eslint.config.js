import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Katman kuralı: çekirdek saf kalır, tarayıcıya ve arayüze bağlanmaz.
    },
  },
  {
    files: ['src/cekirdek/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['react', 'react-dom', 'exceljs'], message: 'Çekirdek saf kalmalı.' },
            {
              group: ['**/arayuz/**', '**/platform/**', '**/raporlar/**', '**/kaynaklar/**', '**/hedef/**'],
              message: 'Çekirdek başka katmana bağlanamaz.',
            },
          ],
        },
      ],
    },
  },
);
