# Out-of-tree plugins

English | [中文](README.zh.md)

This directory contains self-contained dsh Cordis plugins. A plugin joins a profile through the framework's composition and client-loading mechanisms without editing files under `packages/`, `apps/`, `vendor/`, or the repository root.

## Package requirements

- The Host half declares `dsh.bundle.patch`; `dsh plugin --profile <name> add <path>` installs the package and adds its patch layer to `dsh.profile.bundles`.
- A browser or desktop client half declares `dsh.client` and exports `./client` as the client module system's lazy-CJS bundle. Electron composes the Web profile and loads the same client entry through its own carrier.
- Runtime code consumes harness packages through `peerDependencies` and public exports. Contributions and registrations belong to Cordis effects so unloading the plugin removes them.
- Removing a plugin with `dsh plugin --profile <name> remove <package>` removes its profile layer; no shipped composition file needs a compensating edit.

## Available plugin

| Directory | Purpose |
| --- | --- |
| [`usage-dashboard`](usage-dashboard/README.md) | Cross-session token accounting, cache-hit visibility, UTC ranges, and DeepSeek billing estimates for Web and Electron. |

The current out-of-tree client build reuses `packages/client/tsdown.client.ts` because its lazy-CJS build preset is not yet published. This repository-relative import is limited to the build configuration; the emitted runtime does not import repository source.

## Verification

Each plugin owns package-local tests, type checking, and a build command. Its README documents installation, removal, configuration, and surface-specific smoke tests.
