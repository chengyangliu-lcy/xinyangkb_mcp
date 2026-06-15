# Xinyang KB MCP

芯阳内部知识库 MCP 服务，同时支持 Codex 和 OpenCode。

## 环境要求

- Node.js 18+
- Codex CLI 和/或 OpenCode
- 可访问芯阳内部搜索 API

仓库已提交独立运行产物 `plugins/xinyang-kb/dist/index.js`。使用者安装时不需要执行 `npm install`。

## 一键安装

API 地址必须显式提供：

```bash
node scripts/install.cjs \
  --api-url http://YOUR_HOST:5010/search/dify
```

当搜索地址不是以 `/search/dify` 结尾时，还必须提供基础地址：

```bash
node scripts/install.cjs \
  --api-url http://YOUR_HOST:5010/custom/search \
  --api-base http://YOUR_HOST:5010
```

安装器会自动检测 Codex 和 OpenCode，并保留未涉及的现有配置。修改已有 JSON 配置前会生成带时间戳的备份。

可选参数：

| 参数 | 说明 |
|---|---|
| `--codex-mode direct` | 直接注册 Codex MCP，默认模式 |
| `--codex-mode plugin` | 通过本仓库 Marketplace 安装 Codex 插件 |
| `--codex-mode both` | 同时安装两种 Codex 接入方式 |
| `--no-codex` | 跳过 Codex |
| `--no-opencode` | 跳过 OpenCode |
| `--no-proxy <列表>` | 显式写入 MCP 的 `no_proxy` 环境变量 |

### Windows

```powershell
.\scripts\install.ps1 --api-url http://YOUR_HOST:5010/search/dify
```

### Linux / macOS

```bash
./scripts/install.sh --api-url http://YOUR_HOST:5010/search/dify
```

## Codex

### 直接注册

默认安装方式。安装器执行 `codex mcp add`，并将 Skill 安装到 `~/.codex/skills/xinyang-assistant`。

```bash
node scripts/install.cjs \
  --api-url http://YOUR_HOST:5010/search/dify \
  --codex-mode direct \
  --no-opencode
```

### 插件安装

仓库采用标准 Marketplace 布局：

```text
.agents/plugins/marketplace.json
plugins/xinyang-kb/
```

安装命令：

```bash
node scripts/install.cjs \
  --api-url http://YOUR_HOST:5010/search/dify \
  --codex-mode plugin \
  --no-opencode
```

插件同时携带 MCP 和 `xinyang-assistant` Skill。安装完成后请重启 Codex 并新建会话。

## OpenCode

OpenCode 继续使用已验证的配置格式：

- 配置文件：`~/.config/opencode/opencode.json`
- MCP 类型：`local`
- 环境字段：`environment`
- Skill：`~/.config/opencode/skills/xinyang-assistant.md`
- 指令引用：`skills/xinyang-assistant.md`

仅安装 OpenCode：

```bash
node scripts/install.cjs \
  --api-url http://YOUR_HOST:5010/search/dify \
  --no-codex
```

安装器会合并已有 JSON，不覆盖其他 MCP、instructions 或用户设置。若原配置不是有效 JSON，安装会停止且不会覆盖文件。

## 配置

运行时配置优先级：

1. `SEARCH_API_URL`、`API_SERVER_BASE_URL` 环境变量
2. `~/.config/xinyang-kb/config.json`

插件模式使用用户配置文件；直接注册模式同时注入环境变量。

## 卸载

### Codex

如果使用 direct 模式安装：

```bash
codex mcp remove xinyang-kb
```

然后删除 Skill：

```text
~/.codex/skills/xinyang-assistant/
```

如果使用 plugin 模式安装：

```bash
codex plugin remove xinyang-kb@xinyang-internal
```

如不再使用本仓库 Marketplace，可继续执行：

```bash
codex plugin marketplace remove xinyang-internal
```

`both` 模式需要同时执行 direct 和 plugin 两组卸载操作。

### OpenCode

编辑 `~/.config/opencode/opencode.json`：

1. 删除 `mcp` 中的 `xinyang-kb`。
2. 删除 `instructions` 中的 `skills/xinyang-assistant.md`。

然后删除：

```text
~/.config/opencode/skills/xinyang-assistant.md
```

### 共享运行配置

确认 Codex 和 OpenCode 都不再使用本 MCP 后，可删除：

```text
~/.config/xinyang-kb/config.json
```

卸载后重启 Codex 或 OpenCode，并新建会话。

## 开发与验证

```bash
npm ci
npm run typecheck
npm run build
```

常用检查：

```bash
codex mcp list
codex plugin marketplace list
codex plugin list
opencode mcp list
```

## 工具

`knowledge_base_search` 用于搜索芯阳内部产品参数、技术方案、制度、流程、项目和内部文档。返回结果中的内部文档路径会转换为可引用 URL。
