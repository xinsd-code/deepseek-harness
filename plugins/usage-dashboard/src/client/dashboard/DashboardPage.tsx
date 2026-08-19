/** Range-aware token usage dashboard. */

import { useEffect, useState } from 'react'
import type { UsageRange, UsageSummary } from '../../types.ts'
import type { UsageDashboardInjected } from '../slots.ts'
import { BillingCards } from './BillingCards.tsx'
import { KpiCards } from './KpiCards.tsx'
import { TimeRangeFilter } from './TimeRangeFilter.tsx'
import { TokenHeatmap } from './TokenHeatmap.tsx'
import css from '../usage-dashboard.module.css'

export type RangeMode = 'all' | 'last7' | 'last30'

export type DashboardPageProps = Partial<UsageDashboardInjected>

/** Convert a relative range choice to inclusive UTC day bounds. */
export function rangeRequest(mode: RangeMode, now = Date.now()): UsageRange {
  if (mode === 'all') return {}
  const days = mode === 'last7' ? 7 : 30
  const to = new Date(now)
  const from = new Date(now)
  from.setUTCDate(from.getUTCDate() - days + 1)
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  }
}

export function DashboardPage({ loadSummary, t }: DashboardPageProps) {
  if (loadSummary === undefined || t === undefined) return null
  return <LoadedDashboardPage loadSummary={loadSummary} t={t} />
}

function LoadedDashboardPage({ loadSummary, t }: UsageDashboardInjected) {
  const [summary, setSummary] = useState<UsageSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<RangeMode>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    void loadSummary(rangeRequest(range)).then(
      (value) => {
        if (active) setSummary(value)
      },
      (reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : String(reason))
      },
    ).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [loadSummary, range])

  return (
    <div className={css.usagePage}>
      <div className={css.usagePageHeader}>
        <h2 className={css.usageTitle}>{t('title')}</h2>
      </div>
      <TimeRangeFilter value={range} onChange={setRange} loading={loading} t={t} />

      {loading && summary === null ? <div className={css.usageLoading}>{t('loading')}</div> : null}
      {error !== null ? <div className={css.usageEmpty} role="alert">{error}</div> : null}
      {!loading && error === null && (summary === null || summary.sessionsCount === 0)
        ? <div className={css.usageEmpty}>{t('empty')}</div>
        : null}

      {error === null && summary !== null && summary.sessionsCount > 0 ? (
        <>
          <div className={css.usageMeta}>
            <span>{t('sessions')}: {summary.sessionsCount}</span>
            <span>{t('range')}: {summary.rangeFrom} – {summary.rangeTo}</span>
          </div>

          <section className={css.usageSection}>
            <h3 className={css.usageSectionTitle}>{t('overview')}</h3>
            <KpiCards summary={summary} t={t} />
          </section>

          <section className={css.usageSection}>
            <TokenHeatmap daily={summary.daily} t={t} />
          </section>

          <section className={css.usageSection}>
            <h3 className={css.usageSectionTitle}>{t('billing')}</h3>
            <BillingCards billing={summary.billing} t={t} />
          </section>
        </>
      ) : null}
    </div>
  )
}
