
(() => {
  const TZ = 'Asia/Riyadh';
  const $ = (id) => document.getElementById(id);

  const fmt = (n, d) => {
    if (n == null || Number.isNaN(Number(n))) return '—';
    return Number(n).toLocaleString('en-US', {
      maximumFractionDigits: d,
      minimumFractionDigits: Math.min(d, 2),
      useGrouping: true
    });
  };

  const clockNow = () => new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, weekday: 'short', year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).format(new Date()) + '  Asia/Riyadh';

  const state = {
    gold: { price: null, open: null, digits: 2 },
    brent: { price: null, open: null, digits: 2 },
    wti: { price: null, open: null, digits: 2 },
    btc: { price: null, open: null, digits: 2 },
    ok: { gold: false, brent: false, wti: false, btc: false }
  };

  function setStatus() {
    const parts = [];
    if (state.ok.btc) parts.push('BTC');
    if (state.ok.gold) parts.push('GOLD');
    if (state.ok.wti) parts.push('WTI');
    if (state.ok.brent) parts.push('BRENT');
    $('feedStatus').textContent = parts.length ? ('WS ' + parts.join('·')) : 'CONNECTING';
  }

  function pulse(id, dir) {
    const el = document.querySelector(`.pcard[data-id="${id}"]`);
    if (!el) return;
    el.classList.remove('flash-up', 'flash-down');
    // force reflow for repeated pulses
    void el.offsetWidth;
    el.classList.add(dir === 'up' ? 'flash-up' : dir === 'down' ? 'flash-down' : '');
    clearTimeout(el._pulseTimer);
    el._pulseTimer = setTimeout(() => el.classList.remove('flash-up', 'flash-down'), 450);
  }

  function updateCard(id, price, meta) {
    const st = state[id];
    if (price == null || Number.isNaN(Number(price))) return;
    const p = Number(price);
    const prev = st.price;
    st.price = p;
    if (st.open == null) st.open = p;
    if (meta && meta.open != null && Number(meta.open) > 0) st.open = Number(meta.open);

    const priceEl = $('p-' + id);
    const chgEl = $('c-' + id);
    const srcEl = $('s-' + id);
    priceEl.textContent = fmt(p, st.digits);

    if (prev != null && p !== prev) {
      pulse(id, p > prev ? 'up' : 'down');
    }

    if (st.open) {
      const chg = ((p - st.open) / st.open) * 100;
      const arrow = chg > 0 ? '▲' : chg < 0 ? '▼' : '•';
      chgEl.textContent = `${arrow} ${chg > 0 ? '+' : chg < 0 ? '-' : ''}${Math.abs(chg).toFixed(2)}%`;
      chgEl.className = 'chg ' + (chg > 0 ? 'up' : chg < 0 ? 'down' : 'flat');
    }

    if (meta && meta.src) srcEl.textContent = meta.src;
    state.ok[id] = true;
    setStatus();
  }

  function connectWS(url, { onmsg, onopen, label, retryKey }) {
    let retry = 0;
    const go = () => {
      let ws;
      try { ws = new WebSocket(url); } catch (e) {
        setTimeout(go, Math.min(15000, 1000 * Math.pow(2, retry++)));
        return;
      }
      ws.onopen = () => { retry = 0; onopen && onopen(ws); };
      ws.onmessage = (ev) => {
        try { onmsg(ev.data, ws); } catch (_) {}
      };
      ws.onclose = () => {
        if (label) console.warn('ws close', label);
        setTimeout(go, Math.min(15000, 1000 * Math.pow(2, retry++)));
      };
      ws.onerror = () => { try { ws.close(); } catch (_) {} };
    };
    go();
  }

  // —— Bitcoin: Binance spot trade stream (sub-second) ——
  // Prefer market-data host; fall back to stream.binance.com
  (function startBtc() {
    const hosts = [
      'wss://data-stream.binance.vision/ws/btcusdt@trade',
      'wss://stream.binance.com:9443/ws/btcusdt@trade'
    ];
    let hostIdx = 0;
    let opened = false;
    const tryHost = () => {
      const url = hosts[hostIdx % hosts.length];
      let retry = 0;
      const go = () => {
        let ws;
        try { ws = new WebSocket(url); } catch (_) {
          hostIdx++; setTimeout(tryHost, 800); return;
        }
        const timer = setTimeout(() => {
          if (!opened) { try { ws.close(); } catch (_) {} }
        }, 6000);
        ws.onopen = () => { opened = true; clearTimeout(timer); retry = 0; };
        ws.onmessage = (ev) => {
          const d = JSON.parse(ev.data);
          const price = Number(d.p);
          updateCard('btc', price, {
            src: 'Binance WS · btcusdt@trade · sub-second trades'
          });
        };
        ws.onclose = () => {
          clearTimeout(timer);
          if (!opened && hostIdx < hosts.length - 1) {
            hostIdx++; setTimeout(tryHost, 400); return;
          }
          setTimeout(go, Math.min(15000, 1000 * Math.pow(2, retry++)));
        };
        ws.onerror = () => { try { ws.close(); } catch (_) {} };
      };
      go();
    };
    tryHost();
  })();

  // —— Gold / WTI / Brent via MEXC contract WS (deal + ticker) ——
  // Gold: XAU_USDT perp (honest label — exchange TradFi gold perpetual, not LBMA fix)
  // WTI: USOIL_USDT · Brent: UKOIL_USDT
  (function startMexC() {
    const url = 'wss://contract.mexc.com/edge';
    const map = {
      XAU_USDT: { id: 'gold', srcDeal: 'MEXC WS · XAU_USDT deal · gold TradFi perp', srcTick: 'MEXC WS · XAU_USDT ticker · gold TradFi perp' },
      UKOIL_USDT: { id: 'brent', srcDeal: 'MEXC WS · UKOIL_USDT deal · Brent perp', srcTick: 'MEXC WS · UKOIL_USDT ticker · Brent perp' },
      USOIL_USDT: { id: 'wti', srcDeal: 'MEXC WS · USOIL_USDT deal · WTI perp', srcTick: 'MEXC WS · USOIL_USDT ticker · WTI perp' }
    };
    let retry = 0;
    const go = () => {
      let ws;
      try { ws = new WebSocket(url); } catch (_) {
        setTimeout(go, Math.min(15000, 1000 * Math.pow(2, retry++))); return;
      }
      ws.onopen = () => {
        retry = 0;
        Object.keys(map).forEach((sym) => {
          ws.send(JSON.stringify({ method: 'sub.deal', param: { symbol: sym, limit: 1 } }));
          ws.send(JSON.stringify({ method: 'sub.ticker', param: { symbol: sym } }));
        });
      };
      ws.onmessage = (ev) => {
        let d;
        try { d = JSON.parse(ev.data); } catch (_) { return; }
        const sym = d.symbol;
        const m = map[sym];
        if (!m) return;
        if (d.channel === 'push.deal' && Array.isArray(d.data) && d.data[0]) {
          updateCard(m.id, d.data[0].p, { src: m.srcDeal });
          return;
        }
        // ticker pushes sometimes omit channel
        const td = d.data;
        if (td && typeof td === 'object' && !Array.isArray(td) && td.lastPrice != null) {
          const openGuess = td.lastPrice && td.riseFallRate != null
            ? Number(td.lastPrice) / (1 + Number(td.riseFallRate))
            : null;
          updateCard(m.id, td.lastPrice, {
            src: m.srcTick,
            open: openGuess
          });
        }
      };
      ws.onclose = () => setTimeout(go, Math.min(15000, 1000 * Math.pow(2, retry++)));
      ws.onerror = () => { try { ws.close(); } catch (_) {} };
    };
    go();
  })();

  // —— Gold fallback: Binance PAXG trade (tokenized gold) if MEXC gold silent ——
  setTimeout(() => {
    if (state.ok.gold) return;
    const url = 'wss://data-stream.binance.vision/ws/paxgusdt@trade';
    connectWS(url, {
      label: 'paxg',
      onmsg: (raw) => {
        const d = JSON.parse(raw);
        updateCard('gold', d.p, {
          src: 'Binance WS · paxgusdt@trade · tokenized gold (PAXG proxy)'
        });
      }
    });
  }, 8000);

  setInterval(() => { $('clock').textContent = clockNow(); }, 1000);
  $('clock').textContent = clockNow();


  // Force TradingView iframe to fill the chart box (TV often injects a short iframe)
  (function fitTv() {
    const box = document.querySelector('.tv-chart');
    if (!box) return;
    const apply = () => {
      const h = box.clientHeight;
      const w = box.clientWidth;
      box.style.height = box.classList.contains('tv-chart') ? '' : box.style.height;
      const widget = box.querySelector('.tradingview-widget-container__widget') || box;
      widget.style.height = h + 'px';
      widget.style.width = '100%';
      box.querySelectorAll('iframe').forEach((f) => {
        f.style.height = h + 'px';
        f.style.width = '100%';
        f.setAttribute('height', String(h));
        f.setAttribute('width', String(w));
      });
    };
    apply();
    const mo = new MutationObserver(apply);
    mo.observe(box, { childList: true, subtree: true, attributes: true });
    window.addEventListener('resize', apply);
    setInterval(apply, 1500);
  })();

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
})();
