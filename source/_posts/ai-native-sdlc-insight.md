---
title: AI 原生 SDLC：当代码不再是瓶颈
date: 2026-10-07 19:30:00
tags: [AI, SDLC, Agent, DevOps, 工程效能, opencode, 开源, 治理]
categories: AI
description: 以版本化工件链与分级门禁重构研发生命周期的实践框架
---

## 一、引言：当构建塌缩为小时级

2026 年，组织使用 Agent 产码的速度已与一年前不可同日而语，但围绕代码的流程并未同步进化。审批门禁、评审队列、阶段交接、治理政策——这些为「人写代码」时代设计的机制，正在吞噬 agentic 编码工具带来的效率增益。

大多数组织运行着某个版本的六阶段 SDLC：计划、设计、构建、测试、部署、维护。传统上每个阶段由不同角色拥有——产品经理写需求，架构师转成设计，工程师实现，QA 验证，发布团队上线，运维监控生产。工作通过文档、工单和签字在阶段之间流转。这套流程的控制目标是合理的：在以周、月、季度计的开发周期里强制对齐。但当 Agent 把构建阶段压缩到小时级，流程本身成了新的约束。

<div class="verdict">
  <p class="verdict-title">核心判断</p>
  <p>代码不再是瓶颈之后，<strong>瓶颈转移到了构建左右两侧仍以人速运行的环节</strong>——计划、评审、部署与治理。只加速编码而不重造流程，产出要么积压、要么带病逃逸。研发生命周期需要一次与构建阶段同等级别的改造，而不是给旧流程换一个更快的引擎。</p>
</div>

本文整理自 Anthropic Applied AI 团队 2026 年 8 月发布的《The AI-Native SDLC Playbook》的核心框架，并做了两件事：其一，剥离对特定商业工具的绑定，将每个机制映射到以 opencode、AGENTS.md、MCP 为代表的开放生态；其二，补充治理与自治边界的分析视角。原文约 46 分钟阅读量，是一份面向企业的操作手册，本文提炼其方法论骨架。

<div class="callout callout-amber">
  <div class="callout-label">核心术语速览（非专业读者可先读此节）</div>
  <p><strong>工件（artifact）</strong>：每个阶段结束时提交到版本控制的产物——intent.md、spec.md、plan.md、PR 及其评审记录。它是阶段间的交接单位，也是审计的载体。</p>
  <p><strong>计划模式（plan mode）</strong>：Agent 的一种运行模式——可读取代码库但不做修改，先产出实施计划供人审批，通过后再放行实现。</p>
  <p><strong>AGENTS.md</strong>：项目级指令的开放标准文件，存放构建命令、团队约定、架构说明与易错点，Agent 在每次会话开始时自动读取。</p>
  <p><strong>技能（SKILL.md）</strong>：把组织政策（安全、合规、品牌）编码为可触发、可版本化的指令文件，Agent 在相关任务中自动加载。</p>
  <p><strong>评测（evals）</strong>：针对 Agent 配置变更的回归测试套件——换模型、改提示词、调整 AGENTS.md 时，验证 Agent 仍以同样标准完成工作。</p>
  <p><strong>护栏（hooks / 权限门禁）</strong>：在 Agent 每次行动前强制执行的确定性检查，可放行、询问或阻断，不受提示词影响。</p>
  <p><strong>控制带（σ）</strong>：生产指标的统计基线区间，偏离 1σ / 2σ / 3σ 对应不同级别的自动化响应。</p>
</div>

## 二、瓶颈的转移：流程为什么必须重造

构建阶段的时长由月级塌缩到小时级后，三个结构性变化随之出现。它们不是效率问题，而是控制问题——这意味着无法靠「再快一点」解决。

<div class="callout callout-rose">
  <div class="callout-label">构建塌缩后的三个转移</div>
  <p><strong>① 瓶颈向两侧迁移</strong>：左侧的计划、右侧的评审与部署仍以人速运行。整体节奏被最慢的人速环节锁死，构建的提速被流程吞掉。</p>
  <p><strong>② 控制与现实脱节</strong>：逐行人工评审在「人写的代码」上是合理的控制；当 Agent 产出大部分 diff，要么评审队列积压，要么代码欠审上线——受监管的组织两者都不能接受。</p>
  <p><strong>③ 治理成本上升</strong>：例外仍然路由到每周或每月开会的委员会。Agent 的产出速度撞上会议节奏，治理从保障变成堵点。</p>
