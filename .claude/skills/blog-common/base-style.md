# 博客通用规范

所有类型博客文章共享的基础规范。各品类 Skill 的 style-guide 可在此基础上追加品类特定要求。

## 一、Hexo 平台约束

### Frontmatter 格式

```yaml
---
title: <标题，中英混合，简洁有力>
date: YYYY-MM-DD HH:mm:ss
tags: [标签1, 标签2, ...]  # 5-8个，中英混合
categories: <单个分类名>
description: <一句话描述，15-30字>
---
```

### 文件组织

- 文章：`source/_posts/<slug>.md`
- 附件：`source/_posts/<slug>/image.png`
- 附件引用：相对路径，如 `image.png`
- 全局图片：`source/images/`，引用 `../images/xxx.png` 或 `/images/xxx.png`

### 系统配置要点

- 语言：`zh-CN`
- 主题：`stone`
- 代码高亮：`highlight.js`（行号关闭）
- 文章支持 asset folder：`post_asset_folder: true`

## 二、CSS 设计系统

### 可用的主题 CSS 变量

| 变量 | 用途 |
|------|------|
| `--border` | 主边框色 |
| `--border-light` | 浅边框色 |
| `--radius` | 小圆角 |
| `--radius-lg` | 大圆角 |
| `--surface` | 卡片/背景色 |
| `--bg` | 页面背景色 |
| `--text` | 主文字色 |
| `--text-muted` | 次要文字色 |
| `--text-soft` | 柔和文字色 |
| `--primary` | 主色调 |
| `--shadow-sm` | 小阴影 |
| `--font-mono` | 等宽字体 |

### 暗色模式规范

每个带有自定义颜色的 HTML 元素必须同时提供两套规则：

```css
/* Light */
.my-element {
  background: var(--surface);
  border-left: 3px solid #f97316;
  color: #ea580c;
}

/* Dark */
:root[data-theme="dark"] .my-element {
  background: var(--surface);
  border-left-color: #fb923c;
  color: #fdba74;
}
```

暗色模式下颜色调整原则：
- 饱和度降低、亮度适度调高（不要刺眼）
- 渐变色背景：alpha 通道从 0.06 调到 0.10-0.12
- 对比度：正文 ≥4.5:1，大号文字 ≥3:1

### Tailwind 色系参考（硬编码时使用）

| 色系名 | light (500) | dark (300/400) |
|--------|------------|----------------|
| 橙 orange | `#f97316` | `#fb923c` / `#fdba74` |
| 靛蓝 indigo | `#4f46e5` | `#a5b4fc` |
| 紫 violet | `#7c3aed` | `#c4b5fd` |
| 青 cyan | `#0891b2` | `#22d3ee` |
| 灰 slate | `#64748b` | `#a1a1aa` |
| 红 red | `#ef4444` | `#f87171` |
| 绿 green | `#16a34a` | `#4ade80` |
| 琥珀 amber | `#d97706` | `#fbbf24` |

## 三、通用 HTML 组件库

### verdict — 核心判断框

```html
<div class="verdict">
  <p class="verdict-title">基本判断</p>
  <p>判断内容，关键短语用 <strong>加粗</strong>。</p>
</div>
```

用途：总结性的核心判断、关键结论

### callout — 列举型要点框

```html
<div class="callout callout-rose">
  <div class="callout-label">标题</div>
  <p><strong>① 要点一</strong>：描述</p>
  <p><strong>② 要点二</strong>：描述</p>
</div>
```

变体：`callout-rose`（玫瑰/默认）、`callout-amber`（琥珀/备注）

### table-wrap — 结构化表格

```html
<div class="table-wrap">
<table>
  <thead><tr><th>列1</th><th>列2</th></tr></thead>
  <tbody>
    <tr><td><strong>加粗</strong></td><td>内容</td></tr>
  </tbody>
</table>
</div>
```

要求：第一列关键字段加粗，表头始终用 `<thead>`，始终包裹在 `<div class="table-wrap">` 中。

### phase-card — 流程/阶段说明卡片

```html
<div class="phase-card">
  <h4>标题</h4>
  <p>内容描述。</p>
</div>
```

用途：机制解释、阶段说明、概念对比

### stats-grid — 关键数据卡片组

