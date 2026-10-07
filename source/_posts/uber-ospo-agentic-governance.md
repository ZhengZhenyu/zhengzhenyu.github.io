---
title: 从「检测」到「判断」：Uber 如何用智能体重构开源治理
date: 2026-10-07 21:00:00
tags: [开源治理, OSPO, AI Agent, Uber, OSSEU, SBOM, 软件供应链]
categories: 开源治理
description: OSSEU 2026：Uber 四个智能体把审批压到秒级。
---

一张第三方依赖的许可证审批单，在 Uber 内部曾要排队数周；如今，同样的审批在几秒内完成——签发者不是法务，也不是合规工程师，而是一个名为 ORCA 的智能体。

2026 年 10 月 7 日，Open Source Summit Europe 2026（布拉格，恰逢 Linux 诞生 35 周年）上，Uber 开源负责人（Head of Open Source）Chris Howard 系统披露了这套实践：四个专用智能体（ORCA、CleanUp、Upgrade、Ownership）接管了 OSPO 中过去最依赖人类判断的环节——审批、修剪、升级与定责。Uber 管理着 11 万第三方依赖与 3000 个 microrepo，6 个月一轮的人工审计曾让合规成为这家公司最慢的一环。

这场分享最值得讨论的，不是又一个自动化案例，而是它抛给行业的问题：当合规中最依赖人类经验的「判断」开始被自动化，谁来为判断负责？

![Session 标题页（作者摄于 OSSEU 2026 现场）](hero-session-title.png)

<div class="verdict">
  <p class="verdict-title">核心判断</p>
  <p><strong>开源合规的瓶颈从来不是「检测」，而是「判断」。</strong>Uber 的回答是四个专用智能体——把判断本身自动化，将许可证审批从数周压到秒级。开发者体验由此成为一种合规战略，OSPO 的护城河从「审批流程」迁移到「信任机制」。而这一切的前提，是先把确定性数据做扎实，再让智能体只做「推理增量」。</p>
</div>

<div class="callout callout-amber">
  <div class="callout-label">核心术语速览（非专业读者可先读此节）</div>
  <p><strong>OSPO</strong>（Open Source Program Office，开源项目办公室）：企业内部负责开源治理、合规与社区关系的团队。</p>
  <p><strong>SBOM</strong>（软件物料清单）：软件成分的正式清单，CycloneDX 是主流的 SBOM 标准格式之一。</p>
  <p><strong>SCA</strong>（软件成分分析）：扫描依赖树、识别组件许可证与已知漏洞的工具类别。</p>
  <p><strong>copyleft</strong>：要求衍生作品以相同许可证开源的一类许可证（如 GPL），合规风险最高，需确认代码来源。</p>
  <p><strong>幽灵依赖</strong>：按 Uber 演讲的用法，指构建文件中已声明、但从未被执行路径引用的库——只增加攻击面；注意 npm 生态通常用它指相反情况（代码引用但未声明）。</p>
</div>

## 一、合规悖论：11 万依赖的规模下，每个问题都更难

Uber 的治理起点并不特殊：6 个月一轮的审计周期，加上资源密集、进展缓慢的法律审查。现场披露的规模如下：

<div class="stats-grid">
  <div class="stat-card">
    <div class="stat-num">110K</div>
    <div class="stat-label">第三方依赖</div>
  </div>
  <div class="stat-card">
    <div class="stat-num">40K</div>
    <div class="stat-label">直接依赖</div>
  </div>
  <div class="stat-card">
    <div class="stat-num">6</div>
    <div class="stat-label">Monorepos</div>
  </div>
  <div class="stat-card">
    <div class="stat-num">3K</div>
    <div class="stat-label">Microrepos</div>
  </div>
  <div class="stat-card">
    <div class="stat-num">6 个月</div>
    <div class="stat-label">审计周期</div>
  </div>
</div>

