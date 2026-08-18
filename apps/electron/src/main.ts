/** DeepSeek Harness desktop assembly: local custom protocol plus context-isolated IPC carrier. */

import { randomUUID } from 'node:crypto'
import { readFile, realpath } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inspect } from 'node:util'
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  protocol,
  shell,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
  type WebContents,
} from 'electron'
import { loadLayeredEnv } from '@deepseek-ai/dsh-app-boot'
import type { ApiProxy } from '@deepseek-ai/dsh-host-apiproxy'
import { RpcId, type ServerRequest } from '@deepseek-ai/dsh-host-apiproxy/api'
import type { HostConnectionHandle } from '@deepseek-ai/dsh-client-connection'
import type { ClientModuleRegistry } from '@deepseek-ai/dsh-client-modules'
import { runProfile, type RunProfileOptions } from '@deepseek-ai/dsh/profile-boot'
import {
  IPC_BOOT,
  IPC_FETCH,
  IPC_FETCH_CANCEL,
  IPC_STREAM_CLOSE,
  IPC_STREAM_END,
  IPC_STREAM_FRAME,
  IPC_STREAM_OPEN,
  parseFetchRequest,
  parseRequestId,
  parseStreamId,
  parseStreamKind,
  type ElectronFetchResponse,
  type ElectronRequestId,
  type ElectronStreamId,
} from './ipc.ts'
import { injectRendererEntry, RENDERER_ENTRY_PATH } from './renderer-entry-html.ts'

protocol.registerSchemesAsPrivileged([{
  scheme: 'dsh',
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
}])

const APP_ORIGIN = 'dsh://app'
const INTERNAL_ORIGIN = 'http://127.0.0.1'
const require = createRequire(import.meta.url)
const distIndex = app.isPackaged
  ? resolve(process.resourcesPath, 'web-dist', 'index.html')
  : require.resolve('@deepseek-ai/dsh-web-frontend/dist/index.html')
const distRoot = dirname(distIndex)
const profilePatch = fileURLToPath(new URL('../config/electron.patch.yml', import.meta.url))
const preload = fileURLToPath(new URL('./preload.cjs', import.meta.url))
const rendererEntry = fileURLToPath(new URL('./renderer.js', import.meta.url))

const MIME: Readonly<Record<string, string>> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
}

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https: http:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
].join('; ')

let window: BrowserWindow | undefined
let host: Awaited<ReturnType<typeof runProfile>> | undefined
let modules: ClientModuleRegistry | undefined
let connection: HostConnectionHandle | undefined
let apiProxy: ApiProxy | undefined
let quitting = false
let disposed = false
const fetches = new Map<ElectronRequestId, AbortController>()
const streams = new Map<ElectronStreamId, AbortController>()

function debug(message: string): void {
  if (process.env.DSH_DESKTOP_DEBUG === '1') process.stderr.write(`[dsh-desktop] ${message}\n`)
}

debug('main module loaded')

function isAppUrl(value: string): boolean {
  try {
    const candidate = new URL(value)
    return candidate.protocol === 'dsh:' && candidate.host === 'app'
  } catch {
    return false
  }
}

function trustedSender(event: IpcMainEvent | IpcMainInvokeEvent): boolean {
  if (window === undefined || event.sender !== window.webContents) return false
  return event.senderFrame !== null && isAppUrl(event.senderFrame.url)
}

function assertTrustedSender(event: IpcMainEvent | IpcMainInvokeEvent): void {
  if (!trustedSender(event)) throw new Error('electron IPC refused an untrusted sender')
}

function closeRendererWork(): void {
  for (const controller of fetches.values()) controller.abort()
  fetches.clear()
  for (const controller of streams.values()) controller.abort()
  streams.clear()
}

