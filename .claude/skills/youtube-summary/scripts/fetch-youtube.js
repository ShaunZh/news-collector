#!/usr/bin/env node

// Fetch YouTube video info and subtitles using yt-dlp

import { writeFile, mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { spawn } from 'child_process';
import { tmpdir } from 'os';

const YOUTUBE_VIDEO_ID_LENGTH = 11;
const SCRIPT_DIR = dirname(new URL(import.meta.url).pathname);
const PROJECT_DIR = join(SCRIPT_DIR, '..', '..', '..', '..');
const VIDEOS_DIR = join(PROJECT_DIR, 'videos');

// Parse YouTube URL to extract video ID
function extractVideoId(url) {
  const patterns = [
    new RegExp(`(?:youtube\\.com/watch\\?v=|youtu\\.be/|youtube\\.com/embed/)([a-zA-Z0-9_-]{${YOUTUBE_VIDEO_ID_LENGTH}})`),
    new RegExp(`^([a-zA-Z0-9_-]{${YOUTUBE_VIDEO_ID_LENGTH}})$`)
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

  // Update video index
  await updateVideoIndex(videoId);

  console.log(`Saved to: ${outputFile}`);
  console.log(`VIDEO_FILE:${outputFile}`);
  console.log(`TITLE:${data.title}`);
  console.log(`CHANNEL:${data.channel}`);
  console.log(`DURATION:${formatDuration(data.duration)}`);
  console.log(`SUBTITLE_TYPE:${subtitles.type}`);
}

async function updateVideoIndex(videoId) {
  const indexPath = join(VIDEOS_DIR, 'index.json');
  let index = { videos: [] };

  // Read existing index
  try {
    if (existsSync(indexPath)) {
      const content = await readFile(indexPath, 'utf8');
      index = JSON.parse(content);
    }
  } catch {
    // Index doesn't exist or is invalid, start fresh
  }

  // Check if video already in index
  const exists = index.videos.some(v =>
    typeof v === 'string' ? v === videoId : v.videoId === videoId
  );

  if (!exists) {
    // Add video with metadata for easier frontend loading
    const today = new Date().toISOString().split('T')[0];
    index.videos.push({
      videoId,
      date: today,
      file: `${today}-${videoId}.json`
    });
    await writeFile(indexPath, JSON.stringify(index, null, 2));
    console.log('Updated video index');
  }
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
