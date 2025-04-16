import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
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
