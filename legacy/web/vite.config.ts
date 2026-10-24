import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

const rootDir = fileURLToPath(new URL('.', import.meta.url))
const srcDir = path.resolve(rootDir, 'src')

const topLevelAliasDirs = [
  'api',
  'assets',
  'components',
  'hooks',
  'layouts',
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

  return {
    base: normalizeBase(env.VITE_BASE_PATH),
    plugins: [react()],
    resolve: {
      alias: [
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
        'new-vait',
        'ramda',
        'swr',
        'zustand',
        'react-images-uploading',
        'html2canvas',
        'heic-convert/browser',
        '@juggle/resize-observer',
      ],
    },
    server: {
      port: 3000,
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false,
      target: 'es2018',
    },
  }
})