```html
<div class="stats-grid">
  <div class="stat-card">
    <div class="stat-num">7K+</div>
    <div class="stat-label">Stars（2026.06）</div>
  </div>
  <div class="stat-card">
    <div class="stat-num">66</div>
    <div class="stat-label">Contributors</div>
  </div>
</div>
```

要求：每个卡片包含 `stat-num`（大数字）和 `stat-label`（说明）。≥2 个卡片时使用。

### arch-grid — 架构组件卡片

```html
<div class="arch-grid">
  <div class="arch-card arch-ui">
    <div class="arch-card-title">用户界面</div>
    <div class="arch-card-items">CLI · TUI</div>
    <div class="arch-card-desc">命令行工具与终端监控面板</div>
  </div>
</div>

<style>
/* 需跟完整 CSS，含 dark mode */
.arch-card { border-left: 3px solid; }
.arch-ui { border-left-color: #6366f1; }
:root[data-theme="dark"] .arch-ui .arch-card-title { color: #a5b4fc; }
</style>
```

### policy-flow — 流程步骤图

```html
<div class="policy-flow">
  <div class="pf-step">
    <div class="pf-num">1</div>
    <div class="pf-body">
      <div class="pf-title">步骤标题</div>
      <div class="pf-desc">步骤描述</div>
    </div>
  </div>
  <div class="pf-arrow">→</div>
  <!-- 重复 pf-step + pf-arrow ... -->
</div>

<style>
/* 需跟完整 CSS，含 dark mode 和移动端响应式 */
@media (max-width: 768px) {
  .policy-flow { flex-direction: column; align-items: stretch; }
  .pf-arrow { text-align: center; padding: 2px 0; }
}
</style>
```

### workflow — 有序步骤

> **注意：此组件不添加自定义 CSS**。依赖 Hexo 默认的块级渲染，避免 flex 布局在中文长文本场景下挤压标号。标杆文章 `nvidia-openshell-insight.md` 中即无 workflow CSS。

```html
<div class="workflow">
  <div class="workflow-step mandatory">
    <div class="step-num">1</div>
    <div class="step-cmd">步骤名</div>
    <div class="step-desc">步骤描述</div>
  </div>
</div>
```

### stack-diagram — 技术栈层次图

```html
<div class="stack-diagram">
  <div class="stack-row"><span class="stack-tag tag-agent">Agent</span><span class="stack-text">描述</span></div>
  <div class="stack-row stack-row-hero"><span class="stack-tag tag-mylayer">重点层</span><span class="stack-text">描述</span></div>
</div>
```

## 四、语言通用规范

- 中文为主，技术术语和专有名词保留英文
- 避免口语化，专业但不学术化
- 关键判断用短句突出，细节用长句展开
- 对比用「不是...而是...」
- 转折用「值得说明的是」「换句话说」
- 数据禁止模糊词：「很多」「大量」「众多」「不少」→ 替换为具体数字
- 所有数据标注时间点：「（2026.06）」「截至 2026 年 7 月」

## 五、代码块规范

- 始终指定语言：`yaml`、`bash`、`json`、`python`、`rust`
- 配置文件给出可运行的完整示例，非片段
- Shell 命令给出可直接复制执行

## 六、术语可读性规范

目标：让非该领域专业的读者也能理解核心技术概念，同时不影响专业读者的阅读体验。

### 6.1 两类术语处理方式

| 方式 | 适用场景 | 示例 |
|------|---------|------|
| **内联括号解释** | 术语首次出现，后续不再频繁使用 | `通过 KVM_RUN ioctl（ioctl 是 Linux 系统调用，用于向设备驱动发送控制命令）将 vCPU 交给 KVM` |
| **术语速览 callout** | 5 个以上高频术语贯穿全文，读者需要反复查阅 | 在引言末尾（第一个 verdict 之后、第二节之前）插入 callout-amber 框，集中解释 |

### 6.2 术语速览 callout 模板

```html
<div class="callout callout-amber">
  <div class="callout-label">核心术语速览（非专业读者可先读此节）</div>
  <p><strong>术语名</strong>（英文全称）：一句话定义。补充一句说明其为什么重要。</p>
  <p><strong>术语名</strong>（英文全称）：一句话定义。补充一句说明其为什么重要。</p>
</div>
```

