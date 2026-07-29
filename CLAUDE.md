# Kevin's Personal Blog

基于 Hexo + stone 主题的个人技术博客，部署于 GitHub Pages。

## 项目结构

```
source/_posts/                   # 博客文章（Markdown + 图片目录）
source/about/                    # 关于页面
source/images/                   # 全局图片
themes/stone/                    # 博客主题
_config.yml                      # Hexo 配置
.claude/skills/                  # 博客写作 Skill
  ├── blog-common/base-style.md  # 通用规范（Frontmatter、CSS、暗色模式）
  ├── blog-insight/              # 技术项目洞察
  ├── blog-guide/                # 操作经验总结
  └── blog-trend/                # 业界趋势洞察
```

## 常用命令

- `hexo new post "<title>"` — 创建新文章
- `hexo server` — 本地预览（http://localhost:4000）
- `hexo generate` — 生成静态文件到 public/
- `hexo deploy` — 部署到 GitHub Pages

## 博客写作：三类 Skill

所有 Skill 共享六阶段 Agent 流程（研究→数据核实→大纲→初稿→打磨→终审），但每类的研究维度、写作结构、视觉侧重点不同。

### 数据准确性原则

贯穿全流程的最高优先级规则：

- **数据来源优先级**：官方文档 > 项目源码/Release Notes > 一手采访/官方博客 > 第三方 benchmark
- **必须从官方核实**：定价、版本号、性能指标、API 字段名
- Phase 1.5（数据核实）是必执行步骤，不可跳过

### `/blog-insight` — 技术项目洞察

深度拆解一个开源项目或技术产品。架构分析、源码阅读、竞品对比、战略意图。

```
/blog-insight Kubernetes 1.32 新特性深度分析 --repo https://github.com/kubernetes/kubernetes
```

| 标杆 | 研究 Agent（Phase 1） | 独特要求 |
|------|----------------------|---------|
| `nvidia-openshell-insight.md` | 技术深度 + 战略背景 + 竞品全景 | 架构分层图、≥5维对比表、战略分析、趋势判断 |

### `/blog-guide` — 操作经验总结

工具/平台的使用指南和经验分享。配置实操、避坑记录、最佳实践。

```
/blog-guide VS Code 中高效使用 Claude Code 的十条经验 --tool "Claude Code"
```

| 标杆 | 研究 Agent（Phase 1） | 独特要求 |
|------|----------------------|---------|
| `claude-memory-insight.md`、`claude-code-configuration-guide.md` | 工具机制 + 社区经验 + 替代方案 | 可运行代码示例、Good vs Bad、Tips 集合、学习路径 |

### `/blog-trend` — 业界趋势洞察

宏观趋势分析和前瞻判断。多源数据、多方观点、概率性预判。

```
/blog-trend 2026 年 AI Agent 从工具到平台的范式转移 --focus 技术,商业
```

| 标杆 | 研究 Agent（Phase 1） | 独特要求 |
|------|----------------------|---------|
| （首次使用后选定） | 数据收集 + 驱动力 + 多方观点 + 历史类比 | 核心判断开头、置信度标注、对立观点呈现、信号列表 |

> 趋势类目前尚无标杆文章，首次使用后从产出中选定。

## 共享规范

三类 Skill 共享 `.claude/skills/blog-common/base-style.md`：

- **平台约束**：Hexo Frontmatter 格式、文件组织、配置要点
- **设计系统**：CSS 变量（`--border`、`--surface`、`--text` 等）、暗色模式适配规则、Tailwind 色系参考
- **HTML 组件库**：verdict、callout、table-wrap、phase-card、stats-grid、arch-grid、stack-diagram、policy-flow、workflow——每个组件的 HTML 模板和使用场景
- **语言规范**：中文为主、数据无模糊词、时间标注
