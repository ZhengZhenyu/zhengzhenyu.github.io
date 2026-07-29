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
