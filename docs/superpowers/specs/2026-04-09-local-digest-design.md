# Local Digest Viewer — Design Document

Date: 2026-04-09
Status: Approved

## Overview

Build a local system to fetch and store AI Builders Digest data, with a simple browser-based frontend to view, search, filter, and delete the stored content.

## Goals

- Persist daily digest data locally for historical access
- Provide a browser-based UI to view and manage stored data
- Filter out low-value content during fetch and at frontend
- Single command (`/ai` or `/follow-builders`) triggers fetch → save → open browser

## Non-Goals

- No remote server or deployment
- No user authentication
- No complex analytics or trends

## Architecture

```
/Users/zhangjie/Documents/News/
├── data/
│   ├── 2026-04-09.json
│   ├── 2026-04-08.json
│   └── ...
├── index.html          # Frontend entry, open directly in browser
├── app.js              # Frontend logic
└── .claude/
    └── skills/
        └── follow-builders-local/
            └── scripts/
                └── fetch-and-save.js  # Fetch + filter + save script
```

## Data Structure

Each daily JSON file:

```json
{
  "date": "2026-04-09",
  "fetchedAt": "2026-04-09T03:17:27.375Z",
  "tweets": [
    {
      "id": "2041739250421436591",
      "name": "Swyx",
      "handle": "swyx",
      "bio": "...",
      "text": "...",
      "url": "https://x.com/swyx/status/...",
      "isSubstantive": true
    }
  ],
  "podcasts": [
    {
      "name": "Latent Space",
      "title": "...",
      "url": "...",
      "transcript": "..."
    }
  ],
  "blogs": [...],
  "stats": {
    "tweetsTotal": 35,
    "tweetsFiltered": 28,
    "podcastsCount": 1,
    "blogsCount": 0
  }
}
```

The `isSubstantive` field marks whether the tweet passed initial filtering.

## Filtering Strategy

### Stage 1: Fetch-time filtering (in fetch-and-save.js)

**Filter out tweets that:**
- Pure retweets without commentary (text mainly RT @ or quote links)
- Length < 20 chars with no links/images
- Pure emoji (after removing emoji, length < 5)
- Politeness phrases alone: "thanks", "thank you", "great", "awesome", "cool", "nice", "interesting"

**Keep tweets that:**
- Substantial opinions, analysis, product announcements, technical discussions
- Links with explanatory commentary
- Thread content

Podcasts and blogs are not filtered at fetch stage (they are inherently long-form content).

### Stage 2: Frontend filtering

- User can filter by builder name
- User can toggle to view all content vs. only substantive
- Search bar for full-text search (if not too complex to implement)

## Frontend Features

**index.html layout:**

1. **Header**
   - Title: AI Builders Digest
   - Builder filter dropdown (multi-select)

2. **Date list panel (left side)**
   - List of dates, click to expand day's content
   - Show daily stats summary (tweets count, podcasts)
   - Delete button for entire day's data

3. **Content display panel (right side)**
   - Tweets grouped by builder
   - Podcasts and blogs in separate sections
   - Each item expandable for details
   - Delete button per item

4. **Search bar**
   - Input keyword, real-time filter matching content

5. **Delete functionality**
   - Per-item delete button (requires confirmation)
   - Per-day delete button in date list (requires confirmation)
   - Delete removes from JSON file

**Technology:** HTML + Tailwind CDN + vanilla JS (no build tools, open index.html directly)

## Execution Flow

When user runs `/ai` or `/follow-builders`:

1. Run `fetch-and-save.js`:
   - Fetch latest data from GitHub feed
   - Apply Stage 1 filtering
   - Save to `data/YYYY-MM-DD.json` (append/update if file exists)

2. Open browser:
   - Execute `open index.html`
   - Frontend loads latest data file and displays

## Technical Details

### fetch-and-save.js

- Fetch from: `https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-*.json`
- Output: `data/YYYY-MM-DD.json`
- Node.js script, ES modules

### app.js

- Load data: fetch all JSON files from `data/` directory
- Builder filter: collect unique builder names, provide multi-select
- Search: simple text matching across all content
- Delete: update JSON file, remove deleted item
- No backend server, all client-side

## Out of Scope

- Full-text search with relevance ranking (basic keyword match only)
- Pagination (load all data upfront)
- Export functionality
- Sync with remote