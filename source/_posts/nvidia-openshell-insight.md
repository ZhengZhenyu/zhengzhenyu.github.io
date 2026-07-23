---
title: NVIDIA OpenShell 深度解读——AI Agent 时代的「安全内核」
date: 2026-07-23 10:00:00
tags: [AI, Agent, NVIDIA, Sandbox, 安全, 战略, 开源]
categories: AI
description: AI Agent 时代的「安全内核」——从沙箱技术的演进逻辑，到 NVIDIA 的全栈战略卡位。
---

## 一、引言：当 AI 从「对话」走向「行动」

2026 年，AI 的应用形态正在发生显著变化。它不再局限于对话式 Copilot，而是发展为能独立规划任务、跨应用操作数据、持续运行数小时甚至数天的**自主智能体（Autonomous Agent）**。Claude Code、OpenClaw、Codex 等工具让开发者可以直接将编码、安装依赖、调用 API、操作文件系统等工作交由 Agent 自主完成。

但这种能力也带来了新的安全挑战。无状态的聊天机器人攻击面有限，但一个拥有持久 Shell 访问权限、携带实时凭据、能够重写自身工具链、并且累积数小时上下文的 Agent，其威胁模型有本质区别：一次 Prompt Injection 可能暴露凭据，一个第三方 Skill 可能是未经审计的二进制文件，一个子 Agent 可能继承超出预期的权限。

这引出一个问题：**当一个程序的行为不再由确定的代码定义，而是由一个概率模型动态生成时，传统的信任机制如何适配？**

## 二、为什么 AI Agent 需要沙箱运行时

<div class="verdict">
  <p class="verdict-title">基本判断</p>
  <p>AI Agent 的核心风险在于：它执行的代码是<strong>模型实时生成的，没有传统的作者、审查或签名流程</strong>，且行为是非确定性的——同一个 Prompt 在不同上下文窗口下可能产生截然不同的系统操作。传统软件的安全手段（代码审查、测试覆盖、权限分级）在这种范式下面临适配挑战。</p>
</div>

### 2.1 传统软件的信任模型已经失效

在传统软件开发中，信任建立在代码审查、作者信誉和 CI/CD 构建管道的控制之上。但 AI Agent 改变了这一前提——Agent 执行的代码由模型实时生成，审计 Agent 的每一次工具调用与审计一个 PR 有本质不同。Agent 的决策在本质上是概率性的，在安全工程中意味着很难通过穷举测试来覆盖所有行为路径。

### 2.2 Agent 具有全新的攻击面

<div class="callout callout-rose">
  <div class="callout-label">五大攻击向量</div>
  <p><strong>① 提示注入（Prompt Injection）</strong>：恶意输入可以诱导 Agent 执行意料之外的命令。与 SQL 注入不同——参数化查询能有效防御 SQL 注入，但 Prompt Injection 的缓解更加困难，因为 LLM 的指令遵循能力是实现功能的核心机制。</p>
  <p><strong>② 幻觉引发的危险操作</strong>：Agent 可能「幻觉」出一个命令并执行它——比如它可能「记错」了包名，安装了名称相似的恶意软件包。</p>
  <p><strong>③ 上下文污染与级联失败</strong>：长运行 Agent 累积大量上下文，早期对话中的恶意代码示例可能在数小时后被 Agent 当作指令执行。</p>
  <p><strong>④ 供应链攻击</strong>：Agent 在任务执行过程中安装第三方包、下载脚本、克隆仓库——每个外部依赖都可能被投毒。</p>
  <p><strong>⑤ 凭据泄露</strong>：Agent 需要 API Key 调用模型和服务，可能在不经意间将 Key 打印到日志或通过错误消息发送到外部。</p>
</div>

### 2.3 沙箱技术的发展脉络

沙箱并不是新技术，但 AI Agent 给沙箱提出了与以往不同的要求：

