/// <reference types="vitest" />

import legacy from '@vitejs/plugin-legacy'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { defineConfig } from 'vite'
import pkg from './package.json'
import { ideTraceVue } from 'chrome-ide-trace/vite'
import { versionInfoUtil } from '../../common/utils/versionInfoUtil';
import { VitePWA } from 'vite-plugin-pwa'
import manifest from "./manifest.json"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    !process.env.VITEST && ideTraceVue(),
    vue(),
    legacy(),
    VitePWA({
      registerType: "autoUpdate",
      selfDestroying: true,
      manifest: manifest as any,
    })
  ].filter(Boolean) as any,
  optimizeDeps: {
    // The workspace carries multiple peer-variant copies of vue in the pnpm store. Pre-bundling
    // vue lets esbuild wrap the runtime in lazy CJS-interop (__esm) blocks, and vue-router's
    // module-scope defineComponent() call then runs before @vue/shared is initialized
    // ("isFunction is not a function", app never mounts). Serving these ESM-native packages
    // unbundled avoids the interop wrapper entirely.
    exclude: ['vue', 'vue-router', '@vue/shared', '@vue/reactivity', '@vue/runtime-core', '@vue/runtime-dom'],
  },
  resolve: {
    dedupe: ['vue', 'pinia'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@common': path.resolve(__dirname, '../../common')
    },
  },
  define: {
    'import.meta.env.VITE_APP_VERSION_INFO': JSON.stringify(JSON.stringify(versionInfoUtil.getVersionInfo(pkg.version)))
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.ts']
  },
  server: {
    port: 8100
  }
})
