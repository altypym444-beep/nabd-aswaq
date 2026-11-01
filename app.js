
(() => {
  const TZ = 'Asia/Riyadh';
  const $ = (id) => document.getElementById(id);
  const fmtNum = (n, d = 2) => (n == null || Number.isNaN(Number(n))) ? '—' : Number(n).toLocaleString('ar-SA', { maximumFractionDigits: d, minimumFractionDigits: Math.min(d, 2) });
  const fmtBig = (n) => {
    if (n == null || Number.isNaN(n)) return '—';
    const v = Number(n);
    if (v >= 1e12) return (v / 1e12).toFixed(2) + ' تريليون $';
    if (v >= 1e9) return (v / 1e9).toFixed(2) + ' مليار $';
    return fmtNum(v, 0) + ' $';
  };
  const chgClass = (p) => (Number(p) > 0 ? 'up' : Number(p) < 0 ? 'down' : 'flat');
  const chgText = (p) => (p == null || Number.isNaN(Number(p))) ? '—' : `${Number(p) > 0 ? '▲' : Number(p) < 0 ? '▼' : '•'} ${Math.abs(Number(p)).toFixed(2)}%`;
  const riyadh = (iso) => {
    try {
      return new Intl.DateTimeFormat('ar-SA', {
        timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      }).format(new Date(typeof iso === 'number' && iso < 1e12 ? iso * 1000 : iso));
    } catch { return String(iso || '—'); }
  };
  const clockNow = () => new Intl.DateTimeFormat('ar-SA', {
    timeZone: TZ, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).format(new Date());

  async function loadJson(url) {
    const r = await fetch(url + (url.includes('?') ? '&' : '?') + '_=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error(url + ' ' + r.status);
    return r.json();
  }

  const state = {
    oil: null, gold: null, spx: null, ndx: null, aapl: null, msft: null,
    btc: null, eth: null, paxg: null, fx: null,
    ws: { btc: false, gold: false }
  };
  const charts = {};
  const sparkHist = { oil: [], gold: [], btc: [], spx: [] };

  function spark(canvasId, values, color) {
    const ctx = $(canvasId);
    if (!ctx || !window.Chart) return;
    const labels = values.map((_, i) => String(i + 1));
    if (charts[canvasId]) {
      charts[canvasId].data.labels = labels;
      charts[canvasId].data.datasets[0].data = values;
      charts[canvasId].update('none');
      return;
    }
    charts[canvasId] = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [{ data: values, borderColor: color, backgroundColor: color + '33', fill: true, tension: 0.35, pointRadius: 0, borderWidth: 2 }] },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { display: false } },
        scales: { x: { display: false }, y: { ticks: { color: '#8aa0c6', font: { size: 9 }, maxTicksLimit: 4 }, grid: { color: 'rgba(255,255,255,.05)' } } }
      }
    });
  }

  function pushHist(key, price, max = 60) {
    if (price == null || Number.isNaN(Number(price))) return;
    sparkHist[key].push(Number(price));
    if (sparkHist[key].length > max) sparkHist[key].shift();
  }

  function metricCard(title, price, change, source, digits, id) {
    return `<div class="metric" data-id="${id || ''}">
      <div class="label">${title}</div>
      <div class="value" data-digits="${digits}">${fmtNum(price, digits)}</div>
      <div class="chg ${chgClass(change)}">${chgText(change)}</div>
      <div class="label" style="margin-top:6px">المصدر: ${source}</div>
    </div>`;
  }

  function setMetric(id, price, change) {
    const el = document.querySelector(`.metric[data-id="${id}"]`);
    if (!el) return;
    const v = el.querySelector('.value');
    const c = el.querySelector('.chg');
    const digits = Number(v.dataset.digits || 2);
    if (price != null) v.textContent = fmtNum(price, digits);
    if (change != null) { c.className = 'chg ' + chgClass(change); c.textContent = chgText(change); }
  }

  function renderPriceCards() {
    const cards = [
      metricCard('النفط WTI ($)', state.oil?.price, state.oil?.changePercent, (state.oil?.source || 'Yahoo') + ' · لقطة Actions ~10د', 2, 'oil'),
      metricCard('الذهب عبر PAXG ($)', state.paxg?.price ?? state.gold?.price, state.paxg?.changePercent ?? state.gold?.changePercent,
        state.paxg ? 'Binance WebSocket PAXGUSDT (رمز ذهب رقمي)' : ((state.gold?.source || 'Yahoo') + ' · لقطة'), 2, 'gold'),
      metricCard('بتكوين ($)', state.btc?.price, state.btc?.changePercent, 'Binance WebSocket BTCUSDT · لحظي', 2, 'btc'),
      metricCard('إيثيريوم ($)', state.eth?.price, state.eth?.changePercent, 'Binance WebSocket ETHUSDT · لحظي', 2, 'eth'),
      metricCard('S&P 500', state.spx?.price, state.spx?.changePercent, (state.spx?.source || 'Yahoo') + ' · لقطة Actions ~10د', 2, 'spx'),
      metricCard('ناسداك', state.ndx?.price, state.ndx?.changePercent, (state.ndx?.source || 'Yahoo') + ' · لقطة Actions ~10د', 2, 'ndx'),
      metricCard('Apple', state.aapl?.price, state.aapl?.changePercent, (state.aapl?.source || 'Yahoo') + ' · لقطة Actions ~10د', 2, 'aapl'),
      metricCard('Microsoft', state.msft?.price, state.msft?.changePercent, (state.msft?.source || 'Yahoo') + ' · لقطة Actions ~10د', 2, 'msft'),
    ];
    $('priceMetrics').innerHTML = cards.join('');
    if (sparkHist.oil.length) spark('chartOil', sparkHist.oil, '#4cc9f0');
    if (sparkHist.gold.length) spark('chartGold', sparkHist.gold, '#fbbf24');
    if (sparkHist.btc.length) spark('chartBtc', sparkHist.btc, '#00f5d4');
    if (sparkHist.spx.length) spark('chartSpx', sparkHist.spx, '#ff2bd6');
  }

  function renderFx() {
    const pairs = state.fx?.pairs || {};
    $('fxGrid').innerHTML = Object.entries(pairs).map(([k, v]) =>
      `<div class="pair"><div class="n">${k}</div><div class="v">${fmtNum(v, k.includes('JPY') ? 2 : 4)}</div><div class="n">${state.fx?.source || ''}</div></div>`
    ).join('') || '<div class="warn">العملات غير متاحة</div>';
  }

  function updateFeedStatus() {
    const parts = [];
    parts.push(state.ws.btc ? 'BTC/ETH WS ✅' : 'BTC WS …');
    parts.push(state.ws.gold ? 'ذهب PAXG WS ✅' : 'ذهب WS …');
    parts.push(state.fx ? 'FX حي ✅' : 'FX …');
    if ($('feedStatus')) $('feedStatus').textContent = parts.join(' · ');
  }

  // —— Binance combined streams (browser WebSocket, CORS-friendly) ——
  function startBinanceWs() {
    const streams = ['btcusdt@ticker', 'ethusdt@ticker', 'paxgusdt@ticker'].join('/');
    const url = 'wss://stream.binance.com:9443/stream?streams=' + streams;
    let ws;
    let retry = 0;
    const connect = () => {
      ws = new WebSocket(url);
      ws.onopen = () => { retry = 0; updateFeedStatus(); };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          const d = msg.data || msg;
          const sym = (d.s || '').toUpperCase();
          const price = Number(d.c);
          const change = Number(d.P);
          if (!price) return;
          if (sym === 'BTCUSDT') {
            state.btc = { price, changePercent: change, source: 'Binance WebSocket' };
            state.ws.btc = true;
            pushHist('btc', price);
            setMetric('btc', price, change);
            spark('chartBtc', sparkHist.btc, '#00f5d4');
          } else if (sym === 'ETHUSDT') {
            state.eth = { price, changePercent: change, source: 'Binance WebSocket' };
            setMetric('eth', price, change);
          } else if (sym === 'PAXGUSDT') {
            state.paxg = { price, changePercent: change, source: 'Binance WebSocket PAXGUSDT' };
            state.ws.gold = true;
            pushHist('gold', price);
            setMetric('gold', price, change);
            spark('chartGold', sparkHist.gold, '#fbbf24');
          }
          updateFeedStatus();
          $('lastRefresh').textContent = 'آخر تحديث حي: ' + clockNow();
        } catch (_) {}
      };
      ws.onclose = () => {
        state.ws.btc = false; state.ws.gold = false; updateFeedStatus();
        const wait = Math.min(15000, 1000 * Math.pow(2, retry++));
        setTimeout(connect, wait);
      };
      ws.onerror = () => { try { ws.close(); } catch (_) {} };
    };
    connect();
  }

  async function loadFxLive() {
    try {
      const d = await fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-store' }).then(r => r.json());
      if (d.result !== 'success') throw new Error('fx');
      const rates = d.rates;
      state.fx = {
        source: 'ExchangeRate-API (open.er-api.com) · يومي/شبه حي',
        pairs: {
          'EUR/USD': 1 / rates.EUR,
          'GBP/USD': 1 / rates.GBP,
          'USD/JPY': rates.JPY,
          'USD/SAR': rates.SAR,
          'USD/AED': rates.AED,
          'USD/CHF': rates.CHF,
        },
        asOf: d.time_last_update_utc
      };
      renderFx();
      updateFeedStatus();
    } catch (_) {
      try {
        const bake = await loadJson('./bake-fx.json');
        state.fx = bake;
        renderFx();
      } catch (e) {
        $('priceStatus').innerHTML = `<div class="warn">FX غير متاح: ${e.message}</div>`;
      }
    }
  }

  async function loadBakedMarkets() {
    const [oil, gold, spx, ndx, aapl, msft, crypto] = await Promise.all([
      loadJson('./bake-oil.json').catch(() => null),
      loadJson('./bake-gold.json').catch(() => null),
      loadJson('./bake-spx.json').catch(() => null),
      loadJson('./bake-ndx.json').catch(() => null),
      loadJson('./bake-aapl.json').catch(() => null),
      loadJson('./bake-msft.json').catch(() => null),
      loadJson('./bake-crypto.json').catch(() => null),
    ]);
    state.oil = oil; state.gold = gold; state.spx = spx; state.ndx = ndx; state.aapl = aapl; state.msft = msft;
    if (!state.btc && crypto) state.btc = crypto;
    if (oil?.history?.length) sparkHist.oil = oil.history.map(p => p.c).filter(x => x != null).slice(-60);
    else if (oil?.price) pushHist('oil', oil.price);
    if (gold?.history?.length && !sparkHist.gold.length) sparkHist.gold = gold.history.map(p => p.c).filter(x => x != null).slice(-60);
    if (spx?.history?.length) sparkHist.spx = spx.history.map(p => p.c).filter(x => x != null).slice(-60);
    if (crypto?.price && !sparkHist.btc.length) pushHist('btc', crypto.price);
    renderPriceCards();
    $('priceStatus').innerHTML = '🔴 لحظي مجاني: بتكوين/إيثيريوم/PAXG (ذهب رقمي) عبر Binance WebSocket · 💱 FX عبر ExchangeRate-API · 🟠 نفط وأسهم أمريكية: لقطات Yahoo عبر GitHub Actions كل ~10 دقائق (Yahoo بلا CORS) · للعرض فقط';
  }

  async function loadNews() {
    try {
      let data;
      try {
        const feeds = [
          { label: 'Reuters', rss: 'https://news.google.com/rss/search?q=site:reuters.com+when:1d&hl=en-US&gl=US&ceid=US:en' },
          { label: 'AP', rss: 'https://news.google.com/rss/search?q=site:apnews.com+(economy+OR+markets)&hl=en-US&gl=US&ceid=US:en' },
          { label: 'Bloomberg', rss: 'https://feeds.bloomberg.com/markets/news.rss' },
        ];
        const items = [];
        for (const f of feeds) {
          const url = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(f.rss);
          const d = await fetch(url).then(r => r.json());
          if (d.status !== 'ok') continue;
          for (const it of (d.items || []).slice(0, 8)) items.push({ source: f.label, title: it.title, link: it.link, pubDate: it.pubDate });
        }
        items.sort((a, b) => Date.parse(b.pubDate || 0) - Date.parse(a.pubDate || 0));
        data = { source: 'rss2json ← Google News + Bloomberg', items: items.slice(0, 30), asOf: new Date().toISOString(), note: 'Reuters/AP عبر Google News RSS.' };
      } catch (_) {
        data = await loadJson('./bake-news.json');
      }
      const items = data.items || [];
      const doubled = items.concat(items);
      $('ticker').innerHTML = doubled.length ? doubled.map(it => `<a href="${it.link}" target="_blank" rel="noopener"><span class="src">${it.source}</span> ${it.title}</a>`).join('') : 'لا أخبار';
      $('newsTable').querySelector('tbody').innerHTML = items.map(it => `<tr><td>${it.source}</td><td><a href="${it.link}" target="_blank" rel="noopener">${it.title}</a></td><td>${riyadh(it.pubDate)}</td></tr>`).join('');
      $('newsSource').textContent = data.source;
      $('newsStatus').textContent = (data.note || '') + ' · ' + riyadh(data.asOf);
    } catch (e) {
      $('newsStatus').innerHTML = `<div class="warn">${e.message}</div>`;
    }
  }

  async function loadIndicators() {
    try {
      const data = await loadJson('./bake-indicators.json');
      $('indTable').querySelector('tbody').innerHTML = (data.countries || []).map(c => `<tr>
        <td>${c.name}</td>
        <td>${c.inflation != null ? fmtNum(c.inflation, 2) + (c.inflationYear ? ` (${c.inflationYear})` : '') : '—'}<div class="label">${c.inflationSource || ''}</div></td>
        <td>${c.policyRate != null ? fmtNum(c.policyRate, 3) : '—'}<div class="label">${c.policyRateSource || ''}</div></td>
        <td>${c.gdp != null ? fmtBig(c.gdp) + (c.gdpYear ? ` (${c.gdpYear})` : '') : '—'}<div class="label">${c.gdpSource || ''}</div></td>
      </tr>`).join('');
      $('indStatus').textContent = `${data.notes || ''} · ${data.source} · لقطة ${riyadh(data.asOf)} (تحديث Actions)`;
    } catch (e) {
      $('indStatus').innerHTML = `<div class="warn">${e.message}</div>`;
    }
  }

  async function loadCalendar() {
    try {
      const data = await loadJson('./bake-calendar.json');
      const pill = (imp) => {
        const t = (imp || '').toLowerCase();
        if (t.includes('high')) return '<span class="pill high">مرتفع</span>';
        if (t.includes('medium') || t.includes('med')) return '<span class="pill med">متوسط</span>';
        if (t.includes('holiday')) return '<span class="pill holiday">عطلة</span>';
        return '<span class="pill low">منخفض</span>';
      };
      $('calTable').querySelector('tbody').innerHTML = (data.events || []).slice(0, 35).map(e => `<tr>
        <td>${riyadh(e.date)}</td><td>${e.country || '—'}</td><td>${e.title}</td>
        <td>${pill(e.impact)}</td><td>${e.previous || '—'}</td><td>${e.forecast || '—'}</td>
      </tr>`).join('') || '<tr><td colspan="6">لا أحداث</td></tr>';
      $('calStatus').textContent = `المصدر: ${data.source} · لقطة ${riyadh(data.asOf)} · تحديث Actions ~10د`;
    } catch (e) {
      $('calStatus').innerHTML = `<div class="warn">${e.message}</div>`;
    }
  }

  const CENTROIDS = {US:[37.1,-95.7],GB:[54,-2],CN:[35.9,104.2],RU:[61.5,105.3],UA:[48.4,31.2],SA:[23.9,45.1],IR:[32.4,53.7],IL:[31,34.9],DE:[51.2,10.4],FR:[46.2,2.2],JP:[36.2,138.3],IN:[20.6,79],BR:[-14.2,-51.9],AU:[-25.3,133.8],TR:[39,35.2],AE:[23.4,53.8],ID:[-0.8,113.9]};
  const NAMES = [['United States','US'],['China','CN'],['Russia','RU'],['Ukraine','UA'],['Saudi','SA'],['Iran','IR'],['Israel','IL'],['Germany','DE'],['France','FR'],['Japan','JP'],['India','IN'],['Brazil','BR'],['Britain','GB'],['UK','GB'],['Indonesia','ID'],['Australia','AU'],['Turkey','TR'],['Fed ','US']];
  let map, layer;
  function initMap() {
    map = L.map('map', { worldCopyJump: true }).setView([22, 25], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; OSM &copy; CARTO', maxZoom: 8 }).addTo(map);
    layer = L.layerGroup().addTo(map);
  }
  async function loadEvents() {
    try {
      let data;
      try {
        const newsUrl = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent('https://news.google.com/rss/search?q=geopolitics+OR+sanctions+OR+economy+when:1d&hl=en-US&gl=US&ceid=US:en');
        const d = await fetch(newsUrl).then(r => r.json());
        const pins = [];
        for (const it of (d.items || [])) {
          let code = null;
          for (const [name, c] of NAMES) if ((it.title || '').toLowerCase().includes(name.toLowerCase())) { code = c; break; }
          if (!code || !CENTROIDS[code]) continue;
          const ll = CENTROIDS[code];
          pins.push({ lat: ll[0] + (Math.random() - .5), lon: ll[1] + (Math.random() - .5), title: it.title, url: it.link, country: code, domain: 'Google News' });
        }
        data = { source: 'Google News عبر rss2json (مواقع تقريبية)', pins, asOf: new Date().toISOString(), note: 'ليست إحداثيات دقيقة للحدث.' };
      } catch (_) {
        data = await loadJson('./bake-events.json');
      }
      layer.clearLayers();
      (data.pins || []).forEach(p => {
        L.circleMarker([p.lat, p.lon], { radius: 6, color: '#00f5d4', fillColor: '#ff2bd6', fillOpacity: 0.75, weight: 1 })
          .bindPopup(`<strong>${p.title || ''}</strong><br/><small>${p.country || ''}</small><br/>${p.url ? `<a href="${p.url}" target="_blank" rel="noopener">المصدر</a>` : ''}`)
          .addTo(layer);
      });
      $('mapSource').textContent = data.source;
      $('mapStatus').textContent = `${(data.pins || []).length} نقطة · ${data.note || ''} · ${riyadh(data.asOf)}`;
    } catch (e) {
      $('mapStatus').innerHTML = `<div class="warn">${e.message}</div>`;
    }
  }

  initMap();
  setInterval(() => { $('clock').textContent = clockNow() + ' (توقيت الرياض)'; }, 1000);
  $('clock').textContent = clockNow() + ' (توقيت الرياض)';

  loadBakedMarkets().then(() => startBinanceWs());
  loadFxLive();
  loadNews();
  loadIndicators();
  loadCalendar();
  loadEvents();

  setInterval(loadFxLive, 60 * 1000);
  setInterval(loadNews, 5 * 60 * 1000);
  setInterval(loadEvents, 5 * 60 * 1000);
  setInterval(() => { loadBakedMarkets(); loadIndicators(); loadCalendar(); }, 10 * 60 * 1000);

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
})();