<div class="table-wrap">
<table>
  <thead><tr><th>技术方案</th><th>隔离级别</th><th>典型启动</th><th>核心机制</th><th>适用场景</th></tr></thead>
  <tbody>
    <tr><td><strong>进程级</strong><br><small>chroot / Bubblewrap</small></td><td>低</td><td>毫秒级</td><td>namespace + 路径重定向</td><td>受限 CLI 工具</td></tr>
    <tr><td><strong>容器级</strong><br><small>Docker / Podman</small></td><td>中</td><td>秒级</td><td>共享内核，namespace + cgroup + seccomp</td><td>CI/CD、微服务</td></tr>
    <tr><td><strong>用户态内核</strong><br><small>gVisor</small></td><td>较高</td><td>~400ms</td><td>Sentry 拦截 syscall，缩减攻击面</td><td>多租户容器平台</td></tr>
    <tr><td><strong>微虚拟机</strong><br><small>Firecracker</small></td><td>最高</td><td>~125ms</td><td>独立内核，硬件虚拟化隔离</td><td>Lambda、E2B 等</td></tr>
    <tr><td><strong>WebAssembly</strong><br><small>Wasm</small></td><td>中</td><td>微秒级</td><td>指令级内存隔离</td><td>纯计算、边缘</td></tr>
  </tbody>
</table>
</div>

这些技术各自解决了**「隔离」**问题，但对于 AI Agent 场景，仅做隔离可能不够——Agent 的运行环境还需要考虑**对 Agent 行为模式的感知和策略控制**。这是 OpenShell 与传统沙箱方案在定位上的主要分野。

### 2.4 当前 Agent 安全方案的局限

<div class="callout callout-rose">
  <div class="callout-label">三类主流方案及其局限</div>
  <p><strong>做法一：行为提示（System Prompt 约束）</strong><br>
  在 System Prompt 中加入行为约束指令。这些指令与 Agent 运行在同一进程空间，一旦 Agent 被 Prompt Injection 影响，这些约束可能被绕过。NVIDIA 官方博客的描述是：<em>「护栏就位于它们应该守护的同一流程中」</em>。</p>
  <p><strong>做法二：事后审计（日志审查）</strong><br>
  在 Agent 执行完毕后审查日志。对于生产环境中的实时威胁，存在检测延迟——Agent 可能在审计介入前已经完成破坏性操作。</p>
  <p><strong>做法三：通用容器隔离</strong><br>
  将 Agent 运行在 Docker 等通用容器中。默认配置下容器与宿主机共享内核，系统调用过滤有限，出站网络和进程级策略感知不足。此外，已知的容器逃逸漏洞（如 runc CVE-2024-21626 等）也引入了额外的风险面。</p>
</div>

<div class="verdict">
  <p class="verdict-title">核心矛盾</p>
  <p>Agent 的能力和安全性之间存在一个本质张力。现有方案在这个张力下，最多只能同时满足两个目标：<strong>安全 + 自主</strong> → Agent 权限受限；<strong>能力 + 安全</strong> → 不断人工审批；<strong>能力 + 自主</strong> → 无有效护栏。OpenShell 试图通过将策略执行点置于 Agent 进程之外，在安全性和能力之间寻求新的平衡。</p>
</div>

## 三、项目定位：Agents 的「操作系统内核」

### 基本事实

<div class="table-wrap">
<table>
  <thead><tr><th>维度</th><th>信息</th></tr></thead>
  <tbody>
    <tr><td><strong>仓库</strong></td><td><a href="https://github.com/NVIDIA/OpenShell" target="_blank">NVIDIA/OpenShell</a></td></tr>
    <tr><td><strong>出品方</strong></td><td>NVIDIA 官方</td></tr>
    <tr><td><strong>公开时间</strong></td><td>2026.03.16（GTC 大会）——仓库创建于 2026.02.24</td></tr>
    <tr><td><strong>最新版本</strong></td><td>v0.0.73（2026.07.02），平均每 2-3 天发布</td></tr>
    <tr><td><strong>许可</strong></td><td>Apache 2.0</td></tr>
    <tr><td><strong>实现语言</strong></td><td>Rust（~90%）</td></tr>
    <tr><td><strong>社区规模</strong></td><td>7000+ Stars、842 Forks、66 Contributors（2026.06）</td></tr>
  </tbody>
</table>
</div>

### 关键数字

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
    <div class="stat-num">53</div>
    <div class="stat-label">Releases（4个月）</div>
  </div>
  <div class="stat-card">
    <div class="stat-num">858</div>
    <div class="stat-label">Commits</div>
  </div>
</div>

### 定位：它不是 Agent 框架，而是 Agent 运行时的安全层

OpenShell 在技术栈中的位置：

<div class="figure">
<pre><code>┌──────────────────────────────────────────┐
│  Claude Code / OpenClaw / Codex ...      │  ← Agent（智能体）
├──────────────────────────────────────────┤
│  Hermes / LangChain / CrewAI ...         │  ← Harness（编排层）
├──────────────────────────────────────────┤
│          ┌────────────────┐              │
│          │   OpenShell    │              │  ← 安全运行时
│          └────────────────┘              │
├──────────────────────────────────────────┤
│   OS / Container / Kubernetes            │  ← 基础设施
└──────────────────────────────────────────┘</code></pre>
</div>

