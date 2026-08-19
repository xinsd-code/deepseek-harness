/** Shared display helpers for the usage dashboard. */

/** Locale-aware integer formatting with thousands separators. */
export function fmtInt(n: number): string {
  return n.toLocaleString('en-US')
}

/** CNY amount formatted for the dashboard's estimated DeepSeek charge. */
export function fmtCny(n: number): string {
  return `¥${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
