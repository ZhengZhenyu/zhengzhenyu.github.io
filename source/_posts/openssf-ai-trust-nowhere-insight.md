---
title: OpenSSF 深度洞察：AI Everywhere, Trust Nowhere？——当 AI 同时成为生产力、审查者与攻击面
date: 2026-10-07 23:30:00
tags: [AI, OpenSSF, 开源安全, 供应链安全, AIxCC, 安全, OSS-EU, 开源]
categories: AI
description: 从 OSS-EU 2026 主题演讲出发，拆解 OpenSSF 的 AI 开源安全三问三答与「证明大于信任」原则
---

## 一、引言：一场 52 页的立场宣言

2026 年 10 月 7 日，Open Source Summit Europe 在布拉格开幕。同一天，curl 维护者 Daniel Stenberg 发布博客《[Twenty-two pending curl vulnerabilities](https://daniel.haxx.se/blog/2026/10/07/twenty-two-pending-curl-vulnerabilities/)》——curl 项目手头积压 22 个待披露 CVE，全年预计接近 50 个，均为历史纪录。

同一天上午，OpenSSF CTO 兼首席安全架构师 **CRob**（Christopher Robinson）与 Chief of Staff **Adrianne Marcum** 在大会发表主题演讲《[AI Everywhere, Trust Nowhere?](https://github.com/SecurityCRob/presentations)——Open Source Security in the Age of AI》（52 页，CC-BY-4.0）。Stenberg 的博客是问题的现场证据，这场演讲是 OpenSSF 的回应。

演讲把「AI 与开源安全」收敛为三个可操作的问题：**① 用 AI 构建软件的代码安不安全；② 用 AI 保护软件的发现值不值钱；③ AI 系统本身是不是新的攻击面。**

<div class="verdict">
  <p class="verdict-title">基本判断</p>
  <p>这场演讲的本质是一次<strong>立场宣言</strong>：OpenSSF 把行业争论的锚点从「AI 能不能找到漏洞」移到「AI 能否降低维护者负担」，其方法论核心是一句话——<strong>more proof, provenance &amp; policy, less blind trust（更多证明、来源与策略，更少盲信）</strong>。支撑这套主张的不是口号，而是一组正在落地的工程资产：OSS-CRS、模型签名、SAF-MCP 威胁框架与 AI 报告治理。</p>
</div>

<div class="callout callout-amber">
  <div class="callout-label">核心术语速览（非专业读者可先读此节）</div>
  <p><strong>CRA（Cyber Resilience Act，网络弹性法案）</strong>：欧盟 2024 年生效的法规，要求带数字组件的产品满足网络安全要求；报告义务已于 2026-09-11 生效，主要义务 2027-12-11 全面适用。开源软件供应链安全的最大合规变量。</p>
  <p><strong>AI slop</strong>：由 LLM 批量生成的低质量漏洞报告——格式工整、引经据典，但经常是幻觉。「slopsquatting」指其衍生攻击：LLM 幻觉出的依赖包名被攻击者抢先注册，等开发者装上。</p>
  <p><strong>PoV（Proof of Vulnerability）</strong>：漏洞的可复现证明（触发崩溃或泄露的最小输入）。AIxCC 之后它正在成为漏洞报告的事实标准。</p>
  <p><strong>provenance（来源证明）</strong>：回答「这个工件是谁、在哪个流程、从什么源码构建的」的密码学声明（SLSA/Sigstore 体系）。本文讨论它如何从软件工件延伸到模型权重。</p>
  <p><strong>CRS（Cyber Reasoning System）</strong>：AIxCC 竞赛催生的「自主找洞+修复」系统，由编排器、漏洞发现 agent 与补丁 agent 组成；竞赛结束后被 OpenSSF 以 OSS-CRS 项目开源承接。</p>
  <p><strong>MLSecOps</strong>：把 DevSecOps 延伸到机器学习全生命周期（数据、训练、部署、推理）的安全实践——AI 系统攻击面的组织框架。</p>
  <p><strong>透明日志（Rekor）</strong>：Sigstore 的防篡改公共账本，每次签名都会留下可审计记录；模型签名直接复用了这套设施。</p>
</div>

## 二、为什么是现在：三个时间点的叠加

<div class="table-wrap">
<table>
  <thead><tr><th>维度</th><th>信息</th></tr></thead>
  <tbody>
    <tr><td><strong>演讲</strong></td><td>《AI Everywhere, Trust Nowhere? Open Source Security in the Age of AI》，52 页，CC-BY-4.0；slides 存档于 <a href="https://github.com/SecurityCRob/presentations" target="_blank">SecurityCRob/presentations</a></td></tr>
    <tr><td><strong>讲者</strong></td><td>CRob（Christopher Robinson，OpenSSF CTO 兼首席安全架构师）、Adrianne Marcum（OpenSSF Chief of Staff）</td></tr>
    <tr><td><strong>场合 / 时间</strong></td><td>Open Source Summit Europe 2026，布拉格，2026-10-07（会议开幕日）</td></tr>
    <tr><td><strong>组织背景</strong></td><td>OpenSSF：Linux Foundation 旗下，2020-08-03 成立；2025 年报口径 117 个成员组织、覆盖 16 个行业、40+ 国家</td></tr>
    <tr><td><strong>相关项目快照（2026.10.07）</strong></td><td>OSS-CRS 165★（MIT）· SAF-MCP 362★ · Model Signing 247★（v1.1.1）· AI/ML WG 193★ · wg-vulnerability-disclosures 230★</td></tr>
  </tbody>
</table>
</div>

演讲开头给出的不是技术图表，而是一组「这个系统本来就脆」的基线数据：

<div class="stats-grid">
  <div class="stat-card">
    <div class="stat-num">48,185</div>
    <div class="stat-label">2025 全年 CVE 数（Socket 统计）</div>
  </div>
  <div class="stat-card">
    <div class="stat-num">1,180</div>
    <div class="stat-label">商业代码库平均依赖数（Black Duck 2026 OSSRA）</div>
  </div>
  <div class="stat-card">
    <div class="stat-num">~5%</div>
    <div class="stat-label">curl 2025 年 AI 报告中的真实漏洞率</div>
  </div>
  <div class="stat-card">
    <div class="stat-num">56/470</div>
    <div class="stat-label">CVE 项目中真正 OSS 相关的 CNA 占比（2025.09）</div>
  </div>
</div>

三个时间点在此刻叠加：

- **监管落地**：EU CRA 报告义务 2026-09-11 生效——距演讲恰好一个月；主要义务 2027-12-11 全面适用，违反基本网络安全要求的罚款上限为全球年营收的 2.5%（法规 (EU) 2024/2847 第 64 条）。
- **AI 报告洪峰**：curl 项目 2025 年的漏洞报告中约 20% 是 AI slop，真实漏洞率从历年约 15-16% 跌至约 5%（Stenberg《[Death by a thousand slops](https://daniel.haxx.se/blog/2025/07/14/death-by-a-thousand-slops/)》，2025-07-14）；curl 于 2026-01-26 关闭运行 7 年的 bug bounty 计划。
- **NVD 收缩**：NIST 自 2026-04-15 起只对 CISA KEV、联邦软件与 EO 14028 关键软件做全量 CVE 富集（约覆盖 15-20% 的量），约 2.9 万个积压 CVE 标为 Not Scheduled——官方管道实质承认人工分析追不上报告增速。

<div class="callout callout-rose">
  <div class="callout-label">CVD 系统的既有裂缝（演讲第 7-9 页）</div>
  <p><strong>理想</strong>：发现者通知维护者 → 各方协调修复 → 约定日期公开披露 → 全生态有共同参考。</p>
  <p><strong>现实</strong>：官僚化的流程、找不到责任方的联系方式、「产品」与「项目」能力错位、过程不透明、以及<strong>高量低质的报告</strong>。「这个系统在 AI 之前就已经很脆了」——演讲原话。</p>
  <p><strong>规模错配</strong>：GitHub 6.3 亿仓库（Octoverse 2025）对 470 个 CNA——其中仅 56 个「慷慨地算」与 OSS 真正相关（Anchore 2025-09-18 统计，演讲引用）。上游维护者与下游制造商之间隔着一个数量级的资源差。</p>
</div>

<div class="verdict">
  <p class="verdict-title">如何读这些数字</p>
  <p>AI 不是破坏者，而是<strong>放大器</strong>：CVD 系统的裂缝、维护者资源的匮乏、报告质量的参差都是存量问题；AI 把「生成一份报告」的边际成本压到接近零，让存量问题以工业化速度放大。三个问题对应放大器的三个出口。</p>
</div>

## 三、问题一：用 AI 更快地构建不安全

<div class="growth-chart">
  <img src="three-problems.svg" alt="AI 开源安全三大问题框架：用 AI 构建软件带来不安全默认值规模化，用 AI 防护软件带来报告洪流，AI 自身成为攻击面；共同原则是 more proof less blind trust" style="width:100%">
</div>

第一个问题最直观：**AI 让开发者更快，也把不安全默认值规模化。** 演讲列举的失效模式包括——不安全默认值的代码建议、幻觉依赖包（slopsquatting）、弱评审纪律、复制既有风险、密钥处理与鉴权错误。演讲引用的佐证：Sonatype《2026 State of the Software Supply Chain》AI Agent 报告；Lightrun 2026 调查显示 43% 的 AI 生成代码变更需要生产调试。

一个关键的数据点：LLM 幻觉出的包名会被真实抢注。术语「slopsquatting」由 PSF 安全驻场开发者 Seth Michael Larson 提出，Socket 于 2025-04-08 系统化报道；学术普查确认这已是真实发生的攻击类别，而 OpenSSF 的《Security-Focused Guide for AI Code Assistant Instructions》给出的幻觉包比例是 **19.7%**。

OpenSSF 对问题一的答案不是新工具，而是把安全规则写进 AI 助手的自定义指令：

<div class="callout callout-rose">
  <div class="callout-label">《Security-Focused Guide for AI Code Assistant Instructions》（2025-08-01 发布）核心实践</div>
  <p><strong>① 定位纠正</strong>：你是开发者，AI 是助手——工程实践（评审、测试、SBOM）不因 AI 而豁免。</p>
  <p><strong>② 默认怀疑</strong>：AI 建议的依赖、版本、加密原语默认按「需要验证」处理，不按「可信」处理。</p>
  <p><strong>③ RCI（递归批评改进）</strong>：显式要求模型「review your previous answer and find problems」再「based on the problems you found, improve your answer」——让模型自己当第一轮评审。</p>
  <p><strong>④ 反模式实证</strong>：指南明确<strong>不推荐</strong> persona 模式（「act as security expert」），OpenSSF 的实验显示它反而更差——与主流提示词工程直觉相反。</p>
</div>

问题一的结论：AI 是助手，开发者仍是责任人；验证环（扫描、SBOM、provenance）在 AI 辅助下前置而非被替代。

## 四、问题二：AI slop 的经济学——发现廉价，修复才值钱

第二个问题是演讲着墨最重的部分，也是 OpenSSF 差异化最明显的切口。

### 4.1 curl 作为原型案例

curl 项目是 AI slop 危机最完整的证据链。Stenberg 的公开记录构成一条时间线：

<div class="table-wrap">
<table>
  <thead><tr><th>时间</th><th>事件</th><th>要点</th></tr></thead>
  <tbody>
    <tr><td><strong>2024.01</strong></td><td>《The I in LLM stands for intelligence》</td><td>最早公开批评 AI 漏洞报告</td></tr>
    <tr><td><strong>2025.02</strong></td><td>CVE-2025-0665 争议</td><td>curl 同日发布 3 个 Low 级 CVE，oss-sec 上公开争论「这算不算漏洞」</td></tr>
    <tr><td><strong>2025.07</strong></td><td>《Death by a thousand slops》</td><td>2025 年报告约 20% 为 AI slop；真实漏洞率从 ~15% 跌至 ~5%；每份报告动员 3-4 人、每人 30 分钟到 3 小时</td></tr>
    <tr><td><strong>2025.08</strong></td><td>FrOSCon 主旨演讲《AI slop attacks on the curl project》</td><td>公开 21 份 AI slop 报告清单；演讲 PPT 直接引用此标题</td></tr>
    <tr><td><strong>2026.01</strong></td><td>关闭 bug bounty</td><td>运行 7 年、累计支出 9 万美元换 81 个真漏洞的计划停止（2026-02 重返 HackerOne）</td></tr>
    <tr><td><strong>2026.04</strong></td><td>《High-Quality Chaos》</td><td>slop 潮退去但总量再翻倍；全年预计约 50 个 CVE（纪录）；Apache httpd、BIND、glibc、Linux kernel 等 20+ 项目确认同趋势</td></tr>
    <tr><td><strong>2026.10.07</strong></td><td>《Twenty-two pending curl vulnerabilities》</td><td>与本次演讲同日发布——积压 22 个待披露 CVE</td></tr>
  </tbody>
</table>
</div>

演讲引用的「每份报告平均 1-8 小时 triage」正是这条链的聚合：Stenberg 口径是 3-4 人 × 每人 30 分钟到 3 小时。**AI 降低了生成怀疑的成本，没有降低证明影响与写修复的成本**——这是问题二的核心，也是 OpenSSF 全部回应措施的出发点。

### 4.2 AIxCC：一场受控实验给出的上限

演讲用 AIxCC 决赛数据作对照，证明「AI 做安全」并非只有 slop 一种形态：

<div class="growth-chart">
  <img src="aixcc-finals.svg" alt="AIxCC 总决赛官方计分：Team Atlanta 392.76 分夺冠；官方全量口径 77% 已知漏洞被发现、61% 被修复、平均修复 45 分钟、单任务成本约 152 美元" style="width:100%">
</div>

官方口径（DARPA 项目经理 Andrew Carney 在 DEF CON 33 主舞台材料）：决赛 143 小时全自主运行，28 个仓库 / 53 个挑战，已知漏洞发现 54/70（77%）、修复 43/70（61%），平均修复时间 45 分钟，分析 5,400 万行代码，总成本 35.9 万美元（LLM 部分 8.2 万），1,900 万次 LLM 查询，单任务成功成本约 152 美元。赛后完成披露的累计口径是 **25 个真实世界 0-day 漏洞（跨 10 个项目，12 个已修复）**——由 Kudu Dynamics 协调、OSTIF 与 ADALogics 协作披露（USENIX Security 2026 SoK 论文 [arXiv:2602.07666](https://arxiv.org/abs/2602.07666)）。

<div class="callout callout-amber">
  <div class="callout-label">数据口径注记（演讲的原始材料里有两处值得指出）</div>
  <p><strong>① AIxCC 分母</strong>：演讲写「86% (54/63)、68% (43/63)」——以 63 个计分 CPV 为分母；DARPA 官方全量口径是 77% (54/70)、61% (43/70)。分子相同、分母不同，两口径都对，但演讲未注明。</p>
  <p><strong>② DBIR 数字笔误</strong>：演讲写「2025 VDBIR 12,915 起确认数据泄露」——Verizon DBIR 2025 官方 PDF 的实际数字是 12,195（19↔91 错位）；DBIR 2026 版口径则完全不同（约 22,000+ 起）。这是全场唯一被证伪的硬数据。</p>
  <p>其余关键数字（48,185 CVE、1,180 依赖、$4.44M/$10.22M、71%/53%/47%、6.3 亿仓库、CRA 时间线与罚款区间）均已逐项与官方来源核对一致。</p>
</div>

第三层数据来自 Team Atlanta 2026-03-11 发布的补丁评测（[Patching Vulnerabilities with Coding Agents in 2026](https://team-atlanta.github.io/blog/post-patch-2026-ensemble/)）：对 63 个决赛崩溃点做 10 种 agent 配置测试，人工复核全部 630 个补丁。最优配置的语义正确率约 80%，**仍有约 20-40% 的补丁「语义错误」——通过全部自动验证，但实际修错**（改症状不改根因 38 例、误改功能 55 例、防护不完整 28 例、误用不可信 API 15 例）。N=3 的 ensemble-by-selection 是性价比甜点。

<div class="verdict">
  <p class="verdict-title">三段论</p>
  <p>AIxCC 证明修复可以规模化且便宜（45 分钟、$152/任务）；Team Atlanta 证明规模化修复仍有 20-40% 的隐性错误率；两者合起来推出演讲的核心主张：<strong>Finding 廉价，Fixes 值钱，但必须有 PoV 与人工验证——「证明大于信任」由此落为可操作标准。</strong></p>
</div>

### 4.3 系统层的回应

报告洪峰的另一端是 NVD。NIST 2026-04-15 起收缩全量富集范围、约 2.9 万积压 CVE 标为 Not Scheduled——这不是「官方拒绝 AI 报告」的政策，而是「人工管道追不上 AI 产能」的事实。OpenSSF 的回应（演讲第 40 页响应 #2）落在维护者一侧：finder 指南（[oss-vulnerability-guide](https://github.com/ossf/oss-vulnerability-guide)）、AI 辅助报告指导、维护者支持计划（Gather 收集 → Curate 筛选验证 → Outreach 按项目规范接触 → Iterate 反馈 → Support 长期支持），以及 2026-02-04 建立的 [AI-SLOP issue #178](https://github.com/ossf/wg-vulnerability-disclosures/issues/178)（状态 OPEN，已拆 5 个子任务）。

## 五、问题三与三份答卷：AI 作为攻击面

### 5.1 攻击面扩展：DevSecOps 不够了

第三个问题：AI 系统自身是攻击面。「Just do DevSecOps」在 ML 系统上不成立——风险点从代码扩展到数据集、模型权重、再训练循环与推理服务。MLSecOps 生命周期框架（OpenSSF《[Visualizing Secure MLOps](https://openssf.org/wp-content/uploads/2025/08/OpenSSF_MLSecOps_Whitepaper.pdf)》白皮书，2025-08）列出的威胁类别：数据投毒、模型投毒/偏斜、模型窃取、反转与成员推断、AI 供应链攻击、输出完整性与推理滥用。

### 5.2 三份答卷：知识层 → 证明层 → 执行层

<div class="arch-grid">
  <div class="arch-card arch-ui">
    <div class="arch-card-title">响应 #1 · 知识层</div>
    <div class="arch-card-items">Secure Coding Guidance &nbsp;·&nbsp; AI Code Assistant 指南 &nbsp;·&nbsp; LFEL1012 课程</div>
    <div class="arch-card-desc">对应问题一：安全提示词、依赖卫生、SBOM/attestation、验证环——把「工程 101」重装进 AI 辅助开发</div>
  </div>
  <div class="arch-card arch-ctrl">
    <div class="arch-card-title">响应 #2 · 治理层</div>
    <div class="arch-card-items">Finder Guide &nbsp;·&nbsp; AI-SLOP #178 &nbsp;·&nbsp; 维护者支持计划</div>
    <div class="arch-card-desc">对应问题二：规范报告渠道、要求 PoV、人工 connector 在上游项目前完成 triage 与验证</div>
  </div>
  <div class="arch-card arch-data">
    <div class="arch-card-title">响应 #3 · 证明层</div>
    <div class="arch-card-items">Sigstore &nbsp;·&nbsp; SLSA &nbsp;·&nbsp; GUAC &nbsp;·&nbsp; Model Signing</div>
    <div class="arch-card-desc">对应「证明大于信任」：keyless 签名 + provenance + 透明日志 + attestation 图查询，从软件工件延伸到模型权重</div>
  </div>
  <div class="arch-card arch-policy">
    <div class="arch-card-title">响应 #3b · 执行层</div>
    <div class="arch-card-items">OSS-CRS &nbsp;·&nbsp; SAF-MCP &nbsp;·&nbsp; MLSecOps 白皮书</div>
    <div class="arch-card-desc">对应问题三：CRS 编排框架跑「找洞+修复」、SAF-MCP 提供 MCP/agent 威胁分类学、白皮书定义 AI 攻击面</div>
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

### 5.3 OSS-CRS：把竞赛产物变成日常工具

三份答卷中工程化程度最高的是 OSS-CRS。AIxCC 的七支决赛队（冠军 Atlantis / Trail of Bits 的 Buttercup / Theori 的 RoboDuck 等）已把各自 CRS 全部开源（[AIxCC 官方档案](https://archive.aicyberchallenge.com/)）；OSS-CRS（[ossf/oss-crs](https://github.com/ossf/oss-crs)，MIT，165 Stars，2026-10 快照）把这些系统从已消失的竞赛云迁移到任意 OSS-Fuzz 格式项目上本地编排运行。2026-04-02 被 OpenSSF 正式收编，白皮书（[arXiv:2603.08566](https://arxiv.org/abs/2603.08566)，Georgia Tech + Microsoft）作者群含 Team Atlanta 成员。

<div class="phase-card">
  <h4>OSS-CRS 的三个关键机制</h4>
  <p><strong>① libCRS 接口层</strong>：注入每个 CRS 容器的 Python 接口（submit-build-output / submit / fetch / apply-patch-build / run-pov / run-test），CRS 只写一次即可跨环境（本地/Azure）运行——解决竞赛时代「基础设施重复（7 队中 5 队各自部署 LiteLLM）、云锁定、单体设计」三大障碍。</p>
  <p><strong>② LLM 预算硬截断</strong>：LiteLLM 统一代理按 CRS 发放唯一 API key，并按其美元预算硬截断——LLM 费用与 CPU/内存同级管理。白皮书指出 AIxCC 中无预算控制的单次运行可超 $1,000/小时，这正是「AI 做安全」被忽略的隐性成本。</p>
  <p><strong>③ exchange + builder sidecar</strong>：跨 CRS 工件交换走文件系统（内容哈希去重、无直接通信），实现故障隔离与 ensemble；builder 完成 patch → 增量重编译 → 重放 PoV → 回归测试的闭环。</p>
</div>

实战数据：白皮书报告移植 Atlantis 后在 8 个 OSS-Fuzz 项目发现 10 个此前未知 bug（3 个高危）；OpenSSF 博客（2026-04-02）称 Team Atlanta 用 OSS-CRS 已在 16 个项目发现 25 个漏洞（PHP、U-Boot、memcached、Apache Ignite 3 等）。运行一个 CRS 需要一条 compose 配置加三条命令：

```yaml
# example/crs-libfuzzer/compose.yaml（节选，官方示例）
run_env: local
docker_registry: local

oss_crs_infra:
  cpuset: "0-3"
  memory: "16G"

crs-libfuzzer:
  cpuset: "4-7"
  memory: "16G"
```

```bash
# 官方 Quick Start 工作流
uv run oss-crs prepare --compose-file ./example/crs-libfuzzer/compose.yaml
uv run oss-crs build-target \
  --compose-file ./example/crs-libfuzzer/compose.yaml \
  --fuzz-proj-path ./oss-fuzz/projects/libxml2
uv run oss-crs run --compose-file ./example/crs-libfuzzer/compose.yaml
```

### 5.4 SAF-MCP 与 Model Signing：先澄清一个误读

演讲对 SAF-MCP 的展示方式容易引起误读（配图是「deploys MCP gateway → I fixed MCP」的嘲讽）。需要澄清：**SAF-MCP（[secure-agentic-framework/saf-mcp](https://github.com/secure-agentic-framework/saf-mcp)，362 Stars）不是运行时拦截网关，而是面向 MCP 生态的 MITRE ATT&CK 式威胁建模框架**——14 个战术 × 各 profile 技术（MCP 76 项、SAF Core 31 项、Code-Agent 12 项，共 80+），每个技术带原子化永久 ID（如 SAF-T1001 Tool Poisoning Attack）、缓解措施与检测规则；执行侧的约束仍靠 MCP OAuth 2.1 与沙箱等既有机制。它是「知识层」的交付物——把 agent 工具链的攻击面变成可查询、可映射的目录。另一个同名但不同物的项目是 Black Hat 2026 上的 SAFE（Shared AI Findings Exchange，Cisco/CrowdStrike/HF/NVIDIA/Red Hat 提案），阅读材料时需区分。

Model Signing（[sigstore/model-transparency](https://github.com/sigstore/model-transparency)，247 Stars，v1.1.1）是五个项目中最成熟的：v1.0 于 2025-04-04 发布，签名对象是任意格式、任意规模的模型权重。机制是三层信封——in-toto Statement（逐文件 path:digest）→ DSSE Envelope → Sigstore Bundle（含 Rekor 透明日志条目）；支持 keyless（OIDC）、自签证书、密钥对与 PKCS#11 HSM 四种方式。值得注意的设计：TUF 在这里不负责模型分发，只负责 Sigstore 信任根（trusted_root）的发布与轮换——「TUF 管信任根，DSSE+Sigstore 管模型工件」。

## 六、生态全景：OpenSSF 的位置与空档

把 OpenSSF 放进 2026 年 10 月的 AI 安全生态，其差异化才清晰：

<div class="table-wrap">
<table>
  <thead><tr><th>组织/项目</th><th>一句话定位</th><th>关注层面</th><th>交付物形态</th><th>与 OSS 供应链耦合</th></tr></thead>
  <tbody>
    <tr><td><strong>OpenSSF（AI/ML WG + OSS-CRS + SAF-MCP + Model Signing）</strong></td><td>把 AI 安全翻译成维护者与供应链语言</td><td>代码 + 模型 + agent + 供应链</td><td>框架 / 工具 / 威胁分类学</td><td>极高（Sigstore/SLSA/GUAC 全线复用）</td></tr>
    <tr><td><strong>OWASP</strong></td><td>全球 AI 安全共识 + 标准输入通道</td><td>模型 + 应用 + 供应链</td><td>AI Exchange 指南、LLM Top 10 榜单（2026 版 2026-08-04 发布）</td><td>中（借 SDO 通道影响 ISO/AI Act）</td></tr>
    <tr><td><strong>MITRE ATLAS</strong></td><td>ATT&CK 的 AI 姊妹战术库</td><td>模型 + agent（扩展中）</td><td>STIX 2.1 矩阵（v5.x 约 15 战术/66 技术）</td><td>低（分类学）</td></tr>
    <tr><td><strong>NIST / CISA</strong></td><td>政府风险治理与采纳指引</td><td>模型 + 代码 + 供应链</td><td>AI RMF 1.0 / SP 800-218A / CISA 2026-05-01 agentic AI 联合指南</td><td>中（800-218A 直连 SSDF）</td></tr>
    <tr><td><strong>OpenShell / nono / E2B / gVisor</strong></td><td>agent 运行时沙箱与权限治理</td><td>agent + 代码执行</td><td>开源平台 / SDK / 单二进制沙箱</td><td>低-中</td></tr>
    <tr><td><strong>Hugging Face / Protect AI / DataDog GuardDog</strong></td><td>模型分发枢纽与恶意性扫描</td><td>模型 + 依赖供应链</td><td>模型卡 / safetensors / 扫描器</td><td>极高（供应链咽喉）</td></tr>
  </tbody>
</table>
</div>

三条观察：

1. **「维护者负担」是 OpenSSF 的独家切口**。OWASP、NIST、CISA、ISO 全部面向企业合规者；只有 OpenSSF 的响应 #2 面向 upstream 维护者吞吐。但交付物目前停在指南与 GitHub issue——工程化承载（如机器可读的 PoV 交换格式）仍是空白。
2. **agent 运行时是最大空白与竞合张力**。OpenShell、nono、E2B 在运行时层竞争，OpenSSF 的 SAF-MCP 在知识层——「标准方」与「产品方」的边界正在模糊。
3. **供应链工具栈复用是硬资产**。Model Signing 把 keyless 签名搬到模型权重，与 SLSA/GUAC 同栈；但模型分发的最后一公里依赖 Hugging Face 等枢纽接入，OpenSSF 不拥有任何模型枢纽。

## 七、战略分析

<div class="verdict">
  <p class="verdict-title">战略意图（推断）</p>
  <p>OpenSSF 在做一次<strong>信任基建的品类延伸</strong>：把 Sigstore/SLSA/GUAC 这套「软件工件的证明设施」平移到模型、数据集与 AI 生成的补丁上，借 EU CRA 把「证明」从最佳实践变成合规刚需，再用 AIxCC → OSS-CRS 的叙事把自己定义为「AI 修复 + 人工验证」这个新中间层的标准制定者。对应到商业逻辑：<strong>指南是获客层，证明基础设施是控制点。</strong></p>
</div>

支撑这一推断的证据链：

- **人**：CRob 在 AIxCC 中是官方维护者对接人（DEF CON 33 材料标注 MAINTAINERS (OSSF / OSTIF)）——竞赛、开源化续作（OSS-CRS 2026-05-21 进入 OpenSSF Sandbox）与这场主题演讲是同一根叙事线。
- **事**：演讲把「Findings are cheap. Fixes are valuable.」上升为行业争论的新锚点——它回避了「AI 能不能找洞」这个已被 AIxCC 回答的问题，转向「AI 能不能降低维护者负担」这个 OpenSSF 恰好有资产（triage、connector、CRS）去回答的问题。
- **势**：CRA 报告义务 2026-09-11 生效后，「provenance 证明」从技术术语变成法律义务；OpenSSF 2025 年报显示 117 个成员组织、覆盖 16 个行业、40+ 国家，是少数能同时对接监管者、维护者与 AI 工具生态的中立枢纽。

## 八、风险、局限与趋势判断

<div class="callout callout-rose">
  <div class="callout-label">四类局限（截至 2026.10.07）</div>
  <p><strong>① 指南 ≠ 执行</strong>：响应 #1/#2 的交付物是文档与 issue，从「建议」到「强制」之间没有机制；AI slop 治理仍依赖维护者手工 triage，规模化验证缺机器可读的 PoV 元数据格式。</p>
  <p><strong>② 早期项目风险</strong>：SAF-MCP 无 release tag、Framework Model 仍在迭代；OSS-CRS 的 Azure 部署仍为 coming soon；Model Signing 的模型卡谓词与数据集签名在演进。</p>
  <p><strong>③ AIxCC 成绩的可迁移性</strong>：45 分钟/$152 是在受控挑战、已知漏洞类型、每队 $135K 配额下的成绩；真实项目的环境噪音、构建系统差异与「20-40% 语义错误」意味着人工验证环节不可省——成本模型的另一面。</p>
  <p><strong>④ 循环风险</strong>：演讲自己描绘的风险链条——机器人报 100 份/天 → 项目用 AI 修 → AI 注入新漏洞 → 全球部署。「AI 对付 AI slop」可能把 CVD 变成两个模型的军备竞赛，人类维护者被挤出回路。</p>
</div>

三个趋势判断（以下为推断，置信度已标注）：

1. **「证明」将取代「信任」成为 AI 供应链的默认语言**（置信度高）。PoV 成为漏洞报告的门槛、provenance 覆盖模型与数据集、透明日志覆盖签名事件——这套词汇在 CRA 全面生效前会完成从「OpenSSF 项目」到「行业惯例」的迁移。
2. **AI 安全工具的新度量是「维护者时间节省」，不是「发现数量」**（置信度高）。curl 的 5% 真实率否定了「发现数量」指标；AIxCC 的 45 分钟立起「修复吞吐」标杆。谁能证明「每份报告背后的维护者分钟数下降」，谁就赢得上游项目。
3. **agent 运行时与供应链治理将在 2027 年前合流**（置信度中）。SAF-MCP 的分类学需要 OpenShell/nono 类的执行层承载，OSS-CRS 的补丁需要 provenance 才能进发行版——OpenSSF 的空白点（运行时、模型枢纽）与运行时厂商的空白点（标准、维护者通道）恰好互补，收购或深度合作会先于标准统一出现。

值得跟踪的信号：AI-SLOP #178 是否从 issue 转正为正式指南、OSS-CRS 的 Azure 支持落地、Model Signing 的数据集签名路线图、以及 curl 2026 全年 CVE 数字（50 的预测是否兑现）。

---

**演讲材料**：《AI Everywhere, Trust Nowhere? Open Source Security in the Age of AI》，CRob 与 Adrianne Marcum（OpenSSF），Open Source Summit Europe 2026，CC-BY-4.0；slides 见 [SecurityCRob/presentations](https://github.com/SecurityCRob/presentations)。本文数据经官方来源逐项核实，两处口径问题已在正文标注。

<div class="callout callout-amber">
  <div class="callout-label">备注</div>
  <p>本文基于截至 2026 年 10 月 7 日的演讲材料与公开数据撰写；OpenSSF 各项目迭代速度较快（OSS-CRS 最后推送 2026-10-06，Model Signing 2026-10-05），仓库状态与 Stars 以当日快照为准。</p>
</div>
