# YouTube 视频内容下载与总结设计

> **目标：** 为 AI 行业信息资讯收集平台新增 YouTube 视频字幕下载和 AI 摘要功能

## 项目定位

**AI 行业信息资讯收集平台** — 每天快速了解 AI 领域发生了什么

| 内容类型 | 存储形式 | 查看方式 |
|----------|----------|----------|
| Twitter/X | 推文文本 (JSON) | 浏览器摘要 |
| Podcasts | Transcript (JSON) | 浏览器摘要 + 外链 |
| Blogs | 文章文本 (JSON) | 浏览器摘要 + 外链 |
| **YouTube** | **字幕文本 (JSON)** | **浏览器摘要 + 外链** |

**关键决策：** YouTube 只存字幕，不存视频文件。用户通过链接跳转到原始平台观看。

---

## 数据结构

### 存储位置

`videos/YYYY-MM-DD-videoId.json`

### 数据格式

```json
{
  "videoId": "dQw4w9WgXcQ",
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "title": "视频标题",
  "description": "视频描述",
  "channel": "频道名称",
  "channelId": "UCxxx",
  "publishedAt": "2026-04-09T10:00:00Z",
  "duration": 1234,
  "thumbnail": "https://...",
  "chapters": [
    {
      "title": "Introduction",
      "start": 0,
      "end": 120
    }
  ],
  "subtitles": {
    "type": "manual|auto",
    "language": "en",
    "transcript": "完整字幕文本..."
  },
  "summary": {
    "coreTopics": "...",
    "keyPoints": [...],
    "chapters": [...],
    "resources": [...],
    "highlights": [...],
    "takeaways": [...]
  },
  "fetchedAt": "2026-04-09T12:00:00Z"
}
```

---

## 摘要结构

相比 Podcast 摘要，新增 `chapters` 字段用于视频章节划分：

```json
{
  "coreTopics": "3-5句话描述视频核心议题、主讲人背景、讨论背景",
  "keyPoints": [
    {
      "point": "关键观点",
      "detail": "详细解释或案例",
      "chapter": "Introduction"
    }
  ],
  "chapters": [
    {
      "title": "Introduction",
      "start": "00:00",
      "summary": "该章节的主要内容概述",
      "keyMoments": [
        {
          "timestamp": "01:23",
          "description": "关键时刻描述"
        }
      ]
    }
  ],
  "resources": [
    {
      "type": "book|tool|article|paper|link",
      "title": "资源名称",
      "author": "作者",
      "context": "提及背景"
    }
  ],
  "highlights": [
    {
      "timestamp": "05:32",
      "summary": "精彩片段摘要（2-3句话）",
      "quote": "原话引用（不超过80字）"
    }
  ],
  "takeaways": [
    "核心收获或实践建议"
  ]
}
```

---

## 触发方式

### 命令格式

```
帮我总结这个视频：https://www.youtube.com/watch?v=xxx
```

或简写：

```
总结视频 https://youtube.com/watch?v=xxx
```

### 工作流程

```
1. 解析 URL，提取 videoId
       ↓
2. 检查是否已存在（videos/*-videoId.json）
       ↓ (不存在)
3. 调用 yt-dlp 获取：
   - 视频元信息（标题、描述、频道、时长、章节）
   - 字幕（优先官方，否则自动生成）
       ↓
4. 调用 AI 生成摘要（使用 prompt 文件）
       ↓
5. 保存到 videos/YYYY-MM-DD-videoId.json
       ↓
6. 告知用户完成
```

### 已存在处理

- 告知用户已有摘要
- 询问是否重新生成
- 或直接展示已有摘要

---

## yt-dlp 调用

### 获取视频信息

```bash
yt-dlp --dump-json --no-download "https://youtube.com/watch?v=xxx"
```

返回 JSON 包含：title, description, channel, duration, chapters, thumbnail 等

### 获取字幕

```bash
yt-dlp --write-subs --write-auto-subs --skip-download \
       --sub-lang "en,en-US" --sub-format "vtt" \
       -o "/tmp/video_id.%(ext)s" "https://youtube.com/watch?v=xxx"
```

### 字幕优先级

1. 尝试下载官方字幕（`--write-subs`）
2. 如果没有，下载自动生成字幕（`--write-auto-subs`）
3. 优先英语（en, en-US），其次其他语言

---

## Skill 结构

```
.claude/skills/youtube-summary/
├── skill.md                    # Skill 定义
├── scripts/
│   └── fetch-youtube.js        # yt-dlp 封装
└── prompts/
    └── video-summary.md        # 摘要生成提示词
```

---

## 依赖

**用户需安装 yt-dlp：**

```bash
# macOS
brew install yt-dlp

# 或 Python
pip install yt-dlp
```

---

## 不在范围内

- 视频文件下载和存储
- 视频播放功能
- YouTube 频道订阅/监控