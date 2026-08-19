/**
 * Package entry point for the usage-dashboard plugin.
 *
 * The lightweight object plugin waits for the session services before loading
 * the gateway implementation. This keeps unrelated Web and Electron carrier
 * services out of the package's startup critical path.
 *
 * @module dsh-usage-dashboard
 */

import type { Context } from '@deepseek-ai/cordis'
import type { UsageDashboardConfig } from './config.ts'
import { usageDashboardConfigSchema } from './config.ts'

/** Services required before the usage projection and gateway can start. */
export const inject = [
  'sessionProjections',
  'sessionProjectionCache',
  'sessionPersistence',
  'sessions',
]

/** Validated Cordis configuration. */
export const Config = usageDashboardConfigSchema

/** Load and construct the gateway after its required services are available. */
export async function apply(ctx: Context, config: UsageDashboardConfig): Promise<void> {
  const { UsageStatsGateway } = await import('./gateway.ts')
  new UsageStatsGateway(ctx, config)
}

export default { inject, Config, apply }
export type { UsageDashboardConfig } from './config.ts'
export type * from './types.ts'
