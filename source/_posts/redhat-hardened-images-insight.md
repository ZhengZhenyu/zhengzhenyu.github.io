---
title: Red Hat 深度洞察：Zero CVEs, Zero Cost——87,487 个 CVE 逼出的容器供应链新基础设施
date: 2026-10-08 21:00:00
tags: [Red Hat, Fedora, 容器安全, 供应链安全, CVE, AI Agent, OSS-EU, 开源]
categories: 云原生
description: 从 OSS-EU 2026 主题演讲出发，拆解 Red Hat Hardened Images 的零 CVE 机制与 Fedora Hummingbird 的 agentic Linux 战略
---

## 一、引言：一个数字与一场演讲

Open Source Summit Europe 2026 的 Red Hat keynote 开场只放了一个数字：**87,487**。

这是 NVD 过去 12 个月收录的 CVE 总数（排除 rejected）——平均每天 240 个，同比 +82%。讲者 Harrison Ripps（Red Hat Director of Engineering）把这次演讲命名为《Zero CVEs, Zero Cost》，背后的数据基准是其 2026-10-01 官方博客《Zero CVEs at delivery》。

演讲的叙事链条很短：CVE 通胀让「构建一次、部署数月」的容器镜像变成静默累积漏洞的载体；Red Hat 的答案是**免费、无订阅的加固镜像目录 Red Hat Hardened Images**——发布时点零已知 CVE、SLSA Level 3、cosign 签名、每个镜像附 SBOM，并以「80% 修复 7 天内交付、管线中位数 18 小时」的 SLO 持续维持。同一条产品线里还有 Fedora Hummingbird：一个为 AI agent 设计的容器原生滚动发行版。

本文基于现场演讲材料、两篇官方新闻稿（2026-05-12 Red Hat Summit）、官方博客与文档撰写；全部关键数据经独立核验，口径差异在正文标注。

<div class="verdict">
  <p class="verdict-title">基本判断</p>
  <p>Red Hat 做的是<strong>把自家安全响应基础设施（CVE 管道、advisory 体系、构建工厂）产品化并免费开放</strong>：用「零 CVE × 零成本 × 无订阅」这个市场当前唯一的组合抢占容器镜像入口，再用 Fedora Hummingbird 押注「agent 将主导基础软件选型」的下一轮。它不是发布了一个镜像目录，而是把「吸收 CVE 漂移」变成了一门基础设施生意。</p>
</div>

<div class="callout callout-amber">
  <div class="callout-label">核心术语速览（非专业读者可先读此节）</div>
  <p><strong>distroless</strong>：不带 shell、包管理器与任何「应用用不到」组件的容器镜像构建风格。攻击面与扫描噪声最小，代价是容器内难以排障。</p>
  <p><strong>SBOM（Software Bill of Materials）</strong>：软件的物料清单，逐组件记录版本与来源。镜像交付 SBOM 是供应链透明度与合规审计的基线。</p>
  <p><strong>SLSA（Supply-chain Levels for Software Artifacts）</strong>：供应链完整性等级框架，Level 3 要求构建在加固平台上执行、产出 provenance（构建来源证明）。</p>
  <p><strong>cosign</strong>：Sigstore 的签名工具，对镜像做 keyless 密码学签名并可验证；Red Hat 用固定发布密钥对每个镜像签名。</p>
  <p><strong>Konflux</strong>：Red Hat 的云原生软件工厂（基于 Tekton 等），提供 SLSA L3 合规构建；本文两个产品共用它的流水线。</p>
  <p><strong>VEX（Vulnerability Exploitability eXchange）</strong>：声明「某 CVE 是否影响某产品」的机器可读格式（CSAF 是其载体），让下游免于手工 triage。</p>
  <p><strong>image-based 发行版</strong>：整机操作系统以 OCI 镜像交付、原子更新+回滚的发行模式（bootc 体系）；与「逐包安装」的传统 RPM 发行版相对。</p>
