/**
 * Overview metrics for tokens, cache behavior, billing, and activity.
 *
 * @module dsh-usage-dashboard/client/dashboard/KpiCards
 */

import type { UsageSummary } from '../../types.ts'
import type { UsageKey } from '../locales.ts'
import { fmtCny, fmtInt } from './format.ts'
import css from '../usage-dashboard.module.css'

interface Props {
  summary: UsageSummary
  t: (key: UsageKey) => string
}

export function KpiCards({ summary, t }: Props) {
  const total =
    summary.totals.uncachedInputTokens
    + summary.totals.cacheReadTokens
    + summary.totals.cacheWriteTokens
    + summary.totals.outputTokens
  const input = summary.totals.uncachedInputTokens
    + summary.totals.cacheReadTokens
    + summary.totals.cacheWriteTokens
  const hitRate = input > 0
    ? summary.totals.cacheReadTokens / input
    : 0
  const cost = summary.billing.length === 0
    ? t('notApplicable')
    : fmtCny(summary.billing.reduce((sum, line) => sum + line.cost, 0))
  const peak = Math.max(...summary.daily.map(dayTotal), 0)

  const cards: Array<{ label: UsageKey; value: string; cached?: boolean; billingHint?: boolean }> = [
    { label: 'totalTokens', value: fmtInt(total) },
    { label: 'uncachedInput', value: fmtInt(summary.totals.uncachedInputTokens) },
    { label: 'cacheRead', value: fmtInt(summary.totals.cacheReadTokens), cached: true },
    { label: 'output', value: fmtInt(summary.totals.outputTokens) },
    { label: 'reasoning', value: fmtInt(summary.totals.reasoningTokens) },
    { label: 'cacheHitRate', value: `${(hitRate * 100).toFixed(1)}%` },
    { label: 'peakTokens', value: fmtInt(peak) },
    { label: 'cost', value: cost, billingHint: true },
  ]

  return (
    <div className={css.usageKpiGrid}>
      {cards.map(card => (
        <div key={card.label} className={css.usageKpi}>
          <div className={css.usageKpiLabelRow}>
            <span className={css.usageKpiLabel}>{t(card.label)}</span>
            {card.billingHint ? (
              <span
                className={css.usageHelp}
                aria-label={t('billingHint')}
                title={t('billingHint')}
                tabIndex={0}
              >?</span>
            ) : null}
          </div>
          <div className={`${css.usageKpiValue}${card.cached ? ` ${css.cached}` : ''}`}>{card.value}</div>
        </div>
      ))}
    </div>
  )
}

function dayTotal(day: UsageSummary['daily'][number]): number {
  return day.totals.uncachedInputTokens
    + day.totals.cacheReadTokens
    + day.totals.cacheWriteTokens
    + day.totals.outputTokens
}
