/**
 * Billing table: one row per model with its computed cost (already computed
 * host-side via the editable rate card). Sorted by cost, descending.
 *
 * @module dsh-usage-dashboard/client/dashboard/BillingCards
 */

import type { BillingLine } from '../../types.ts'
import type { UsageKey } from '../locales.ts'
import { fmtCny } from './format.ts'
import css from '../usage-dashboard.module.css'

interface Props {
  billing: BillingLine[]
  t: (key: UsageKey) => string
}

export function BillingCards({ billing, t }: Props) {
  if (billing.length === 0) {
    return <div className={css.usageEmpty}>{t('noBilling')}</div>
  }
  return (
    <table className={css.usageTable}>
      <thead>
        <tr>
          <th>{t('model')}</th>
          <th>{t('provider')}</th>
          <th className={css.numeric}>{t('cost')}</th>
        </tr>
      </thead>
      <tbody>
        {billing.map(line => (
          <tr key={`${line.provider}\u0000${line.model}`}>
            <td>{line.model}</td>
            <td>{line.provider}</td>
            <td className={css.numeric}>{fmtCny(line.cost)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