</div>

## 二、为什么是现在：CVE 通胀 × 法规时钟 × 镜像漂移

### 2.1 CVE 通胀曲线

<div class="growth-chart">
  <img src="cve-inflation.svg" alt="NVD 年发布 CVE 量柱状图：2022 年 2.5 万、2023 年 2.9 万、2024 年 4.1 万、2025 年 5.0 万、2026 年年化超 10 万" style="width:100%">
</div>

按 NVD 公开数量：2022 年 25,083 个，2023 年 29,065 个，2024 年 40,704 个，2025 年 49,972 个。Ripps 博客给出的滚动口径是过去 12 个月 87,487 个——独立数据源（CVEDB，2026-10-08 快照）交叉验证自洽：2026 年 1-9 月已发布 72,811 个，日均 271 个，**年化超过 10 万**。演讲的「240/天、+82%」与「87,487」全部对得上（240×365≈87,600）。

<div class="stats-grid">
  <div class="stat-card">
    <div class="stat-num">87,487</div>
    <div class="stat-label">NVD 近 12 个月 CVE（2026.10 口径）</div>
  </div>
  <div class="stat-card">
    <div class="stat-num">+82%</div>
    <div class="stat-label">滚动 12 个月同比增速</div>
  </div>
  <div class="stat-card">
    <div class="stat-num">18h</div>
    <div class="stat-label">加固镜像修复管线中位数（官方博客）</div>
  </div>
  <div class="stat-card">
    <div class="stat-num">65/167</div>
    <div class="stat-label">镜像目录实测：镜像/变体数（2026.10.08）</div>
  </div>
</div>

### 2.2 法规时钟：CRA 的第一颗牙齿

EU CRA（(EU) 2024/2847）的报告义务已于 2026-09-11 生效：被积极利用的漏洞须 24 小时预警、72 小时详细报告；其余义务 2027-12-11 全面适用。同一周内，OpenSSF 在大会另一场演讲展示的数字是「66% 的受访者不熟悉 CRA、54% 分不清 manufacturer 与 steward」——合规压力在加速，而理解度没有跟上。

### 2.3 镜像漂移：容器时代最沉默的风险

演讲用一个场景定义问题：镜像 push 进 registry 后再没更新，部署数月，期间每天都有新 CVE 落进它的包清单——构建镜像与部署镜像同时变旧，而开发者无从感知。这正是「发布时干净」与「运行中安全」之间的鸿沟：Sysdig 的数据显示 87% 的容器镜像含高危/严重 CVE；Chainguard 的研究则指出 98% 的容器 CVE 位于下载量前 20 的镜像之外——长尾才是重灾区。IDC 研究经理 Katie Norton 在官方新闻稿中的背书把这句话说透了：**「base images 是供应链风险的集中点，而继承来的漏洞往往落在没有直接修复路径的开发者头上。」**

## 三、深度分析 ①：Red Hat Hardened Images

### 3.1 血缘与时间线

<div class="table-wrap">
<table>
  <thead><tr><th>时间</th><th>事件</th></tr></thead>
  <tbody>
    <tr><td><strong>2025.11.19</strong></td><td>Project Hummingbird 早期访问计划（订阅专属）</td></tr>
    <tr><td><strong>2026.04.30</strong></td><td>GA 博客：45+ 镜像 / 150+ 变体，免费开放</td></tr>
    <tr><td><strong>2026.05.12</strong></td><td>Red Hat Summit 新闻稿正式宣布 GA + Fedora Hummingbird</td></tr>
    <tr><td><strong>2026.10.01</strong></td><td>Ripps 博客《Zero CVEs at delivery》：87,487 / SLO / 18 小时中位数</td></tr>
    <tr><td><strong>2026.10</strong></td><td>OSS-EU 2026 keynote《Zero CVEs, Zero Cost》；目录实测 65 镜像 / 167 变体</td></tr>
  </tbody>
</table>
</div>

