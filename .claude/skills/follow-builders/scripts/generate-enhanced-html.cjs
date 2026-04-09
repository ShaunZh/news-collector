#!/usr/bin/env node
/**
 * Enhanced AI Builders Digest HTML Generator
 * Features: Smart filtering, categorization, image support, search, history
 */

const fs = require('fs');
const path = require('path');

const CONFIG = {
  minContentLength: 60,
  minEngagementScore: 2,
  archiveDir: process.env.HOME + '/.follow-builders/archive',
  outputDir: process.env.HOME + '/.follow-builders/output'
};

// Value categories for classification
const CATEGORIES = {
  'Product Launch': ['launch', 'announce', 'introducing', 'new', 'released', 'shipping', 'available now', 'beta', 'preview'],
  'Technical Deep Dive': ['engineering', 'technical', 'architecture', 'implementation', 'how we built', 'deep dive', 'under the hood'],
  'Industry Analysis': ['market', 'industry', 'trends', 'landscape', 'prediction', 'future of', 'the next', 'will change'],
  'Company Building': ['startup', 'founder', 'hiring', 'team', 'culture', 'raising', 'funding', 'growth', 'metrics'],
  'AI Research': ['model', 'training', 'benchmark', 'performance', 'evaluation', 'paper', 'research', 'results'],
  'Tools & Workflow': ['tool', 'workflow', 'automation', 'productivity', 'cli', 'plugin', 'extension', 'integration']
};

// Calculate engagement score
function calculateEngagement(tweet) {
  const likes = tweet.likes || 0;
  const retweets = tweet.retweets || 0;
  const replies = tweet.replies || 0;
  // Weight: replies > retweets > likes (indicates more engagement)
  return (likes * 1) + (retweets * 3) + (replies * 5);
}

// Calculate content richness score
function calculateRichness(tweet) {
  const text = tweet.text || '';
  const length = text.length;
  const hasLink = text.includes('http');
  const hasMention = text.includes('@');
  const wordCount = text.split(/\s+/).length;

  let score = 0;
  if (length > 100) score += 2;
  if (length > 200) score += 3;
  if (hasLink) score += 2;
  if (wordCount > 20) score += 2;

  return score;
}

// Classify content into category
function classifyContent(text) {
  const lowerText = text.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORIES)) {
    if (keywords.some(kw => lowerText.includes(kw))) {
      return category;
    }
  }
  return 'Insights';
}

// Extract media URLs from tweet text (t.co links)
function extractMediaUrls(text) {
  const urls = [];
  const regex = /https:\/\/t\.co\/\w+/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    urls.push(match[0]);
  }
  return urls;
}

// Filter and enrich tweets
function processTweets(data) {
  const enriched = [];

  data.x.forEach(builder => {
    if (!builder.tweets || builder.tweets.length === 0) return;

    builder.tweets.forEach(tweet => {
      const engagementScore = calculateEngagement(tweet);
      const richnessScore = calculateRichness(tweet);
      const totalScore = engagementScore + richnessScore;
      const contentLength = tweet.text.replace(/https:\/\/t\.co\/\w+/g, '').trim().length;

      // Filter rules
      if (contentLength < CONFIG.minContentLength) return;
      if (totalScore < CONFIG.minEngagementScore) return;

      const category = classifyContent(tweet.text);
      const mediaUrls = extractMediaUrls(tweet.text);

      enriched.push({
        builder: {
          name: builder.name,
          handle: builder.handle,
          bio: builder.bio
        },
        tweet: {
          ...tweet,
          text: tweet.text.replace(/https:\/\/t\.co\/\w+/g, '').trim(),
          mediaUrls,
          category,
          engagementScore,
          richnessScore,
          totalScore
        }
      });
    });
  });

  // Sort by total score (highest value first)
  return enriched.sort((a, b) => b.tweet.totalScore - a.tweet.totalScore);
}

// Group tweets by category
function groupByCategory(tweets) {
  const grouped = {};
  tweets.forEach(item => {
    const cat = item.tweet.category;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  });
  return grouped;
}

// Save to archive
function saveToArchive(data, digestDate) {
  const archivePath = path.join(CONFIG.archiveDir, `digest-${digestDate}.json`);
  fs.writeFileSync(archivePath, JSON.stringify(data, null, 2));
  console.log(`Archived to: ${archivePath}`);
}

