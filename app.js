// AI Builders Digest Viewer

const DATA_DIR = 'data';

let allData = [];       // All loaded daily data
let currentData = null; // Currently displayed day
let allBuilders = [];   // All unique builder names
const deletionQueue = [];

// ============ Data Loading ============

// Load all JSON files from data directory
async function loadAllData() {
  try {
    // Since we're running from file://, we need to list files differently
    // We'll use a simple approach: fetch index.json or try common dates
    // For simplicity, we'll try the last 30 days

    const dates = [];
    const today = new Date();

    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }

    const results = await Promise.all(
      dates.map(date => loadDayData(date))
    );

    allData = results.filter(d => d !== null).sort((a, b) =>
      new Date(b.date) - new Date(a.date)
    );

    extractBuilders();
    renderDateList();
    updateBuilderFilter();

    // Auto-select today or latest
    if (allData.length > 0) {
      selectDate(allData[0].date);
    }
  } catch (err) {
    console.error('Error loading data:', err);
  }
}

async function loadDayData(date) {
  // Check localStorage for edits first
  const edits = JSON.parse(localStorage.getItem('digestEdits') || '{}');
  if (edits[date]) {
    return edits[date];
  }

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
    day.tweets.forEach(builder => {
      builderSet.add(builder.name);
    });
  });
  allBuilders = Array.from(builderSet).sort();
}

// ============ Date List Rendering ============

function renderDateList() {
  const container = document.getElementById('dateList');

  if (allData.length === 0) {
    container.innerHTML = '<div class="p-4 text-sm text-gray-500">No data available</div>';
    return;
  }

  container.innerHTML = allData.map(day => {
    const tweetCount = day.tweets.reduce((sum, b) => sum + b.tweets.length, 0);
    const substantiveCount = day.stats?.tweetsFiltered || tweetCount;

    return `
      <div class="date-item p-3 border-b cursor-pointer flex justify-between items-center"
           data-date="${escapeHtmlAttr(day.date)}">
        <div>
          <div class="font-medium text-sm">${formatDate(day.date)}</div>
          <div class="text-xs text-gray-500">${substantiveCount} tweets, ${day.stats?.podcastsCount || 0} podcasts</div>
        </div>
        <button class="delete-day-btn text-red-500 hover:text-red-700 text-xs px-2"
                data-date="${escapeHtmlAttr(day.date)}">
          Delete
        </button>
      </div>
    `;
  }).join('');
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (dateStr === today.toISOString().split('T')[0]) {
    return 'Today';
  }
  if (dateStr === yesterday.toISOString().split('T')[0]) {
    return 'Yesterday';
  }

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function selectDate(date) {
  currentData = allData.find(d => d.date === date);
  if (!currentData) return;

  // Update active state in sidebar
  document.querySelectorAll('.date-item').forEach(el => {
    el.classList.toggle('active', el.dataset.date === date);
  });

  renderContent();
}

// ============ Content Rendering ============

function renderContent() {
  const container = document.getElementById('contentArea');

  if (!currentData) {
    container.innerHTML = '<div class="text-gray-500">Select a date to view content</div>';
    return;
  }

  // Apply filters
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

  // Build HTML
  let html = '';

  // Tweets section
  if (filteredBuilders.length > 0) {
    html += '<div class="mb-6"><h2 class="text-lg font-semibold mb-3 text-gray-700">Tweets</h2>';

    filteredBuilders.forEach(builder => {
      const substantiveTweets = builder.tweets.filter(t => t.isSubstantive);

      html += `
        <div class="builder-section mb-4 pl-3">
          <div class="flex items-center gap-2 mb-2">
            <span class="font-medium text-gray-800">${builder.name}</span>
            <span class="text-xs text-gray-500">@${builder.handle}</span>
            <span class="text-xs bg-gray-100 px-2 rounded">${substantiveTweets.length} posts</span>
          </div>
          ${renderTweets(builder.tweets)}
        </div>
      `;
    });

    html += '</div>';
  }

  // Podcasts section
  if (currentData.podcasts && currentData.podcasts.length > 0) {
    html += '<div class="mb-6"><h2 class="text-lg font-semibold mb-3 text-gray-700">Podcasts</h2>';
    currentData.podcasts.forEach(podcast => {
      html += renderPodcast(podcast);
    });
    html += '</div>';
  }

  // Blogs section
  if (currentData.blogs && currentData.blogs.length > 0) {
    html += '<div class="mb-6"><h2 class="text-lg font-semibold mb-3 text-gray-700">Blogs</h2>';
    currentData.blogs.forEach(blog => {
      html += renderBlog(blog);
    });
    html += '</div>';
  }

  if (!html) {
    html = '<div class="text-gray-500">No matching content found</div>';
  }

  container.innerHTML = html;
}

function renderTweets(tweets) {
  return tweets.map(tweet => `
    <div class="tweet-card bg-white rounded p-3 mb-2 border ${tweet.isSubstantive ? '' : 'opacity-60'}"
         data-tweet-id="${escapeHtmlAttr(tweet.id)}">
      <div class="flex justify-between">
        <p class="text-sm text-gray-700 flex-1">${escapeHtml(tweet.text)}</p>
        <button class="delete-tweet-btn text-red-400 hover:text-red-600 text-xs ml-2"
                data-id="${escapeHtmlAttr(tweet.id)}">×</button>
      </div>
      <a href="${sanitizeUrl(tweet.url)}" target="_blank" class="text-xs text-blue-500 hover:underline mt-1 block">
        View on X →
      </a>
      ${!tweet.isSubstantive ? '<span class="text-xs text-gray-400 mt-1 block">Filtered (low-value)</span>' : ''}
    </div>
  `).join('');
}

function renderPodcast(podcast) {
  const podcastId = escapeHtmlAttr(podcast.guid || podcast.url);
  return `
    <div class="podcast-card bg-white rounded p-4 mb-3 border"
         data-podcast-id="${podcastId}">
      <div class="flex justify-between items-start">
        <div class="flex-1">
          <h3 class="font-medium text-gray-800">${escapeHtml(podcast.name)}</h3>
          <p class="text-sm text-gray-600 mt-1">${escapeHtml(podcast.title)}</p>
        </div>
        <button class="delete-podcast-btn text-red-400 hover:text-red-600 text-xs ml-2"
                data-id="${podcastId}">×</button>
      </div>
      <a href="${sanitizeUrl(podcast.url)}" target="_blank" class="text-sm text-blue-500 hover:underline mt-2 block">
        Listen →
      </a>
      <details class="mt-2">
        <summary class="text-xs text-gray-500 cursor-pointer">Show transcript</summary>
        <div class="mt-2 text-xs text-gray-600 max-h-64 overflow-y-auto whitespace-pre-wrap">
          ${escapeHtml(podcast.transcript?.slice(0, 5000) || 'No transcript available')}...
        </div>
      </details>
    </div>
  `;
}

function renderBlog(blog) {
  const blogUrl = escapeHtmlAttr(blog.url);
  return `
    <div class="blog-card bg-white rounded p-4 mb-3 border"
         data-blog-url="${blogUrl}">
      <div class="flex justify-between items-start">
        <div class="flex-1">
          <h3 class="font-medium text-gray-800">${escapeHtml(blog.name || 'Blog')}</h3>
          <p class="text-sm text-gray-600 mt-1">${escapeHtml(blog.title)}</p>
        </div>
        <button class="delete-blog-btn text-red-400 hover:text-red-600 text-xs ml-2"
                data-url="${blogUrl}">×</button>
      </div>
      <a href="${sanitizeUrl(blog.url)}" target="_blank" class="text-sm text-blue-500 hover:underline mt-2 block">
        Read →
      </a>
    </div>
  `;
}

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g, '&amp;')
             .replace(/</g, '&lt;')
             .replace(/>/g, '&gt;')
             .replace(/"/g, '&quot;');
}

