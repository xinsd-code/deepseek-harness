/** Electron renderer carrier coverage through the context-isolated bridge contract. */

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createElectronCarrier,
  ElectronApiClient,
  electronBridge,
  type ElectronBridge,
} from '../src/renderer/electron-carrier.ts'

interface StreamOpen {
  streamId: string
  onFrame(json: string): void
  onEnd(): void
}

function bridge(overrides: Partial<ElectronBridge> = {}): ElectronBridge {
  return {
    fetch: vi.fn().mockResolvedValue({ status: 200, headers: [], body: '{}' }),
    cancelFetch: vi.fn(),
    openStream: vi.fn(),
    closeStream: vi.fn(),
    ...overrides,
  }
}

afterEach(() => {
  delete (globalThis as { __DSH_ELECTRON__?: unknown }).__DSH_ELECTRON__
  delete (globalThis as { __DSH_CLIENT_CARRIER__?: unknown }).__DSH_CLIENT_CARRIER__
})

describe('Electron renderer carrier', () => {
  it('validates the preload bridge and constructs one loopback carrier', () => {
    expect(electronBridge()).toBeUndefined()
    ;(globalThis as { __DSH_ELECTRON__?: unknown }).__DSH_ELECTRON__ = { fetch: vi.fn() }
    expect(() => electronBridge()).toThrow(/__DSH_ELECTRON__ is incomplete/)
    const value = bridge()
    ;(globalThis as { __DSH_ELECTRON__?: unknown }).__DSH_ELECTRON__ = value
    const carrier = createElectronCarrier()
    expect(carrier?.api).toBeInstanceOf(ElectronApiClient)
    expect(carrier?.loopback).toBe(true)
  })

  it('carries unary Fetch and propagates cancellation to the preload bridge', async () => {
    let pendingResolve: ((value: { status: number; headers: [string, string][]; body: string }) => void) | undefined
    const fetch = vi.fn<ElectronBridge['fetch']>(() => new Promise((resolve) => { pendingResolve = resolve }))
    const cancelFetch = vi.fn<ElectronBridge['cancelFetch']>()
    const value = bridge({
      fetch,
      cancelFetch,
    })
    ;(globalThis as { __DSH_ELECTRON__?: unknown }).__DSH_ELECTRON__ = value
    const carrier = createElectronCarrier()
    if (carrier === undefined) throw new Error('carrier missing')
    const abort = new AbortController()
    const request = carrier.fetch('dsh://app/api/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
      signal: abort.signal,
    })
    await vi.waitFor(() => { expect(fetch).toHaveBeenCalledTimes(1) })
    const sent = fetch.mock.calls[0]?.[0]
    expect(sent).toMatchObject({ url: 'dsh://app/api/test', method: 'POST', body: '{}' })
    abort.abort()
    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
    expect(cancelFetch).toHaveBeenCalledWith(sent?.requestId)
    pendingResolve?.({ status: 200, headers: [], body: '{}' })
  })

  it('opens, validates, and independently cancels the mux and host streams', async () => {
    const openings = new Map<'mux' | 'host', StreamOpen>()
    const openStream = vi.fn<ElectronBridge['openStream']>((kind, streamId, onFrame, onEnd) => {
      openings.set(kind, { streamId, onFrame, onEnd })
    })
    const closeStream = vi.fn<ElectronBridge['closeStream']>()
    const value = bridge({
      openStream,
      closeStream,
    })
    ;(globalThis as { __DSH_ELECTRON__?: unknown }).__DSH_ELECTRON__ = value
    const carrier = createElectronCarrier()
    if (carrier === undefined) throw new Error('carrier missing')
    const muxAbort = new AbortController()
    const hostAbort = new AbortController()
    const opened: string[] = []
    const mux = carrier.api.events.mux({}, muxAbort.signal, () => { opened.push('mux') })[Symbol.asyncIterator]()
    const host = carrier.api.events.host({}, hostAbort.signal, () => { opened.push('host') })[Symbol.asyncIterator]()
    const muxFrame = mux.next()
    const hostFrame = host.next()
    expect(opened).toEqual(['mux', 'host'])
    openings.get('mux')?.onFrame(JSON.stringify({
      type: 'server-request',
      rpcId: 'mux-electron',
      method: 'session/subscribed',
      payload: { type: 'session/subscribed', sessionId: 'session-electron', lastSeq: 8 },
    }))
    openings.get('host')?.onFrame(JSON.stringify({
      type: 'server-request',
      rpcId: 'host-electron',
      method: 'host/remote-event',
      payload: { type: 'host/remote-event', event: 'commands/change', args: [] },
    }))
    await expect(muxFrame).resolves.toMatchObject({
      value: { rpcId: 'mux-electron', payload: { type: 'session/subscribed', lastSeq: 8 } },
    })
    await expect(hostFrame).resolves.toMatchObject({
      value: { rpcId: 'host-electron', payload: { type: 'host/remote-event', event: 'commands/change' } },
    })

    const muxEnd = mux.next()
    const hostEnd = host.next()
    muxAbort.abort()
    hostAbort.abort()
    await expect(muxEnd).resolves.toMatchObject({ done: true })
    await expect(hostEnd).resolves.toMatchObject({ done: true })
    expect(closeStream).toHaveBeenCalledWith(openings.get('mux')?.streamId)
    expect(closeStream).toHaveBeenCalledWith(openings.get('host')?.streamId)
  })
})
