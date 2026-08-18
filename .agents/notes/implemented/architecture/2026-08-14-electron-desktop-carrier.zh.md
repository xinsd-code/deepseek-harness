# Agent Note: Electron 桌面载体

Status: implemented

[English](2026-08-14-electron-desktop-carrier.md) | 中文

## Problem

共享 GUI 客户端此前只能通过浏览器 HTTP 应用使用，尽管它的 API 与模块抽象已经与传输无关。macOS 桌面组装需要复用这套客户端图，同时不能增加回环监听端口、不能向 renderer 代码暴露 Node 原语，也不能产生第二套业务协议。

## Decision

`apps/electron` 通过 `runProfile()` 启动随发行版交付的 `web` profile，并应用 `config/electron.patch.yml`。overlay 禁用 HTTP 服务器、Web 启动、Web 运行时与 HMR 配置项，再把 `dsh-client-modules` 和 `dsh-client-connection` 配置为 `electron` 载体。Host 插件图和客户端名单仍复用 Web 组装；只有物理发布方式发生变化。打包过程把 preset、前端资产和 workspace 包的发布文件放入应用，因此启动时不会解析到源码 checkout。

主进程把 `dsh` 注册为特权标准 scheme，并在 `dsh://app` 提供已构建前端、SPA 回退、启动图、客户端 bundle、sourcemap 与桌面 renderer 引导。上下文隔离的 preload 发布固定的 `window.__DSH_ELECTRON__` 方法。`apps/electron/src/renderer/electron-carrier.ts` 持有桥接校验与 `ElectronApiClient`；引导脚本构造与传输无关的 `ClientCarrier`，并在共享 shell 入口运行前通过 `globalThis.__DSH_CLIENT_CARRIER__` 注册。`dsh-client-connection` 消费注册后的 API、通用 RPC Fetch 操作与 loopback 事实，不导入 Electron 代码。Unary API 操作使用仅 JSON 的 Fetch 请求与响应消息；mux 与 host 仍是两条独立事件流，并保留现有 `ConnectionController` 的 readiness 与重连语义。`HostConnectionHandle.fetchLocal()` 让可信主进程请求经过浏览器 route 同样使用的 `/api` Typert interceptor 与 API Proxy 回退。

## Security and lifecycle

renderer 启用 Chromium 沙箱和上下文隔离，并禁用 Node integration。preload 不暴露 `ipcRenderer`；每条消息都使用固定 channel，主进程会校验其协议值。只有活动窗口中 frame URL 的协议为 `dsh:` 且 host 为 `app` 时才接受 IPC，Fetch 还被限制在 `/api/*`。自定义协议响应应用严格的 Content Security Policy，应用内导航不能离开 `dsh://app`，HTTP(S) 链接则通过系统浏览器打开。

Fetch 和流请求各自持有一个 `AbortController`。renderer 取消、窗口关闭和应用退出都会中止对应 Host 工作。Electron 的 `before-quit` handler 会等待 profile shutdown 后才最终退出应用，并收束 shutdown 拒绝而不留下未处理 Promise；开始退出后，启动失败不会再弹出错误对话框。单实例锁避免两棵 Host 树意外共享同一 home 状态。

## Verification

包测试会在没有 WebServer 的情况下组合客户端模块和 `/api` interceptor，与具体传输无关地选择注册载体，承载 Electron unary 请求，打开两条 Electron 事件流，拒绝畸形 IPC 值，并钉住 renderer 引导顺序。桌面 workspace 会进行类型检查，并构建 ESM 主进程、兼容沙箱的 CJS preload 与独立 ESM renderer 引导。运行时验证会打开并关闭真实 Electron 窗口，且退出时不出现错误对话框；打包检查会生成 macOS `.app`，Forge 的 ZIP maker 则提供可分发压缩包。

## Alternatives considered

**在回环地址启动现有 Web 服务器，再让 Electron 指向它。** 这会保留一个不必要的监听 socket，在单进程应用内部重新引入 Host 与 Origin 可达性策略，并让 renderer 到 host 的认证依赖网络假设。

**通过 `file://` 加载外壳。** 特权标准自定义 scheme 为应用提供一个显式安全来源，也避免本地文件附带的特殊行为和相对资源限制。

**暴露原始 `ipcRenderer` 或通用 invoke 函数。** 任一做法都会让未来的 renderer 入侵演变为不断扩大的主进程权限。固定 preload 表层让每项已授权操作都可审查，并把载荷校验留在进程边界。

**为桌面 fork 前端。** 客户端模块图、API schema、会话行为和 UI 已经共享。fork 会造成产品分歧，却不解决任何传输需求。

## Consequences

macOS 可以在没有 HTTP 监听端口的情况下运行同一套 Harness GUI 与 Host 图。代价是需要维护 Electron 主进程／preload 边界、为当前 JSON API 整体缓冲文本响应，以及让桌面 overlay 与随发行版交付的 Web profile 保持一致。本地产物未签名；签名、公证、自动更新策略和安装器展示仍属于分发工作，不属于运行时行为。
