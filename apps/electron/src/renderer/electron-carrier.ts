/** Electron renderer carrier: context-isolated IPC upstream and one IPC subscription per event stream. */

import type {
  ApiProxy,
  ClientCarrier,
  HostFrame,
  MuxFrame,
  RpcRequest,
  ServerRequest,
} from '@deepseek-ai/dsh-client-connection/client'
import { AbstractApiClient } from '@deepseek-ai/dsh-client-connection/client'
import { hostFrameSchema, muxFrameSchema } from '@deepseek-ai/dsh-host-apiproxy/api/events.schema'
import { serverRequestSchema } from '@deepseek-ai/dsh-host-apiproxy/api/rpc.schema'

type StreamKind = 'mux' | 'host'
type Parser<F> = { parse(value: unknown): F }
type StreamItem<F> = { kind: 'frame'; envelope: RpcRequest<F> } | { kind: 'end' }

/** Serialized Fetch request exposed by the context-isolated preload. */
export interface ElectronFetchRequest {
  requestId: string
  url: string
  method: string
  headers: [string, string][]
  body?: string
}

/** Serialized Fetch response returned by the Electron main process. */
export interface ElectronFetchResponse {
  status: number
  headers: [string, string][]
  body: string
}

/** Narrow preload API; no raw ipcRenderer methods cross into the page. */
export interface ElectronBridge {
  fetch(request: ElectronFetchRequest): Promise<ElectronFetchResponse>
  cancelFetch(requestId: string): void
  openStream(kind: StreamKind, streamId: string, onFrame: (json: string) => void, onEnd: () => void): void
  closeStream(streamId: string): void
}

/**
 * Return the preload bridge when this renderer belongs to the desktop application.
 * @returns the validated bridge, or `undefined` outside Electron.
 */
export function electronBridge(): ElectronBridge | undefined {
  const value = (globalThis as { __DSH_ELECTRON__?: unknown }).__DSH_ELECTRON__
  if (value === undefined) return undefined
  if (typeof value !== 'object' || value === null) {
    throw new Error('dsh-desktop: window.__DSH_ELECTRON__ must be an object')
  }
  const bridge = value as Partial<ElectronBridge>
  if (typeof bridge.fetch !== 'function'
    || typeof bridge.cancelFetch !== 'function'
    || typeof bridge.openStream !== 'function'
    || typeof bridge.closeStream !== 'function') {
    throw new Error('dsh-desktop: window.__DSH_ELECTRON__ is incomplete')
  }
  return bridge as ElectronBridge
}

/** IPC-backed API client. Protocol validation remains in AbstractApiClient and the stream schemas. */
export class ElectronApiClient extends AbstractApiClient {
  constructor(private readonly bridge: ElectronBridge) {
    super()
  }

  /**
   * Fetch-compatible adapter also used by generic Connection RPC.
   * @param input - absolute request URL.
   * @param init - optional Fetch method, headers, string body, and abort signal.
   * @returns the response reconstructed from the preload bridge result.
   */
  async fetch(input: string | URL, init?: RequestInit): Promise<Response> {
    const body = init?.body
    if (body !== undefined && typeof body !== 'string') {
      throw new Error('electron transport accepts string request bodies only')
    }
    const requestId = crypto.randomUUID()
    const signal = init?.signal ?? undefined
    if (signal?.aborted === true) throw new DOMException('The operation was aborted', 'AbortError')
    let rejectAbort: ((reason: DOMException) => void) | undefined
    const aborted = new Promise<never>((_resolve, reject) => {
      rejectAbort = reject
    })
    const onAbort = (): void => {
      this.bridge.cancelFetch(requestId)
      rejectAbort?.(new DOMException('The operation was aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    try {
      const request: ElectronFetchRequest = {
        requestId,
        url: new URL(input).href,
        method: init?.method ?? 'GET',
        headers: [...new Headers(init?.headers).entries()],
        ...(body === undefined ? {} : { body }),
      }
      const response = await Promise.race([this.bridge.fetch(request), aborted])
      return new Response(response.body, { status: response.status, headers: response.headers })
    } finally {
      signal?.removeEventListener('abort', onAbort)
    }
  }

  protected doFetch(input: URL, init?: RequestInit): Promise<Response> {
    return this.fetch(input, init)
  }

  protected override openMux(
    _payload: Parameters<ApiProxy['events']['mux']>[0]['payload'],
    signal: AbortSignal,
    onOpen?: () => void,
  ): AsyncIterable<RpcRequest<MuxFrame>> {
    return this.readIpc('mux', signal, muxFrameSchema, onOpen)
  }

  protected override openHost(
    _payload: Parameters<ApiProxy['events']['host']>[0]['payload'],
    signal: AbortSignal,
    onOpen?: () => void,
  ): AsyncIterable<RpcRequest<HostFrame>> {
    return this.readIpc('host', signal, hostFrameSchema, onOpen)
  }

  private async *readIpc<F extends MuxFrame | HostFrame>(
    kind: StreamKind,
    signal: AbortSignal,
    frameSchema: Parser<F>,
    onOpen?: () => void,
  ): AsyncGenerator<RpcRequest<F>> {
    const streamId = crypto.randomUUID()
    const inbox: StreamItem<F>[] = []
    let wake: (() => void) | undefined
    const enqueue = (item: StreamItem<F>): void => {
      inbox.push(item)
      wake?.()
      wake = undefined
    }
    const onFrame = (json: string): void => {
      try {
        const full: ServerRequest = serverRequestSchema.parse(JSON.parse(json))
        const frame = frameSchema.parse(full.payload)
        this.onEnvelope(full)
        enqueue({ kind: 'frame', envelope: { rpcId: full.rpcId, payload: frame } })
      } catch (error) {
        console.error(`[dsh-desktop] dropping malformed Electron frame on ${kind}:`, error)
      }
    }
    const onEnd = (): void => { enqueue({ kind: 'end' }) }
    const onAbort = (): void => {
      this.bridge.closeStream(streamId)
      enqueue({ kind: 'end' })
    }
    this.bridge.openStream(kind, streamId, onFrame, onEnd)
    signal.addEventListener('abort', onAbort, { once: true })
    if (signal.aborted) onAbort()
    else onOpen?.()
    try {
      while (true) {
        while (inbox.length > 0) {
          const item = inbox.shift() as StreamItem<F>
          if (item.kind === 'end') return
          yield item.envelope
        }
        await new Promise<void>((resolve) => { wake = resolve })
      }
    } finally {
      signal.removeEventListener('abort', onAbort)
      this.bridge.closeStream(streamId)
    }
  }
}

/**
 * Construct the transport-independent carrier value from the preload bridge.
 * @returns the Electron carrier, or `undefined` outside the desktop renderer.
 */
export function createElectronCarrier(): ClientCarrier | undefined {
  const bridge = electronBridge()
  if (bridge === undefined) return undefined
  const api = new ElectronApiClient(bridge)
  return { api, fetch: api.fetch.bind(api), loopback: true }
}