</div>

以安全团队为例：安全编制按「人的产出」配置，Agent 把代码产量放大数倍后，安全检查若不能与 Agent 同速，前面三个转移就会同时发生。原文用一张三车道图描述了这个结构性错位：

<div class="figure-svg">
  <img src="bottleneck-shift.svg" alt="瓶颈转移三车道图：传统 SDLC 构建以月计；只加速编码时评审与审批出现积压；AI 原生闭环由工件与门禁串联各阶段，事故记录回流为新的意图" style="width:100%">
</div>

三条车道的差异不在于各阶段的时长，而在于**阶段之间靠什么衔接**：传统流程靠会议与签字，AI 辅助只压缩了构建的时长而保留了人速衔接，AI 原生则用工件与门禁取代了人速衔接，并让生产信号回流为新的工作输入。

## 三、从流水线到闭环：两个不变式

AI 原生 SDLC（也被称为 agentic SDLC 或 agentic 软件开发）保留旧流程的控制目标，但更换执行方式：线性流程变成循环，AI 嵌入每个点位，阶段交接由提交工件自动触发。整个体系建立在两个不变式之上：

1. **每个阶段以「向版本控制提交一个工件」结束，下一个阶段以「读取它」开始**；
2. **人类仍然为每一个需要判断的决策负责**——只是注意力的位置，从逐行看代码上移到门禁处审工件。

<div class="figure-svg">
  <img src="sdlc-loop.svg" alt="六阶段闭环与工件链：计划、设计、构建、测试、部署、维护六阶段环形排布，弧线上是各阶段提交的工件，中心是 Git 版本控制与审计轨迹，维护到计划的红色虚线表示无人启动的闭环回流" style="width:100%">
</div>

图中有三个值得注意的设计。第一，早期阶段的工件是 Markdown——产品负责人和 Agent 都能读、都能据此行动；从构建开始，工件变为代码及其记录。第二，橙色菱形是人工门禁，是注意力集中的位置；红色虚线是闭环回流——生产越带信号自动生成下一份意图，启动路径上无人。第三，中心不是任何工具，而是 Git：**提交链本身就是审计轨迹**——谁要求了什么、Agent 产出了什么、谁批准了它。

### 3.1 六个阶段的对照

<div class="table-wrap">
<table>
<thead><tr><th>阶段</th><th>传统 SDLC</th><th>AI 原生 SDLC</th></tr></thead>
<tbody>
<tr><td><strong>计划</strong></td><td>委员会收集需求，经工作坊与签字提炼，手工撰写成文</td><td>Agent 从源头综合痛点，产出人可读、机器可执行的 intent.md</td></tr>
<tr><td><strong>设计</strong></td><td>分析师写规格，设计师再解析成设计，两个团队两次转译</td><td>需求与设计压缩为一次 Agent 会话，标准以技能形式编码为约束、随 git 版本化</td></tr>
<tr><td><strong>构建</strong></td><td>代码与测试手写，文档事后补</td><td>先计划后实现（plan.md），制度知识固化为版本化的 AGENTS.md 与技能</td></tr>
<tr><td><strong>测试</strong></td><td>阶段边界上的 QA 门禁</td><td>持续评测编织进实现全程，Agent 配置获得与代码同等的回归测试</td></tr>
<tr><td><strong>部署</strong></td><td>人工逐行评审，治理散落在不一致的评审周期里</td><td>分层 Agent 评审，人工保留给受监管与关键代码；治理以护栏在 Agent 行动时实时执行</td></tr>
<tr><td><strong>维护</strong></td><td>人盯生产、等告警、抢单</td><td>Agent 监控线上部署，控制带被突破即自动诊断，作为新的 intent.md 写回循环</td></tr>
</tbody>
</table>
</div>

### 3.2 工件链：闭环的骨架

贯穿整个体系的那条线，是「被提交的工件」。它是流程的骨架、审计的载体，也是自动化的触发器：

