# News Project

Local digest viewer for AI Builders content.

## Commands

- `/ai` or `/follow-builders` — Fetch latest data, save locally, and open browser viewer

## Hook Configuration

When `/ai` or `/follow-builders` is invoked in this project:
1. Run `node .claude/skills/follow-builders-local/scripts/fetch-and-save.js`
2. Open browser: `open index.html`

## Architecture

- `data/` — Daily JSON files (YYYY-MM-DD.json)
- `index.html` + `app.js` — Browser viewer (open directly, no server)
- `.claude/skills/follow-builders-local/scripts/fetch-and-save.js` — Fetch script

## Details

See design doc: `docs/superpowers/specs/2026-04-09-local-digest-design.md`
