/** Per-session token usage folded by provider, model, and UTC day. */

import { z } from 'zod'
import { canonicalHeader } from '@deepseek-ai/dsh-session'
import type { TokenUsage } from '@deepseek-ai/dsh-llm'
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection'
import type {
  DailyUsage,
  ModelUsage,
  SessionUsageProjection,
  TokenBuckets,
} from './types.ts'

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    usageDashboard: SessionUsageProjection
  }
}

const bucketSchema = z.object({
  uncachedInputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  cacheReadTokens: z.number().int().nonnegative(),
  cacheWriteTokens: z.number().int().nonnegative(),
  reasoningTokens: z.number().int().nonnegative(),
}).strict()

const modelUsageSchema = bucketSchema.extend({
  provider: z.string(),
  model: z.string(),
}).strict()

const projectionSchema = z.object({
  byModel: z.array(modelUsageSchema),
  daily: z.array(z.object({
    date: z.string(),
    totals: bucketSchema,
    byModel: z.array(modelUsageSchema),
  }).strict()),
}).strict()

const zeroBuckets = (): TokenBuckets => ({
  uncachedInputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  reasoningTokens: 0,
})

const bucketsFrom = (usage: TokenUsage): TokenBuckets => ({
  uncachedInputTokens: usage.inputTokens,
  outputTokens: usage.outputTokens,
  cacheReadTokens: usage.cacheReadTokens ?? 0,
  cacheWriteTokens: usage.cacheWriteTokens ?? 0,
  reasoningTokens: usage.reasoningTokens ?? 0,
})

const bucketsEqual = (left: TokenBuckets, right: TokenBuckets): boolean =>
  left.uncachedInputTokens === right.uncachedInputTokens
  && left.outputTokens === right.outputTokens
  && left.cacheReadTokens === right.cacheReadTokens
  && left.cacheWriteTokens === right.cacheWriteTokens
  && left.reasoningTokens === right.reasoningTokens

const addReplacing = (
  totals: TokenBuckets,
  previous: TokenBuckets | undefined,
  next: TokenBuckets,
): TokenBuckets => ({
  uncachedInputTokens: totals.uncachedInputTokens - (previous?.uncachedInputTokens ?? 0) + next.uncachedInputTokens,
  outputTokens: totals.outputTokens - (previous?.outputTokens ?? 0) + next.outputTokens,
  cacheReadTokens: totals.cacheReadTokens - (previous?.cacheReadTokens ?? 0) + next.cacheReadTokens,
  cacheWriteTokens: totals.cacheWriteTokens - (previous?.cacheWriteTokens ?? 0) + next.cacheWriteTokens,
  reasoningTokens: totals.reasoningTokens - (previous?.reasoningTokens ?? 0) + next.reasoningTokens,
})

interface Route {
  provider: string
  model: string
}

interface UsageSample extends Route {
  day: string
  turn: number
  step: number
  buckets: TokenBuckets
}

interface UsageDashboardState {
  byRoute: Record<string, ModelUsage>
  byDay: Record<string, Record<string, ModelUsage>>
  currentRoute: Route | null
  last: UsageSample | null
}

function routeKey(route: Route): string {
  return JSON.stringify([route.provider, route.model])
}

function updatedUsage(
  current: ModelUsage | undefined,
  route: Route,
  previous: TokenBuckets | undefined,
  next: TokenBuckets,
): ModelUsage {
  return {
    provider: route.provider,
    model: route.model,
    ...addReplacing(current ?? zeroBuckets(), previous, next),
  }
}

function totalsOf(byRoute: Record<string, ModelUsage>): TokenBuckets {
  let totals = zeroBuckets()
  for (const usage of Object.values(byRoute)) totals = addReplacing(totals, undefined, usage)
  return totals
}

function hasUsage(usage: TokenBuckets): boolean {
  return usage.uncachedInputTokens > 0
    || usage.outputTokens > 0
    || usage.cacheReadTokens > 0
    || usage.cacheWriteTokens > 0
    || usage.reasoningTokens > 0
}

function viewOf(state: UsageDashboardState): SessionUsageProjection {
  const byModel = Object.values(state.byRoute).filter(hasUsage)
  const daily: DailyUsage[] = Object.entries(state.byDay)
    .map(([date, byRoute]) => ({
      date,
      totals: totalsOf(byRoute),
      byModel: Object.values(byRoute).filter(hasUsage),
    }))
    .filter(day => hasUsage(day.totals))
    .sort((left, right) => left.date.localeCompare(right.date))
  return { byModel, daily }
}

/**
 * Fold usage samples using the same adjacent-sample replacement rule as
 * token-meter while retaining provider/model and event-day attribution.
 */
export const usageDashboardProjectionDefinition:
ProjectionDefinition<'usageDashboard', UsageDashboardState> = {
  key: 'usageDashboard',
  schema: projectionSchema,
  init: () => ({ byRoute: {}, byDay: {}, currentRoute: null, last: null }),
  apply: (state, event) => {
    if (event.type === 'request/header') {
      const { provider, model } = canonicalHeader(event.data.header).config
      if (state.currentRoute?.provider === provider && state.currentRoute.model === model) return state
      return { ...state, currentRoute: { provider, model } }
    }

    let turn: number
    let step: number
    let usage: TokenUsage
    if (event.type === 'assistant/chunk' && event.data.chunk.type === 'usage') {
      ;({ turn, step } = event.data)
      usage = event.data.chunk.usage
    } else if (event.type === 'assistant/message' && event.data.usage !== undefined) {
      ;({ turn, step, usage } = event.data)
    } else {
      return state
    }

    const route = state.currentRoute ?? { provider: 'unknown', model: 'unknown' }
    const day = new Date(event.time).toISOString().slice(0, 10)
    const buckets = bucketsFrom(usage)
    const sameSample = state.last !== null
      && state.last.provider === route.provider
      && state.last.model === route.model
      && state.last.turn === turn
      && state.last.step === step
    if (sameSample && state.last?.day === day && bucketsEqual(state.last.buckets, buckets)) return state

    const previous = sameSample ? state.last : null
    const key = routeKey(route)
    let byRoute = state.byRoute
    let byDay = state.byDay

    if (previous !== null && (previous.day !== day || routeKey(previous) !== key)) {
      const previousKey = routeKey(previous)
      byRoute = {
        ...byRoute,
        [previousKey]: updatedUsage(byRoute[previousKey], previous, previous.buckets, zeroBuckets()),
      }
      const previousDay = byDay[previous.day] ?? {}
      byDay = {
        ...byDay,
        [previous.day]: {
          ...previousDay,
          [previousKey]: updatedUsage(previousDay[previousKey], previous, previous.buckets, zeroBuckets()),
        },
      }
    }

    const replace = previous !== null && previous.day === day && routeKey(previous) === key
      ? previous.buckets
      : undefined
    const dayRoutes = byDay[day] ?? {}
    byRoute = { ...byRoute, [key]: updatedUsage(byRoute[key], route, replace, buckets) }
    byDay = {
      ...byDay,
      [day]: { ...dayRoutes, [key]: updatedUsage(dayRoutes[key], route, replace, buckets) },
    }

    return {
      byRoute,
      byDay,
      currentRoute: state.currentRoute,
      last: { ...route, day, turn, step, buckets },
    }
  },
  view: viewOf,
  stateVersion: 2,
}
