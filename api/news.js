// api/news.js — Vercel Serverless Function
// 部署後前端呼叫 /api/news?topic=finance，這裡幫你向 NewsAPI 拿資料再回傳
// Key 存在 Vercel 環境變數，不會曝露給使用者

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { topic = 'all' } = req.query;
  const API_KEY = process.env.NEWS_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: 'API key not configured in Vercel environment variables.' });
  }

  const QUERIES = {
    all:     'ETF 指數投資 OR 股市 OR 旅遊 旅行',
    finance: 'ETF 指數投資 OR 高股息 OR 基金 台灣',
    travel:  '旅遊 旅行 OR Japan travel OR Bali OR Bangkok',
    market:  'S&P 500 OR Nasdaq OR Federal Reserve OR 美股 OR 台股',
  };

  const q = QUERIES[topic] || QUERIES.all;

  try {
    const url = `https://newsapi.org/v2/everything?` +
      `q=${encodeURIComponent(q)}` +
      `&sortBy=publishedAt` +
      `&pageSize=10` +
      `&apiKey=${API_KEY}`;

    const upstream = await fetch(url);
    const data = await upstream.json();

    if (data.status !== 'ok') {
      return res.status(500).json({ error: data.message || 'NewsAPI error' });
    }

    const articles = (data.articles || [])
      .filter(a => a.title && a.title !== '[Removed]' && a.url)
      .map(a => ({
        title:       a.title,
        excerpt:     a.description || '',
        url:         a.url,
        image:       a.urlToImage || '',
        source:      a.source?.name || '',
        publishedAt: a.publishedAt,
      }));

    // 快取 1 小時，同一小時內的請求直接從 Vercel Edge 回傳，不耗用 API 額度
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
    return res.status(200).json({ articles });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