Uber 对治理的投入由来已久：2018 年 12 月与 Facebook、Google 同期加入 Linux Foundation 的 OpenChain 合规项目；2019 年 OSPO 成型时，时任开源负责人 Brian Hsieh 即强调，对任何可能增加开发者负担的工具都要保持警惕。Uber 的治理史本身就是一条「从人工到自动化」的演进曲线，Chris 今天披露的智能体是这条曲线的最新一段。

## 二、第一次自动化为何不够：从盲区到票据洪水

Uber 的第一阶段自动化是统一软件注册中心（Unified Software Registry）：24 小时全仓扫描取代 6 个月盲区，全依赖图实时生成 CycloneDX SBOM，并通过与 Snyk 的合作完成许可证与漏洞策略富化。

新的瓶颈随即出现：票据过载与分诊瘫痪（Ticket Overload & Triage Paralysis）。许可证整改单、分诊任务与不断堆积的 backlog，重新开始威胁开发者速度。

![统一注册中心解决了「看不见」，却带来了票据洪水（作者摄于 OSSEU 2026 现场）](ticket-overload.png)

<div class="verdict">
  <p class="verdict-title">关键转折</p>
  <p>可见性不等于治理。确定性规则擅长「检测」——每一处违规都开一张票；但它把「判断」（该不该批、风险多大、谁负责）<strong>全部留给了人</strong>，而人恰恰是这个链条上最稀缺的资源。扫描器把问题从「看不见」变成了「看不过来」，治理的效率瓶颈从检测环节转移到了判断环节。</p>
</div>

## 三、范式转移：从 Detection 到 Judgment

![Uber 的范式转移：从检测到判断（作者摄于 OSSEU 2026 现场）](detection-vs-judgment.png)

<div class="table-wrap">
<table>
  <thead><tr><th>维度</th><th>Detection（确定性规则）</th><th>Judgment（智能体推理）</th></tr></thead>
  <tbody>
    <tr><td><strong>策略</strong></td><td>静态策略匹配，二进制通过/失败</td><td>基于使用场景的上下文推理与风险评估</td></tr>
    <tr><td><strong>评估方式</strong></td><td>依赖每次被引入/发现时都孤立评估</td><td>参考历史例外与既有评估结论</td></tr>
    <tr><td><strong>处置</strong></td><td>每个违规都开票</td><td>必要时自主修复或升级</td></tr>
    <tr><td><strong>结果</strong></td><td>积压的 backlog 与开发者摩擦</td><td>快速降险，不拖慢工程速度</td></tr>
  </tbody>
</table>
</div>

过去的自动化把「发现问题」规模化，智能体把「解决问题」规模化：前者产出票据，后者产出结果。

### 3.1 检测自动化的三个结构性局限

这个转向并非偶然。检测自动化的天花板不在扫描器性能，而在检测模式本身的结构（以下为作者分析）：

<div class="callout callout-rose">
  <div class="callout-label">检测的三个结构性局限</div>
  <p><strong>① 规则完备性悖论</strong>：合规判断本质是基于场景的权衡，不是基于属性的判定。同一个 GPL 依赖，静态链接与动态调用、内部分发与对外分发、原样使用与修改后使用，风险完全不同。这些维度交叉起来，规则表永远写不完——检测系统的天花板不是算力，是规则的表达能力。</p>
  <p><strong>② 状态无关性</strong>：检测把每个依赖当作「第一次见到」，每次引入或发现都从零评估，无法利用历史决策。而判断的本质恰恰是「利用过去」——先例让判断既快又一致。丢弃历史的检测，等于让组织为同一个依赖反复支付判断成本。</p>
  <p><strong>③ 输出不对称</strong>：检测器只会说「违规」，不敢说「通过」——正面批准意味着承担决策责任，而规则引擎无法承担。于是所有「通过」都只能由人来签发，人成为漏斗中唯一能说「是」的环节。这正是票据洪水的真正成因：不是违规太多，而是「批准」无法自动化。</p>
</div>

两条流水线并置，差异更直观：

