import { describe, expect, it } from 'vitest'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type { TokenUsage } from '@deepseek-ai/dsh-llm'
import { aggregateSessions } from '../src/aggregator.ts'
import { computeCost, DEFAULT_PRICING, pricingFor } from '../src/pricing.ts'
import type { ModelUsage, SessionUsageInput, TokenBuckets } from '../src/types.ts'
import { usageDashboardProjectionDefinition } from '../src/usage-projection.ts'

const headerEvent = (provider: string, model: string, time: number): SessionEvent => ({
  type: 'request/header',
  time,
  data: { header: { config: { model, provider }, adapterDefaults: {} } },
}) as SessionEvent

const usageChunk = (turn: number, step: number, time: number, usage: TokenUsage): SessionEvent => ({
  type: 'assistant/chunk',
  time,
  data: { turn, step, chunk: { type: 'usage', usage } },
}) as SessionEvent

const usageMessage = (turn: number, step: number, time: number, usage: TokenUsage): SessionEvent => ({
  type: 'assistant/message',
  time,
  data: { turn, step, usage },
}) as SessionEvent

const tokenUsage = (
  inputTokens: number,
  outputTokens: number,
  cacheRead = 0,
  cacheWrite = 0,
  reasoning = 0,
): TokenUsage => ({
  inputTokens,
  outputTokens,
  cacheReadTokens: cacheRead,
  cacheWriteTokens: cacheWrite,
  reasoningTokens: reasoning,
})

const modelUsage = (
  provider: string,
  model: string,
  buckets: Partial<TokenBuckets> = {},
): ModelUsage => ({
  provider,
  model,
  uncachedInputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  reasoningTokens: 0,
  ...buckets,
})

const session = (date: string, ...byModel: ModelUsage[]): SessionUsageInput => {
  const totals: TokenBuckets = {
    uncachedInputTokens: byModel.reduce((sum, usage) => sum + usage.uncachedInputTokens, 0),
    outputTokens: byModel.reduce((sum, usage) => sum + usage.outputTokens, 0),
    cacheReadTokens: byModel.reduce((sum, usage) => sum + usage.cacheReadTokens, 0),
    cacheWriteTokens: byModel.reduce((sum, usage) => sum + usage.cacheWriteTokens, 0),
    reasoningTokens: byModel.reduce((sum, usage) => sum + usage.reasoningTokens, 0),
  }
  return { usage: { byModel, daily: [{ date, totals, byModel }] } }
}

describe('usageDashboardProjectionDefinition', () => {
  it('attributes disjoint token buckets to the active provider and model', () => {
    const def = usageDashboardProjectionDefinition
    let state = def.init()
    const day1 = Date.parse('2026-08-01T10:00:00Z')
    const day2 = Date.parse('2026-08-02T10:00:00Z')
    state = def.apply(state, headerEvent('deepseek-official', 'deepseek-v4-flash', day1))
    state = def.apply(state, usageChunk(1, 1, day1, tokenUsage(10, 5, 2, 1, 3)))
    state = def.apply(state, headerEvent('deepseek-official', 'deepseek-v4-pro', day2))
    state = def.apply(state, usageChunk(2, 1, day2, tokenUsage(20, 8, 4, 2)))

    const view = def.view(state)
    expect(view.byModel).toEqual([
      modelUsage('deepseek-official', 'deepseek-v4-flash', {
        uncachedInputTokens: 10,
        outputTokens: 5,
        cacheReadTokens: 2,
        cacheWriteTokens: 1,
        reasoningTokens: 3,
      }),
      modelUsage('deepseek-official', 'deepseek-v4-pro', {
        uncachedInputTokens: 20,
        outputTokens: 8,
        cacheReadTokens: 4,
        cacheWriteTokens: 2,
      }),
    ])
    expect(view.daily.map(day => day.date)).toEqual(['2026-08-01', '2026-08-02'])
  })

  it('replaces an early usage chunk with the final sample without double counting', () => {
    const def = usageDashboardProjectionDefinition
    let state = def.init()
    const beforeMidnight = Date.parse('2026-08-01T23:59:00Z')
    const afterMidnight = Date.parse('2026-08-02T00:01:00Z')
    state = def.apply(state, headerEvent('deepseek-official', 'deepseek-v4-flash', beforeMidnight))
    state = def.apply(state, usageChunk(1, 1, beforeMidnight, tokenUsage(10, 5)))
    state = def.apply(state, usageMessage(1, 1, afterMidnight, tokenUsage(12, 6)))

    const view = def.view(state)
    expect(view.byModel[0]?.uncachedInputTokens).toBe(12)
    expect(view.daily.find(day => day.date === '2026-08-01')).toBeUndefined()
    expect(view.daily.find(day => day.date === '2026-08-02')?.totals.uncachedInputTokens).toBe(12)
  })
})

describe('aggregateSessions', () => {
  const inputs = [
    session('2026-08-01', modelUsage('deepseek-official', 'deepseek-v4-flash', {
      uncachedInputTokens: 1_000_000,
      outputTokens: 500_000,
      cacheReadTokens: 200_000,
    })),
    session('2026-08-02',
      modelUsage('deepseek-official', 'deepseek-v4-pro', {
        uncachedInputTokens: 100,
        outputTokens: 50,
        cacheReadTokens: 20,
      }),
      modelUsage('openai', 'deepseek-v4-flash', { uncachedInputTokens: 10 }),
    ),
  ]

  it('applies the selected range to every total and the contributing-session count', () => {
    const out = aggregateSessions(inputs, { from: '2026-08-02', to: '2026-08-02' }, DEFAULT_PRICING)
    expect(out.sessionsCount).toBe(1)
    expect(out.totals.uncachedInputTokens).toBe(110)
    expect(out.daily).toHaveLength(1)
    expect(out.byModel).toHaveLength(2)
    expect(out.billing.map(line => line.model)).toEqual(['deepseek-v4-pro'])
    expect(out.rangeFrom).toBe('2026-08-02')
    expect(out.rangeTo).toBe('2026-08-02')
  })

  it('keeps billing unrounded and excludes non-DeepSeek provider routes', () => {
    const out = aggregateSessions(inputs, {}, DEFAULT_PRICING)
    expect(out.billing).toHaveLength(2)
    expect(out.billing.every(line => line.provider === 'deepseek-official')).toBe(true)
    expect(out.billing.find(line => line.model === 'deepseek-v4-flash')?.cost).toBe(2.004)
    expect(out.billing[0]?.usage).not.toHaveProperty('provider')
    expect(out.billing[0]?.usage).not.toHaveProperty('model')
  })
})

describe('DeepSeek pricing', () => {
  it('uses cache-hit and cache-miss prices as disjoint inputs', () => {
    const pricing = pricingFor('deepseek-official', 'deepseek-v4-flash')
    expect(pricing).toBeDefined()
    expect(computeCost({
      uncachedInputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cacheReadTokens: 1_000_000,
      cacheWriteTokens: 1_000_000,
      reasoningTokens: 0,
    }, pricing!)).toBe(4.02)
  })
})
