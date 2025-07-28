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
            // 移除node-fetch的external配置，让它和依赖一起被打包
            // external: ['node-fetch'],
            output: {
              entryFileNames: (chunkInfo) => {
                if (chunkInfo.name === 'electron/preload') {
                  return 'preload.js';
                } else if (chunkInfo.name === 'electron/main/index') {
                  return 'index.js';
                } else {
                  return '[name].js';
                }
              },
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
      '@aniversegateway/shared': resolve(__dirname, '../shared'),
    },
  },
  build: {
    outDir: 'dist/renderer',
  },
});