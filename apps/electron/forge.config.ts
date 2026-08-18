import type { ForgeConfig } from '@electron-forge/shared-types'
import { resolve } from 'node:path'

const config: ForgeConfig = {
  packagerConfig: {
    appBundleId: 'ai.deepseek.harness',
    appCategoryType: 'public.app-category.developer-tools',
    asar: false,
    executableName: 'DeepSeek Harness',
    extraResource: [resolve(import.meta.dirname, 'web-dist')],
    icon: resolve(import.meta.dirname, 'assets', 'app-icon.icns'),
    ignore: [/node_modules[/\\]electron(?:[/\\]|$)/],
    name: 'DeepSeek Harness',
    // pnpm deploy already materializes the complete production closure.
    prune: false,
  },
  makers: [{ name: '@electron-forge/maker-zip', platforms: ['darwin'] }],
}

export default config
