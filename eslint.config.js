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
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'navigator',
        'localStorage',
        'sessionStorage',
        'indexedDB',
        'chrome',
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['react', 'react-dom', 'exceljs'], message: 'Çekirdek saf kalmalı.' },
            {
              group: [
                '**/arayuz/**',
                '**/platform/**',
                '**/raporlar/**',
                '**/kaynaklar/**',
                '**/hedef/**',
                '**/eklenti/**',
              ],
              message: 'Çekirdek başka katmana bağlanamaz.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/platform/**', 'src/raporlar/**', 'src/kaynaklar/**', 'src/hedef/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-dom', '**/arayuz/**'],
              message: 'İşlem ve adaptör katmanları arayüze bağlanamaz.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/arayuz/**'],
    rules: {
      'no-restricted-imports': 'off',
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['exceljs', '**/kaynaklar/excel', '**/hedef/**', '**/motor', '**/depoKontrol/islem'],
              allowTypeImports: true,
              message: 'Excel motoru yalnızca dinamik motorYukle ile yüklenir.',
            },
          ],
        },
      ],
    },
  },
);