<img src="judgment-flow-comparison.svg" alt="检测与判断两条治理流水线的对比：检测产出票据，判断产出结果" style="width:100%">

图上的关键差异在于：两条流水线的输入完全相同，输出性质却完全相反——检测线把「违规」交给人去消化，判断线把「结果」直接交付给工程。判断线每多自动处理一个依赖，检测线的 backlog 就少一张票。

### 3.2 为什么是 2026 年：判断自动化的两个前提

判断自动化需要两个前提同时成立——这解释了为什么这一转向出现在 2026 年，而不是更早：

<div class="phase-card">
  <h4>前提一：数据——判断的原材料必须先被数据化</h4>
  <p>上下文（依赖怎么用、怎么分发）需要依赖图与 SBOM 支撑；先例（上次怎么批、附加什么条件）需要历史例外库与采购协议库支撑。2019 年 Uber 成立 OSPO 时只有扫描器，没有这些数据，所以当年只能靠人——第一阶段的统一注册中心补齐的正是这块。没有确定性数据基座，智能体的判断就只是幻觉。</p>
</div>

<div class="phase-card">
  <h4>前提二：能力——上下文理解与先例检索相继成熟</h4>
  <p>上下文理解是 LLM 的能力边界；先例检索与多步验证（哈希比对、协议查询）是 agentic 工作流的能力边界。两者在 2024–2026 年相继成熟，才让「受限判断」成为工程现实。</p>
</div>

把判断按输入拆解，两条前提的对应关系如下：

<img src="judgment-inputs.svg" alt="一次合规判断的三个输入：规则、上下文、先例" style="width:100%">

传统工具只覆盖「规则」；「上下文」与「先例」长期依赖人的记忆与权衡。所谓「从检测到判断」，技术实质就是把治理自动化的重心从「执行规则」转移到「检索先例 + 理解上下文 + 做出受限决策」。

### 3.3 辨析：这里的 Judgment 是什么、不是什么

<div class="verdict">
  <p class="verdict-title">必须澄清的边界</p>
  <p>Uber 说的 Judgment <strong>不是</strong>自主决策，而是<strong>受限推理（bounded reasoning）</strong>：在确定性数据基座上的先例匹配、上下文调整与多步验证。每个判断都能被分解成可审计的步骤——匹配了哪条先例、比对了哪个哈希、查询了哪份协议。</p>
</div>

这个辨析带来一个反直觉的结论：自动化判断的「正确性」未必高于资深合规官，但它的「可验证性」远超人类。人类可以凭经验做出难以解释的准确判断；智能体的每一步都有迹可循。而治理体系需要的恰恰是可验证性——**一个可审计的次优决策，在治理上优于一个不可审计的最优决策**。监管者、审计师和法庭能够复核「这个批准是如何做出的」——这才是判断自动化的真正合法性来源，也是它与「AI 黑箱决策」的分水岭。

## 四、判断的分类学：四个智能体如何分工

四个智能体并非随意组合，而是对应依赖生命周期的四个决策点。按「判断类型」重新归类（归类为作者分析，Uber 现场未如此表述）：

<div class="table-wrap">
<table>
  <thead><tr><th>判断类型</th><th>回答的问题</th><th>智能体</th><th>决策点</th><th>自动化风险</th></tr></thead>
  <tbody>
    <tr><td><strong>先例判断</strong></td><td>这个依赖以前批过吗？</td><td>ORCA</td><td>引入/审批</td><td>高（涉及法律责任）</td></tr>
    <tr><td><strong>事实判断</strong></td><td>这个依赖真的在用吗？</td><td>CleanUp</td><td>存续</td><td>低（可回滚）</td></tr>
    <tr><td><strong>时机判断</strong></td><td>现在升级安全吗？</td><td>Upgrade</td><td>演化</td><td>低（有测试兜底）</td></tr>
    <tr><td><strong>责任判断</strong></td><td>这归哪个团队管？</td><td>Ownership</td><td>归属</td><td>中（路由而非裁决）</td></tr>
  </tbody>
