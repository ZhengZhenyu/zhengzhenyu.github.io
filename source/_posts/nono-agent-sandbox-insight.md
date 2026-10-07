---
title: nono 深度洞察：从「隔离边界」到「每次授权」——Sigstore 团队的零延迟 Agent 沙箱
date: 2026-10-07 22:00:00
tags: [AI, Agent, nono, Sandbox, Landlock, 安全, 架构, 开源]
categories: AI
description: 从源码出发，分析 Sigstore 团队打造的零延迟 Agent 能力沙箱的三层架构、安全模型与 12 个安全公告背后的工程品质
---

## 一、引言：一个反直觉的沙箱

2026 年，Agent 沙箱正在成为独立的基础设施品类。这个品类里已经出现了几条路线：gVisor 用用户态内核做软件隔离，Firecracker 用极简 microVM 做硬件隔离，E2B 把 microVM 包装成可编程的执行沙箱，OpenShell 在容器或 VM 的「壳」内做逐请求的策略裁决。

四条路线共享一个前提：**沙箱 = 一道边界**——先画圈，再讨论墙有多厚。

2026 年 1 月上线的 [nono](https://github.com/nolabs-ai/nono) 挑战的正是这个前提。它不建任何边界——没有容器、没有 VM、没有守护进程、没有磁盘镜像。`nono run --profile nolabs-ai/claude -- claude` 一行命令之后，Agent 依然跑在宿主机内核上、跑在用户自己的账户里，但它能看到的每一个文件、每一条网络路径、每一个凭据，都必须来自一次**显式授权**。

这不是「隔离模型」，而是「能力模型」。两者的差异，是理解 nono 的钥匙。

<div class="verdict">
  <p class="verdict-title">基本判断</p>
  <p>nono 的定位不是「更好的容器」，而是 Agent 沙箱品类的第三个坐标——<strong>能力沙箱（Capability Sandbox）</strong>：不回答「代码跑在哪个盒子里」，只回答「每个进程、每次工具调用能碰到什么」。它的价值不在隔离强度，而在<strong>授权粒度</strong>——细到单个文件、单个端口、单个命令、单个 HTTP 方法+路径。</p>
</div>

<div class="callout callout-amber">
  <div class="callout-label">核心术语速览（非专业读者可先读此节）</div>
  <p><strong>Landlock LSM</strong>：Linux 5.13+ 内核的安全模块，允许非特权进程用声明式规则限制自己及子进程能访问哪些文件路径、哪些 TCP 端口。规则一旦施加不可撤销。</p>
  <p><strong>seccomp / user-notify</strong>：Linux 内核的系统调用过滤机制；user-notify 模式让内核把被拦截的 syscall「转发」给另一个进程裁决，是 nono 实现运行时授权的通道。</p>
  <p><strong>Seatbelt</strong>：macOS 的沙箱机制，用 SBPL（Sandbox Profile Language）声明式规则限制进程；nono 在 macOS 上用它替代 Landlock。</p>
  <p><strong>能力模型（Capability）</strong>：不靠「围住资源」做安全，而靠「进程不持有指向资源的授权」做安全；每个可访问对象都来自一次显式授予。</p>
  <p><strong>TCB（Trusted Computing Base，受信计算基）</strong>：安全系统里「必须可信」的组件。在 nono 里是 supervisor 与 broker 进程——它们不受沙箱限制，替沙箱内进程做授权决策。</p>
  <p><strong>TOCTOU</strong>（Time-of-check to time-of-use）：「检查」与「使用」之间状态被篡改的竞态漏洞，文件系统安全代码的主要敌人；本文多处出现。</p>
  <p><strong>Phantom Credential（幽灵凭据）</strong>：发给沙箱内进程的占位凭证（比如假 API Key），真实密钥只存在于代理进程中，由代理在转发边界替换注入。</p>
</div>

## 二、为什么需要第三条路

### 2.1 墙内扁平：隔离模型的盲区

容器和 microVM 解决的是「墙外的人进不来」。但 Agent 场景的安全问题，大部分发生在墙内。

nono 官方安全模型文档（[security-model](https://github.com/nolabs-ai/nono/blob/main/docs/cli/internals/security-model.mdx)）用一张图说清了这个盲区：在一个 microVM 里，Agent、项目文件、无关文件、凭据、其他进程**全部平铺**在同一个盒子里。VM 的边界很强，但一旦进程进到边界内部，它能自由触达盒子里的所有资产——因为 guest OS 本身不区分「这个 Agent 该不该读 `~/.aws/credentials`」。

而 Agent 恰好是边界内部资产的最大威胁源：它读取、安装、执行着模型实时生成的代码，还随身携带真实开发者的全部用户权限。一个被 Prompt Injection 诱导的 `cat ~/.ssh/id_rsa`，在 VM 里畅通无阻。

### 2.2 三种现有做法及其共同缺陷

<div class="callout callout-rose">
  <div class="callout-label">三种做法与共同缺陷</div>
  <p><strong>① System Prompt 约束</strong>：在提示词里写「不要读凭据」。护栏与 Agent 逻辑运行在同一进程空间，Prompt Injection 可以连护栏一起绕过——「护栏就位于它们应该守护的同一流程中」。</p>
  <p><strong>② 事后审计</strong>：Agent 的操作量级是人类的数十倍，破坏性操作在审计介入前已经完成；审计发现问题 ≠ 阻止问题。</p>
  <p><strong>③ 容器 / VM 隔离</strong>：边界内资产平铺，Agent 拿到的是「盒子里的所有钥匙」；且 Docker 默认 seccomp 允许 300+ 系统调用，容器逃逸漏洞直接威胁宿主机。</p>
</div>

三种做法的共同缺陷：**策略执行点要么在 Agent 进程内部，要么在操作发生之后，要么粒度只有「整机」一档。**

nono 的思路是第四种：把策略执行点放到内核里，粒度放到「单个对象」上。Landlock 规则告诉内核「这个进程只能读写 `/home/kevin/project`」；seccomp 过滤器告诉内核「openat 之外的一切照常放行」。**授权发生在访问发生的瞬间，由内核裁决，进程无法自行扩大。**

<div class="verdict">
  <p class="verdict-title">核心矛盾</p>
  <p>Agent 的能力与安全之间存在三角张力：<strong>能力+自主</strong> → 无护栏；<strong>安全+自主</strong> → 权限受限；<strong>能力+安全</strong> → 频繁人工审批。nono 的解法是把这个三角形拆成两层：<strong>静态层用内核规则封死「不该碰的」</strong>，<strong>动态层用 supervisor 按需注入「新批准的」</strong>——两层之间，Agent 只能通过受控通道申请。</p>
</div>

## 三、行业全景：沙箱品类的坐标系

在深入 nono 的技术细节之前，先厘清这个品类的坐标系。Agent 沙箱按「回答什么问题」可以分为三个品类：

<div class="stack-diagram">
  <div class="stack-row"><span class="stack-tag tag-agent">Agent</span><span class="stack-text">Claude Code · Codex · OpenCode · OpenClaw · Copilot CLI · …</span></div>
  <div class="stack-row"><span class="stack-tag tag-govern">治理运行时</span><span class="stack-text">OpenShell → 壳内逐请求裁决（OPA、凭据网关、推理路由）</span></div>
  <div class="stack-row stack-row-hero"><span class="stack-tag tag-cap">能力沙箱</span><span class="stack-text">nono → 本机零设置，内核强制每次授权（文件 / 端口 / 命令 / 凭证）</span></div>
  <div class="stack-row"><span class="stack-tag tag-exec">执行沙箱</span><span class="stack-text">E2B · Daytona · CodeSandbox → 隔离环境供给、快照、编程接口</span></div>
  <div class="stack-row"><span class="stack-tag tag-infra">隔离层</span><span class="stack-text">Firecracker · gVisor · KVM · Docker · Kata Containers</span></div>
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
  width: 72px;
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-align: right;
}
.stack-text { color: var(--text-soft); flex: 1; }
.tag-agent   { color: #4f46e5; }
.tag-govern  { color: #7c3aed; }
.tag-cap     { color: #ea580c; }
.tag-exec    { color: #0891b2; }
.tag-infra   { color: #64748b; }

:root[data-theme="dark"] .tag-agent   { color: #a5b4fc; }
:root[data-theme="dark"] .tag-govern  { color: #c4b5fd; }
:root[data-theme="dark"] .tag-cap     { color: #fb923c; }
:root[data-theme="dark"] .tag-exec    { color: #22d3ee; }
:root[data-theme="dark"] .tag-infra   { color: #a1a1aa; }
:root[data-theme="dark"] .stack-row-hero {
  background: linear-gradient(90deg, rgba(249,115,22,0.10) 0%, rgba(249,115,22,0.02) 100%);
}
</style>

如果用「隔离强度 × 授权粒度」两个轴把各家方案摆开，nono 的位置是唯一且反直觉的——**隔离强度最低（共享内核），授权粒度最高（单次调用级）**：

<div class="growth-chart">
  <img src="sandbox-spectrum.svg" alt="Agent 沙箱品类坐标系：横轴为隔离强度、纵轴为授权粒度，nono 位于共享内核且粒度最细的左上角，官方推荐与容器/microVM 组合" style="width:100%">
</div>

这张图同时揭示了 nono 与 OpenShell 的关系——二者都基于 Landlock + seccomp，但路线相反：OpenShell 先建壳（容器/VM）再在壳内做治理，nono 不建壳、直接在本机内核上做能力限制。**不是「车库的墙」与「车库的门锁」，而是「不设车库，给每个抽屉装锁」。**

## 四、nono 深度分析

### 4.1 项目概览

<div class="table-wrap">
<table>
  <thead><tr><th>维度</th><th>信息</th></tr></thead>
  <tbody>
    <tr><td><strong>仓库</strong></td><td><a href="https://github.com/nolabs-ai/nono" target="_blank">nolabs-ai/nono</a>（2026.08 由 always-further/nono 迁移，旧命名空间将退役）</td></tr>
    <tr><td><strong>创建 / 最新版本</strong></td><td>2026.01.31 创建；v0.79.0（2026.09.30），232 天 ≥100 个 release（约 2.3 天/版），全部符合 semver</td></tr>
    <tr><td><strong>许可 / 语言</strong></td><td>Apache-2.0；Rust（edition 2024），约 23 万行（nono-cli 14.9 万 / nono 3.7 万 / nono-proxy 3.3 万），231 个源文件</td></tr>
    <tr><td><strong>社区规模</strong></td><td>4,380 Stars / 297 Forks / 227 open issues（2026.10.07）；维护者 3 人，贡献者 80+（2026.07 报道口径），前 30 名合计提交 1,566 次</td></tr>
    <tr><td><strong>平台支持</strong></td><td>Linux（x86_64 / aarch64，glibc + musl）、macOS（双架构）、WSL2；原生 Windows 仍是 NEP-0005 draft</td></tr>
    <tr><td><strong>安全记录</strong></td><td>12 个 GHSA（4 high / 7 medium / 1 low，含 CVE-2026-47128）；OSTIF 第三方审计定于 2026 Q3；OpenSSF Best Practices passing</td></tr>
  </tbody>
</table>
</div>

<div class="stats-grid">
  <div class="stat-card">
    <div class="stat-num">4.4K</div>
    <div class="stat-label">Stars（2026.10，8 个月）</div>
  </div>
  <div class="stat-card">
    <div class="stat-num">100+</div>
    <div class="stat-label">Releases（232 天）</div>
  </div>
  <div class="stat-card">
    <div class="stat-num">12</div>
    <div class="stat-label">GHSA 安全公告（8 个月）</div>
  </div>
  <div class="stat-card">
    <div class="stat-num">3-10μs</div>
    <div class="stat-label">单次文件打开开销</div>
  </div>
</div>

### 4.2 架构全景：三层 + 一个受信核心

<div class="growth-chart">
  <img src="nono-architecture.svg" alt="nono 三层架构：会话沙箱中的 Agent、每次调用一次性命令沙箱、不受沙箱限制的 supervisor 与网络代理，底层为 Landlock/seccomp/Seatbelt 内核强制层" style="width:100%">
</div>

图中三个矩形对应 nono 的三个执行域：**会话沙箱**（Agent 本体）、**命令沙箱**（每次工具调用一次性创建）、**受信核心**（supervisor / broker / 代理，运行在沙箱之外）。三者的关系是本文第四节的主线。

<div class="arch-grid">
  <div class="arch-card arch-ui">
    <div class="arch-card-title">会话沙箱 · Session</div>
    <div class="arch-card-items">Landlock / Seatbelt &nbsp;·&nbsp; PTY 代理 &nbsp;·&nbsp; execute-only 门</div>
    <div class="arch-card-desc">Agent 本体：静态策略封死文件、网络、信号；可 exec 的目标被收敛到 shim 集合与依赖闭包</div>
  </div>
  <div class="arch-card arch-ctrl">
    <div class="arch-card-title">命令沙箱 · Command</div>
    <div class="arch-card-items">shim 硬链接 &nbsp;·&nbsp; broker 调解 &nbsp;·&nbsp; 链式策略</div>
    <div class="arch-card-desc">git / gh / kubectl 等工具各自拿到一次性沙箱；不继承会话沙箱的宽授权、CWD 与真实凭据</div>
  </div>
  <div class="arch-card arch-data">
    <div class="arch-card-title">受信核心 · Supervisor</div>
    <div class="arch-card-items">seccomp-notify &nbsp;·&nbsp; 审批 &nbsp;·&nbsp; 回滚 &nbsp;·&nbsp; 审计</div>
    <div class="arch-card-desc">非沙箱、非 root：动态授权的唯一来源；fd 注入、快照、哈希链账本都在这里</div>
  </div>
  <div class="arch-card arch-policy">
    <div class="arch-card-title">网络代理 · nono-proxy</div>
    <div class="arch-card-items">域名过滤 &nbsp;·&nbsp; L7 策略 &nbsp;·&nbsp; TLS 拦截 &nbsp;·&nbsp; 凭证注入</div>
    <div class="arch-card-desc">沙箱内只能连到 127.0.0.1 随机端口；真实密钥只存在于代理进程内存</div>
  </div>
  <div class="arch-card arch-driver">
    <div class="arch-card-title">内核强制层</div>
    <div class="arch-card-items">Landlock &nbsp;·&nbsp; seccomp &nbsp;·&nbsp; cgroup ｜ Seatbelt (SBPL)</div>
    <div class="arch-card-desc">策略不可逆、后代继承；文件打开仅付微秒级过滤开销</div>
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

各层之间的可见性是单向且受限的：会话沙箱看不到命令沙箱的内部策略，命令沙箱看不到 supervisor 的审批界面与代理内存中的真实密钥；图中的每条箭头都是一次受限、可审计的交互。

### 4.3 关键机制一：为什么必须有一个 supervisor

nono 的第一个反直觉设计是：它主打「零延迟、无守护进程」，但它的监督模式（Supervised）有一个常驻父进程。这并不矛盾——Landlock 与 Seatbelt 的规则一旦施加，进程自身无法撤销或扩大。如果 nono 在 `exec` 前把策略一次封死然后消失（Direct 模式，`nono wrap` 即如此），那么「Agent 临时需要读一个它无权读的文件」这件事就无解了——用户只能重启会话。

Supervised 模式引入了受信核心：nono 作为父进程存活，子进程带着 seccomp user-notify 过滤器启动——核心只 trap `openat` / `openat2` 两个系统调用（`socket` / `connect` 在 AF_UNIX 中介与网络兜底模式下加入），其余全速放行。当 Agent 打开一个不在静态策略内的路径时，内核把这次调用转发给父进程：

<div class="policy-flow">
  <div class="pf-step">
    <div class="pf-num">1</div>
    <div class="pf-body">
      <div class="pf-title">内核拦截</div>
      <div class="pf-desc">子进程 openat 触发 seccomp 通知，syscall 挂起，内核把 pid 与参数交给父进程</div>
    </div>
  </div>
  <div class="pf-arrow">→</div>
  <div class="pf-step">
    <div class="pf-num">2</div>
    <div class="pf-body">
      <div class="pf-title">受保护根检查</div>
      <div class="pf-desc">supervisor 先于一切快路径检查目标是否触及 nono 自身状态或受保护路径，是则直接拒绝</div>
    </div>
  </div>
  <div class="pf-arrow">→</div>
  <div class="pf-step">
    <div class="pf-num">3</div>
    <div class="pf-body">
      <div class="pf-title">审批与打开</div>
      <div class="pf-desc">超出初始能力 → 终端审批；通过后 supervisor 以 O_NOFOLLOW 逐组件打开真实 fd</div>
    </div>
  </div>
  <div class="pf-arrow">→</div>
  <div class="pf-step">
    <div class="pf-num">4</div>
    <div class="pf-body">
      <div class="pf-title">fd 注入</div>
      <div class="pf-desc">SECCOMP_IOCTL_NOTIF_ADDFD + SCM_RIGHTS 把已打开的文件描述符注入子进程，syscall 恢复执行</div>
    </div>
  </div>
</div>

<style>
.policy-flow { display: flex; align-items: stretch; gap: 6px; margin: 1.5em 0; }
.pf-step {
  flex: 1;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px 14px;
  box-shadow: var(--shadow-sm);
  border-top: 3px solid var(--primary);
}
.pf-num {
  font-family: var(--font-heading);
  font-weight: 700;
  color: var(--primary);
  font-size: 0.8rem;
  margin-bottom: 4px;
}
.pf-title { font-weight: 600; font-size: 0.85rem; color: var(--text); margin-bottom: 4px; }
.pf-desc { font-size: 0.78rem; color: var(--text-muted); line-height: 1.6; }
.pf-arrow { align-self: center; color: var(--text-soft); font-size: 1rem; flex-shrink: 0; }
@media (max-width: 768px) {
  .policy-flow { flex-direction: column; align-items: stretch; }
  .pf-arrow { text-align: center; padding: 2px 0; }
}
</style>

这套机制的三个实现细节：

- **授权绑定 fd 而非路径**。supervisor 从子进程内存读到的路径只是「线索」，真正的授权对象是它自己用 `O_NOFOLLOW` 逐组件打开的文件描述符。注入后，子进程拿到的是一个已打开的 fd——即使路径随后被替换，也与这次授权无关。这是对 TOCTOU 的结构性防御，不是补丁式防御。
- **失败即拒绝**。路径解析失败、openat2 参数尺寸异常、通知失效、审批超时、限流触发——每个分支都走向 deny。安全模型文档把这条写成不变量：**「任何环节出错，子进程都拿不到访问」**。
- **supervisor 无特权**。它和用户同 UID、非 root、无 setuid，父进程启动后立即 `PR_SET_DUMPABLE(0)`（Linux）/ `PT_DENY_ATTACH`（macOS）自封 ptrace 面。即便它被攻破，攻击者得到的也只是用户本来就有的一切——supervisor 是**向下**的权限边界，不是向上的提权跳板。

### 4.4 关键机制二：工具沙箱三明治

nono 最具原创性的部分是工具沙箱（Tool Sandbox）：Agent 不是唯一的沙箱对象，它调用的每个工具也是。

传统沙箱给 Agent 一张「通行证」，Agent 调用的 `git`、`gh`、`curl` 全都继承同一张通行证。nono 反过来：**工具调用才是主要的能力边界**——`gh` 拿到的不是「Agent 的权限」，而是 profile 里为 `gh` 单独声明的那一小块权限。构建工具和部署工具不因为被同一个 Agent 调用就共享权力。

策略长什么样？下面这份 profile 片段是官方 README 的示例，完整表达了「Agent 可以调 gh，但 gh 只拿只读工作目录 + 一个只能做 GET 的 GitHub token」：

```json
{
  "command_policies": {
    "credentials": {
      "github-api": {
        "type": "proxy",
        "upstream": "https://api.github.com",
        "credential_key": "keyring://gh:github.com/example?decode=go-keyring",
        "env_var": "GH_TOKEN",
        "inject_header": "Authorization",
        "credential_format": "Bearer {}"
      }
    },
    "commands": {
      "gh": {
        "from": {
          "session": {
            "sandbox": {
              "fs_read": ["."],
              "credentials": [
                {
                  "name": "github-api",
                  "endpoint_policy": {
                    "default": "deny",
                    "allow": [
                      {
                        "method": "GET",
                        "path": "/repos/nolabs-ai/nono/issues/**"
                      }
                    ]
                  }
                }
              ]
            }
          }
        }
      }
    }
  }
}
```

这条链路在实现上的严谨程度值得展开：

<div class="workflow">
  <div class="workflow-step mandatory">
    <div class="step-num">1</div>
    <div class="step-cmd">execute-only 门</div>
    <div class="step-desc">会话准备期，nono 为每个受控命令在 0700 目录里 hard-link 出同名 shim，再给外层 Agent 沙箱叠加一层 Landlock 规则：可 exec 的目标被收敛到 shim 集合、初始程序及其 ELF 依赖闭包。Agent 无法替换或绕过 shim。</div>
  </div>
  <div class="workflow-step mandatory">
    <div class="step-num">2</div>
    <div class="step-cmd">inode 自证</div>
    <div class="step-desc">shim 被 exec 后连接 supervisor 的 socket，先经 SCM_RIGHTS 发送自己的可执行文件 fd 作为身份凭证；broker 校验 SO_PEERCRED 的 pid 与 fd 的 dev/inode 是否匹配注册表。替换 shim 文件会改变 inode，直接 fail-closed。</div>
  </div>
  <div class="workflow-step mandatory">
    <div class="step-num">3</div>
    <div class="step-cmd">链式策略解析</div>
    <div class="step-desc">broker 沿 /proc 祖先链解析 caller，按命令策略的 can_use 边选择「谁调用谁」对应的沙箱策略。git 内嵌的 ssh 只能拿到 git 声明的权限；Agent 直接调 ssh 仍然被拒。父策略的 deny 不可被子策略覆盖。</div>
  </div>
  <div class="workflow-step mandatory">
    <div class="step-num">4</div>
    <div class="step-cmd">验证对象 = 执行对象</div>
    <div class="step-desc">受控工具的真实二进制以 O_NOFOLLOW 打开，对同一 fd 做 fstat + SHA-256 快照比对，再用 execveat(AT_EMPTY_PATH) 直接执行这个 fd——验证的 inode 与执行的 inode 是同一个，路径 TOCTOU 不存在。</div>
  </div>
</div>

### 4.5 关键机制三：零延迟的实现与代价

「zero latency」是 nono 的营销词，工程上的真实数字是：**每次文件打开 3-10μs 的额外开销**（官方安全模型文档）。实现路径有三条：

- 不需要命名空间、镜像或设备供给——沙箱策略施加在 `fork` 出的子进程上，`exec` 即完成；
- seccomp 只过滤文件打开路径，`read` / `write` / `close` 等热路径全速放行；
- Landlock 规则在父进程侧预构建（路径全部预先打开为 O_PATH fd），子进程在 fork 后以**零分配**方式原地应用——避免 post-fork 使用 malloc 死锁。

代价同样写在文档里：`stat` 和 `access` 不被 trap，沙箱内进程可以枚举文件系统结构（文件是否存在、类型、权限）而不触发任何通知——对合作型 Agent 是可接受的折中，对敌对代码是侦察面。同类边界（Landlock 管不了 UDP、老内核上信号隔离静默降级）也全部记录在公开文档中。

### 4.6 关键机制四：凭证幽灵化

Agent 需要 API Key 调模型、调 GitHub、调云厂商。nono 的原则：**真实密钥永不进入沙箱进程的地址空间。**

实现分两步。第一步，代理把沙箱的网络收敛到 `127.0.0.1:<随机端口>`（Linux 靠 Landlock v4+ 的 per-port TCP 规则，macOS 靠 Seatbelt），沙箱内进程即使知道目标 IP 也无法直连。第二步，代理在转发边界做凭证替换：

- 沙箱内进程看到的是 phantom token（占位密钥，实为会话令牌，常数时间比较校验）；
- 代理从宿主 keyring（`keyring://`）、1Password（`op://`）、Bitwarden（`bw://`）、Apple Passwords、`env://`、`file://` 或 `cmd://` 读取真实凭证，以 `Zeroizing<String>` 保存在代理内存；
- 注入发生在 HTTPS 上游：代理可对 `api.github.com` 做 TLS 拦截（每会话生成临时 CA，私钥不落盘，有效期默认 24 小时），逐请求校验方法+路径后注入 `Authorization: Bearer <真实 token>`；
- endpoint policy 默认 deny；路径归一化有歧义（`..`、`%2e%2f`、`;` 参数）时直接拒绝——这是 2026.09 的 GHSA-8r33-hr9m-69wh 修复后的行为。

沙箱内进程只能看到本地代理地址与 phantom token，真实密钥不进入其地址空间。

### 4.7 十二个安全公告：工程品质的证据

8 个月 12 个 GHSA，通常被读作红旗。拆开逐条看，结论相反——这是披露文化成熟的表现：

<div class="table-wrap">
<table>
  <thead><tr><th>披露时间</th><th>公告</th><th>级别</th><th>一句话内容</th></tr></thead>
  <tbody>
    <tr><td>2026.05.17</td><td><a href="https://github.com/nolabs-ai/nono/security/advisories/GHSA-27vp-2mmc-vmh3" target="_blank">CVE-2026-47128</a></td><td>Medium 6.1</td><td>经用户 systemd D-Bus socket 调用 systemd-run 完全逃逸沙箱（@cgwalters 报告）</td></tr>
    <tr><td>2026.06.07</td><td><a href="https://github.com/nolabs-ai/nono/security/advisories/GHSA-hc4m-q9jh-xw4j" target="_blank">GHSA-hc4m-q9jh-xw4j</a></td><td>Medium 6.6</td><td>registry pack 验证在 provenance 元数据缺失时 fail-open</td></tr>
    <tr><td>2026.08.19</td><td><a href="https://github.com/nolabs-ai/nono/security/advisories/GHSA-gcpc-cqvp-h5c8" target="_blank">GHSA-gcpc-cqvp-h5c8</a></td><td>Low</td><td>借代理 DNS 解析做数据渗出隧道</td></tr>
    <tr><td>2026.08.20</td><td><a href="https://github.com/nolabs-ai/nono/security/advisories/GHSA-6hww-cch7-pfrh" target="_blank">GHSA-6hww-cch7-pfrh</a></td><td>Medium</td><td>Landlock v4 按端口过滤：同端口任意主机可绕过 ProxyOnly</td></tr>
    <tr><td>2026.08.20</td><td><a href="https://github.com/nolabs-ai/nono/security/advisories/GHSA-7q3j-vfmx-gc9g" target="_blank">GHSA-7q3j-vfmx-gc9g</a></td><td>Medium</td><td>主机名归一化不一致（尾点 FQDN / IDN）绕过 deny 列表</td></tr>
    <tr><td>2026.08.20</td><td><a href="https://github.com/nolabs-ai/nono/security/advisories/GHSA-vhq2-h2q7-8mmc" target="_blank">GHSA-vhq2-h2q7-8mmc</a></td><td>High</td><td>seccomp BPF 未拦截 x86 传统 syscall ABI（int 0x80 / x32），过滤器可被绕过</td></tr>
    <tr><td>2026.09.16</td><td><a href="https://github.com/nolabs-ai/nono/security/advisories/GHSA-wjv5-93q3-xm73" target="_blank">GHSA-wjv5-93q3-xm73</a></td><td>High</td><td>工具 shim 在 broker 环境变量缺失时回落为 nono 自身 CLI，可触发 live 子命令</td></tr>
    <tr><td>2026.09.16</td><td><a href="https://github.com/nolabs-ai/nono/security/advisories/GHSA-8r33-hr9m-69wh" target="_blank">GHSA-8r33-hr9m-69wh</a></td><td>High</td><td>endpoint policy 用归一化路径裁决、原始路径转发，`..` 路径绕过 L7 过滤</td></tr>
    <tr><td>2026.09.16</td><td><a href="https://github.com/nolabs-ai/nono/security/advisories/GHSA-7cwr-ghvv-24jf" target="_blank">GHSA-7cwr-ghvv-24jf</a></td><td>Medium</td><td>@git:common-dir 跟随不受约束的 .git gitdir 指针，可越权授予保护目录</td></tr>
    <tr><td>2026.09.16</td><td><a href="https://github.com/nolabs-ai/nono/security/advisories/GHSA-222m-44fg-jx8g" target="_blank">GHSA-222m-44fg-jx8g</a></td><td>Medium</td><td>@git:hooks-path 信任 Agent 自身可写的 git config 值</td></tr>
    <tr><td>2026.09.16</td><td><a href="https://github.com/nolabs-ai/nono/security/advisories/GHSA-6542-g6qc-gj95" target="_blank">GHSA-6542-g6qc-gj95</a></td><td>Medium</td><td>trust bundle 条目路径不可解析时静默跳过 Sigstore 验证</td></tr>
    <tr><td>2026.09.30</td><td><a href="https://github.com/nolabs-ai/nono/security/advisories/GHSA-q7m6-rr8w-vjff" target="_blank">GHSA-q7m6-rr8w-vjff</a></td><td>Medium</td><td>macOS 目录 deny 规则不覆盖其下 Unix socket 连接</td></tr>
  </tbody>
</table>
</div>

<div class="verdict">
  <p class="verdict-title">如何读这张表</p>
  <p>12 个公告里 3 个 High 都来自「过滤/裁决与真实执行路径不一致」这个家族（seccomp ABI 遗漏、路径归一化失配、shim 回落），1 个 CVE 来自「默认放行的 IPC 通道」。这类漏洞在沙箱项目里<strong>几乎不可能靠写代码时规避，只能靠外部报告 + 快速修复</strong>。nono 的响应模式是：私密披露 → 修复入 changelog → 每个修复配回归测试 → 安全模型文档同步更新。8 个月内全部 12 个公告都已 published，无积压。这是一个年轻安全项目最健康的状态。</p>
</div>

### 4.8 源码级细节：把安全不变量写进类型系统

两个值得记住的代码细节，都来自 `crates/nono/src/sandbox/linux.rs`（v0.79.0）。

**第一，seccomp 过滤器的架构守卫是类型级强制，而不是约定。** 2026.08 的 High 公告（int 0x80 绕过）修复后，代码把 BPF 序言做成了私有构造的类型——任何新过滤器都无法「忘记」加审计架构检查，因为安装路径的签名根本不接受裸指令列表：

```rust
// crates/nono/src/sandbox/linux.rs:1727（节选，注释保留原意）
/// 架构守卫构造被隔离：`ArchGuarded` 字段私有，唯一构造途径是本模块的两个 helper，
/// 因此任何过滤器都无法绕过序言直达安装路径——新过滤器不会因疏忽而缺失架构检查。
pub(super) struct ArchGuarded<T>(T);

fn seccomp_arch_guard(mismatch_action: u32) -> [SockFilterInsn; 6] {
    [
        // 加载 seccomp_data.arch
        SockFilterInsn { code: BPF_LD | BPF_W | BPF_ABS, k: SECCOMP_DATA_ARCH_OFFSET, .. },
        // 非本机审计架构（如 i386 int 0x80）→ 按 mismatch_action 处理
        SockFilterInsn { code: BPF_JMP | BPF_JEQ | BPF_K, jt: 1, jf: 0, k: NATIVE_AUDIT_ARCH },
        SockFilterInsn { code: BPF_RET | BPF_K, k: mismatch_action, .. },
        // 加载 syscall 号，并拒绝设置 X32_SYSCALL_BIT 的 x32 ABI 调用
        // ...
    ]
}
```

**第二，Landlock 规则锚定在 inode 而非路径。** 路径在授予时先 canonicalize，建规则时用 `O_PATH` 打开并从**同一个 fd** 取 metadata——路径在「检查」与「建规则」之间被替换的窗口被结构性消除。Linux 侧的每条规则最终是「内核记住这个 inode 及其子树，允许这些访问位」。

这两处细节的共同点：**不是靠程序员记得做对，而是靠 API 形状让做错成为不可能。** 这是安全代码和普通代码的分水岭。

## 五、竞品对比

<div class="table-wrap">
<table>
  <thead><tr><th>维度</th><th>nono</th><th>OpenShell</th><th>gVisor</th><th>Firecracker / E2B</th><th>Docker（默认）</th></tr></thead>
  <tbody>
    <tr><td><strong>隔离模型</strong></td><td>能力限制（共享内核，无边界）</td><td>壳（容器/VM）+ 壳内逐请求治理</td><td>用户态内核截获 syscall</td><td>独立 guest 内核（硬件虚拟化）</td><td>namespace + cgroup 共享内核</td></tr>
    <tr><td><strong>启动开销</strong></td><td>3-10μs（无镜像/命名空间供给）</td><td>容器/VM 启动 + 代理初始化</td><td>进程级</td><td>约 80-125ms（microVM）</td><td>约 1-3s</td></tr>
    <tr><td><strong>动态授权</strong></td><td>seccomp-notify + fd 注入 + 审批</td><td>OPA 逐请求裁决 + 策略提案闭环</td><td>无（静态）</td><td>无</td><td>无</td></tr>
    <tr><td><strong>授权粒度</strong></td><td>文件 / 端口 / 命令 / 凭证路由 / L7</td><td>进程级（TOFU 哈希）+ L7</td><td>容器级</td><td>虚拟机级</td><td>容器级</td></tr>
    <tr><td><strong>凭据处理</strong></td><td>phantom token + 代理注入，密钥不进沙箱</td><td>Gateway 托管 + inference.local 注入</td><td>不涉及</td><td>环境变量（沙箱内可见）</td><td>环境变量 / secret 挂载</td></tr>
    <tr><td><strong>适用场景</strong></td><td>本机开发 / CI，零设置细粒度护栏</td><td>企业治理平台（策略即代码）</td><td>高密度多租户 Serverless</td><td>不可信代码的强隔离执行</td><td>通用容器负载</td></tr>
    <tr><td><strong>成熟度（2026.10）</strong></td><td>alpha（官方不推荐生产），12 GHSA</td><td>alpha（single-player），7K+ Stars</td><td>生产级（GKE Sandbox 等）</td><td>生产级（AWS Lambda 等）</td><td>生产级</td></tr>
  </tbody>
</table>
</div>

这张表要回答的不是「谁更好」，而是**两个坐标之间的空档**：没有方案同时做到「共享内核的低开销」与「单次调用的细粒度」。nono 填的是这个空档，代价是放弃隔离强度。

## 六、战略分析

### 6.1 信任资产：Sigstore 血统

nono 的创始人 Luke Hinds 是 [Sigstore](https://sigstore.dev) 的联合创始人——PyPI、npm、Homebrew 背后的软件签名标准。这个背景不是 PR 素材，而是 nono 战略的支点：**Agent 沙箱品类里，「profile 从哪里来」和「沙箱有多严」同样重要。** 沙箱把 Agent 锁进一个小圈，圈里的一切来自 profile——profile 若被投毒，锁得越严反而越危险。

nono 把 Sigstore 那套供应链机器整个搬了过来：profile 以 pack 形式从 [registry.nono.sh](https://registry.nono.sh) 分发，发布走 agent-sign GitHub Action + Sigstore keyless 签名，安装时以 lockfile + trust bundle 验证 provenance，签名者身份 pin 在 lockfile 里。沙箱与签名共享同一支团队的血统，这是它在「Agent 供应链安全」叙事上的独特位置。

### 6.2 商业逻辑：占领「开发者入口」

nono 本身免费开源，盈利路径在两侧：

- **Registry**：profile 分发是天然的流量入口——每个 `nono run --profile nolabs-ai/claude` 都是一次品牌触达；
- **nolabs 平台**：v0.79.0 新增的 `nono run --remote`（远程 workspace、持久会话、`nono connect` 远程附加）指向企业产品——把「单机沙箱」升级为「Agent 运行的系统记录（system of record）」，卖给安全、平台与合规团队。

<div class="verdict">
  <p class="verdict-title">战略意图（推断）</p>
  <p>用「零设置 + 零延迟 + 开源免费」占领开发者本机的 Agent 入口，用「Sigstore 血缘」建立 profile 供应链的信任壁垒，再向上销售把审计、合规、远程编排做成账本的企业平台。<strong>沙箱是获客层，审计与信任是付费层</strong>——这与容器时代 Docker CE / Docker EE 的路径同构。</p>
</div>

### 6.3 采用方与生态动作

<div class="table-wrap">
<table>
  <thead><tr><th>生态层</th><th>合作方 / 动作</th></tr></thead>
  <tbody>
    <tr><td><strong>采用方背书</strong></td><td>Datadog（Staff Security Engineer James Carnegie）、Okta（Principal Engineer Leonardo Zanivan）公开引用；OpenAI 的 Clint Gibler 评价「OS-specific 安全原语 + 内置 profile + 可定制策略」</td></tr>
    <tr><td><strong>标准与治理</strong></td><td>OpenSSF Best Practices passing；OSTIF 第三方安全审计定于 2026 Q3；计划申请 CNCF sandbox</td></tr>
    <tr><td><strong>分发渠道</strong></td><td>Homebrew、Nix flake、AUR、RPM、deb、Chainguard 镜像；发布产物带 Sigstore provenance + SHA256SUMS</td></tr>
    <tr><td><strong>语言绑定</strong></td><td>Rust 库 + C FFI + Python / TypeScript / Go 官方绑定</td></tr>
  </tbody>
</table>
</div>

值得注意的一个执行细节：Datadog 与 Okta 的引用都落在「细粒度 per-command 策略 + 凭证管理」上，而不是「隔离强度」——说明企业侧买单的点正是能力模型，而非又一个容器。

## 七、风险与局限性

<div class="callout callout-rose">
  <div class="callout-label">六类风险（截至 2026.10.07）</div>
  <p><strong>① 官方自述 alpha</strong>：SECURITY.md 明确「安全保证尚不稳定，不推荐生产使用」，GOVERNANCE 同此声明；12 个公告中的 3 个 High 都出现在最近 8 个月。</p>
  <p><strong>② 默认姿态偏宽</strong>：网络默认允许（`--block-net` 才关闭）；Linux 上 AF_UNIX socket 默认直通（issue #1901，`linux.af_unix_mediation` 默认 Off）——docker.sock、ssh-agent、D-Bus 可达性取决于 deny 列表而非允许列表；PTY attach 仅校验同 UID。三处都是「默认打开、需要用户主动收紧」。</p>
  <p><strong>③ 内核机制边界</strong>：Landlock 管不了 UDP；老内核上信号隔离静默降级；macOS 侧 Seatbelt 黑名单式拦截 keychain daemon、任何 localhost 端口授权即附带空泛的 bind 允许。</p>
  <p><strong>④ 代理层工程债</strong>：读/空闲路径全线无超时（仅 max_connections=256 兜底，Slowloris 可耗尽连接槽）；header 重放逻辑 4 处复制且 CRLF 校验不一致；AWS SigV4 仅 HTTP/1.1 拦截路径实现（h2/反向路径返回 501）。</p>
  <p><strong>⑤ bus factor 低</strong>：3 名维护者全部来自 nolabs 一家公司，第一作者占前 30 名提交的 56%；继任机制写进了 GOVERNANCE，但未经实践检验。</p>
  <p><strong>⑥ 生态空档期</strong>：registry 浏览页截至 2026.10.07 仍显示 0 packs，且落地页残留旧品牌「Always Further」——官网宣称的「所有主流 Agent profile」尚未在注册表落地，组织迁移（8 月）的收尾未完成。</p>
</div>

其中最值得用户关注的是第 ② 类：**文档异常诚实，但诚实≠默认安全。** nono 的默认值哲学是「兼容优先」——Agent 需要网络与 IPC，收紧动作由用户显式完成。把它当「装上即安全」的开关使用，会得到错误预期。

## 八、结语：趋势判断

Agent 沙箱品类在过去 8 个月里的分化速度超过预期：执行沙箱（E2B）、治理运行时（OpenShell）、能力沙箱（nono）三个坐标都已出现代表性实现，且各自拿到了不同客户画像的验证——Serverless 平台、企业合规团队、个人开发者。

nono 代表的方向值得单独记录：**把安全控制从「环境边界」下沉到「内核授权」，把延迟成本从「秒级供给」压到「微秒级裁决」。** 它的技术选择（Landlock + seccomp-notify + fd 注入）在 Linux 上可以复刻——OpenShell 已与它同源——但「工具即边界」的三明治模型、每会话临时 CA 的凭证幽灵化、把审计完整性边界逐条写进文档的克制，目前仍是唯一成体系的实现。

三个趋势判断（以下为推断，置信度已标注）：

1. **能力沙箱不会替代隔离沙箱，而是成为隔离沙箱的内层**（置信度高）。nono 官方部署矩阵已经写明组合方式；OpenShell 的「壳+锁」也在做同一件事。最终形态大概率是：microVM/容器管边界，能力层管边界内粒度。
2. **「零设置」是本地市场的护城河，「审计」是企业市场的入场券**（置信度中）。开发者不会为沙箱改工作流，`curl | sh` 的零设置体验是 nono 对抗 OpenShell 生态位的关键；而企业侧的门票是 OSTIF Q3 2026 审计结果与 1.0（NEP-0001 已进入 API 冻结议程）。
3. **12 个公告是过程，不是结果**（置信度高）。沙箱品类的安全成熟度由「披露-修复-回归测试」的循环速度定义，而不是零漏洞的静态记录。nono 目前是这个循环里最值得跟踪的观察样本。

值得跟踪的信号：OSTIF 审计报告、v1.0 与 API 冻结、registry packs 实际数量、Windows NEP 落地状态。

GitHub: [https://github.com/nolabs-ai/nono](https://github.com/nolabs-ai/nono)

```bash
# macOS / Linux
brew install nono
# 或
curl -fsSL https://nono.sh/install.sh | sh

# 注册表拉取 profile 并运行（网络策略请显式配置）
nono search opencode
nono run --profile nolabs-ai/opencode -- opencode
```

<div class="callout callout-amber">
  <div class="callout-label">备注</div>
  <p>本文基于截至 2026 年 10 月 7 日的源码（v0.79.0）、官方文档与 GitHub 公开数据撰写。nono 迭代速度约 2.3 天一个版本，细节可能已变化；安全相关的默认值（网络、AF_UNIX 中介）请以最新文档为准。</p>
</div>