async function serveApp(request: Request): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405 })
  const url = new URL(request.url)
  if (url.host !== 'app') return new Response(null, { status: 404 })
  const pathname = decodeURIComponent(url.pathname)
  if (pathname === RENDERER_ENTRY_PATH) {
    try {
      return fileResponse(await readFile(rendererEntry), '.js', request.method === 'HEAD')
    } catch {
      return new Response(null, { status: 404 })
    }
  }
  const plugin = await servePlugin(pathname, request.method === 'HEAD')
  if (plugin !== undefined) return plugin
  const target = resolve(distRoot, `.${pathname}`)
  if (target !== distRoot && !target.startsWith(distRoot + sep)) return new Response(null, { status: 403 })
  const selected = target === distRoot ? distIndex : target
  try {
    const body = await readFile(selected)
    return fileResponse(body, extname(selected), request.method === 'HEAD')
  } catch {
    const body = await readFile(distIndex)
    return fileResponse(body, '.html', request.method === 'HEAD')
  }
}

async function servePlugin(pathname: string, head: boolean): Promise<Response | undefined> {
  const prefix = '/plugins/'
  const mapSuffix = '/client.js.map'
  const bundleSuffix = '/client.js'
  const sourceMap = pathname.startsWith(prefix) && pathname.endsWith(mapSuffix)
  const suffix = sourceMap ? mapSuffix : bundleSuffix
  if (!pathname.startsWith(prefix) || !pathname.endsWith(suffix)) return undefined
  const clientPath = modules?.clientPath(pathname.slice(prefix.length, -suffix.length))
  if (clientPath === undefined) return new Response(null, { status: 404 })
  try {
    const body = await readFile(`${clientPath}${sourceMap ? '.map' : ''}`)
    return fileResponse(body, sourceMap ? '.map' : '.js', head)
  } catch {
    return new Response(null, { status: 404 })
  }
}

function fileResponse(body: Uint8Array, extension: string, head: boolean): Response {
  const headers = new Headers({
    'cache-control': 'no-cache',
    'content-type': MIME[extension] ?? 'application/octet-stream',
  })
  if (extension === '.html') headers.set('content-security-policy', CSP)
  const content = extension === '.html'
    ? new TextEncoder().encode(injectRendererEntry(new TextDecoder().decode(body)))
    : body
  return new Response(head ? null : Uint8Array.from(content).buffer, { status: 200, headers })
}

function registerIpc(
  activeModules: ClientModuleRegistry,
  activeConnection: HostConnectionHandle,
  activeApiProxy: ApiProxy,
): void {
  ipcMain.on(IPC_BOOT, (event) => {
    assertTrustedSender(event)
    event.returnValue = activeModules.graph()
  })
  ipcMain.handle(IPC_FETCH, async (event, raw: unknown): Promise<ElectronFetchResponse> => {
    assertTrustedSender(event)
    const request = parseFetchRequest(raw)
    if (fetches.has(request.requestId)) throw new Error(`electron request ${request.requestId} is already active`)
    const controller = new AbortController()
    fetches.set(request.requestId, controller)
    try {
      const source = new URL(request.url)
      if (!isAppUrl(source.href) || !source.pathname.startsWith('/api/')) {
        throw new Error(`electron fetch refused path ${JSON.stringify(source.pathname)}`)
      }
      const headers = new Headers(request.headers)
      headers.set('host', '127.0.0.1')
      const response = await activeConnection.fetchLocal(new Request(
        new URL(source.pathname + source.search, INTERNAL_ORIGIN),
        {
          method: request.method,
          headers,
          ...(request.body === undefined ? {} : { body: request.body }),
          signal: controller.signal,
        },
      ))
      return { status: response.status, headers: [...response.headers.entries()], body: await response.text() }
    } finally {
      fetches.delete(request.requestId)
    }
  })
  ipcMain.on(IPC_FETCH_CANCEL, (event, raw: unknown) => {
    assertTrustedSender(event)
    fetches.get(parseRequestId(raw))?.abort()
  })
  ipcMain.on(IPC_STREAM_OPEN, (event, rawKind: unknown, rawId: unknown) => {
    assertTrustedSender(event)
    const kind = parseStreamKind(rawKind)
    const streamId = parseStreamId(rawId)
    streams.get(streamId)?.abort()
    const controller = new AbortController()
    streams.set(streamId, controller)
    void pumpStream(event.sender, kind, streamId, controller, activeApiProxy)
  })
  ipcMain.on(IPC_STREAM_CLOSE, (event, raw: unknown) => {
    assertTrustedSender(event)
    streams.get(parseStreamId(raw))?.abort()
  })
}

