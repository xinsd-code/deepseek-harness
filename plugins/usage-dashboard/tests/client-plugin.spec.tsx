// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import { apply, inject } from '../src/client/index.ts'
import { DashboardPage } from '../src/client/dashboard/DashboardPage.tsx'

describe('usage-dashboard client plugin', () => {
  it('registers a removable Usage settings section and no conversation entry', async () => {
    const registrations: Array<{ options: Record<string, unknown>; component: unknown }> = []
    const disposers: Array<() => void> = []
    let remoteMounted = true
    let locale = 'zh'
    const remote = {
      usageStats: { summary: vi.fn() },
      $mount: vi.fn(async () => async () => { remoteMounted = false }),
    }
    const ctx = {
      remote,
      locale: {
        bind: () => (key: string) => key === 'open'
          ? (locale === 'zh' ? 'Token 用量' : 'Token usage')
          : key,
        register: vi.fn(() => () => {}),
      },
      slots: {
        inject: vi.fn((name: string, register: () => (() => void)) => {
          disposers.push(register())
          return () => {}
        }),
        register: vi.fn((options: Record<string, unknown>, component: unknown) => {
          const entry = { options, component }
          registrations.push(entry)
          return () => {
            const index = registrations.indexOf(entry)
            if (index >= 0) registrations.splice(index, 1)
          }
        }),
      },
      effect: vi.fn((setup: () => () => void) => {
        disposers.push(setup())
      }),
      inject: vi.fn(async (_services: string[], callback: (value: unknown) => void) => {
        callback(ctx)
      }),
    }

    expect(inject).toEqual(['remote'])
    const disposeRemote = await apply(ctx as never)

    expect(ctx.slots.inject).not.toHaveBeenCalledWith('conversation.input.dock', expect.any(Function))
    expect(ctx.slots.inject).toHaveBeenCalledWith('settings.section', expect.any(Function))
    expect(registrations).toHaveLength(1)
    expect(registrations[0]?.component).toBe(DashboardPage)
    expect(registrations[0]?.options).toMatchObject({ id: 'usage', order: 20 })
    const label = registrations[0]?.options.label as () => string
    expect(label()).toBe('Token 用量')
    locale = 'en'
    expect(label()).toBe('Token usage')

    for (const dispose of disposers.reverse()) dispose()
    await disposeRemote()
    expect(registrations).toHaveLength(0)
    expect(remoteMounted).toBe(false)
  })
})
