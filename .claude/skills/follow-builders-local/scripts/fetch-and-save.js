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

// ===================== SAVE/MERGE FUNCTIONS =====================

async function loadExistingData(dateFile) {
  if (existsSync(dateFile)) {
    try {
      const content = await readFile(dateFile, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
  return null;
}

function mergeData(existing, newData) {
  if (!existing) return newData;

  // Merge tweets by ID (avoid duplicates)
  const existingTweetIds = new Set(existing.tweets.map(t => t.id));
  const newTweets = newData.tweets.filter(t => !existingTweetIds.has(t.id));
  const mergedTweets = [...existing.tweets, ...newTweets];

  // Podcasts and blogs: replace if new data exists
  return {
    ...existing,
    tweets: mergedTweets,
    podcasts: newData.podcasts.length > 0 ? newData.podcasts : existing.podcasts,
    blogs: newData.blogs.length > 0 ? newData.blogs : existing.blogs,
    stats: newData.stats,
    fetchedAt: new Date().toISOString()
  };
}

// ===================== MAIN FUNCTION =====================

async function main() {
  console.log('Fetching AI Builders Digest data...');

  await ensureDataDir();

  // Fetch all feeds
  const [feedX, feedPodcasts, feedBlogs] = await Promise.all([
    fetchJSON(FEED_X_URL),
    fetchJSON(FEED_PODCASTS_URL),
    fetchJSON(FEED_BLOGS_URL)
  ]);

  if (!feedX) {
    console.error('Failed to fetch tweet feed');
    process.exit(1);
  }

  const today = getTodayDate();
  const dateFile = join(DATA_DIR, `${today}.json`);

  // Filter tweets
  let totalTweets = 0;
  let filteredTweets = 0;
  const processedBuilders = [];

  if (feedX.x) {
    for (const builder of feedX.x) {
      totalTweets += builder.tweets.length;
      const filtered = filterTweets(builder.tweets);
      filteredTweets += filtered.filter(t => t.isSubstantive).length;
      processedBuilders.push({
        name: builder.name,
        handle: builder.handle,
        bio: builder.bio,
        tweets: filtered
      });
    }
  }

  // Build new data structure
  const newData = {
    date: today,
    fetchedAt: new Date().toISOString(),
    tweets: processedBuilders,
    podcasts: feedPodcasts?.podcasts || [],
    blogs: feedBlogs?.blogs || [],
    stats: {
      tweetsTotal: totalTweets,
      tweetsFiltered: filteredTweets,
      podcastsCount: feedPodcasts?.podcasts?.length || 0,
      blogsCount: feedBlogs?.blogs?.length || 0
    }
  };

  // Merge with existing if present
  const existingData = await loadExistingData(dateFile);
  const finalData = mergeData(existingData, newData);

  // Save
  await writeFile(dateFile, JSON.stringify(finalData, null, 2));
  console.log(`Saved ${finalData.tweets.reduce((s, b) => s + b.tweets.length, 0)} tweets from ${finalData.tweets.length} builders to ${dateFile}`);
  console.log(`Stats: ${totalTweets} total → ${filteredTweets} substantive`);

  // Output path for caller to use
  console.log(`DATA_FILE:${dateFile}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

// Export for testing
export { isSubstantiveTweet, removeEmoji, isPolitenessOnly, loadExistingData, mergeData };
