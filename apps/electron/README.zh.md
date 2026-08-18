# DeepSeek Harness Desktop

[English](README.md) | 中文

本 workspace 把共享的 DeepSeek Harness GUI 打包为 macOS Electron 应用。它用桌面 overlay 启动随发行版交付的 `web` profile，在 `dsh://app` 发布已构建的外壳与客户端插件 bundle，并通过上下文隔离的 preload 桥接承载 `/api` Fetch 操作与两条事件流。由桌面拥有的 renderer 引导会在共享 Client 图启动前注册该载体；共享 connection 包不包含 Electron 实现。应用不会启动浏览器 HTTP 服务器。

## 开发

构建仓库并打开桌面窗口：

```sh
pnpm desktop
```

构建未签名的 `.app` bundle 或可分发 ZIP：

```sh
pnpm desktop:package
pnpm desktop:make
```

Forge 将自包含产物写到 `apps/electron/out/` 下；打包后的应用不依赖源码 checkout。这些本地产物未签名、未公证；公开分发需要 Apple Developer 身份和公证工作流。

打包过程会暂存生产依赖，并在返回前恢复 workspace 的完整依赖安装，因此后续 `pnpm` 命令仍可使用开发工具。

应用图标以 `assets/app-icon.png` 保存，用于运行时 Dock 图标；同时以 `assets/app-icon.icns` 保存，用于打包后的 macOS 应用 bundle。

## 安全

renderer 设置为 `nodeIntegration: false`、`contextIsolation: true`，并启用 Chromium 沙箱。preload 只暴露启动图、缓冲式 JSON Fetch、取消操作和两条已声明事件流。主进程只接受活动窗口从 `dsh://app` 发出的 IPC，把 Fetch 限制在 `/api/*`，应用严格的 Content Security Policy，拒绝应用内跳转到外部来源，并用系统浏览器打开显式 HTTP(S) 链接。应用开始退出后，启动失败不再弹出错误对话框；profile shutdown 的拒绝也会在最终退出前被收束。

## 模型体验

桌面载体不增加任何模型可见输入。它与浏览器应用运行同一个 profile、会话日志、提示词片段、工具 schema 和客户端插件图。

#### KV Cache 影响

无；更换 GUI 物理载体不会改变提供方请求。

## 已知限制与暂缓事项

- 当前产物面向 macOS，尚无签名、公证、自动更新或安装器 UI。
- IPC Fetch 响应以文本整体缓冲，与现有 JSON API 表层一致；二进制或流式 API 需要显式扩展协议格式（wire format）。
- 打包后的桌面组装禁用 HMR；开发阶段目前在启动前重新构建。
