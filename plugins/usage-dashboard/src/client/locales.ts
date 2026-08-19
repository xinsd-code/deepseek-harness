/**
 * Dictionary for the usage-dashboard client. The `usage` namespace is owned by
 * this plugin; the harness merges it through the `LocaleNamespaceMap`
 * augmentation declared in `index.ts`.
 *
 * @module dsh-usage-dashboard/client/locales
 */

export type UsageKey =
  | 'open'
  | 'title'
  | 'overview'
  | 'totalTokens'
  | 'uncachedInput'
  | 'cacheRead'
  | 'output'
  | 'reasoning'
  | 'cacheHitRate'
  | 'cost'
  | 'billingHint'
  | 'model'
  | 'provider'
  | 'billing'
  | 'daily'
  | 'heatmap'
  | 'tokenActivity'
  | 'dailyView'
  | 'weeklyView'
  | 'cumulativeView'
  | 'peakTokens'
  | 'monthLabel'
  | 'sessions'
  | 'range'
  | 'all'
  | 'last7'
  | 'last30'
  | 'loading'
  | 'empty'
  | 'noBilling'
  | 'notApplicable'
  | 'close'

export const en: Record<UsageKey, string> = {
  open: 'Token usage',
  title: 'Token Usage & Billing',
  overview: 'Overview',
  totalTokens: 'Total tokens',
  uncachedInput: 'Uncached input',
  cacheRead: 'Cache read',
  output: 'Output',
  reasoning: 'Reasoning',
  cacheHitRate: 'Cache hit rate',
  cost: 'Cost',
  billingHint: 'Estimated cost includes priced DeepSeek models only.',
  model: 'Model',
  provider: 'Provider',
  billing: 'Billing',
  daily: 'Daily',
  heatmap: 'Activity',
  tokenActivity: 'Token activity',
  dailyView: 'Daily',
  weeklyView: 'Weekly',
  cumulativeView: 'Cumulative',
  peakTokens: 'Peak tokens',
  monthLabel: 'M{month}',
  sessions: 'Sessions',
  range: 'Range',
  all: 'All time',
  last7: 'Last 7 days',
  last30: 'Last 30 days',
  loading: 'Loading…',
  empty: 'No token usage recorded yet.',
  noBilling: 'No priced DeepSeek usage in this range.',
  notApplicable: 'N/A',
  close: 'Close',
}

export const zh: Record<UsageKey, string> = {
  open: 'Token 用量',
  title: 'Token 用量与计费',
  overview: '总览',
  totalTokens: '总 Token 数',
  uncachedInput: '未命中缓存输入',
  cacheRead: '缓存命中',
  output: '输出',
  reasoning: '推理',
  cacheHitRate: '缓存命中率',
  cost: '费用',
  billingHint: '费用仅统计已配置价格的 DeepSeek 相关模型，其他模型不会计入。',
  model: '模型',
  provider: '提供方',
  billing: '计费明细',
  daily: '按日',
  heatmap: '活跃度',
  tokenActivity: 'Token 活跃',
  dailyView: '每日',
  weeklyView: '每周',
  cumulativeView: '累计',
  peakTokens: '峰值 Token 数',
  monthLabel: '{month}月',
  sessions: '会话数',
  range: '时间范围',
  all: '全部',
  last7: '近 7 天',
  last30: '近 30 天',
  loading: '加载中…',
  empty: '暂无 Token 用量记录。',
  noBilling: '所选范围内没有可计费的 DeepSeek 用量。',
  notApplicable: '不适用',
  close: '关闭',
}
