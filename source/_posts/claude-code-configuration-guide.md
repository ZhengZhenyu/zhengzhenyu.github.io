---
title: Claude Code 配置初探
date: 2026-02-13 10:00:00
tags: [AI, Claude, VS Code, 开发工具, 配置管理]
---

Claude Code配置学习的第二篇文章，这次详细看看使用Claude过程中会用到的主要配置项，以及在VS Code中集成和使用Claude Code配置的方法。

## VS Code 中的 Claude 支持

VS Code 在最新的1.109 版本中，开始提供了对 Claude 配置的原生支持，这意味着你可以直接在 VS Code 中获得与 Claude Code 一致的体验，无需在两个工具之间切换。同时，根据[Claude官方博客](https://www.anthropic.com/news/github-copilot)来看，VS Code接入的Claude Code模型是由Anthropic公司提供，并且是通过GitHub Copilot订阅来使用的。Github Copilot的订阅对国内用户来说是最友好的，因此这种使用方式在获得SOTA能力的同时，相对来说是比较方便和稳定的。

### 配置文件互通

VS Code 现在可以直接读取 Claude 的配置文件，实现了真正的配置共享。这些配置文件包括：

| 配置类型 | 存储位置 | 说明 |
|---------|---------|------|
| **指令文件** | `CLAUDE.md` 或 `.claude/CLAUDE.md` | 项目特定的指令和规则 |
| **代理配置** | `.claude/agents/*.md` | 自定义代理定义 |
| **技能配置** | `.claude/skills/` | 技能和工作流定义 |
| **钩子配置** | `.claude/settings.json` | 生命周期钩子设置 |

这样一来，在Claude Code中设置的代理、技能、指令和钩子，可以无缝地在 VS Code 中使用，避免了重复配置的麻烦。

### Claude Agent 支持

VS Code 1.109 引入了 Claude Agent 集成（预览版），使用的是 Anthropic 官方的 Claude Agent SDK，确保了与其他实现的一致性。在Copilot使用时选择“Claude Agent”模式，就可以直接在 VS Code 中体验到 Claude Agent 的强大功能了。

![开启Claude模式](./claude-config/image.pngimage.png)

这个版本还为 Anthropic 模型增加了三项重要功能：
- 推理能力的消息 API 集成
- 改进的工具搜索功能
- 支持上下文编辑的会话管理

对于已经习惯 VS Code 的开发者来说，这是个好消息，不用再切换工具就能享受 Claude 的强大功能。

## Claude Code 核心配置

虽然 VS Code 提供了便利的集成，但理解 Claude Code 的配置系统仍然很重要。下面介绍几个关键的配置要点。

### 配置作用域与优先级

Claude Code 采用分层的配置系统，从高到低依次为：

```
Managed Settings (系统级，IT 部署)
    ↓
Local Settings (.claude/*.local.json)
    ↓
Project Settings (.claude/settings.json)
    ↓
User Settings (~/.claude/settings.json)
```

优先级越高的配置会覆盖低优先级的配置。这种设计让团队可以在保持统一规范的同时，也允许个人有一定的灵活性。

### 基础配置示例

**用户级配置** (`~/.claude/settings.json`)

这个文件包含你的个人偏好，适用于所有项目：

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "model": "claude-opus-4-1-20250805",
  "outputStyle": "Explanatory",
  "language": "chinese",
  "env": {
    "ANTHROPIC_API_KEY": "${API_KEY}",
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1"
  }
}
```

**项目级配置** (`.claude/settings.json`)

这个文件通过 Git 提交，让团队成员共享配置：

```json
{
  "permissions": {
    "allow": [
      "Bash(git *)",
      "Bash(npm test **)",
      "Read(~/.zshrc)"
    ],
    "deny": [
      "Read(./.env)",
      "Read(./.env.*)",
      "Edit(/production/**)"
    ]
  },
  "hooks": {
    "FileEdit": [
      {
        "matcher": "**/*.js",
        "hooks": [{"type": "command", "command": "npm run lint"}]
      }
    ]
  }
}
```

### 权限管理：最重要的配置

权限配置是 Claude Code 中最关键的安全机制。通过明确的 allow/deny/ask 规则，你可以精确控制 Claude 能做什么。

**权限规则语法**

基本格式：`Tool` 或 `Tool(specifier)`

实用示例：

```json
{
  "permissions": {
    "allow": [
      "Bash(npm run lint)",           // 允许运行 lint
      "Bash(npm test *)",             // 允许所有测试命令
      "Read(~/.zshrc)",               // 允许读取 shell 配置
      "WebFetch(domain:github.com)"   // 仅允许访问 GitHub
    ],
    "deny": [
      "Bash(curl *)",                 // 禁止 curl 命令
      "Read(./.env)",                 // 禁止读取环境变量文件
      "Read(./secrets/**)",           // 禁止读取 secrets 目录
      "Edit(/production/**)"          // 禁止修改生产代码
    ],
    "ask": [
      "Bash(git push *)"              // push 前需要确认
    ],
    "defaultMode": "acceptEdits"
  }
}
```

**常见的权限模式**

| 规则示例 | 匹配范围 | 用途 |
|---------|---------|------|
| `Bash` | 所有 Bash 命令 | 完全控制命令执行 |
| `Bash(npm *)` | npm 开头的命令 | 允许包管理操作 |
| `Read(*.env*)` | 所有环境变量文件 | 保护敏感配置 |
| `Edit(src/api/**)` | API 目录下所有文件 | 限制修改范围 |
| `WebFetch(domain:*.com)` | 特定域名 | 控制网络访问 |

### 工作流钩子配置

钩子（Hooks）让你可以在特定事件发生时自动执行命令，这对于保持代码质量非常有用。

**常用钩子类型**

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [
          {"type": "command", "command": "git status"}
        ]
      }
    ],
    "FileEdit": [
      {
        "matcher": "**/*.{js,ts}",
        "hooks": [
          {"type": "command", "command": "npm run lint $FILE"}
        ]
      }
    ],
    "BeforeCommit": [
      {
        "hooks": [
          {"type": "command", "command": "npm test"}
        ]
      }
    ]
  }
}
```

这些钩子可以确保：
- 每次会话开始时检查 Git 状态
- 编辑 JS/TS 文件后自动运行 lint
- 提交前自动运行测试

### 沙箱安全配置

对于需要更严格安全控制的环境，可以启用沙箱模式：

```json
{
  "sandbox": {
    "enabled": true,
    "excludedCommands": ["docker", "git"],
    "network": {
      "allowedDomains": ["github.com", "*.npmjs.org"],
      "allowUnixSockets": ["~/.ssh/agent-socket"]
    }
  }
}
```

沙箱模式会限制 Claude 的命令执行和网络访问，适合在敏感项目中使用。

## 实用配置技巧

### 1. 环境变量管理

对于不同的开发环境，可以通过环境变量灵活切换配置：

```json
{
  "env": {
    "ANTHROPIC_MODEL": "claude-opus-4-1-20250805",
    "CLAUDE_CODE_MAX_OUTPUT_TOKENS": "32000",
    "NODE_ENV": "development"
  }
}
```

### 2. 个人项目配置的隔离

使用 `.local.json` 文件存放个人特定的配置，这些文件会被自动加入 `.gitignore`：

```json
// .claude/settings.local.json
{
  "env": {
    "TEST_API_URL": "http://localhost:3000",
    "DEBUG_MODE": "true"
  }
}
```

### 3. 属性标签配置

为 Claude 生成的提交和 PR 添加标识：

```json
{
  "attribution": {
    "commit": "🤖 Generated with Claude Code\n\nCo-Authored-By: Claude <noreply@anthropic.com>",
    "pr": "🤖 Generated with Claude Code"
  }
}
```

## 快速检查清单

在配置 Claude Code 时，确保这些关键项都已设置：

- ✅ API 密钥配置（`ANTHROPIC_API_KEY` 环境变量）
- ✅ 模型选择（`model` 字段）
- ✅ 权限规则（明确 `allow`/`deny`/`ask` 列表）
- ✅ 敏感文件保护（`.env`、`secrets/**` 等）
- ✅ 工作流钩子（根据项目需求）
- ✅ 输出语言和风格设置

## 实用命令

在使用 Claude Code 时，这些命令很有帮助：

```bash
/config              # 打开配置界面
/allowed-tools       # 查看当前允许的工具
/memory              # 管理项目记忆
/plugin              # 管理插件
/add-mcp-server      # 添加 MCP 服务器
```

## 总结

Claude Code 的配置系统虽然功能强大，但掌握了核心概念后并不复杂。关键是理解配置的优先级层次，合理使用权限控制，并根据项目需求设置适当的钩子。

随着 VS Code 1.109 开始原生支持 Claude 配置，两个工具之间的配置可以完全共享，这大大降低了使用门槛。如果你已经在使用 VS Code，现在就可以直接利用现有的 Claude 配置，获得一致的开发体验。

建议从简单的配置开始，逐步完善：
1. 先设置好 API 密钥和基本权限
2. 根据项目需求添加钩子
3. 在实际使用中调整和优化配置
4. 结合 CLAUDE.md 文件管理项目特定的指令（参考我之前的[记忆管理文章](./claude-memory-insight.md)）

记住，好的配置不是一次性完成的，而是随着项目发展不断迭代优化的过程。

---

*参考资料：*
- *[Claude Code 官方文档 - 设置](https://code.claude.com/docs/en/settings)*
- *[VS Code 1.109 更新说明](https://code.visualstudio.com/updates/v1_109)*
