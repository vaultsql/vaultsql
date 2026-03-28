import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react-swc'
import path from 'node:path'
import { defineConfig } from 'vite'
import { config } from 'dotenv'

// Load environment variables from ../env.txt (repo root)
const envPath = path.resolve(__dirname, '../env.txt')
config({ path: envPath })

// https://vite.dev/config/
export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    // Persistent cache for faster rebuilds
    cacheDir: 'node_modules/.vite',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    // Optimize dependency pre-bundling with caching
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query', 'zustand'],
    },
    build: {
      outDir: 'dist',
      sourcemap: false, // Disable sourcemaps in production for faster builds
      chunkSizeWarningLimit: 1000, // Increase limit to avoid warnings
      rollupOptions: {
        output: {
          manualChunks: {
            // React core - separate from other vendors
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            // Large UI libraries
            'ui-vendor': [
              '@radix-ui/react-dialog',
              '@radix-ui/react-popover',
              '@radix-ui/react-separator',
              '@radix-ui/react-slot',
              '@radix-ui/react-tabs',
              '@headlessui/react',
            ],
            // Data fetching and state
            'data-vendor': ['@tanstack/react-query', 'zustand', 'nanostores'],
            // Database drivers (if used in browser)
            'db-vendor': ['mysql2', 'pg'],
          },
        },
      },
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
    },
  }
})