### 3.2 一个容易被误读的前提：它不是 UBI

Red Hat Hardened Images（RHI）不是 RHEL/UBI 的「去包管理器版」。它的 RPM 是**从 Fedora（Rawhide）spec 派生的独立构建**（dist tag 形如 `curl-8.22.0-1.1.hum1`），在 Hummingbird 自有 monorepo 中构建，镜像 label 采用与 UBI 相同的免费再分发许可模型。这意味着：内容血缘是 Fedora 上游，供应链血缘是 Red Hat 的 Konflux 工厂——「上游速度」与「企业证据链」在同一产品里并存。

「零已知 CVE 出厂」的实现由四个机制构成：

<div class="arch-grid">
  <div class="arch-card arch-ui">
    <div class="arch-card-title">构建确定性</div>
    <div class="arch-card-items">锁文件 &nbsp;·&nbsp; hermetic 构建 &nbsp;·&nbsp; Konflux SLSA L3</div>
    <div class="arch-card-desc">rpms.lock.yaml 钉死每个 RPM 的精确版本、URL 与校验和；构建无外网，provenance 可逐位重现</div>
  </div>
  <div class="arch-card arch-ctrl">
    <div class="arch-card-title">最小化架构</div>
    <div class="arch-card-items">static &nbsp;·&nbsp; core-runtime &nbsp;·&nbsp; default &nbsp;·&nbsp; builder</div>
    <div class="arch-card-desc">static 仅 CA 证书+时区+非 root 用户（无 libc）；默认非 root（UID 65532）；builder 变体保留 dnf 供排障</div>
  </div>
  <div class="arch-card arch-data">
    <div class="arch-card-title">修复管线</div>
    <div class="arch-card-items">确定性 backport &nbsp;·&nbsp; AI 只读判定 &nbsp;·&nbsp; 人工兜底</div>
    <div class="arch-card-desc">上游出补丁即自动重建重发布；官方 SLO 80% 修复 7 天内、管线中位数 18 小时</div>
  </div>
  <div class="arch-card arch-policy">
    <div class="arch-card-title">供应链证据</div>
    <div class="arch-card-items">cosign 签名 &nbsp;·&nbsp; SPDX SBOM &nbsp;·&nbsp; CSAF VEX</div>
    <div class="arch-card-desc">每镜像 cosign 签名（Red Hat release key 3）+ SPDX 2.3 SBOM + VEX feed，全部可编程验证</div>
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

