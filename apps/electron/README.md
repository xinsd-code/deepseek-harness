# DeepSeek Harness Desktop

English | [中文](README.zh.md)

This workspace packages the shared DeepSeek Harness GUI as a macOS Electron application. It boots the shipped `web` profile with a desktop overlay, publishes the built shell and client plugin bundles at `dsh://app`, and carries `/api` Fetch operations plus the two event streams through a context-isolated preload bridge. A desktop-owned renderer bootstrap registers this carrier before the shared Client graph starts; the shared connection package contains no Electron implementation. The application does not start the browser HTTP server.

## Development

Build the repository and open the desktop window:

```sh
pnpm desktop
```

Build an unsigned `.app` bundle or a distributable ZIP:

```sh
pnpm desktop:package
pnpm desktop:make
```

Forge writes self-contained results below `apps/electron/out/`; the packaged application does not require a source checkout. These local artifacts are not signed or notarized; public distribution requires an Apple Developer identity and a notarization workflow.

Packaging stages production dependencies and restores the workspace's full dependency installation before returning, so later `pnpm` commands retain the development tools.

The application icon is stored as `assets/app-icon.png` for the running Dock icon and `assets/app-icon.icns` for the packaged macOS bundle.

## Security

The renderer has `nodeIntegration: false`, `contextIsolation: true`, and Chromium sandboxing enabled. The preload exposes only the boot graph, buffered JSON Fetch, cancellation, and the two declared event streams. The main process accepts IPC only from the active window at `dsh://app`, constrains Fetch to `/api/*`, applies a restrictive Content Security Policy, refuses in-app navigation to foreign origins, and opens explicit HTTP(S) links in the system browser. Once application shutdown begins, startup failures no longer open an error dialog, and profile-shutdown rejection is contained before the final quit.

## Model Experience

The desktop carrier adds no model-visible input. It runs the same profile, session log, prompt sections, tool schemas, and client plugin graph as the browser application.

#### KV Cache effect

None; changing the physical GUI carrier does not change provider requests.

## Known Limitations and Deferred Work

- The current output targets macOS and has no signing, notarization, automatic updates, or installer UI.
- The IPC Fetch response is buffered as text, matching the existing JSON API surface; a binary or streaming API would require an explicit wire-format extension.
- HMR is disabled in the packaged desktop composition; development currently rebuilds before launch.
