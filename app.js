// AI Builders Digest Viewer

const DATA_DIR = 'data';
const VIDEOS_DIR = 'videos';

let allData = [];
let currentData = null;
let allBuilders = [];
let allVideos = [];
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

  // Load videos
  loadAllVideos();
}

async function loadAllVideos() {
  try {
    // Load video index
    const response = await fetch(`${VIDEOS_DIR}/index.json`);
    if (response.ok) {
      const index = await response.json();
      const videoPromises = [];

      for (const video of index.videos || []) {
        // Support both old format (string) and new format (object)
        const videoFile = typeof video === 'string'
          ? video
          : video.file;

        videoPromises.push(
          fetch(`${VIDEOS_DIR}/${videoFile}`)
            .then(r => r.ok ? r.json() : null)
            .catch(() => null)
        );
      }

      const results = await Promise.all(videoPromises);
      allVideos = results.filter(v => v !== null).sort((a, b) =>
        new Date(b.fetchedAt) - new Date(a.fetchedAt)
      );
    }

    renderVideos();
    updateCountBadges();
  } catch (err) {
    console.error('Error loading videos:', err);
    renderVideos();
  }
}

async function loadVideoFiles(date) {
  const videos = [];
  try {
    // Load video index
    const response = await fetch(`${VIDEOS_DIR}/index.json`);
    if (response.ok) {
      const index = await response.json();
      for (const video of index.videos || []) {
        // Support both old format (string) and new format (object)
        const videoFile = typeof video === 'string'
          ? `${date}-${video}.json`
          : video.file;

        const videoResponse = await fetch(`${VIDEOS_DIR}/${videoFile}`);
        if (videoResponse.ok) {
          videos.push(await videoResponse.json());
        }
      }
    }
  } catch {
    // No index file or error loading videos
  }
  return videos;
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
    container.innerHTML = '<div class="p-4"><h2 class="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">History</h2></div><div class="px-2 text-sm text-slate-400">No data available</div>';
    return;
  }

  let html = '<div class="p-4"><h2 class="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">History</h2></div>';

  html += allData.map(day => {
    const tweetCount = day.tweets.reduce((sum, b) => sum + b.tweets.length, 0);
    const substantiveCount = day.stats?.tweetsFiltered || tweetCount;
    const podcastCount = day.stats?.podcastsCount || 0;
    const isActive = currentData?.date === day.date;

    return `
      <div class="date-item px-4 py-3 mx-2 rounded-xl cursor-pointer flex justify-between items-center group mb-1 ${isActive ? 'active' : ''}"
           data-date="${escapeHtmlAttr(day.date)}">
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-sm text-slate-700 dark:text-slate-200">${formatDate(day.date)}</div>
          <div class="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
            <span>${substantiveCount} posts</span>
            ${podcastCount > 0 ? `<span class="text-purple-500 font-medium">${podcastCount} podcast${podcastCount > 1 ? 's' : ''}</span>` : ''}
          </div>
        </div>
        <button class="delete-day-btn opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
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

  updateCountBadges();
  renderContent();
  renderPodcasts();
}

// ============ Content Rendering ============

function renderContent() {
  const container = document.getElementById('tweetsContent');

  if (!currentData) {
    container.innerHTML = '<div class="text-slate-400 text-center py-20">Select a date to view content</div>';
    updateCountBadges();
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

  let html = '<div class="p-8">';

  // Page header
  html += `
    <div class="mb-8">
      <h2 class="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">${formatDate(currentData.date)}</h2>
      <p class="text-slate-500 dark:text-slate-400 mt-1">${totalTweets} posts from ${filteredBuilders.length} builders</p>
    </div>
  `;

  // Tweets - Two column grid
  if (filteredBuilders.length > 0) {
    filteredBuilders.forEach(builder => {
      html += renderBuilder(builder);
    });
  }

  // Blogs in main content
  if (currentData.blogs && currentData.blogs.length > 0) {
    html += `
      <div class="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800">
        <h3 class="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
          <div class="w-8 h-8 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg flex items-center justify-center">
            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"/>
            </svg>
          </div>
          Blog Posts
        </h3>
        <div class="tweets-grid">
          ${currentData.blogs.map(blog => renderBlog(blog)).join('')}
        </div>
      </div>
    `;
  }

  if (filteredBuilders.length === 0) {
    html += '<div class="text-slate-400 text-center py-20">No matching content found</div>';
  }

  html += '</div>';
  container.innerHTML = html;
}

function renderPodcasts() {
  const container = document.getElementById('podcastsContent');

  if (!currentData || !currentData.podcasts || currentData.podcasts.length === 0) {
    container.innerHTML = '<div class="text-slate-400 text-center py-20">No podcasts available</div>';
    updateCountBadges();
    return;
  }

  updateCountBadges();
  container.innerHTML = currentData.podcasts.map((podcast, index) => renderFullPodcast(podcast, index)).join('');
}

function renderVideos() {
  const container = document.getElementById('videosContent');

  if (!allVideos || allVideos.length === 0) {
    container.innerHTML = '<div class="text-slate-400 text-center py-20">No videos available. Use "帮我总结这个视频：URL" to add videos.</div>';
    updateCountBadges();
    return;
  }

  updateCountBadges();
  container.innerHTML = allVideos.map(video => renderVideoCard(video)).join('');
}

function renderVideoCard(video) {
  const hasSummary = video.summary && Object.keys(video.summary).length > 0;
  const duration = formatVideoDuration(video.duration || 0);

  if (!hasSummary) {
    return `
      <article class="video-card rounded-3xl overflow-hidden transition-all duration-300 mb-6">
        <div class="p-6 lg:p-8">
          <div class="flex flex-col lg:flex-row lg:items-start gap-6">
            <a href="${sanitizeUrl(video.url)}" target="_blank"
               class="video-button w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform">
              <svg class="w-7 h-7 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </a>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-3 mb-2">
                <span class="px-3 py-1 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-300 text-xs font-semibold rounded-full">
                  ${escapeHtml(video.channel || 'YouTube')}
                </span>
                <span class="text-xs text-slate-400">${duration}</span>
              </div>
              <h2 class="text-xl lg:text-2xl font-bold text-slate-800 dark:text-white leading-tight">
                ${escapeHtml(video.title)}
              </h2>
              <a href="${sanitizeUrl(video.url)}" target="_blank"
                 class="inline-flex items-center gap-2 mt-4 text-sm font-semibold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                </svg>
                Watch on YouTube
              </a>
            </div>
          </div>
        </div>
      </article>
    `;
  }

  const summary = video.summary;
  return `
    <article class="video-card rounded-3xl overflow-hidden transition-all duration-300 mb-6">
      <!-- Header -->
      <div class="p-6 lg:p-8">
        <div class="flex flex-col lg:flex-row lg:items-start gap-6">
          <a href="${sanitizeUrl(video.url)}" target="_blank"
             class="video-button w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform">
            <svg class="w-7 h-7 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </a>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-3 mb-2 flex-wrap">
              <span class="px-3 py-1 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-300 text-xs font-semibold rounded-full">
                ${escapeHtml(video.channel || 'YouTube')}
              </span>
              <span class="px-3 py-1 bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-300 text-xs font-semibold rounded-full">
                AI Summary
              </span>
              <span class="text-xs text-slate-400">${duration}</span>
            </div>
            <h2 class="text-xl lg:text-2xl font-bold text-slate-800 dark:text-white leading-tight">
              ${escapeHtml(video.title)}
            </h2>
            <a href="${sanitizeUrl(video.url)}" target="_blank"
               class="inline-flex items-center gap-2 mt-4 text-sm font-semibold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
              </svg>
              Watch on YouTube
            </a>
          </div>
        </div>
      </div>

      <!-- Summary Content -->
      <div class="border-t border-red-100 dark:border-red-900/30 bg-white/50 dark:bg-slate-900/50">
        <div class="p-6 lg:p-8 space-y-8">
          <!-- Core Topics -->
          <div>
            <h3 class="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              Overview
            </h3>
            <p class="text-slate-600 dark:text-slate-300 leading-relaxed">${escapeHtml(summary.coreTopics)}</p>
          </div>

          <!-- Key Points -->
          ${summary.keyPoints && summary.keyPoints.length > 0 ? `
            <div>
              <h3 class="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-4 flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
                </svg>
                Key Points
              </h3>
              <div class="space-y-4">
                ${summary.keyPoints.map(kp => `
                  <div class="gradient-border bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                    <div class="font-semibold text-slate-700 dark:text-slate-200">${escapeHtml(kp.point)}</div>
                    <div class="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">${escapeHtml(kp.detail)}</div>
                    ${kp.chapter ? `<div class="text-xs text-red-500 dark:text-red-400 mt-2">📍 ${escapeHtml(kp.chapter)}</div>` : ''}
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Highlights -->
          ${summary.highlights && summary.highlights.length > 0 ? `
            <div>
              <h3 class="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-4 flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
                </svg>
                Highlights
              </h3>
              <div class="space-y-4">
                ${summary.highlights.map(h => `
                  <div class="border-l-4 border-red-400 dark:border-red-500 bg-slate-50 dark:bg-slate-800/50 rounded-r-xl p-4">
                    <div class="flex items-center gap-2 mb-2">
                      <span class="text-xs font-mono text-red-500 dark:text-red-400">${escapeHtml(h.timestamp)}</span>
                    </div>
                    <p class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">${escapeHtml(h.summary)}</p>
                    ${h.quote ? `
                      <blockquote class="mt-3 pl-4 border-l-2 border-slate-300 dark:border-slate-600 text-sm text-slate-500 dark:text-slate-400 italic">
                        "${escapeHtml(h.quote)}"
                      </blockquote>
                    ` : ''}
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Resources -->
          ${summary.resources && summary.resources.length > 0 ? `
            <div>
              <h3 class="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-4 flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                </svg>
                Resources Mentioned
              </h3>
              <div class="grid gap-3">
                ${summary.resources.map(r => `
                  <div class="flex items-start gap-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                    <span class="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-300 text-xs font-medium rounded capitalize flex-shrink-0">${escapeHtml(r.type)}</span>
                    <div class="flex-1 min-w-0">
                      <div class="font-medium text-slate-700 dark:text-slate-200">${escapeHtml(r.title)}</div>
                      ${r.author ? `<div class="text-xs text-slate-400 mt-0.5">${escapeHtml(r.author)}</div>` : ''}
                      ${r.context ? `<div class="text-sm text-slate-500 dark:text-slate-400 mt-1">${escapeHtml(r.context)}</div>` : ''}
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Takeaways -->
          ${summary.takeaways && summary.takeaways.length > 0 ? `
            <div>
              <h3 class="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-4 flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 23v-4m-2 2h4m5-16v4m-2-2h4m5 5v4m-2-2h4M7.5 11l2.5 2.5L16.5 7"/>
                </svg>
                Key Takeaways
              </h3>
              <div class="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 rounded-xl p-4">
                <ul class="space-y-3">
                  ${summary.takeaways.map(t => `
                    <li class="flex items-start gap-2">
                      <svg class="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                      <span class="text-slate-600 dark:text-slate-300 leading-relaxed">${escapeHtml(t)}</span>
                    </li>
                  `).join('')}
                </ul>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    </article>
  `;
}

function formatVideoDuration(seconds) {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function renderFullPodcast(podcast, index) {
  const hasSummary = podcast.summary && Object.keys(podcast.summary).length > 0;
  const transcript = podcast.transcript || 'No transcript available';
  const formattedTranscript = formatTranscript(transcript);

  if (hasSummary) {
    return renderPodcastSummary(podcast, formattedTranscript);
  }

  return `
    <article class="podcast-card rounded-3xl overflow-hidden transition-all duration-300">
      <div class="p-6 lg:p-8">
        <div class="flex flex-col lg:flex-row lg:items-start gap-6">
          <div class="flex items-start gap-5 flex-1">
            <a href="${sanitizeUrl(podcast.url)}" target="_blank"
               class="play-button w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform">
              <svg class="w-7 h-7 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </a>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-3 mb-2">
                <span class="px-3 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 text-xs font-semibold rounded-full">
                  ${escapeHtml(podcast.name)}
                </span>
              </div>
              <h2 class="text-xl lg:text-2xl font-bold text-slate-800 dark:text-white leading-tight">
                ${escapeHtml(podcast.title)}
              </h2>
              <a href="${sanitizeUrl(podcast.url)}" target="_blank"
                 class="inline-flex items-center gap-2 mt-4 text-sm font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                </svg>
                Listen on YouTube
              </a>
            </div>
          </div>
        </div>
      </div>

      <div class="border-t border-purple-100 dark:border-purple-900/30 bg-white/50 dark:bg-slate-900/50">
        <div class="p-6 lg:p-8">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              Transcript
            </h3>
          </div>
          <div class="gradient-border bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 lg:p-6">
            <div class="transcript-text text-slate-600 dark:text-slate-300">
              ${formattedTranscript}
            </div>
          </div>
        </div>
      </div>
    </article>
  `;
}

function renderPodcastSummary(podcast, formattedTranscript) {
  const summary = podcast.summary;
  const podcastId = escapeHtmlAttr(podcast.guid || podcast.url);

  return `
    <article class="podcast-card rounded-3xl overflow-hidden transition-all duration-300">
      <!-- Header -->
      <div class="p-6 lg:p-8">
        <div class="flex flex-col lg:flex-row lg:items-start gap-6">
          <div class="flex items-start gap-5 flex-1">
            <a href="${sanitizeUrl(podcast.url)}" target="_blank"
               class="play-button w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform">
              <svg class="w-7 h-7 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </a>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-3 mb-2">
                <span class="px-3 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 text-xs font-semibold rounded-full">
                  ${escapeHtml(podcast.name)}
                </span>
                <span class="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300 text-xs font-semibold rounded-full">
                  AI Summary
                </span>
              </div>
              <h2 class="text-xl lg:text-2xl font-bold text-slate-800 dark:text-white leading-tight">
                ${escapeHtml(podcast.title)}
              </h2>
              <a href="${sanitizeUrl(podcast.url)}" target="_blank"
                 class="inline-flex items-center gap-2 mt-4 text-sm font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                </svg>
                Listen on YouTube
              </a>
            </div>
          </div>
        </div>
      </div>

      <!-- Summary Content -->
      <div class="border-t border-purple-100 dark:border-purple-900/30 bg-white/50 dark:bg-slate-900/50">
        <div class="p-6 lg:p-8 space-y-8">
          <!-- Core Topics -->
          <div>
            <h3 class="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              Overview
            </h3>
            <p class="text-slate-600 dark:text-slate-300 leading-relaxed">${escapeHtml(summary.coreTopics)}</p>
          </div>

          <!-- Key Points -->
          ${summary.keyPoints && summary.keyPoints.length > 0 ? `
            <div>
              <h3 class="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-4 flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
                </svg>
                Key Points
              </h3>
              <div class="space-y-4">
                ${summary.keyPoints.map(kp => `
                  <div class="gradient-border bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                    <div class="font-semibold text-slate-700 dark:text-slate-200">${escapeHtml(kp.point)}</div>
                    <div class="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">${escapeHtml(kp.detail)}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Resources -->
          ${summary.resources && summary.resources.length > 0 ? `
            <div>
              <h3 class="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-4 flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                </svg>
                Resources Mentioned
              </h3>
              <div class="grid gap-3">
                ${summary.resources.map(r => `
                  <div class="flex items-start gap-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                    <span class="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 text-xs font-medium rounded capitalize flex-shrink-0">${escapeHtml(r.type)}</span>
                    <div class="flex-1 min-w-0">
                      <div class="font-medium text-slate-700 dark:text-slate-200">${escapeHtml(r.title)}</div>
                      ${r.author ? `<div class="text-xs text-slate-400 mt-0.5">${escapeHtml(r.author)}</div>` : ''}
                      ${r.context ? `<div class="text-sm text-slate-500 dark:text-slate-400 mt-1">${escapeHtml(r.context)}</div>` : ''}
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Highlights -->
          ${summary.highlights && summary.highlights.length > 0 ? `
            <div>
              <h3 class="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-4 flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
                </svg>
                Highlights
              </h3>
              <div class="space-y-4">
                ${summary.highlights.map(h => `
                  <div class="border-l-4 border-purple-400 dark:border-purple-500 bg-slate-50 dark:bg-slate-800/50 rounded-r-xl p-4">
                    <div class="flex items-center gap-2 mb-2">
                      <span class="text-xs font-mono text-purple-500 dark:text-purple-400">${escapeHtml(h.timestamp)}</span>
                      ${h.speaker ? `<span class="text-xs font-semibold text-slate-500 dark:text-slate-400">${escapeHtml(h.speaker)}</span>` : ''}
                    </div>
                    <p class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">${escapeHtml(h.summary)}</p>
                    ${h.quote ? `
                      <blockquote class="mt-3 pl-4 border-l-2 border-slate-300 dark:border-slate-600 text-sm text-slate-500 dark:text-slate-400 italic">
                        "${escapeHtml(h.quote)}"
                      </blockquote>
                    ` : ''}
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Takeaways -->
          ${summary.takeaways && summary.takeaways.length > 0 ? `
            <div>
              <h3 class="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-4 flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 23v-4m-2 2h4m5-16v4m-2-2h4m5 5v4m-2-2h4M7.5 11l2.5 2.5L16.5 7"/>
                </svg>
                Key Takeaways
              </h3>
              <div class="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-4">
                <ul class="space-y-3">
                  ${summary.takeaways.map(t => `
                    <li class="flex items-start gap-2">
                      <svg class="w-5 h-5 text-purple-500 dark:text-purple-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                      <span class="text-slate-600 dark:text-slate-300 leading-relaxed">${escapeHtml(t)}</span>
                    </li>
                  `).join('')}
                </ul>
              </div>
            </div>
          ` : ''}

          <!-- Full Transcript Toggle -->
          <details class="group">
            <summary class="cursor-pointer text-sm font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 flex items-center gap-2 py-2">
              <svg class="w-4 h-4 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
              </svg>
              View Full Transcript
            </summary>
            <div class="mt-4 gradient-border bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 lg:p-6">
              <div class="transcript-text text-slate-600 dark:text-slate-300">
                ${formattedTranscript}
              </div>
            </div>
          </details>
        </div>
      </div>
    </article>
  `;
}

function formatTranscript(transcript) {
  if (!transcript) return 'No transcript available';

  let formatted = escapeHtml(transcript);

  formatted = formatted.replace(/(Speaker \d+)\s*\|\s*(\d{2}:\d{2}:\d{2})\s*-\s*(\d{2}:\d{2}:\d{2})/g,
    '<div class="mt-4 mb-2 flex items-center gap-3"><span class="speaker-label">$1</span><span class="timestamp">$2 - $3</span></div>');

  formatted = formatted.replace(/(Speaker \d+)\s*\|\s*(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/g,
    '<div class="mt-4 mb-2 flex items-center gap-3"><span class="speaker-label">$1</span><span class="timestamp">$2 - $3</span></div>');

  return formatted;
}

function renderBuilder(builder) {
  const substantiveTweets = builder.tweets.filter(t => t.isSubstantive);
  const lowValueTweets = builder.tweets.filter(t => !t.isSubstantive);
  const initials = builder.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  let html = `
    <div class="mb-10">
      <!-- Builder Header -->
      <div class="builder-header flex items-center gap-4 mb-5 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div class="builder-avatar">${initials}</div>
        <div class="flex-1">
          <div class="font-bold text-lg text-slate-800 dark:text-white">${escapeHtml(builder.name)}</div>
          <div class="text-sm text-slate-400 font-medium">@${escapeHtml(builder.handle)}</div>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-2xl font-bold gradient-text">${substantiveTweets.length}</span>
          <span class="text-xs text-slate-400 uppercase tracking-wide">posts</span>
        </div>
      </div>

      <!-- Tweets Grid -->
      <div class="tweets-grid">
        ${substantiveTweets.map(tweet => renderTweet(tweet, true)).join('')}
      </div>
  `;

  if (lowValueTweets.length > 0) {
    html += `
      <details class="mt-4 ml-1">
        <summary class="text-xs text-slate-400 cursor-pointer hover:text-slate-500 select-none font-medium">
          +${lowValueTweets.length} filtered (low-value)
        </summary>
        <div class="mt-3 tweets-grid opacity-50">
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
  const isLong = tweet.text.length > 250;

  return `
    <div class="card bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800"
         data-tweet-id="${escapeHtmlAttr(tweet.id)}">
      <div class="flex gap-3">
        <div class="flex-1 min-w-0">
          <p class="tweet-text text-slate-600 dark:text-slate-300 ${isLong ? 'line-clamp-4' : ''}" id="tweet-${escapeHtmlAttr(tweet.id)}">
            ${text}
          </p>
          ${isLong ? `
            <button class="text-purple-500 hover:text-purple-600 text-xs mt-2 font-medium flex items-center gap-1" onclick="toggleExpand('${escapeHtmlAttr(tweet.id)}')">
              <span class="expand-text">Read more</span>
              <svg class="w-3 h-3 expand-icon transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
              </svg>
            </button>
          ` : ''}
          <div class="mt-3 pt-3 border-t border-slate-50 dark:border-slate-800">
            <a href="${sanitizeUrl(tweet.url)}" target="_blank"
               class="text-xs text-slate-400 hover:text-purple-500 flex items-center gap-1.5 transition-colors font-medium">
              <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
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


function renderBlog(blog) {
  const blogUrl = escapeHtmlAttr(blog.url);
  return `
    <div class="card bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800"
         data-blog-url="${blogUrl}">
      <div class="flex items-start gap-4">
        <div class="w-12 h-12 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/20">
          <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"/>
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <h3 class="font-bold text-slate-800 dark:text-white">${escapeHtml(blog.name || 'Blog')}</h3>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">${escapeHtml(blog.title)}</p>
          <a href="${sanitizeUrl(blog.url)}" target="_blank"
             class="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700">
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

  if (tweetEl.classList.contains('line-clamp-4')) {
    tweetEl.classList.remove('line-clamp-4');
    textSpan.textContent = 'Show less';
    icon.style.transform = 'rotate(180deg)';
  } else {
    tweetEl.classList.add('line-clamp-4');
    textSpan.textContent = 'Read more';
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

// ============ Tab Navigation ============

let activeTab = 'tweets';

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab === activeTab) return;

      // Update button states
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Update content visibility
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      document.getElementById(`${tab}Tab`).classList.add('active');

      activeTab = tab;

      // Toggle search/filter visibility
      const searchInput = document.getElementById('searchInput');
      const builderFilter = document.getElementById('builderFilter');
      if (tab === 'podcasts' || tab === 'videos') {
        searchInput.style.opacity = '0.5';
        searchInput.disabled = true;
        builderFilter.style.opacity = '0.5';
        builderFilter.disabled = true;
      } else {
        searchInput.style.opacity = '1';
        searchInput.disabled = false;
        builderFilter.style.opacity = '1';
        builderFilter.disabled = false;
      }
    });
  });
}

function updateCountBadges() {
  if (!currentData) {
    document.getElementById('tweetCountBadge').textContent = '0';
    document.getElementById('podcastCountBadge').classList.add('hidden');
    document.getElementById('videoCountBadge').classList.add('hidden');
    return;
  }

  const tweetCount = currentData.tweets.reduce((sum, b) => sum + b.tweets.filter(t => t.isSubstantive).length, 0);
  document.getElementById('tweetCountBadge').textContent = tweetCount;

  const podcastCount = currentData.podcasts?.length || 0;
  const podcastBadge = document.getElementById('podcastCountBadge');
  if (podcastCount > 0) {
    podcastBadge.textContent = podcastCount;
    podcastBadge.classList.remove('hidden');
  } else {
    podcastBadge.classList.add('hidden');
  }

  const videoCount = allVideos.length;
  const videoBadge = document.getElementById('videoCountBadge');
  if (videoCount > 0) {
    videoBadge.textContent = videoCount;
    videoBadge.classList.remove('hidden');
  } else {
    videoBadge.classList.add('hidden');
  }
}

// ============ Initialize ============

initDarkMode();
initTabs();

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

document.getElementById('tweetsContent').addEventListener('click', (e) => {
  const deleteTweetBtn = e.target.closest('.delete-tweet-btn');
  if (deleteTweetBtn) deleteTweet(deleteTweetBtn.dataset.id);

  const deleteBlogBtn = e.target.closest('.delete-blog-btn');
  if (deleteBlogBtn) deleteBlog(deleteBlogBtn.dataset.url);
});

document.getElementById('podcastsContent').addEventListener('click', (e) => {
  const deletePodcastBtn = e.target.closest('.delete-podcast-btn');
  if (deletePodcastBtn) deletePodcast(deletePodcastBtn.dataset.id);
});

loadAllData();