NVIDIA 的路线不是做一个新的 Agent 框架去和 LangChain、CrewAI 竞争，而是做**通用型 Agent Runtime**，在 Agent 进程之外拦截并审计其文件访问、网络连接、进程执行和推理调用。

OpenShell 还区分了自身与上层编排的关系。它提供沙箱容器、凭据存储网关、推理代理和策略执行，但**不关心沙箱里跑什么**——NemoClaw 是 NVIDIA 基于 OpenShell 构建的参考实现蓝图，负责沙箱内容编排和 Agent 集成，而 OpenShell 只做底层的安全约束。

> **"The safe, private runtime for autonomous AI agents."**

三个关键词：

- **Safe**：内核级隔离（Landlock + seccomp + 网络命名空间），限制 Agent 对宿主环境的访问
- **Private**：凭据不存储在沙箱内部，推理流量可路由到指定后端
- **Runtime**：面向长时间运行 Agent 的持续性运行时环境，而非一次性执行沙箱

## 四、技术细节：从策略到执行的完整链路

### 4.1 三个核心组件

OpenShell 架构由三个稳定组件构成：

<div class="table-wrap">
<table>
  <thead><tr><th>组件</th><th>角色</th><th>运行位置</th></tr></thead>
  <tbody>
    <tr><td><strong>CLI / SDK / TUI</strong></td><td>用户交互界面，创建沙箱、管理策略、查看日志</td><td>用户侧</td></tr>
    <tr><td><strong>Gateway</strong>（网关）</td><td>控制平面：API 入口、状态持久化、策略分发、凭据管理、推理配置</td><td>宿主机或集群</td></tr>
    <tr><td><strong>Supervisor</strong>（监督者）</td><td>数据平面：沙箱内部的安全执行边界，启动受限 Agent 进程，本地执行策略</td><td>每个沙箱内部</td></tr>
  </tbody>
</table>
</div>

### 4.2 四层防御体系

OpenShell 在四个层面施加安全约束，形成纵深防御：

<div class="table-wrap">
<table>
  <thead><tr><th>防护层</th><th>技术实现</th><th>变更方式</th></tr></thead>
  <tbody>
    <tr><td><strong>文件系统</strong></td><td><strong>Landlock LSM</strong>（Linux 内核安全模块），限制 Agent 只能访问声明路径</td><td>静态（需重建沙箱）</td></tr>
    <tr><td><strong>网络</strong></td><td><strong>OPA 策略引擎</strong> + HTTP CONNECT 代理，默认拒绝，逐连接评估二进制哈希</td><td>动态（热加载）</td></tr>
    <tr><td><strong>进程</strong></td><td><strong>seccomp BPF</strong> 系统调用过滤 + 特权丢弃，阻止提权</td><td>静态（需重建沙箱）</td></tr>
    <tr><td><strong>推理</strong></td><td><strong>推理路由器</strong>（inference.local），代理注入凭据，Agent 无接触</td><td>动态（热加载）</td></tr>
  </tbody>
</table>
</div>

### 4.3 默认拒绝（Deny-by-Default）

每个 OpenShell 沙箱启动时处于**全锁定**状态——所有网络出站拒绝、所有文件系统路径不可访问、所有凭据已剥离、所有进程特权已丢弃。开发者通过 **声明式 YAML 策略**显式授权 Agent 所需的各项权限：

```yaml
version: 1
filesystem_policy:
  include_workdir: true
  read_only:
    - /usr
    - /lib
    - /etc
    - /proc
  read_write:
    - /sandbox
    - /tmp

network_policies:
  "install-packages":
    description: "Allow npm install from npm registry"
    binary_hash: "abc123..."
    hosts:
      - "registry.npmjs.org:443"
    protocols: ["https"]

  "github-api":
    description: "Allow Claude Code to reach GitHub API"
    binary_hash: "def456..."
    hosts:
      - "api.github.com:443"
    protocols: ["https"]

process:
  uid: 10000
  gid: 10000
```