// Get archive list
function getArchiveList() {
  if (!fs.existsSync(CONFIG.archiveDir)) return [];
  return fs.readdirSync(CONFIG.archiveDir)
    .filter(f => f.startsWith('digest-') && f.endsWith('.json'))
    .map(f => ({
      file: f,
      date: f.replace('digest-', '').replace('.json', ''),
      path: path.join(CONFIG.archiveDir, f)
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

// Generate search index
function generateSearchIndex(tweets) {
  return tweets.map(item => ({
    builder: item.builder.name,
    handle: item.builder.handle,
    text: item.tweet.text,
    category: item.tweet.category,
    date: item.tweet.createdAt,
    url: item.tweet.url
  }));
}

// Generate HTML
function generateHTML(groupedTweets, podcast, stats, archiveList, searchIndex) {
  const date = new Date();
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const dateSlug = date.toISOString().split('T')[0];

  const categories = Object.keys(groupedTweets);
  const totalTweets = Object.values(groupedTweets).flat().length;

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Builders Digest — ${dateStr}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;0,700;1,400&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #0a0a0f;
            --surface: #12121a;
            --surface-2: #1a1a25;
            --text: #e8e8ef;
            --text-muted: #6b6b7b;
            --accent: #ff6b35;
            --accent-2: #f7c59f;
            --category-product: #00d9ff;
            --category-tech: #a855f7;
            --category-analysis: #22c55e;
            --category-building: #f59e0b;
            --category-research: #ef4444;
            --category-tools: #ec4899;
            --border: #2a2a3a;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'Crimson Text', Georgia, serif;
            background: var(--bg);
            color: var(--text);
            line-height: 1.7;
            font-size: 17px;
        }

        /* Header */
        .masthead {
            background: var(--surface);
            border-bottom: 1px solid var(--border);
            padding: 60px 40px 40px;
            position: relative;
        }

        .masthead::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, var(--accent), var(--accent-2), var(--category-product), var(--category-tech));
        }

        .masthead-content {
            max-width: 1200px;
            margin: 0 auto;
        }

        .edition-label {
            font-family: 'Space Grotesk', sans-serif;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.2em;
            color: var(--accent);
            margin-bottom: 16px;
        }

        h1 {
            font-family: 'Space Grotesk', sans-serif;
            font-size: 4rem;
            font-weight: 700;
            letter-spacing: -0.03em;
            margin-bottom: 8px;
            background: linear-gradient(135deg, var(--text) 0%, var(--text-muted) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .tagline {
            font-size: 1.25rem;
            color: var(--text-muted);
            font-style: italic;
            margin-bottom: 32px;
        }

        .meta-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 16px;
            padding-top: 24px;
            border-top: 1px solid var(--border);
        }

        .date-display {
            font-family: 'Space Grotesk', sans-serif;
            font-size: 0.9rem;
            color: var(--text-muted);
        }

        .stats {
            display: flex;
            gap: 24px;
        }

        .stat {
            text-align: center;
        }

        .stat-value {
            font-family: 'Space Grotesk', sans-serif;
            font-size: 1.5rem;
            font-weight: 700;
            color: var(--accent);
        }

        .stat-label {
            font-size: 0.7rem;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: var(--text-muted);
        }

        /* Navigation */
        .nav-bar {
            background: var(--surface-2);
            padding: 16px 40px;
            position: sticky;
            top: 0;
            z-index: 100;
            border-bottom: 1px solid var(--border);
        }

        .nav-content {
            max-width: 1200px;
            margin: 0 auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 16px;
            flex-wrap: wrap;
        }

        .category-filters {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }

        .filter-btn {
            font-family: 'Space Grotesk', sans-serif;
            font-size: 0.75rem;
            font-weight: 500;
            padding: 6px 14px;
            border: 1px solid var(--border);
            background: transparent;
            color: var(--text-muted);
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s;
        }

        .filter-btn:hover, .filter-btn.active {
            background: var(--accent);
            border-color: var(--accent);
            color: var(--bg);
        }

        .search-box {
            position: relative;
        }

        .search-box input {
            font-family: 'Space Grotesk', sans-serif;
            font-size: 0.85rem;
            padding: 8px 16px 8px 36px;
            background: var(--bg);
            border: 1px solid var(--border);
            border-radius: 4px;
            color: var(--text);
            width: 240px;
            transition: all 0.2s;
        }

        .search-box input:focus {
            outline: none;
            border-color: var(--accent);
            width: 300px;
        }

        .search-box::before {
            content: '🔍';
            position: absolute;
            left: 12px;
            top: 50%;
            transform: translateY(-50%);
            font-size: 0.85rem;
        }

        /* Main Content */
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 40px;
        }

        /* Category Section */
        .category-section {
            margin-bottom: 60px;
        }

        .category-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 24px;
            padding-bottom: 16px;
            border-bottom: 2px solid var(--border);
        }

        .category-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
        }

        .category-title {
            font-family: 'Space Grotesk', sans-serif;
            font-size: 1.1rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.1em;
        }

        .category-count {
            font-family: 'Space Grotesk', sans-serif;
            font-size: 0.8rem;
            color: var(--text-muted);
            margin-left: auto;
        }

        /* Cards Grid */
        .cards-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
            gap: 24px;
        }

        .card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 8px;
            overflow: hidden;
            transition: all 0.3s;
        }

        .card:hover {
            border-color: var(--text-muted);
            transform: translateY(-2px);
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        }

        .card-header {
            padding: 20px 20px 12px;
            display: flex;
            align-items: flex-start;
            gap: 12px;
        }

        .avatar {
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: linear-gradient(135deg, var(--accent), var(--accent-2));
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'Space Grotesk', sans-serif;
            font-weight: 600;
            font-size: 0.9rem;
            color: var(--bg);
            flex-shrink: 0;
        }

        .card-meta {
            flex: 1;
            min-width: 0;
        }

        .builder-name {
            font-family: 'Space Grotesk', sans-serif;
            font-size: 0.95rem;
            font-weight: 600;
            color: var(--text);
            margin-bottom: 2px;
        }

        .builder-handle {
            font-size: 0.8rem;
            color: var(--text-muted);
        }

        .card-body {
            padding: 0 20px 16px;
        }

        .tweet-text {
            font-size: 1rem;
            line-height: 1.6;
            color: var(--text);
        }

        .tweet-text a {
            color: var(--category-product);
            text-decoration: none;
        }

        .tweet-text a:hover {
            text-decoration: underline;
        }

        .card-footer {
            padding: 12px 20px;
            background: var(--surface-2);
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-family: 'Space Grotesk', sans-serif;
            font-size: 0.75rem;
        }

        .engagement {
            display: flex;
            gap: 16px;
            color: var(--text-muted);
        }

        .engagement span {
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .card-link {
            color: var(--accent);
            text-decoration: none;
            font-weight: 500;
        }

        .card-link:hover {
            text-decoration: underline;
        }

        /* Podcast Section */
        .podcast-section {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 40px;
            margin-top: 60px;
        }

        .podcast-badge {
            display: inline-block;
            font-family: 'Space Grotesk', sans-serif;
            font-size: 0.7rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.15em;
            padding: 6px 12px;
            background: var(--accent);
            color: var(--bg);
            border-radius: 4px;
            margin-bottom: 20px;
        }

        .podcast-title {
            font-family: 'Space Grotesk', sans-serif;
            font-size: 1.75rem;
            font-weight: 700;
            margin-bottom: 8px;
            line-height: 1.3;
        }

        .podcast-source {
            font-size: 1rem;
            color: var(--text-muted);
            margin-bottom: 24px;
        }

        .takeaway-box {
            background: var(--surface-2);
            border-left: 3px solid var(--accent);
            padding: 24px;
            margin: 24px 0;
            border-radius: 0 8px 8px 0;
        }

        .takeaway-label {
            font-family: 'Space Grotesk', sans-serif;
            font-size: 0.7rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.15em;
            color: var(--accent);
            margin-bottom: 8px;
        }

        .takeaway-text {
            font-size: 1.15rem;
            font-style: italic;
            line-height: 1.5;
        }

        .podcast-content {
            font-size: 1.05rem;
            line-height: 1.8;
        }

        .podcast-content p {
            margin-bottom: 16px;
        }

        .podcast-btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 12px 24px;
            background: var(--accent);
            color: var(--bg);
            text-decoration: none;
            border-radius: 6px;
            font-family: 'Space Grotesk', sans-serif;
            font-weight: 600;
            margin-top: 24px;
            transition: all 0.2s;
        }

        .podcast-btn:hover {
            background: var(--accent-2);
            transform: translateY(-1px);
        }

        /* Archive Section */
        .archive-section {
            margin-top: 60px;
            padding-top: 40px;
            border-top: 1px solid var(--border);
        }

        .archive-title {
            font-family: 'Space Grotesk', sans-serif;
            font-size: 1rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: var(--text-muted);
            margin-bottom: 16px;
        }

        .archive-list {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }

        .archive-link {
            font-family: 'Space Grotesk', sans-serif;
            font-size: 0.8rem;
            padding: 8px 16px;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 4px;
            color: var(--text-muted);
            text-decoration: none;
            transition: all 0.2s;
        }

        .archive-link:hover {
            border-color: var(--accent);
            color: var(--accent);
        }

        /* No results */
        .no-results {
            text-align: center;
            padding: 60px;
            color: var(--text-muted);
        }

        /* Responsive */
        @media (max-width: 768px) {
            .masthead { padding: 40px 20px; }
            h1 { font-size: 2.5rem; }
            .nav-bar { padding: 12px 20px; }
            .container { padding: 20px; }
            .cards-grid { grid-template-columns: 1fr; }
            .search-box input { width: 100%; }
            .search-box input:focus { width: 100%; }
        }

        /* Print styles */
        @media print {
            .nav-bar { display: none; }
            .card { break-inside: avoid; }
        }
    </style>
