---
title: NVIDIA OpenShell 初探
date: 2026-07-23 10:00:00
tags: [AI, Agent, NVIDIA, Sandbox, 安全, 战略, 开源]
categories: AI
description: 从源码出发，分析 AI Agent 安全运行时 OpenShell 的架构设计与技术细节
---

## 一、引言：当 AI 从「对话」走向「行动」

2026 年，AI 的应用形态正在发生变化。它不再局限于对话式 Copilot，而是发展为能独立规划任务、跨应用操作数据、持续运行数小时甚至数天的**自主智能体（Autonomous Agent）**。Claude Code、OpenClaw、Codex 等工具让开发者可以直接将编码、安装依赖、调用 API 等工作交由 Agent 自主完成。

但这种能力也带来了新的安全挑战。无状态的聊天机器人攻击面有限，但一个拥有持久 Shell 访问权限、携带实时凭据、能够重写自身工具链的 Agent，其威胁模型有本质区别：一次 Prompt Injection 可能暴露凭据，一个第三方 Skill 可能是未经审计的二进制文件，一个子 Agent 可能继承超出预期的权限。

这引出一个问题：**当一个程序的行为不再由确定的代码定义，而是由一个概率模型动态生成时，传统的信任机制如何适配？**

## 二、为什么 AI Agent 需要沙箱运行时

<div class="verdict">
  <p class="verdict-title">基本判断</p>
  <p>AI Agent 的核心风险在于：它执行的代码<strong>由模型实时生成，没有传统的作者、审查或签名流程</strong>，且行为是非确定性的——同一个 Prompt 在不同上下文下可能产生截然不同的操作。传统安全手段（代码审查、测试覆盖、权限分级）在这种范式下面临适配挑战。</p>
</div>

### 2.1 传统信任模型失效

传统软件中，信任建立在代码审查、作者信誉和 CI/CD 构建管道的控制之上。但 Agent 执行的代码由模型实时生成——审计 Agent 的每一次工具调用与审计一个 PR 有本质不同。Agent 的决策在本质上是概率性的，很难通过穷举测试覆盖所有行为路径。

### 2.2 Agent 的全新攻击面

<div class="callout callout-rose">
  <div class="callout-label">五大攻击向量</div>
  <p><strong>① 提示注入（Prompt Injection）</strong>：恶意输入诱导 Agent 执行意料之外的命令。与 SQL 注入不同——参数化查询能有效防御 SQL 注入，但 Prompt Injection 的缓解更困难，因为 LLM 的指令遵循能力本身就是核心功能。</p>
  <p><strong>② 幻觉引发的危险操作</strong>：Agent 可能「记错」包名，安装了名称相似的恶意软件包。</p>
  <p><strong>③ 上下文污染</strong>：长运行 Agent 累积大量上下文，早期对话中的恶意代码示例可能在数小时后被当作指令执行。</p>
  <p><strong>④ 供应链攻击</strong>：Agent 在任务中安装第三方包、下载脚本、克隆仓库——每个外部依赖都可能被投毒。</p>
  <p><strong>⑤ 凭据泄露</strong>：Agent 需要 API Key 调用模型和服务，可能在不经意间将 Key 打印到日志或错误消息中。</p>
</div>

<div class="verdict">
  <p class="verdict-title">核心矛盾</p>
  <p>Agent 的能力和安全性之间存在一个难以绕过的矛盾：<strong>安全 + 自主</strong> → Agent 权限受限；<strong>能力 + 安全</strong> → 频繁人工审批；<strong>能力 + 自主</strong> → 无有效护栏。如何在三者之间找到平衡，是这类系统要解决的核心问题。</p>
</div>

## 三、业界 Agent 方案与安全现状

在深入 OpenShell 之前，先看看当前 AI Agent 生态中各类方案在安全上的做法和局限。

### 3.1 Agent 生态概览

目前的 Agent 生态大致分为三个层次：

<div class="table-wrap">
<table>
  <thead><tr><th>层级</th><th>代表项目</th><th>核心能力</th><th>典型安全措施</th></tr></thead>
  <tbody>
    <tr><td><strong>Agent 工具</strong></td><td>Claude Code、OpenClaw、Codex CLI</td><td>终端中执行编码、调试、部署等任务</td><td>执行前确认、工作目录限制</td></tr>
    <tr><td><strong>编排框架</strong></td><td>LangChain、CrewAI、AutoGen</td><td>多 Agent 协作、工具链编排</td><td>角色级权限、工具白名单</td></tr>
    <tr><td><strong>执行环境</strong></td><td>E2B、Daytona、CodeSandbox</td><td>云端代码执行、快速环境供给</td><td>MicroVM 隔离、网络策略</td></tr>
  </tbody>
</table>
</div>

Agent 工具层以 **Claude Code** 为代表——它在用户终端中运行，可读写文件、执行 shell 命令、发起网络请求，安全主要靠「执行前询问」和用户审批。**OpenClaw** 强调多 Agent 协作，允许主 Agent 派生子 Agent。编排框架层如 **LangChain** 和 **CrewAI** 提供角色定义和工具绑定，但它们通常不管理执行环境的安全边界——具体安全策略取决于部署方式。

