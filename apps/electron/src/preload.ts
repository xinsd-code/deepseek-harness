/** Context-isolated preload exposing the fixed Harness bridge and boot graph. */

import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  IPC_BOOT,
  IPC_FETCH,
  IPC_FETCH_CANCEL,
  IPC_STREAM_CLOSE,
  IPC_STREAM_END,
  IPC_STREAM_FRAME,
  IPC_STREAM_OPEN,
  type ElectronFetchRequest,
  type ElectronFetchResponse,
  type ElectronRequestId,
  type ElectronStreamId,
  type ElectronStreamKind,
} from './ipc.ts'

interface StreamListeners {
  frame: (_event: IpcRendererEvent, streamId: ElectronStreamId, json: string) => void
  end: (_event: IpcRendererEvent, streamId: ElectronStreamId) => void
}

const streams = new Map<ElectronStreamId, StreamListeners>()

const bridge = {
  fetch: (request: ElectronFetchRequest): Promise<ElectronFetchResponse> => ipcRenderer.invoke(IPC_FETCH, request),
  cancelFetch: (requestId: ElectronRequestId): void => { ipcRenderer.send(IPC_FETCH_CANCEL, requestId) },
  openStream(
    kind: ElectronStreamKind,
    streamId: ElectronStreamId,
    onFrame: (json: string) => void,
    onEnd: () => void,
  ): void {
    if (streams.has(streamId)) throw new Error(`electron stream ${streamId} is already open`)
    const listeners: StreamListeners = {
      frame: (_event, candidate, json) => { if (candidate === streamId) onFrame(json) },
      end: (_event, candidate) => {
        if (candidate !== streamId) return
        closeStream(streamId, false)
        onEnd()
      },
    }
    streams.set(streamId, listeners)
    ipcRenderer.on(IPC_STREAM_FRAME, listeners.frame)
    ipcRenderer.on(IPC_STREAM_END, listeners.end)
    ipcRenderer.send(IPC_STREAM_OPEN, kind, streamId)
  },
  closeStream: (streamId: ElectronStreamId): void => { closeStream(streamId, true) },
}

function closeStream(streamId: ElectronStreamId, notifyMain: boolean): void {
  const listeners = streams.get(streamId)
  if (listeners === undefined) return
  streams.delete(streamId)
  ipcRenderer.removeListener(IPC_STREAM_FRAME, listeners.frame)
  ipcRenderer.removeListener(IPC_STREAM_END, listeners.end)
  if (notifyMain) ipcRenderer.send(IPC_STREAM_CLOSE, streamId)
}

contextBridge.exposeInMainWorld('__DSH_BOOT__', ipcRenderer.sendSync(IPC_BOOT))
contextBridge.exposeInMainWorld('__DSH_ELECTRON__', bridge)
