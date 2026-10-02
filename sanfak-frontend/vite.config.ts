/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const ANTD_EAGER_SUBPATHS = [
  '/node_modules/antd/es/config-provider/',
  '/node_modules/antd/es/app/',
  '/node_modules/antd/es/message/',
  '/node_modules/antd/es/notification/',
  '/node_modules/antd/es/modal/',
  '/node_modules/antd/es/button/',
  '/node_modules/antd/es/dropdown/',
  '/node_modules/antd/es/avatar/',
  '/node_modules/antd/es/spin/',
  '/node_modules/antd/es/flex/',
  '/node_modules/antd/es/result/',
  '/node_modules/antd/es/input/',
  '/node_modules/antd/es/form/',
  '/node_modules/antd/es/_util/',
  '/node_modules/antd/es/theme/',
  '/node_modules/antd/es/style/',
  '/node_modules/antd/es/icon/',
  '/node_modules/antd/locale/',
  '/node_modules/antd/es/locale/',
];

function chunkVendors(id: string): string | undefined {
  if (!id.includes('node_modules')) return undefined;
  const normalized = id.replace(/\\/g, '/');

  if (
    normalized.includes('/node_modules/react/') ||
    normalized.includes('/node_modules/react-dom/') ||
    normalized.includes('/node_modules/react-router') ||
    normalized.includes('/node_modules/scheduler/')
  ) {
    return 'react-vendor';
  }

  if (normalized.includes('/node_modules/@tanstack/react-query/')) {
    return 'query-vendor';
  }

  if (
    normalized.includes('/node_modules/i18next/') ||
    normalized.includes('/node_modules/react-i18next/')
  ) {
    return 'i18n-vendor';
  }

  if (normalized.includes('/node_modules/xlsx/')) {
    return 'xlsx-vendor';
  }

  if (ANTD_EAGER_SUBPATHS.some((p) => normalized.includes(p))) {
    return 'antd-vendor';
  }

  return undefined;
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: chunkVendors,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
});
