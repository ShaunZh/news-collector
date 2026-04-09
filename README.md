# AI Builders Digest Viewer

本地存储和查看 AI Builders Digest 数据的工具。

## 功能

- 每日自动获取 AI Builders 的推文、播客和博客内容
- 过滤低价值内容（纯转发、短文本、纯表情、礼貌性短语等）
- 浏览器查看历史数据
- 按 Builder 筛选
- 全文搜索
- 删除内容
- **Podcast AI 摘要**：自动提取核心观点、资源引用、精彩片段

## 快速开始

### 1. 启动 HTTP 服务器

由于浏览器 CORS 限制，`file://` 协议无法加载本地 JSON 文件，必须使用 HTTP 服务器：

```bash
cd /Users/zhangjie/Documents/News
python3 -m http.server 8888
```

然后访问 http://localhost:8888

### 2. 获取数据

在对话中发送：

```
/ai
```

或：

```
/follow-builders
```

这会从中央 feed 获取最新数据并保存到 `data/YYYY-MM-DD.json`。

## 项目结构

```
.
├── CLAUDE.md                    # 项目配置
├── README.md                    # 使用文档
├── index.html                   # 前端页面
├── app.js                       # 前端逻辑
├── prompts/                     # AI 提示词
│   └── podcast-summary.md       # Podcast 摘要生成提示词
├── data/                        # 数据目录
│   └── YYYY-MM-DD.json          # 每日数据文件
├── docs/
│   └── superpowers/
│       ├── specs/               # 设计文档
│       └── plans/               # 实现计划
└── .claude/
    └── skills/
        └── follow-builders/     # 核心 skill
            ├── SKILL.md         # Skill 定义
            ├── scripts/
            │   ├── fetch-local.js    # 本地数据获取
            │   ├── prepare-digest.js # Digest 准备
            │   └── deliver.js        # 推送发送
            └── prompts/              # Digest 提示词
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
  "podcasts": [
    {
      "name": "Latent Space",
      "title": "...",
      "transcript": "...",
      "summary": {
        "coreTopics": "...",
        "keyPoints": [...],
        "resources": [...],
        "highlights": [...],
        "takeaways": [...]
      }
    }
  ],
  "stats": {
    "tweetsTotal": 35,
    "tweetsFiltered": 35,
    "podcastsCount": 1,
    "blogsCount": 0
  }
}
```

## Podcast 摘要生成

### 触发方式

在对话中发送：

```
帮我生成今天 podcast 的摘要
```

或指定日期：

```
帮我生成 2026-04-09 的 podcast 摘要
```

这会触发 `.claude/skills/follow-builders/SKILL.md` 中定义的工作流。

### Prompt 文件

摘要生成使用的提示词位于：`prompts/podcast-summary.md`

你可以修改这个文件来调整摘要的风格和内容。

### 摘要结构

生成的摘要包含以下字段：

| 字段 | 说明 |
|------|------|
| `coreTopics` | 核心议题、嘉宾背景、讨论背景（3-5句话） |
| `keyPoints` | 关键观点数组，每个观点包含论点和详细解释（5-7个） |
| `resources` | 提及的外部资源（书籍、工具、文章等） |
| `highlights` | 精彩片段，带时间戳和引用（5-7个） |
| `takeaways` | 核心收获和实践建议（2-3个） |

### 数据存储

摘要保存到 `data/YYYY-MM-DD.json` 的 `podcasts[].summary` 字段中。

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

A: 数据来自中央 feed：https://github.com/zarazhangrui/follow-builders

## 技术栈

- Node.js (ES Modules)
- HTML + Tailwind CSS (CDN)
- Vanilla JavaScript

## 设计文档

详细设计见: `docs/superpowers/specs/2026-04-09-local-digest-design.md`