/* === بيولوجيا الفجوات — RSS Feed Logic === */

const RSS2JSON = 'https://api.rss2json.com/v1/api.json?rss_url=';

const FEEDS = [
  'https://www.sciencealert.com/feed',
  'https://www.livescience.com/feeds/all',
  'https://phys.org/rss-feed/',
  'https://www.sciencedaily.com/rss/all.xml',
  'https://arstechnica.com/science/feed/'
];

// STRONG patterns: phrases that almost certainly indicate a correction/revision
// An article MUST match at least one of these to qualify
const STRONG = [
  'than we thought', 'than previously thought', 'than scientists thought',
  'than believed', 'than expected', 'than assumed', 'than we assumed',
  'we were wrong', 'scientists were wrong', 'been wrong about',
  'overturns', 'overturn', 'upends', 'rewrites', 'rewriting',
  'debunks', 'debunked', 'misconception', 'long-held belief',
  'conventional wisdom', 'challenges the idea', 'not what we thought',
  'turns out', 'it turns out', 'actually wasn',
  'previously thought', 'previously believed', 'previously assumed',
  'older than', 'earlier than', 'younger than',
  'rethink', 'rethinking', 'forces scientists to reconsider',
  'contradicts', 'disproves', 'calls into question',
  'changes everything we know', 'changes what we know',
  'weren\'t what we thought', 'isn\'t what we thought',
  'wrong for decades', 'wrong for years', 'incorrect for',
  'pushes back the origin', 'pushes back the date',
  'rewrite the textbook', 'rewriting the textbook',
  'shatter', 'shatters'
];

// BONUS patterns: add extra score if the correction is in paleo/evo/archaeology
const BONUS = [
  'fossil', 'evolution', 'evolutionary', 'paleontolog', 'archaeolog',
  'ancient', 'prehistor', 'million year', 'billion year',
  'species', 'ancestor', 'extinct', 'origin of', 'human evolution',
  'stone age', 'dinosaur', 'genome', 'dna reveal'
];

function stripHtml(s) {
  if (!s) return '';
  return s.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ').trim();
}

function matchesKeywords(title, desc) {
  const text = (title + ' ' + desc).toLowerCase();
  // Must match at least one STRONG pattern — otherwise reject entirely
  let strongHits = 0;
  for (const kw of STRONG) {
    if (text.includes(kw)) strongHits++;
  }
  if (strongHits === 0) return 0;
  // Bonus points for paleo/evo/archaeology context
  let bonus = 0;
  for (const kw of BONUS) {
    if (text.includes(kw)) bonus++;
  }
  return strongHits * 10 + bonus;
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const diff = (Date.now() - d) / 1000;
    if (diff < 0 || isNaN(diff)) return '';
    if (diff < 3600) return Math.floor(diff / 60) + ' min';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd';
    return d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

function extractDomain(url) {
  try { return new URL(url).hostname.replace('www.', ''); } catch { return ''; }
}

async function fetchFeed(feedUrl) {
  try {
    const res = await fetch(RSS2JSON + encodeURIComponent(feedUrl));
    if (!res.ok) return [];
    const data = await res.json();
    if (data.status !== 'ok' || !data.items) return [];
    return data.items.map(item => ({
      title: stripHtml(item.title) || '',
      url: item.link || feedUrl,
      snippet: stripHtml(item.description || item.content || '').substring(0, 300),
      date: item.pubDate || '',
      domain: data.feed?.title || extractDomain(item.link || feedUrl)
    }));
  } catch { return []; }
}

function renderItem(item) {
  const date = timeAgo(item.date);
  return `<div class="feed-item">
    <div class="fi-source">${item.domain}</div>
    <div class="fi-title"><a href="${item.url}" target="_blank" rel="noopener">${item.title}</a></div>
    ${item.snippet ? `<div class="fi-snippet">${item.snippet.substring(0, 200)}</div>` : ''}
    ${date ? `<div class="fi-date">${date}</div>` : ''}
  </div>`;
}

async function loadFeed() {
  const btn = document.getElementById('refreshBtn');
  const area = document.getElementById('feedArea');
  const countEl = document.getElementById('feedCount');

  btn.disabled = true;
  btn.textContent = 'جاري البحث...';
  area.innerHTML = '<div class="loading"><div class="spinner"></div>جاري البحث في المصادر العلمية...</div>';

  // Fetch all feeds in parallel
  const results = await Promise.allSettled(FEEDS.map(f => fetchFeed(f)));
  let allItems = [];
  for (const r of results) {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      allItems.push(...r.value);
    }
  }

  // Score and filter by keyword relevance
  const scored = allItems.map(item => ({
    ...item,
    score: matchesKeywords(item.title, item.snippet)
  }));

  // Sort by score descending, then by date
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return new Date(b.date || 0) - new Date(a.date || 0);
  });

  // Take top items with score > 0, max 5
  const filtered = scored.filter(i => i.score > 0).slice(0, 5);

  if (filtered.length === 0) {
    area.innerHTML = '<div class="empty">لم يُعثر على تصحيحات علمية جديدة هذه المرة — جرّب التحديث لاحقًا</div>';
  } else {
    area.innerHTML = filtered.map(renderItem).join('');
  }

  btn.disabled = false;
  btn.textContent = 'تحديث';
}

// Load on page open
loadFeed();