function escapeHtmlAttr(text) {
  if (!text) return '';
  // More aggressive escaping for data attributes - also escape single quotes
  return text.replace(/&/g, '&amp;')
             .replace(/</g, '&lt;')
             .replace(/>/g, '&gt;')
             .replace(/"/g, '&quot;')
             .replace(/'/g, '&#39;');
}

function sanitizeUrl(url) {
  if (!url) return '';
  // Only allow http/https URLs
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return url;
    }
  } catch {
    // Invalid URL
  }
  return '#';
}

// ============ Builder Filter and Search ============

function updateBuilderFilter() {
  const select = document.getElementById('builderFilter');

  select.innerHTML = '<option value="">All Builders</option>' +
    allBuilders.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
}

// Event listeners
document.getElementById('builderFilter').addEventListener('change', renderContent);
document.getElementById('searchInput').addEventListener('input', renderContent);

// ============ Delete Functionality ============

function deleteDay(date) {
  if (!confirm(`Delete all data for ${formatDate(date)}?`)) return;

  const dayData = allData.find(d => d.date === date);
  if (!dayData) return;

  allData = allData.filter(d => d.date !== date);

  const dateEl = document.querySelector(`.date-item[data-date="${date}"]`);
  if (dateEl) dateEl.remove();

  if (currentData?.date === date) {
    currentData = null;
    renderContent();
  }

  markForDeletion(date);
  console.log(`Marked ${date} for deletion`);
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

  currentData.podcasts = currentData.podcasts.filter(p =>
    (p.guid || p.url) !== identifier
  );

  renderContent();
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
  if (idx !== -1) {
    allData[idx] = currentData;
  }

  console.log(`Saved edits for ${currentData.date} to localStorage`);
}

// ============ Initialize ============

// Event delegation for dynamic elements
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
  if (deleteTweetBtn) {
    deleteTweet(deleteTweetBtn.dataset.id);
  }

  const deletePodcastBtn = e.target.closest('.delete-podcast-btn');
  if (deletePodcastBtn) {
    deletePodcast(deletePodcastBtn.dataset.id);
  }

  const deleteBlogBtn = e.target.closest('.delete-blog-btn');
  if (deleteBlogBtn) {
    deleteBlog(deleteBlogBtn.dataset.url);
  }
});

loadAllData();