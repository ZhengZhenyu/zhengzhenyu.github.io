---
title: CNCF 深度洞察：Agent Speed——当扩展单位从「用户数」变成「每用户动作数」
date: 2026-10-08 22:30:00
tags: [CNCF, Kubernetes, AI Agent, 云原生, 推理, 开源, OSS-EU, AI]
categories: 云原生
description: 从 OSS-EU 2026 演讲出发，拆解 CNCF 对 Agentic 时代的理解：agent speed 新度量与软件栈五大缺口
---

## 一、引言：一个讲了十年的故事

2016 年 4 月，OpenStack Summit Austin 的主舞台上，AT&T 讲了一个数字：其网络数据流量 2007-2016 年增长约 150,000%（≈1,500 倍），2015 财年日均承载 114 PB。结论不是「我们需要更快的网络」，而是——**新负载不会带来线性增长，它会改变架构**。那场演讲的主持人是时任 OpenStack 基金会执行董事 Jonathan Bryce。

2026 年 10 月 7 日，Open Source Summit Europe（布拉格）的 CNCF 演讲《Kubernetes is the AI OS: Open Source Building Blocks for Agent Speed》上，同一个人讲了一个结构相同的故事：Anthropic 的数据显示，单个请求触发的连续自主动作从六个月前的 9.8 个增长到 21.2 个（+116%）；系统设计的扩展单位，正在从「用户数」变成「**每用户动作数**」——而每个动作都是一次推理调用。Bryce 现在以 Linux Foundation「Cloud and Infrastructure」执行董事的身份同时领导 CNCF 与 OpenInfra，与 CNCF 开发者体验高级总监 Daniel Krook 同台。

十年前他的论点是「数据洪流必须让开源重造网络」；十年后他把同一个逻辑放进了 agentic 时代。本文基于现场材料与官方来源撰写，全部数据经独立核验，口径差异在正文标注。

<div class="verdict">
  <p class="verdict-title">基本判断</p>
  <p>CNCF 的论证不是「Kubernetes 适合 AI」，而是<strong>负载结构的三重变化——推理连续化、动作链化、身份机器化——恰好落在 Kubernetes 已经解决过的问题域上</strong>（分布式编排、网络、可观测、调度）；而 agent 特有的五件事（动作树调度、按任务计费、身份委托、结果溯源、归因与报酬）正是软件栈还缺的新原语。<strong>演讲真正的价值不在「K8s 是 AI OS」这句口号，而在那张缺口清单——它等于公开了 CNCF 未来 12-18 个月的项目漏斗。</strong></p>
</div>

<div class="callout callout-amber">
  <div class="callout-label">核心术语速览（非专业读者可先读此节）</div>
  <p><strong>推理（Inference）</strong>：用训练好的模型对输入生成输出。与「训练」相对——训练是一次性的大算力投入，推理是每次请求都发生的连续负载。</p>
  <p><strong>Agent Speed（动作链）</strong>：一次人类请求触发的连续机器动作序列（模型调用、搜索、工具调用、事务）。它把负载度量从「请求数」升级为「动作数」。</p>
  <p><strong>KServe</strong>：Kubernetes 上最成熟的模型服务抽象（推理图、金丝雀、自动伸缩），CNCF Incubating 项目。</p>
  <p><strong>vLLM</strong>：当前生产默认的开源 LLM 推理引擎（93k+ Stars，2026-10），以 PagedAttention 内存管理著称。</p>
  <p><strong>llm-d</strong>：CNCF Sandbox（2026-03 加入）的分布式推理与动态路由项目——前缀缓存感知路由 + 异构 GPU 分布式推理，2026 年推理栈最活跃的新变量。</p>
  <p><strong>workload identity（工作负载身份）</strong>：让程序（而非人）持有可验证身份的机制；agent 时代的版本是「身份可委托、授权有期限」。</p>
  <p><strong>provenance（来源证明）</strong>：回答「这个结果是谁、用什么数据、经过什么过程产生的」的密码学声明——agent 时代的审计基石。</p>
</div>

## 二、为什么是现在：从「用户」到「动作」的规模迁移

演讲的第一组对比定义了新度量单位：

