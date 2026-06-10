# Xinyang KB MCP Server

芯阳公司内部知识库 MCP 服务器。封装内部搜索 API，供 **Codex** 和 **OpenCode** 调用。

## 环境要求

- Node.js >= 18
- npm
- Codex 和/或 OpenCode 已安装

## 安装

### 一键安装（跨平台，推荐）

```bash
cd /home/music/lcy/mcp
npm install
node scripts/install.cjs
```

脚本自动检测 Codex 和 OpenCode，同时为两者配置 MCP 服务器和技能。

**Windows 用户：** 同样使用 `node scripts/install.cjs` 即可（路径会自动适配）。

### 手动安装

<details>
<summary><b>Codex CLI</b></summary>

```bash
codex mcp add xinyang-kb \
  --env SEARCH_API_URL=http://10.24.116.22:5010/search/dify \
  --env API_SERVER_BASE_URL=http://10.24.116.22:5010 \
  --env no_proxy=10.24.116.22,59.77.39.46,localhost,127.0.0.1,::1 \
  -- npx tsx /home/music/lcy/mcp/src/index.ts

mkdir -p ~/.codex/skills/xinyang-assistant
cp skills/xinyang-assistant/SKILL.md ~/.codex/skills/xinyang-assistant/SKILL.md
```
</details>

<details>
<summary><b>OpenCode</b></summary>

编辑 `~/.config/opencode/opencode.json`（Linux）或 `%APPDATA%/opencode/opencode.json`（Windows）：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "xinyang-kb": {
      "type": "local",
      "command": ["npx", "tsx", "/path/to/mcp/src/index.ts"],
      "enabled": true,
      "env": {
        "SEARCH_API_URL": "http://10.24.116.22:5010/search/dify",
        "API_SERVER_BASE_URL": "http://10.24.116.22:5010",
        "no_proxy": "10.24.116.22,59.77.39.46,localhost,127.0.0.1,::1"
      }
    }
  },
  "instructions": ["skills/xinyang-assistant.md"]
}
```

```bash
mkdir -p ~/.config/opencode/skills
cp skills/xinyang-assistant/SKILL.md ~/.config/opencode/skills/xinyang-assistant.md
```
</details>

## 配置

环境变量在安装时已写入配置：

| 变量 | 说明 |
|---|---|
| `SEARCH_API_URL` | 内部搜索 API 地址 |
| `API_SERVER_BASE_URL` | API 基础地址（拼接文档 URL） |
| `no_proxy` | 不走代理的内部地址列表 |

如需修改 API 地址，运行：

```bash
node scripts/install.cjs --api-url http://新IP:5010/search/dify
```

## 使用

直接提问芯阳相关问题，AI 助手会自动调用知识库搜索并按规范格式化回答。

```
你：TM52F1376 的规格参数是什么？
→ 调用 knowledge_base_search → 结构化回答 + 来源链接

你：离职流程是什么？
→ 搜索知识库 → 步骤化流程

你：我们的产品和竞品比怎么样？
→ 同时搜索知识库 + 联网 → 分开标注来源
```

## 验证

```bash
codex mcp list      # Codex
opencode mcp list   # OpenCode
```

## 目录结构

```
src/index.ts                  MCP 服务器
skills/xinyang-assistant/     芯阳大模型行为规范
scripts/install.cjs           跨平台一键安装脚本
```

## API 地址变更

```bash
node scripts/install.cjs --api-url http://新IP:5010/search/dify
```
# xinyangkb_mcp
