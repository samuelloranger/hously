import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import type { ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { serviceWorkerPlugin } from './vite-plugin-service-worker';

// Plugin to exclude test files from build
const excludeTestFiles = (): Plugin => {
  const isTestFile = (id: string): boolean => {
    return id.includes('/__tests__/') || id.includes('.test.') || id.includes('/test-utils/') || id.includes('/test/');
  };

  return {
    name: 'exclude-test-files',
    resolveId(id) {
      // Exclude test files and test utilities from build
      if (isTestFile(id)) {
        // Return empty module to exclude from build
        return { id: '\0excluded:' + id, moduleSideEffects: false };
      }
      return null;
    },
    load(id) {
      // Return empty module for excluded test files
      if (id.startsWith('\0excluded:')) {
        return 'export {}';
      }
      return null;
    },
  };
};

const isServerResponse = (value: unknown): value is ServerResponse => {
  return (
    typeof value === 'object' && value !== null && 'headersSent' in value && 'writeHead' in value && 'end' in value
  );
};

export default defineConfig(({ mode }) => {
  // Load env from root directory (parent of apps/web)
  const env = loadEnv(mode, path.resolve(__dirname, '../..'), '');
  const plugins = [react(), excludeTestFiles(), serviceWorkerPlugin()];
  const apiPort = env.API_PORT || '5001';
  const apiHost = env.API_HOST || `http://localhost:${apiPort}`;
  console.log(`Using API host: ${apiHost}`);

  return {
    plugins,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      rolldownOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
              return 'react';
            }
            if (id.includes('node_modules/@tanstack/react-router')) {
              return 'router';
            }
            if (id.includes('node_modules/@tanstack/react-query')) {
              return 'query';
            }
            if (id.includes('node_modules/@dnd-kit/')) {
              return 'dnd';
            }
            if (id.includes('node_modules/@tiptap/')) {
              return 'tiptap';
            }
            if (
              id.includes('node_modules/@headlessui/') ||
              id.includes('node_modules/@radix-ui/')
            ) {
              return 'ui';
            }
          },
        },
      },
    },
    server: {
      port: 5173,
      host: true,
      proxy: {
        '/api': {
          target: apiHost,
          changeOrigin: true,
          secure: false,
          configure: (proxy, _options) => {
            proxy.on('error', (err: NodeJS.ErrnoException, _req, res) => {
              // Only log non-connection errors (backend may not be running)
              if (err.code !== 'ECONNREFUSED' && err.code !== 'ENOTFOUND') {
                console.error('Proxy error:', err);
              }
              // Return a proper error response if response object is available
              if (isServerResponse(res) && !res.headersSent) {
                res.writeHead(502, {
                  'Content-Type': 'application/json',
                });
                res.end(
                  JSON.stringify({
                    error: `Backend server is not available. Please ensure the backend is running on ${apiHost}`,
                    message: 'To start the backend, run: docker compose up',
                  })
                );
              }
            });
            proxy.on('proxyReq', proxyReq => {
              // Handle connection errors more gracefully
              proxyReq.on('error', (err: NodeJS.ErrnoException) => {
                if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
                  // Silently handle connection refused errors (backend not running)
                  return;
                }
              });
            });
          },
        },
      },
    },
    test: {
      globals: true,
      environment: 'happy-dom',
      setupFiles: ['./src/test/setup.ts'],
    },
  };
});
