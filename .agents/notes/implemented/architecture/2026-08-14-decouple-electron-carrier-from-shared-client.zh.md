# Agent Note: 将 Electron 桌面载体与共享客户端包解耦（路线 B）

Status: implemented

[English](2026-08-14-decouple-electron-carrier-from-shared-client.md) | 中文

## Problem

Electron 桌面组装复用共享 Web 客户端图，但载体选择曾硬编码在 `dsh-client-connection` 中：它的 Client 入口导入 `ElectronApiClient`、检查 `window.__DSH_ELECTRON__`，并自行选择桌面传输。这让 Electron 实现代码进入上游共享包与 Web bundle，也要求未来每个载体再增加一条选择分支。除此之外，桌面产品代码已由 [Electron 桌面载体决策](2026-08-14-electron-desktop-carrier.md)约束在自身目录内，因此这条反向导入是桌面定制无法保持独立的唯一实现耦合。

## Decision

通用 Host 能力留在各自所属包中：`ConnectionConfig.carrier` 与 `HostConnectionHandle.fetchLocal()` 让 Electron 主进程无需 Web route 即可发布 `/api`；客户端模块无需 WebServer 也能发布图；app 与 profile boot 接受打包应用所需的 install anchor；通用 Connection RPC 接受注入的 Fetch 操作。这些能力描述可复用的组装行为，不包含 renderer 传输实现。

Client 侧选择点是 `packages/client/connection/src/client/carrier.ts` 中的 `ClientCarrier`。引导脚本在共享 Client 图启动前，通过 `registerClientCarrier()` 与 `globalThis.__DSH_CLIENT_CARRIER__` 注册完整的 `{ api, fetch, loopback }` 值。Connection apply 先选择 fixture 模式，其次消费已注册载体，未注册时才构造 `WebApiClient`；通用 RPC 使用所选载体的 Fetch 操作，`isLoopback` 使用载体提供的可信本地事实。共享包不检查 `window.__DSH_ELECTRON__`，也不导入任何桌面模块。

`apps/electron/src/renderer/electron-carrier.ts` 持有 `electronBridge()` 与 `ElectronApiClient`。独立的 `apps/electron/src/renderer/entry.ts` bundle 要求 preload 桥存在，构造 Electron 载体并注册它。主进程在 `dsh://app/electron-renderer.js` 提供该 bundle，并把其 module script 注入到已构建 Web shell module 之前。preload 状态缺失或 shell HTML 没有 module 入口时，启动会明确失败，不会悄悄回退到 Web 载体。

## Verification

Connection 测试注册与传输无关的载体，断言 fixture 优先级，并证明通用 RPC 使用该载体的 Fetch 操作与 loopback 事实。Electron 测试覆盖桥校验、unary Fetch、取消、两条事件流打开及畸形 IPC 值；HTML 测试钉住引导顺序。桌面 TypeScript 与 tsdown 构建会在 ESM 主进程和 CJS preload 之外生成单文件 ESM renderer bundle。Web 构建验证确认共享客户端产物既不包含 `ElectronApiClient`，也不包含 `__DSH_ELECTRON__`。

## Alternatives considered

**保留硬编码分支并 rebase 私有 fork。** 这能以更少的即时工作保留行为，但 Electron 代码仍留在共享包与 Web 产物中，每个新载体也仍需改动同一选择分支。

**立即把桌面移入独立仓库。** 独立版本的桌面只有在这些通用能力与注册 API 成为已发布接口后，才能消费已发布 Harness 包。这条路线仍是本决策在分发层面的延续，不是替代方案。

**用 Cordis 服务注入载体。** 共享 Web profile 负责组装 Client 图，因此桌面专用服务还需要新的客户端插件注册机制与静态入口。固定的启动前 global 延续既有 `__DSH_BOOT__` 与 `__DSH_ELECTRON__` 跨 bundle 模式，所需机制更少。

**为桌面 fork 前端。** 只有物理传输不同，fork 却会复制产品 UI、客户端模块图与协议消费方。

## Consequences

所有 Electron 专用 renderer 代码都位于 `apps/electron`；删除该应用后，共享客户端源码与 Web bundle 仍与传输无关。新载体只需提供一个 `AbstractApiClient` 实现和一次启动前 `ClientCarrier` 注册，无需编辑 Connection 选择代码。固定 global 键与 module 顺序成为新的启动义务，因此 Electron 入口会断言 preload 桥存在，focused HTML 测试也固定其位于 shell 入口之前。根 workspace、TypeScript、构建与打包 wiring 仍属于 monorepo 应用；独立发布与版本化的路线 C 桌面继续暂缓。
