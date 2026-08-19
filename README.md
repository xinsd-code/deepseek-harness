# DeepSeek Harness

English | [中文](README.zh.md)

DeepSeek Harness (`dsh`) is an open-source agent harness developed by [DeepSeek AI](https://deepseek.com). It is built on [Cordis](https://github.com/cordiverse/cordis) around an **everything is a plugin** architecture: Host capabilities, client pages, profile composition, and out-of-tree extensions all participate through the same lifecycle-aware plugin model.

## Developer preview

DeepSeek Harness is currently in _developer preview_ and is iterating rapidly. **There will be compatibility-breaking changes.**

## Run

Install Node.js and start the published Web UI:

```sh
npx @deepseek-ai/dsh web
```

The Web UI is served at `http://127.0.0.1:3080` by default. See the [Web UI guide](docs/user/guide/index.md) for provider and model setup.

## Run from source

The repository requires Node.js `^22.19.0` or `>=24.0.0` and pnpm `11.7.0`.

```sh
git clone https://github.com/deepseek-ai/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm run build
pnpm dsh web
```

Set `DEEPSEEK_API_KEY` in the environment or the repository `.env` file before making real DeepSeek requests. See the [development guide](docs/development.md) for the contributor workflow and the [architecture documentation](docs/architecture.md) before changing packages.

## Desktop client

The desktop workspace packages the shared GUI as an Electron application for macOS. Install dependencies, then build the repository and open the client:

```sh
pnpm desktop
```

Create a local application bundle or a ZIP distribution:

```sh
pnpm desktop:package
pnpm desktop:make
```

Both commands rebuild the repository first. `desktop:package` produces the macOS `.app`; `desktop:make` produces the `.app` and an additional ZIP through Electron Forge. Results are written below `apps/electron/out/` for the current Mac architecture. The application is self-contained and does not require the source checkout at runtime.

The packaging script applies ad-hoc code signing so the local bundle can run, but it does not provide an Apple Developer ID signature or notarization. Public distribution requires the corresponding Apple credentials and release workflow. The current desktop target has no Windows or Linux package, automatic updates, or installer UI. See the [desktop workspace reference](apps/electron/README.md) for the complete limitations and security behavior.

## Desktop implementation

The Electron main process starts the shipped `web` profile through `runProfile()` and adds `apps/electron/config/electron.patch.yml`. This overlay keeps the shared Host services and client plugin graph, disables the browser HTTP server and HMR, and selects the Electron implementations of the module and connection carriers.

The renderer loads the shared Web frontend from `dsh://app/`. The main process serves built frontend assets and installed plugin `client.js` bundles through that private protocol. A context-isolated preload exposes only the boot graph, buffered `/api/*` Fetch calls, cancellation, and the declared event streams; the renderer registers this bridge before the shared client graph starts. `nodeIntegration` is disabled, context isolation and Chromium sandboxing are enabled, foreign in-app navigation is rejected, and explicit HTTP(S) links open in the system browser.

Because browser and desktop clients use the same `web` profile and client module roster, a compatible client plugin installed into that profile is available on both surfaces. The desktop transport changes how the UI reaches the local Host; it does not add model-visible input or alter provider requests.

## Out-of-tree plugins

Self-contained plugins live under [`plugins/`](plugins/README.md). They extend dsh through Cordis without editing `packages/`, `apps/`, `vendor/`, or shipped profile files. A plugin may provide a Host patch layer through `dsh.bundle.patch` and a browser/desktop module through `dsh.client`; registrations are owned by Cordis effects so removing the plugin also removes its contributions.

Build a local plugin with the command documented by its own README, then install it into a profile:

```sh
pnpm dsh plugin --profile <profile> add ./plugins/<plugin>
```

The command installs the package into that profile and activates its declared `cordis.patch.yml` layer. Plugin state is profile-scoped: installing into `web` does not add the plugin to unrelated profiles. `add`, `remove`, `update`, `why`, and other arguments are forwarded to pnpm in the profile directory. Remove a plugin by package name:

```sh
pnpm dsh plugin --profile <profile> remove <package-name>
```

## Usage dashboard plugin

[`plugins/usage-dashboard`](plugins/usage-dashboard/README.md) provides token observation across persisted sessions. Build and install it into the shared Web profile:

```sh
pnpm --dir plugins/usage-dashboard bundle
pnpm dsh plugin --profile web add ./plugins/usage-dashboard
```

Then start the browser UI:

```sh
pnpm dsh --profile web
```

Or start the desktop client instead:

```sh
pnpm desktop
```

The plugin contributes a standalone **Token usage** section under Settings. It does not add an agent preset, mode, or conversation-home entry. Its responsive page supports light and dark themes in both the browser and desktop clients.

The overview reports total tokens, uncached input, cache reads, output, reasoning, cache-hit rate, peak daily tokens, contributing sessions, and estimated cost. Cache writes remain part of total and billing calculations but are not shown as a separate dimension. Reasoning is a subdivision of output and is not counted twice. Daily, weekly, and cumulative views share a rolling 12-calendar-month activity map with month labels below the cells.

Billing is estimated only for DeepSeek provider routes whose models have configured prices. The UI formats CNY as `¥0.00` and explains the DeepSeek-only scope beside the amount; other providers and unknown DeepSeek models receive no fabricated charge. Usage days are attributed in UTC, historical data is replayed from persisted session logs, and omitted provider fields count as zero. See the plugin README for exact aggregation rules, default prices, configuration, tests, and limitations.

Remove the plugin without changing any repository composition file:

```sh
pnpm dsh plugin --profile web remove dsh-usage-dashboard
```

## Community and support

- Feel free to submit feedback or bug reports through [GitHub Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions).
- Add the [`dsh-plugin`](https://github.com/topics/dsh-plugin) topic to your plugin repository for discoverability.
- Join the <a href="https://discord.gg/Ycq5dCaS4">DeepSeek Harness Discord community</a>.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Agents must follow [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE)

Third-party dependencies and their licenses are disclosed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
