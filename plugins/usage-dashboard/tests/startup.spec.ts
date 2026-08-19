import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import Startup, { isElectronRuntime } from '../src/startup.ts'

describe('usage-dashboard carrier startup', () => {
  it('waits for the Web server and retracts its readiness service on disposal', async () => {
    const ctx = new Context()
    const fiber = ctx.plugin(Startup)

    expect(ctx.get('usageDashboardCarrierReady')).toBeUndefined()
    ctx.provide('webServer', {})
    await fiber.await()
    expect(ctx.get('usageDashboardCarrierReady')).toBeDefined()

    await fiber.dispose()
    expect(ctx.get('usageDashboardCarrierReady')).toBeUndefined()
  })

  it('recognizes Electron without relying on Web services', () => {
    expect(isElectronRuntime({ electron: '43.2.0' })).toBe(true)
    expect(isElectronRuntime({ node: '24.2.0' })).toBe(false)
  })
})