<div class="table-wrap">
<table>
<thead><tr><th>阶段结束</th><th>提交的工件</th><th>人工审校</th><th>触发什么</th></tr></thead>
<tbody>
<tr><td><strong>计划</strong></td><td>intent.md（问题 / 期望结果 / 影响面 / 约束 / 待解问题）</td><td>产品负责人</td><td>进入需求与设计会话</td></tr>
<tr><td><strong>设计</strong></td><td>spec.md（含被标记的关切点）</td><td>产品负责人；高风险加技术负责人</td><td>进入计划模式</td></tr>
<tr><td><strong>构建</strong></td><td>plan.md + diff 及其测试</td><td>工程师；高风险升级</td><td>进入测试验证</td></tr>
<tr><td><strong>测试</strong></td><td>验证证据 + evals 结果</td><td>代码所有者（PR 评审）</td><td>PR 合并触发流水线</td></tr>
<tr><td><strong>部署</strong></td><td>PR 及其评审发现 + 发布授权</td><td>发布经理（生产门禁）</td><td>进入运行监控</td></tr>
<tr><td><strong>维护</strong></td><td>事故记录 / 诊断报告</td><td>值班分诊（修 / 排期 / 驳回）</td><td>生成新的 intent.md，闭环继续</td></tr>
</tbody>
</table>
</div>

### 3.3 与遗留系统共存：单一事实源

工单可能在 Jira，需求在带合规追溯的工具里，设计在 Figma，变更审批走变更委员会。这些系统难以替换——审计方已接受它们，其他团队依赖它们。AI 原生 SDLC 必须围绕现状安装，做法是为每个工件指定唯一事实源：

<div class="table-wrap">
<table>
<thead><tr><th>方案</th><th>事实源</th><th>适用场景</th></tr></thead>
<tbody>
<tr><td><strong>仓库为事实源</strong></td><td>Markdown 工件是权威记录，遗留系统引用 commit 内的文件</td><td>工程主导型组织：所有记录一个工具、一个时间戳权威</td></tr>
<tr><td><strong>遗留系统为事实源</strong></td><td>Jira / ServiceNow 持有权威记录，Markdown 是工作副本；Agent 会话开始读记录、结束通过连接器写回</td><td>合规追溯要求高的组织</td></tr>
<tr><td><strong>链接为最低标准</strong></td><td>工件标注记录 ID，遗留记录包含 commit SHA</td><td>过渡期：可接受双事实源，但必须互链</td></tr>
</tbody>
</table>
</div>

在 agentic 世界里，人的注意力随必须评审的工件一起上移：从审代码行，到审意图、规格与计划。判断仍然属于人，被判断的对象升维了。

## 四、六阶段实践

以下六个实践单元（plays）相互独立、可按组织需要排优先级。每个实践回答四个问题：什么变了、怎么起步、怎么治理、怎么度量。

### 4.1 计划：意图即工件

想法不再等别人代笔——意图以发起人自己的话被捕获一次，成为下一阶段可直接执行的版本化工件。发起人与 Agent 头脑风暴，用自己的话写下 intent.md；产品负责人审校并决定接受或关闭，这是第一个门禁。

入口多样而格式唯一：人的灵感、工单、生产告警（见 4.6）都收敛为同一格式。一个可运行的示例：

```markdown
# 意图：理赔状态自助查询
# 作者：J. Ortiz（理赔运营）　状态：草稿

## 问题
客户打电话到客服中心询问理赔进度，
状态类咨询约占客服通话时长的三分之一。

## 期望结果
客户可在门户中看到理赔状态、下一步动作与预计完成日期。

## 受影响用户与系统
理赔客服、门户团队、理赔核心 API。

## 约束
门户会话不新增 PII 字段；仅用现有认证方式。

## 待解问题
第三方公估机构是否也需要访问？
```

**度量**：先行指标是首次对话到 intent.md 提交的时长（git 时间戳），预期从数周的提炼周期降到数小时；滞后指标是意图存活率（被接受进入设计阶段的占比），以及设计开始后对 intent.md 的修改次数——后者越低，说明意图在移交前已被充分澄清。

### 4.2 设计：一次会话完成需求与设计

需求与设计合并为一次会话；政策在规格撰写时被实时应用，而不是数周后在评审里被「发现」。Agent 读取 intent.md，在组织技能（品牌 / 安全 / 合规 / UX）的约束下产出规格，并主动标记关切点——尤其是政策互相冲突的地方。

优先处理被标记的关切：传统流程中这些正是分析师会上报的问题，产品负责人与政策负责人应在工程介入前逐条裁决。spec.md 与 intent.md 成对提交：一份记录要了什么，一份记录决定了什么。产品负责人决定是否进入构建，这个决定永远由人做。

