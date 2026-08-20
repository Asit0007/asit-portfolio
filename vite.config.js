import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
  ],
  build: {
    target: 'esnext',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        // Function form, not the object form. With `manualChunks: { react:
        // ['react','react-dom'] }` Rollup hoisted React into whichever chunk
        // imported it and emitted a 0-byte `react` chunk, so the split the
        // config was asking for never actually happened.
        //
        // Order matters: the rapier test must run before the @react-three
        // one, or @react-three/rapier lands in the fiber chunk and drags the
        // 2 MB WASM wrapper out of its lazy boundary.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('rapier')) return 'rapier'
          if (id.includes('@react-three')) return 'fiber'
          if (/node_modules\/three\//.test(id)) return 'three'
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react'
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['@dimforge/rapier3d-compat'],
  },
  server: {
    headers: {
      // Required for Rapier WASM threading
      'Cross-Origin-Opener-Policy':   'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
})