<div class="table-wrap">
<table>
  <thead><tr><th>维度</th><th>Human Speed</th><th>Agent Speed</th></tr></thead>
  <tbody>
    <tr><td><strong>请求形态</strong></td><td>1 人 + 1 请求 + 1 响应</td><td>1 人 → 多个 agent + 模型、搜索、工具 + 动作、测试、事务</td></tr>
    <tr><td><strong>容量规划单位</strong></td><td>按用户数 sizing</td><td>按每用户动作数 sizing</td></tr>
    <tr><td><strong>每个动作的成本</strong></td><td>—</td><td>一次推理调用</td></tr>
  </tbody>
</table>
</div>

支撑数字：Anthropic 官方报告显示 Claude Code 的连续工具调用从 9.8 次增至 21.2 次（+116%），分析样本为 20 万个内部编码会话。机器活动复利增长，人类决策点下降——演讲注明了限定：这是早期采用者人群，不是普适的企业基准。

推理之所以成为瓶颈而不是训练，原因有三：训练是间歇性的，推理是**连续、实时**的；agent 把单个用户动作放大为数十次链式模型调用；而标准的负载均衡不懂「这个模型服务实例记得什么前缀、GPU 有多忙」——结果就是慢响应与排队用户。

<div class="stats-grid">
  <div class="stat-card">
    <div class="stat-num">21.2</div>
    <div class="stat-label">单请求连续自主动作数（Anthropic）</div>
  </div>
  <div class="stat-card">
    <div class="stat-num">+116%</div>
    <div class="stat-label">六个月内自主动作增速</div>
  </div>
  <div class="stat-card">
    <div class="stat-num">82%</div>
    <div class="stat-label">容器用户生产环境跑 K8s（CNCF 2025 调查）</div>
  </div>
  <div class="stat-card">
    <div class="stat-num">66%</div>
    <div class="stat-label">AI 采纳者用 K8s 扩展推理负载</div>
  </div>
</div>

「Kubernetes 是 AI 操作系统」的三个数字：82% 的容器用户在生产环境运行 Kubernetes；66% 的 AI 采纳者用它扩展推理负载；7.3M AI 开发者是云原生开发者（CNCF + SlashData Q1 2026，云原生开发者总数 19.9M）。演讲点破了原因：**不是因为 K8s 为 AI 而建，而是因为它为分布式系统而建**——编排、网络、可观测、调度，恰好是推理规模化所需。同时给了另一面：44% 尚未在 K8s 上跑 AI/ML（演讲口径，公开报告未直接证实）、仅 7% 每日部署模型——采用浪潮还在前头。认证体系正在跟上：Kubernetes AI Conformance（KARs）2025-11 启动时 18 个平台，2026-03 增至 31 个，KARs v1.35 已加入 agentic 工作负载验证。

## 三、深度分析 ①：开源推理栈全景

<div class="growth-chart">
  <img src="inference-stack.svg" alt="AI 推理开源栈五层：网关（Envoy AI Gateway/kgateway/Istio）、路由（llm-d router/Kthena router/Inference Extension）、服务（KServe/Kthena/KAITO/KubeRay）、引擎（vLLM/SGLang/Triton）、GPU 调度（DRA/HAMi/Kueue/Volcano/KAI）" style="width:100%">
</div>

栈的成熟度是分层的：**引擎层已经商品化**（vLLM 93k★ 为生产默认，SGLang 37k★ 在多轮场景凭 RadixAttention 缓存命中率 75-95% 领先，Triton 走 NVIDIA 专属路线，TGI 2025-12 进入维护模式）；**战场已经上移到路由与调度层**——这正是演讲把 llm-d 放在核心位置的原因。

栈的典型起点是 KServe + vLLM，一个声明式对象即可拉起模型服务：

```yaml
# KServe InferenceService（vLLM 运行时，示意）
apiVersion: serving.kserve.io/v1beta1
kind: InferenceService
metadata:
  name: llama3-8b
spec:
  predictor:
    model:
      modelFormat:
        name: vLLM
      storageUri: hf://meta-llama/Meta-Llama-3-8B-Instruct
```

```bash
# 引擎侧：带前缀缓存的 vLLM 服务实例（示意）
# 前缀缓存是 agent 多轮场景降低 TTFT 的关键开关
vllm serve meta-llama/Meta-Llama-3-8B-Instruct \
  --enable-prefix-caching
```

值得注意的三个动态：

