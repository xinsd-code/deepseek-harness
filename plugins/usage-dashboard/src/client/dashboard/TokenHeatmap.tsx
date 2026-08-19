/**
 * Rolling 53-week activity heatmap over the daily series. Each cell's intensity
 * scales with the selected daily, weekly, or cumulative token view.
 *
 * @module dsh-usage-dashboard/client/dashboard/TokenHeatmap
 */

import { useState } from 'react'
import type { DailyUsage } from '../../types.ts'
import type { UsageKey } from '../locales.ts'
import { fmtInt } from './format.ts'
import css from '../usage-dashboard.module.css'

interface Props {
  daily: DailyUsage[]
  t: (key: UsageKey) => string
}

type HeatmapView = 'dailyView' | 'weeklyView' | 'cumulativeView'

const DAY_MS = 24 * 60 * 60 * 1_000
const MONTHS = 12

function dayTotal(d: DailyUsage): number {
  return d.totals.uncachedInputTokens
    + d.totals.cacheReadTokens
    + d.totals.cacheWriteTokens
    + d.totals.outputTokens
}

export function TokenHeatmap({ daily, t }: Props) {
  const [view, setView] = useState<HeatmapView>('dailyView')
  if (daily.length === 0) {
    return <div className={css.usageEmpty}>{t('empty')}</div>
  }
  const today = utcDay(Date.now())
  const firstMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - MONTHS + 1, 1))
  const lastMonthEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0))
  const start = new Date(firstMonth)
  start.setUTCDate(start.getUTCDate() - start.getUTCDay())
  const end = new Date(lastMonthEnd)
  end.setUTCDate(end.getUTCDate() + 6 - end.getUTCDay())
  const days = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1
  const weeks = days / 7
  const usageByDate = new Map(daily.map(day => [day.date, dayTotal(day)]))
  const cells = Array.from({ length: days }, (_, index) => {
    const date = new Date(start.getTime() + index * DAY_MS)
    const key = utcDateKey(date)
    return { date, key, value: key <= utcDateKey(today) ? usageByDate.get(key) ?? 0 : 0, future: key > utcDateKey(today) }
  })
  const dailyValues = cells.map(cell => cell.value)
  const weeklyValues = dailyValues.map((_, index) => {
    const weekStart = Math.floor(index / 7) * 7
    return dailyValues.slice(weekStart, weekStart + 7).reduce((sum, value) => sum + value, 0)
  })
  let cumulative = 0
  const cumulativeValues = dailyValues.map((value) => {
    cumulative += value
    return cumulative
  })
  const displayValues = view === 'dailyView'
    ? dailyValues
    : view === 'weeklyView' ? weeklyValues : cumulativeValues
  const max = Math.max(...displayValues, 1)
  const monthLabels = Array.from({ length: weeks }, (_, weekIndex) => {
    const week = cells.slice(weekIndex * 7, weekIndex * 7 + 7)
    const marker = week.find(cell => cell.date.getUTCDate() === 1 && cell.date >= firstMonth && cell.date <= lastMonthEnd)
    return marker === undefined ? '' : t('monthLabel').replace('{month}', String(marker.date.getUTCMonth() + 1))
  })

  return (
    <div className={css.usageActivity}>
      <div className={css.usageActivityHead}>
        <h3 className={css.usageActivityTitle}>{t('tokenActivity')}</h3>
        <div className={css.usageActivityTabs}>
          {(['dailyView', 'weeklyView', 'cumulativeView'] as const).map(option => (
            <button
              key={option}
              type="button"
              className={`${css.usageActivityTab}${view === option ? ` ${css.active}` : ''}`}
              aria-pressed={view === option}
              onClick={() => setView(option)}
            >{t(option)}</button>
          ))}
        </div>
      </div>

      <div className={css.usageHeatmapViewport}>
        <div
          className={css.usageHeatmap}
          aria-label={t('tokenActivity')}
          style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }}
        >
          {cells.map((cell, index) => {
            const value = displayValues[index] ?? 0
            const level = value === 0 ? 0 : Math.min(4, Math.ceil(value / max * 4))
            const labelled = !cell.future && value > 0
            return (
              <div
                key={cell.key}
                className={css.usageHeatCell}
                data-level={level}
                data-future={cell.future || undefined}
                aria-label={labelled ? `${cell.key}: ${fmtInt(value)} ${t('totalTokens')}` : undefined}
                aria-hidden={!labelled || undefined}
                title={labelled ? `${cell.key}: ${fmtInt(value)}` : undefined}
              />
            )
          })}
        </div>
        <div
          className={css.usageMonthLabels}
          aria-hidden="true"
          style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }}
        >
          {monthLabels.map((label, index) => <span key={index} className={css.usageMonthLabel}>{label}</span>)}
        </div>
      </div>
    </div>
  )
}

function utcDay(now: number): Date {
  const value = new Date(now)
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
}

function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}