</table>
</div>

<img src="judgment-lifecycle.svg" alt="四类判断覆盖依赖生命周期的四个决策点：引入、存续、演化、归属" style="width:100%">

四个智能体的分工不是按工具能力划分，而是按生命周期决策点划分，每个决策点对应不同的自动化风险。任何 OSPO 都可以用同样的框架自查：还有哪些决策点未被自动化覆盖，哪些决策点的自动化风险被低估了。

这个分类学的价值在于：它解释了为什么 Uber 的智能体敢于自动执行某些动作、而另一些只做「匹配」。风险最低的事实判断（修剪）和时机判断（升级）可以全自动产出 PR；责任判断只路由、不裁决；而法律后果最重的先例判断，ORCA 的自动批准被严格限定在「与历史先例完全匹配」的范围内——新情况仍会升级给人。这比笼统的「从小处开始、建立信任」多了一层可操作的依据：**按判断类型确定自动化边界，而不是按工具能力。**

进一步归纳，四个智能体共享三条设计原则：

<div class="callout callout-amber">
  <div class="callout-label">四个智能体的共同设计原则（作者归纳）</div>
  <p><strong>① 确定性基座 + 推理增量</strong>：没有任何一个智能体凭空推断数据。SBOM、import 图、上游源码哈希、提交历史全部来自注册中心等确定性系统；智能体只负责推理层——这也解释了 Uber 为什么必须先建注册中心、再上智能体。</p>
  <p><strong>② 行动即 PR</strong>：所有动作以 pull request 形式交付，附 changelog、测试结果、匹配依据。可审查、可回滚、可被 CI 再次验证——智能体的每个判断都落在传统工程治理的轨道上。</p>
  <p><strong>③ 判断可追溯</strong>：ORCA 的批准留下「匹配了哪条先例、哪个协议」的决策链；Ownership 的归属留下「哪段提交历史」作为证据。自动化可以，但必须能被事后审计。</p>
</div>

**ORCA（Legal Precedent Matcher）** 接管先例判断：匹配历史批准与法律例外，把本地修改过的代码与上游公开仓库做 SHA-256 比对确认可信来源——这是 copyleft 依赖安全使用的关键一环；商业许可证则与活跃的企业级采购协议联动。审批周期由此从数周到秒级。它的边界设计同样值得注意：哈希比对证明的是「代码来自哪里」，不证明「代码安全」——所以它只自动批「先例完全匹配」的部分。

![AGENT 1：ORCA — Legal Precedent Matcher（作者摄于 OSSEU 2026 现场）](agent-orca.png)

**CleanUp（Dependency Pruning）** 接管事实判断：对比构建文件声明与实际 import 图找出幽灵依赖，自动生成零或低风险的 PR 删除。攻击面在开发者无感的情况下缩小。这类判断接近确定性（依赖图可解），智能体的增量价值在于批量生成干净的零/低风险 PR——因此它是四个智能体中自动化程度最高、最不该保留人工介入的一环。

![AGENT 2：CleanUp — Dependency Pruning（作者摄于 OSSEU 2026 现场）](agent-cleanup.png)

**Upgrade（Proactive Patching）** 接管时机判断：评估版本新鲜度、EOL 状态、社区健康度与破坏性变更风险，只挑 minor/patch 级别升级，自动开出附 changelog 与测试结果的 PR。其设计要点是「只做低摩擦路径」——把可能引入破坏性变更的大版本升级留给人工，这正是「时机判断」中风险与自动化程度的匹配。

![AGENT 3：Upgrade — Proactive Patching（作者摄于 OSSEU 2026 现场）](agent-upgrade.png)

**Ownership & Routing** 接管责任判断：用确定性图论加智能体代码取证（分析提交与代码演进历史），确定每个依赖真实且活跃的负责团队，把问题路由到该团队队列而非踢回 OSPO。它解决的是 OSPO 领域最古老的顽疾之一——孤儿代码与票据在团队间反复流转，本质上是把「确定责任人」这一组织问题转化为可计算问题。

