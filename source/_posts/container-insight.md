---
title: Does Size Matters? From Alpine to Distroless, thoughts on OS distribution.
date: 2024-10-19 20:44:38
tags: [容器, Docker, Alpine, 操作系统, 云原生, 软件分发]
categories: 云原生
description: 从容器化技术到操作系统发行版，深入探讨 Alpine Linux 与 Distroless 在容器镜像中的应用与选择。
---

“首因效应“，是指人对人或事物的第一次印象对今后续认知的影响，虽然这些第一印象并非总是正确的，但却是最鲜明、最牢固的，并且决定着对于其认知的进程。软件分发(Software Distribution)是软件开发的最后一个环节，也是终端用户(End Users)使用软件的第一个环节，对于用户体验有关键影响，很大程度决定着用户对于软件的长期认知。易用性、易获得性以及内容和服务是否与用户所期望的一致，极大的影响着用户对于软件的整体印象。

“易用性、易获得性以及内容和服务是否与用户所期望的一致”，这三条需求其实需要由两个角色共同承担：1）产品经理，能够准确的理解用户需求，并把用户需求转化为技术需求，确保最终开发出来的内容和服务符合用户期望；2）开发人员，准确开发实现需求，完整验证，通过技术手段确保易用性与已获得性。

先从技术视角来看一看目前数据中心用户是如何使用软件的。

# 容器化与容器分发

### 是什么？

容器化技术是一种将应用程序及其依赖项打包到独立、可移植的容器(Containers)中的技术。‌这些容器可以在任何基础设施上稳定运行(实际上依赖于底层OS的硬件架构支持能力)，具有较高的可移植性和资源效率。‌容器化利用‌Linux的‌`Namespaces`和‌`Cgroups`技术对应用程序进程进行隔离和资源限制。`Namespaces`提供隔离的环境，使得应用进程只能访问其容器内的资源，而`Cgroups`则限制分配给进程的资源。因此，容器实际上是在宿主机上运行的特殊进程，多个容器共享同一个操作系统内核。

### 有什么价值？

一款软件从开发到测试再到发布和使用，会经手的各种开发人员众多，各个开发人员之间的环境配置不一致会大大降低开发效率和软件质量，开发和测试之间的”在我这跑的好好的，到你那怎么就跑不了“的问题时常发生。容器化将应用程序代码与应用程序运行时所需的相关配置文件、库和依赖项捆绑在一起，因此较好的消除了这一问题。而对于软件用户，尤其是开源软件用户来说，最期望的软件分发方式就是”开箱即用“，本质上与前面介绍的开发与测试之间的故事类似，因此容器化软件和服务分发，已经成为主流。根据[Forrester](https://www.forrester.com/press-newsroom/the-state-of-cloud-in-north-america-2022/)的一份调研报告，2022年已经有超过74%的美国企业将其业务部署在容器中了。尤其是CI/CD服务，绝大多数能够容器化的已经都进行了容器化改造，极大的提高了开发效率。

### 怎么分发？

容器化和进程隔离的概念尽管已经诞生了几十年，但直到2013年开源Docker的出现(掐指一算，也已经超过10年了)，才加速了这项技术的采用。作为容器技术的极大推动者，Dokcer官方的容器镜像仓库(Registry)`Dockerhub`自然也成了容器镜像官方仓库的事实标准。
![Dockerhub Statistics](docker-statistic.png)
Dockerhub目前承载了超过1400万个容器镜像，月度容器下载量达110亿次，数据相当可怕。尽管还有许多类似的容器镜像分发渠道，如RedHat Quay、Google GCR等，但DockerHub仍是最主流的那一个。

### 有哪些类型？

DockerHub根据镜像质量及镜像发布者情况将DockerHub上的镜像分为四个级别，三个可信(Trusted Contents)内容级别以及一个普通内容级别：
![Dockerhub Image Types](image-types.png)
 - Docker Official Images: 由Docker官方维护的高质量容器镜像，大多是云原生业务所需的最常用镜像(OS基础镜像、中间件、微服务网关、KV数据库等)，并提供可靠的CVE维护。当前总数171个。
 - Docker Verified Publisher: 背后有DockerHub认证的商业公司支持的高质量容器镜像(应用软件本身可以是开源或免费的)，此类镜像约9000个。
 - Docker-Sponsored Open Source: DockerHub认可并提供支持的开源项目，这些项目镜像由对应的开源社区或项目提供维护和支持，相较于普通镜像，DockerHub为这些开源社区和项目提供容器镜像的存储和下载流量支持。
 - 普通镜像：普通的由个人或组织创建的镜像，不享有任何特殊的支持，所能使用的DockerHub存储空间和下载带宽都非常受限。

 ### 哪些镜像用户量最大？

 DockerHub上用户量(下载量)最大的镜像来自于`Docker Official Images`，或者说只要用量足够大，Docker就会把它收编到`Official Images`以便保证质量和用户体验。目前前十名的镜像包括：Nginx、Memcached、Busybox、Alpine、Ubuntu、Redis、Postgres、Python、Node.js、http，这些镜像的前五名的周下载量都在1000万以上，后几名也有百万的周下载量。不难看出，都是最为常见的中间件和开发者工具。其中有两个操作系统基础镜像，显得尤为瞩目，`Alpine`和`Ubuntu`，其他一些知名的操作系统如`Debian`和`CentOS`排名仅在20左右，周下载量也仅有50万左右。`Ubuntu`自不必说，在开发者中的声望一直很高，那么另一个操作系统镜像`Alpine`又有什么独到之处，能够和`Ubuntu`分庭抗礼？

P.S. `Docker Official Images`所提供的应用容器镜像所使用的基础系统镜像(Base Image)实际只有两种:1）`Alpine Linux` 2）`Bookworm(Debian 12)`，足以见得`Alpine` 镜像在DockerHub的重要性。

# Alpine Linux

Alpine Linux 凭借其极小的体积（基础镜像约 5MB）和注重安全的设计理念（使用 musl libc 和 BusyBox），已经成为容器生态中最受欢迎的基础镜像之一。相比于传统的 Ubuntu 或 Debian 镜像，Alpine 极大地减少了攻击面和镜像传输时间。然而，musl libc 与 glibc 的兼容性问题也时常给开发者带来困扰。选择 Alpine 还是 Distroless、还是传统的完整发行版镜像，核心取决于应用场景：安全敏感且依赖简单的服务适合 Alpine/Distroless；依赖复杂、兼容性要求高的应用则更适合标准发行版镜像。在实际项目中，建议根据具体需求进行权衡，而非盲目追求「最小镜像」。

