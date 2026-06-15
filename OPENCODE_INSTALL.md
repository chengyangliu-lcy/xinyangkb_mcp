# OpenCode 安装指南

当前 OpenCode 安装方式保持兼容，配置仍写入 `~/.config/opencode/opencode.json`，并使用 `environment` 字段传递 MCP 环境变量。

## 安装

```bash
node scripts/install.cjs \
  --api-url http://YOUR_HOST:5010/search/dify \
  --no-codex
```

如果 API 地址不是标准的 `/search/dify` 路径：

```bash
node scripts/install.cjs \
  --api-url http://YOUR_HOST:5010/custom/search \
  --api-base http://YOUR_HOST:5010 \
  --no-codex
```

安装器会：

1. 将 `xinyang-kb` 合并到现有 `mcp` 配置。
2. 自动解析当前安装目录中的 `plugins/xinyang-kb/dist/index.js` 启动服务。
3. 安装 `xinyang-assistant` 指令文件。
4. 对 `instructions` 引用去重。
5. 修改现有配置前创建备份。

原配置 JSON 无法解析时，安装器会停止，不会覆盖原文件。

## 生成的 MCP 配置

```json
{
  "mcp": {
    "xinyang-kb": {
      "type": "local",
      "command": [
        "node",
        "<自动生成的 bundle 路径>"
      ],
      "enabled": true,
      "environment": {
        "SEARCH_API_URL": "http://YOUR_HOST:5010/search/dify",
        "API_SERVER_BASE_URL": "http://YOUR_HOST:5010"
      }
    }
  },
  "instructions": [
    "skills/xinyang-assistant.md"
  ]
}
```

## 验证

重启 OpenCode 后运行：

```bash
opencode mcp list
```

## 卸载

编辑 `~/.config/opencode/opencode.json`：

1. 删除 `mcp` 中的 `xinyang-kb`。
2. 删除 `instructions` 中的 `skills/xinyang-assistant.md`。

然后删除以下文件：

```text
~/.config/opencode/skills/xinyang-assistant.md
~/.config/xinyang-kb/config.json
```

如果 Codex 仍在使用 Xinyang KB，请保留共享的
`~/.config/xinyang-kb/config.json`。

完成后重启 OpenCode 并新建会话。
