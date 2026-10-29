import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import { getBuildInfo } from './build-info.config'

const rootDir = fileURLToPath(new URL('.', import.meta.url))
const srcDir = path.resolve(rootDir, 'src/web')
const sharedDir = path.resolve(rootDir, 'src/shared')

const topLevelAliasDirs = [
  'api',
  'assets',
  'components',
  'hooks',
  'layouts',
  'pool',
  'state',
  'typings',
  'utils',
]

function normalizeBase(input: string | undefined) {
  if (!input) {
    return '/'
  }
  if (!input.startsWith('/')) {
    throw new Error('VITE_BASE_PATH must start with "/"')
  }
  return input.endsWith('/') ? input : `${input}/`
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const build_info = getBuildInfo()
  const build_defines = mode === 'production'
    ? {
        __BUILD_DATE__: JSON.stringify(build_info.build_date),
        __GIT_HASH__: JSON.stringify(build_info.git_hash),
      }
    : undefined

  return {
    base: normalizeBase(env.VITE_BASE_PATH),
    define: build_defines,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: [
        { find: '@shared', replacement: sharedDir },
        { find: '@', replacement: srcDir },
        { find: /^App$/, replacement: path.resolve(srcDir, 'App.tsx') },
        { find: /^signals$/, replacement: path.resolve(srcDir, 'signals.ts') },
        ...topLevelAliasDirs.map(dir => ({
          find: new RegExp(`^${dir}/`),
          replacement: `${srcDir}/${dir}/`,
        })),
      ],
      dedupe: ['react', 'react-dom'],
    },
    optimizeDeps: {
      include: [
        'axios',
        'vait',
        'ramda',
        'swr',
        'zustand',
        'react-images-uploading',
        'html2canvas',
        'heic-convert/browser',
        '@juggle/resize-observer',
      ],
    },
    build: {
      outDir: 'dist/client',
      assetsDir: 'assets',
      emptyOutDir: true,
      sourcemap: false,
      target: 'es2022',
      rolldownOptions: {
        output: {
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
    },
  }
})
