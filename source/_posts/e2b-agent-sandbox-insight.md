---
title: E2B 深度洞察：AI Agent 代码执行沙箱的架构、战略与边界
date: 2026-07-29 10:00:00
tags: [AI, Agent, E2B, Sandbox, Firecracker, 安全, 架构, 开源]
categories: AI
description: 从源码出发，分析 AI Agent 代码执行沙箱 E2B 的五层架构、安全模型与战略逻辑
---

## 一、引言：当 AI Agent 需要「跑代码」

2026 年，AI Agent 正从对话界面走向自主行动。Manus 的通用任务 Agent 上线后快速突破千万用户；Perplexity 的购物 Agent 能跨站点比价、填写表单、完成支付；Cursor 的编码 Agent 在开发者终端中读写文件、安装依赖、执行测试——这些场景的共同点是：Agent 不再只是生成文本，而是**生成并执行代码**。

这引出一个基础但长期被忽视的问题：**这些由模型实时生成的代码，在哪里执行？**

直觉答案可能是「用户自己的机器」或「云端的某个容器」。但深入看，这两个答案都有问题。用户在本地执行 Agent 生成的 `curl | bash`——安全吗？通用容器平台（Docker、Kubernetes）在设计时从未考虑过「模型实时生成代码、毫秒级环境供给、单用户短生命周期」这种负载模式。

E2B 用 Firecracker microVM 回答了这个问题。这家由两个捷克发小于 2023 年在旧金山创立的公司，从做类 Devin Agent 的失败中转向，发现了一个被忽视的基础设施缺口：**AI Agent 需要专用执行沙箱**——不是通用容器，不是 Serverless 函数，而是一种为「模型生成代码」这个场景从头设计的轻量级隔离环境。

<div class="verdict">
  <p class="verdict-title">基本判断</p>
  <p>E2B 的定位不是「更好的 Docker」，也不是「更快的 Lambda」。它是在 AI Agent 技术栈中定义了一个新品类——<strong>代码执行沙箱（Code Execution Sandbox）</strong>，专门解决「模型实时生成的代码在哪里安全、快速地执行」这一问题。</p>
</div>

<div class="callout callout-amber">
  <div class="callout-label">核心术语速览（非专业读者可先读此节）</div>
  <p><strong>Firecracker</strong>：AWS 开源的轻量级虚拟机管理器（VMM），用 Rust 编写。E2B 用它为每个沙箱创建一个独立的 microVM，实现硬件级隔离。</p>
  <p><strong>microVM</strong>：极简虚拟机——只实现网络、块存储等最少设备，启动时间 &lt;125ms，内存开销 &lt;5MiB。介于容器（共享内核）和传统虚拟机（太重）之间的第三条路。</p>
  <p><strong>KVM</strong>（Kernel-based Virtual Machine）：Linux 内核的硬件虚拟化模块，利用 CPU 硬件扩展直接运行虚拟机代码。Firecracker 依赖 KVM 创建 microVM。</p>
  <p><strong>vsock</strong>（虚拟 socket）：基于 Linux AF_VSOCK 地址族的虚拟机-宿主机通信通道，不经过网络栈，无法被 iptables 拦截。E2B 用它实现沙箱内 envd 守护进程与宿主机之间的安全通信。</p>
  <p><strong>Nomad / Consul</strong>：HashiCorp 的集群调度器和服务发现工具。E2B 用 Nomad 负责在集群中选择合适节点创建沙箱，用 Consul 做服务注册和健康检查。</p>
</div>

## 二、为什么 AI Agent 需要专用执行沙箱

在 Docker 容器或 Kubernetes Pod 中执行 Agent 生成的代码，技术上完全可行。问题不在于「能不能」，而在于「设计目标是否匹配」。

<div class="callout callout-rose">
  <div class="callout-label">三大核心不匹配</div>
  <p><strong>① 负载模式不匹配：短生命周期 + 高并发 + 毫秒级启动</strong><br>
  Docker 容器设计时假设运行数小时到数月的服务。AI Agent 的代码执行模式是：用户发一条消息 → 模型生成代码 → 需要一个干净环境执行 → 执行完（通常几秒到几分钟）→ 销毁。这种「秒级创建、分钟级运行、即时销毁」的模式，Docker 能做，但设计目标不同——容器镜像拉取和网络初始化在秒级，而 Agent 场景需要毫秒级。</p>
  <p><strong>② 安全模型不匹配：代码来源不可信</strong><br>
  传统 CI/CD 管道的代码来自经过审查的 Git 仓库，有作者、有 PR、有测试覆盖。Agent 生成的代码来自概率模型——同一个 Prompt 在不同上下文下可能产生截然不同的代码。不可能对每次模型输出做安全审查。Docker 的默认 seccomp 配置文件允许 300+ 系统调用；共享宿主机内核意味着容器逃逸漏洞直接威胁整个节点。</p>
  <p><strong>③ 多租户粒度不匹配：单用户沙箱 ≠ 租户级隔离</strong><br>
  Kubernetes 的 namespace 隔离以「团队/服务」为粒度——一个 namespace 内多个 Pod 共享网络策略、配额和 RBAC 规则。AI Agent 场景下，每个终端用户都需要自己的隔离环境。将每个用户映射为一个 namespace 在管理上过于笨重，且用户数量可能远超 K8s 的设计假设。</p>
</div>

### 不同方案在 AI Agent 场景下的适用性

<div class="table-wrap">
<table>
  <thead><tr><th>方案</th><th>隔离级别</th><th>冷启动</th><th>单沙箱开销</th><th>为 Agent 场景设计</th></tr></thead>
  <tbody>
    <tr><td><strong>Docker</strong></td><td>容器（共享内核）</td><td>约 1-3s</td><td>约 10-50 MiB</td><td>否——通用容器运行时，默认 seccomp 允许 300+ 系统调用</td></tr>
    <tr><td><strong>Kubernetes</strong></td><td>Pod（容器 + 网络策略）</td><td>约 5-30s</td><td>高（控制面开销）</td><td>否——以「服务」为粒度设计，非单用户短生命周期</td></tr>
    <tr><td><strong>AWS Lambda</strong></td><td>Firecracker microVM</td><td>约 100-500ms（热启动），约 1-3s（冷）</td><td>函数粒度（单进程）</td><td>部分——隔离层到位，但执行模型是单函数、单事件，Agent 需要完整 Linux 环境</td></tr>
    <tr><td><strong>E2B</strong></td><td>Firecracker microVM（独立内核）</td><td>约 80ms</td><td>&lt;5 MiB</td><td>是——为「模型生成代码 + 完整 Linux 环境 + 毫秒级供给」设计</td></tr>
  </tbody>
</table>
</div>

关键差异在最后一行：Lambda 的 Firecracker 启动也快，但它是为「无状态函数」设计的——每次调用在同一个 microVM 中执行一段代码后立即冻结。Agent 需要的是**完整的 Linux 环境**——能装任意包、能跑后台进程、能在多次模型调用之间保持文件系统状态。E2B 提供的就是这个：一个完整的、短暂的、可编程的 Linux 机器。

## 三、行业全景：执行沙箱的品类定义与生态地图

在深入 E2B 的技术细节之前，需要先厘清一个容易混淆的概念：E2B 代表的「执行沙箱」和 OpenShell 代表的「治理运行时」是**两个不同品类**。把它们放在一起比较哪个更好，就像比较「车库的墙」和「车库的门锁」——它们解决的是不同层面的问题。

### 四层技术栈