这里有一个值得注意的设计——**Per-binary 网络策略**。OpenShell 的 CONNECT 代理不仅检查目标 IP 和端口，还可以识别发出请求的**具体二进制文件的 SHA-256 哈希**。这意味着策略可以区分：允许 Agent 本体访问 `api.github.com`，但阻止同一容器内其他进程（如 `curl`）访问同一主机。如果 Agent 通过子进程尝试非授权出站连接，代理会因二进制哈希不匹配而拦截。

### 4.4 凭据隔离

凭据管理是 OpenShell 的另一个设计重点。**密钥不存储在沙箱文件系统内**。基本流程：

1. Agent 向 `https://inference.local` 发起推理请求（使用占位凭据）
2. OpenShell 的推理路由代理在**网络层**拦截这些请求
3. 代理从网关的凭据存储中获取实际凭据，注入请求后转发
4. 请求到达目标模型后端（NVIDIA Endpoints、OpenAI、Anthropic、Ollama 等）

在这一模型下，即使 Agent 进程受到攻击，攻击者获取的也只是不含实际凭据的本地端点地址。

### 4.5 Gateway-Supervisor 协作模型

OpenShell 将**控制平面权限**（Gateway）和**运行时执行**（Supervisor）彻底分离：

- **Gateway** 拥有平台级持久状态：沙箱定义、策略版本、Provider 记录、推理配置、会话记录和鉴权决策
- **Supervisor** 由沙箱主动向 Gateway 发起出站连接并维持长会话，接收期望状态配置并在本地执行

这种设计避免了对容器编排层（如 Pod IP、端口映射、NAT 隧道）的强依赖，使得 OpenShell 可以一致地运行在 Docker、Podman、Kubernetes 甚至 MicroVM 等多种计算后端上。

### 4.6 实现细节

- **语言**：核心组件用 **Rust**（约 90%）编写
- **可观测性**：支持 CLI 和 TUI 实时查看日志，导出 **OCSF JSON** 格式记录
- **策略版本控制**：YAML 策略文件可以纳入 Git 管理
- **社区沙箱目录**：提供 `base`、`ollama`、`openclaw`、`sdg` 等预构建沙箱

## 五、与其他沙箱类项目的差异点

### 5.1 与 E2B、Daytona、CodeSandbox 的对比

<div class="table-wrap">
<table>
  <thead><tr><th>维度</th><th>OpenShell</th><th>E2B</th><th>Daytona</th><th>CodeSandbox</th></tr></thead>
  <tbody>
    <tr><td><strong>定位</strong></td><td>Agent 安全运行时</td><td>云沙箱即服务</td><td>开发环境管理器</td><td>在线 IDE + 沙箱</td></tr>
    <tr><td><strong>部署模式</strong></td><td>自托管（本地/集群）</td><td>云托管为主</td><td>自托管</td><td>云托管</td></tr>
    <tr><td><strong>隔离技术</strong></td><td>Landlock + seccomp + OPA</td><td>Firecracker MicroVM</td><td>Docker 容器池</td><td>Firecracker MicroVM</td></tr>
    <tr><td><strong>核心能力</strong></td><td>策略驱动的安全治理</td><td>极速代码执行环境</td><td>快照 + 持久化工作区</td><td>IDE 集成 + 协作</td></tr>
    <tr><td><strong>策略机制</strong></td><td>YAML 声明式 + Per-binary 控制</td><td>API 级别隔离</td><td>基本进程/网络隔离</td><td>沙箱级别</td></tr>
    <tr><td><strong>凭据管理</strong></td><td>网关层注入</td><td>API Key 外部管理</td><td>SDK 层管理</td><td>平台管理</td></tr>
    <tr><td><strong>推理控制</strong></td><td>内置推理路由器</td><td>—</td><td>—</td><td>—</td></tr>
    <tr><td><strong>许可证</strong></td><td>Apache 2.0</td><td>开源（有商业版）</td><td>开源（有商业版）</td><td>商业为主</td></tr>
    <tr><td><strong>NVIDIA 硬件集成</strong></td><td>原生 GPU 注入（CDI）</td><td>—</td><td>—</td><td>—</td></tr>
  </tbody>
</table>
</div>

<div class="verdict">
  <p class="verdict-title">定位差异</p>
  <p><strong>E2B 和 CodeSandbox 侧重「执行环境的快速供给」，而 OpenShell 侧重「Agent 行为的策略治理」。</strong>前者解决的是执行环境的<strong>供给</strong>（provisioning）问题；后者关注的是 Agent 行为的<strong>治理</strong>（governance）问题。两者解决的问题域不同。</p>
</div>

