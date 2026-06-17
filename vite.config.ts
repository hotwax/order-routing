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
    ideTraceVue(),
    vue(),
    legacy(),
    VitePWA({
      registerType: "autoUpdate",
      selfDestroying: true,
      manifest: manifest as any,
      devOptions: {
        enabled: true
      }
    })
  ],
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
    environment: 'jsdom'
  },
  server: {
    port: 8100
  }
})
