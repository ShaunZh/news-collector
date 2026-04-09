// AI Builders Digest Viewer

const DATA_DIR = 'data';

let allData = [];
let currentData = null;
let allBuilders = [];
const deletionQueue = [];

// ============ Dark Mode ============

function initDarkMode() {
  const saved = localStorage.getItem('darkMode');
  if (saved === 'true' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  }
}

function toggleDarkMode() {
  document.documentElement.classList.toggle('dark');
  localStorage.setItem('darkMode', document.documentElement.classList.contains('dark'));
}

// ============ Data Loading ============

async function loadAllData() {
  try {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }

    const results = await Promise.all(dates.map(date => loadDayData(date)));
    allData = results.filter(d => d !== null).sort((a, b) => new Date(b.date) - new Date(a.date));

    extractBuilders();
    renderDateList();
    updateBuilderFilter();

    if (allData.length > 0) {
      selectDate(allData[0].date);
    }
  } catch (err) {
    console.error('Error loading data:', err);
  }
}

async function loadDayData(date) {
  const edits = JSON.parse(localStorage.getItem('digestEdits') || '{}');
  if (edits[date]) return edits[date];

  try {
    const response = await fetch(`${DATA_DIR}/${date}.json`);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function extractBuilders() {
  const builderSet = new Set();
  allData.forEach(day => {
    day.tweets.forEach(builder => builderSet.add(builder.name));
  });
  allBuilders = Array.from(builderSet).sort();
}

// ============ Date List Rendering ============

function renderDateList() {
  const container = document.getElementById('dateList');

  if (allData.length === 0) {
    container.innerHTML = '<div class="p-3"><h2 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2">History</h2></div><div class="p-2 text-sm text-slate-400">No data available</div>';
    return;
  }

  let html = '<div class="p-3"><h2 class="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 px-2">History</h2></div>';

  html += allData.map(day => {
    const tweetCount = day.tweets.reduce((sum, b) => sum + b.tweets.length, 0);
    const substantiveCount = day.stats?.tweetsFiltered || tweetCount;
    const podcastCount = day.stats?.podcastsCount || 0;
    const isActive = currentData?.date === day.date;

    return `
      <div class="date-item px-3 py-2 mx-2 rounded-lg cursor-pointer flex justify-between items-center group ${isActive ? 'active' : ''}"
           data-date="${escapeHtmlAttr(day.date)}">
        <div class="flex-1 min-w-0">
          <div class="font-medium text-sm text-slate-700 dark:text-slate-200">${formatDate(day.date)}</div>
          <div class="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
            <span>${substantiveCount} posts</span>
            ${podcastCount > 0 ? `<span class="text-purple-500">• ${podcastCount} 🎧</span>` : ''}
          </div>
        </div>
        <button class="delete-day-btn opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 p-1 transition-all"
                data-date="${escapeHtmlAttr(day.date)}" title="Delete">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </button>
      </div>
    `;
  }).join('');

  container.innerHTML = html;
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (dateStr === today.toISOString().split('T')[0]) return 'Today';
  if (dateStr === yesterday.toISOString().split('T')[0]) return 'Yesterday';

  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function selectDate(date) {
  currentData = allData.find(d => d.date === date);
  if (!currentData) return;

  document.querySelectorAll('.date-item').forEach(el => {
    el.classList.toggle('active', el.dataset.date === date);
  });

  renderContent();
  renderPodcasts();
}

// ============ Content Rendering ============

function renderContent() {
  const container = document.getElementById('contentArea');

  if (!currentData) {
    container.innerHTML = '<div class="max-w-4xl mx-auto p-8"><div class="text-slate-400 text-center py-16">Select a date to view content</div></div>';
    return;
  }

  let filteredBuilders = currentData.tweets;
  const selectedBuilder = document.getElementById('builderFilter').value;
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();

  if (selectedBuilder) {
    filteredBuilders = filteredBuilders.filter(b => b.name === selectedBuilder);
  }

  if (searchTerm) {
    filteredBuilders = filteredBuilders.map(builder => ({
      ...builder,
      tweets: builder.tweets.filter(t =>
        t.text.toLowerCase().includes(searchTerm) ||
        builder.name.toLowerCase().includes(searchTerm)
      )
    })).filter(b => b.tweets.length > 0);
  }

  const totalTweets = filteredBuilders.reduce((sum, b) => sum + b.tweets.filter(t => t.isSubstantive).length, 0);

  let html = '<div class="max-w-4xl mx-auto p-8">';

  // Page header
  html += `
    <div class="mb-8">
      <h2 class="text-2xl font-bold text-slate-800 dark:text-slate-100">${formatDate(currentData.date)}</h2>
      <p class="text-slate-500 dark:text-slate-400 mt-1">${totalTweets} posts from ${filteredBuilders.length} builders</p>
    </div>
  `;

  // Tweets
  if (filteredBuilders.length > 0) {
    filteredBuilders.forEach(builder => {
      html += renderBuilder(builder);
    });
  }

  // Blogs in main content
  if (currentData.blogs && currentData.blogs.length > 0) {
    html += `
      <div class="mt-12 pt-8 border-t border-slate-200 dark:border-slate-700">
        <h3 class="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
          <svg class="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"/>
          </svg>
          Blogs
        </h3>
        ${currentData.blogs.map(blog => renderBlog(blog)).join('')}
      </div>
    `;
  }

  if (filteredBuilders.length === 0) {
    html += '<div class="text-slate-400 text-center py-16">No matching content found</div>';
  }

  html += '</div>';
  container.innerHTML = html;
}

function renderPodcasts() {
  const container = document.getElementById('podcastList');

  if (!currentData || !currentData.podcasts || currentData.podcasts.length === 0) {
    container.innerHTML = '<div class="text-sm text-slate-400 text-center py-8">No podcasts</div>';
    return;
  }

  container.innerHTML = currentData.podcasts.map(podcast => renderPodcast(podcast)).join('');
}

function renderBuilder(builder) {
  const substantiveTweets = builder.tweets.filter(t => t.isSubstantive);
  const lowValueTweets = builder.tweets.filter(t => !t.isSubstantive);
  const initials = builder.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  let html = `
    <div class="mb-8">
      <div class="flex items-center gap-3 mb-4">
        <div class="builder-avatar">${initials}</div>
        <div class="flex-1">
          <div class="font-semibold text-slate-800 dark:text-slate-100">${escapeHtml(builder.name)}</div>
          <div class="text-sm text-slate-400">@${escapeHtml(builder.handle)}</div>
        </div>
        <div class="text-xs font-medium text-slate-400 bg-slate-100 dark:bg-slate-700 px-3 py-1 rounded-full">
          ${substantiveTweets.length}
        </div>
      </div>
  `;

  substantiveTweets.forEach(tweet => {
    html += renderTweet(tweet, true);
  });

  if (lowValueTweets.length > 0) {
    html += `
      <details class="mt-3">
        <summary class="text-xs text-slate-400 cursor-pointer hover:text-slate-500 select-none ml-1">
          +${lowValueTweets.length} filtered
        </summary>
        <div class="mt-2 space-y-2 opacity-60">
          ${lowValueTweets.map(t => renderTweet(t, false)).join('')}
        </div>
      </details>
    `;
  }

  html += '</div>';
  return html;
}

function renderTweet(tweet, isSubstantive) {
  const text = formatTweetText(tweet.text);
  const isLong = tweet.text.length > 300;

  return `
    <div class="card bg-white dark:bg-slate-800 rounded-2xl p-5 mb-3 border border-slate-100 dark:border-slate-700 shadow-sm"
         data-tweet-id="${escapeHtmlAttr(tweet.id)}">
      <div class="flex gap-3">
        <div class="flex-1 min-w-0">
          <p class="tweet-text text-slate-700 dark:text-slate-200 text-[15px] leading-relaxed ${isLong ? 'line-clamp-5' : ''}" id="tweet-${escapeHtmlAttr(tweet.id)}">
            ${text}
          </p>
          ${isLong ? `
            <button class="text-indigo-500 hover:text-indigo-600 text-sm mt-2 flex items-center gap-1" onclick="toggleExpand('${escapeHtmlAttr(tweet.id)}')">
              <span class="expand-text">Show more</span>
              <svg class="w-3 h-3 expand-icon transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
              </svg>
            </button>
          ` : ''}
          <div class="mt-3 flex items-center">
            <a href="${sanitizeUrl(tweet.url)}" target="_blank"
               class="text-sm text-slate-400 hover:text-indigo-500 flex items-center gap-1.5 transition-colors">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              View on X
            </a>
          </div>
        </div>
        <button class="delete-btn delete-tweet-btn text-slate-300 hover:text-red-500 p-1.5 self-start rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                data-id="${escapeHtmlAttr(tweet.id)}" title="Delete">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </div>
  `;
}

function renderPodcast(podcast) {
  const podcastId = escapeHtmlAttr(podcast.guid || podcast.url);
  return `
    <div class="podcast-card rounded-2xl p-4 mb-3"
         data-podcast-id="${podcastId}">
      <div class="flex items-start gap-3">
        <div class="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center flex-shrink-0">
          <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <h4 class="font-semibold text-slate-800 dark:text-slate-100 text-sm">${escapeHtml(podcast.name)}</h4>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">${escapeHtml(podcast.title)}</p>
          <a href="${sanitizeUrl(podcast.url)}" target="_blank"
             class="text-xs text-indigo-500 hover:text-indigo-600 mt-2 inline-flex items-center gap-1">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
            </svg>
            Listen
          </a>
          <details class="mt-2">
            <summary class="text-xs text-slate-400 cursor-pointer hover:text-slate-500 select-none">Transcript</summary>
            <div class="mt-2 text-xs text-slate-600 dark:text-slate-300 bg-white/50 dark:bg-slate-900/50 rounded-lg p-3 max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
              ${escapeHtml(podcast.transcript?.slice(0, 5000) || 'No transcript')}${podcast.transcript && podcast.transcript.length > 5000 ? '...' : ''}
            </div>
          </details>
        </div>
        <button class="delete-btn delete-podcast-btn text-slate-300 hover:text-red-500 p-1 rounded"
                data-id="${podcastId}" title="Delete">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </div>
  `;
}

function renderBlog(blog) {
  const blogUrl = escapeHtmlAttr(blog.url);
  return `
    <div class="card bg-white dark:bg-slate-800 rounded-2xl p-5 mb-3 border border-slate-100 dark:border-slate-700 shadow-sm"
         data-blog-url="${blogUrl}">
      <div class="flex items-start gap-4">
        <div class="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center flex-shrink-0">
          <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"/>
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <h3 class="font-semibold text-slate-800 dark:text-slate-100">${escapeHtml(blog.name || 'Blog')}</h3>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">${escapeHtml(blog.title)}</p>
          <a href="${sanitizeUrl(blog.url)}" target="_blank"
             class="mt-3 text-sm text-indigo-500 hover:text-indigo-600 inline-flex items-center gap-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
            </svg>
            Read article
          </a>
        </div>
        <button class="delete-btn delete-blog-btn text-slate-300 hover:text-red-500 p-1.5 self-start rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                data-url="${blogUrl}" title="Delete">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </div>
  `;
}

function formatTweetText(text) {
  let formatted = escapeHtml(text);
  formatted = formatted.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener" class="break-all">$1</a>');
  formatted = formatted.replace(/@(\w+)/g, '<a href="https://x.com/$1" target="_blank" rel="noopener">@$1</a>');
  formatted = formatted.replace(/#(\w+)/g, '<a href="https://x.com/search?q=%23$1" target="_blank" rel="noopener">#$1</a>');
  return formatted;
}

function toggleExpand(tweetId) {
  const tweetEl = document.getElementById(`tweet-${tweetId}`);
  const btn = tweetEl.parentElement.querySelector('button');
  if (!btn) return;

  const textSpan = btn.querySelector('.expand-text');
  const icon = btn.querySelector('.expand-icon');

  if (tweetEl.classList.contains('line-clamp-5')) {
    tweetEl.classList.remove('line-clamp-5');
    textSpan.textContent = 'Show less';
    icon.style.transform = 'rotate(180deg)';
  } else {
    tweetEl.classList.add('line-clamp-5');
    textSpan.textContent = 'Show more';
    icon.style.transform = '';
  }
}

// ============ Helpers ============

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeHtmlAttr(text) {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function sanitizeUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return url;
  } catch {}
  return '#';
}

// ============ Filter and Search ============

function updateBuilderFilter() {
  const select = document.getElementById('builderFilter');
  select.innerHTML = '<option value="">All Builders</option>' +
    allBuilders.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
}

// ============ Delete Functionality ============

function deleteDay(date) {
  if (!confirm(`Delete all data for ${formatDate(date)}?`)) return;
  allData = allData.filter(d => d.date !== date);
  renderDateList();
  if (currentData?.date === date) {
    currentData = null;
    renderContent();
    renderPodcasts();
  }
  markForDeletion(date);
}

function deleteTweet(tweetId) {
  if (!confirm('Delete this tweet?')) return;
  currentData.tweets.forEach(builder => {
    builder.tweets = builder.tweets.filter(t => t.id !== tweetId);
  });
  currentData.tweets = currentData.tweets.filter(b => b.tweets.length > 0);
  renderContent();
  saveCurrentData();
}

function deletePodcast(identifier) {
  if (!confirm('Delete this podcast?')) return;
  currentData.podcasts = currentData.podcasts.filter(p => (p.guid || p.url) !== identifier);
  renderPodcasts();
  saveCurrentData();
}

function deleteBlog(url) {
  if (!confirm('Delete this blog?')) return;
  currentData.blogs = currentData.blogs.filter(b => b.url !== url);
  renderContent();
  saveCurrentData();
}

function markForDeletion(date) {
  deletionQueue.push({ type: 'day', date });
}

function saveCurrentData() {
  if (!currentData) return;
  const edits = JSON.parse(localStorage.getItem('digestEdits') || '{}');
  edits[currentData.date] = currentData;
  localStorage.setItem('digestEdits', JSON.stringify(edits));
  const idx = allData.findIndex(d => d.date === currentData.date);
  if (idx !== -1) allData[idx] = currentData;
}

// ============ Initialize ============

initDarkMode();

document.getElementById('darkModeToggle').addEventListener('click', toggleDarkMode);
document.getElementById('builderFilter').addEventListener('change', renderContent);
document.getElementById('searchInput').addEventListener('input', renderContent);

document.getElementById('dateList').addEventListener('click', (e) => {
  const dateItem = e.target.closest('.date-item');
  if (dateItem && !e.target.closest('.delete-day-btn')) {
    selectDate(dateItem.dataset.date);
  }
  const deleteBtn = e.target.closest('.delete-day-btn');
  if (deleteBtn) {
    e.stopPropagation();
    deleteDay(deleteBtn.dataset.date);
  }
});

document.getElementById('contentArea').addEventListener('click', (e) => {
  const deleteTweetBtn = e.target.closest('.delete-tweet-btn');
  if (deleteTweetBtn) deleteTweet(deleteTweetBtn.dataset.id);

  const deleteBlogBtn = e.target.closest('.delete-blog-btn');
  if (deleteBlogBtn) deleteBlog(deleteBlogBtn.dataset.url);
});

document.getElementById('podcastList').addEventListener('click', (e) => {
  const deletePodcastBtn = e.target.closest('.delete-podcast-btn');
  if (deletePodcastBtn) deletePodcast(deletePodcastBtn.dataset.id);
});

loadAllData();