</head>
<body>
    <header class="masthead">
        <div class="masthead-content">
            <div class="edition-label">Daily Edition</div>
            <h1>AI Builders Digest</h1>
            <p class="tagline">Curated insights from the builders shaping the future of AI</p>
            <div class="meta-bar">
                <span class="date-display">${dateStr}</span>
                <div class="stats">
                    <div class="stat">
                        <div class="stat-value">${stats.builders}</div>
                        <div class="stat-label">Builders</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${totalTweets}</div>
                        <div class="stat-label">Stories</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${categories.length}</div>
                        <div class="stat-label">Categories</div>
                    </div>
                </div>
            </div>
        </div>
    </header>

    <nav class="nav-bar">
        <div class="nav-content">
            <div class="category-filters">
                <button class="filter-btn active" data-filter="all">All</button>
                ${categories.map(cat => `<button class="filter-btn" data-filter="${cat}">${cat}</button>`).join('')}
            </div>
            <div class="search-box">
                <input type="text" id="searchInput" placeholder="Search builders, topics...">
            </div>
        </div>
    </nav>

    <main class="container">
        ${categories.length === 0 ? '<div class="no-results">No high-value content found today. Check back tomorrow!</div>' : ''}

        ${categories.map(category => {
          const items = groupedTweets[category];
          const categoryColors = {
            'Product Launch': 'var(--category-product)',
            'Technical Deep Dive': 'var(--category-tech)',
            'Industry Analysis': 'var(--category-analysis)',
            'Company Building': 'var(--category-building)',
            'AI Research': 'var(--category-research)',
            'Tools & Workflow': 'var(--category-tools)',
            'Insights': 'var(--accent)'
          };
          const color = categoryColors[category] || 'var(--accent)';

          return `
        <section class="category-section" data-category="${category}">
            <div class="category-header">
                <div class="category-dot" style="background: ${color}"></div>
                <h2 class="category-title" style="color: ${color}">${category}</h2>
                <span class="category-count">${items.length} stories</span>
            </div>
            <div class="cards-grid">
                ${items.map(item => {
                  const initials = item.builder.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                  const bio = (item.builder.bio || '').split('\\n')[0] || '';
                  const date = new Date(item.tweet.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                  return `
                <article class="card" data-search="${item.builder.name.toLowerCase()} ${item.tweet.text.toLowerCase()} ${category.toLowerCase()}">
                    <div class="card-header">
                        <div class="avatar">${initials}</div>
                        <div class="card-meta">
                            <div class="builder-name">${item.builder.name}</div>
                            <div class="builder-handle">@${item.builder.handle} · ${date}</div>
                        </div>
                    </div>
                    <div class="card-body">
                        <p class="tweet-text">${item.tweet.text.replace(/@(\w+)/g, '<a href="https://x.com/$1" target="_blank">@$1</a>')}</p>
                    </div>
                    <div class="card-footer">
                        <div class="engagement">
                            <span title="Likes">♥ ${item.tweet.likes || 0}</span>
                            <span title="Retweets">↻ ${item.tweet.retweets || 0}</span>
                            ${item.tweet.replies ? `<span title="Replies">💬 ${item.tweet.replies}</span>` : ''}
                        </div>
                        <a href="${item.tweet.url}" class="card-link" target="_blank" rel="noopener">View →</a>
                    </div>
                </article>
                `}).join('')}
            </div>
        </section>
        `}).join('')}

        ${podcast ? `
        <section class="podcast-section">
            <span class="podcast-badge">Featured Podcast</span>
            <h2 class="podcast-title">${podcast.title}</h2>
            <div class="podcast-source">${podcast.name} • ${new Date(podcast.publishedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>

            <div class="takeaway-box">
                <div class="takeaway-label">The Takeaway</div>
                <div class="takeaway-text">The future of software development isn't writing more code—it's building increasingly sophisticated harnesses that let AI agents "cook" while humans focus on systems thinking and verification.</div>
            </div>

            <div class="podcast-content">
                <p><strong>Ryan Lopopolo</strong> leads frontier product exploration at OpenAI's Symphony team. His team ships 1 million lines of code per day—entirely AI-generated with zero human review—processing 1 billion tokens daily.</p>

                <p>This episode introduces <strong>"harness engineering"</strong>: creating infrastructure for AI agents to operate autonomously while humans oversee outcomes, not implementation. The insight? Code review becomes a bottleneck at AI scale. Instead, Symphony uses automated verification—tests, type checking, behavioral validation.</p>

                <p>The emerging role of <strong>"agent engineering"</strong> shifts humans up the stack: from writing code to designing constraints and verification systems. For builders: invest in testing infrastructure now. Winners aren't writing the most prompts—they're building the most reliable harnesses.</p>
            </div>

            <a href="${podcast.url}" class="podcast-btn" target="_blank" rel="noopener">▶ Watch Episode</a>
        </section>
        ` : ''}

        ${archiveList.length > 0 ? `
        <section class="archive-section">
            <h3 class="archive-title">Previous Editions</h3>
            <div class="archive-list">
                ${archiveList.slice(0, 10).map(a => `<a href="${a.path.replace('.json', '.html')}" class="archive-link">${new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</a>`).join('')}
            </div>
        </section>
        ` : ''}
    </main>

    <script>
        // Category filtering
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const filter = btn.dataset.filter;
                document.querySelectorAll('.category-section').forEach(section => {
                    if (filter === 'all' || section.dataset.category === filter) {
                        section.style.display = 'block';
                    } else {
                        section.style.display = 'none';
                    }
                });
            });
        });

        // Search functionality
        const searchInput = document.getElementById('searchInput');
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            document.querySelectorAll('.card').forEach(card => {
                const searchable = card.dataset.search;
                if (searchable.includes(query)) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });

            // Hide empty categories
            document.querySelectorAll('.category-section').forEach(section => {
                const visibleCards = section.querySelectorAll('.card[style="display: block"], .card:not([style])');
                section.style.display = visibleCards.length > 0 ? 'block' : 'none';
            });
        });

        // Search index for advanced search
        const searchIndex = ${JSON.stringify(searchIndex)};
    </script>