![AGENT 4：Ownership & Routing（作者摄于 OSSEU 2026 现场）](agent-ownership.png)

## 五、平台架构与 Shift-Left 愿景

![Uber 开源合规平台全景（作者摄于 OSSEU 2026 现场）](compliance-platform.png)

分层逻辑清晰：Monorepo/Microrepos → 统一注册中心（依赖清单、代码扫描、SBOM、SCA）→ OSPO 平台（许可证与安全任务、清理与升级服务）→ 四个智能体 → 工程师只收到「相关且更少」的票据。智能体处于最上层，但它的全部养料来自最下层——这个分层本身就是「确定性基座 + 推理增量」的架构表达。

再往前一步是 Shift-Left 愿景：依赖进入 PR 的瞬间即评估许可证、CVE 与项目健康度（Day 0 评估）；用内联推荐替代直接拒绝 PR（推荐已批准的替代库）；最终覆盖从引入、维护到弃用、退役的全生命周期自治。

![Shift-Left 愿景：在火灾发生前拦住它（作者摄于 OSSEU 2026 现场）](shift-left-vision.png)

## 六、行业共振：2026 时间线说明了什么

把 Uber 的实践放回行业背景，2026 年有一条清晰的时间线：

<div class="callout callout-rose">
  <div class="callout-label">OSPO × Agentic AI 时间线（2026）</div>
  <p><strong>2026.05</strong>：TODO Group 成立「Agentic AI to Empower OSPOs」工作组（5 月 19 日）；Cloudera OSPO 负责人 Diego Mastroianni 介绍其已用智能体维护覆盖 50+ 项目的开源资产中心（2026.05）。</p>
  <p><strong>2026.07</strong>：Linux Foundation 发布《What Agentic AI Asks of Open Source Strategy》，提出「模型 + harness（智能体的执行编排层）」分层与确定性护栏。</p>
  <p><strong>2026.08.02</strong>：EU AI Act 通用目的 AI 条款等主要义务生效。</p>
  <p><strong>2026.09.07</strong>：OSPO Summit China（上海），蚂蚁集团 OSPO 分享 LLM 分诊、PR 预审与 AI 辅助代码来源分析。</p>
  <p><strong>2026.10.07</strong>：OSSEU 现场——同一天还有 Sony《OSPO 如何应对 AI 辅助贡献》、TODO Group AI 专题 Panel、《MCP 与 AI 协议：开源经理的问题》等场次。</p>
</div>

这条时间线说明三件事。其一，治理智能体化是公司级智能体平台的自然延伸：AAIF（Agentic AI Foundation，Linux 基金会项目）2026 年 5 月的报道显示，Uber 每周执行约 6 万次智能体任务，月活跃智能体 1500+，5000+ 工程师中 90% 以上每月使用 AI 工具，其自研后台编码智能体 Minions 每周产生约 1800 次代码改动；底层是 MCP 网关与注册中心组成的控制面。OSPO 的四个智能体正是这套公司级平台在治理域的一个切面。

<div class="stats-grid">
  <div class="stat-card">
    <div class="stat-num">60K</div>
    <div class="stat-label">每周智能体执行（2026.05，AAIF）</div>
  </div>
  <div class="stat-card">
    <div class="stat-num">1.5K+</div>
    <div class="stat-label">月活跃智能体（2026.05，AAIF）</div>
  </div>
  <div class="stat-card">
    <div class="stat-num">90%</div>
    <div class="stat-label">5000+ 工程师中 90%+ 每月使用 AI 工具（2026.05，AAIF）</div>
  </div>
  <div class="stat-card">
    <div class="stat-num">1.8K</div>
    <div class="stat-label">Minions 每周代码改动（2026.05，AAIF）</div>
  </div>
</div>

其二，行业正从「各自实验」走向「公开协作」——GitHub 开源总监 Ashley Wolf 将这类问题定性为「必须由软件社区公开地一起解决的治理问题」，TODO 工作组正源于此。

