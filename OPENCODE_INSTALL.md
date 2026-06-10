# OpenCode 安装指南

## 一键安装（推荐）

```bash
cd /path/to/mcp
npm install
node scripts/install.cjs
```

脚本自动检测 OpenCode 并完成 MCP 配置和技能安装。

**Windows**：同样使用 `node scripts/install.cjs`，路径自动适配。

## 手动安装

编辑全局配置 `~/.config/opencode/opencode.json`（Linux）或 `%APPDATA%\opencode\opencode.json`（Windows）：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "xinyang-kb": {
      "type": "local",
      "command": ["npx", "tsx", "/absolute/path/to/src/index.ts"],
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

安装技能：

```bash
mkdir -p ~/.config/opencode/skills
cp skills/xinyang-assistant/SKILL.md ~/.config/opencode/skills/xinyang-assistant.md
```

## 验证

```bash
opencode mcp list
```

## 更新 API 地址

```bash
node scripts/install.cjs --api-url http://新IP:5010/search/dify
```
