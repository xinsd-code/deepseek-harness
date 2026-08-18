/** HTML injection for the desktop renderer carrier bootstrap. */

export const RENDERER_ENTRY_PATH = '/electron-renderer.js'

/**
 * Insert the desktop bootstrap immediately before the Web shell module entry.
 * @param html - built Web shell HTML.
 * @returns HTML whose module execution order registers the carrier first.
 */
export function injectRendererEntry(html: string): string {
  const shellEntry = /<script\b(?=[^>]*\btype=["']module["'])[^>]*>/i.exec(html)
  if (shellEntry?.index === undefined) {
    throw new Error('dsh-desktop: Web shell index has no module entry')
  }
  const lineStart = html.lastIndexOf('\n', shellEntry.index) + 1
  const indent = /^\s*$/.test(html.slice(lineStart, shellEntry.index))
    ? html.slice(lineStart, shellEntry.index)
    : ''
  const bootstrap = `<script type="module" src="${RENDERER_ENTRY_PATH}"></script>`
  return `${html.slice(0, shellEntry.index)}${bootstrap}\n${indent}${html.slice(shellEntry.index)}`
}