其三，监管时钟在走：EU AI Act 已进入执法期，合规决策的自动化不会长期处于监管真空。对国内 OSPO 同样成立：蚂蚁集团已在国内场景落地 LLM 分诊与 AI 辅助代码来源分析；参与 TODO 工作组等国际渠道，是把国内实践带出去、引入成熟模式的现实路径。

## 七、冷思考：自动化判断的三个真实风险

判断被自动化，不意味着风险被消除；判断被规模化的同时，判断的错误同样被规模化。以下三个风险需要在推进自动化时同步纳入设计：

<div class="callout callout-rose">
  <div class="callout-label">三个真实风险</div>
  <p><strong>① 责任黑洞</strong>：智能体误批一个依赖时，法律责任归属谁——OSPO？使用该依赖的业务团队？平台供应商？目前没有判例。EU AI Act 已生效，但针对自动化合规决策的执法实践仍是空白。Uber 用「决策链可追溯」（匹配了哪条先例、依据哪个协议）对冲不确定性，这是工程上的负责任，但不等于法律上的确定性。</p>
  <p><strong>② 对抗性风险</strong>：哈希校验证明「修改过的代码来自哪个上游版本」，不证明「那个版本安全」；先例匹配依赖「新包与历史包相似」的可计算性，而依赖投毒者一旦理解匹配逻辑，就可以构造「看起来像先例」的包。检测时代攻击者对付扫描器，判断时代攻击者将对付判断逻辑本身。</p>
  <p><strong>③ 知识库腐化</strong>：智能体的质量上限是「历史例外与先例库」的质量。一个错误的先例不会被纠正，只会被更快地复制到成千上万个新批准里。自动化不纠错，自动化放大——先例库本身需要定期重审、标记失效的治理机制，而这一点 Uber 现场并未展开，可能是下一步的关键。</p>
</div>

这三点指向同一个结论：判断自动化的成熟标志，不是「批准有多快」，而是「错误被发现和纠正有多快」。这也解释了为什么 Uber 坚持「行动即 PR、判断可追溯」——在责任与对抗面前，可审计性不是附加品，而是自动化得以合法存在的前提。

## 八、历史参照系：合规自动化会走哪条路

类比不能代替判断，但能帮读者校准预期。两条历史路径值得对照：

<div class="phase-card">
  <h4>参照一：CI/CD——自动化信任来自「门禁」，而非流水线</h4>
  <p>二十年前，软件发布靠人工检查单；今天的 CI/CD 让机器自动构建、测试、发布。关键教训：工程师对流水线的信任，不是来自流水线本身，而是来自确定性机制——签名、门禁、不可篡改的日志。Uber 的 SHA-256 校验、PR 审计、决策链追溯，本质就是在给合规自动化装「门禁」。没有门禁的流水线只会更快地发布错误，同理，没有审计能力的智能体只会更快地批准错误。</p>
</div>

<div class="phase-card">
  <h4>参照二：金融反欺诈——自动决策成熟后，诞生了独立的「模型治理」职能</h4>
  <p>信贷与反欺诈从规则引擎、评分卡演进到机器学习自主决策后，银行被迫建立独立的模型风险管理（model risk management）职能：验证、监控、定期重训、偏差审计。这预示了 OSPO 的下一阶段——「治理依赖的智能体」会成为一项独立的、持续的工作，而不是一次性上线。</p>
</div>

类比也有边界：构建失败的回滚成本是分钟级，合规误批的代价是法律责任与品牌，且对手方（投毒者）是主动对抗的——所以合规自动化的边界应当比 CI/CD 更保守，监管介入也会更早。Uber 现场呈现的克制——先例匹配范围受限、只自动升级 minor/patch 版本、新情况升级给人工——正是这种保守性的体现。

## 九、趋势预判与落地路径

