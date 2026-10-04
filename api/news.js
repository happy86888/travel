// api/news.js — Vercel Serverless Function
// 後端代理 Google News RSS：免 API key、無額度限制，前端不再暴露任何 key。
// 前端呼叫 /api/news?topic=finance|global|taiwan|metalcomm|realestate|travel|market|health

const TOPICS = {
  finance:    { q: '台股 OR ETF OR 投資 OR 財經',        hl: 'zh-TW', gl: 'TW', ceid: 'TW:zh-Hant' },
  global:     { q: 'stock market OR Fed OR Wall Street', hl: 'en-US', gl: 'US', ceid: 'US:en' },
  taiwan:     { q: '台灣 股市 財經 ETF',                 hl: 'zh-TW', gl: 'TW', ceid: 'TW:zh-Hant' },
  metalcomm:  { q: 'gold price OR oil price',            hl: 'en-US', gl: 'US', ceid: 'US:en' },
  realestate: { q: 'real estate OR housing market',      hl: 'en-US', gl: 'US', ceid: 'US:en' },
  travel:     { q: '旅遊 OR 旅行 OR Japan travel',        hl: 'zh-TW', gl: 'TW', ceid: 'TW:zh-Hant' },
  market:     { q: 'S&P 500 OR Nasdaq OR 美股 OR 台股',   hl: 'zh-TW', gl: 'TW', ceid: 'TW:zh-Hant' },
  health:     { q: '健康 OR 養生 OR fitness wellness',    hl: 'zh-TW', gl: 'TW', ceid: 'TW:zh-Hant' },
  mind:       { q: '心靈 OR 冥想 OR 正念',               hl: 'zh-TW', gl: 'TW', ceid: 'TW:zh-Hant' },
  minden:     { q: 'mindfulness OR meditation OR mental wellness', hl: 'en-US', gl: 'US', ceid: 'US:en' },
};

function decodeEntities(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .trim();
}

function pick(body, tag) {
  const m = body.match(new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + tag + '>'));
  return m ? decodeEntities(m[1]) : '';
}

// 匯出以便單元測試
export function parseRSS(xml) {
  const items = [...String(xml || '').matchAll(/<item>([\s\S]*?)<\/item>/g)];
  const articles = [];
  for (const m of items.slice(0, 12)) {
    const body = m[1];
    const title = pick(body, 'title');
    const url = pick(body, 'link');
    if (!title || !url) continue;
    articles.push({
      title,
      url,
      publishedAt: pick(body, 'pubDate'),
      source: pick(body, 'source'),
    });
  }
  return articles;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { topic = 'finance' } = req.query || {};
  const cfg = TOPICS[topic] || TOPICS.finance;

  const url =
    'https://news.google.com/rss/search?q=' + encodeURIComponent(cfg.q) +
    '&hl=' + cfg.hl + '&gl=' + cfg.gl + '&ceid=' + cfg.ceid;

  try {
    const upstream = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; briankill-newsbot/1.0)' },
    });
    if (!upstream.ok) throw new Error('RSS upstream http ' + upstream.status);
    const xml = await upstream.text();
    const articles = parseRSS(xml);

    // 快取 1 小時，同一小時內的請求直接從 Vercel Edge 回傳
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
    return res.status(200).json({ articles });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'RSS fetch failed' });
  }
}
