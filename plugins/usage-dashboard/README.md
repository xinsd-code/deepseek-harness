# usage-dashboard

English | [中文](README.zh.md)

`dsh-usage-dashboard` is an out-of-tree Cordis plugin that reports token usage across persisted dsh sessions. One Web client bundle serves both the browser UI and the Electron desktop app, whose application profile reuses the Web client graph.

## Reported values

- The dashboard shows uncached input, cache reads, output, and reasoning. Cache writes remain part of the internal total and billing arithmetic but are not presented as a separate UI dimension. The buckets follow `TokenUsage`: input, cache-read, and cache-write counts are disjoint, while reasoning is a subdivision of output and is not added to the total again.
- Cache hit rate is `cache read / (uncached input + cache read + cache write)`. A cache write is not displayed as a hit.
- Daily values use each usage event's UTC date. All-time, last-7-day, and last-30-day selections are sent to the Host, so the overview metrics, contributing-session count, billing rows, and the current rolling 12-calendar-month activity map always use the selected data. The heatmap stays borderless, fills the content width, and places exactly 12 distinct month labels below the cells.
- Billing is an estimate shown only for DeepSeek provider routes with a configured model price. The UI displays the combined estimate and each billing line as CNY with a `¥` prefix and two decimal places; the question-mark hint states the DeepSeek-only scope. Other providers and unknown DeepSeek models do not receive a fabricated charge.
- The dashboard does not display a per-model token table. Per-model aggregation remains internal because billing still needs provider-route and model separation.

## Default DeepSeek prices

The default rate card follows the [official DeepSeek API pricing](https://api-docs.deepseek.com/quick_start/pricing/) checked on 19 August 2026. Prices are CNY per million tokens.

| Model | Cache hit | Cache miss | Output |
| --- | ---: | ---: | ---: |
| `deepseek-v4-flash` | 0.02 | 1 | 2 |
| `deepseek-v4-pro` | 0.025 | 3 | 6 |

`deepseek-chat` and `deepseek-reasoner` are retained as historical aliases of `deepseek-v4-flash`. The plugin prices cache writes at the cache-miss rate because dsh token buckets are disjoint. Costs remain unrounded during aggregation and are formatted only by the UI; the provider invoice remains authoritative.

## Cordis integration

| Part | Implementation | Lifecycle |
| --- | --- | --- |
| Session projection | `src/usage-projection.ts` folds `request/header`, `assistant/chunk`, and `assistant/message` events by provider, model, and UTC day. Adjacent streaming and final samples for the same turn and step replace one another. | Registered through `ctx.effect()` and removed with the plugin fiber. |
| Host gateway | `src/gateway.ts` reads live projections or cold-replays persisted sessions and exposes the range-aware `usageStats.summary` Typert Remote method. | Cordis injects the projection, cache, persistence, and live-session services. |
| Client plugin | `src/client/index.ts` mounts the package-owned Typert descriptor, locale dictionaries, and a `settings.section` page. | Remote mount, locale registration, and slot contribution are fiber-owned reversible effects. |
| Composition bundle | `cordis.patch.yml` inserts the single `usage-dashboard` entry. | `dsh plugin add/remove` adds or removes the package layer from one profile. |

The runtime package imports only published harness package interfaces. Building the browser half inside this repository reuses `packages/client/tsdown.client.ts` because the lazy-CJS client preset is not yet published; this is a build-time dependency and does not patch or change that file.

## Build, install, and run

Build the plugin before starting a profile:

```sh
pnpm --dir plugins/usage-dashboard bundle
```

Install it into the Web profile, then start either surface:

```sh
pnpm dsh plugin --profile web add ./plugins/usage-dashboard
pnpm dsh --profile web
pnpm --filter @deepseek-ai/dsh-desktop start
```

The Settings panel shows a standalone **Token usage** section. Nothing is added to the agent presets or conversation home. Both surfaces load the same `dsh.client` entry; the desktop app uses its Electron carrier while the browser uses HTTP.

Remove the plugin without editing the shipped Web or desktop composition:

```sh
pnpm dsh plugin --profile web remove dsh-usage-dashboard
```

## Configuration

`pricing` is a Cordis plugin configuration dictionary keyed by model id. Each row declares per-million-token `input`, `cacheRead`, `cacheWrite`, and `output` prices plus `currency`. A profile overlay can replace the defaults:

```yaml
- insert:
    - id: usage-dashboard
      name: dsh-usage-dashboard
      config:
        pricing:
          deepseek-v4-flash:
            input: 1
            cacheRead: 0.02
            cacheWrite: 1
            output: 2
            currency: CNY
```

## Verification

```sh
pnpm --dir plugins/usage-dashboard test
pnpm --dir plugins/usage-dashboard typecheck
pnpm --dir plugins/usage-dashboard bundle
```

The tests cover streaming-sample replacement, UTC-day attribution across midnight, provider/model separation, range-consistent totals and session counts, DeepSeek-only billing, unrounded cost arithmetic, two-decimal CNY presentation, annual activity metrics, cache-hit-rate presentation, empty ranges, and failed range requests.

## Limits

- The dashboard can count only usage emitted into the session event log. A provider that omits a cache or reasoning field contributes zero to that bucket.
- Historical sessions are folded on demand through the projection cache; damaged or unreadable session logs fail the summary instead of silently undercounting it.
- Typert artifacts in `lib/typert.host.js` and `lib/typert.remote-client.js` are maintained with the out-of-tree package because the repository-wide generator does not scan this directory.
