import { defineConfig } from 'tsup'
import { getBuildInfo } from './build-info.config'

const build_info = getBuildInfo()

export default defineConfig({
  entry: {
    index: 'src/server/index.ts',
    'cli/init-storage': 'src/server/cli/init-storage.ts',
    'cli/update-storage': 'src/server/cli/update-storage.ts',
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
  define: {
    __BUILD_DATE__: JSON.stringify(build_info.build_date),
    __GIT_HASH__: JSON.stringify(build_info.git_hash),
  },
})
