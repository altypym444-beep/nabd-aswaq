
(() => {
  const TZ = 'Asia/Riyadh';
  const $ = (id) => document.getElementById(id);
  const fmtNum = (n, d = 2) => {
    if (n == null || Number.isNaN(Number(n))) return '—';
    return Number(n).toLocaleString('en-US', {
      maximumFractionDigits: d,
      minimumFractionDigits: Math.min(d, 2),
      useGrouping: true
    });
  };
  const chgClass = (p) => (Number(p) > 0 ? 'up' : Number(p) < 0 ? 'down' : 'flat');
  const chgText = (p) => {
    if (p == null || Number.isNaN(Number(p))) return '';
    const n = Number(p);
    const arrow = n > 0 ? '▲' : n < 0 ? '▼' : '•';
    return `${arrow} ${n > 0 ? '+' : n < 0 ? '-' : ''}${Math.abs(n).toFixed(2)}%`;
  };
  const riyadhTime = (iso) => {
    try {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: TZ, weekday: 'short', day: '2-digit', month: 'short',
        hour: '2-digit', minute: '2-digit', hour12: false
      }).format(new Date(iso));
    } catch { return String(iso || '—'); }
  };
  const clockNow = () => new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, weekday: 'short', year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).format(new Date()) + '  Asia/Riyadh';

  const state = { btc: null, eth: null, paxg: null, fx: null };

  function renderMetrics() {
    const cards = [
      { id: 'btc', k: 'BTCUSDT', v: state.btc?.price, c: state.btc?.changePercent, d: 2, s: 'BINANCE WS' },
      { id: 'eth', k: 'ETHUSDT', v: state.eth?.price, c: state.eth?.changePercent, d: 2, s: 'BINANCE WS' },
      { id: 'paxg', k: 'PAXGUSDT', v: state.paxg?.price, c: state.paxg?.changePercent, d: 2, s: 'BINANCE WS' },
      { id: 'sar', k: 'USD/SAR', v: state.fx?.pairs?.['USD/SAR'], c: null, d: 4, s: 'FX API' },
      { id: 'eur', k: 'EUR/USD', v: state.fx?.pairs?.['EUR/USD'], c: null, d: 4, s: 'FX API' },
      { id: 'gbp', k: 'GBP/USD', v: state.fx?.pairs?.['GBP/USD'], c: null, d: 4, s: 'FX API' },
      { id: 'jpy', k: 'USD/JPY', v: state.fx?.pairs?.['USD/JPY'], c: null, d: 2, s: 'FX API' },
      { id: 'aed', k: 'USD/AED', v: state.fx?.pairs?.['USD/AED'], c: null, d: 4, s: 'FX API' },
    ];
    $('liveMetrics').innerHTML = cards.map((x) => `
      <div class="metric" data-id="${x.id}">
        <div class="k"><span>${x.k}</span></div>
        <div class="v">${fmtNum(x.v, x.d)}</div>
        <div class="chg ${chgClass(x.c)}">${chgText(x.c)}</div>
        <div class="src">${x.s}</div>
      </div>`).join('');
  }

  function setMetric(id, price, change, digits) {
    const el = document.querySelector(`.metric[data-id="${id}"]`);
    if (!el) return;
    el.querySelector('.v').textContent = fmtNum(price, digits);
    if (change != null) {
      const c = el.querySelector('.chg');
      c.className = 'chg ' + chgClass(change);
      c.textContent = chgText(change);
    }
  }

  function startBinance() {
    const streams = ['btcusdt@ticker', 'ethusdt@ticker', 'paxgusdt@ticker'].join('/');
    const url = 'wss://stream.binance.com:9443/stream?streams=' + streams;
    let retry = 0;
    const connect = () => {
      const ws = new WebSocket(url);
      ws.onopen = () => {
        $('feedStatus').textContent = 'BINANCE WS';
        retry = 0;
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          const d = msg.data || msg;
          const sym = (d.s || '').toUpperCase();
          const price = Number(d.c);
          const change = Number(d.P);
          if (!price) return;
          if (sym === 'BTCUSDT') { state.btc = { price, changePercent: change }; setMetric('btc', price, change, 2); }
          if (sym === 'ETHUSDT') { state.eth = { price, changePercent: change }; setMetric('eth', price, change, 2); }
          if (sym === 'PAXGUSDT') { state.paxg = { price, changePercent: change }; setMetric('paxg', price, change, 2); }
        } catch (_) {}
      };
      ws.onclose = () => {
        $('feedStatus').textContent = 'RECONNECT…';
        setTimeout(connect, Math.min(15000, 1000 * Math.pow(2, retry++)));
      };
      ws.onerror = () => { try { ws.close(); } catch (_) {} };
    };
    connect();
  }

  async function loadFx() {
    try {
      const d = await fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-store' }).then((r) => r.json());
      if (d.result !== 'success') throw new Error('fx');
      const r = d.rates;
      state.fx = {
        source: 'ExchangeRate-API',
        pairs: {
          'EUR/USD': 1 / r.EUR,
          'GBP/USD': 1 / r.GBP,
          'USD/JPY': r.JPY,
          'USD/SAR': r.SAR,
          'USD/AED': r.AED,
          'USD/CHF': r.CHF,
        }
      };
      renderMetrics();
      $('liveStatus').textContent = 'FX OK · ' + (d.time_last_update_utc || '');
    } catch (_) {
      try {
        const bake = await fetch('./bake-fx.json?_=' + Date.now()).then((r) => r.json());
        state.fx = bake;
        renderMetrics();
        $('liveStatus').textContent = 'FX snapshot · ' + (bake.source || '');
      } catch (e) {
        $('liveStatus').textContent = 'FX unavailable';
      }
    }
  }

  async function loadCalendar() {
    const card = $('calendarCard');
    try {
      const data = await fetch('./bake-calendar.json?_=' + Date.now()).then((r) => r.json());
      const events = data.events || [];
      if (!events.length) throw new Error('empty');
      const pill = (imp) => {
        const t = (imp || '').toLowerCase();
        if (t.includes('high')) return '<span class="badge high">HIGH</span>';
        if (t.includes('medium') || t.includes('med')) return '<span class="badge med">MED</span>';
        if (t.includes('holiday')) return '<span class="badge holiday">HOL</span>';
        return '<span class="badge low">LOW</span>';
      };
      const toWestern = (s) => String(s ?? '—').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
      $('calTable').querySelector('tbody').innerHTML = events.slice(0, 35).map((e) => `<tr>
        <td class="num">${riyadhTime(e.date)}</td>
        <td>${e.country || '—'}</td>
        <td>${e.title || '—'}</td>
        <td>${pill(e.impact)}</td>
        <td class="num">${toWestern(e.previous)}</td>
        <td class="num">${toWestern(e.forecast)}</td>
      </tr>`).join('');
      $('calStatus').textContent = `Source: ${data.source || 'calendar'} · ${events.length} events`;
    } catch (_) {
      card.style.display = 'none';
    }
  }

  setInterval(() => { $('clock').textContent = clockNow(); }, 1000);
  $('clock').textContent = clockNow();
  renderMetrics();
  startBinance();
  loadFx();
  loadCalendar();
  setInterval(loadFx, 60 * 1000);

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
})();
