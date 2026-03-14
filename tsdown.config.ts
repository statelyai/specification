import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/jsonata.ts',
    'src/jmespath.ts',
    'src/jsonpath.ts',
  ],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
});
