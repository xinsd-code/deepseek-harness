/**
 * UsageDashboard's injected face for the `settings.section` slot.
 *
 * @module dsh-usage-dashboard/client/slots
 */

import type { UsageRange, UsageSummary } from '../types.ts'
import type { UsageKey } from './locales.ts'

/** Injected business and copy face of the usage dashboard settings page. */
export interface UsageDashboardInjected {
  /** Translate plugin-owned copy using the current locale. */
  t: (key: UsageKey) => string
  /**
   * Fetch the full cross-session usage summary from the host gateway.
   * @returns the aggregated `UsageSummary`.
   */
  loadSummary: (range: UsageRange) => Promise<UsageSummary>
}