```markdown
阅读附带的 intent.md，为将其集成进现有代码库产出一份需求与设计规格。
应用你可用的全部技能，使方案符合我们的品牌规范、安全政策与 UX 标准。
将规格完整写为 spec.md，可直接交给工程团队。
清晰描述所有关切点，尤其是你无法满足互相冲突政策之处。
```

**度量**：先行指标是 intent 提交到 spec 提交的间隔（两个 git 时间戳）；滞后指标是构建开始后的需求返工——统计同一变更中晚于首个 plan.md 的 spec.md 提交次数。

### 4.3 构建：先计划，后实现

没有被接受的计划就不写代码。Agent 在计划模式里可以读代码库但不能改，工程师在代码产生之前修正计划，批准版本提交为 plan.md 供后续阶段比对——设计评审发生在改文档还很便宜的时刻。迭代到「没看过这场对话的工程师，也能只凭 plan.md 实现」。

计划扎实的情况下，实现往往一遍过；实现偏离计划时，应在同一提交内更新 plan.md。护栏齐备后可转向自动接受：项目说明经过调教、政策编码为技能、阻断式护栏就位、测试可自跑时，影响面小且测试覆盖的常规变更默认放行，配合 git worktree 实现一人并行推进多个会话。

**项目说明**是 Agent 的「新员工手册」，用 `/init` 生成起始版本后，删到一个新成员第一天需要的量。保持在一页以内——Agent 每次会话都会全文读取，过时内容只会白白占用上下文。工作法则：同一个错误犯第二次，纠正就写进去。

```markdown
# 支付服务

## 命令
- 构建: make build
- 测试: make test（单元）; make itest（集成，需要 docker）
- 检查: make lint（CI 会跑；推送前修完）

## 约定
- Java 21, Spring Boot 3。不引入新 Lombok。
- 金额一律 BigDecimal，禁止 double。

## 架构
- api/ 放 REST 控制器；core/ 放领域逻辑；adapters/ 对接外部系统。

## Agent 常犯的错
- 不要升级依赖版本，平台团队负责。
- legacy v1/ 包已冻结，改动进 v2/。

## 完成标准
- 汇报任务完成前：跑完 构建/测试/检查 并贴出输出。
- 测试失败时修代码；不许改测试来「变绿」。
```

**技能与护栏是一对控制手段**。技能是建议性控制：把必须一致执行的制度知识写成 SKILL.md——frontmatter 声明何时触发，正文说明怎么做。护栏是确定性控制：技能让违规变少，护栏让违规接近不可能。经验法则：必须一致应用的制度知识写技能；属于项目约定的进 AGENTS.md；一次性的进提示词。

```markdown
---
name: secure-api-review
description: 应用 API 安全标准。凡创建或修改对外端点、
  评审 API 代码、生成 OpenAPI 规格时使用。
---

# 安全 API 评审

创建或变更端点时：
1. 认证：所有端点必须走网关 JWT；/health 之外禁止匿名路由。
2. 输入校验：按 OpenAPI schema 校验请求体，拒绝未知字段。
3. 审计：所有状态变更端点发出审计事件（主体/动作/实体/时间）。
4. 数据分级：schema 中标记 pii 的字段禁止出现在日志与报错中。

运行 scripts/check-endpoints.sh，并在总结中附上输出。
```

**并行会话与子代理**是构建阶段的产能杠杆。并行会话是另一个完整的 Agent 实例，在独立的 git worktree 里干独立任务；子代理是会话内有独立上下文与工具白名单的受限帮手，适合跨任务复用的工作——代码简化器、验证器、研究员。用 plan.md 判断哪些任务互不触碰文件，共享文件的任务排在同一会话里顺序执行。两三个并行会话是合理起点，上限是一个人能认真评审的并行任务数。工程师的职责转型为编排与评审。

**度量**：先行指标是首次实现即合并的变更占比、计划批准到 PR 合并的时长；滞后指标是每变更返工轮次、合并 diff 与已提交 plan.md 的吻合率。

### 4.4 测试：自检会话与持续评测

每个会话在人看到之前先自检。把检查封装为单命令目标（make test / npm test），失败即非零退出；目标要可量化，让 Agent 无需反问即可自检——「test_status.py 全绿」「截图与设计稿一致」「端点返回 200 且含新字段」。Bug 修复先写失败测试：让 Agent 把 bug 复现为测试、运行、确认按预期失败、提交，然后才允许它在不改测试的护栏下修绿。一份先于修复存在、Agent 无法改写的测试，才是 bug 已消失的证据。

