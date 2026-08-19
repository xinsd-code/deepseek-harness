/** Cordis Host gateway for cross-session token usage and DeepSeek billing. */

import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session'
import '@deepseek-ai/dsh-session-projection-cache'
import '@deepseek-ai/dsh-session-persistence'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { aggregateSessions } from './aggregator.ts'
import {
  DEFAULT_PRICING,
  type PricingTable,
} from './pricing.ts'
import type { UsageDashboardConfig } from './config.ts'
import type {
  SessionUsageInput,
  SessionUsageProjection,
  UsageRange,
  UsageSummary,
} from './types.ts'
import { usageDashboardProjectionDefinition } from './usage-projection.ts'

const DAY = /^\d{4}-\d{2}-\d{2}$/

function validateRange(range: UsageRange): void {
  if (range.from !== undefined && !DAY.test(range.from)) {
    throw new Error(`usage dashboard range.from must be YYYY-MM-DD, received ${JSON.stringify(range.from)}`)
  }
  if (range.to !== undefined && !DAY.test(range.to)) {
    throw new Error(`usage dashboard range.to must be YYYY-MM-DD, received ${JSON.stringify(range.to)}`)
  }
  if (range.from !== undefined && range.to !== undefined && range.from > range.to) {
    throw new Error('usage dashboard range.from must not be after range.to')
  }
}

/** Remote-only service that owns the dashboard projection and summary query. */
export class UsageStatsGateway extends TypertRemoteService {
  static inject = [
    'sessionProjections',
    'sessionProjectionCache',
    'sessionPersistence',
    'sessions',
  ]

  private readonly pricing: PricingTable

  constructor(ctx: Context, config: UsageDashboardConfig = { pricing: DEFAULT_PRICING }) {
    super(ctx, 'usageStats')
    this.pricing = config.pricing
    this.ctx.effect(() => this.ctx.sessionProjections.register(usageDashboardProjectionDefinition))
  }

  /** Read an open session's live projection or replay a persisted session cold. */
  private async readUsage(id: SessionId): Promise<SessionUsageProjection> {
    const open = this.ctx.sessions.get(id)
    if (open !== undefined) {
      const view = this.ctx.sessionProjections.snapshot(open).values.usageDashboard
      if (view !== undefined) return view
    }
    const cold = await this.ctx.sessionProjectionCache.coldSnapshot(id)
    return cold.values.usageDashboard ?? { byModel: [], daily: [] }
  }

  /**
   * Aggregate persisted sessions inside an inclusive UTC day range.
   * @param range - empty for all time, otherwise inclusive `YYYY-MM-DD` bounds.
   * @returns token usage and DeepSeek billing estimates for the selected range.
   */
  @Remote('summary')
  async summary(range: UsageRange): Promise<UsageSummary> {
    validateRange(range)
    const headers = await this.ctx.sessionPersistence.list()
    const inputs = await Promise.all(headers.map(async (header): Promise<SessionUsageInput | undefined> => {
      const usage = await this.readUsage(header.id)
      return usage.daily.length > 0 ? { usage } : undefined
    }))
    return aggregateSessions(inputs.filter((input): input is SessionUsageInput => input !== undefined), range, this.pricing)
  }
}

export default UsageStatsGateway