- **llm-d 是 2026 年推理栈最活跃的新变量**：2026-03-24 加入 CNCF Sandbox，Red Hat、Google Cloud、IBM Research、CoreWeave、NVIDIA 联合创立（2025-05）。它同时做两件事：前缀缓存感知的请求路由（v0.9 加入预测延迟路由），与跨异构 GPU 的分布式推理（P/D 分离、KV cache 卸载）。原 Gateway API Inference Extension 的 EPP 路由组件已迁入 llm-d；OpenCost 1.121.0 与它集成实现每 token 成本计量；Tesla 实测 Llama-3.1-70B 输出吞吐提升 3 倍、TTFT 降一半。
- **Kthena 与 llm-d 在同一赛道撞位**：Kthena（Volcano 社区子项目，2026-01 官宣）同样做 KV-cache 感知路由 + Prefill/Decode 分离 + gang 调度，基准测试吞吐 +2.73x、TTFT -73.5%，背后是华为云、天翼云、DaoCloud、小红书。两条路线重叠度高，未来大概率合并或分化。
- **开源 AI 版图在分裂，CNCF 不是唯一引力场**：Envoy AI Gateway 于 2026-09-09 更名 Agent Router 并转入 Linux Foundation 的 Agentic AI Foundation（AAIF，2025-12-09 成立）；Ray 于 2026-01 加入 PyTorch Foundation；KServe（Incubating）与 kgateway（Sandbox）留在 CNCF。推理栈的网关层正在向 AAIF 迁移。

## 四、深度分析 ②：软件栈还缺什么——五大缺口

演讲最有价值的一页是缺口清单。现有原语解决「怎么跑」，agent 需要的是「怎么管」：

<div class="growth-chart">
  <img src="five-gaps.svg" alt="软件栈五大缺口：动作树感知调度、按任务价值计费、工作负载身份委托、结果与来源追踪、访问与归因报酬，并标注各缺口当前填补者与真空区" style="width:100%">
</div>

<div class="table-wrap">
<table>
  <thead><tr><th>缺口</th><th>需要的原语</th><th>现状（2026.10）</th><th>填补程度</th></tr></thead>
  <tbody>
    <tr><td><strong>① 调度 → action-tree 感知</strong></td><td>任务树级调度、端到端预算</td><td>llm-d/Kthena 做到单请求粒度路由；Volcano/Kueue/KAI 仍是 pod/队列粒度</td><td>基本无人填</td></tr>
    <tr><td><strong>② 计量 → value-aware 预算</strong></td><td>按 agent 任务计费、成本复利前止损</td><td>OpenCost + llm-d 每 token 成本（2026-07）</td><td>任务粒度空缺</td></tr>
    <tr><td><strong>③ 身份 → 委托授权</strong></td><td>谁的 agent、能做什么、授权何时过期</td><td>SPIFFE/SPIRE 成熟；CSA Agentic Identity 指引（2026-09）、Agntcy、IETF 草案</td><td>有底座，agent 场景早期</td></tr>
    <tr><td><strong>④ 追踪 → 结果与来源</strong></td><td>做了什么、用哪些来源、是否生效</td><td>OTel GenAI 语义约定（agent spans 仍未 stable）、Langfuse/LangSmith 等</td><td>追踪可用，outcome/provenance 基本无人做</td></tr>
    <tr><td><strong>⑤ 访问 → 归因与报酬</strong></td><td>可信来源以可执行条款接纳 agent 并获归因</td><td>AP2 协议（Google 发起）、AAIF、A2A</td><td>协议层早期，基本无人填</td></tr>
  </tbody>
</table>
</div>

两个案例解释了为什么这些缺口不是学术问题：

<div class="callout callout-rose">
  <div class="callout-label">无治理的 agent speed：两个反例</div>
  <p><strong>① Wikimedia</strong>：爬虫只占 35% 的页面浏览量，却产生 65% 的昂贵核心流量——bot 绕过缓存直击冷门页面，账单落在非营利组织的头上。机器流量的成本结构完全不同于人类流量，而平台没有按「请求者身份」计价的机制。</p>
  <p><strong>② Klarna</strong>：2024 年 AI 助手首月处理了 2/3 的客服对话（230 万次，约等于 700 名全职员工），解决时长 11→2 分钟；2025 年 CEO 公开承认「过度以成本为评估因素导致质量下降」，公司恢复招聘人工客服。速度赢得了指标，输掉了结果——因为没有「outcome」维度的度量与治理。</p>
</div>