### 5.2 与 gVisor、Firecracker 的对比

<div class="table-wrap">
<table>
  <thead><tr><th>维度</th><th>OpenShell</th><th>gVisor</th><th>Firecracker</th></tr></thead>
  <tbody>
    <tr><td><strong>隔离级别</strong></td><td>容器 + 内核 LSM</td><td>用户态内核（Sentry）</td><td>微虚拟机（独立内核）</td></tr>
    <tr><td><strong>启动速度</strong></td><td>容器级（秒级）</td><td>~417ms</td><td>~125ms</td></tr>
    <tr><td><strong>攻击面</strong></td><td>Landlock + seccomp 收敛</td><td>用户态实现，攻击面小</td><td>完全隔离</td></tr>
    <tr><td><strong>文件 I/O</strong></td><td>接近原生</td><td>小文件可显著劣化</td><td>接近原生</td></tr>
    <tr><td><strong>策略层</strong></td><td>OPA 引擎 + YAML</td><td>—</td><td>—</td></tr>
    <tr><td><strong>Agent 负载设计</strong></td><td>面向 Agent 场景</td><td>通用隔离</td><td>通用隔离</td></tr>
  </tbody>
</table>
</div>

gVisor 和 Firecracker 是成熟的隔离技术，它们的定位是通用隔离方案，不内置 Agent 专用的策略治理层。OpenShell 在容器隔离之上叠加了策略引擎、凭据管理、推理路由和可观测性，形成了面向 Agent 工作负载的运行时栈。

### 5.3 差异化特征

<div class="workflow">
  <div class="workflow-step mandatory">
    <div class="step-num">1</div>
    <div class="step-cmd">Per-binary 网络策略</div>
    <div class="step-desc">在同类 Agent 沙箱方案中，OpenShell 能够区分同一容器内不同二进制文件的网络权限。标准容器通常只能识别发起请求的 Pod 或容器，OpenShell 可进一步识别具体二进制文件及其目标 URL。</div>
  </div>
  <div class="workflow-step mandatory">
    <div class="step-num">2</div>
    <div class="step-cmd">推理流量路由</div>
    <div class="step-desc">内置推理路由端点（inference.local），可拦截模型 API 调用并按配置路由到指定后端。这在标准容器或 VM 方案中没有直接等价功能。</div>
  </div>
  <div class="workflow-step mandatory">
    <div class="step-num">3</div>
    <div class="step-cmd">声明式策略即代码</div>
    <div class="step-desc">安全策略以 YAML 文件形式管理，支持版本控制和 Code Review。对比传统沙箱方案中分散在运行参数、seccomp profile 和网络策略中的安全配置，提供了更集中的管理方式。</div>
  </div>
  <div class="workflow-step optional">
    <div class="step-num">4</div>
    <div class="step-cmd">自托管部署</div>
    <div class="step-desc">支持完全离线的 air-gapped 环境部署，可在 DGX Spark/Station 等本地硬件上运行，所有数据和推理流量不离开本地网络。</div>
  </div>
</div>

## 六、NVIDIA 做 OpenShell 的出发点与战略价值

> **"当今的 Agent 运行时就像早期的 Web。它们功能强大，但缺少核心安全基元：沙盒、权限和隔离。"**

要理解 NVIDIA 为什么投入 OpenShell，需要放在全栈战略的框架下来看。从 NVIDIA 的公开表述来看，其基本判断是：长期运行、自进化的 Agent 要在生产环境中可靠运行，需要在**安全性、能力和自主性**之间找到可行的均衡点。OpenShell 试图通过「进程外策略执行」来回应这一张力。

### 6.1 全栈产品线延伸

<div class="phase-card">
  <h4>从 GPU 到 Agent 运行时的链路</h4>
  <p>从 GPU → CUDA → Nemotron → TensorRT → NemoClaw → <strong>OpenShell</strong> → 企业生态，形成了一条从硬件到 Agent 运行时的产品链路。OpenShell 在这条链路中承担「安全部署 Agent」的环节。该环节解决的核心问题是：企业能够运行高性能 Agent，但缺乏对 Agent 行为的运行时管控。</p>
</div>

### 6.2 运行时层的布局

<div class="phase-card">
  <h4>Agent 运行时的控制点意义</h4>
  <p>类似 Chrome 在 Web 时代成为应用运行时、iOS/Android 在移动时代成为应用平台的逻辑——<strong>Agent 运行时是 AI 应用栈中的关键控制点</strong>。Agent 运行时的控制方可以影响数据可见性、模型调用路径、API 访问范围和安全策略的制定。</p>
