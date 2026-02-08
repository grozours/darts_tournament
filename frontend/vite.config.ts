import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_PROXY_TARGET || process.env.VITE_API_PROXY_TARGET || 'http://localhost:3000';

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@shared/types': path.resolve(__dirname, '../shared/src/types/index.ts'),
        '@shared': path.resolve(__dirname, '../shared/src'),
      },
    },
    server: {
      port: 5173, // Standard Vite port
      host: true,
      allowedHosts: ['127.0.0.1'],
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
        '/socket.io': {
          target: apiTarget,
          ws: true,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            query: ['@tanstack/react-query'],
            socket: ['socket.io-client'],
            icons: ['lucide-react'],
          },
        },
      },
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        '@tanstack/react-query',
        'socket.io-client',
        'axios',
        'react-hook-form',
        'zod',
        'lucide-react',
      ],
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
    },
  };
});
