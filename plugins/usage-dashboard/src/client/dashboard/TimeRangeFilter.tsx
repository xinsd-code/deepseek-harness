/**
 * Time-range selector for the Host summary query.
 *
 * @module dsh-usage-dashboard/client/dashboard/TimeRangeFilter
 */

import type { RangeMode } from './DashboardPage.tsx'
import type { UsageKey } from '../locales.ts'
import css from '../usage-dashboard.module.css'

interface Props {
  value: RangeMode
  onChange: (mode: RangeMode) => void
  loading: boolean
  t: (key: UsageKey) => string
}

const MODES: Array<{ mode: RangeMode; key: UsageKey }> = [
  { mode: 'all', key: 'all' },
  { mode: 'last7', key: 'last7' },
  { mode: 'last30', key: 'last30' },
]

export function TimeRangeFilter({ value, onChange, loading, t }: Props) {
  return (
    <div className={css.usageRangeBar}>
      {MODES.map(m => (
        <button
          key={m.mode}
          type="button"
          className={`${css.usageRangeBtn}${value === m.mode ? ` ${css.active}` : ''}`}
          aria-pressed={value === m.mode}
          disabled={loading}
          onClick={() => onChange(m.mode)}
        >
          {t(m.key)}
        </button>
      ))}
    </div>
  )
}
