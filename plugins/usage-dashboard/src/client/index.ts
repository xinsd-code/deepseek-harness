/**
 * Usage dashboard client half: the browser/Electron entry.
 *
 * Responsibilities:
 *  - Mount this package's own Typert Remote namespace (`usageStats`), because
 *    out-of-tree packages are not aggregated by `dsh-api-remotes`.
 *  - Register the `usage` locale namespace.
 *  - Contribute a `settings.section` page shared by browser and Electron.
 *
 * The dock action's injected verb `loadSummary()` is defined here (closure over
 * `ctx`) and calls the host gateway over the Remote carrier.
 *
 * @module dsh-usage-dashboard/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only edges that pull the matching context merges into this client.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { TYPERT_REMOTE } from '../../lib/typert.remote-client.js'
import type { RemoteResult, TypertClientRemote, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import type { UsageRange, UsageSummary } from '../types.ts'
import type { UsageDashboardInjected } from './slots.ts'
import { DashboardPage } from './dashboard/DashboardPage.tsx'
import { en, zh, type UsageKey } from './locales.ts'

export { DashboardPage } from './dashboard/DashboardPage.tsx'
export type { UsageKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** This plugin's copy. */
    usage: UsageKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'usage'

/** Runtime service required before this package mounts its Remote namespace. */
export const inject = ['remote']

/** Minimal structural view of the remote carrier we use out-of-tree. */
interface UsageRemote extends TypertClientRemote {
  usageStats: { summary: (range: UsageRange) => Promise<RemoteResult<UsageSummary>> }
}

/**
 * Client plugin body: mount the Remote namespace, register copy, and contribute
 * the dock action.
 * @param ctx - client root context.
 */
export async function apply(ctx: ClientContext): Promise<() => Promise<void>> {
  const disposeRemote = await ctx.remote.$mount(TYPERT_REMOTE as TypertRemoteContribution)
  await ctx.inject(['remote', 'remote.usageStats', 'locale', 'slots'], applyDashboard)
  return disposeRemote
}

/** Register UI contributions only after this package's Remote namespace exists. */
function applyDashboard(ctx: ClientContext): void {
  const remote = ctx.remote as unknown as UsageRemote
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'usage-dashboard: dictionaries')

  const t = ctx.locale.bind(NS) as UsageDashboardInjected['t']
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'usage',
    order: 20,
    label: () => t('open'),
    locale: NS,
    inject: (): UsageDashboardInjected => ({
      t,
      loadSummary: async (range) => {
        const result = await remote.usageStats.summary(range)
        if (!result.ok) {
          throw new Error(`usageStats.summary failed: ${result.error.code}: ${result.error.message}`)
        }
        return result.value
      },
    }),
  }, DashboardPage))
}

export type { UsageDashboardInjected } from './slots.ts'
