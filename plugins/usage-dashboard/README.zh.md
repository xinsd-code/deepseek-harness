# usage-dashboard

[English](README.md) | 中文

`dsh-usage-dashboard` 是一个树外 Cordis 插件，用于汇总持久化 dsh 会话中的 token 用量。浏览器 UI 与 Electron 桌面应用共用同一份 Web 客户端 bundle；桌面应用的 profile 会复用 Web 客户端依赖图。

## 展示值

- 页面展示未缓存输入、缓存读取、输出和推理。缓存写入仍参与内部总量与计费计算，但不再作为独立页面维度展示。各项遵循 `TokenUsage`：输入、缓存读取、缓存写入互不重叠；推理属于输出的细分，不会再次计入总量。
- 缓存命中率为 `缓存读取 / (未缓存输入 + 缓存读取 + 缓存写入)`。页面不会把缓存写入显示为命中。
- 每日值使用各条用量事件的 UTC 日期。全部、最近 7 天和最近 30 天的选择会发送到 Host，因此总览指标、参与统计的会话数、计费行和截至当前月的最近 12 个自然月活动图都会使用所选数据。热力图不使用外围卡片并铺满内容宽度，格子下方只显示 12 个不重复月份。
- 只有具备已配置模型价格的 DeepSeek 提供方路由才会显示计费估算。页面合计费用和各计费行统一使用 `¥` 前缀并保留两位小数；问号提示会说明只统计 DeepSeek 相关模型。其他提供方与未知 DeepSeek 模型不会获得虚构费用。
- 页面不再展示按模型 Token 明细表。按提供方路由和模型进行的内部聚合仍会保留，因为计费需要这些数据。

## 默认 DeepSeek 价格

默认费率表采用 2026 年 8 月 19 日核对的 [DeepSeek API 官方价格](https://api-docs.deepseek.com/quick_start/pricing/)。价格单位为每百万 token 对应的人民币金额。

| 模型 | 缓存命中 | 缓存未命中 | 输出 |
| --- | ---: | ---: | ---: |
| `deepseek-v4-flash` | 0.02 | 1 | 2 |
| `deepseek-v4-pro` | 0.025 | 3 | 6 |

`deepseek-chat` 和 `deepseek-reasoner` 作为 `deepseek-v4-flash` 的历史别名保留。由于 dsh token 分桶互不重叠，插件按缓存未命中费率计算缓存写入。汇总过程不对费用取整，只在 UI 中格式化；提供方账单仍是权威结果。

## Cordis 集成

| 部分 | 实现 | 生命周期 |
| --- | --- | --- |
| 会话投影 | `src/usage-projection.ts` 按提供方、模型和 UTC 日期折叠 `request/header`、`assistant/chunk` 与 `assistant/message` 事件。同一轮次与步骤中相邻的流式样本和最终样本会相互替换。 | 通过 `ctx.effect()` 注册，并随插件 fiber 一起移除。 |
| Host 网关 | `src/gateway.ts` 读取实时投影或冷回放持久化会话，并公开支持时间范围的 Typert Remote 方法 `usageStats.summary`。 | Cordis 注入投影、缓存、持久化和实时会话服务。 |
| 客户端插件 | `src/client/index.ts` 挂载本包持有的 Typert 描述符、区域设置词典和一个 `settings.section` 页面。 | Remote 挂载、区域设置注册和 slot 贡献都是 fiber 持有的可逆 effect。 |
| 组合包 | `cordis.patch.yml` 插入唯一的 `usage-dashboard` 配置项。 | `dsh plugin add/remove` 在一个 profile 中添加或移除这个包层。 |

运行时包只导入已发布的 harness 包接口。在本仓库内构建浏览器半侧时，会复用 `packages/client/tsdown.client.ts`，因为 lazy-CJS 客户端预设尚未发布；这是构建期依赖，不会 patch 或改动该文件。

## 构建、安装与运行

启动 profile 前先构建插件：

```sh
pnpm --dir plugins/usage-dashboard bundle
```

把插件安装进 Web profile，然后启动任一表层：

```sh
pnpm dsh plugin --profile web add ./plugins/usage-dashboard
pnpm dsh --profile web
pnpm --filter @deepseek-ai/dsh-desktop start
```

设置面板会显示独立的 **Token 用量** 菜单。插件不会加入 agent 预设，也不会在对话首页增加入口。两个表层加载同一个 `dsh.client` 配置项；桌面应用使用 Electron 载体，浏览器使用 HTTP。

移除插件时无需编辑已交付的 Web 或桌面组合：

```sh
pnpm dsh plugin --profile web remove dsh-usage-dashboard
```

## 配置

`pricing` 是一份以模型 id 为键的 Cordis 插件配置字典。每行声明每百万 token 对应的 `input`、`cacheRead`、`cacheWrite`、`output` 价格及 `currency`。profile overlay 可以替换默认值：

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

## 验证

```sh
pnpm --dir plugins/usage-dashboard test
pnpm --dir plugins/usage-dashboard typecheck
pnpm --dir plugins/usage-dashboard bundle
```

测试覆盖流式样本替换、跨午夜 UTC 日期归属、提供方与模型分组、范围一致的总量与会话数、仅 DeepSeek 计费、未取整费用运算、两位小数人民币展示、年度活跃度指标、缓存命中率展示、空范围和失败的范围请求。

## 限制

- 仪表盘只能统计写入会话事件日志的用量。若提供方省略缓存或推理字段，对应分桶计为零。
- 历史会话会按需经过投影缓存折叠；损坏或不可读的会话日志会使汇总失败，不会被静默漏算。
- `lib/typert.host.js` 与 `lib/typert.remote-client.js` 中的 Typert 产物随树外包一起维护，因为仓库级生成器不会扫描该目录。