### 3.2 三类主流安全方案

<div class="callout callout-rose">
  <div class="callout-label">三类方案及其局限</div>
  <p><strong>方案一：System Prompt 约束</strong><br>
  在 System Prompt 中加入安全规则。这是目前最普遍的做法，但安全指令与 Agent 逻辑运行在<strong>同一进程空间</strong>。一旦 Agent 被 Prompt Injection 影响，约束指令本身也可能被绕过。用 NVIDIA 的话说：「护栏就位于它们应该守护的同一流程中」。</p>
  <p><strong>方案二：事后审计</strong><br>
  在 Agent 执行完毕后审查日志。存在检测延迟——Agent 可能在审计介入前已完成破坏性操作。且 Agent 的操作量级通常是人类的数十倍，人工审计难以规模化。</p>
  <p><strong>方案三：通用容器隔离</strong><br>
  将 Agent 放在 Docker 等容器中运行。默认配置下容器与宿主机共享内核，seccomp 过滤较宽松（默认允许 300+ 系统调用），且出站网络和进程级策略感知不足。已知的容器逃逸漏洞也引入了额外风险。</p>
</div>

### 3.3 问题的关键

三类方案的共同点：**安全策略的执行点要么在 Agent 进程内部，要么在 Agent 运行之后，要么隔离粒度不够细。**

一种不同的思路是将策略执行放到 Agent 进程之外——在 Agent 做出动作的瞬间进行拦截和裁决，而不是靠事前的「嘱咐」或事后的「检查」。这也是 OpenShell 与其他方案在定位上的主要不同。

## 四、OpenShell 深度分析

### 4.1 项目概览

<div class="table-wrap">
<table>
  <thead><tr><th>维度</th><th>信息</th></tr></thead>
  <tbody>
    <tr><td><strong>仓库</strong></td><td><a href="https://github.com/NVIDIA/OpenShell" target="_blank">NVIDIA/OpenShell</a></td></tr>
    <tr><td><strong>公开时间</strong></td><td>2026.03.16（GTC 大会），NVIDIA 与 Cisco 联合发布；仓库创建于 2026.02.24</td></tr>
    <tr><td><strong>最新版本</strong></td><td>v0.0.73（2026.07.02），平均每 2-3 天发布</td></tr>
    <tr><td><strong>许可</strong></td><td>Apache 2.0</td></tr>
    <tr><td><strong>实现语言</strong></td><td>Rust（~90%）</td></tr>
    <tr><td><strong>社区规模</strong></td><td>7000+ Stars、842 Forks、66 Contributors（2026.06）</td></tr>
  </tbody>
</table>
</div>

<div class="stats-grid">
  <div class="stat-card">
    <div class="stat-num">7K+</div>
    <div class="stat-label">Stars（2026.06）</div>
  </div>
  <div class="stat-card">
    <div class="stat-num">66</div>
    <div class="stat-label">Contributors</div>
  </div>
  <div class="stat-card">
    <div class="stat-num">17+</div>
    <div class="stat-label">企业采用方</div>
  </div>
  <div class="stat-card">
    <div class="stat-num">53</div>
    <div class="stat-label">Releases（4个月）</div>
  </div>
</div>

### 定位

OpenShell 在技术栈中的位置：

<div class="stack-diagram">
  <div class="stack-row"><span class="stack-tag tag-agent">Agent</span><span class="stack-text">Claude Code · OpenClaw · Codex · …</span></div>
  <div class="stack-row"><span class="stack-tag tag-harness">Harness</span><span class="stack-text">Hermes · LangChain · CrewAI · …</span></div>
  <div class="stack-row stack-row-hero"><span class="stack-tag tag-openshell">OpenShell</span><span class="stack-text">Landlock · seccomp · OPA · 凭据网关 · 推理路由</span></div>
  <div class="stack-row"><span class="stack-tag tag-infra">Infra</span><span class="stack-text">OS · Container · Kubernetes · MicroVM</span></div>
</div>

