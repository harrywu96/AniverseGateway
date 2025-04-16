import { defineConfig } from 'vite';
// @ts-ignore 忽略类型检查以解决导入问题
const react = require('@vitejs/plugin-react');
import electron from 'vite-plugin-electron';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    electron({
      entry: [
        'electron/main/index.ts',
        'electron/preload.ts'
      ],
      vite: {
        build: {
          outDir: 'dist/main',
          rollupOptions: {
            output: {
              entryFileNames: '[name].js',
              chunkFileNames: '[name].js',
              assetFileNames: '[name].[ext]'
            }
          }
        },
      },
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist/renderer',
  },
}); 