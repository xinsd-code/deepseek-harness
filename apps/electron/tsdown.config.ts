import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    entry: { main: 'lib/types/main.js' },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
    external: ['electron'],
  },
  {
    entry: { preload: 'lib/types/preload.js' },
    outDir: 'lib',
    format: ['cjs'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
    external: ['electron'],
    outputOptions: { entryFileNames: 'preload.cjs' },
  },
  {
    entry: { renderer: 'lib/types/renderer/entry.js' },
    outDir: 'lib',
    format: ['esm'],
    platform: 'browser',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
    noExternal: () => true,
    outputOptions: { codeSplitting: false, entryFileNames: 'renderer.js' },
  },
])