回路本身需要保护：修代码的 Agent 不能弱化对那段代码的检查，护栏应阻断修复任务中对测试文件的编辑。

**持续评测（evals）是阶段门禁 QA 的 AI 原生等价物**：一套随 Agent 配置变更而运行的真任务集。平台工程师收集 20-50 个近期真实任务及其验收结论，每个写成一条评测；套件在 CI 中非交互运行，配置变更以结果为门——拉低通过率的技能改动，先评审再合并。每个生产事故固化成一条 eval，永久留在套件里作为回归测试。

```yaml
name: Agent evals
on:
  pull_request:
    paths: ['AGENTS.md', '.opencode/**']
  schedule:
    - cron: '0 2 * * *'
jobs:
  evals:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm install -g opencode-ai
      - name: 运行评测套件
        env:
          OPENCODE_API_KEY: ${{ secrets.OPENCODE_API_KEY }}
        run: |
          for eval in evals/*.json; do
            opencode run "$(jq -r '.prompt' $eval)" > result.json
            ./evals/check.sh "$eval" result.json
          done
```

**度量**：先行指标是 Agent 变更的 CI 首过率、事故转化为永久 eval 的时长；滞后指标是单 PR 评审时长（验证前置接住问题后应显著下降）、CI 捕获与生产逃逸的回归比。

### 4.5 部署：评审双向化，门禁代码化

评审双向进行：Agent 既评审 incoming PR（对照组织政策），也处理自己 PR 上的评审意见。人的注意力上移一层——这个变更是否做了计划要它做的事、风险是否可接受。技术负责人把评审政策写成仓库根目录的 REVIEW.md：分通道（Bug / 安全 / 合规）、定义 Important 与 Nit、设 Nit 上限、点名跳过项。

```markdown
# 评审要求

## 通道（跑三遍，发现标注所属通道）
- Bug：逻辑错误、边界破坏、隐性回归
- 安全：注入风险、认证缺口、日志中的 PII
- 合规：与 spec.md、plan.md 及设计原则一致

## Important 的定义
只有会破坏行为、泄露数据或违反政策的发现记 Important；
风格与命名一律是 Nit。

## Nit 上限
每次评审最多报 5 条 Nit，其余汇总为计数。
```

**发现只排序、不拍板**：分支保护仍要求代码所有者批准——写代码的 Agent 没有任何途径批准代码，职责分离天然成立。评审发现回流 AGENTS.md：同一错误第二次被标记，纠正就随这次评审写入，从下一个 PR 起即被拦下。

护栏在部署阶段承担第三种裁决：**询问**——暂停动作，直到指定的人批准。工程管理层与变更管理、合规一起列出必须保留的人工审批（变更签字、发布授权、受保护路径编辑），平台工程师把每个门禁表达为配置。按环境分层自治：开发环境自由部署，预发居中，生产由 Agent 准备发布、发布经理授权。回滚必须是全流水线演练最充分的路径——闭环（4.6）会调用它，可用性要提前证明。

```json
{
  "$schema": "https://opencode.ai/config.json",
  "permission": {
    "edit": "ask",
    "bash": "allow",
    "read": "allow",
    "webfetch": "deny",
    "mymcp_*": "ask"
  }
}
```

部署能力通过 MCP 暴露为受控工具白名单——deploy / status / rollback 是三个按环境授权的工具，而不是一段带凭证的 shell 脚本。Agent 的一切写入都变成 PR，没有直推主干的路。

**度量**：先行指标是首次评审响应时长（应降到分钟级）、各门禁的等待时长；滞后指标是合并前捕获与逃逸到生产的缺陷比、DORA 指标。

### 4.6 维护：闭环回流

前五个阶段仍需要人启动初始步骤，维护阶段移除了这个前提：控制带越界、工单、频道消息或日程触发 Agent，无人启动。Agent 诊断、只走受控路由行动，把发现写成 intent.md 进入既有各阶段。人负责分诊与评审，不再负责启动。

同一骨架可挂载其他触发源：定时安全扫描（发现先验证再报告）、工单与事件频道的消息。产出小则走 PR 门禁，大则写成 intent.md 从计划阶段重来。「提出修复的 Agent 没有路径批准它」始终成立。