async function pumpStream(
  sender: WebContents,
  kind: 'mux' | 'host',
  streamId: ElectronStreamId,
  controller: AbortController,
  activeApiProxy: ApiProxy,
): Promise<void> {
  const request = { rpcId: RpcId(randomUUID()), payload: {} }
  try {
    const source = kind === 'mux'
      ? activeApiProxy.events.mux(request, controller.signal)
      : activeApiProxy.events.host(request, controller.signal)
    for await (const envelope of source) {
      if (controller.signal.aborted) return
      const full: ServerRequest = {
        type: 'server-request',
        rpcId: envelope.rpcId,
        method: envelope.payload.type,
        payload: envelope.payload,
      }
      if (!sendRenderer(sender, IPC_STREAM_FRAME, streamId, JSON.stringify(full))) return
    }
  } finally {
    if (streams.get(streamId) === controller) streams.delete(streamId)
    sendRenderer(sender, IPC_STREAM_END, streamId)
  }
}

function sendRenderer(sender: WebContents, channel: string, ...args: unknown[]): boolean {
  if (quitting || sender.isDestroyed() || window?.webContents !== sender) return false
  try {
    sender.send(channel, ...args)
    return true
  } catch {
    // Electron may destroy WebContents after the liveness check; every caller supplies fixed IPC values.
    return false
  }
}

function createWindow(): BrowserWindow {
  const next = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 900,
    minHeight: 640,
    show: false,
    backgroundColor: '#0b1117',
    title: 'DeepSeek Harness',
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  next.once('ready-to-show', () => { next.show() })
  next.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  next.webContents.on('will-navigate', (event, url) => {
    if (!isAppUrl(url)) event.preventDefault()
  })
  next.on('closed', () => {
    closeRendererWork()
    if (window === next) window = undefined
  })
  void next.loadURL(`${APP_ORIGIN}/`)
  return next
}

async function start(): Promise<void> {
  await app.whenReady()
  debug('Electron ready')
  const dshManifest = app.isPackaged ? require.resolve('@deepseek-ai/dsh/package.json') : undefined
  const installAnchor = dshManifest === undefined
    ? undefined
    : resolve(await realpath(dirname(dshManifest)), 'package.json')
  const options: RunProfileOptions = {
    environment: loadLayeredEnv('dsh'),
    profile: 'web',
    patchFiles: [profilePatch],
    args: [],
    useProfileModuleFallback: true,
    watchUserPatches: false,
    ...(installAnchor === undefined ? {} : { installAnchor }),
  }
  host = await runProfile(options)
  debug('profile started')
  modules = host.ctx.get('clientModules')
  connection = host.ctx.get('connection')
  apiProxy = host.ctx.get('apiProxy')
  if (modules === undefined || connection === undefined || apiProxy === undefined) {
    throw new Error('desktop profile did not provide clientModules, connection, and apiProxy')
  }
  protocol.handle('dsh', serveApp)
  registerIpc(modules, connection, apiProxy)
  window = createWindow()
  debug('window created')
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (window === undefined) window = createWindow()
    if (window.isMinimized()) window.restore()
    window.focus()
  })
  app.on('activate', () => { if (window === undefined && host !== undefined) window = createWindow() })
  app.on('before-quit', (event) => {
    if (disposed) return
    if (host === undefined) {
      quitting = true
      return
    }
    event.preventDefault()
    if (quitting) return
    quitting = true
    closeRendererWork()
    void host.shutdown.shutdown(0)
      .catch((error: unknown) => {
        debug(`shutdown failed while quitting: ${error instanceof Error ? error.stack ?? error.message : String(error)}`)
      })
      .finally(() => {
        disposed = true
        app.quit()
      })
  })
  void start().catch((error: unknown) => {
    const detail = error instanceof Error ? error.stack ?? error.message : String(error)
    debug(`startup failed: ${detail}`)
    if (quitting) return
    if (process.env.DSH_DESKTOP_DEBUG === '1') process.stderr.write(`${inspect(error, { depth: 8 })}\n`)
    dialog.showErrorBox('DeepSeek Harness failed to start', detail)
    app.exit(1)
  })
}
