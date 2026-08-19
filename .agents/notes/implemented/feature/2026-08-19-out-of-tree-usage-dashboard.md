# Agent Note: Out-of-tree usage dashboard accounting and client composition

Status: implemented

English | [中文](2026-08-19-out-of-tree-usage-dashboard.zh.md)

## Problem

The out-of-tree `dsh-usage-dashboard` package had the expected Host projection, Typert gateway, and browser dashboard, but its first implementation could not be treated as an accounting surface. It counted cache writes as hits, applied the selected date range only to the heatmap while leaving totals and billing at all time, grouped usage only by model id, assigned a complete session to its creation date, rounded each billing line before summing, and priced every route whose model name matched a DeepSeek row. Its published default prices were placeholders. The package's runtime exports pointed at TypeScript source, so Electron failed to import the Host entry, and its client dependency graph named the plain `ui-slots` package as a plugin dependency.

The feature also had to remain an out-of-tree Cordis plugin. Browser and Electron support could not be delivered through new in-tree rows or app-specific code, and every registration had to disappear when its plugin fiber was disposed. This follows the [profile plugin bundle](../architecture/2026-08-05-profile-plugin-bundles.md) and [client plugin loading](../architecture/2026-07-23-client-plugin-loading-model.md) decisions.

## Decision

The session event log remains the sole usage input. A plugin-owned projection folds `request/header` with usage-bearing `assistant/chunk` and `assistant/message` events. It preserves the harness `TokenUsage` semantics: uncached input, cache reads, and cache writes are disjoint; reasoning is an output subdivision. Adjacent streaming and final samples with the same turn and step replace one another, including when the final sample arrives on a later UTC day. Each retained sample is grouped by provider route, model id, and the event's UTC day.

Date selection is a Host query parameter. The gateway validates inclusive `YYYY-MM-DD` bounds, reads live projections or cold-replays persisted sessions, and sends only the selected days to one pure aggregator. Totals, contributing-session count, provider/model rows, billing rows, and heatmap days therefore derive from the same set. Cold replay failures propagate instead of returning a partial result.

Billing is provider-aware and configurable through the plugin's Cordis `pricing` config. Only provider route ids containing `deepseek` and models present in the rate card produce billing lines. The defaults are the official CNY-per-million-token rates current on 19 August 2026 for `deepseek-v4-flash` and `deepseek-v4-pro`, with the deprecated `deepseek-chat` and `deepseek-reasoner` ids retained as historical Flash aliases. Cache writes use the cache-miss input rate, calculations remain unrounded until presentation, and each line keeps its currency.

One `dsh.client` Web entry serves both surfaces. The outer client fiber awaits its package-owned Typert Remote mount; a child fiber that explicitly injects `remote.usageStats`, locale, and settings slots then registers the dictionaries and standalone settings section. Electron composes the same Web client graph and supplies its own Remote carrier. The manifest dependency edges name only client plugins; `ui-slots` remains a plain, statically provided package. Runtime exports point to built JavaScript, while TypeScript sees the source declarations.

The plugin remains under `plugins/usage-dashboard` and contributes one bundle patch row. It changes no application or harness package source. Its build config imports the repository's unpublished `clientBundle` preset; the emitted Host and client runtimes depend only on public package exports and profile-provided peer dependencies.

## Alternatives considered

- **Instrument provider adapters directly:** rejected because it would edit existing packages, duplicate the model-visible event log, and require one integration per provider.
- **Fetch all-time data and filter only in React:** rejected because it permits different sections and session counts to cover different intervals and transfers unnecessary history to the client.
- **Price by model id alone:** rejected because another provider may reuse a DeepSeek model id or proxy an independently priced deployment.
- **Treat cache writes as hits:** rejected because the harness declares input, cache-read, and cache-write buckets disjoint; only reads were served from cache.
- **Add a desktop-specific client entry:** rejected because Electron deliberately composes the Web client graph; a second entry would duplicate UI and lifecycle behavior.
- **Ignore cold projection failures:** rejected because a plausible-looking partial total is worse than a visible summary error for an observation surface.

## Consequences

The dashboard's overview, billing, heatmap, range metadata, and session count are internally consistent for the chosen UTC interval. Non-DeepSeek usage remains observable without a fabricated price, while DeepSeek estimates can track a deployment-specific rate card. Historical logs are folded on demand and do not require a separate metrics database.

Installation and removal are profile operations, and Host projection registration, Typert Remote mounting, locales, and the settings contribution follow Cordis fiber disposal. Browser and desktop code paths share the same plugin artifact. The current repository still has one authoring friction already identified by the [plugin-owned settings decision](../architecture/2026-08-12-plugin-owned-settings-surface.md): the client bundle preset is not published, so a source checkout is required to rebuild this out-of-tree browser half.

The dashboard cannot recover token fields a provider omitted from the session log, and its cost is an estimate rather than an invoice. Typert descriptors stay package-owned manual artifacts until the generator accepts out-of-tree roots; changing the gateway method or wire types requires updating both descriptors.