</div>

### 6.3 GPU 需求的间接推动

<div class="phase-card">
  <h4>商业逻辑链条</h4>
  <p>OpenShell 的商业逻辑链条：降低 Agent 部署的安全门槛 → 促进企业采纳 Agent → Agent 推理负载增长 → <strong>GPU 需求提升</strong>。SAP 嵌入商业平台、Cadence 构建 AI 工程师、DGX 预装等案例，均涉及 GPU 消费场景。</p>
</div>

### 6.4 开源生态构建

<div class="phase-card">
  <h4>网络效应与采纳</h4>
  <p>Apache 2.0 许可降低采用门槛。安全基础设施具有较强的<strong>网络效应</strong>——采纳方越多，周边安全策略和沙箱模板越丰富。目前 Canonical（Ubuntu Snap）、Red Hat（OpenShift AI）、Microsoft（Windows）等已提供集成支持。</p>
</div>

### 生态版图一览

<div class="table-wrap">
<table>
  <thead><tr><th>生态层</th><th>合作方</th></tr></thead>
  <tbody>
    <tr><td><strong>企业生态</strong></td><td>SAP、Salesforce、ServiceNow、Atlassian、Box、Adobe、Cadence、Siemens、Synopsys、CrowdStrike、Cisco</td></tr>
    <tr><td><strong>操作系统生态</strong></td><td>Canonical（Ubuntu Snap）、Red Hat（OpenShift AI）、Microsoft（Windows）</td></tr>
    <tr><td><strong>Agent 生态</strong></td><td>Claude Code、OpenCode、Codex、GitHub Copilot CLI、OpenClaw、LangChain Deep Agents</td></tr>
    <tr><td><strong>安全生态</strong></td><td>CrowdStrike、Cisco AI Defense、Google、Microsoft Security、Trend Micro</td></tr>
  </tbody>
</table>
</div>

### 6.5 出发点总结

<div class="callout callout-teal">
  <div class="callout-label">归纳</div>
  <p>① <strong>需求驱动</strong>：企业客户有部署 Agent 的需求，但缺乏有效的运行时安全护栏，这限制了 Agent 在生产环境中的采用。</p>
  <p>② <strong>差异化定位</strong>：市场上缺乏专门面向 Agent 的安全运行时。传统沙箱（gVisor、Firecracker、Docker）侧重于通用隔离，E2B 等侧重于执行环境的快速供给。</p>
  <p>③ <strong>标准窗口</strong>：在 Agent 安全运行时领域尚未形成统一标准，率先推出方案的项目有机会影响行业规范的形成。</p>
  <p>④ <strong>生态协同</strong>：OpenShell 是 NVIDIA Agent Toolkit 的组成部分，与 Nemotron 模型、NemoClaw 蓝图、CUDA-X 技能库形成配套。</p>
  <p>⑤ <strong>商业关联</strong>：开源促进生态采纳 → 企业 Agent 部署增长 → 推理算力需求增加 → 与 NVIDIA 的硬件业务形成正反馈。</p>
</div>

## 七、结语

OpenShell 反映了 AI Agent 基础设施发展的一个趋势：**将安全控制从 Agent 内部逻辑转移到 Agent 的运行环境中**。它的核心思路是在内核级隔离之上叠加策略引擎、凭据管理和推理路由，形成面向 Agent 工作负载的运行时约束层。

对开发者而言，OpenShell 提供了一种方式，在赋予 Agent 工具访问权限的同时施加可配置的运行时限制。从 NVIDIA 的战略角度看，OpenShell 是其 Agent 工具链中连接硬件、模型和企业生态的一环——它处于 GPU 硬件推理能力和企业 Agent 安全部署需求之间的接合部。

> **"企业软件产业将演进为专业化的 Agent 平台，而 IT 产业正准备迎接下一波巨大扩张。"**
> —— 黄仁勋，GTC 2026

GitHub: [https://github.com/NVIDIA/OpenShell](https://github.com/NVIDIA/OpenShell)

```bash
uv tool install -U openshell
openshell sandbox create --from openclaw
```

<div class="callout callout-amber">
  <div class="callout-label">备注</div>
  <p>本文基于截至 2026 年 7 月的公开资料撰写。OpenShell 仍在快速迭代中，当前为 alpha 阶段，NVIDIA 官方将其描述为「single-player mode」。</p>
</div>
