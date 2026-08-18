/** Desktop shell HTML coverage for carrier bootstrap ordering. */

import { describe, expect, it } from 'vitest'
import { injectRendererEntry, RENDERER_ENTRY_PATH } from '../src/renderer-entry-html.ts'

describe('Electron renderer entry HTML', () => {
  it('places the carrier bootstrap before the built Web shell module', () => {
    const html = '<head>\n    <script type="module" crossorigin src="/assets/index.js"></script>\n</head>'
    const injected = injectRendererEntry(html)
    expect(injected.indexOf(RENDERER_ENTRY_PATH)).toBeGreaterThan(0)
    expect(injected.indexOf(RENDERER_ENTRY_PATH)).toBeLessThan(injected.indexOf('/assets/index.js'))
  })

  it('fails loud when the built shell has no module entry', () => {
    expect(() => injectRendererEntry('<html><body></body></html>')).toThrow(/no module entry/)
  })
})
