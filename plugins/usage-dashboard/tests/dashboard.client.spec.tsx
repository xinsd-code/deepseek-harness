// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DashboardPage } from '../src/client/dashboard/DashboardPage.tsx'
import { en, type UsageKey } from '../src/client/locales.ts'
import type { UsageSummary } from '../src/types.ts'

const t = (key: UsageKey): string => en[key]

const full: UsageSummary = {
  totals: {
    uncachedInputTokens: 100,
    outputTokens: 50,
    cacheReadTokens: 20,
    cacheWriteTokens: 30,
    reasoningTokens: 10,
  },
  byModel: [{
    provider: 'deepseek-official',
    model: 'deepseek-v4-flash',
    uncachedInputTokens: 100,
    outputTokens: 50,
    cacheReadTokens: 20,
    cacheWriteTokens: 30,
    reasoningTokens: 10,
  }],
  billing: [{
    provider: 'deepseek-official',
    model: 'deepseek-v4-flash',
    usage: {
      uncachedInputTokens: 100,
      outputTokens: 50,
      cacheReadTokens: 20,
      cacheWriteTokens: 30,
      reasoningTokens: 10,
    },
    cost: 1.236,
    currency: 'CNY',
  }],
  daily: [{
    date: '2026-08-01',
    totals: {
      uncachedInputTokens: 100,
      outputTokens: 50,
      cacheReadTokens: 20,
      cacheWriteTokens: 30,
      reasoningTokens: 10,
    },
    byModel: [],
  }],
  sessionsCount: 2,
  rangeFrom: '2026-08-01',
  rangeTo: '2026-08-01',
}

const empty: UsageSummary = {
  totals: {
    uncachedInputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    reasoningTokens: 0,
  },
  byModel: [],
  billing: [],
  daily: [],
  sessionsCount: 0,
  rangeFrom: null,
  rangeTo: null,
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('DashboardPage', () => {
  it('renders coherent counts, DeepSeek billing guidance, and annual activity', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-08-19T12:00:00Z'))
    const loadSummary = vi.fn(async () => full)
    render(<DashboardPage loadSummary={loadSummary} t={t} />)

    expect(await screen.findByText('Sessions: 2')).toBeTruthy()
    expect(loadSummary).toHaveBeenCalledWith({})
    expect(screen.getByText('13.3%')).toBeTruthy()
    expect(screen.getAllByText('¥1.24')).toHaveLength(2)
    expect(screen.getByLabelText('Estimated cost includes priced DeepSeek models only.')).toBeTruthy()
    expect(screen.getAllByRole('columnheader', { name: 'Provider' })).toHaveLength(1)
    expect(screen.queryByRole('columnheader', { name: 'Currency' })).toBeNull()
    expect(screen.queryByText('Cache write')).toBeNull()
    expect(screen.queryByText('By model')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeTruthy()
    expect(screen.queryByText('Cumulative tokens')).toBeNull()
    expect(screen.getByText('Peak tokens')).toBeTruthy()
    expect(screen.queryByText('Longest streak')).toBeNull()
    expect(screen.queryByText('Active days')).toBeNull()
    expect(screen.queryByText('Active in 28 days')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Activity' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Token activity' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Daily' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('Range: 2026-08-01 – 2026-08-01')).toBeTruthy()
  })

  it('applies range changes to the Host query and keeps filters available for an empty range', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-08-19T12:00:00Z'))
    const loadSummary = vi.fn(async (range) => Object.keys(range).length === 0 ? full : empty)
    render(<DashboardPage loadSummary={loadSummary} t={t} />)
    await screen.findByText('Sessions: 2')

    fireEvent.click(screen.getByRole('button', { name: 'Last 7 days' }))
    await waitFor(() => {
      expect(loadSummary).toHaveBeenLastCalledWith({ from: '2026-08-13', to: '2026-08-19' })
    })
    expect(await screen.findByText('No token usage recorded yet.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'All time' })).toBeTruthy()
  })

  it('does not leave stale totals visible after a range query fails', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-08-19T12:00:00Z'))
    const loadSummary = vi.fn(async (range) => {
      if (Object.keys(range).length === 0) return full
      throw new Error('summary unavailable')
    })
    render(<DashboardPage loadSummary={loadSummary} t={t} />)
    await screen.findByText('Sessions: 2')

    fireEvent.click(screen.getByRole('button', { name: 'Last 7 days' }))
    expect((await screen.findByRole('alert')).textContent).toBe('summary unavailable')
    expect(screen.queryByText('Sessions: 2')).toBeNull()
  })
})
