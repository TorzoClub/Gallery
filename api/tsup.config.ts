import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/cli/init-storage.ts'],
  format: ['esm'],
  target: 'node24',
  platform: 'node',
  sourcemap: true,
  clean: true,
  splitting: false,
  external: ['sharp'],
})
