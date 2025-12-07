import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import renderer from 'vite-plugin-electron-renderer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: 'src/main/index.ts',
        onstart({ startup }) {
          const env = { ...process.env }
          delete env.ELECTRON_RUN_AS_NODE
          return startup(undefined, { env })
        },
        vite: {
          resolve: {
            alias: {
              '@shared': path.resolve(__dirname, 'src/shared'),
            },
          },
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              output: {
                format: 'esm',
                entryFileNames: 'main.mjs',
              },
            },
          },
        },
      },
      preload: {
        input: {
          index: path.join(__dirname, 'src/preload/index.ts'),
        },
        vite: {
          resolve: {
            alias: {
              '@shared': path.resolve(__dirname, 'src/shared'),
            },
          },
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              output: {
                format: 'cjs',
                entryFileNames: 'preload.cjs',
              },
            },
          },
        },
      },
    }),
    renderer(),
  ],
  resolve: {
    alias: {
      '@renderer': path.resolve(__dirname, 'src/renderer'),
      '@main': path.resolve(__dirname, 'src/main'),
      '@preload': path.resolve(__dirname, 'src/preload'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  build: {
    outDir: 'dist',
  },
})
