# News Project

Local digest viewer for AI Builders content.

## Commands

- `/ai` or `/follow-builders` — Fetch latest data, save locally, and open browser viewer

## Hook Configuration

When `/ai` or `/follow-builders` is invoked in this project:
1. Run `node .claude/skills/follow-builders/scripts/fetch-local.js`
2. Start HTTP server and open browser

## Important

Due to browser CORS restrictions, `file://` protocol cannot load local JSON files.
Must use HTTP server:

```bash
python3 -m http.server 8888
# Then visit http://localhost:8888
```

## Architecture

See README.md for full documentation.