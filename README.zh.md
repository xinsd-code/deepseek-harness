# DeepSeek Harness

[English](README.md) | 中文

DeepSeek Harness（`dsh`）是由 [DeepSeek AI](https://deepseek.com) 开发的开源 agent harness（智能体框架）。项目基于 [Cordis](https://github.com/cordiverse/cordis)，采用**一切皆插件**的架构：Host 能力、客户端页面、profile 组合和树外扩展都通过同一套具备生命周期管理能力的插件模型参与运行。

## 开发者预览

DeepSeek Harness 目前处于_开发者预览_阶段，正在快速迭代。**未来会出现破坏兼容性的变更。**

## 运行

安装 Node.js，然后启动已发布的 Web UI：

```sh
npx @deepseek-ai/dsh web
```

Web UI 默认地址为 `http://127.0.0.1:3080`。提供方与模型配置参见 [Web UI 指南](docs/user/guide/index.md)。

## 从源码运行

本仓库要求 Node.js `^22.19.0` 或 `>=24.0.0`，以及 pnpm `11.7.0`。

```sh
git clone https://github.com/deepseek-ai/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm run build
pnpm dsh web
```

发起真实 DeepSeek 请求前，请在环境变量或仓库 `.env` 文件中设置 `DEEPSEEK_API_KEY`。贡献流程参见[开发指南](docs/development.md)；修改 packages 前请先阅读[架构文档](docs/architecture.md)。

## 桌面客户端

桌面 workspace 将共享 GUI 打包为 macOS Electron 应用。安装依赖后，构建仓库并打开客户端：

```sh
pnpm desktop
```

生成本地应用 bundle 或 ZIP 分发包：

```sh
pnpm desktop:package
pnpm desktop:make
```

两个命令都会先重新构建仓库。`desktop:package` 生成 macOS `.app`；`desktop:make` 生成 `.app`，并通过 Electron Forge 额外生成 ZIP。当前 Mac 架构对应的产物统一写入 `apps/electron/out/`。应用是自包含产物，运行时不依赖源码 checkout。

打包脚本会执行临时代码签名（ad-hoc code signing），使本地 bundle 可以运行，但不会提供 Apple Developer ID 签名或公证。公开分发需要相应的 Apple 凭据与发布流程。当前桌面端没有 Windows 或 Linux 包、自动更新和安装器 UI。完整限制与安全行为参见[桌面 workspace 参考](apps/electron/README.md)。

## 桌面端实现逻辑

Electron 主进程通过 `runProfile()` 启动随发行版交付的 `web` profile，并叠加 `apps/electron/config/electron.patch.yml`。该 overlay 保留共享 Host 服务和客户端插件图，禁用浏览器 HTTP 服务器与 HMR，同时为模块和连接选择 Electron carrier 实现。

renderer 从 `dsh://app/` 加载共享 Web 前端。主进程通过这个私有协议发布已构建的前端资源和已安装插件的 `client.js` bundle。上下文隔离的 preload 只暴露启动图、缓冲式 `/api/*` Fetch、取消操作和已声明事件流；renderer 在共享客户端图启动前注册这座桥。应用禁用 `nodeIntegration`，启用上下文隔离和 Chromium 沙箱，拒绝跳转到外部来源，并用系统浏览器打开显式 HTTP(S) 链接。

浏览器和桌面客户端使用同一个 `web` profile 与客户端模块清单，因此安装到该 profile 的兼容客户端插件会同时出现在两个表层。桌面传输层只改变 UI 访问本地 Host 的方式，不会增加模型可见输入，也不会改变提供方请求。

## 树外插件

自包含插件位于 [`plugins/`](plugins/README.md)。它们通过 Cordis 扩展 dsh，无需修改 `packages/`、`apps/`、`vendor/` 或随发行版交付的 profile 文件。插件可以通过 `dsh.bundle.patch` 提供 Host patch 层，并通过 `dsh.client` 提供浏览器/桌面模块；各项注册由 Cordis effect 持有，因此移除插件也会移除其贡献。

先使用插件自身 README 记录的命令构建本地插件，再把它安装到 profile：

```sh
pnpm dsh plugin --profile <profile> add ./plugins/<plugin>
```

该命令会把包安装进指定 profile，并激活其声明的 `cordis.patch.yml` 层。插件状态以 profile 为作用域：安装进 `web` 不会影响其他 profile。`add`、`remove`、`update`、`why` 等参数会被转发给 profile 目录中的 pnpm。按包名移除插件：

```sh
pnpm dsh plugin --profile <profile> remove <package-name>
```

## Usage dashboard 插件

[`plugins/usage-dashboard`](plugins/usage-dashboard/README.md) 用于观测持久化会话中的 token 使用情况。先构建插件并安装到共享 Web profile：

```sh
pnpm --dir plugins/usage-dashboard bundle
pnpm dsh plugin --profile web add ./plugins/usage-dashboard
```

然后启动浏览器 UI：

```sh
pnpm dsh --profile web
```

或者改为启动桌面客户端：

```sh
pnpm desktop
```

插件会在设置页新增独立的 **Token 用量** 菜单，不会添加 agent 预设、模式或对话首页入口。响应式页面在浏览器和桌面客户端中都支持亮色与暗色主题。

总览展示总 token、未缓存输入、缓存读取、输出、推理、缓存命中率、单日峰值 token、参与统计的会话数和预估费用。缓存写入仍参与总量与计费计算，但不作为独立维度展示；推理属于输出的细分，不会重复计数。每日、每周和累计视图共用最近 12 个自然月的活动图，月份标签位于格子下方。

费用只估算具备已配置模型价格的 DeepSeek 提供方路由。页面以 `¥0.00` 格式显示人民币，并在金额旁说明仅统计 DeepSeek 相关模型；其他提供方与未知 DeepSeek 模型不会产生虚构费用。用量日期按 UTC 归属，历史数据通过持久化会话日志回放，提供方未返回的字段按零处理。精确聚合规则、默认价格、配置、测试与限制参见插件 README。

移除插件时无需修改任何仓库组合文件：

```sh
pnpm dsh plugin --profile web remove dsh-usage-dashboard
```

## 社区与支持

- 欢迎通过 [GitHub Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions) 提交反馈或 bug 报告。
- 为你的插件仓库添加 [`dsh-plugin`](https://github.com/topics/dsh-plugin) 话题，便于被发现。
- 欢迎加入 DeepSeek Harness 企微群：扫码添加企微小助手并填写入群问卷，完成后小助手会邀请你入群。

<table>
  <thead>
    <tr>
      <th align="center">企微小助手</th>
      <th align="center">入群问卷</th>
      <th align="center">微信公众号</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td align="center"><img src="assets/community-wecom-assistant.png" alt="DeepSeek Harness 企微小助手二维码" width="180" height="180"></td>
      <td align="center"><a href="https://trtgsjkv6r.feishu.cn/share/base/form/shrcnIt5twSVdLGD52KJBckGCgg"><img src="assets/community-wecom-survey.png" alt="DeepSeek Harness 入群问卷二维码" width="180" height="180"></a></td>
      <td align="center"><img src="assets/community-wechat-official-account.png" alt="DeepSeek Harness 团队微信公众号二维码" width="180" height="180"></td>
    </tr>
  </tbody>
</table>

## 参与贡献

参见 [CONTRIBUTING.md](CONTRIBUTING.md)。Agent 必须遵循 [AGENTS.md](AGENTS.md)。

## 许可证

[MIT](LICENSE)

第三方依赖及其许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
