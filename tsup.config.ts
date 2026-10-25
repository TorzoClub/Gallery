import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/server/index.ts',
    'cli/init-storage': 'src/server/cli/init-storage.ts',
    'cli/migration-legacy': 'src/server/cli/migration-legacy.ts',
  },
  outDir: 'dist/server',
  format: ['esm'],
  target: 'node24',
  platform: 'node',
  sourcemap: true,
  clean: true,
  splitting: false,
  external: ['sharp', 'vite'],
  tsconfig: 'tsconfig.server.json',
})
