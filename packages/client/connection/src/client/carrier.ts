/** Transport-independent client carrier registration shared across browser bundles. */

import type { IApiClient } from './api.ts'
import type { ConnectionFetch } from './rpc.ts'

/** Physical operations selected before the shared Client plugin graph starts. */
export interface ClientCarrier {
  /** API implementation used by the Connection controller and domain consumers. */
  readonly api: IApiClient
  /** Fetch-compatible operation used by generic Connection RPC channels. */
  readonly fetch: ConnectionFetch
  /** Whether this carrier reaches a Host trusted as local to the current client. */
  readonly loopback: boolean
}

declare global {
  var __DSH_CLIENT_CARRIER__: ClientCarrier | undefined
}

/**
 * Register the carrier consumed when the shared Client graph starts.
 * @param carrier - fully constructed physical carrier.
 */
export function registerClientCarrier(carrier: ClientCarrier): void {
  globalThis.__DSH_CLIENT_CARRIER__ = carrier
}

/**
 * Resolve the carrier registered by an earlier bootstrap bundle.
 * @returns the registered carrier, or `undefined` for the Web fallback.
 */
export function resolveClientCarrier(): ClientCarrier | undefined {
  return globalThis.__DSH_CLIENT_CARRIER__
}
