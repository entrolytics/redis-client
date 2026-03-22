import { defineConfig } from 'vite-plus';

export default defineConfig({
  pack: {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    fixedExtension: false,
    dts: true,
    clean: true,
    sourcemap: true,
    target: 'node20',
    deps: {
      neverBundle: ['redis', 'debug'],
    },
  },
  fmt: {
    printWidth: 100,
    useTabs: false,
    singleQuote: true,
    jsxSingleQuote: false,
    quoteProps: 'as-needed',
    trailingComma: 'all',
    semi: true,
    arrowParens: 'avoid',
    objectWrap: 'preserve',
    insertFinalNewline: true,
    embeddedLanguageFormatting: 'auto',
    htmlWhitespaceSensitivity: 'css',
    proseWrap: 'preserve',
    sortPackageJson: {
      sortScripts: true,
    },
  },
  lint: {
    categories: {
      correctness: 'warn',
      suspicious: 'warn',
    },
    rules: {
      'react/exhaustive-deps': 'off',
      'typescript/no-explicit-any': 'off',
    },
    plugins: ['oxc', 'typescript', 'unicorn', 'react'],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
});
