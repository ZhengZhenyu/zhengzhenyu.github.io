# Kevin's Personal Blog

[![Hexo](https://img.shields.io/badge/Hexo-7.3.0-blue)](https://hexo.io/)
[![Theme](https://img.shields.io/badge/Theme-Cactus-green)](https://github.com/probberechts/hexo-theme-cactus)
[![Deploy](https://github.com/zhengzhenyu/zhengzhenyu.github.io/actions/workflows/pages.yml/badge.svg)](https://github.com/zhengzhenyu/zhengzhenyu.github.io/actions/workflows/pages.yml)

> A personal blog sharing insights on Cloud Native, Container Technology, AI Platforms, and Software Engineering.

🌐 **Live Site**: [https://zhengzhenyu.github.io/](https://zhengzhenyu.github.io/)

## 📖 About

This blog is powered by [Hexo](https://hexo.io/), a fast, simple and powerful blog framework. It uses the beautiful [Cactus](https://github.com/probberechts/hexo-theme-cactus) theme and is automatically deployed to GitHub Pages.

**Topics covered:**
- 🐳 Container Technology (Docker, Kubernetes)
- ☁️ Cloud Native Architecture
- 🤖 Enterprise AI Platforms
- 💻 Software Engineering Best Practices
- 🔧 DevOps & Development Tools

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (>= 18.x)
- [Git](https://git-scm.com/)

### Installation

1. Clone this repository:
```bash
git clone https://github.com/zhengzhenyu/zhengzhenyu.github.io.git
cd zhengzhenyu.github.io
```

2. Initialize git submodules (for the Cactus theme):
```bash
git submodule update --init --recursive
```

3. Install dependencies:
```bash
npm install
```

### Development

Start the local development server:
```bash
npm run server
```

The blog will be available at `http://localhost:4000/`

### Writing a New Post

Create a new post:
```bash
hexo new post "Your Post Title"
```

This will create a new markdown file in `source/_posts/` with the necessary front matter.

### Build

Generate static files:
```bash
npm run build
```

The generated files will be in the `public/` directory.

### Clean

Clean the cache and generated files:
```bash
npm run clean
```

## 📁 Project Structure

```
.
├── .github/
│   └── workflows/
│       └── pages.yml          # GitHub Pages deployment workflow
├── source/                     # Source files
│   ├── _posts/                # Blog posts
│   │   ├── container-insight/ # Post assets
│   │   ├── container-insight.md
│   │   └── opea-insight.md
│   └── about/                 # About page
├── themes/
│   └── cactus/                # Cactus theme (git submodule)
├── _config.yml                # Hexo configuration
├── _config.cactus.yml         # Cactus theme configuration
├── package.json               # Node.js dependencies
└── README.md                  # This file
```

## 🎨 Features

- ✅ **Modern Hexo 7.x**: Latest version with best performance
- ✅ **Cactus Theme**: Clean, minimalist design
- ✅ **SEO Optimized**: Sitemap, RSS feed, meta tags
- ✅ **GitHub Comments**: Utterances integration
- ✅ **Auto Deploy**: GitHub Actions workflow
- ✅ **Word Count**: Reading time estimation
- ✅ **Search**: Built-in search functionality
- ✅ **Responsive**: Mobile-friendly design

## 🔧 Plugins

This blog uses the following Hexo plugins:

- `hexo-generator-archive` - Archive page generation
- `hexo-generator-category` - Category page generation
- `hexo-generator-tag` - Tag page generation
- `hexo-generator-index` - Index page generation
- `hexo-generator-sitemap` - XML sitemap generation
- `hexo-generator-feed` - RSS/Atom feed generation
- `hexo-generator-search` - Search functionality
- `hexo-wordcount` - Word count and reading time
- `hexo-renderer-ejs` - EJS template rendering
- `hexo-renderer-marked` - Markdown rendering
- `hexo-renderer-stylus` - Stylus CSS rendering
- `hexo-asset-image` - Post asset image handling

## 📝 Writing Guide

### Front Matter

Each post should include front matter at the top:

```yaml
---
title: Your Post Title
date: 2024-01-01 10:00:00
tags:
  - tag1
  - tag2
categories:
  - category1
---
```

### Adding Images

Images can be placed in the post's asset folder (enabled by default):

1. Create a folder with the same name as your post in `source/_posts/`
2. Place images in that folder
3. Reference them in markdown: `![alt text](image-name.png)`

### Code Blocks

Use fenced code blocks with syntax highlighting:

\`\`\`javascript
console.log('Hello, World!');
\`\`\`

## 🚢 Deployment

This blog is automatically deployed to GitHub Pages using GitHub Actions. Every push to the `main` branch triggers a new deployment.

The deployment workflow:
1. Checks out the repository (including submodules)
2. Sets up Node.js environment
3. Installs dependencies
4. Builds the site with `hexo generate`
5. Deploys to GitHub Pages

## 📊 Analytics

To enable Google Analytics, edit `_config.cactus.yml`:

```yaml
google_analytics:
  enabled: true
  id: UA-XXXXXXXXX-X
```

## 💬 Comments

Comments are powered by [Utterances](https://utteranc.es/), which uses GitHub Issues. Make sure the repository is public and has the Utterances app installed.

## 📄 License

This blog content is licensed under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).

The Hexo framework is licensed under the MIT License.
The Cactus theme is licensed under the MIT License.

## 👤 Author

**Zheng Zhenyu**

- GitHub: [@zhengzhenyu](https://github.com/zhengzhenyu)
- Email: zhengzhenyu.here@gmail.com
- Blog: [https://zhengzhenyu.github.io/](https://zhengzhenyu.github.io/)

## 🙏 Acknowledgments

- [Hexo](https://hexo.io/) - The blog framework
- [Cactus Theme](https://github.com/probberechts/hexo-theme-cactus) - The beautiful theme
- [GitHub Pages](https://pages.github.com/) - Free hosting

---

⭐ If you find this blog helpful, please consider giving it a star!
