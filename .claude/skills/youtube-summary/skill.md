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