/// <reference types="vitest" />

import legacy from '@vitejs/plugin-legacy'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { defineConfig, loadEnv, type Rollup } from 'vite'
import pkg from './package.json'
import { ideTraceVue } from 'chrome-ide-trace/vite'
import { versionInfoUtil } from '../../common/utils/versionInfoUtil';
import { commonEnvPlugin } from '../../common/vite/commonEnvPlugin'
import { VitePWA } from 'vite-plugin-pwa'
import manifest from "./manifest.json"

// Package name from the last node_modules segment of a module id, so a pnpm store path like
// .pnpm/@vue+devtools-kit@x/node_modules/mitt resolves to "mitt" and not to anything named "vue".
function packageName(id: string) {
  const index = id.lastIndexOf('/node_modules/')
  if (index < 0) return undefined
  const [scopeOrName, name] = id.slice(index + '/node_modules/'.length).split('/')
  return scopeOrName.startsWith('@') ? `${scopeOrName}/${name}` : scopeOrName
}

const VENDOR_IONIC = new Set(['@ionic/core', 'ionicons', '@stencil/core'])
const VENDOR_FRAMEWORK = new Set(['vue', 'vue-router', 'pinia', 'pinia-plugin-persistedstate', 'vue-i18n', '@ionic/vue', '@ionic/vue-router'])

// A module is eager when an entry reaches it through static imports alone, i.e. it loads at startup.
const eagerModules = new Map<string, boolean>()
function isEager(id: string, getModuleInfo: Rollup.GetModuleInfo): boolean {
  if (eagerModules.has(id)) return eagerModules.get(id)!
  eagerModules.set(id, false) // breaks import cycles while the answer is computed
  const info = getModuleInfo(id)
  const eager = !!info && (info.isEntry || info.importers.some(importer => isEager(importer, getModuleInfo)))
  eagerModules.set(id, eager)
  return eager
}

// Third-party code that rarely changes goes in its own chunks; app and @common code stay with Rollup's
// per-route splitting. Vite's runtime helpers get their own chunk so no vendor chunk imports back from
// app code, which would create a chunk cycle and break startup ("Cannot access X before initialization").
function manualChunks(id: string, { getModuleInfo }: { getModuleInfo: Rollup.GetModuleInfo }) {
  if (id.includes('vite/preload-helper') || id.includes('commonjsHelpers')) return 'vendor-runtime'
  const pkg = packageName(id)
  if (!pkg) return undefined
  if (VENDOR_IONIC.has(pkg)) return 'vendor-ionic'
  if (VENDOR_FRAMEWORK.has(pkg) || pkg.startsWith('@vue/') || pkg.startsWith('@intlify/')) return 'vendor-framework'
  // Only packages needed at startup; a package used only by a lazy route stays with that route.
  if (isEager(id, getModuleInfo)) return 'vendor-libs'
  return undefined
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const appBuild = JSON.parse(env.VITE_APP_VERSION_CONFIG).buildVersion
  return {
  // A version build (buildVersion vX.Y.Z in VITE_APP_VERSION_CONFIG) is self-contained under /vX.Y.Z/; an empty buildVersion is the root bootstrap.
  base: appBuild ? `/${appBuild}/` : '/',
  build: {
    outDir: appBuild ? `dist/${appBuild}` : 'dist',
    rollupOptions: {
      output: { manualChunks }
    }
  },
  plugins: [
    commonEnvPlugin(),
    !process.env.VITEST && ideTraceVue(),
    vue(),
    legacy(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false, // The app registers the worker and reloads only from Settings.
      workbox: {
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // The root worker must not serve root HTML for a tenant's versioned URL.
        navigateFallbackDenylist: appBuild ? [] : [/^\/v\d+\.\d+\.\d+\//],
      },
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
    include: ['tests/**/*.test.ts'],
    server: {
      deps: { inline: ['@ionic/core'] }
    }
  },
  server: {
    port: 8100
  }
  }
})
