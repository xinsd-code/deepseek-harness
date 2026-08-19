# 树外插件

[English](README.md) | 中文

本目录包含自完备的 dsh Cordis 插件。插件通过框架的组合与客户端加载机制加入 profile，无需编辑 `packages/`、`apps/`、`vendor/` 或仓库根目录下的文件。

## 包要求

- Host 半侧声明 `dsh.bundle.patch`；`dsh plugin --profile <name> add <path>` 会安装这个包，并把它的 patch 层加入 `dsh.profile.bundles`。
- 浏览器或桌面客户端半侧声明 `dsh.client`，并把 `./client` 导出为客户端模块系统的 lazy-CJS bundle。Electron 会组合 Web profile，并通过自己的载体加载同一个客户端配置项。
- 运行时代码通过对等依赖（peer dependency）与公开导出使用 harness 包。各项贡献和注册归 Cordis effect 持有，因此卸载插件会移除它们。
- 使用 `dsh plugin --profile <name> remove <package>` 移除插件时，会移除它的 profile 层；已交付的组合文件不需要补偿性编辑。

## 可用插件

| 目录 | 用途 |
| --- | --- |
| [`usage-dashboard`](usage-dashboard/README.md) | 面向 Web 与 Electron 的跨会话 token 统计、缓存命中展示、UTC 时间范围和 DeepSeek 计费估算。 |

当前树外客户端构建会复用 `packages/client/tsdown.client.ts`，因为其中的 lazy-CJS 构建预设尚未发布。这个仓库相对导入只存在于构建配置中；产出的运行时代码不会导入仓库源文件。

## 验证

每个插件都持有包级测试、类型检查和构建命令。其 README 会说明安装、移除、配置和各表层的冒烟测试。
