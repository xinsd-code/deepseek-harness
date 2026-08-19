/** DeepSeek rate-card lookup and billing arithmetic. */

import type { TokenBuckets } from './types.ts'

/** Per-million-token prices for one DeepSeek model. */
export interface ModelPricing {
  /** Input tokens that missed the cache. */
  input: number
  /** Output tokens, including reasoning tokens. */
  output: number
  /** Input tokens served from the cache. */
  cacheRead: number
  /** Cache-write input; DeepSeek bills it at the cache-miss rate by default. */
  cacheWrite: number
  currency: string
}

/** Configurable model id to price mapping. */
export type PricingTable = Record<string, ModelPricing>

const FLASH: ModelPricing = {
  input: 1,
  output: 2,
  cacheRead: 0.02,
  cacheWrite: 1,
  currency: 'CNY',
}

/**
 * Default official DeepSeek API prices per million tokens. Deployments can
 * replace any row through the plugin's `pricing` Cordis configuration.
 */
export const DEFAULT_PRICING: PricingTable = {
  'deepseek-v4-flash': FLASH,
  'deepseek-v4-pro': {
    input: 3,
    output: 6,
    cacheRead: 0.025,
    cacheWrite: 3,
    currency: 'CNY',
  },
  'deepseek-chat': FLASH,
  'deepseek-reasoner': FLASH,
}

const MILLION = 1_000_000

/** Whether a provider route identifies a DeepSeek API adapter. */
export function isDeepSeekProvider(provider: string): boolean {
  return provider.toLowerCase().includes('deepseek')
}

/** Return the configured DeepSeek price, or undefined for an unpriced route. */
export function pricingFor(
  provider: string,
  model: string,
  pricing: PricingTable = DEFAULT_PRICING,
): ModelPricing | undefined {
  if (!isDeepSeekProvider(provider)) return undefined
  return pricing[model]
}

/** Compute an unrounded estimated cost; presentation owns decimal formatting. */
export function computeCost(usage: TokenBuckets, pricing: ModelPricing): number {
  return (
    usage.uncachedInputTokens * pricing.input
    + usage.outputTokens * pricing.output
    + usage.cacheReadTokens * pricing.cacheRead
    + usage.cacheWriteTokens * pricing.cacheWrite
  ) / MILLION
}