<div class="stack-diagram">
  <div class="stack-row"><span class="stack-tag stack-tag-wide tag-agent">Agent</span><span class="stack-text">Claude Code · Cursor · Manus · Perplexity · Lindy · …</span></div>
  <div class="stack-row"><span class="stack-tag stack-tag-wide tag-govern">治理运行时</span><span class="stack-text">OpenShell → 代码能做什么（策略裁决、凭据管理、推理路由）</span></div>
  <div class="stack-row stack-row-hero"><span class="stack-tag stack-tag-wide tag-exec">执行沙箱</span><span class="stack-text">E2B · Daytona · CodeSandbox → 代码跑在哪（隔离环境供给、快照、API）</span></div>
  <div class="stack-row"><span class="stack-tag stack-tag-wide tag-infra">隔离层</span><span class="stack-text">Firecracker · gVisor · KVM · Docker · Kata Containers</span></div>
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
  background: linear-gradient(90deg, rgba(8,145,178,0.06) 0%, rgba(8,145,178,0.02) 100%);
  border-left: 3px solid #0891b2;
}
.stack-tag {
  flex-shrink: 0;
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-align: right;
}
.stack-tag-wide { width: 80px; }
.stack-tag-narrow { width: 56px; }
.stack-text { color: var(--text-soft); flex: 1; }
.tag-agent   { color: #4f46e5; }
.tag-govern  { color: #7c3aed; }
.tag-exec    { color: #0891b2; }
.tag-infra   { color: #64748b; }

:root[data-theme="dark"] .tag-agent   { color: #a5b4fc; }
:root[data-theme="dark"] .tag-govern  { color: #c4b5fd; }
:root[data-theme="dark"] .tag-exec    { color: #22d3ee; }
:root[data-theme="dark"] .tag-infra   { color: #a1a1aa; }
:root[data-theme="dark"] .stack-row-hero {
  background: linear-gradient(90deg, rgba(8,145,178,0.10) 0%, rgba(8,145,178,0.02) 100%);
  border-left-color: #22d3ee;
}
</style>

### 品类定义

<div class="verdict">
  <p class="verdict-title">品类定义</p>
  <p><strong>执行沙箱（Execution Sandbox）</strong>回答「代码跑在哪」——提供隔离环境、快速供给、文件系统快照和编程接口。E2B 的 Firecracker microVM 是企业级代表，Daytona 的 Docker 容器是开发者友好型代表。</p>
  <p><strong>治理运行时（Governance Runtime）</strong>回答「代码能做什么」——在已有隔离环境内部，对文件访问、网络请求、进程执行和推理调用进行逐次权限裁决。OpenShell 是这一品类的定义者。</p>
  <p>两者是<strong>分层叠加关系</strong>，不是竞争关系。E2B 提供隔离的「盒子」，OpenShell 定义盒子里的「规则」。企业生产环境中，理想配置是二者协同——用 E2B 的 Firecracker microVM 做物理隔离，用 OpenShell 做进程级策略治理。</p>
</div>

### 生态地图

<div class="table-wrap">
<table>
  <thead><tr><th>品类</th><th>代表项目</th><th>核心隔离技术</th><th>冷启动</th><th>开源</th><th>融资/动向</th></tr></thead>
  <tbody>
    <tr><td><strong>执行沙箱</strong></td><td>E2B</td><td>Firecracker microVM</td><td>约 80ms（官方数据）</td><td>Apache 2.0</td><td>$32-35M（Insight Partners 领投 A 轮）</td></tr>
    <tr><td><strong>执行沙箱</strong></td><td>Daytona</td><td>Docker 容器</td><td>&lt;90ms</td><td>AGPL</td><td>$31M</td></tr>
    <tr><td><strong>执行沙箱</strong></td><td>CodeSandbox</td><td>Firecracker microVM</td><td>约 500-921ms</td><td>闭源</td><td>被 Together AI 收购</td></tr>
    <tr><td><strong>执行沙箱</strong></td><td>Vercel Sandbox</td><td>Firecracker microVM</td><td>未公开</td><td>闭源</td><td>Vercel 平台内置</td></tr>
    <tr><td><strong>治理运行时</strong></td><td>OpenShell</td><td>依赖计算后端</td><td>取决于后端</td><td>Apache 2.0</td><td>NVIDIA + Cisco 联合发布（GTC 2026）</td></tr>
    <tr><td><strong>纯隔离层</strong></td><td>gVisor</td><td>用户态内核</td><td>约 100-150ms</td><td>Apache 2.0</td><td>Google 维护，GKE Sandbox 底层</td></tr>
  </tbody>
</table>
</div>

值得关注的是，四个执行沙箱中有三个选择了 Firecracker——这并非偶然。硬件虚拟化提供的独立内核在安全性和多租户隔离上，比容器方案高出一个量级。E2B 是这一路线最激进的商业化实践者。

## 四、深度分析

### 4.1 项目概览

<div class="table-wrap">
<table>
  <thead><tr><th>维度</th><th>信息</th></tr></thead>
  <tbody>
    <tr><td><strong>仓库</strong></td><td><a href="https://github.com/e2b-dev/e2b" target="_blank">e2b-dev/e2b</a>（主仓库，SDK + API）+ <a href="https://github.com/e2b-dev/infra" target="_blank">e2b-dev/infra</a>（基础设施仓库）</td></tr>
    <tr><td><strong>许可</strong></td><td>Apache 2.0</td></tr>
    <tr><td><strong>实现语言</strong></td><td>Go（编排层 + envd）+ Rust（Firecracker 相关）+ Python（SDK + API）+ TypeScript（SDK）</td></tr>
    <tr><td><strong>最新版本</strong></td><td>PyPI e2b==2.31.0（2026-07-17），npm e2b@2.19.4</td></tr>
    <tr><td><strong>社区规模</strong></td><td>约 13,000 Stars，infra 仓库 62 Contributors，7,077 commits</td></tr>
    <tr><td><strong>月 SDK 下载量</strong></td><td>3,500,000+（截至 2026.07）</td></tr>
    <tr><td><strong>累计沙箱启动</strong></td><td>1,000,000,000+（截至 2026.07）</td></tr>
    <tr><td><strong>企业采用</strong></td><td>据 E2B 官方数据，94% Fortune 100 企业有团队在评估或使用其产品（截至 2026.07）</td></tr>
    <tr><td><strong>融资</strong></td><td>$32-35M：Pre-seed $3M → Seed $11.5M（Decibel, 2024.10）→ Series A $21M（Insight Partners 领投, 2025.07）</td></tr>
    <tr><td><strong>创始人</strong></td><td>Vasek Mlejnsky (CEO) 和 Tomas Valenta (CTO)，捷克发小，2023 年在旧金山创立</td></tr>
  </tbody>
</table>
</div>

<div class="stats-grid">
  <div class="stat-card">
    <div class="stat-num">约 13K</div>
    <div class="stat-label">Stars（2026.07）</div>
  </div>
  <div class="stat-card">
    <div class="stat-num">62</div>
    <div class="stat-label">Contributors（infra 仓库）</div>
  </div>
  <div class="stat-card">
    <div class="stat-num">7,077</div>
    <div class="stat-label">Commits（infra 仓库）</div>
  </div>
  <div class="stat-card">
    <div class="stat-num">1B+</div>
    <div class="stat-label">累计沙箱启动</div>
  </div>
</div>

「Enterprise to Bot」——公司名的字面含义揭示了创始团队的判断：企业软件的消费主体将从人转向 AI Agent。这个判断驱动了所有技术决策：如果未来不是人类点击 SaaS 按钮，而是 Agent 调用 API 来操作一切，那么 Agent 就需要一个**安全、快速、可编程的执行环境**。

创始团队的起点颇有意思。GPT-3.5 发布后，他们尝试做一个类似 Devin 的编码 Agent，在开发过程中发现「让 Agent 生成的代码在安全环境中执行」这件事本身就是一个独立且足够大的问题。于是他们放弃 Agent 产品，转向 Agent 基础设施。这种「做 Agent 不成，转而做 Agent 需要的铲子」的 pivot 路径，与 NVIDIA 从 GPU 销售到 OpenShell 运行时的逻辑异曲同工。

### 4.2 五层架构全景

E2B 的架构是典型的「从 SDK 到硬件」的垂直整合，每一层有明确职责：

<div class="arch-grid">
  <div class="arch-card arch-sdk">
    <div class="arch-card-title">SDK 层</div>
    <div class="arch-card-items">Python SDK · TypeScript SDK</div>
    <div class="arch-card-desc">`Sandbox.create()` 一行创建沙箱，支持文件读写、进程执行、环境变量注入</div>
  </div>
  <div class="arch-card arch-gateway">
    <div class="arch-card-title">API Gateway 层</div>
    <div class="arch-card-items">HTTP/REST + WebSocket</div>
    <div class="arch-card-desc">认证、限流、沙箱生命周期管理、实时流式输出</div>
  </div>
  <div class="arch-card arch-orch">
    <div class="arch-card-title">Orchestrator 编排层</div>
    <div class="arch-card-items">Go 服务 · 沙箱调度 · 模板管理</div>
    <div class="arch-card-desc">接收创建请求 → 选择节点 → 加载模板 → 启动 Firecracker → 返回连接信息</div>
  </div>
  <div class="arch-card arch-nomad">
    <div class="arch-card-title">资源调度层</div>
    <div class="arch-card-items">Nomad · Consul</div>
    <div class="arch-card-desc">集群管理、节点发现、工作负载调度、健康检查</div>
  </div>
  <div class="arch-card arch-vm">
    <div class="arch-card-title">虚拟化层</div>
    <div class="arch-card-items">Firecracker microVM · KVM</div>
    <div class="arch-card-desc">硬件虚拟化隔离、独立 Linux 内核、&lt;5MiB 内存开销、约 80ms 冷启动（官方数据）</div>
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
.arch-sdk     { border-left-color: #6366f1; } .arch-sdk     .arch-card-title { color: #4f46e5; }
.arch-gateway { border-left-color: #7c3aed; } .arch-gateway .arch-card-title { color: #7c3aed; }
.arch-orch    { border-left-color: #f97316; } .arch-orch    .arch-card-title { color: #ea580c; }
.arch-nomad   { border-left-color: #0891b2; } .arch-nomad   .arch-card-title { color: #0891b2; }
.arch-vm      { border-left-color: #16a34a; } .arch-vm      .arch-card-title { color: #16a34a; }

:root[data-theme="dark"] .arch-sdk     .arch-card-title { color: #a5b4fc; }
:root[data-theme="dark"] .arch-gateway .arch-card-title { color: #c4b5fd; }
:root[data-theme="dark"] .arch-orch    .arch-card-title { color: #fb923c; }
:root[data-theme="dark"] .arch-nomad   .arch-card-title { color: #22d3ee; }
:root[data-theme="dark"] .arch-vm      .arch-card-title { color: #4ade80; }
:root[data-theme="dark"] .arch-sdk     { border-left-color: #a5b4fc; }
:root[data-theme="dark"] .arch-gateway { border-left-color: #c4b5fd; }
:root[data-theme="dark"] .arch-orch    { border-left-color: #fb923c; }
:root[data-theme="dark"] .arch-nomad   { border-left-color: #22d3ee; }
:root[data-theme="dark"] .arch-vm      { border-left-color: #4ade80; }
</style>

#### 沙箱创建完整链路

<div class="growth-chart">
  <img src="create-flow.svg" alt="E2B 沙箱创建全链路：SDK → API → Orchestrator → Nomad → Firecracker → vsock → envd" style="width:100%">
</div>

<div class="phase-card">
  <h4>沙箱创建：从 SDK 调用到 microVM 就绪</h4>
  <p>① <strong>SDK 发起请求</strong>：用户调用 <code>Sandbox.create(template="base")</code>，SDK 将请求序列化为 HTTP POST 发送到 API Gateway。</p>
  <p>② <strong>Gateway 鉴权与路由</strong>：验证 API Key、检查配额、根据模板类型和区域路由到对应的 Orchestrator 实例。</p>
  <p>③ <strong>Orchestrator 调度</strong>：查询 Consul 获取可用节点列表 → 根据资源水位选择最优节点 → 通过 Nomad 提交 Firecracker 启动任务。</p>
  <p>④ <strong>Firecracker 启动</strong>：Nomad 在目标节点上调用 firecracker-containerd → 加载预热的 Linux kernel + rootfs 模板 → KVM 创建虚拟机 → 内核启动 → envd 守护进程初始化（约 80ms 总耗时）。</p>
  <p>⑤ <strong>连接信息返回</strong>：Orchestrator 获取 microVM 的 vsock CID 和 envd 端口 → 封装为沙箱连接对象 → 通过 Gateway 返回给 SDK → SDK 建立 WebSocket 连接，沙箱就绪。</p>
</div>

冷启动约 80ms 这个数字是整个系统的核心性能指标（官方文档数据，第三方 benchmark 通常在 100-150ms 范围）。对比 Docker 容器的 1-3 秒，Firecracker microVM 的 125ms 更接近，但 E2B 通过模板预热机制将包含模板加载和 envd 初始化的总冷启动压缩到了约 80ms——用户几乎感知不到等待——这对于「用户输入 → Agent 生成代码 → 沙箱执行 → 结果返回」的交互闭环至关重要。

### 4.3 五层安全模型

AI Agent 代码执行的安全风险有一层特殊的维度：**代码作者是概率模型，而非人类工程师**。这意味着代码审查、静态分析、签名验证这些传统安全手段全部失效。E2B 的安全策略是在隔离层面「纵深防御」，让攻击者即使控制了沙箱内部的 root 权限，也难以突破到底层基础设施。

<div class="growth-chart">
  <img src="security-model.svg" alt="E2B 五层纵深防御：网络隔离 → 设备最小化 → seccomp-bpf → cgroup+memguard → Firecracker Jailer" style="width:100%">
</div>

<div class="arch-grid">
  <div class="arch-card arch-s1">
    <div class="arch-card-title">第一层 · KVM 硬件虚拟化</div>
    <div class="arch-card-items">独立内核 · 独立地址空间</div>
    <div class="arch-card-desc">每个沙箱运行在独立 Firecracker microVM 中，拥有自己的 Linux 内核。即使沙箱内拿到 root，也无法访问宿主机内核或内存——这由 CPU 硬件保证，非软件策略。</div>
  </div>
  <div class="arch-card arch-s2">
    <div class="arch-card-title">第二层 · Jailer 进程沙箱</div>
    <div class="arch-card-items">chroot · cgroup · namespace 隔离</div>
    <div class="arch-card-desc">每个 Firecracker 进程自身被 Jailer 约束在独立的 chroot 环境、cgroup 组和命名空间中。即使 Firecracker 进程存在漏洞被利用，攻击者也受限于 Jailer 创建的边界。</div>
  </div>
  <div class="arch-card arch-s3">
    <div class="arch-card-title">第三层 · seccomp-bpf 系统调用过滤</div>
    <div class="arch-card-items">三级过滤策略 · 最小集白名单</div>
    <div class="arch-card-desc">基本允许集（约 40 个核心调用）+ 条件允许集（需特定参数值）+ 默认拒绝。mount、kexec_load、bpf、perf_event_open 等高风险调用全部禁用。</div>
  </div>
  <div class="arch-card arch-s4">
    <div class="arch-card-title">第四层 · 最小设备面</div>
    <div class="arch-card-items">仅 5 个模拟设备</div>
    <div class="arch-card-desc">virtio-blk（块存储）、virtio-net（网络）、virtio-vsock（宿主机通信）、virtio-rng（熵源）、串口控制台。没有 GPU、USB、声卡等复杂设备驱动——驱动越少，攻击面越小。</div>
  </div>
  <div class="arch-card arch-s5">
    <div class="arch-card-title">第五层 · 网络隔离</div>
    <div class="arch-card-items">独立 TAP · 独立子网 · 网络层 allow/deny 列表</div>
    <div class="arch-card-desc">每个 microVM 拥有独立的 TAP 网络接口和 /30 子网。出站流量经网络层 allow/deny 列表控制——支持 IP 地址、CIDR 块、域名和通配符域名，在模板配置中声明允许或拒绝的目标地址。</div>
  </div>
</div>

<style>
.arch-s1 { border-left-color: #ef4444; } .arch-s1 .arch-card-title { color: #dc2626; }
.arch-s2 { border-left-color: #f97316; } .arch-s2 .arch-card-title { color: #ea580c; }
.arch-s3 { border-left-color: #d97706; } .arch-s3 .arch-card-title { color: #b45309; }
.arch-s4 { border-left-color: #16a34a; } .arch-s4 .arch-card-title { color: #16a34a; }
.arch-s5 { border-left-color: #0891b2; } .arch-s5 .arch-card-title { color: #0891b2; }

:root[data-theme="dark"] .arch-s1 .arch-card-title { color: #f87171; }
:root[data-theme="dark"] .arch-s2 .arch-card-title { color: #fb923c; }
:root[data-theme="dark"] .arch-s3 .arch-card-title { color: #fbbf24; }
:root[data-theme="dark"] .arch-s4 .arch-card-title { color: #4ade80; }
:root[data-theme="dark"] .arch-s5 .arch-card-title { color: #22d3ee; }
:root[data-theme="dark"] .arch-s1 { border-left-color: #f87171; }
:root[data-theme="dark"] .arch-s2 { border-left-color: #fb923c; }
:root[data-theme="dark"] .arch-s3 { border-left-color: #fbbf24; }
:root[data-theme="dark"] .arch-s4 { border-left-color: #4ade80; }
:root[data-theme="dark"] .arch-s5 { border-left-color: #22d3ee; }
</style>

#### 与 OpenShell 安全模型的对比

两种安全哲学有根本差异：

<div class="table-wrap">
<table>
  <thead><tr><th>维度</th><th>E2B 安全模型</th><th>OpenShell 安全模型</th></tr></thead>
  <tbody>
    <tr><td><strong>安全哲学</strong></td><td>「墙足够厚，不在里面管你」——物理隔离为第一性，默认假设沙箱内部是危险的</td><td>「墙可以是租的，但每扇门由我控制」——策略治理为第一性，对沙箱内每个操作裁决</td></tr>
    <tr><td><strong>隔离方式</strong></td><td>KVM 硬件虚拟化（独立内核）</td><td>依赖计算后端（Docker / MicroVM），不提供隔离层</td></tr>
    <tr><td><strong>文件系统控制</strong></td><td>模板定义 rootfs，沙箱内可任意读写（不影响宿主机）</td><td>Landlock LSM + 声明式路径白名单，逐读写操作裁决</td></tr>
    <tr><td><strong>网络控制</strong></td><td>Allow/deny 列表（IP/CIDR/域名/通配符）</td><td>OPA 引擎逐连接裁决 + Per-binary TOFU + L7 路径匹配</td></tr>
    <tr><td><strong>凭据管理</strong></td><td>环境变量注入沙箱（沙箱内可见）</td><td>inference.local 代理注入（沙箱不可见真实凭据）</td></tr>
    <tr><td><strong>策略变更</strong></td><td>修改模板 → 重建沙箱（静态）</td><td>OPA 热加载（动态，无需重建沙箱）</td></tr>
    <tr><td><strong>攻击面</strong></td><td>Firecracker VMM 漏洞（极窄）+ virtio 驱动（仅 5 个）</td><td>Landlock 内核实现漏洞 + Supervisor 自身安全</td></tr>
  </tbody>
</table>
</div>

<div class="verdict">
  <p class="verdict-title">E2B 的安全哲学 vs OpenShell 的安全哲学</p>
  <p><strong>E2B</strong> 的安全思路是<strong>物理隔离优先</strong>——用硬件虚拟化创造尽可能厚的墙，墙内自由度高但墙的厚度由 KVM 保证。优势是安全边界清晰、攻击面小、不依赖沙箱内部进程协作；劣势是「墙内发生什么」缺乏细粒度可见性——Agent 删除文件、修改配置、访问异常域名，这些行为在 microVM 内部完全自由。</p>
  <p><strong>OpenShell</strong> 的安全思路是<strong>逻辑治理优先</strong>——不关心墙多厚（反正可以租），而是对墙内每一次操作进行实时裁决。优势是行为可见性极高、策略动态可调；劣势是依赖沙箱内 Supervisor 进程正常运转——Supervisor 自身如果被绕过或终止，策略层就失效了。</p>
  <p>两者的组合是<strong>纵深防御的理想形态</strong>：E2B 的 KVM 阻止攻击者触碰宿主机，OpenShell 的 OPA 阻止 Agent 访问不该访问的目标。</p>
</div>

### 4.4 envd 守护进程：沙箱内部的关键机制

每个 E2B 沙箱内部运行着一个名为 **envd**（Environment Daemon）的守护进程。它是外部 SDK 与沙箱内部之间的桥接器——所有的文件读写、进程执行、环境变量注入，都通过 envd 完成。

#### vsock 通信：绕过网络栈的宿主机通信

<div class="phase-card">
  <h4>vsock（Virtual Socket）通信机制</h4>
  <p>传统方案中，如果要从宿主机向虚拟机内的服务发起连接，需要配置 TAP 网络接口、分配 IP、设置 NAT 或端口转发——每创建一个 microVM 就要做一次网络配置。E2B 使用 <strong>vsock</strong> 替代 TCP/IP：vsock 是 KVM 提供的虚拟机与宿主机之间的专用通信通道，不经过网络栈，不占用 IP 地址，不涉及 iptables 规则。</p>
  <p>在 Firecracker 启动时，通过命令行参数映射宿主机上的一个 AF_VSOCK 套接字到客户机内的 /dev/vsock。envd 在客户机内监听 CID 为 2（宿主机）的连接请求。Orchestrator 则通过宿主机侧的 AF_VSOCK 套接字向 envd 发送命令。</p>
  <p>vsock 的另一个优势是<strong>零网络配置</strong>——每创建一个新的 microVM，不需要分配 IP、不需要更新路由表。CID 是自动分配的，天然隔离。</p>
</div>

#### 双通道认证

<div class="phase-card">
  <h4>MMDS Token + 连接握手</h4>
  <p>envd 启动后，首先通过 <strong>MMDS</strong>（MicroVM Metadata Service，Firecracker 内置的元数据服务，通过 /dev/vsock 在客户机内可达的 HTTP 接口）获取一个一次性认证令牌。MMDS 的数据在 microVM 启动前由 Orchestrator 写入 Firecracker API，在客户机内只读——这意味着只有合法的 microVM 能拿到有效令牌。</p>
  <p>同时，Orchestrator 通过 Firecracker API 将同一个令牌写入宿主机侧的沙箱记录。当 SDK 的 WebSocket 连接到达 Orchestrator 并请求路由到 envd 时，<strong>双端比对令牌</strong>——只有令牌完全匹配，连接才被建立。这防止了 SDk 连接到错误的沙箱，或攻击者伪造沙箱请求。</p>
</div>

#### Cgroup v2 资源隔离

<div class="phase-card">
  <h4>CPU、内存、IO 三重限制</h4>
  <p>envd 在启动时，通过写入 /sys/fs/cgroup/ 下的 Cgroup v2 文件系统，对自身及其所有子进程施加资源限制：</p>
  <p>① <strong>CPU</strong>：<code>cpu.max</code> 写入配额（如 <code>50000 100000</code> 表示每 100ms 可用 50ms CPU 时间），确保一个沙箱的 CPU 密集型任务不影响同节点其他沙箱。</p>
  <p>② <strong>内存</strong>：<code>memory.max</code> 写入上限（如 <code>536870912</code> 即 512MiB），<code>memory.high</code> 写入软限制（达到后内核开始节制分配但不立即 OOM Kill）。</p>
  <p>③ <strong>IO</strong>：通过 <code>io.max</code> 限制块设备读写速率，防止一个沙箱的磁盘 IO 拖慢节点。</p>
</div>

#### memguard：密钥内存保护

<div class="phase-card">
  <h4>memguard 加密内存页</h4>
  <p>即使沙箱内没有进程主动扫描内存，也可能通过 core dump、调试器附着或 /proc/pid/mem 读取到 envd 内存中的敏感数据（如用户通过环境变量传入的 API Key）。</p>
  <p>envd 使用 Go 的 <strong>memguard</strong> 库（github.com/awnumar/memguard）来保护内存中的密钥数据：</p>
  <p>① 密钥存储在被 <code>mlock()</code> 锁定的内存页中，防止被交换到磁盘（swap）</p>
  <p>② 内存页在释放前用随机数据覆写（而非依赖 GC）</p>
  <p>③ 密钥数据在可枚举缓冲区中的存活时间尽可能短——使用完立即释放</p>
</div>

#### envd 启动流程

<div class="workflow">
  <div class="workflow-step mandatory">
    <div class="step-num">1</div>
    <div class="step-cmd">Kernel Boot</div>
    <div class="step-desc">Firecracker 加载 Linux kernel 和 rootfs 镜像，内核启动完毕。</div>
  </div>
  <div class="workflow-step mandatory">
    <div class="step-num">2</div>
    <div class="step-cmd">envd 作为 init 进程启动</div>
    <div class="step-desc">envd 被指定为 microVM 的 init 进程（PID 1），替代传统的 /sbin/init。它负责启动系统服务、设置 cgroup、应用安全策略。</div>
  </div>
  <div class="workflow-step mandatory">
    <div class="step-num">3</div>
    <div class="step-cmd">MMDS Token 获取</div>
    <div class="step-desc">envd 通过 MMDS HTTP 端点（169.254.169.254）获取认证令牌和环境配置（沙箱 ID、资源配额、网络白名单）。</div>
  </div>
  <div class="workflow-step mandatory">
    <div class="step-num">4</div>
    <div class="step-cmd">Cgroup 配置</div>
    <div class="step-desc">envd 根据 MMDS 中获取的配额参数，向 /sys/fs/cgroup/ 写入 CPU、内存、IO 限制。</div>
  </div>
  <div class="workflow-step mandatory">
    <div class="step-num">5</div>
    <div class="step-cmd">DNS + 网络就绪</div>
    <div class="step-desc">envd 配置 /etc/resolv.conf，启动 网络层 allow/deny 列表代理，验证网络连通性。</div>
  </div>
  <div class="workflow-step mandatory">
    <div class="step-num">6</div>
    <div class="step-cmd">就绪信号</div>
    <div class="step-desc">envd 向 Orchestrator 发送「就绪」信号（通过 vsock）。Orchestrator 将沙箱标记为 ACTIVE，返回连接信息给 SDK。从内核启动到 envd 就绪的总时长约 80ms（官方数据，依赖模板预热缓存）。</div>
  </div>
</div>



#### 沙箱生命周期与 auto-resume

E2B 的沙箱状态机包含四个核心状态：

<div class="phase-card">
  <h4>沙箱状态机</h4>
  <p>① <strong>Running → Paused</strong>：调用 <code>sandbox.pause()</code> 或沙箱连续运行达到超时上限（Hobby 1h / Pro 24h）。暂停时保存完整文件系统 + 内存状态（包括所有运行中的进程和变量）。</p>
  <p>② <strong>Paused → Running</strong>：调用 <code>sandbox.connect()</code> 或通过 <strong>auto-resume</strong> 机制——暂停后的沙箱在接收到任何活动（commands.run、files.read/write、HTTP 请求）时自动恢复，恢复后最小 timeout 为 5 分钟。</p>
  <p>③ <strong>Running/Paused → Killed</strong>：显式调用 <code>sandbox.kill()</code>，释放所有资源。沙箱数据随之销毁——但可通过 snapshots、fork 或 volumes 提前留存。</p>
  <p>④ <strong>Running → Snapshotting → Running</strong>：创建快照时沙箱短暂暂停（保存文件系统 + 内存状态到时间点快照），完成后自动恢复运行。快照可用于后续创建新沙箱（one-to-many）。</p>
</div>

Auto-resume 是 E2B 对 Agent 场景的独特优化：Agent 不必关心沙箱是否暂停——发请求就自动恢复，节省了轮询状态和手动重连的代码。配合 pause 后计时重置的规则，Agent 可以突破连续运行时长上限（Hobby 1h / Pro 24h），通过「运行 N 小时 → pause → resume」的方式实现事实上的无限运行。

#### 资源配置示例

E2B 的模板通过 **fluent API（Template Builder）** 定义，而非传统的配置文件。资源字段为 `cpuCount` 和 `memoryMB`（单位 MiB）：

```python
# Python SDK — 模板构建示例
from e2b import Template, default_build_logger

Template.build(
    template,
    'python-research-agent',
    cpu_count=4,
    memory_mb=4096,
    on_build_logs=default_build_logger(),
)
```

```javascript
// JavaScript/TypeScript SDK
import { Template, defaultBuildLogger } from 'e2b'

await Template.build(template, 'my-template', {
  cpuCount: 8,
  memoryMB: 4096,
  onBuildLogs: defaultBuildLogger(),
})
```

模板定义通过 Dockerfile 指定基础环境（基础镜像、依赖安装），构建时提取文件系统并转换为 Firecracker 兼容的 ext4 镜像，推送到模板仓库。Orchestrator 在创建沙箱时根据模板 ID 拉取对应的 kernel + rootfs 组合，传入 Firecracker 启动。

### 4.5 模板系统与开发者体验

E2B 的模板系统是其开发者体验的核心。与 Docker 的 `Dockerfile` + 镜像仓库模型类似，但针对 Firecracker microVM 做了适配。

#### Python SDK 创建沙箱的完整流程

```python
from e2b import Sandbox

# 1. 创建沙箱（使用预定义模板）
sandbox = Sandbox.create(template="python-research-agent", timeout=300)

# 2. 在沙箱中执行代码
execution = sandbox.commands.run(
    cmd="python -c 'import numpy; print(numpy.__version__)'",
    on_stdout=lambda line: print(f"[stdout] {line}"),
    on_stderr=lambda line: print(f"[stderr] {line}"),
)
print(f"Exit code: {execution.exit_code}")

# 3. 读写文件
sandbox.filesystem.write("/workspace/data.csv", csv_content)
content = sandbox.filesystem.read("/workspace/result.json")

# 4. 设置环境变量（仅当前沙箱生命周期内有效）
sandbox.envs.set("DEBUG", "true")

# 5. 流式执行长时间命令（如训练脚本）
process = sandbox.commands.run(
    cmd="python train.py --epochs 10",
    background=True  # 后台执行，不阻塞
)
# 检查进程状态
status = sandbox.commands.get(process.pid)
print(f"Process status: {status}")

# 6. 沙箱使用完毕，显式销毁（或依赖超时自动销毁）
sandbox.kill()
```

关键设计选择：
- **同步 vs 异步**：`Sandbox.create()` 是同步的——等待 约 80ms 后返回可用的沙箱对象。这种等待在 AI Agent 场景中可接受，因为模型生成代码的时间通常远超 150ms。
- **沙箱作为对象**：沙箱的生命周期与 `sandbox` 对象绑定。`kill()` 调用释放资源；若客户端断开连接且未显式 `kill()`，则由 timeout 机制自动回收。
- **on_stdout/on_stderr 回调**：支持流式输出。Agent 可以边执行边读取输出，效率远超「执行完一次性返回所有结果」。

#### 模板构建流程

<div class="workflow">
  <div class="workflow-step mandatory">
    <div class="step-num">1</div>
    <div class="step-cmd">模板构建流程</div>
    <div class="step-desc">用户通过 Template fluent API 定义沙箱环境，指定基础 Docker 镜像、cpuCount、memoryMB、预载命令。</div>
  </div>
  <div class="workflow-step mandatory">
    <div class="step-num">2</div>
    <div class="step-cmd">Docker Build</div>
    <div class="step-desc">E2B 根据模板定义启动构建容器，执行 Dockerfile 指令，安装指定依赖。</div>
  </div>
  <div class="workflow-step mandatory">
    <div class="step-num">3</div>
    <div class="step-cmd">Rootfs 提取</div>
    <div class="step-desc">从 Docker 镜像中提取文件系统层，合并为一个完整的 rootfs 目录树。</div>
  </div>
  <div class="workflow-step mandatory">
    <div class="step-num">4</div>
    <div class="step-cmd">Ext4 镜像构建</div>
    <div class="step-desc">使用 mkfs.ext4 将 rootfs 打包为 ext4 文件系统镜像。Firecracker 通过 virtio-blk 直接挂载 ext4 镜像作为根文件系统，无需联合文件系统层（OverlayFS）。</div>
  </div>
  <div class="workflow-step mandatory">
    <div class="step-num">5</div>
    <div class="step-cmd">推送 + 缓存</div>
    <div class="step-desc">kernel + rootfs 镜像推送到模板仓库。Orchestrator 集群中的节点按需拉取并缓存——高频模板在节点本地缓存命中，避免每次沙箱创建都从远程拉取。</div>
  </div>
</div>

模板构建的巧妙之处在于**复用 Docker 生态**——用户用熟悉的 Dockerfile 语法和 `apt-get install`/`pip install` 来定义环境，E2B 在后台将 Docker 镜像转换为 Firecracker microVM 所需的 ext4 格式。这降低了从「在 Docker 里跑 Agent 代码」迁移到「在 E2B 沙箱里跑 Agent 代码」的认知成本。

### 4.6 企业级能力：SOC 2、HIPAA 与 BYOC

E2B 虽然是开源项目，但其商业模式是 SaaS + 企业许可。面向企业客户，它在合规和部署灵活性上做了大量投入。

**合规认证**：E2B 已获得 SOC 2 Type II 认证、HIPAA 合规认证，并签署了 BAA（Business Associate Agreement，HIPAA 下与医疗相关方的数据处理协议）。这使其能进入对合规要求最严格的两个行业——金融（SOC 2）和医疗（HIPAA）。

**BYOC（Bring Your Own Cloud）**：E2B 支持将沙箱基础设施部署在客户自己的 AWS 或 GCP 账号中。控制平面（API Gateway、Orchestrator）由 E2B 管理，数据平面（Nomad 节点、Firecracker 虚拟机）运行在客户的 VPC 内。代码和数据不离开客户的云环境。

<div class="callout callout-amber">
  <div class="callout-label">BYOC 的客观评估</div>
  <p><strong>① 优势</strong>：数据驻留合规——满足 GDPR、HIPAA 等数据本地化要求；网络延迟优化——沙箱运行在客户 VPC 内，访问客户内部 API 的延迟远低于经 E2B 托管环境中转。</p>
  <p><strong>② 代价</strong>：运维复杂度——客户需要管理计算节点、监控资源水位、处理节点故障；成本不透明——基础设施费用（EC2 实例、EBS 存储、跨 AZ 流量）由客户直接承担，加上 E2B 的控制平面许可费，总成本可能高于纯托管方案。</p>
  <p><strong>③ 适用场景</strong>：受监管行业（金融、医疗、国防）、已有大量 AWS/GCP 预留实例的企业、需要沙箱与内部系统直连的场景。</p>
</div>

#### 三种部署方案对比

<div class="table-wrap">
<table>
  <thead><tr><th>维度</th><th>E2B 托管云</th><th>BYOC（客户云）</th><th>完全自建</th></tr></thead>
  <tbody>
    <tr><td><strong>控制平面</strong></td><td>E2B 管理</td><td>E2B 管理（独立实例）</td><td>自己管理（开源组件）</td></tr>
    <tr><td><strong>数据平面</strong></td><td>E2B 管理</td><td>客户管理（VPC 内）</td><td>自己管理</td></tr>
    <tr><td><strong>数据驻留</strong></td><td>E2B 选择区域</td><td>客户选择区域</td><td>客户选择区域</td></tr>
    <tr><td><strong>合规认证</strong></td><td>SOC 2 + HIPAA（平台级）</td><td>平台 SOC 2 + 客户自有环境认证</td><td>需自行获取</td></tr>
    <tr><td><strong>运维负担</strong></td><td>零</td><td>中等（节点管理、监控）</td><td>高（全栈运维）</td></tr>
    <tr><td><strong>成本结构</strong></td><td>订阅 + 用量（按 vCPU-h + GiB-h）</td><td>许可费 + 自有云成本</td><td>自有基础设施 + 人力</td></tr>
    <tr><td><strong>适用规模</strong></td><td>中小团队、快速验证</td><td>中大型企业、有合规需求</td><td>超大规模、有定制需求</td></tr>
  </tbody>
</table>
</div>

**定价**：E2B 提供三层计划（截至 2026.07）：

<div class="table-wrap">
<table>
  <thead><tr><th>特性</th><th>Hobby</th><th>Pro</th><th>Enterprise</th></tr></thead>
  <tbody>
    <tr><td><strong>基础价格</strong></td><td>$0/月</td><td>$150/月</td><td>定制</td></tr>
    <tr><td><strong>免费额度</strong></td><td>$100 一次性赠送</td><td>—</td><td>定制</td></tr>
    <tr><td><strong>最大 vCPU</strong></td><td>8</td><td>8+</td><td>定制</td></tr>
    <tr><td><strong>最大内存</strong></td><td>8 GB</td><td>8+ GB</td><td>定制</td></tr>
    <tr><td><strong>磁盘</strong></td><td>10 GB</td><td>20+ GB</td><td>定制</td></tr>
    <tr><td><strong>最大连续运行</strong></td><td>1 小时</td><td>24 小时</td><td>定制</td></tr>
    <tr><td><strong>并发沙箱</strong></td><td>20</td><td>100–1,100</td><td>1,100+</td></tr>
    <tr><td><strong>沙箱创建速率</strong></td><td>1/秒</td><td>5/秒</td><td>定制</td></tr>
  </tbody>
</table>
</div>

用量计费按秒计算：$0.0504/vCPU-h + $0.0162/GiB-h。按典型 Agent 场景——每天 8 小时、2 vCPU、1 GiB 内存——月用量成本约 $24.19 + $3.89 ≈ $28/月（Hobby 免平台费）。这个价格点对于个人开发者几乎零门槛（$100 免费额度足够验证概念），对于企业 Pro 计划则在可接受范围。

## 五、竞品对比：执行沙箱品类内的较量

把 E2B 放在执行沙箱品类内对比，能看到各自的护城河和短板。

<div class="table-wrap">
<table>
  <thead><tr><th>维度</th><th>E2B</th><th>Daytona</th><th>CodeSandbox</th><th>Vercel Sandbox</th><th>AWS Lambda</th></tr></thead>
  <tbody>
    <tr><td><strong>隔离机制</strong></td><td>Firecracker microVM（独立内核）</td><td>Docker 容器（共享内核）</td><td>Firecracker microVM（独立内核）</td><td>Firecracker microVM</td><td>Firecracker microVM</td></tr>
    <tr><td><strong>冷启动</strong></td><td>约 80ms（模板预热）</td><td>&lt;90ms</td><td>~921ms（fork）/ ~500ms（hibernate）</td><td>未公开</td><td>~100-500ms（热）/ ~1-3s（冷）</td></tr>
    <tr><td><strong>SDK 语言</strong></td><td>Python + TypeScript（2 种）</td><td>Python、TS、Go、Rust、Java（5 种）</td><td>JavaScript/TypeScript（1 种）</td><td>TypeScript（1 种）</td><td>多语言（Runtime API）</td></tr>
    <tr><td><strong>完整 Linux 环境</strong></td><td>是——完整的 rootfs，可安装任意包</td><td>是——容器内完整 Linux</td><td>是——类 Linux VM</td><td>受限——Node.js 为主的运行时</td><td>否——单函数执行模型，无持久文件系统</td></tr>
    <tr><td><strong>GPU 支持</strong></td><td>否（架构上可行，未产品化）</td><td>是（通过 PCI 直通）</td><td>否</td><td>否</td><td>否（有单独的 GPU Lambda，但非此品类）</td></tr>
    <tr><td><strong>持久化存储</strong></td><td>Pause/Resume（保存完整内存+文件系统状态）+ Snapshots（时间点快照）+ Fork（克隆运行中沙箱）+ Volumes（持久存储卷，beta）</td><td>持久化工作区（volume）</td><td>Fork（~921ms）+ Hibernate（~500ms 恢复）</td><td>有限（session 级）</td><td>无——/tmp 仅 512MB</td></tr>
    <tr><td><strong>网络控制</strong></td><td>Allow/deny 列表（支持 IP、CIDR、域名、通配符域名）</td><td>iptables 沙箱级过滤</td><td>未公开</td><td>未公开</td><td>VPC 内（需配置）</td></tr>
    <tr><td><strong>Fork 能力</strong></td><td>支持（单次最多 100 副本，实时克隆运行中沙箱）</td><td>不支持</td><td>支持（~921ms fork + hibernate）</td><td>不支持</td><td>不支持</td></tr>
    <tr><td><strong>开源许可</strong></td><td>Apache 2.0</td><td>AGPL</td><td>闭源</td><td>闭源</td><td>闭源（Firecracker 本身开源）</td></tr>
    <tr><td><strong>合规认证</strong></td><td>SOC 2 Type II、HIPAA、BAA</td><td>未公开</td><td>未公开</td><td>未公开</td><td>SOC、HIPAA、PCI-DSS、FedRAMP</td></tr>
    <tr><td><strong>定价模式</strong></td><td>订阅 + vCPU-h/GiB-h 用量</td><td>免费（自托管）/ SaaS 定价未公开</td><td>包月订阅（团队 $29-119/月）</td><td>Active CPU 计费（I/O 等待免费，省 约 95%）</td><td>$0.20/1M 请求 + GB-秒</td></tr>
    <tr><td><strong>沙箱内进程级策略</strong></td><td>否——沙箱内自由度高</td><td>否</td><td>否</td><td>否</td><td>否（函数模型本身的限制即策略）</td></tr>
  </tbody>
</table>
</div>

<div class="verdict">
  <p class="verdict-title">E2B 的护城河不在单一指标</p>
  <p>逐一对比每个指标，E2B 并不在每个维度上领先：Daytona 的冷启动宣称更快（&lt;90ms vs 约 80ms），但隔离级别不同、SDK 更丰富（5 vs 2 种语言）；AWS Lambda 的合规认证更全面；Vercel Sandbox 的计费模型更有成本优势（I/O 等待不计费）。</p>
  <p>E2B 的护城河是<strong>三项能力的组合</strong>，目前没有竞品同时具备：<strong>硬件级隔离（Firecracker） + 完整 Linux 环境 + 企业合规认证</strong>。Daytona 有完整 Linux 环境但缺硬件隔离；Lambda 有硬件隔离但缺完整 Linux 环境；CodeSandbox 有硬件隔离和完整环境但缺企业合规（闭源 + 被收购后走向不确定）。</p>
  <p>换句话说，任何一个竞品要覆盖 E2B 的护城河，至少需要迁移隔离层或补齐合规认证——两者都不是短期能完成的工作。</p>
</div>

## 六、战略分析：从单品到基础设施的升维

E2B 的商业逻辑层层递进，每一层解决上一层的天花板问题。

### 第一层：沙箱即服务（Sandbox as a Service）

<div class="phase-card">
  <h4>当前阶段的核心业务</h4>
  <p>通过 Python/TypeScript SDK 提供「一行代码创建沙箱」的能力。客户是 AI Agent 开发者——Manus 需要沙箱让 Agent 写代码、Perplexity 需要沙箱让购物 Agent 执行浏览器操作、Cursor 需要沙箱让编码 Agent 安全安装依赖。</p>
  <p>这一层的收入来源是 SaaS 订阅 + 用量计费。天花板是 AI Agent 市场的规模——如果 Agent 应用没有爆发，E2B 的增长也会受限。</p>
</div>

### 第二层：AI Agent 专用基础镜像市场

<div class="phase-card">
  <h4>从沙箱供给到环境标准化</h4>
  <p>模板系统（Docker → ext4 转换 + fluent API）正在走向一个类 Docker Hub 的模式：社区贡献针对特定 Agent 场景的预配置模板（「Python 数据分析 Agent」「浏览器操作 Agent」「金融建模 Agent」）。</p>
  <p>如果 E2B 成功成为 Agent 执行环境的事实分发渠道，它的位置类似于 npm 对 Node.js 生态的意义——不是唯一选择，但成为默认选项后，迁移成本随时间增长。</p>
</div>

### 第三层：Agent 运行时基础设施标准

<div class="phase-card">
  <h4>从产品到基础设施层的跃迁</h4>
  <p>E2B 的长期目标是让「AI Agent 的代码在 E2B 沙箱中运行」像「Web 应用的静态资源放在 CDN 上」一样成为默认实践。这不是产品竞争，而是定义基础设施层的尝试——一旦 Agent 运行时的供给方式被标准化，切换成本将不只是 API 调用，而是整个部署管道的重新设计。</p>
  <p>BYOC 战略是这一层的具体体现：E2B 希望进入企业的 VPC，不是因为托管模式不够好，而是因为「E2B 作为基础设施组件嵌入企业架构」的价值远高于「E2B 作为外部 SaaS 被调用」。控制平面由 E2B 管理意味着推送更新、修复漏洞、优化调度算法都不需要客户干预——这是自建方案无法比拟的长期运维优势。</p>
</div>

<div class="verdict">
  <p class="verdict-title">E2B 和 OpenShell 的战略互补</p>
  <p>E2B 解决「代码跑在哪」，OpenShell 解决「代码能做什么」。两者在战略上不仅不竞争，反而互为增强——一个追求硬件隔离的厚度，一个追求策略治理的精度。</p>
  <p>如果在企业环境中同时部署 E2B（BYOC Firecracker microVM）和 OpenShell（Supervisor 策略执行），结果是：硬件虚拟化保证代码无法逃逸到宿主机，进程级策略保证代码无法访问无权访问的目标，推理路由器保证凭据不落入沙箱。这是从物理到逻辑的完整纵深防御，单独任何一个产品都达不到这个效果。</p>
  <p>一个值得关注的动向：如果 E2B 在未来将 OpenShell 的 Supervisor 作为可选组件预装到沙箱模板中，用户可以开箱即用获得「Firecracker 隔离 + OPA 策略」的完整方案。目前两者尚未集成，但在技术路线上没有不可逾越的障碍。</p>
</div>

### 采用方

<div class="table-wrap">
<table>
  <thead><tr><th>采用方</th><th>类型</th><th>使用场景</th></tr></thead>
  <tbody>
    <tr><td><strong>Manus</strong></td><td>通用 AI Agent</td><td>用户任务的代码执行环境——Agent 在沙箱中运行 Python 脚本、Shell 命令、浏览器操作</td></tr>
    <tr><td><strong>Perplexity</strong></td><td>AI 搜索引擎</td><td>购物 Agent 的浏览器操作沙箱——跨站点比价、填写表单、模拟点击</td></tr>
    <tr><td><strong>Hugging Face</strong></td><td>AI 模型平台</td><td>模型推理和微调任务的代码执行——用户在 Hugging Face Spaces 中运行的代码隔离在 E2B 沙箱中</td></tr>
    <tr><td><strong>Groq</strong></td><td>AI 推理硬件</td><td>客户代码执行沙箱——在 Groq 硬件上运行的用户代码先经过 E2B 沙箱隔离测试</td></tr>
    <tr><td><strong>Cursor</strong></td><td>AI 编码 IDE</td><td>编码 Agent 的安全依赖安装——Agent 自动 pip/npm install 时在沙箱中验证依赖安全性</td></tr>
    <tr><td><strong>Lindy</strong></td><td>AI 工作流自动化</td><td>自动化流程的代码执行节点——用户自定义的代码步骤在 E2B 沙箱中隔离执行</td></tr>
    <tr><td><strong>Genspark</strong></td><td>AI Agent 平台</td><td>多 Agent 协作场景的沙箱供给——$250M ARR 的 Agent 平台在其后端大规模使用 E2B</td></tr>
    <tr><td><strong>StackAI</strong></td><td>企业 AI 平台</td><td>企业客户的代码执行隔离——金融、医疗等受监管行业客户的 Agent 代码执行</td></tr>
  </tbody>
</table>
</div>

注：基于公开信息整理。部分采用方关系的具体范围可能随时间变化。Genspark 的 $250M ARR 数据和 E2B 的 94% Fortune 100 采用率为 E2B 官方公开数据。

## 七、风险与局限性

E2B 面临的风险是结构性的，不是执行层面的。

<div class="callout callout-rose">
  <div class="callout-label">三大核心风险向量</div>
  <p><strong>① 市场风险：Agent 出货量不及预期</strong><br>
  E2B 的收入与 AI Agent 的采用率直接绑定。如果 Agent 在 2027-2028 年的企业渗透率低于当前预期（例如受限于可靠性、合规或成本问题），E2B 的增长将受限。不同于基础设施厂商（AWS 的收入来自更广泛的负载），E2B 目前高度集中于「Agent 代码执行」这一垂直场景。它在可预见的 12-18 个月内仍将面临「市场太小，不足以支撑当前估值」的风险。</p>
  <p><strong>② 竞争风险：平台厂商整合</strong><br>
  Anthropic（Claude Code）、OpenAI（Codex）、Google（Gemini CLI）都拥有 Agent 入口。如果这些厂商将代码执行沙箱作为内置能力（类似 GPT-4 的 Code Interpreter 但更底层），独立沙箱提供商的差异化空间将收窄。这种风险不是能力问题——E2B 的 Firecracker 方案可能在技术上更优秀——而是分发渠道问题：Agent 框架的原生集成总是比第三方集成更顺畅。</p>
  <p><strong>③ 开源与经济可持续性</strong><br>
  Apache 2.0 许可意味着任何竞争者都可以 fork E2B 的代码并搭建竞争服务。AGPL（Daytona 的选择）至少要求修改后的代码回馈社区，Apache 2.0 没有任何此类要求。在「开源 + SaaS」这个商业模式中，E2B 需要靠运维质量、合规认证和品牌信任来保持领先——这些都是可被追赶的。Infra 仓库仅 62 个 Contributors 意味着核心开发仍高度集中于 E2B 团队自身，社区的「自维持能力」有限。</p>
</div>

<div class="verdict">
  <p class="verdict-title">优势本身也是风险的来源</p>
  <p><strong>Firecracker 强隔离</strong> → 优势是安全边界最干净的执行沙箱方案。风险是：如果未来 AI Agent 的安全需求变化——例如需要更细粒度的进程内隔离而非虚拟机级隔离——E2B 的架构调整成本高于容器方案。</p>
  <p><strong>完整 Linux 环境</strong> → 优势是 Agent 可以执行任何操作。风险是：攻击面也等比例扩大——Agent 可以在沙箱内安装任意包、运行任意二进制、发起任意网络请求。网络层 allow/deny 列表无法阻止使用非标准端口或自定义协议的恶意行为。</p>
  <p><strong>企业合规先发优势</strong> → SOC 2 + HIPAA 认证构建了信任壁垒。风险是：云厂商获得这些认证的速度和广度远超创业公司。AWS Lambda 已有 SOC、HIPAA、PCI-DSS、FedRAMP——E2B 的合规优势是相对于其他创业公司，而非相对于云厂商。</p>
</div>

## 八、结语：AI Agent 需要自己的运行时基础设施

E2B 的价值不应被简化为「更好的 Docker」。它代表的是一个更大的趋势：**AI Agent 运行时基础设施正在成为一个独立的基础设施层**，就像 2014 年的容器编排（Kubernetes）和 2018 年的 Service Mesh（Istio）一样——不是因为底层技术是全新的，而是因为上层负载模式改变了基础设施的设计假设。

<div class="verdict">
  <p class="verdict-title">AI Agent 运行时基础设施正在成为独立的基础设施层</p>
  <p>回顾基础设施的演进史，每一次上层负载模式的变革都会催生新的基础设施层。2013 年 Docker 出现是因为微服务需要轻量级打包；2015 年 Kubernetes 崛起是因为容器需要编排；2018 年 Service Mesh 兴起是因为微服务通信需要治理。2024-2026 年，AI Agent 的规模化部署正在催生<strong>Agent 运行时这一新层</strong>——它既不完全等于容器平台，也不完全等于无服务器函数，而是两者之间的一个新物种：<strong>完整环境的短暂供给</strong>。</p>
  <p>E2B 目前在定义这一层。但和所有先行者一样，它面临「先驱还是先烈」的不确定性：如果市场成熟得足够快，它作为品类定义者的先发优势将转化为壁垒；如果市场成熟得比预期慢，它可能被更晚期进入但资源更雄厚的平台厂商取代。</p>
</div>

### 完整的 AI Agent 运行时栈

<div class="stack-diagram">
  <div class="stack-row"><span class="stack-tag stack-tag-narrow tag-agent">Agent</span><span class="stack-text">Claude Code · Cursor · Manus · Perplexity · Lindy · …</span></div>
  <div class="stack-row"><span class="stack-tag stack-tag-narrow tag-govern">治理</span><span class="stack-text">OpenShell → 策略裁决 · 凭据路由 · 审计 · 形式化验证</span></div>
  <div class="stack-row stack-row-hero"><span class="stack-tag stack-tag-narrow tag-exec">执行</span><span class="stack-text">E2B · Daytona · CodeSandbox → 隔离供给 · 快照 · SDK · 模板市场</span></div>
  <div class="stack-row"><span class="stack-tag stack-tag-narrow tag-orch">编排</span><span class="stack-text">Nomad · Kubernetes · Consul → 调度 · 健康检查 · 节点管理</span></div>
  <div class="stack-row"><span class="stack-tag stack-tag-narrow tag-isolate">隔离</span><span class="stack-text">Firecracker · gVisor · KVM · Kata Containers → 独立内核 · 硬件虚拟化</span></div>
</div>

<style>
.tag-orch     { color: #f97316; }
.tag-isolate  { color: #16a34a; }

:root[data-theme="dark"] .tag-orch     { color: #fb923c; }
:root[data-theme="dark"] .tag-isolate  { color: #4ade80; }
</style>

GitHub: [https://github.com/e2b-dev/e2b](https://github.com/e2b-dev/e2b)

```bash
pip install e2b
```

<div class="callout callout-amber">
  <div class="callout-label">备注</div>
  <p>本文基于截至 2026 年 7 月的公开资料和源码分析撰写。E2B 的架构和产品形态仍在快速迭代中，具体数据可能已有更新。文中部分采用方关系和场景描述基于公开信息推断，实际集成的深度和范围可能有差异。</p>
</div>
