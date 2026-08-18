/** Fixed Electron IPC messages shared by the main process and context-isolated preload. */

import type { Branded } from '@deepseek-ai/dsh-brand'

export const IPC_BOOT = 'dsh:boot'
export const IPC_FETCH = 'dsh:fetch'
export const IPC_FETCH_CANCEL = 'dsh:fetch-cancel'
export const IPC_STREAM_OPEN = 'dsh:stream-open'
export const IPC_STREAM_FRAME = 'dsh:stream-frame'
export const IPC_STREAM_END = 'dsh:stream-end'
export const IPC_STREAM_CLOSE = 'dsh:stream-close'

/** Renderer-minted identity for one IPC Fetch request. */
export type ElectronRequestId = Branded<'electron-request-id'>

/** Renderer-minted identity for one IPC event stream. */
export type ElectronStreamId = Branded<'electron-stream-id'>

/** Brand a validated request id at the Electron wire parser. */
export function ElectronRequestId(value: string): ElectronRequestId {
  return value as ElectronRequestId
}

/** Brand a validated stream id at the Electron wire parser. */
export function ElectronStreamId(value: string): ElectronStreamId {
  return value as ElectronStreamId
}

/** JSON-only Fetch request carried from the renderer to the main process. */
export interface ElectronFetchRequest {
  requestId: ElectronRequestId
  url: string
  method: string
  headers: [string, string][]
  body?: string
}

/** Buffered JSON-only Fetch response carried back to the renderer. */
export interface ElectronFetchResponse {
  status: number
  headers: [string, string][]
  body: string
}

export type ElectronStreamKind = 'mux' | 'host'

/** Parsed request after validating the context-bridge payload. */
export function parseFetchRequest(value: unknown): ElectronFetchRequest {
  if (typeof value !== 'object' || value === null) throw new Error('electron fetch request must be an object')
  const request = value as Record<string, unknown>
  if (typeof request.requestId !== 'string' || request.requestId === '') {
    throw new Error('electron fetch requestId must be a non-empty string')
  }
  if (typeof request.url !== 'string' || typeof request.method !== 'string') {
    throw new Error('electron fetch url and method must be strings')
  }
  if (!Array.isArray(request.headers) || request.headers.some(row =>
    !Array.isArray(row) || row.length !== 2 || row.some(field => typeof field !== 'string'))) {
    throw new Error('electron fetch headers must be string pairs')
  }
  if (request.body !== undefined && typeof request.body !== 'string') {
    throw new Error('electron fetch body must be a string')
  }
  return {
    requestId: ElectronRequestId(request.requestId),
    url: request.url,
    method: request.method,
    headers: request.headers as [string, string][],
    ...(request.body === undefined ? {} : { body: request.body }),
  }
}

/** Parse a renderer-minted request id. */
export function parseRequestId(value: unknown): ElectronRequestId {
  if (typeof value !== 'string' || value === '') throw new Error('electron request id must be a non-empty string')
  return ElectronRequestId(value)
}

/** Parse a renderer-minted stream id. */
export function parseStreamId(value: unknown): ElectronStreamId {
  if (typeof value !== 'string' || value === '') throw new Error('electron stream id must be a non-empty string')
  return ElectronStreamId(value)
}

/** Parse the closed set of desktop event streams. */
export function parseStreamKind(value: unknown): ElectronStreamKind {
  if (value !== 'mux' && value !== 'host') throw new Error('electron stream kind must be mux or host')
  return value
}