<div class="verdict">
  <p class="verdict-title">趋势预判</p>
  <p><strong>短期（1–2 年，置信度：高）</strong>：检测自动化成为 OSPO 标配；头部公司跑通「判断自动化」（审批、升级、归属），并通过 TODO 工作组等渠道沉淀共享实践。判断分类学、人机回环层级这类通用框架会先于工具标准出现。</p>
  <p><strong>中期（3–5 年，置信度：中）</strong>：依赖全生命周期自治（引入→退役）成为平台能力；OSPO 的重心从「审批流程」转向「智能体治理」，与 AI 治理职能逐渐合流；主流 SCA/SBOM 工具开始内置 agent 接口。</p>
  <p><strong>可能的转折点</strong>：出现首个针对智能体自动化审批的监管执法案例，或一次高知名度的「智能体误批」事件，将显著改变行业对自动化边界的共识。备选场景：若监管要求自动化决策必须保留人工复核，判断自动化可能退化为「智能体草拟、人工复核」的中间形态。</p>
</div>

给 OSPO 从业者的落地建议，可以用一个分级框架来组织。借用自动驾驶的 L0–L5 分级思路，合规判断的自动化程度可以这样划分：

<div class="table-wrap">
<table>
  <thead><tr><th>层级</th><th>定义</th><th>Uber 的对应位置</th></tr></thead>
  <tbody>
    <tr><td><strong>L0 全人工</strong></td><td>工具只提供信息，判断完全由人完成</td><td>2019 年的 Uber OSPO</td></tr>
    <tr><td><strong>L1 辅助建议</strong></td><td>智能体给建议，人做决策</td><td>Shift-Left 的 PR 内联推荐</td></tr>
    <tr><td><strong>L2 草拟+人复核</strong></td><td>智能体草拟决策，人批准</td><td>ORCA 对新依赖的判断</td></tr>
    <tr><td><strong>L3 自动执行+异常上报</strong></td><td>低风险动作自动执行，异常升级给人</td><td>CleanUp / Upgrade 的自动 PR</td></tr>
    <tr><td><strong>L4 全自动</strong></td><td>端到端自治</td><td>Shift-Left 的远期愿景</td></tr>
  </tbody>
</table>
</div>

有了这个框架，「从小处开始」就有了具体的含义——它不是「先跑一个小智能体」，而是**先选低层级的判断类型**：

<div class="callout callout-amber">
  <div class="callout-label">四步落地路径（作者建议）</div>
  <p><strong>① 先建确定性基座</strong>：注册中心、SBOM、依赖图、历史例外库。没有确定性数据，判断无从谈起——Uber 先建注册中心、后上智能体的顺序并非巧合。</p>
  <p><strong>② 按判断类型选试点</strong>：从事实判断（修剪）与时机判断（升级）入手（L3 风险最低、可回滚），责任判断次之，先例判断（L2 及以下）最后放开。</p>
  <p><strong>③ 为每类判断定目标层级与人工出口</strong>：明确异常升级路径——什么情况下必须回到人。人工出口不是备份，是系统的组成部分。</p>
  <p><strong>④ 治理智能体本身</strong>：决策日志、先例库定期重审、幻觉与误批检测、回滚机制。OSPO 的治理对象从「依赖」扩展到「治理依赖的智能体」。</p>
</div>

<div class="table-wrap">
<table>
  <thead><tr><th>角色</th><th>重点动作</th></tr></thead>
  <tbody>
    <tr><td><strong>OSPO 负责人</strong></td><td>用判断分类学规划路线图；把「可审计性」设为智能体上线的硬门槛，而非事后补课</td></tr>
    <tr><td><strong>合规工程师</strong></td><td>把历史例外、采购协议、上游源码比对沉淀为结构化知识库，并建立先例失效与重审机制</td></tr>
    <tr><td><strong>平台工程团队</strong></td><td>参照 Uber 的 MCP 控制面思路：先有统一注册中心与 SBOM，再提供智能体可用的工具接口</td></tr>
  </tbody>
</table>
</div>