## 五、治理：分层控制栈与自治边界

「技能让违规变少，护栏让违规接近不可能，人负责判断。」控制不是一层墙，而是一个栈：

<div class="figure-svg">
  <img src="control-stack.svg" alt="分层控制栈：从下到上依次为确定性控制（每动作）、建议性控制（每相关任务）、上下文层（每会话）、人类判断（每门禁），约束强度自下而上递增" style="width:100%">
</div>

三层机器控制由下而上强制性递增、覆盖面递减；人类判断位于栈顶，保留所有需要裁量的决策。一条政策的典型落地路径：先写成技能在编码时引导，有零例外要求再加护栏兜底，需要裁量权的留在门禁。

<div class="callout callout-rose">
  <div class="callout-label">治理清单</div>
  <p><strong>① 证据来自工具链</strong>：make test 的原始输出、构建日志、截图 diff 由 Agent 运行并附于会话与 PR——评审者与审计者看到的是同一份。</p>
  <p><strong>② PR 即审计记录</strong>：发现、修复、评级、批准都留在 PR 历史里；护栏的每次允许 / 询问 / 拒绝决策带时间戳写入遥测。</p>
  <p><strong>③ 指令本身可审计</strong>：AGENTS.md 与技能进版本控制，Agent 依据的每条指令都可回溯到某次被评审的变更。</p>
  <p><strong>④ 自治按环境分层</strong>：开发自由、预发居中、生产必须发布授权——Agent 可以做到生产门禁为止的一切，且不能越过它。</p>
</div>

### 5.1 自治的边界：分级行动

自治不是一个开关，而是一个刻度盘。维护阶段的闭环采用「确定性检测 + 分级行动 + 人工分诊」：检测保持确定性（版本化脚本跑统计控制规则，模型不参与），行动按偏离程度分级：

<div class="figure-svg">
  <img src="tiered-action.svg" alt="分级行动台阶图：1σ 仅记录，2σ 只读诊断并进入人工分诊，3σ 受控行动（回滚 PR 或预批准 runbook），自治度自左向右递增" style="width:100%">
</div>

分级响应写进版本化配置：

```yaml
metric: ci_test_failure_rate
baseline: rolling_30d
rules: western_electric

tiers:
  1sigma: { action: log }
  2sigma: { action: diagnose,
            tools: "read,grep,bash(gh run view *)" }
  3sigma: { action: propose,
            routes: [pull_request, runbook:rollback-deploy] }
```

值班或服务负责人分诊诊断结果：立即修 / 排期 / 驳回。驳回用于调优阈值降噪；修复上线后为该类事故加一条 eval，从此受套件保护。

<div class="verdict">
  <p class="verdict-title">放权条件</p>
  <p>放权到哪一级，不取决于对模型的信心，而取决于<strong>该层级是否具备确定性兜底</strong>：runbook 是否预先批准、回滚是否演练过、评审门禁是否覆盖全部行动路径。三个问题都有肯定答案，自治即可上移一级；任何一个是否定的，该决策必须留在人手里。</p>
</div>

## 六、工具中立：开放生态映射

这套体系的价值在流程架构（工件链 + 门禁 + 分级自治），不在任何特定工具。原文的每个机制，在开放生态里都有对等物：

<div class="stats-grid">
  <div class="stat-card">
    <div class="stat-num">75+</div>
    <div class="stat-label">模型提供商（opencode，2026.09）</div>
  </div>
  <div class="stat-card">
    <div class="stat-num">206K+</div>
    <div class="stat-label">GitHub Stars（opencode，2026.09）</div>
  </div>
  <div class="stat-card">
    <div class="stat-num">1K+</div>
    <div class="stat-label">Contributors（opencode，2026.09）</div>
  </div>
  <div class="stat-card">
    <div class="stat-num">4</div>
    <div class="stat-label">开放标准：AGENTS.md / SKILL.md / MCP / ACP</div>
  </div>
</div>

