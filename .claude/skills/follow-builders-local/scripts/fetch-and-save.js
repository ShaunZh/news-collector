#!/usr/bin/env node

// Fetch AI Builders Digest data, filter, and save locally

import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

const SCRIPT_DIR = dirname(new URL(import.meta.url).pathname);
const PROJECT_DIR = join(SCRIPT_DIR, '..', '..', '..', '..');
const DATA_DIR = join(PROJECT_DIR, 'data');

const FEED_X_URL = 'https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-x.json';
const FEED_PODCASTS_URL = 'https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-podcasts.json';
const FEED_BLOGS_URL = 'https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-blogs.json';

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`Failed to fetch ${url}: ${res.status}`);
    return null;
  }
  return res.json();
}

function getTodayDate() {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

// ===================== FILTERING FUNCTIONS =====================

function removeEmoji(str) {
  // Remove emoji and emoji-related unicode ranges
  return str.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
}

const POLITENESS_PHRASES = [
  'thanks', 'thank you', 'thx', 'ty',
  'great', 'awesome', 'cool', 'nice', 'interesting',
  'amazing', 'wonderful', 'excellent', 'good',
  'yes', 'no', 'ok', 'okay', 'sure', 'agreed',
  'congrats', 'congratulations', 'well done'
];

function isPolitenessOnly(text) {
  const normalized = text.toLowerCase().trim().replace(/[!.?,]/g, '');
  return POLITENESS_PHRASES.includes(normalized);
}

function hasLink(text) {
  return text.includes('http://') || text.includes('https://') || text.includes('t.co');
}

function isSubstantiveTweet(tweet) {
  const text = tweet.text || '';

  // Filter 1: Too short without links
  if (text.length < 20 && !hasLink(text)) {
    return false;
  }

  // Filter 2: Pure emoji
  const textWithoutEmoji = removeEmoji(text).trim();
  if (textWithoutEmoji.length < 5 && !hasLink(text)) {
    return false;
  }

  // Filter 3: Politeness only
  if (isPolitenessOnly(text)) {
    return false;
  }

  // Filter 4: Pure retweet without commentary
  // (text is mostly RT @username or just a quote link)
  if (text.startsWith('RT @') && text.length < 50) {
    return false;
  }

  return true;
}

function filterTweets(tweets) {
  return tweets.map(t => ({
    ...t,
    isSubstantive: isSubstantiveTweet(t)
  }));
}

// Export for testing
export { removeEmoji, isPolitenessOnly, hasLink, isSubstantiveTweet, filterTweets };
