---
title: Claude Code 记忆管理系统初探
date: 2026-02-12 10:00:00
tags: [AI, Claude, 开发工具, 编程助手]
---

最近Claude Code非常之火，本人也尝试使用了一下，确实感受到其功能之强大，之前有想法但没有时间和精力去实现的各种Idea也都能快速实现原型。不过很快主管就提醒到，借助AI打造的软件项目能否上线还是需要严格的审核，并且整个设计和开发过程也需要严肃和严谨。尤其是在多人协作的项目中，如何制定整个项目的要求和规范，并让AI助手持续理解项目规范、团队约定和个人偏好，是非常重要的。

这时候才反思到，确实没有详细的读Claude Code产品文档，就因为用的顺手，就开始深度使用了。这一方面说明Claude Code确实非常容易上手，一方面也确实忽略了比较重要的各种深度用法。本文就从最关键的记忆管理系统为起点，探究一下Claude Code中几个重要的配置。以便提高项目质量和协作效率。

## 记忆系统概述

Claude Code 的记忆系统主要分为两种类型：

1. **CLAUDE.md 文件**：由开发者编写和维护的 Markdown 文件，包含指令、规则和偏好设置
2. **自动记忆（Auto Memory）**：Claude 自动记录项目模式、常用命令和用户偏好等有用信息

CLAUDE.md 文件在每次会话开始时都会被加载，这样 Claude 就能记住项目的特定要求。自动记忆是最近才加入的功能，可以让 Claude 自己学习和记录项目知识。

## 记忆类型层级结构

通过阅读文档，我发现 Claude Code 的记忆管理结构设计得相当精细，可以分为多个层级，根据官方的描述有如下定义和使用建议：

| 记忆类型 | 存储位置 | 用途（建议） | 适用范围（建议） |
| -------- | ------- | ---- | ------- |
| **全局记忆** | macOS: `/Library/Application Support/ClaudeCode/CLAUDE.md`<br/>Linux: `/etc/claude-code/CLAUDE.md`<br/>Windows: `C:\Program Files\ClaudeCode\CLAUDE.md` | IT/DevOps 管理的组织级规范 | 公司编码标准、安全策略、合规要求 | 组织内所有用户 |
| **项目记忆** | `./CLAUDE.md` 或 `./.claude/CLAUDE.md` | 团队共享的项目指令 | 项目架构、编码标准、常见工作流 | 通过版本控制共享给团队成员 |
| **项目规则** | `./.claude/rules/*.md` | 模块化的、特定主题的项目指令 | 特定语言规范、测试约定、API 标准 | 通过版本控制共享给团队成员 |
| **用户记忆** | `~/.claude/CLAUDE.md` | 适用于所有项目的个人偏好 | 代码风格偏好、个人工具快捷方式 | 仅个人（所有项目） |
| **项目本地记忆** | `./CLAUDE.local.md` | 个人的项目特定偏好 | 个人沙箱 URL、测试数据偏好 | 仅个人（当前项目） |
| **自动记忆** | `~/.claude/projects/<project>/memory/` | Claude 自动记录的笔记和学习内容 | 项目模式、调试洞察、架构笔记 | 仅个人（每个项目） |

从优先级来看，越具体的配置优先级越高，这样可以层层覆盖。值得注意的是 `CLAUDE.local.md` 会自动加入 `.gitignore`，很适合存放一些个人的测试配置或临时设置，不会影响到团队其他成员。


## CLAUDE.md 文件详解

### 设置项目记忆

用 `/init` 命令可以快速生成一个 CLAUDE.md 文件骨架：

```
> /init
```

建议在 CLAUDE.md 中记录：
- 常用命令（构建、测试、lint），避免每次都要翻找或搜索
- 项目的代码风格和命名规范
- 重要的架构设计和模式

### CLAUDE.md 导入功能

CLAUDE.md 支持用 `@path/to/import` 语法引入其他文件，这个功能挺实用：

```markdown
查看 @README 了解项目概述，查看 @package.json 获取此项目可用的 npm 命令。

# 附加指令
- git 工作流 @docs/git-instructions.md
```

支持相对路径和绝对路径。相对路径相对于包含导入的文件解析，而不是工作目录。

对于跨多个 git worktrees 工作的场景，可以使用用户目录导入：

```markdown
# 个人偏好
- @~/.claude/my-project-instructions.md
```