<div class="table-wrap">
<table>
<thead><tr><th>核心概念</th><th>原文语境（Claude 生态）</th><th>开放 / 中立的等价实现</th></tr></thead>
<tbody>
<tr><td><strong>项目上下文</strong></td><td>CLAUDE.md</td><td>AGENTS.md 开放标准——Codex、opencode、Cursor、Gemini CLI 等通用</td></tr>
<tr><td><strong>计划模式</strong></td><td>Claude Code plan mode</td><td>opencode 计划模式（Tab 切换）；Aider architect 模式</td></tr>
<tr><td><strong>制度知识</strong></td><td>Claude Skills</td><td>SKILL.md 技能格式（opencode 等原生支持），政策变更走 PR</td></tr>
<tr><td><strong>确定性护栏</strong></td><td>Claude Code hooks</td><td>权限系统（allow / ask / deny）+ 插件生命周期 + pre-commit / CI 检查</td></tr>
<tr><td><strong>子代理</strong></td><td>.claude/agents/</td><td>opencode 自定义 Agent（Markdown 定义，声明工具与模式）</td></tr>
<tr><td><strong>PR 评审</strong></td><td>托管 Code Review / claude-code-action</td><td>opencode run 接入 GitHub Actions 自建，或任意开放评审机器人</td></tr>
<tr><td><strong>非交互执行</strong></td><td>claude -p</td><td>opencode run——可脚本化、进 CI、进 cron</td></tr>
<tr><td><strong>工具 / 部署暴露</strong></td><td>MCP 集成</td><td>MCP 开放协议：deploy / status / rollback 封装为受控工具白名单</td></tr>
<tr><td><strong>编辑器集成</strong></td><td>Claude Code 生态</td><td>ACP 协议：Zed / JetBrains / Neovim 直接接入 opencode</td></tr>
<tr><td><strong>模型</strong></td><td>Anthropic 模型</td><td>75+ 提供商任选（含本地模型），可按任务混搭、随演进切换</td></tr>
</tbody>
</table>
</div>

为什么值得工具中立？四个理由。其一，**模型能力在快速漂移**——当前一代模型的能力边界约六个月一变，把流程绑死在单一供应商等于把研发体系押注在别人的路线图上。其二，**真正的资产留在仓库里**——AGENTS.md、技能、evals、bands.yaml、REVIEW.md 全是 git 里的文件，工具会换，工件长存。其三，**标准已成，切换成本被摊薄**——AGENTS.md、SKILL.md、MCP、ACP 都是开放协议，今天在 A 工具里写的项目指令，明天在 B 工具里原样生效。其四，**审计轨迹本来就在手里**——提交链就是审计轨迹，合规与数据驻留的答案写在协议里，不在采购合同里。

### 6.1 渐进落地路径

实践单元模块化、依赖显式。从无前置依赖的第一站起步，按组织节奏推进——顺序可以调整，依赖不能跳过：

<div class="policy-flow">
  <div class="pf-step">
    <div class="pf-num">1</div>
    <div class="pf-body">
      <div class="pf-title">打地基</div>
      <div class="pf-desc">AGENTS.md + 单命令验证。零依赖，当天可启动</div>
    </div>
  </div>
  <div class="pf-arrow">→</div>
  <div class="pf-step">
    <div class="pf-num">2</div>
    <div class="pf-body">
      <div class="pf-title">建工件链</div>
      <div class="pf-desc">计划模式 + intent / spec / plan，评审对象从代码上移到工件</div>
    </div>
  </div>
  <div class="pf-arrow">→</div>
  <div class="pf-step">
    <div class="pf-num">3</div>
    <div class="pf-body">
      <div class="pf-title">评审与评测</div>
      <div class="pf-desc">REVIEW.md + 持续 evals，配置变更像代码一样回归</div>
    </div>
  </div>
  <div class="pf-arrow">→</div>
  <div class="pf-step">
    <div class="pf-num">4</div>
    <div class="pf-body">
      <div class="pf-title">门禁与流水线</div>
      <div class="pf-desc">权限 / 护栏 + CI 非交互执行，部署 MCP 化、按环境分级</div>
    </div>
  </div>
  <div class="pf-arrow">→</div>
  <div class="pf-step">
    <div class="pf-num">5</div>
    <div class="pf-body">
      <div class="pf-title">闭环自治</div>
      <div class="pf-desc">确定性检测 + 分级行动，事故固化为永久 eval</div>
    </div>
  </div>
</div>