<div class="verdict">
  <p class="verdict-title">缺口的本质</p>
  <p>五个缺口合起来是 agentic 时代的<strong>「网络层」原语</strong>：连接 pod 与动作树、身份与授权、成本与任务、行为与归因。Cloudflare 对 agentic internet 的定义是 readable / discoverable / callable / payable（可读、可发现、可调用、可支付）——CNCF 的清单是这四种属性的基础设施翻译：①③ 解决 callable 的治理，② 解决 payable 的计量，④⑤ 解决 readable 的溯源与信任。谁先填上这些格子，谁就定义了 agent 经济的基础协议。</p>
</div>

## 五、生态全景与竞品对比

<div class="table-wrap">
<table>
  <thead><tr><th>维度</th><th>CNCF 开源栈</th><th>NVIDIA 全栈</th><th>云厂商托管</th><th>推理服务商</th><th>Agent 平台商</th></tr></thead>
  <tbody>
    <tr><td><strong>推理层</strong></td><td>vLLM/SGLang + llm-d/Kthena/Agent Router，多硬件可移植</td><td>Dynamo + TensorRT-LLM，性能天花板但锁硬件</td><td>Bedrock/Vertex/Foundry 托管 API</td><td>自研引擎卖延迟与吞吐（Fireworks/Baseten/Together）</td><td>Codex/Claude 沙箱运行时，全封装</td></tr>
    <tr><td><strong>调度层</strong></td><td>Kueue/Volcano/DRA/HAMi 可审计，缺 action-tree 粒度</td><td>AI Enterprise 闭环，不跨云</td><td>云内闭环，跨云靠多集群</td><td>黑盒</td><td>用户不感知</td></tr>
    <tr><td><strong>身份层</strong></td><td>SPIFFE 有底座，agent 委托是明确缺口</td><td>依赖与 Red Hat 的 AI Factory 合作补齐</td><td>各云成熟但不可互操作</td><td>API key 级</td><td>自研会话授权，不开放</td></tr>
    <tr><td><strong>计费层</strong></td><td>OpenCost/Kubecost 可分摊 GPU，缺按任务计费</td><td>许可 + GPU 订阅</td><td>token/吞吐单元计量最成熟</td><td>按 token/分钟</td><td>订阅制，无步骤归因</td></tr>
    <tr><td><strong>锁定程度</strong></td><td>低（Apache 2.0，可迁移）</td><td>高（GPU + 软件双锁）</td><td>高（平台 API 锁）</td><td>中</td><td>极高</td></tr>
  </tbody>
</table>
</div>

欧洲主权算力是需求侧的最大变量：EuroHPC JU 2026-07-30 启动 AI Gigafactories 招标——最多 7 座、总投资约 €30B（€10B 公共 + ≥€20B 私人），此前已选定 19 座 AI Factory，10 个国家竞标主办（2027 年初选定、签约后 18 个月内投运）。EU AI Act 的透明度义务 2026-08-02 已生效、高风险义务 2027-12-02 适用——provenance、attribution 与 policy 正在从「最佳实践」变成合规要求。演讲的结语落在这里：**如果 AI 基础设施走向封闭与集中，少数平台将控制互联网的智能层；开源必须赢下「开放 agentic internet」。**

## 六、战略分析

<div class="verdict">
  <p class="verdict-title">战略意图（推断）</p>
  <p>AT&T 类比是一次<strong>「历史必然性」的借用</strong>：数据时代重塑了网络 → agentic 时代必然重塑 AI 基础设施。但类比里做了一处置换——当年讲这个故事的人如今代表 Kubernetes 阵营，把「AT&T 当年选 OpenStack」置换为「今天的 82%/66% 选 K8s」。更深一层的论证是：<strong>训练层的战争已经结束（资本与芯片已由闭源实验室锁定），推理/服务层的战争刚开始——而这一层必须、也只能赢在开源</strong>，因为 agent 经济要可互操作、可审计、可支付，这三个属性是标准与开源社区的属性，不是任何单一云厂商的属性。</p>
</div>

三条支撑证据：

