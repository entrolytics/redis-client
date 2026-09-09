import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  fixedExtension: false,
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node24',
  deps: { neverBundle: ['redis', 'debug'] },
});
