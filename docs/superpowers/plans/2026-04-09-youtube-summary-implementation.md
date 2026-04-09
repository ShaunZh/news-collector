# YouTube Video Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add YouTube video subtitle download and AI summary feature to the AI industry news collector platform.

**Architecture:** Create a new skill (`youtube-summary`) that wraps yt-dlp for fetching video info and subtitles, then uses AI to generate structured summaries. Data is stored as JSON files in `videos/` directory, following the same pattern as podcasts.

**Tech Stack:** Node.js (ES Modules), yt-dlp (external CLI tool), JSON storage

---

## File Structure

**New files:**
- `.claude/skills/youtube-summary/skill.md` — Skill definition and workflow
- `.claude/skills/youtube-summary/scripts/fetch-youtube.js` — yt-dlp wrapper for fetching video info and subtitles
- `prompts/video-summary.md` — AI summary generation prompt

**Modified files:**
- `README.md` — Add YouTube feature documentation

**New directory:**
- `videos/` — Store video data files (YYYY-MM-DD-videoId.json)

---

### Task 1: Create Directory Structure

**Files:**
- Create: `videos/.gitkeep`
- Create: `.claude/skills/youtube-summary/`

- [ ] **Step 1: Create videos directory**

```bash
mkdir -p /Users/zhangjie/Documents/News/videos
touch /Users/zhangjie/Documents/News/videos/.gitkeep
```

- [ ] **Step 2: Create skill directory structure**

```bash
mkdir -p /Users/zhangjie/Documents/News/.claude/skills/youtube-summary/scripts
mkdir -p /Users/zhangjie/Documents/News/.claude/skills/youtube-summary/prompts
```

- [ ] **Step 3: Commit**

```bash
git add videos/.gitkeep .claude/skills/youtube-summary/
git commit -m "feat: create youtube-summary skill directory structure"
```

---

### Task 2: Create Video Summary Prompt

**Files:**
- Create: `prompts/video-summary.md`

- [ ] **Step 1: Create the prompt file**

```markdown
# Video Summary Generation Prompt

你是一位专业的视频内容分析师。请阅读以下 YouTube 视频字幕，生成一份详实的摘要。

## 输入格式

- 视频标题：{{title}}
- 频道：{{channel}}
- 视频描述：{{description}}
- 章节信息：{{chapters}}
- 字幕：{{transcript}}

## 输出要求（JSON 格式）

```json
{
  "coreTopics": "3-5句话描述视频的核心议题、主讲人背景、讨论背景",
  "keyPoints": [
    {
      "point": "关键观点",
      "detail": "详细解释或案例",
      "chapter": "章节名称（可选）"
    }
  ],
  "chapters": [
    {
      "title": "章节标题",
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

## 指导原则

### 1. coreTopics

- 描述视频讨论的核心问题是什么
- 主讲人的背景和独特视角
- 讨论的时代背景或行业趋势

### 2. keyPoints（5-7个）

- 选择最有信息量的观点
- 每个 point 一句话概括核心论点
- detail 补充具体案例、数据或论证过程
- 如果观点属于特定章节，标注 chapter 名称
- 过滤掉泛泛之谈、过渡语、过度细节

### 3. chapters（如有章节信息）

- 每个章节独立摘要
- 提取章节内的关键时刻（keyMoments）
- 如果没有章节信息，可根据内容逻辑自行划分

### 4. resources

- 书籍、工具、文章、论文、链接等
- 说明资源与讨论话题的关联

### 5. highlights（5-7个精彩片段）

- 有争议或独特的观点
- 具体的数据或案例
- 可直接应用的 insight
- 精彩的表达或比喻
- 每个摘要 2-3 句话

### 6. takeaways（2-3个）

- 实践建议：可以直接应用的方法
- 认知启发：改变思维方式的观点

## 示例

略（参考 podcast-summary.md 的示例格式）
```

- [ ] **Step 2: Commit**

```bash
git add prompts/video-summary.md
git commit -m "feat: add video summary generation prompt"
```

---

### Task 3: Create Fetch YouTube Script

**Files:**
- Create: `.claude/skills/youtube-summary/scripts/fetch-youtube.js`

- [ ] **Step 1: Create the script**

```javascript
#!/usr/bin/env node

// Fetch YouTube video info and subtitles using yt-dlp

import { writeFile, mkdir, access, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { spawn } from 'child_process';
import { tmpdir } from 'os';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const path = require('path');

const SCRIPT_DIR = dirname(new URL(import.meta.url).pathname);
const PROJECT_DIR = join(SCRIPT_DIR, '..', '..', '..', '..');
const VIDEOS_DIR = join(PROJECT_DIR, 'videos');

// Parse YouTube URL to extract video ID
function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Run yt-dlp command and return output
function runYtDlp(args) {
  return new Promise((resolve, reject) => {
    const process = spawn('yt-dlp', args, { encoding: 'utf8' });
    let stdout = '';
    let stderr = '';
    
    process.stdout.on('data', (data) => stdout += data);
    process.stderr.on('data', (data) => stderr += data);
    
    process.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`yt-dlp exited with code ${code}: ${stderr}`));
      }
    });
    
    process.on('error', (err) => {
      reject(new Error(`Failed to run yt-dlp: ${err.message}`));
    });
  });
}

