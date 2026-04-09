# AI Builders Digest Viewer

本地存储和查看 AI Builders Digest 数据的工具。

## 功能

- 每日自动获取 AI Builders 的推文、播客和博客内容
- 过滤低价值内容（纯转发、短文本、纯表情、礼貌性短语等）
- 浏览器查看历史数据
- 按 Builder 筛选
- 全文搜索
- 删除内容

## 快速开始

### 1. 获取数据

```bash
node .claude/skills/follow-builders-local/scripts/fetch-and-save.js
```

数据会保存到 `data/YYYY-MM-DD.json`。

### 2. 启动本地服务器

由于浏览器安全限制，不能直接打开 `index.html`，需要启动 HTTP 服务器：

```bash
python3 -m http.server 8888
```

### 3. 打开浏览器

访问 http://localhost:8888

## 项目结构

```
.
├── CLAUDE.md                    # 项目配置
├── README.md                    # 使用文档
├── index.html                   # 前端页面
├── app.js                       # 前端逻辑
├── data/                        # 数据目录
│   └── YYYY-MM-DD.json          # 每日数据文件
├── docs/
│   └── superpowers/
│       ├── specs/               # 设计文档
│       └── plans/               # 实现计划
└── .claude/
    └── skills/
        └── follow-builders-local/
            └── scripts/
                └── fetch-and-save.js  # 数据获取脚本
```

## 数据结构

每个数据文件包含：

```json
{
  "date": "2026-04-09",
  "fetchedAt": "2026-04-09T03:17:27.375Z",
  "tweets": [
    {
      "name": "Swyx",
      "handle": "swyx",
      "bio": "...",
      "tweets": [
        {
          "id": "2041739250421436591",
          "text": "...",
          "url": "https://x.com/swyx/status/...",
          "isSubstantive": true
        }
      ]
    }
  ],
  "podcasts": [...],
  "blogs": [...],
  "stats": {
    "tweetsTotal": 35,
    "tweetsFiltered": 35,
    "podcastsCount": 1,
    "blogsCount": 0
  }
}
```

## 内容过滤规则

### 爬取阶段过滤

以下内容会被标记为非实质性内容：

- 纯转发无评论（`RT @...` 且长度 < 50）
- 短文本无链接（长度 < 20 且无 http/https/t.co 链接）
- 纯表情符号（移除 emoji 后长度 < 5）
- 礼貌性短语（thanks, great, cool, nice 等）

### 前端显示

- 非实质性内容显示为半透明，并标注 "Filtered (low-value)"
- 用户仍可查看这些内容

## 常见问题

### Q: 为什么直接打开 index.html 没有数据？

A: 浏览器出于安全考虑，禁止 `file://` 协议加载本地 JSON 文件。必须使用 HTTP 服务器。

### Q: 如何删除数据？

A: 点击内容右侧的 × 按钮可以删除。删除操作保存在浏览器的 localStorage 中，刷新页面后生效。

### Q: 数据来源是什么？

A: 数据来自 GitHub: https://github.com/zarazhangrui/follow-builders

## 技术栈

- Node.js (ES Modules)
- HTML + Tailwind CSS (CDN)
- Vanilla JavaScript

## 设计文档

详细设计见: `docs/superpowers/specs/2026-04-09-local-digest-design.md`