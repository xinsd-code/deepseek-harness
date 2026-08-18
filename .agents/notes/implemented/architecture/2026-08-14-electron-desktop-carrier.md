# Agent Note: Electron desktop carrier

Status: implemented

English | [中文](2026-08-14-electron-desktop-carrier.zh.md)

## Problem

The shared GUI client was available only through the browser HTTP application even though its API and module abstractions were already transport-independent. A macOS desktop assembly needs to reuse that client graph without adding a loopback listener, exposing Node primitives to renderer code, or creating a second application protocol.

## Decision

`apps/electron` boots the shipped `web` profile through `runProfile()` and applies `config/electron.patch.yml`. The overlay disables the HTTP server, Web startup, Web runtime, and HMR rows, then configures `dsh-client-modules` and `dsh-client-connection` with the `electron` carrier. The Host plugin graph and client roster remain the shared Web composition; only physical publication changes. Packaging stages the preset, frontend assets, and published workspace package files inside the application so startup never resolves through a source checkout.

The main process registers `dsh` as a privileged standard scheme and serves the built frontend, SPA fallback, boot graph, client bundles, source maps, and a desktop renderer bootstrap at `dsh://app`. The context-isolated preload publishes the fixed `window.__DSH_ELECTRON__` methods. `apps/electron/src/renderer/electron-carrier.ts` owns the bridge validation and `ElectronApiClient`; the bootstrap constructs a transport-independent `ClientCarrier` and registers it through `globalThis.__DSH_CLIENT_CARRIER__` before the shared shell entry runs. `dsh-client-connection` consumes the registered API, generic-RPC Fetch operation, and loopback fact without importing Electron code. Unary API operations are JSON-only Fetch request and response messages; mux and host remain separate event streams and retain the existing `ConnectionController` readiness and reconnection semantics. `HostConnectionHandle.fetchLocal()` sends trusted main-process requests through the same `/api` Typert interceptor and API Proxy fallback used by the browser route.

## Security and lifecycle

The renderer enables Chromium sandboxing and context isolation and disables Node integration. The preload does not expose `ipcRenderer`; every message uses a fixed channel and the main process validates its wire value. IPC is accepted only from the active window whose frame URL uses protocol `dsh:` and host `app`, and Fetch is restricted to `/api/*`. The custom-protocol response applies a restrictive Content Security Policy, in-app navigation cannot leave `dsh://app`, and HTTP(S) links open through the system browser.

Fetch and stream requests each own an `AbortController`. Renderer cancellation, window close, and application shutdown abort the corresponding Host work. The Electron `before-quit` handler waits for profile shutdown before the final application exit and contains shutdown rejection instead of leaving an unhandled promise; startup failures do not open an error dialog after quitting begins. A single-instance lock prevents two Host trees from sharing the same home state accidentally.

## Verification

Package tests compose client modules and the `/api` interceptor without a WebServer, select a registered carrier independently of its transport, carry Electron unary requests, open both Electron event streams, reject malformed IPC values, and pin renderer-bootstrap ordering. The desktop workspace typechecks and builds its ESM main process, sandbox-compatible CJS preload, and standalone ESM renderer bootstrap. Runtime verification opens and closes a real Electron window without an exit error dialog; the packaging check produces a macOS `.app`, and Forge's ZIP maker provides the distributable archive.

## Alternatives considered

**Start the existing Web server on loopback and point Electron at it.** This retains an unnecessary listening socket, reintroduces Host and Origin reachability policy inside a single-process application, and leaves renderer-to-host authentication dependent on network assumptions.

**Load the shell through `file://`.** A privileged standard custom scheme gives the application one explicit secure origin and avoids the special behavior and relative-resource restrictions attached to local files.

**Expose raw `ipcRenderer` or a generic invoke function.** Either turns future renderer compromise into an expanding main-process authority. A fixed preload surface makes each authorized operation reviewable and keeps payload validation at the process boundary.

**Fork the frontend for desktop.** The client-module graph, API schemas, session behavior, and UI are already shared. A fork would create product drift while solving no transport requirement.

## Consequences

macOS can run the same Harness GUI and Host graph without an HTTP listener. The cost is a maintained Electron main/preload boundary, buffered text responses for the current JSON API, and a desktop overlay that must stay aligned with the shipped Web profile. Local packages are unsigned; signing, notarization, auto-update policy, and installer presentation remain distribution work rather than runtime behavior.