需要注意几点：
- 第一次用外部导入时，Claude Code 会弹窗让你确认
- 导入可以嵌套，但最多 5 层，防止循环引用
- 代码块里的 `@` 符号不会被当作导入处理

## 模块化规则：`.claude/rules/`

对于比较大的项目，把所有规则都塞在一个 CLAUDE.md 里会很乱。这时候可以用 `.claude/rules/` 目录来分模块管理。

### 基本结构

在项目里建个 `.claude/rules/` 目录，然后按主题放不同的 Markdown 文件：

```
your-project/
├── .claude/
│   ├── CLAUDE.md           # 主项目指令
│   └── rules/
│       ├── code-style.md   # 代码风格指南
│       ├── testing.md      # 测试约定
│       └── security.md     # 安全要求
```

这个目录下的所有 `.md` 文件都会被自动加载，和 `.claude/CLAUDE.md` 优先级一样。

### 路径特定规则

有个很有意思的功能是可以让某些规则只对特定路径生效。用 YAML frontmatter 的 `paths` 字段来指定：

```markdown
---
paths:
  - "src/api/**/*.ts"
---

# API 开发规则

- 所有 API 端点必须包含输入验证
- 使用标准错误响应格式
- 包含 OpenAPI 文档注释
```

### Glob 模式支持

`paths` 字段支持常见的 glob 模式，比如：

| 模式 | 匹配范围 |
| ---- | ------- |
| `**/*.ts` | 任意目录中的所有 TypeScript 文件 |
| `src/**/*` | src/ 目录下的所有文件 |
| `*.md` | 项目根目录中的 Markdown 文件 |
| `src/components/*.tsx` | 特定目录中的 React 组件 |

还可以用括号扩展来匹配多个扩展名：

```markdown
---
paths:
  - "src/**/*.{ts,tsx}"
  - "{src,lib}/**/*.ts"
---

# TypeScript/React 规则
```

### 用户级规则

除了项目级的规则，还可以在个人目录 `~/.claude/rules/` 下创建全局生效的个人规则：

```
~/.claude/rules/
├── preferences.md    # 个人编码偏好
└── workflows.md      # 首选工作流
```

用户级规则会先加载，然后才是项目规则，所以项目规则的优先级更高。

## 记忆查找机制

Claude Code 查找记忆文件的方式比较智能：从当前工作目录开始，一直往上找到根目录（不包括根目录本身），把路径上所有的 CLAUDE.md 和 CLAUDE.local.md 都读进来。如果在 `foo/bar/` 运行，就会同时加载 `foo/CLAUDE.md` 和 `foo/bar/CLAUDE.md`，这个对大仓库来说很方便。

子目录里嵌套的 CLAUDE.md 不会立即加载，而是等 Claude 读取那个子目录的文件时才加载进来。

### 从额外目录加载记忆

使用 `--add-dir` 标志时，可以通过设置环境变量加载这些目录的记忆文件：

```bash
CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1 claude --add-dir ../shared-config
```

## 组织级记忆管理

如果是在公司或团队中使用，可以在系统级别部署一个统一的 CLAUDE.md 文件，让所有开发者都遵循相同的规范。

具体做法：
1. 在前面表格里提到的管理策略位置创建文件
2. 通过公司的配置管理工具（MDM、Group Policy、Ansible 等）统一分发

## 记忆管理的一些Tips

1. **写清楚具体的规则**：比如"用 2 空格缩进"就比"代码要格式化好"清楚多了
2. **用好 Markdown 结构**：把相关的记忆用列表整理好，加上清晰的标题分组
3. **定期回顾更新**：项目在变化，记忆也要跟着更新，不然 Claude 可能会用过时的信息

## 最佳实践案例：PyTorch 项目