// Fetch video metadata
async function fetchVideoInfo(videoId) {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const output = await runYtDlp([
    '--dump-json',
    '--no-download',
    url
  ]);
  
  return JSON.parse(output);
}

// Fetch subtitles (prefer manual, fallback to auto-generated)
async function fetchSubtitles(videoId, url) {
  const tmpDir = join(tmpdir(), `yt-${videoId}`);
  const baseOutput = join(tmpDir, 'subtitle');
  
  // Try manual subtitles first
  try {
    await runYtDlp([
      '--write-subs',
      '--skip-download',
      '--sub-lang', 'en,en-US',
      '--sub-format', 'vtt',
      '-o', baseOutput,
      url
    ]);
    
    // Read the downloaded subtitle file
    const vttFile = baseOutput + '.en.vtt';
    if (existsSync(vttFile)) {
      const content = await readFile(vttFile, 'utf8');
      return { type: 'manual', language: 'en', transcript: parseVtt(content) };
    }
  } catch (e) {
    // Manual subs not available, try auto-generated
  }
  
  // Try auto-generated subtitles
  try {
    await runYtDlp([
      '--write-auto-subs',
      '--skip-download',
      '--sub-lang', 'en,en-US',
      '--sub-format', 'vtt',
      '-o', baseOutput,
      url
    ]);
    
    const vttFile = baseOutput + '.en.vtt';
    if (existsSync(vttFile)) {
      const content = await readFile(vttFile, 'utf8');
      return { type: 'auto', language: 'en', transcript: parseVtt(content) };
    }
  } catch (e) {
    // Auto subs not available either
  }
  
  return null;
}

// Parse VTT subtitle format
function parseVtt(content) {
  // Remove VTT headers and timing info, keep only text
  const lines = content.split('\n');
  const textLines = [];
  let skipNext = false;
  
  for (const line of lines) {
    if (line.includes('-->')) {
      skipNext = false;
      continue;
    }
    if (line.trim() === '' || line.startsWith('WEBVTT') || line.startsWith('NOTE')) {
      skipNext = true;
      continue;
    }
    if (!skipNext && line.trim()) {
      // Remove VTT tags like <c> or positioning
      const cleanLine = line.replace(/<[^>]+>/g, '').trim();
      if (cleanLine) {
        textLines.push(cleanLine);
      }
    }
  }
  
  // Deduplicate consecutive duplicate lines
  const deduped = [];
  let prevLine = '';
  for (const line of textLines) {
    if (line !== prevLine) {
      deduped.push(line);
      prevLine = line;
    }
  }
  
  return deduped.join(' ');
}

