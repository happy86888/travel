// scripts/fetch-news.mjs — GitHub Actions 每小時執行：抓 Google News RSS → 輸出 news/*.json
// 純靜態站（GitHub Pages）的新聞方案：前端直接讀同源 JSON，無 CORS、無 API key。
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'news');

const TOPICS = {
  finance:    { q: '台股 OR ETF OR 投資 OR 財經',        hl: 'zh-TW', gl: 'TW', ceid: 'TW:zh-Hant' },
  global:     { q: 'stock market OR Fed OR Wall Street', hl: 'en-US', gl: 'US', ceid: 'US:en' },
  taiwan:     { q: '台灣 股市 財經 ETF',                 hl: 'zh-TW', gl: 'TW', ceid: 'TW:zh-Hant' },
  metalcomm:  { q: 'gold price OR oil price',            hl: 'en-US', gl: 'US', ceid: 'US:en' },
  realestate: { q: 'real estate OR housing market',      hl: 'en-US', gl: 'US', ceid: 'US:en' },
  travel:     { q: '旅遊 OR 旅行 OR Japan travel',        hl: 'zh-TW', gl: 'TW', ceid: 'TW:zh-Hant' },
  market:     { q: 'S&P 500 OR Nasdaq OR 美股 OR 台股',   hl: 'zh-TW', gl: 'TW', ceid: 'TW:zh-Hant' },
  health:     { q: '健康 OR 養生 OR fitness wellness',    hl: 'zh-TW', gl: 'TW', ceid: 'TW:zh-Hant' },
};

function decodeEntities(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'")
    .trim();
}
function pick(body, tag) {
  const m = body.match(new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + tag + '>'));
  return m ? decodeEntities(m[1]) : '';
}
function parseRSS(xml) {
  const items = [...String(xml || '').matchAll(/<item>([\s\S]*?)<\/item>/g)];
  const articles = [];
  for (const m of items.slice(0, 12)) {
    const body = m[1];
    const title = pick(body, 'title');
    const url = pick(body, 'link');
    if (!title || !url) continue;
    articles.push({ title, url, publishedAt: pick(body, 'pubDate'), source: pick(body, 'source') });
  }
  return articles;
}

mkdirSync(OUT, { recursive: true });
const summary = {};
for (const [topic, cfg] of Object.entries(TOPICS)) {
  const url = 'https://news.google.com/rss/search?q=' + encodeURIComponent(cfg.q) +
    '&hl=' + cfg.hl + '&gl=' + cfg.gl + '&ceid=' + cfg.ceid;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; briankill-newsbot/1.0)' } });
    if (!r.ok) throw new Error('http ' + r.status);
    const articles = parseRSS(await r.text());
    writeFileSync(join(OUT, topic + '.json'),
      JSON.stringify({ updatedAt: new Date().toISOString(), articles }, null, 1) + '\n');
    summary[topic] = articles.length;
  } catch (e) {
    summary[topic] = 'ERROR: ' + e.message;
  }
}
console.log(JSON.stringify(summary, null, 1));