在研究如何写好 CLAUDE.md 时，我发现 [PyTorch 项目](https://github.com/pytorch/pytorch/blob/main/CLAUDE.md)做为比较早拥抱Claude Code的开源项目，他们的配置是个很好的参考。他们的记忆管理配置既全面又实用，值得借鉴。

### 明确的环境和工具指令

PyTorch 的 CLAUDE.md 开头就明确告诉 Claude 如何处理环境问题：

```markdown
# Environment

If any tool you're trying to use (pip, python, spin, etc) is
missing, always stop and ask the user if an environment is needed. 
Do NOT try to find alternatives or install these tools.
```

这种明确的指令避免了 Claude 自作主张去做一些不合适的操作。对于构建、测试、Linting 等常见操作，也都有清晰的说明：

```markdown
# Build

Always ask for build configuration environment variables before running build.
All build is done via `pip install -e . -v --no-build-isolation`.
You should NEVER run any other command to build PyTorch.

# Testing

Use our test class and test runner:
...

# Linting

Only use commands provided via `spin` for linting.
```

### 具体的编码规范

PyTorch 的编码风格指南写得非常具体，而且给出了清晰的理由：

```markdown
# Coding Style Guidelines

- Minimize comments; be concise; code should be self-explanatory 
  and self-documenting.
- Don't make trivial (1-2 LOC) helper functions that are only 
  used once unless it significantly improves code readability.
- Prefer clear abstractions. State management should be explicit.
- Match existing code style and architectural patterns.
- Assume the reader has familiarity with PyTorch.
```

这些规则不是简单的"代码要规范"，而是告诉你具体要做什么、不要做什么。

### Good vs Bad 代码示例

对于一些容易出错的场景，PyTorch 直接给出了对比示例。比如配置临时修改：

````markdown
# Dynamo Config

Use `torch._dynamo.config.patch` for temporarily changing config:

```python
# Good - use patch as decorator
@torch._dynamo.config.patch(force_compile_during_fx_trace=True)
def test_my_feature(self):
    pass

# Bad - manual save/restore
orig = torch._dynamo.config.force_compile_during_fx_trace
try:
    torch._dynamo.config.force_compile_during_fx_trace = True
finally:
    torch._dynamo.config.force_compile_during_fx_trace = orig
```
````

这种对比让 Claude 能很清楚地知道什么是推荐的做法。

### 项目特定的技术约定

对于一些项目特有的技术细节，PyTorch 也做了详细说明。比如如何修复特定的 linting 错误：

```markdown
# Fixing B950 line too long in multi-line string blocks

If B950 line too long triggers on a multi-line string block, 
put # noqa: B950 on the same line as the terminating triple quote.

Example:
    self.assertExpectedInline(
        foo(),
        """
this line is too long...
""",  # noqa: B950
    )
```

### 行为指导

PyTorch 还对 Claude 的行为做了明确要求，比如关于 git commit：

```markdown
# Commit messages

Don't commit unless the user explicitly asks you to.

When writing a commit message, don't make a bullet list of the 
individual changes. Instead, if the PR is large, explain the 
order to review changes.

Disclose that the PR was authored with Claude.
```

### 使用 Skills 目录管理复杂知识

除了主 CLAUDE.md 文件，PyTorch 还大量使用了 `.claude/skills/` 目录来组织更复杂的领域知识。比如：

- `pr-review/` - PR 审查技能，包含详细的审查清单
- `docstring/` - 文档字符串编写规范
- `triaging-issues/` - Issue 分类处理流程
- `at-dispatch-v2/` - 特定 API 的迁移指南

每个 skill 都是一个独立的目录，包含 `SKILL.md` 主文件和相关的辅助文件（如 checklist、templates、scripts 等）。这种模块化的组织方式让复杂的项目知识更容易维护和查找。

### 值得借鉴的几点

总结一下 PyTorch 的做法，有几点特别值得学习：

1. **指令要明确**：告诉 Claude 具体该做什么、不该做什么，而不是模糊的建议
2. **给出示例**：用代码示例说明，尤其是 Good vs Bad 的对比
3. **分主题组织**：用清晰的标题把不同类型的规则分开
4. **针对性强**：记录项目特有的约定和技术细节
5. **模块化管理**：对于复杂的领域知识，使用 skills 目录分模块组织
6. **持续迭代**：根据实际使用情况不断完善和更新

如果你的项目也有类似的复杂度，不妨参考 PyTorch 的结构来组织自己的 CLAUDE.md。即使是小项目，从中借鉴"明确指令"和"示例驱动"的思路也会很有帮助。

## 实用命令

- **`/memory`**：在会话期间打开任何记忆文件进行编辑
- **`/init`**：为代码库引导创建 CLAUDE.md
- **保存特定内容**：直接告诉 Claude，如"记住我们使用 pnpm"或"保存到记忆：API 测试需要本地 Redis 实例"

## 自动记忆（Auto Memory）

自动记忆是 Claude Code 最近才加入的功能，目前还在逐步推广。我体验下来觉得这个功能挺有意思，让 Claude 可以主动学习和记录项目相关的知识。

### 功能特点

简单来说，自动记忆是一个持久化目录，Claude 工作时会自动往里面写笔记。和我们手写的 CLAUDE.md 不同，这些是 Claude 自己总结的内容。有几个特点：

- **不用手动维护**：Claude 自己判断什么重要，然后记下来
- **持续积累**：随着项目推进，记忆内容会越来越丰富
- **项目隔离**：每个项目有独立的记忆空间

### Claude 会自动记住什么

根据文档和我的观察，Claude 可能会记录这些：

- **项目模式**：常用的构建命令、测试习惯、代码风格
- **调试经验**：遇到过的问题和解决方案
- **架构信息**：重要文件、模块关系、核心抽象
- **个人习惯**：你的沟通偏好、工作流程等

### 存储位置和结构

每个项目有自己独立的记忆目录 `~/.claude/projects/<project>/memory/`。这里的 `<project>` 是基于 Git 仓库根目录生成的，所以同一个仓库的不同子目录会共享记忆。如果用 Git worktrees，每个 worktree 会有单独的记忆。

目录大概长这样：

```
~/.claude/projects/<project>/memory/
├── MEMORY.md          # 索引文件，每次会话都会加载
├── debugging.md       # 调试相关笔记
├── api-conventions.md # API 设计经验
└── ...                # 其他 Claude 创建的主题文件
```

`MEMORY.md` 是主索引，每次启动时会读入前 200 行。超过 200 行的内容不会自动加载，Claude 会把详细内容拆到其他主题文件里。

像 `debugging.md`、`patterns.md` 这些主题文件启动时不会加载，Claude 会在需要时才读取。在使用过程中，你能看到 Claude 实时更新这些文件。

### 如何使用和管理

**查看记忆**：用 `/memory` 命令可以打开记忆文件看看 Claude 都记了些什么

**主动要求记录**：可以直接告诉 Claude 记住某些东西，比如：
- "记住我们项目用 pnpm 而不是 npm"
- "保存到记忆：API 测试要先启动本地 Redis"

**手动修改**：这些记忆文件就是普通的 Markdown，随时可以自己编辑

**功能开关**：用环境变量来控制：

```bash
export CLAUDE_CODE_DISABLE_AUTO_MEMORY=1  # 关闭
export CLAUDE_CODE_DISABLE_AUTO_MEMORY=0  # 开启
```

如果你的版本还没看到这个功能，可以试试设置 `CLAUDE_CODE_DISABLE_AUTO_MEMORY=0` 来启用。

### 使用建议

Claude Code官方也给出了一些比较好的使用Tips：

1. **让它自己学**：不用过度干预，让 Claude 自己判断什么值得记录
2. **偶尔检查一下**：用 `/memory` 看看记录的内容是否符合预期  
3. **重要的事主动说**：对于项目的核心规范，最好明确告诉 Claude 保存
4. **配合 CLAUDE.md 一起用**：自动记忆是辅助，不是替代手写配置

自动记忆这个功能让我感觉 Claude 变得更"聪明"了，它能记住之前的踩坑经验，下次遇到类似问题时会主动避开。用得越久，对项目的理解就越深。不过现在还是新功能，具体效果还要看长期使用情况。

## 总结

研究了一遍 Claude Code 的记忆管理系统后，感觉设计得确实挺周到的。从个人偏好到团队规范，从项目配置到组织策略，都有对应的层级。CLAUDE.md 让开发者能精确控制 AI 的行为，自动记忆又让 Claude 能自己学习和积累经验。

PyTorch 项目的实践给我们提供了一个很好的参考模板。他们的经验告诉我们：好的 CLAUDE.md 不是写得越多越好，而是要**明确、具体、有示例**。特别是对于团队项目，清晰的指令能大大减少 Claude 的误操作，提高协作效率。

对于个人开发者来说，可以从简单的 CLAUDE.md 开始：记录几个常用命令、核心架构约定就够了。如果是团队协作，建议参考 PyTorch 的做法，好好规划记忆文件的组织结构。对于大型项目，`.claude/skills/` 这种模块化管理方式特别有用，值得尝试。

不过说实话，这套系统还是有一定学习成本的。一开始可能会觉得配置项有点多，但用熟了之后，确实能让 Claude 更懂你的项目，减少很多重复解释的时间。建议从小做起，逐步完善，不要一开始就想着把所有东西都配置完美。

---

*参考资料：*
- *[Claude Code 官方文档 - 记忆管理](https://code.claude.com/docs/en/memory)*
- *[PyTorch CLAUDE.md](https://github.com/pytorch/pytorch/blob/main/CLAUDE.md)*