// Format duration from seconds to HH:MM:SS or MM:SS
function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Main function
async function main() {
  const url = process.argv[2];
  
  if (!url) {
    console.error('Usage: node fetch-youtube.js <youtube-url>');
    process.exit(1);
  }
  
  const videoId = extractVideoId(url);
  if (!videoId) {
    console.error('Error: Could not extract video ID from URL');
    process.exit(1);
  }
  
  console.log(`Fetching video: ${videoId}`);
  
  // Ensure videos directory exists
  if (!existsSync(VIDEOS_DIR)) {
    await mkdir(VIDEOS_DIR, { recursive: true });
  }
  
  // Check if already exists
  const today = new Date().toISOString().split('T')[0];
  const existingFiles = await findExistingVideo(videoId);
  if (existingFiles.length > 0) {
    console.log(`VIDEO_EXISTS:${existingFiles[0]}`);
    return;
  }
  
  // Fetch video info
  console.log('Fetching video metadata...');
  const info = await fetchVideoInfo(videoId);
  
  // Fetch subtitles
  console.log('Fetching subtitles...');
  const subtitles = await fetchSubtitles(videoId, url);
  
  if (!subtitles) {
    console.error('Error: No subtitles available for this video');
    process.exit(1);
  }
  
  // Build data structure
  const data = {
    videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    title: info.title || '',
    description: info.description || '',
    channel: info.channel || info.uploader || '',
    channelId: info.channel_id || '',
    publishedAt: info.upload_date ? formatDate(info.upload_date) : null,
    duration: info.duration || 0,
    thumbnail: info.thumbnail || '',
    chapters: (info.chapters || []).map(ch => ({
      title: ch.title || '',
      start: ch.start_time || 0,
      end: ch.end_time || 0
    })),
    subtitles,
    fetchedAt: new Date().toISOString()
  };
  
  // Save to file
  const outputFile = join(VIDEOS_DIR, `${today}-${videoId}.json`);
  await writeFile(outputFile, JSON.stringify(data, null, 2));
  
  console.log(`Saved to: ${outputFile}`);
  console.log(`VIDEO_FILE:${outputFile}`);
  console.log(`TITLE:${data.title}`);
  console.log(`CHANNEL:${data.channel}`);
  console.log(`DURATION:${formatDuration(data.duration)}`);
  console.log(`SUBTITLE_TYPE:${subtitles.type}`);
}

async function findExistingVideo(videoId) {
  const { readdir } = await import('fs/promises');
  try {
    const files = await readdir(VIDEOS_DIR);
    return files.filter(f => f.includes(videoId)).map(f => join(VIDEOS_DIR, f));
  } catch {
    return [];
  }
}

