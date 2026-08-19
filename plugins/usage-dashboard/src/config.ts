/** Cordis configuration schema for usage-dashboard billing estimates. */

import z from '@deepseek-ai/schemastery'
import { DEFAULT_PRICING, type ModelPricing, type PricingTable } from './pricing.ts'

/** Cordis configuration for billing estimates. */
export interface UsageDashboardConfig {
  /** DeepSeek model prices per million tokens. */
  pricing: PricingTable
}

const pricingSchema: z<ModelPricing> = z.object({
  input: z.number().min(0).required(),
  output: z.number().min(0).required(),
  cacheRead: z.number().min(0).required(),
  cacheWrite: z.number().min(0).required(),
  currency: z.string().required(),
})

/** Validated usage-dashboard plugin configuration. */
export const usageDashboardConfigSchema: z<UsageDashboardConfig> = z.object({
  pricing: z.dict(pricingSchema).default(DEFAULT_PRICING),
})