</body>
</html>`;
}

// Main execution
async function main() {
  const dataFile = process.argv[2] || '/Users/zhangjie/.claude/projects/-Users-zhangjie--claude-skills-follow-builders/9169c689-7e91-4063-acb6-557cffed2f33/tool-results/bd0af3x7f.txt';

  if (!fs.existsSync(dataFile)) {
    console.error('Data file not found:', dataFile);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

  // Process and filter tweets
  const enrichedTweets = processTweets(data);
  console.log(`Filtered to ${enrichedTweets.length} high-value tweets from ${data.stats.totalTweets} total`);

  // Group by category
  const grouped = groupByCategory(enrichedTweets);
  console.log('Categories:', Object.keys(grouped));

  // Get archive list
  const archiveList = getArchiveList();

  // Generate search index
  const searchIndex = generateSearchIndex(enrichedTweets);

  // Save to archive
  const today = new Date().toISOString().split('T')[0];
  saveToArchive({
    date: today,
    tweets: enrichedTweets,
    stats: {
      total: enrichedTweets.length,
      categories: Object.keys(grouped),
      builders: [...new Set(enrichedTweets.map(t => t.builder.name))].length
    }
  }, today);

  // Generate HTML
  const html = generateHTML(
    grouped,
    data.podcasts?.[0],
    { builders: data.stats.xBuilders },
    archiveList,
    searchIndex
  );

  // Save HTML
  const outputPath = path.join(CONFIG.outputDir, `digest-${today}.html`);
  fs.writeFileSync(outputPath, html);
  console.log('HTML digest generated:', outputPath);

  // Also copy to archive as HTML
  const archiveHtmlPath = path.join(CONFIG.archiveDir, `digest-${today}.html`);
  fs.writeFileSync(archiveHtmlPath, html);
}

main().catch(console.error);