<style>
.stack-diagram {
  margin: 1.25rem 0;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  font-family: var(--font-mono);
  font-size: 0.8rem;
  line-height: 1.6;
  box-shadow: var(--shadow-sm);
}
.stack-row {
  display: flex;
  align-items: baseline;
  padding: 7px 16px;
  gap: 12px;
  border-bottom: 1px solid var(--border-light);
  background: var(--surface);
}
.stack-row:last-child { border-bottom: none; }
.stack-row-hero {
  background: linear-gradient(90deg, rgba(249,115,22,0.06) 0%, rgba(249,115,22,0.02) 100%);
  border-left: 3px solid #f97316;
}
.stack-tag {
  flex-shrink: 0;
  width: 80px;
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-align: right;
}
.stack-text { color: var(--text-soft); }
.tag-agent     { color: #4f46e5; }
.tag-harness   { color: #7c3aed; }
.tag-openshell { color: #ea580c; }
.tag-infra     { color: #64748b; }

:root[data-theme="dark"] .tag-agent     { color: #a5b4fc; }
:root[data-theme="dark"] .tag-harness   { color: #c4b5fd; }
:root[data-theme="dark"] .tag-openshell { color: #fb923c; }
:root[data-theme="dark"] .tag-infra     { color: #a1a1aa; }
:root[data-theme="dark"] .stack-row-hero {
  background: linear-gradient(90deg, rgba(249,115,22,0.10) 0%, rgba(249,115,22,0.02) 100%);
}
</style>

OpenShell 不做一个新的 Agent 框架去和 LangChain、CrewAI 竞争，而是一个**通用型 Agent Runtime**，在 Agent 进程之外拦截文件访问、网络连接、进程执行和推理调用。

> **"The safe, private runtime for autonomous AI agents."**

- **Safe**：内核级隔离（Landlock + seccomp + 网络命名空间）
- **Private**：凭据不存储在沙箱内部，推理流量可路由到指定后端
- **Runtime**：面向长时间运行 Agent 的持续性环境，而非一次性执行沙箱

#### 它是 NVIDIA Agent Toolkit 的基石

OpenShell 是 [NVIDIA Agent Toolkit](https://build.nvidia.com/openshell) 的核心组件。Toolkit 中还包含两个基于 OpenShell 构建的参考蓝图：

<div class="table-wrap">
<table>
  <thead><tr><th>蓝图</th><th>定位</th><th>与 OpenShell 的关系</th></tr></thead>
  <tbody>
    <tr><td><strong>AI-Q</strong></td><td>企业知识搜索与深度研究，与 LangChain 合作，在 DeepResearch Bench 准确率登顶</td><td>AI-Q 的 Agent 运行在 OpenShell 沙箱中，策略引擎管控其数据访问</td></tr>
    <tr><td><strong>NemoClaw</strong></td><td>安全 Agent 部署参考实现，支持 OpenClaw / Hermes / LangChain Deep Agents 三种 Agent 类型</td><td>OpenShell 作为其安全运行时底座，提供沙箱隔离、策略执行和隐私路由</td></tr>
  </tbody>
</table>
</div>

NemoClaw 的设计值得展开一瞥——它展示了 OpenShell 在实际产品中的集成方式：上层是一个精简的 TypeScript 插件（提供 CLI），中间是版本化的蓝图工件（声明式策略 + 编排逻辑 + 快照迁移），底部由 OpenShell 提供**进程外策略执行**——NVIDIA 称之为「浏览器标签页模型」：安全边界由 OS 执行，而非应用程序自觉遵守。

#### 主要贡献者

<div class="table-wrap">
<table>
  <thead><tr><th>组织</th><th>角色</th></tr></thead>
  <tbody>
    <tr><td><strong>NVIDIA</strong></td><td>项目创建者与主要维护者，主导架构设计与核心开发</td></tr>
    <tr><td><strong>Cisco</strong></td><td>GTC 2026 上与 NVIDIA 联合开源；AI Defense 平台与 OpenShell 集成，提供实时 Agent 审计</td></tr>
    <tr><td><strong>SAP</strong></td><td>参与代码贡献（运行时加固、策略建模、企业身份集成），将 OpenShell 嵌入 SAP Business AI Platform</td></tr>
  </tbody>
</table>
</div>

#### 采用方

GTC 2026 上宣布的采用方覆盖企业软件、安全和基础设施三个领域：

| 领域 | 组织 |
|---|---|
| **企业软件** | Adobe、Salesforce、ServiceNow、Atlassian、Box、SAP、Siemens、Cadence、Synopsys、Dassault Systèmes、Amdocs、Cohesity、IQVIA、Palantir |
| **安全** | CrowdStrike（Secure-by-Design AI Blueprint）、Cisco（AI Defense） |
| **基础设施** | Canonical（Ubuntu Snap）、Red Hat（OpenShift AI）、Microsoft（Windows）、Dell（AI Factory） |

这些集成目前大多处于早期阶段——OpenShell 本身仍是 alpha 软件，NVIDIA 官方将其定位为「single-player mode」。

### 4.2 架构全景

OpenShell 的代码库由 24 个 Rust crate 组成，按职责分为五层：

<div class="arch-grid">
  <div class="arch-card arch-ui">
    <div class="arch-card-title">用户界面</div>
    <div class="arch-card-items">CLI &nbsp;·&nbsp; TUI</div>
    <div class="arch-card-desc">命令行工具与终端监控面板</div>
  </div>
  <div class="arch-card arch-ctrl">
    <div class="arch-card-title">控制平面 · Gateway</div>
    <div class="arch-card-items">Server &nbsp;·&nbsp; SDK</div>
    <div class="arch-card-desc">API 入口、策略存储与分发、凭据管理</div>
  </div>
  <div class="arch-card arch-data">
    <div class="arch-card-title">数据平面 · Supervisor</div>
    <div class="arch-card-items">Network &nbsp;·&nbsp; Process &nbsp;·&nbsp; Middleware &nbsp;·&nbsp; Router &nbsp;·&nbsp; Sandbox</div>
    <div class="arch-card-desc">策略执行、网络代理、进程管控、推理路由</div>
  </div>
  <div class="arch-card arch-policy">
    <div class="arch-card-title">策略与分析</div>
    <div class="arch-card-items">Policy &nbsp;·&nbsp; Prover &nbsp;·&nbsp; OCSF</div>
    <div class="arch-card-desc">策略 YAML 解析、Z3 形式化验证、标准日志</div>
  </div>
  <div class="arch-card arch-driver">
    <div class="arch-card-title">计算后端</div>
    <div class="arch-card-items">Docker &nbsp;·&nbsp; Podman &nbsp;·&nbsp; Kubernetes &nbsp;·&nbsp; Firecracker</div>
    <div class="arch-card-desc">多运行时支持，按需选择隔离级别</div>
  </div>
</div>

<style>
.arch-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 1.25rem 0;
}
.arch-card {
  padding: 12px 18px;
  border-radius: var(--radius);
  border-left: 3px solid;
  background: var(--surface);
  border-top: 1px solid var(--border);
  border-right: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}
.arch-card-title {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  margin-bottom: 4px;
}
.arch-card-items {
  font-family: var(--font-mono);
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--text);
  margin-bottom: 2px;
}
.arch-card-desc {
  font-size: 0.78rem;
  color: var(--text-muted);
}
.arch-ui     { border-left-color: #6366f1; } .arch-ui     .arch-card-title { color: #4f46e5; }
.arch-ctrl   { border-left-color: #7c3aed; } .arch-ctrl   .arch-card-title { color: #7c3aed; }
.arch-data   { border-left-color: #f97316; } .arch-data   .arch-card-title { color: #ea580c; }
.arch-policy { border-left-color: #0891b2; } .arch-policy .arch-card-title { color: #0891b2; }
.arch-driver { border-left-color: #64748b; } .arch-driver .arch-card-title { color: #64748b; }

:root[data-theme="dark"] .arch-ui     .arch-card-title { color: #a5b4fc; }
:root[data-theme="dark"] .arch-ctrl   .arch-card-title { color: #c4b5fd; }
:root[data-theme="dark"] .arch-data   .arch-card-title { color: #fb923c; }
:root[data-theme="dark"] .arch-policy .arch-card-title { color: #22d3ee; }
:root[data-theme="dark"] .arch-driver .arch-card-title { color: #a1a1aa; }
</style>

#### Gateway-Supervisor 分离

OpenShell 将系统分为两部分：

- **Gateway**（控制平面）：运行在宿主机或集群中，负责策略持久化、Provider 配置、凭据管理和沙箱索引。拥有平台级全局状态。
- **Supervisor**（数据平面）：运行在每个沙箱内部，主动向 Gateway 发起出站 gRPC 长连接，拉取策略配置并在本地执行。Supervisor 本身不持有凭据。

Supervisor 通过出站连接向 Gateway 报到，这意味着不依赖容器编排层的网络配置（Pod IP、端口映射、NAT）。因此 OpenShell 可以运行在 Docker、Podman、Kubernetes、Firecracker MicroVM 等多种后端上——只要沙箱能访问网络。

### 4.3 纵深防御：四层安全体系

OpenShell 在四个层面施加安全约束：

<div class="table-wrap">
<table>
  <thead><tr><th>防护层</th><th>技术</th><th>策略变更</th></tr></thead>
  <tbody>
    <tr><td><strong>文件系统</strong></td><td>Landlock LSM，限制 Agent 只能访问声明路径</td><td>静态</td></tr>
    <tr><td><strong>网络</strong></td><td>OPA 引擎 + HTTP CONNECT 代理，默认拒绝</td><td>动态热加载</td></tr>
    <tr><td><strong>进程</strong></td><td>seccomp BPF 系统调用过滤 + 特权丢弃</td><td>静态</td></tr>
    <tr><td><strong>推理</strong></td><td>推理路由器（inference.local），代理注入凭据</td><td>动态热加载</td></tr>
  </tbody>
</table>
</div>

#### 文件系统

使用 Linux 内核的 **Landlock LSM**。与 chroot 不同，Landlock 允许进程在无 root 权限下自主限制自身及其子进程的文件系统访问。策略支持 `BestEffort`（尽内核能力执行）和 `HardRequirement`（内核不支持则启动失败）：

```yaml
filesystem_policy:
  include_workdir: true
  read_only:
    - /usr
    - /lib
    - /etc
  read_write:
    - /sandbox
    - /tmp
```

#### 网络：Per-binary 身份识别 + OPA 策略

网络层将安全粒度推进到了**进程级别**。传统容器只能识别到「某个容器」在发包，OpenShell 能区分是容器里的 `gh` 还是 `curl`。

<div class="phase-card">
  <h4>TOFU（Trust On First Use）机制</h4>
  <p>Supervisor 内的 HTTP CONNECT 代理在二进制文件首次发起网络请求时：</p>
  <p>① 通过 <code>/proc/{pid}/exe</code> 读取文件内容，计算 SHA-256 哈希，缓存为「黄金哈希」</p>
  <p>② 同时缓存文件元数据指纹（inode、mtime、ctime、文件大小），指纹未变则跳过重复哈希</p>
  <p>③ 后续同路径请求必须匹配该哈希；<strong>二进制被替换 → 哈希不匹配 → 拒绝请求</strong></p>
</div>

策略以声明式 YAML 编写，由 OPA 引擎在每次连接时评估：

```yaml
network_policies:
  "github-api":
    description: "允许访问 GitHub API"
    binary_hash: "abc123..."
    hosts:
      - "api.github.com:443"
    protocols: ["https"]
```

L7 中间件在此基础上进一步匹配 HTTP 方法和 URL 路径，例如「允许 `POST /user/repos` 但拒绝 `DELETE /user/repos`」。被拦截的请求返回 403 并附带 `next_steps` 提示，引导 Agent 提交策略放宽提案（见 4.5 节）。

#### 进程隔离

seccomp BPF 过滤器限制 Agent 可执行的系统调用（`mount`、`kexec_load`、`bpf` 等在 Agent 场景中通常没有合法用途）。沙箱进程以非 root 用户（`uid: 10000`）运行，所有特权能力在 exec 前丢弃。

#### 推理路由：inference.local

推理流量是 AI Agent 独有的网络模式——每次调用 LLM 都携带 API Key。OpenShell 的做法是让 Agent **只接触本地代理地址，不接触真实凭据**：

1. Agent 向 `https://inference.local` 发请求（使用占位凭据）
2. Supervisor 内的推理路由器拦截请求
3. 从 Gateway 凭据存储中获取实际 API Key，注入请求头
4. 转发到真实后端

路由器支持多种后端的协议适配：

<div class="table-wrap">
<table>
  <thead><tr><th>Provider</th><th>协议路径</th><th>关键适配</th></tr></thead>
  <tbody>
    <tr><td>OpenAI</td><td><code>/v1/chat/completions</code></td><td>Bearer Token 注入，max_tokens 参数兼容</td></tr>
    <tr><td>Anthropic</td><td><code>/v1/messages</code></td><td>x-api-key 头注入，版本头填充</td></tr>
    <tr><td>Vertex AI</td><td><code>:rawPredict</code></td><td>模型名编码在 URL，请求体适配，流式升级</td></tr>
    <tr><td>AWS Bedrock</td><td><code>/model/{id}/invoke</code></td><td>模型 ID 路径重写，SigV4 签名</td></tr>
  </tbody>
</table>
</div>

转发前路由器还会清洗请求头——剥离 Authorization、Cookie 等敏感头，只放行配置中允许的头。启动时对每个后端进行活跃性探测，验证通过才标记可用。

### 4.4 形式化验证：Z3 SMT Prover

OpenShell 内置了一个基于 Z3 SMT Solver 的策略验证器。它的作用是：在策略提交时自动检查策略组合是否会意外打开数据外泄路径。

#### 为什么需要

安全策略是声明式的——它描述**允许**什么，但不直接描述**禁止**什么。例如：

- 策略允许 `curl` 访问 `api.github.com`
- 凭据存储中包含 GitHub token
- 策略没有限制 HTTP 方法

这种组合是否安全？人工审查可能遗漏，形式化验证可以系统地检查。

#### 四类检查

Prover 将策略、凭据范围、工具能力编码为 Z3 约束，运行四类查询：

<div class="workflow">
  <div class="workflow-step mandatory">
    <div class="step-num">1</div>
    <div class="step-cmd">Link-Local Reach</div>
    <div class="step-desc">检查是否有二进制能访问 link-local 地址（169.254.0.0/16）或云元数据主机名——这些端点可能返回宿主机凭据。</div>
  </div>
  <div class="workflow-step mandatory">
    <div class="step-num">2</div>
    <div class="step-cmd">L7-Bypass + Credential</div>
    <div class="step-desc">使用非 HTTP 协议的工具（git、ssh、nc）能绕过 L7 检查。如果它们被授权访问存有凭据的主机，提示风险。</div>
  </div>
  <div class="workflow-step mandatory">
    <div class="step-num">3</div>
    <div class="step-cmd">Credential Reach Expansion</div>
    <div class="step-desc">对比基线，检测是否有二进制新获得了对某凭据化主机的访问权限。</div>
  </div>
  <div class="workflow-step mandatory">
    <div class="step-num">4</div>
    <div class="step-cmd">Capability Expansion</div>
    <div class="step-desc">在已有访问权限的基础上，检测是否新增了写方法（PUT、POST、DELETE 等）。</div>
  </div>
</div>

验证在策略提交时自动运行，结果输出为「通过」或列出潜在问题路径。它不能替代人工审查，但可以捕捉容易被忽略的组合风险。

### 4.5 Agent 自主策略提案

OpenShell 允许 Agent 在遇到策略拦截时**主动提交策略放宽提案**，等待人工审批后自动重试。这形成了一个闭环：

<div class="policy-flow">
  <div class="pf-step">
    <div class="pf-num">1</div>
    <div class="pf-body">
      <div class="pf-title">Agent 发起请求</div>
      <div class="pf-desc">Agent 尝试访问某网络地址</div>
    </div>
  </div>
  <div class="pf-arrow">→</div>
  <div class="pf-step">
    <div class="pf-num">2</div>
    <div class="pf-body">
      <div class="pf-title">Supervisor 拦截</div>
      <div class="pf-desc">返回 403 + 策略提示 + 提案入口</div>
    </div>
  </div>
  <div class="pf-arrow">→</div>
  <div class="pf-step">
    <div class="pf-num">3</div>
    <div class="pf-body">
      <div class="pf-title">Agent 提交提案</div>
      <div class="pf-desc">通过 policy.local API 提交策略变更</div>
    </div>
  </div>
  <div class="pf-arrow">→</div>
  <div class="pf-step">
    <div class="pf-num">4</div>
    <div class="pf-body">
      <div class="pf-title">人工审批</div>
      <div class="pf-desc">Prover 自动验证 + Reviewer 决策</div>
    </div>
  </div>
  <div class="pf-arrow">→</div>
  <div class="pf-step">
    <div class="pf-num">5</div>
    <div class="pf-body">
      <div class="pf-title">自动重载 + 重试</div>
      <div class="pf-desc">策略生效后 Agent 自动重试原请求</div>
    </div>
  </div>
</div>

<style>
.policy-flow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0;
  margin: 1.25rem 0;
  padding: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}
.pf-step {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--radius);
  background: var(--bg);
  border: 1px solid var(--border-light);
  min-width: 0;
  flex: 1;
}
.pf-num {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--primary);
  color: #fff;
  font-size: 0.7rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.pf-body { min-width: 0; }
.pf-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text);
  line-height: 1.3;
}
.pf-desc {
  font-size: 0.68rem;
  color: var(--text-muted);
  line-height: 1.4;
}
.pf-arrow {
  flex-shrink: 0;
  color: var(--text-muted);
  font-size: 0.85rem;
  padding: 0 4px;
}

@media (max-width: 768px) {
  .policy-flow { flex-direction: column; align-items: stretch; }
  .pf-arrow { text-align: center; padding: 2px 0; }
  .pf-step { flex: none; }
}
</style>

Supervisor 在每个沙箱内部署了轻量级 HTTP 服务（`policy.local`），提供四个端点：

| 端点 | 方法 | 功能 |
|---|---|---|
| `/v1/policy/current` | GET | 查看当前生效的策略 |
| `/v1/denials?last=N` | GET | 查看最近的拦截日志 |
| `/v1/proposals` | POST | 提交策略变更提案 |
| `/v1/proposals/{id}/wait` | GET | 长轮询等待审批结果 |

几个设计要点：

- **长轮询不烧 Token**：Agent 的工具调用挂在 socket recv 上等待（最长 5 分钟），不消耗 LLM 推理成本
- **确认生效再重试**：审批通过后，`/wait` 会持续检查本地策略是否已更新（`policy_reloaded: true`），避免「批准了但还没生效」的竞态
- **安全校验前置**：L7 路径不允许包含 query string，防止将凭据编码在 URL 中提交；校验在客户端和 Gateway 侧各执行一遍

### 4.6 GPU 集成

OpenShell 通过 `openshell-vfio` crate 支持 VFIO GPU 直通——在 sysfs 层面管理 PCI 设备与驱动的绑定/解绑，支持按 UUID 或 PCI 地址选择 GPU。GPU 设备通过 CDI（Container Device Interface）注入沙箱。

Firecracker MicroVM 后端支持在 MicroVM 级别分配 GPU，通过 vsock 与宿主机通信。这使得在硬件虚拟化隔离的同时跑 GPU 推理成为可能，适合 DGX 等本地 AI 硬件的 air-gapped 部署场景。

### 4.7 可观测性

日志采用 OCSF 标准格式，有三条管线：

- **Shorthand 日志**（默认开启）：人类可读单行格式，按日轮转，是 `/v1/denials` API 的数据源
- **OCSF JSONL**（可选）：结构化事件流，可对接外部 SIEM
- **TUI**：基于 Ratatui 的终端面板，实时展示沙箱状态和拦截事件

日志在返回给 Agent 前会做**查询字符串脱敏**——将 URL 中的 `?<query>` 替换为 `?[redacted]`，避免凭据经 URL 泄露到 Agent 上下文。

## 五、与其他方案的对比

### 5.1 与 E2B、Daytona、CodeSandbox

<div class="table-wrap">
<table>
  <thead><tr><th>维度</th><th>OpenShell</th><th>E2B</th><th>Daytona</th><th>CodeSandbox</th></tr></thead>
  <tbody>
    <tr><td><strong>定位</strong></td><td>Agent 安全运行时</td><td>云沙箱即服务</td><td>开发环境管理</td><td>在线 IDE + 沙箱</td></tr>
    <tr><td><strong>隔离技术</strong></td><td>Landlock + seccomp + OPA</td><td>Firecracker MicroVM</td><td>Docker 容器</td><td>Firecracker MicroVM</td></tr>
    <tr><td><strong>策略粒度</strong></td><td>Per-binary，L7 路径级</td><td>API 级别</td><td>基本网络隔离</td><td>沙箱级别</td></tr>
    <tr><td><strong>凭据管理</strong></td><td>网关代理注入</td><td>外部管理</td><td>SDK 层</td><td>平台管理</td></tr>
    <tr><td><strong>推理控制</strong></td><td>内置推理路由</td><td>—</td><td>—</td><td>—</td></tr>
    <tr><td><strong>形式化验证</strong></td><td>Z3 SMT</td><td>—</td><td>—</td><td>—</td></tr>
    <tr><td><strong>GPU 直通</strong></td><td>VFIO + CDI</td><td>—</td><td>—</td><td>—</td></tr>
  </tbody>
</table>
</div>

### 5.2 与 gVisor、Firecracker

<div class="table-wrap">
<table>
  <thead><tr><th>维度</th><th>OpenShell</th><th>gVisor</th><th>Firecracker</th></tr></thead>
  <tbody>
    <tr><td><strong>隔离级别</strong></td><td>容器 + 内核 LSM</td><td>用户态内核</td><td>独立内核 MicroVM</td></tr>
    <tr><td><strong>启动速度</strong></td><td>秒级</td><td>~417ms</td><td>~125ms</td></tr>
    <tr><td><strong>策略层</strong></td><td>OPA + Prover</td><td>—</td><td>—</td></tr>
    <tr><td><strong>定位</strong></td><td>Agent 工作负载</td><td>通用隔离</td><td>通用隔离</td></tr>
  </tbody>
</table>
</div>

<div class="verdict">
  <p class="verdict-title">定位差异</p>
  <p>gVisor 和 Firecracker 是成熟的通用隔离技术。OpenShell 可以在 Firecracker MicroVM 上运行（通过 <code>openshell-driver-vm</code>），它在隔离层之上叠加了策略引擎、凭据管理、推理路由和形式化验证——这些是面向 AI Agent 工作负载的补充，关注的是 Agent 行为治理而非通用容器隔离。</p>
</div>

## 六、NVIDIA 的战略出发点

要理解 NVIDIA 为什么做 OpenShell，不能只看「Agent 安全」这一个点。把它放到 NVIDIA 的整体战略版图中，有四个层层递进的逻辑。

### 6.1 卖铲子 2.0：从算力到 Agent 基础设施

NVIDIA 的核心商业模式一直没变——在淘金热里卖铲子。AI 训练时代卖 GPU，AI 推理时代卖推理芯片 + TensorRT，到了 Agent 时代，铲子需要升级。

Agent 不是一次性推理——Agent 是持续数小时甚至数天的自主进程，涉及文件读写、网络调用、模型推理、工具链操作。企业需要的不仅是「能跑 Agent 的 GPU」，而是「能安全地跑 Agent 的完整环境」。OpenShell 就是这把新铲子。

<div class="phase-card">
  <h4>铲子进化史</h4>
  <p>训练时代 → GPU（硬件铲子）</p>
  <p>推理时代 → GPU + TensorRT + Triton（软硬一体铲子）</p>
  <p>Agent 时代 → GPU + TensorRT + <strong>OpenShell</strong>（硬件 + 安全运行时铲子）</p>
</div>

每一代铲子的附加值都在增加，对应的护城河也在加深——GPU 可以被 AMD 替代，CUDA 生态很难替代，Agent 运行时的策略、凭据、审计数据积累起来之后，迁移成本更高。

### 6.2 云厂商突围：用本地 Agent 安全撬开企业市场

三大云厂商（AWS Trainium、Google TPU、Azure Maia）都在推自有 AI 芯片，试图减少对 NVIDIA 的依赖。但云厂商的 Agent 方案有一个共同问题：**企业敏感数据和凭据必须经过云端**。

OpenShell 的定位恰好切入了这个缝隙。它支持完全离线的 air-gapped 部署——DGX Spark/Station 本地运行，Firecracker MicroVM 隔离，GPU 直通，推理流量可以在本地 NIM 或 Ollama 上完成。对于金融、医疗、国防等受监管行业，这意味着一件事：**你可以用 Agent，且数据不出机房**。

<div class="verdict">
  <p class="verdict-title">战略意图</p>
  <p>云厂商用自研芯片打价格战 → NVIDIA 用「本地安全 Agent 运行时」打合规战。价格可以卷，但合规不能妥协。OpenShell 让 GPU 从「训练基础设施」变成了「企业 Agent 合规基础设施」——这比单纯卖算力更有定价权。</p>
</div>

### 6.3 推理路由器的咽喉位置

OpenShell 架构中有一个容易被忽视但极其关键的设计：**推理路由器（inference.local）**。

推理路由器位于 Agent 与 LLM 之间的必经之路上。它决定了每次模型调用走向哪个 Provider。Agent 只知道调用 `inference.local`，真正发往 OpenAI、Anthropic、Vertex AI 还是 NVIDIA NIM 端点——由路由器决定（或者说，由配置路由器的运维方决定）。

这不只是一个技术细节，而是对 Agent 推理流量的**咽喉控制**：

- 短期：路由器默认配置可以倾向 NVIDIA 的推理基础设施（NIM、NVIDIA Endpoints），让 Agent 推理负载更多地流向 NVIDIA 生态
- 中期：AI-Q 蓝图中已展示的路由策略——用 Nemotron 处理研究任务、用前沿模型处理编排任务——将推理成本降低 50%+，这种效率优势会促使企业主动使用 NVIDIA 的路由方案
- 长期：如果 OpenShell 成为主流 Agent 运行时，NVIDIA 就掌握了**全行业 Agent 推理流量的路由决策权**

这类似于 AWS 控制着海量 Web 流量的 DNS 解析——控制点本身的商业价值可能超过运行时本身。

### 6.4 标准先行者的窗口期

Agent 安全运行时是一个全新的品类。它不像容器——Docker 已经是事实标准；不像 Service Mesh——Istio 已经定义了范式。Agent 安全还在「谁先定义、谁就被模仿」的阶段。

OpenShell 的几个设计选择，实际上都在试图影响行业规范：

- **OCSF 日志格式**：如果成为 Agent 审计的事实标准，安全厂商（CrowdStrike、Cisco、Google）都需要对接
- **声明式 YAML 策略**：如果「Agent 安全策略 = YAML 文件 + Git 版本控制」成为共识，OpenShell 的策略格式就是默认模板
- **Z3 SMT Prover**：如果在 Agent 安全评审中「形式化验证」成为合规要求，OpenShell 的 prover 就是唯一的开源选择

目前社区 7000+ Stars，66 个贡献者，17+ 家企业采用方——数据不算大，但在一个全新的品类中，这就是先发优势。Canonical 和 Red Hat 的集成意味着 OpenShell 有机会进入 Linux 发行版的标准组件，这会极大加速其成为事实标准。

### 6.5 对 NVIDIA 而言的风险

OpenShell 并非稳赢。有几个值得注意的风险：

- **alpha 阶段的不确定性**：目前仍是「single-player mode」，多租户、集群管理、生产级高可用都还在路上。企业大规模部署的时间表不确定。
- **竞争对手跟进**：如果 Agent 安全运行时被证明是真实需求，Anthropic（Claude Code 天然绑定）、OpenAI（Codex 天然绑定）或云厂商都可能推出更深度集成的方案。它们的优势在于 Agent 和 Runtime 可以一体化设计，省去适配成本。
- **开源 ≠ 控制**：Apache 2.0 意味着任何人都可以 fork。如果社区对 NVIDIA 主导的方向不满（比如推理路由器过度倾向于 NVIDIA 生态），fork 的成本很低。
- **企业采纳速度**：Agent 本身在企业生产环境中的渗透率还不够高。如果 Agent 出货量不及预期，Agent 安全运行时的市场规模也会相应缩小。

### 生态版图

<div class="table-wrap">
<table>
  <thead><tr><th>生态层</th><th>合作方</th></tr></thead>
  <tbody>
    <tr><td><strong>企业软件</strong></td><td>SAP、Salesforce、ServiceNow、Atlassian、Box、Adobe、Cadence、Siemens、Synopsys、Dassault Systèmes、Amdocs、Cohesity、IQVIA、Palantir</td></tr>
    <tr><td><strong>操作系统</strong></td><td>Canonical（Ubuntu Snap）、Red Hat（OpenShift AI）、Microsoft（Windows）、Dell（AI Factory）</td></tr>
    <tr><td><strong>Agent 工具</strong></td><td>Claude Code、OpenCode、Codex、GitHub Copilot CLI、OpenClaw、LangChain Deep Agents</td></tr>
    <tr><td><strong>安全</strong></td><td>CrowdStrike、Cisco AI Defense、Google、Microsoft Security、Trend Micro</td></tr>
    <tr><td><strong>推理基础设施</strong></td><td>Baseten、Bitdeer AI、CoreWeave、DeepInfra、Fireworks、Together AI</td></tr>
  </tbody>
</table>
</div>

## 七、结语

OpenShell 反映了一个趋势：**将安全控制从 Agent 内部逻辑转移到 Agent 的运行环境中**。它在内核级隔离之上叠加了策略引擎、凭据管理和推理路由，形成面向 Agent 工作负载的运行时约束层。

从技术角度看，几个设计选择值得关注：

- **Per-binary TOFU 网络策略**：安全粒度从容器级推进到进程级
- **Z3 形式化验证**：让策略评审从「人工检查」变为「自动证明 + 人工复核」
- **Agent 自主提案闭环**：被拦截后主动提策略变更，审批后自动重试
- **推理路由器**：屏蔽后端差异的同时确保凭据不落地

目前 OpenShell 仍处于 alpha 阶段（NVIDIA 称为「single-player mode」），但它的出现说明了一个方向：随着 Agent 从开发者的终端走向企业生产环境，运行时安全正在成为一个独立的基础设施层。

> **"企业软件产业将演进为专业化的 Agent 平台，而 IT 产业正准备迎接下一波巨大扩张。"**
> —— 黄仁勋，GTC 2026

GitHub: [https://github.com/NVIDIA/OpenShell](https://github.com/NVIDIA/OpenShell)

```bash
uv tool install -U openshell
openshell sandbox create --from openclaw
```

<div class="callout callout-amber">
  <div class="callout-label">备注</div>
  <p>本文基于截至 2026 年 7 月的公开资料和源码分析撰写。OpenShell 仍在快速迭代中。</p>
</div>