插入位置：引言 verdict 之后、第二节之前。每个术语 1-2 行，保持简洁。入选标准：
- 在文章中出现 ≥5 次
- 非该领域通用常识（如 Linux 内核概念、特定项目组件名）
- 首次出现前没有自然定义机会

### 6.3 内联解释格式

- 放在术语首次出现之后，紧跟括号：`seccomp（secure computing mode，Linux 内核的系统调用过滤机制）`
- 不超过一行，只解释「是什么」，不展开「怎么用」
- 如果该术语已出现在术语速览中，不再重复加内联

## 七、SVG 图解规范

目标：用图解辅助理解抽象架构、复杂流程、多维对比，降低纯文字占比。

### 7.1 适用判断

优先加图解的场景：
- **架构全景**：3 个以上组件有交互关系，纯文字描述难以建立空间感
- **流程/时序**：≥4 步的序列，有分支或回退路径
- **层次/嵌套结构**：安全沙箱、技术栈、防御层次等「从外到内」的概念
- **数据对比**：维度 ≥3 的竞品对比、性能指标对比

不需要加图解的：
- 已有同类图解表达相同信息
- 内容适合表格（如功能列表、配置参数）
- 2-3 步的简单线性流程

### 7.2 文件组织

- SVG 文件存放在文章资源目录：`source/_posts/<article-slug>/`
- 文章内用 `<img>` 引用（防 markdown 渲染器破坏 SVG 属性大小写）：

```html
<div class="growth-chart">
  <img src="filename.svg" alt="图解描述（用于无障碍访问）" style="width:100%">
</div>
```

- 文件名语义化：`arch-diagram.svg`、`create-flow.svg`、`security-model.svg`

### 7.3 配色系统

统一暖灰色基调，所有 SVG 使用这套色板：

| 用途 | 亮色模式 | 暗色模式 |
|------|---------|---------|
| 卡片/组件背景 | `#fafaf9` | `#1c1917` |
| 次要背景 | `#f5f5f4` | `#292524` |
| 强调底色 | `#fffbeb`（琥珀）| `#2d1f0c` |
| 主文字 | `#292524` | `#e7e5e4` |
| 次要文字 | `#57534e` | `#a8a29e` |
| 辅助/等宽文字 | `#78716c` | `#a8a29e` |
| 边框 | `#e7e5e4` | `#44403c` |
| 分隔线 | `#d6d3d1` | `#57534e` |
| 强调色（主） | `#c2410c`（深琥珀）| `#f97316` |
| 强调色（辅） | `#b45309` | `#d97706` |
| 绿色底色 | `#f0fdf4` | `#0a2e1a` |
| 灰色条底色 | `#f5f5f4` | `#292524` |

### 7.4 暗色模式

每个 SVG 的 `<style>` 块末尾添加 `@media (prefers-color-scheme: dark)` 规则：

```css
@media (prefers-color-scheme: dark) {
  .card     { fill: #1c1917; stroke: #44403c; }
  .body     { fill: #a8a29e; }
  /* ...对所有使用颜色的类做翻转 */
}
```

关键点：
- 所有颜色必须通过 CSS 类定义，禁止 inline `fill="..."` 和 `stroke="..."`（无法被 media query 覆盖）
- 暗色下文字要调亮（`#292524` → `#e7e5e4`），背景要调暗（`#fafaf9` → `#1c1917`）
- 强调色在暗色下适度提亮（`#c2410c` → `#f97316`）以保证对比度

### 7.5 版式与字体

- `viewBox` + `width="100%"`：保证移动端自适应缩放
- 字体栈：`system-ui, -apple-system, sans-serif`（标题/正文）、`'SF Mono', 'Cascadia Code', monospace`（代码）
- 字号层级：标题 13-14px / 正文 10.5-11px / 代码 9-10px / 标签 9px
- 圆角统一 `rx="6"` 或 `rx="8"`
- 边框线宽 `stroke-width: 1`，强调边框 `1.2-1.5`
- 阴影 `stdDeviation="2-3"`，透明度 `0.06-0.08`
- 箭头使用 `<marker>` 定义，统一风格

### 7.6 图文配合

- 图解放在对应小节的开头段落之后、详细组件列表之前
- 图解后的一段文字应对图中关键信息做一句话概括
- 不要只放图不解释，也不要图中文字照搬文章段落
- 图的 alt 属性应描述图的核心信息，用于无障碍访问