<div class="callout callout-amber">
  <div class="callout-label">值得关注的信号（判断正确/错误的验证点）</div>
  <p><strong>①</strong> 若 2027 年 TODO 工作组发布可复用的「审批智能体」参考架构，说明短期预判方向成立；</p>
  <p><strong>②</strong> 若主流 SCA/SBOM 工具开始内置 agent 接口而非只输出扫描报告，说明智能体治理进入主流工具链；</p>
  <p><strong>③</strong> 若头部公司公开披露智能体误批事件及其处理方式，说明行业进入成熟期；</p>
  <p><strong>④</strong> 若 2027 年底仍无第二家头部公司公开披露审批类智能体实践，说明「短期高置信度」预判过于乐观。</p>
</div>

## 结语

![收尾页：三条 Takeaway 与致谢（作者摄于 OSSEU 2026 现场）](takeaways.png)

Chris 以三句话收尾：智能体工具把检测变成判断；开发者体验是一种合规战略；从小处开始、建立信任、规模化自动化。结合 Uber 的完整实践，这三句话可以这样理解：判断自动化的目标不是取代人的判断，而是把稀缺的人类判断从重复性决策中解放出来，投向机器不擅长的部分——新场景、边界情况，以及对智能体本身的治理。当「判断」也被自动化，OSPO 的价值不再是流程本身，而是让流程可信的那套数据、护栏与责任机制。

## 参考链接

- [Session 官方条目：How Uber Uses Intelligent Agents for Open Source Governance（OSSEU 2026 Sched）](https://osselceu2026.sched.com/event/2RaX7/how-uber-uses-intelligent-agents-for-open-source-governance-chris-howard-uber)
- [Ask the Expert：Chris Howard, Head of Open Source — Consuming OSS at Scale（OSSEU 2026 Sched）](https://osselceu2026.sched.com/event/2Rcju/ask-the-expert-session-chris-howard-head-of-open-source-on-consuming-oss-at-scale)
- [AAIF：How Uber Runs 60,000 AI Agent Tasks Per Week With MCP（2026.05.14）](https://aaif.io/blog/how-uber-runs-60000-ai-agent-tasks-per-week-with-mcp)
- [Linux Foundation：TODO Group Launches Working Group on Agentic AI to Empower OSPOs（2026.05.19）](https://www.linuxfoundation.org/blog/todo-group-launches-new-working-group-on-agentic-ai-to-empower-open-source-program-offices)
- [Linux Foundation：What Agentic AI Asks of Open Source Strategy（2026.07.15）](https://www.linuxfoundation.org/blog/what-agentic-ai-asks-of-open-source-strategy-a-new-layer-for-ospos)
- [TODO Group：OSPOlogy + OSPO Summit China 2026 Recap（2026.09.19）](https://todogroup.org/blog/2026-09-19-ospology-ospo-summit-china-2026-recap/)
- [TODO Group：Open Source Program Case Studies — Uber（2019.07.24）](https://todogroup.org/blog/open-source-case-studies-uber/)
- [SDxCentral：Facebook, Google, and Uber Join OpenChain（2018.12.06）](https://www.sdxcentral.com/news/facebook-google-and-uber-join-open-source-compliance-project-openchain/)
- [Linux Foundation Events：OSSEU 2026 议程公告（2026.08.05）](https://events.linuxfoundation.org/2026/08/05/open-source-summit-embedded-linux-conference-europe-2026-schedule-champions-open-source-innovation-and-marks-35-years-of-linux/)

*文中幻灯片照片均为作者摄于 OSSEU 2026 现场，幻灯片内容版权归 Uber 与演讲人所有；现场之外的数据均已标注来源与时间。「判断分类学」「共同设计原则」「人机回环分级」「落地路径」等为作者基于演讲内容的分析框架，非 Uber 现场表述。另：Session 官方摘要（Sched）中的规模数据为「6 Monorepos、4k microrepos、35k+ dependencies」，与现场幻灯片（110k 第三方依赖、40k 直接依赖、3k microrepos）口径存在差异，本文以现场幻灯片为准。*
