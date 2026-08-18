# Agent Note: Decouple the Electron desktop carrier from the shared client packages (route B)

Status: implemented

English | [中文](2026-08-14-decouple-electron-carrier-from-shared-client.zh.md)

## Problem

The Electron desktop assembly reuses the shared Web client graph, but carrier selection was hard-coded in `dsh-client-connection`: its Client entry imported `ElectronApiClient`, inspected `window.__DSH_ELECTRON__`, and selected the desktop transport itself. That placed Electron implementation code in an upstream shared package, included Electron symbols in the Web bundle, and required every future carrier to add another selection branch. The desktop product code was otherwise contained by [the Electron desktop carrier decision](2026-08-14-electron-desktop-carrier.md), so this one import direction prevented the desktop customization from remaining independent.

## Decision

The generic Host-side capabilities remain in their owning packages: `ConnectionConfig.carrier` and `HostConnectionHandle.fetchLocal()` let the Electron main process publish `/api` without Web routes; client modules can publish their graph without a WebServer; app and profile boot accept the install anchors required by a packaged application; generic Connection RPC accepts an injected Fetch operation. These capabilities describe reusable assembly behavior and contain no renderer transport implementation.

The Client-side selection point is `ClientCarrier` in `packages/client/connection/src/client/carrier.ts`. A bootstrap registers a fully constructed `{ api, fetch, loopback }` value through `registerClientCarrier()` and `globalThis.__DSH_CLIENT_CARRIER__` before the shared Client graph starts. Connection apply gives fixture mode first priority, consumes the registered carrier when present, and otherwise constructs `WebApiClient`; generic RPC uses the selected carrier's Fetch operation, and `isLoopback` uses its trusted-local fact. The shared package does not inspect `window.__DSH_ELECTRON__` or import any desktop module.

`apps/electron/src/renderer/electron-carrier.ts` owns `electronBridge()` and `ElectronApiClient`. The standalone `apps/electron/src/renderer/entry.ts` bundle requires the preload bridge, constructs the Electron carrier, and registers it. The main process serves that bundle at `dsh://app/electron-renderer.js` and injects its module script immediately before the built Web shell module. Missing preload state or a shell HTML document without a module entry fails startup loudly instead of silently selecting the Web fallback.

## Verification

Connection tests register a transport-independent carrier, assert fixture precedence, and prove generic RPC uses its Fetch operation and loopback fact. Electron tests cover bridge validation, unary Fetch, cancellation, both event-stream openings, and malformed IPC values; the HTML test pins bootstrap ordering. The desktop TypeScript and tsdown build emits one standalone ESM renderer bundle alongside the ESM main process and CJS preload. Web build verification checks that the shared client artifact contains neither `ElectronApiClient` nor `__DSH_ELECTRON__`.

## Alternatives considered

**Keep the hard-coded branch and rebase a private fork.** This preserves behavior with less immediate work but keeps Electron code in the shared package and Web artifact, and reopens the same selection branch for every carrier.

**Move the desktop into a separate repository immediately.** A separately versioned desktop can consume published Harness packages only after these generic capabilities and the registration API exist as published interfaces. That route remains a distribution continuation of this decision, not a replacement for it.

**Inject the carrier as a Cordis service.** The shared Web profile assembles the Client graph, so a desktop-only service would also require a new client-plugin registration mechanism and static entry. The fixed pre-boot global follows the existing `__DSH_BOOT__` and `__DSH_ELECTRON__` cross-bundle pattern with less machinery.

**Fork the frontend for desktop.** A fork would duplicate the product UI, client-module graph, and protocol consumers even though only physical transport differs.

## Consequences

All Electron-specific renderer code lives under `apps/electron`; deleting that application leaves the shared client source and Web bundle transport-neutral. A new carrier supplies one `AbstractApiClient` implementation plus one pre-boot `ClientCarrier` registration without editing Connection selection code. The fixed global key and module ordering are new startup obligations, so the Electron entry asserts the preload bridge and focused HTML coverage fixes its position before the shell entry. Root workspace, TypeScript, build, and packaging wiring still belong to the monorepo application; publishing and versioning a separate Route C desktop remains deferred.
