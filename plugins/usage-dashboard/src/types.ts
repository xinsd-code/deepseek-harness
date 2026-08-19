/** Shared Host and Client types for the usage dashboard. */

/** Disjoint provider-reported token buckets. Reasoning is an output subdivision. */
export interface TokenBuckets {
  uncachedInputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  reasoningTokens: number
}

/** Usage accumulated for one provider route and model. */
export interface ModelUsage extends TokenBuckets {
  provider: string
  model: string
}

/** One calendar day's usage, grouped by provider route and model. */
export interface DailyUsage {
  /** UTC date in `YYYY-MM-DD` form. */
  date: string
  totals: TokenBuckets
  byModel: ModelUsage[]
}

/** One DeepSeek model's estimated billing line. */
export interface BillingLine {
  provider: string
  model: string
  usage: TokenBuckets
  /** Unrounded currency amount computed from the configured rate card. */
  cost: number
  currency: string
}

/** Cross-session usage returned by the Host gateway. */
export interface UsageSummary {
  totals: TokenBuckets
  byModel: ModelUsage[]
  billing: BillingLine[]
  daily: DailyUsage[]
  /** Sessions with at least one usage sample inside the selected range. */
  sessionsCount: number
  /** Earliest contributing UTC day, or null when the range has no usage. */
  rangeFrom: string | null
  /** Latest contributing UTC day, or null when the range has no usage. */
  rangeTo: string | null
}

/** Inclusive UTC day range accepted by the Host gateway. */
export interface UsageRange {
  from?: string
  to?: string
}

/** Projection view for one session. */
export interface SessionUsageProjection {
  byModel: ModelUsage[]
  daily: DailyUsage[]
}

/** One session reduced to the projection consumed by the aggregator. */
export interface SessionUsageInput {
  usage: SessionUsageProjection
}
