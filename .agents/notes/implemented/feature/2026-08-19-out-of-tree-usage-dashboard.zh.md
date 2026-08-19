# Agent Note: 树外用量仪表盘的统计与客户端组合

Status: implemented

[English](2026-08-19-out-of-tree-usage-dashboard.md) | 中文

## Problem

树外 `dsh-usage-dashboard` 包已经具备预期的 Host 投影、Typert 网关和浏览器仪表盘，但第一版还不能作为可靠的统计表层。它把缓存写入计为命中；所选日期范围只作用于热力图，而总量和计费仍覆盖全部时间；它只按模型 id 汇总，把整个会话归到创建日期，在求和前对每条计费行取整，并为模型名称匹配 DeepSeek 费率行的所有路由计费。包内默认价格也是占位值。包的运行时导出指向 TypeScript 源码，导致 Electron 无法导入 Host 配置项；其客户端依赖图还把普通的 `ui-slots` 包列成插件依赖。

该功能还必须保持为树外 Cordis 插件。浏览器和 Electron 支持不能通过新增树内配置项或应用专用代码实现，并且每项注册都必须随插件 fiber 的 dispose（资源释放）而消失。这遵循 [profile 插件组合包](../architecture/2026-08-05-profile-plugin-bundles.md)和[客户端插件加载](../architecture/2026-07-23-client-plugin-loading-model.md)决策。

## Decision

会话事件日志仍是唯一的用量输入。插件持有的投影会组合 `request/header` 与包含用量的 `assistant/chunk`、`assistant/message` 事件。它保留 harness 的 `TokenUsage` 语义：未缓存输入、缓存读取和缓存写入互不重叠；推理属于输出的细分。同一轮次与步骤中相邻的流式样本和最终样本会相互替换，最终样本在后一个 UTC 日期到达时也不例外。每个保留样本按提供方路由、模型 id 和事件的 UTC 日期分组。

日期选择是 Host 查询参数。网关验证包含首尾的 `YYYY-MM-DD` 范围，读取实时投影或冷回放持久化会话，并只把选中日期交给同一个纯汇总器。因此总量、参与统计的会话数、提供方与模型行、计费行和热力图日期都来自同一个集合。冷回放失败会继续抛出，而不是返回部分结果。

计费会识别提供方，并可通过插件的 Cordis `pricing` 配置调整。只有 id 中含 `deepseek` 的提供方路由及费率表中存在的模型才会产生计费行。默认值采用 2026 年 8 月 19 日生效的 `deepseek-v4-flash` 和 `deepseek-v4-pro` 官方每百万 token 人民币费率，并把已弃用的 `deepseek-chat` 和 `deepseek-reasoner` id 保留为 Flash 的历史别名。缓存写入使用缓存未命中的输入费率，计算结果在展示前不取整，每条计费行保留自己的币种。

两个表层共用一个 `dsh.client` Web 配置项。外层客户端 fiber 等待本包持有的 Typert Remote 挂载完成；显式注入 `remote.usageStats`、区域设置和设置页 slots 的子 fiber 随后注册词典与独立设置页区域。Electron 组合相同的 Web 客户端依赖图，并提供自己的 Remote 载体。manifest 依赖边只列客户端插件；`ui-slots` 仍是静态提供的普通包。运行时导出指向已构建的 JavaScript，TypeScript 则读取源码声明。

插件保留在 `plugins/usage-dashboard` 中，并贡献一个组合包 patch 配置项。它不改动任何应用或 harness 包源码。构建配置会导入仓库中尚未发布的 `clientBundle` 预设；产出的 Host 与客户端运行时只依赖公开包导出和 profile 提供的对等依赖。

## Alternatives considered

- **直接检测提供方适配器：**否决，因为这会修改现有包、重复模型可见的事件日志，还需要逐个提供方集成。
- **获取全部时间的数据后只在 React 中筛选：**否决，因为这会让不同分区和会话数覆盖不同区间，并向客户端传输不必要的历史记录。
- **只按模型 id 计费：**否决，因为其他提供方可能复用 DeepSeek 模型 id，或代理独立定价的部署。
- **把缓存写入视为命中：**否决，因为 harness 声明输入、缓存读取和缓存写入分桶互不重叠；只有读取是从缓存提供的。
- **新增桌面专用客户端配置项：**否决，因为 Electron 会按设计组合 Web 客户端依赖图；第二个配置项会重复 UI 与生命周期行为。
- **忽略冷投影失败：**否决，因为对于观测表层，看似合理的部分总量比可见的汇总错误更危险。

## Consequences

仪表盘的总览、计费、热力图、范围元数据和会话数在所选 UTC 区间内保持一致。非 DeepSeek 用量仍可观测，但不会被虚构价格；DeepSeek 估算则可随部署专用费率表调整。历史日志会按需折叠，不需要单独的指标数据库。

安装与移除都是 profile 操作；Host 投影注册、Typert Remote 挂载、区域设置和设置页贡献都遵循 Cordis fiber 的资源释放。浏览器和桌面代码路径共用同一份插件产物。当前仓库仍有一项已由[插件持有设置决策](../architecture/2026-08-12-plugin-owned-settings-surface.md)指出的开发摩擦：客户端 bundle 预设尚未发布，因此重新构建这个树外浏览器半侧需要源码 checkout。

仪表盘无法恢复提供方未写入会话日志的 token 字段，其费用也是估算而不是账单。在生成器接受树外根目录之前，Typert 描述符仍是包内手工维护的产物；更改网关方法或协议类型时必须同步更新两份描述符。