:root[data-theme="dark"] .arch-ui     .arch-card-title { color: #a5b4fc; }
:root[data-theme="dark"] .arch-ctrl   .arch-card-title { color: #c4b5fd; }
:root[data-theme="dark"] .arch-data   .arch-card-title { color: #fb923c; }
:root[data-theme="dark"] .arch-policy .arch-card-title { color: #22d3ee; }
</style>

### 3.3 修复管线：18 小时中位数是怎么来的

<div class="growth-chart">
  <img src="cve-pipeline.svg" alt="加固镜像 CVE 修复管线：NVD 记时、确定性 backport、AI 只读判定、Konflux 构建、重建发布、VEX 披露，SLO 24/72/168 小时，中位数 18 小时" style="width:100%">
</div>

管线中两个设计值得拆开看。第一，**AI 被约束在只读位置**：`hummingbird-cve-agent` 的修复路径是确定性的——抓上游 commit 生成 patch 与 spec 变更，提交 draft MR 进 Konflux 验证；AI（Gemini）只对模糊案例做只读判定，每票最多 5+1 次工具化调用，无法自动处理即转人工。这呼应了 OpenSSF 那场演讲的核心主张「Fixes are valuable，但 20-40% 的 AI 补丁语义错误」——Red Hat 的管线设计把 AI 放在「判定」而非「书写」的位置。第二，**SLO 从 NVD 发布时刻记时**：CVE 出现即启动 R-Time 时钟（24/72/168 小时三档），逐包漏洞 feed 由 Red Hat Product Security 维护，修复经 RHSA/RHBA advisory 与 CSAF VEX 公开。

「零 CVE」的语义边界同样写进了官方措辞：**free of known CVEs when posted（发布时点无已知 CVE）**。发布后新 CVE 照常出现——实测 2026-10-08 当天，`go:1.27.1` 镜像上就有 2026-10-06 新出现的 13 个 CVE 待收敛。持续保障靠的是每日重建与 SLO，不是魔法。

### 3.4 两行 Dockerfile 的效果

演讲的效果演示是 Ripps 自己的一个 Go 应用（2010 年写的桌游随机星区生成工具）：把部署镜像从 218MB 压到 35MB（-84%），Dockerfile 只改两行——构建期换用 `hi/go` builder 变体、运行期落到 `hi/static` 镜像。最小化的收益不只是体积：没有 shell、没有包管理器、没有用不到的库，扫描噪声随之消失，安全团队可以把时间花在「应用真实依赖」的漏洞上。

值得说明的运维代价同样真实：浮动 tag 意味着同 tag 的 digest 会随安全重建变化，生产需要 digest pinning + 依赖更新工具（如 Renovate）追踪；无 shell 的容器排障要走 builder 变体或挂载调试工具；非 root 默认（UID 65532）要求卷挂载属主适配。

```bash
# 拉取（匿名、无注册墙）
docker pull registry.access.redhat.com/hi/go:1.27

# 验证签名与来源
cosign verify --key security.access.redhat.com/data/63405576.txt \
  registry.access.redhat.com/hi/go:1.27

# 下载 SBOM（SPDX 2.3，OCI artifact 附带）
cosign download sbom registry.access.redhat.com/hi/go:1.27
```

```dockerfile
# 效果演示的等价结构（示意）：构建期用 builder 变体，运行期落到 static
FROM registry.access.redhat.com/hi/go:1.27 AS build
# ... 编译 Go 应用 ...

FROM registry.access.redhat.com/hi/static:latest
COPY --from=build /app /app
USER 65532
ENTRYPOINT ["/app/server"]
```

## 四、深度分析 ②：Fedora Hummingbird——「agentic Linux」

### 4.1 一个为 agent 设计的发行版

Fedora Hummingbird Linux 与 RHI 同期发布（2026-05-12），托管在 Fedora 社区。它是一个**image-based、滚动发布的容器原生 OS**：整机以 OCI 镜像交付（bootc 体系），基于 Fedora Rawhide（>95% 包），原子更新与回滚、只读根文件系统，内核跟随 CKI 的 Always Ready Kernel。在容器、VM、裸机上都能跑。

「agentic」的官方定义有两层，都值得逐字读：

- **消费侧**：新闻稿原文——「在 agentic 时代，操作系统的初次选择将越来越多地由开发实验阶段的 AI agent 做出。如果发行版要求注册墙或人工验证，agent 和创新都会停滞。」所以 Hummingbird 支持**匿名、agent 驱动的拉取**，免登录、即时部署；文档站提供 llms.txt / llms-full.txt 并支持 `Accept: text/markdown` 协商——机器可读文档是「agent-friendly」的具体实现。
- **制造侧**：发行版由一个「lights-out、agent-native 软件工厂」交付——后台维护与特性集成由 AI agent 在 human-in-the-loop 监督下完成，与 RHI 共用 Konflux 流水线，共享「零已知 CVE + 完整 SBOM」的加固基础。

Red Hat Enterprise Linux 副总裁 Gunnar Hellekson 的判断是这场发布的总纲：**「Linux 市场已经分裂——IT 运维团队需要 RHEL 的十年稳定，而构建者（人与 agent）需要上游速度与镜像式工作流。」**

### 4.2 双轨 Linux 战略

<div class="table-wrap">
<table>
  <thead><tr><th>维度</th><th>Red Hat Enterprise Linux</th><th>Fedora Hummingbird</th><th>Hardened Images</th></tr></thead>
  <tbody>
    <tr><td><strong>受众</strong></td><td>IT 运维（生产系统）</td><td>构建者（人与 agent，实验/PoC）</td><td>应用开发者（容器基础镜像）</td></tr>
    <tr><td><strong>节奏</strong></td><td>数十年生命周期、版本化</td><td>滚动发布、上游速度</td><td>滚动 stream（Go 1.27/1.26/1.25 并行）</td></tr>
    <tr><td><strong>形态</strong></td><td>RPM 发行版</td><td>image-based OS（bootc）</td><td>distroless 容器镜像</td></tr>
    <tr><td><strong>安全模型</strong></td><td>RHSA 生命周期维护</td><td>同工厂零 CVE 基础 + 滚动更新</td><td>发布时点零 CVE + 18h 中位数 SLO</td></tr>
    <tr><td><strong>商业化</strong></td><td>订阅</td><td>免费 + 计划中的 Cooperative Community Support</td><td>永久免费、无订阅</td></tr>
  </tbody>
</table>
</div>

漏斗路径被新闻稿明示：developer laptop → Hummingbird PoC → RHEL 与 OpenShift Virtualization 生产。免费层是入口，不是终点。

### 4.3 冷静看待：品牌热度之下的社区现实

需要如实记录的另一面：Fedora Hummingbird 目前**不是 Fedora 官方 Edition**，处于社区孵化（SIG）阶段——SIG 首次会议是 2026-05-28；发布时下载链接曾指向需登录的错误地址（FPL Jef Spaleta 回应为技术失误）；Fedora 社区的质疑集中在品牌流程（商标审批走的是未公开 ticket、Fedora Innovation Lifecycle 提案当时未经理事会批准）。这些是「早期预览」的正常噪声，但也说明：**「agentic Linux」的产品化进程比新闻稿措辞要慢半拍。**

对「agent 会主导 OS 选型」这个假设本身，判断要分两层：需求侧是真实的——编码 agent 确实在批量拉镜像建环境；但它们今天的选择是 Docker Hub 模板与 devcontainer，而不是「发行版品牌」。Hummingbird 想成为 agent 的默认 OS，胜负手不在发行版本身，而在云默认镜像位与工具链生态的接入。

## 五、竞品对比：加固镜像品类矩阵

<div class="table-wrap">
<table>
  <thead><tr><th>条目</th><th>零 CVE 承诺</th><th>SLSA/签名/SBOM</th><th>免费层</th><th>关键差异</th></tr></thead>
  <tbody>
    <tr><td><strong>Red Hat Hardened Images</strong></td><td>发布时点零已知 CVE（目标，非契约）</td><td>SLSA 3 + cosign + SPDX SBOM + VEX</td><td>全免费、无订阅</td><td>「零 CVE × 零成本」组合市场唯一；目录最小（65/167）</td></tr>
    <tr><td><strong>Chainguard Containers</strong></td><td>零 CVE 定位 + 契约 SLA（critical 7 天/其他 14 天）</td><td>SLSA 3 + Sigstore + 每日重建</td><td>约 50 个（每组织限 5，仅 latest）</td><td>商品化最完整（3,000+ 镜像、FIPS/STIG、策略平台）；商业版 $19K 起</td></tr>
    <tr><td><strong>Google distroless</strong></td><td>无承诺、无 SLA</td><td>仅 keyless cosign，无 SLSA/SBOM</td><td>全免费（约 12 个镜像）</td><td>品类开创者，社区项目水准</td></tr>
    <tr><td><strong>Ubuntu Chiselled</strong></td><td>无口号（继承 Ubuntu 5 年维护）</td><td>未主打</td><td>免费；长维护绑 Ubuntu Pro</td><td>官方预构建少（.NET/JRE），靠 Chisel 自切</td></tr>
    <tr><td><strong>SUSE BCI</strong></td><td>无口号（SLE 级 CVE 缓解）</td><td>SLSA 3 + 双格式 SBOM + provenance</td><td>免费 + 自由再分发</td><td>传统厂商中证据链宣称最强</td></tr>
    <tr><td><strong>Docker DHI Community</strong></td><td>免费加固镜像层（2025 底推出）</td><td>SLSA Build L3</td><td>免费，50 万+ 日拉取（2026.04）</td><td>多发行版不绑定自有 OS，Apache 2.0</td></tr>
    <tr><td><strong>对照组：发行版镜像 + Trivy/Grype</strong></td><td>无（Sysdig：87% 镜像含高危 CVE）</td><td>需自建 CI 管线</td><td>工具免费，人力成本自担</td><td>最普遍的 DIY 路线</td></tr>
  </tbody>
</table>
</div>

三条观察：

1. **「零 CVE × 零成本 × 无订阅」组合当前唯一**。Chainguard 有零 CVE 定位与契约 SLA 但收费；SUSE BCI 免费且 SLSA 3 但无零 CVE 承诺；distroless 免费但无 SLSA/SBOM/SLA。Red Hat 是唯一把三者打包并以 RHEL 供应链信誉背书的一方。
2. **「小」已经不是壁垒，修复管线与证据链才是**。Google 定义了 distroless 品类却停留在社区项目水准；后来者全在「distroless + 供应链证据 + 修复 SLO」上商品化——这恰是发行版厂商对纯安全厂商的结构性优势（上游协调能力、advisory 体系、构建工厂）。
3. **RH 的短板与 Chainguard 的防御空间**：目录规模（65 对 3,000+）与「发布时点零 CVE」的非契约性质。若 Red Hat 把 SLO 数字写进公开承诺，将实质性挤压 Chainguard 的高端叙事；在此之前，需要合同 SLA 的采购方仍会选 Chainguard。

## 六、战略分析

<div class="verdict">
  <p class="verdict-title">战略意图（推断）</p>
  <p>这是一条教科书式的<strong>PLG 漏斗</strong>：免费 Hardened Images（获客）→ 免费 Fedora Hummingbird（agent 实验层，Cooperative Community Support 是第一变现点）→ RHEL / OpenShift（核心订阅）→ Lightwell（2026-05-28 发布，50 亿美元投入、美银/花旗/高盛等 11 家华尔街机构背书，卖「带 SLA 的依赖 backport 与上游责任承接」）→ Red Hat AI 3.4（agent 时代的推理平台）。「Zero CVEs, Zero Cost」是漏斗入口的话术，官方措辞「at delivery」给营销冲击力与工程严谨性之间留了缓冲。</p>
</div>

三条支撑证据：

- **合规防御与获客同构**：Red Hat 作为商业分销商大概率落入 CRA 的 manufacturer 范畴——把 SBOM、SLSA 3、cosign、VEX 做进免费层，既是合规防御，也是「信任即产品」的获客叙事。CRA 报告义务 2026-09-11 已生效，这个时间点恰好卡在 keynote 前四周。
- **AI 的摆放位置**：Hummingbird 的修复管线让 AI 做只读判定与自动化协调，把补丁书写留给确定性路径与人工——与 OpenSSF 在同期大会演讲的「20-40% AI 补丁语义错误」结论相互印证。Red Hat 在「用 AI 做安全」上的克制本身是差异化。
- **agent 叙事的两端**：Red Hat 与 NVIDIA 在 Summit 2026-05 宣布扩展合作至 AI agent sandboxing——Red Hat 同时押注「agent 在 Linux 之上构建」（Hummingbird，供给侧）与「agent 在 Linux 之内受限运行」（沙箱，安全侧）。这是同一趋势的两面。

## 七、风险与局限

<div class="callout callout-rose">
  <div class="callout-label">四类风险（截至 2026.10.08）</div>
  <p><strong>① 「零 CVE」的语义边界</strong>：发布时点零已知 CVE ≠ 持续零 CVE。实测 go:1.27.1 在 2026-10-06 新 CVE 出现后短暂非零；持续保障依赖每日重建与 SLO 收敛。采购方若按「永远零 CVE」理解，会得到错误预期。</p>
  <p><strong>② 免费 ≠ 有支持</strong>：镜像永久免费，但 SLA、LTS（如 Java 11 等 EOL 场景）与商业支持都绑订阅；无订阅用户拿到的是「目标」而非「承诺」。上游 EOL 后的长生命周期方案仍在规划。</p>
  <p><strong>③ 运维迁移成本</strong>：无 shell/无 PM、非 root 默认、浮动 tag 要求 digest pinning 与 Renovate 纪律——对没有供应链工程习惯的团队是真实门槛。</p>
  <p><strong>④ Hummingbird 的社区不确定性</strong>：SIG 孵化状态、品牌流程争议、Innovation Lifecycle 未批——「agentic Linux」的产品化进度慢于新闻稿措辞；对「agent 主导 OS 选型」的押注依赖云默认镜像位与工具链接入，尚未落地。</p>
</div>

## 八、结语：趋势判断

三个趋势判断（以下为推断，置信度已标注）：

1. **「发布时点零 CVE + 修复 SLO」将取代「扫描报告」成为镜像采购的默认标准**（置信度高）。免费层已经把竞争拉到这里：Docker 免费加固层 50 万日拉取、Red Hat 全免费、Chainguard 契约 SLA——「有没有扫描报告」不再是卖点，「修复多快、证据链多完整」才是。下一阶段的竞争指标是公开的修复中位数与 SLO 违约率。
2. **操作系统开始为 agent 设计，但胜负手在发行版之外**（置信度中高）。Hummingbird 的匿名拉取与 llms.txt 是「agent 消费 Linux」的正确架构响应；但 agent 今天的选择是 Docker Hub 模板与 devcontainer。真正的战场是云默认镜像位、MCP/工具链生态，以及「agent 在 Linux 之内能安全做什么」的沙箱层（nono、OpenShell、Red Hat-NVIDIA 的 sandboxing 合作）——发行版、运行时与沙箱在 agent 基础设施层会师。
3. **CRA 把「上游协调能力」变成发行版厂商的结构性资产**（置信度中高）。manufacturer 责任 + 开源 steward 豁免的模糊地带，让「能替客户接走上游责任」的一方获得定价权——Lightwell 的 50 亿美元投入与华尔街背书是这个判断的先行注脚；合规不确定性的另一面是：把 SBOM/SLSA/VEX 做进免费层的厂商，正在把合规成本转化为获客成本。

值得跟踪的信号：SLO 数字是否进入公开文档或免费承诺、Hummingbird 是否获得 Fedora 官方 Edition 地位、目录规模增速（65 → 100 → 300？）、Red Hat-NVIDIA sandboxing 合作的落地形态、以及 Chainguard 对「免费零 CVE」的定价回应。

---

**演讲材料**：《Zero CVEs, Zero Cost——Red Hat Hardened Images》，N. Harrison Ripps（Red Hat Director of Engineering），Open Source Summit Europe 2026 keynote；数据基准为其官方博客《Zero CVEs at delivery》（2026-10-01）。产品公告：《Red Hat Hardened Images》（GA，2026-05-12）与《Fedora Hummingbird Linux》（2026-05-12），Red Hat Summit 新闻稿。本文全部数据经独立核验，口径差异已在正文标注。

<div class="callout callout-amber">
  <div class="callout-label">备注</div>
  <p>本文基于截至 2026 年 10 月 8 日的官方材料与实测数据撰写。目录实测（65 镜像/167 变体）来自当日目录 API；演讲幻灯片显示「中位数 17 小时」，官方博客口径为 18 小时，正文以官方为准。Red Hat 各产品仍在快速迭代中。</p>
</div>