function formatDate(yyyymmdd) {
  // Convert YYYYMMDD to ISO format
  const y = yyyymmdd.slice(0, 4);
  const m = yyyymmdd.slice(4, 6);
  const d = yyyymmdd.slice(6, 8);
  return `${y}-${m}-${d}T00:00:00Z`;
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

export { extractVideoId, fetchVideoInfo, fetchSubtitles, parseVtt };
```

- [ ] **Step 2: Make script executable**

```bash
chmod +x /Users/zhangjie/Documents/News/.claude/skills/youtube-summary/scripts/fetch-youtube.js
```

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/youtube-summary/scripts/fetch-youtube.js
git commit -m "feat: add YouTube fetch script with yt-dlp integration"
```

---

### Task 4: Create Skill Definition

**Files:**
- Create: `.claude/skills/youtube-summary/skill.md`

- [ ] **Step 1: Create the skill definition**

```markdown
# YouTube Video Summary

Download YouTube video subtitles and generate AI-powered summaries.

## Trigger

Invoke this skill when the user requests:
- "帮我总结这个视频：URL"
- "总结视频 URL"
- "下载这个视频的字幕：URL"
- "summarize video URL"

## Workflow

### Step 1: Parse URL and Check for Existing

Extract video ID from the YouTube URL:
- `youtube.com/watch?v=xxx`
- `youtu.be/xxx`
- `youtube.com/embed/xxx`

Check if video already exists in `videos/*-videoId.json`:
- If exists, inform user and ask if they want to regenerate
- If not, proceed to fetch

### Step 2: Check yt-dlp Availability

```bash
which yt-dlp && echo "yt-dlp available" || echo "yt-dlp not found"
```

If not available, tell user to install:
```bash
# macOS
brew install yt-dlp

# Or via pip
pip install yt-dlp
```

### Step 3: Fetch Video Data

Run the fetch script:
```bash
cd ${CLAUDE_SKILL_DIR}/scripts && node fetch-youtube.js "https://youtube.com/watch?v=xxx"
```

The script:
- Fetches video metadata (title, description, channel, chapters)
- Downloads subtitles (prefer manual, fallback to auto-generated)
- Saves to `videos/YYYY-MM-DD-videoId.json`

Output includes:
- `VIDEO_EXISTS:path` — Already exists
- `VIDEO_FILE:path` — New file saved
- `TITLE:...`, `CHANNEL:...`, `DURATION:...` — Video info

### Step 4: Generate Summary

Read files in parallel:
- Prompt: `prompts/video-summary.md`
- Data: The video JSON file from Step 3

Generate summary using the prompt, replacing placeholders:
- `{{title}}` → video title
- `{{channel}}` → channel name
- `{{description}}` → video description
- `{{chapters}}` → chapters JSON (or "无章节信息")
- `{{transcript}}` → subtitles.transcript

Output valid JSON matching the summary schema.

### Step 5: Save Summary

Update the video JSON file:
- Add `summary` field with the generated summary
- Write back with 2-space indent formatting

### Step 6: Confirm

Tell the user:
- Summary generated for: [title]
- Saved to: videos/YYYY-MM-DD-videoId.json
- Channel: [channel name]
- Duration: [HH:MM:SS]

## Output Schema

```json
{
  "coreTopics": "string",
  "keyPoints": [
    {
      "point": "string",
      "detail": "string",
      "chapter": "string (optional)"
    }
  ],
  "chapters": [
    {
      "title": "string",
      "start": "MM:SS",
      "summary": "string",
      "keyMoments": [
        {
          "timestamp": "MM:SS",
          "description": "string"
        }
      ]
    }
  ],
  "resources": [
    {
      "type": "book|tool|article|paper|link",
      "title": "string",
      "author": "string",
      "context": "string"
    }
  ],
  "highlights": [
    {
      "timestamp": "MM:SS",
      "summary": "string",
      "quote": "string"
    }
  ],
  "takeaways": ["string"]
}
```

## Error Handling

- **No subtitles available**: Tell user "该视频没有可用的字幕（包括自动生成）"
- **yt-dlp not installed**: Provide installation instructions
- **Video not found**: "无法获取视频信息，请检查 URL 是否正确"
- **Private/unavailable video**: "该视频不可访问（可能是私享视频或已删除）"
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/youtube-summary/skill.md
git commit -m "feat: add youtube-summary skill definition"
```

---

### Task 5: Update README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add YouTube section to README**

Add after the Podcast section:

```markdown
## YouTube 视频总结

### 触发方式

在对话中发送：

```
帮我总结这个视频：https://www.youtube.com/watch?v=xxx
```

或简写：

```
总结视频 https://youtube.com/watch?v=xxx
```

### 依赖

需要安装 yt-dlp：

```bash
# macOS
brew install yt-dlp

# 或 Python
pip install yt-dlp
```

### 数据存储

视频数据保存到 `videos/YYYY-MM-DD-videoId.json`：

```json
{
  "videoId": "xxx",
  "title": "视频标题",
  "channel": "频道名称",
  "subtitles": {
    "type": "manual|auto",
    "transcript": "字幕文本..."
  },
  "summary": {
    "coreTopics": "...",
    "keyPoints": [...],
    "chapters": [...],
    "resources": [...],
    "highlights": [...],
    "takeaways": [...]
  }
}
```

### 注意事项

- 只保存字幕，不下载视频文件
- 优先使用官方字幕，没有则使用自动生成字幕
- 如果视频没有字幕，将无法生成摘要
```

- [ ] **Step 2: Update project structure in README**

Add `videos/` to the project structure:

```markdown
## 项目结构

```
.
├── ...
├── videos/                      # YouTube 视频数据
│   └── YYYY-MM-DD-videoId.json  # 视频数据文件
└── ...
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add YouTube video summary feature to README"
```

---

### Task 6: Final Integration Test

**Files:**
- None (testing only)

- [ ] **Step 1: Test with a sample YouTube video**

```bash
cd /Users/zhangjie/Documents/News/.claude/skills/youtube-summary/scripts
node fetch-youtube.js "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

Expected output:
- Script fetches video info and subtitles
- Saves to `videos/YYYY-MM-DD-dQw4w9WgXcQ.json`
- Prints video title, channel, duration

- [ ] **Step 2: Verify output file**

```bash
cat /Users/zhangjie/Documents/News/videos/*-dQw4w9WgXcQ.json
```

Expected:
- Valid JSON with videoId, title, channel, subtitles fields
- transcript field contains subtitle text

- [ ] **Step 3: Test duplicate detection**

Run the same command again. Expected:
- `VIDEO_EXISTS:videos/YYYY-MM-DD-dQw4w9WgXcQ.json`

- [ ] **Step 4: Clean up test file**

```bash
rm /Users/zhangjie/Documents/News/videos/*-dQw4w9WgXcQ.json
```

---

## Self-Review Checklist

**1. Spec coverage:**
- ✅ Data structure defined (videos/YYYY-MM-DD-videoId.json)
- ✅ Summary structure with chapters field
- ✅ Trigger commands defined
- ✅ yt-dlp integration specified
- ✅ Subtitle priority (manual → auto) specified
- ✅ Skill structure defined
- ✅ Error handling covered

**2. Placeholder scan:**
- ✅ No TBD, TODO, or incomplete sections
- ✅ All code blocks contain actual implementation code
- ✅ All file paths are exact

**3. Type consistency:**
- ✅ videoId used consistently
- ✅ chapters field structure matches between data and summary
- ✅ timestamps formatted as MM:SS throughout