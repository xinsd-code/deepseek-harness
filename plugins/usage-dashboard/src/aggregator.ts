/** Pure cross-session aggregation for dashboard summaries. */

import { computeCost, pricingFor, type PricingTable } from './pricing.ts'
import type {
  BillingLine,
  DailyUsage,
  ModelUsage,
  SessionUsageInput,
  TokenBuckets,
  UsageRange,
  UsageSummary,
} from './types.ts'

const zeroBuckets = (): TokenBuckets => ({
  uncachedInputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  reasoningTokens: 0,
})

const addInto = (target: TokenBuckets, source: TokenBuckets): void => {
  target.uncachedInputTokens += source.uncachedInputTokens
  target.outputTokens += source.outputTokens
  target.cacheReadTokens += source.cacheReadTokens
  target.cacheWriteTokens += source.cacheWriteTokens
  target.reasoningTokens += source.reasoningTokens
}

/** Whether a UTC day falls inside an inclusive range. */
export function inRange(date: string, range: UsageRange): boolean {
  if (range.from !== undefined && date < range.from) return false
  if (range.to !== undefined && date > range.to) return false
  return true
}

function routeKey(usage: Pick<ModelUsage, 'provider' | 'model'>): string {
  return JSON.stringify([usage.provider, usage.model])
}

function addModel(target: Map<string, ModelUsage>, source: ModelUsage): void {
  const key = routeKey(source)
  const current = target.get(key) ?? {
    provider: source.provider,
    model: source.model,
    ...zeroBuckets(),
  }
  addInto(current, source)
  target.set(key, current)
}

/** Aggregate every selected event day; one session contributes at most once to the count. */
export function aggregateSessions(
  sessions: readonly SessionUsageInput[],
  range: UsageRange,
  pricing: PricingTable,
): UsageSummary {
  const totals = zeroBuckets()
  const byRoute = new Map<string, ModelUsage>()
  const daily = new Map<string, { totals: TokenBuckets; byRoute: Map<string, ModelUsage> }>()
  let sessionsCount = 0

  for (const session of sessions) {
    let contributes = false
    for (const day of session.usage.daily) {
      if (!inRange(day.date, range)) continue
      contributes = true
      addInto(totals, day.totals)
      const dayTarget = daily.get(day.date) ?? { totals: zeroBuckets(), byRoute: new Map() }
      addInto(dayTarget.totals, day.totals)
      for (const usage of day.byModel) {
        addModel(byRoute, usage)
        addModel(dayTarget.byRoute, usage)
      }
      daily.set(day.date, dayTarget)
    }
    if (contributes) sessionsCount += 1
  }

  const byModel = [...byRoute.values()]
    .sort((left, right) => totalOf(right) - totalOf(left))
  const billing: BillingLine[] = byModel.flatMap((usage) => {
    const rate = pricingFor(usage.provider, usage.model, pricing)
    if (rate === undefined) return []
    return [{
      provider: usage.provider,
      model: usage.model,
      usage: {
        uncachedInputTokens: usage.uncachedInputTokens,
        outputTokens: usage.outputTokens,
        cacheReadTokens: usage.cacheReadTokens,
        cacheWriteTokens: usage.cacheWriteTokens,
        reasoningTokens: usage.reasoningTokens,
      },
      cost: computeCost(usage, rate),
      currency: rate.currency,
    }]
  }).sort((left, right) => right.cost - left.cost)

  const dailyArray: DailyUsage[] = [...daily.entries()]
    .map(([date, value]) => ({ date, totals: value.totals, byModel: [...value.byRoute.values()] }))
    .sort((left, right) => left.date.localeCompare(right.date))

  return {
    totals,
    byModel,
    billing,
    daily: dailyArray,
    sessionsCount,
    rangeFrom: dailyArray.at(0)?.date ?? null,
    rangeTo: dailyArray.at(-1)?.date ?? null,
  }
}

function totalOf(usage: TokenBuckets): number {
  return usage.uncachedInputTokens
    + usage.cacheReadTokens
    + usage.cacheWriteTokens
    + usage.outputTokens
}