<style>
.policy-flow { display: flex; align-items: stretch; gap: 6px; margin: 1.5em 0; }
.pf-step { flex: 1; display: flex; gap: 10px; background: var(--surface, #fafaf9); border: 1px solid var(--border-light, #e7e5e4); border-radius: 8px; padding: 12px; }
.pf-num { flex-shrink: 0; width: 26px; height: 26px; border-radius: 50%; background: #b45309; color: #fff; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.pf-title { font-size: 13.5px; font-weight: 700; color: var(--text, #292524); margin-bottom: 4px; }
.pf-desc { font-size: 12px; color: var(--text-muted, #57534e); line-height: 1.6; }
.pf-arrow { align-self: center; color: #a8a29e; font-size: 16px; flex-shrink: 0; }
:root[data-theme="dark"] .pf-step { background: var(--surface, #1c1917); }
:root[data-theme="dark"] .pf-num { background: #d97706; }
:root[data-theme="dark"] .pf-arrow { color: #57534e; }
@media (max-width: 768px) {
  .policy-flow { flex-direction: column; align-items: stretch; }
  .pf-arrow { text-align: center; padding: 2px 0; transform: rotate(90deg); }
}
</style>

**度量体系**：几乎所有指标都能从 git 历史、PR 元数据、CI 日志与遥测导出中直接读取——度量本身不需要新工具，因为流程已经把证据写进了版本控制。

<div class="table-wrap">
<table>
<thead><tr><th>阶段</th><th>先行指标（牵引改进）</th><th>滞后指标（验证结果）</th></tr></thead>
<tbody>
<tr><td><strong>计划</strong></td><td>首次对话 → intent.md 提交时长（数周 → 数小时）</td><td>意图存活率；设计开始后对 intent 的修改数</td></tr>
<tr><td><strong>设计</strong></td><td>intent 提交 → spec 提交间隔</td><td>构建开始后的需求返工次数</td></tr>
<tr><td><strong>构建</strong></td><td>首过即合并占比；并行会话数（评审质量保持为前提）</td><td>每变更返工轮次；diff 与 plan.md 吻合率</td></tr>
<tr><td><strong>测试</strong></td><td>Agent 变更的 CI 首过率；事故 → eval 转化时长</td><td>单 PR 评审时长；CI 捕获 / 生产逃逸回归比</td></tr>
<tr><td><strong>部署</strong></td><td>首次评审响应（分钟级）；门禁等待时长</td><td>合并前捕获 vs 逃逸缺陷；DORA 指标</td></tr>
<tr><td><strong>维护</strong></td><td>越带 → intent.md 进入分诊队列时长</td><td>发现 → 合并修复转化率；同类重复事故率</td></tr>
</tbody>
</table>
</div>

## 七、结语

这套体系的本质可以压缩成三句话。**流程即循环，工件即骨架**：六阶段不再靠会议交接，而靠「提交工件 → 触发下一站」的机械节奏运转，git 提交链同时就是审计轨迹。**人上移，不下场**：人的注意力从代码行上移到意图、规格与风险，在门禁处评审 Agent 标记出的内容。**自治分级，兜底先行**：自治的每一级扩张都以确定性兜底为前提，检测永远确定性，行动永远受门禁。

> The loop keeps running. Human judgement stays above it.
> —— Anthropic《The AI-Native SDLC Playbook》（2026.08）

从趋势看，模型与执行框架的进步让组织有机会改造的不只是「怎么产码」，而是整个软件开发生命周期。这场改造把人类判断保持在流程中心，同时满足大型企业的治理与合规要求。而工具中立是这套体系的最后一道保险：模型会换、工具会换，但仓库里的 AGENTS.md、工件链与 evals 会一直工作下去。

起步动作很小：给一个仓库跑 `/init`，把验证收敛为一个命令，观察 Agent 在哪里犯错——同一个错误出现第二次时，就知道该往 AGENTS.md 里写什么。

<div class="callout callout-amber">
  <div class="callout-label">参考与备注</div>
  <p><strong>原文</strong>：<a href="https://claude.com/blog/the-ai-native-sdlc-playbook">The AI-Native SDLC Playbook</a>（Louis Claxton，Anthropic，2026-08-21）</p>
  <p><strong>开放工具</strong>：<a href="https://opencode.ai">opencode</a> · <a href="https://agents.md">AGENTS.md 标准</a> · <a href="https://modelcontextprotocol.io">MCP 协议</a> · <a href="https://agentclientprotocol.com">ACP 协议</a></p>
  <p>本文为独立改写与扩展，不隶属于 Anthropic。文中 opencode 社区数据取自其官网（2026.09）；六阶段框架与治理原则源自原文，工具映射与「放权条件」分析为本文补充。</p>
</div>
