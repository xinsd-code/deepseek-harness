/** Electron wire parser coverage for the context-isolated preload boundary. */

import { describe, expect, it } from 'vitest'
import {
  parseFetchRequest,
  parseRequestId,
  parseStreamId,
  parseStreamKind,
} from '../src/ipc.ts'

describe('Electron IPC wire parsers', () => {
  it('accepts one JSON Fetch request and its optional body', () => {
    expect(parseFetchRequest({
      requestId: 'request-1',
      url: 'dsh://app/api/session.list',
      method: 'POST',
      headers: [['content-type', 'application/json']],
      body: '{}',
    })).toEqual({
      requestId: 'request-1',
      url: 'dsh://app/api/session.list',
      method: 'POST',
      headers: [['content-type', 'application/json']],
      body: '{}',
    })
  })

  it.each([
    undefined,
    null,
    {},
    { requestId: '', url: 'dsh://app/api/test', method: 'GET', headers: [] },
    { requestId: 'x', url: 1, method: 'GET', headers: [] },
    { requestId: 'x', url: 'dsh://app/api/test', method: 'GET', headers: [['x']] },
    { requestId: 'x', url: 'dsh://app/api/test', method: 'GET', headers: [], body: 1 },
  ])('rejects a malformed Fetch payload %#', (value) => {
    expect(() => parseFetchRequest(value)).toThrow(/electron fetch/)
  })

  it('accepts only non-empty ids and the two declared stream kinds', () => {
    expect(parseRequestId('request-1')).toBe('request-1')
    expect(parseStreamId('stream-1')).toBe('stream-1')
    expect(parseStreamKind('mux')).toBe('mux')
    expect(parseStreamKind('host')).toBe('host')
    expect(() => parseRequestId('')).toThrow(/non-empty/)
    expect(() => parseStreamId(null)).toThrow(/non-empty/)
    expect(() => parseStreamKind('other')).toThrow(/mux or host/)
  })
})