- **缺口清单 = 项目漏斗**：CNCF 的惯用打法不是自己造项目，而是把「缺什么」公开，让 sandbox 申请者来填空。五个缺口中 ①⑤ 是完全真空区——按 WASM 时代「先原语、后平台」的路径，未来 12-18 个月每一个空格都对应一个 sandbox 申请与一批创业公司。
- **认证体系是护城河**：KARs（Kubernetes AI Conformance）18→31 平台，加入 agentic 工作负载验证——把「AI OS」的兼容性认证做成当年 OCI/K8s Conformance 式的开源标准资产。
- **身份与归因是结盟点**：缺口的解法天然指向 SPIFFE（CNCF Graduated）、CSA Agentic Identity（2026-09）、AAIF（MCP 生态）——CNCF 与这些组织的结盟，比单个项目更能决定「open agentic internet」的形态。

## 七、风险与局限

<div class="callout callout-rose">
  <div class="callout-label">四类风险（截至 2026.10.08）</div>
  <p><strong>① 缺口只是清单，不是项目</strong>：五大缺口今天仍是 PPT 上的格子，①⑤ 两个真空区没有成熟开源实现；清单的权威性取决于 CNCF 能否把话语权转化为项目引力。</p>
  <p><strong>② 栈组件是「演讲级集成」</strong>：网关、路由、服务、引擎、调度五层靠拼装而非统一产品，企业体验落后 NVIDIA/云厂商 1-2 年；llm-d 与 Kthena 的重叠意味着资源分散。</p>
  <p><strong>③ 引力场在分裂</strong>：Ray 去了 PyTorch Foundation，Agent Router 去了 AAIF——「AI 开源基础设施」的治理权并非 CNCF 独有；MCP 授权规范多版本迭代，若标准推进缓慢，可能重演「标准赢、商业输」。</p>
  <p><strong>④ 数据口径</strong>：演讲标注的 Anthropic 报告日期（2026-06）与公开可查版本（2025-12/2026-01）有出入，21.2/9.8 两个数字在公开报告间一致，但「20 万会话」「人类回合 -33%」未能在公开报告中独立核实；「44% 未跑 AI/ML」亦未在官方博客证实。正文已按可核实口径处理。</p>
</div>

## 八、结语：趋势判断

三个趋势判断（以下为推断，置信度已标注）：

1. **扩展单位的迁移是真实的，且会重塑采购与运维指标**（置信度高）。从「用户数」到「每用户动作数」，意味着容量规划、限流、计费、可观测性指标全部要跟着改——这不是 CNCF 的营销：Anthropic 的 21.2 个连续动作与 Wikimedia 的 65/35 流量结构，分别是动作侧与成本侧的证据。基础设施厂商的下一轮竞争点是谁先原生支持「动作」这个粒度。
2. **五大缺口是未来 12-18 个月 CNCF 生态的项目路线图**（置信度中高）。①② 的先行者（llm-d/OpenCost）已经出现，③④ 有标准底座（SPIFFE/OTel），⑤ 的「归因与报酬」最晚启动但天花板最高——它对应的是 agent 经济的结算层。跟踪信号：每个缺口的第一个 sandbox 申请。
3. **「agentic internet」的网络层是开源与闭源的下一场战争**（置信度中高）。推理引擎的战争已结束（开源胜），身份、归因、支付的战争刚开始。如果 MCP + 开放身份 + AP2 式的支付原语在 2027 年前收敛为标准，CNCF 栈将获得「agent 基础设施」的定义权；如果被云厂商的托管 agent 平台先锁定，开源将退守自建市场。

值得跟踪的信号：KARs 认证平台数量增速、llm-d 与 Kthena 的合并/分化、五大缺口的 sandbox 申请、AAIF 与 CNCF 的项目归属边界、以及 EU Gigafactories 首批选型（2027 初）中的开源栈占比。

---

**演讲材料**：《A New Workload Remakes the Network》（slides 封面标题）/《Kubernetes is the AI OS: Open Source Building Blocks for Agent Speed》（官方议程题目），Jonathan Bryce（Linux Foundation Cloud & Infrastructure 执行董事）与 Daniel Krook，Open Source Summit Europe 2026-10-07。本文数据经官方来源逐项核实，口径差异已在正文标注。

<div class="callout callout-amber">
  <div class="callout-label">备注</div>
  <p>本文基于截至 2026 年 10 月 8 日的现场材料、官方议程与公开数据撰写；演讲 slides 未公开，部分数据以现场照片 OCR 为准并已在正文标注口径。项目 stars 与状态为 2026-10-08 快照，CNCF 生态迭代较快，请以最新状态为准。</p>
</div>
