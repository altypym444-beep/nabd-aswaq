
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
    ok: { gold: false, brent: false, wti: false, btc: false },
    live: { gold: false, brent: false, wti: false, btc: false },
    lastTick: { gold: 0, brent: 0, wti: 0, btc: 0 }
  };

  function setDot(id, on) {
    state.live[id] = !!on;
    const d = $('dot-' + id);
    if (d) d.classList.toggle('on', !!on);
    const any = Object.values(state.live).some(Boolean);
    const pill = document.querySelector('.livepill');
    if (pill) {
      pill.classList.toggle('off', !any);
      const label = pill.childNodes[pill.childNodes.length - 1];
      // text node after .d
    }
    const parts = [];
    if (state.live.btc) parts.push('BTC');
    if (state.live.gold) parts.push('GOLD');
    if (state.live.wti) parts.push('WTI');
    if (state.live.brent) parts.push('BRENT');
    if ($('feedStatus')) $('feedStatus').textContent = parts.length ? ('WS ' + parts.join('·')) : 'CONNECTING';
  }

  function setStatus() {
    const parts = [];
    if (state.ok.btc) parts.push('BTC');
    if (state.ok.gold) parts.push('GOLD');
    if (state.ok.wti) parts.push('WTI');
    if (state.ok.brent) parts.push('BRENT');
    // prefer live-based status when available
  }

  function pulse(id, dir) {
    const el = document.querySelector(`.pcard[data-id="${id}"]`);
    if (!el) return;
    el.classList.remove('flash-up', 'flash-down');
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
    if (priceEl) priceEl.textContent = fmt(p, st.digits);

    if (prev != null && p !== prev) pulse(id, p > prev ? 'up' : 'down');

    if (st.open && chgEl) {
      const chg = ((p - st.open) / st.open) * 100;
      const arrow = chg > 0 ? '▲' : chg < 0 ? '▼' : '•';
      chgEl.textContent = `${arrow} ${chg > 0 ? '+' : chg < 0 ? '-' : ''}${Math.abs(chg).toFixed(2)}%`;
      chgEl.className = 'chg ' + (chg > 0 ? 'up' : chg < 0 ? 'down' : 'flat');
    }

    if (meta && meta.src && srcEl) srcEl.textContent = meta.src;
    state.ok[id] = true;
    state.lastTick[id] = Date.now();
    setDot(id, true);
  }

  function connectWS(url, { onmsg, onopen, onclose, label }) {
    let retry = 0;
    const go = () => {
      let ws;
      try { ws = new WebSocket(url); } catch (e) {
        setTimeout(go, Math.min(15000, 1000 * Math.pow(2, retry++)));
        return;
      }
      ws.onopen = () => { retry = 0; onopen && onopen(ws); };
      ws.onmessage = (ev) => { try { onmsg(ev.data, ws); } catch (_) {} };
      ws.onclose = () => {
        onclose && onclose();
        setTimeout(go, Math.min(15000, 1000 * Math.pow(2, retry++)));
      };
      ws.onerror = () => { try { ws.close(); } catch (_) {} };
    };
    go();
  }

  // —— Bitcoin ——
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
        ws.onopen = () => { opened = true; clearTimeout(timer); retry = 0; setDot('btc', true); };
        ws.onmessage = (ev) => {
          const d = JSON.parse(ev.data);
          updateCard('btc', Number(d.p), {
            src: 'Binance WS · btcusdt@trade · sub-second trades'
          });
        };
        ws.onclose = () => {
          clearTimeout(timer);
          setDot('btc', false);
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

  // —— Gold / WTI / Brent via MEXC ——
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
        ['gold', 'brent', 'wti'].forEach((id) => setDot(id, true));
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
        const td = d.data;
        if (td && typeof td === 'object' && !Array.isArray(td) && td.lastPrice != null) {
          const openGuess = td.lastPrice && td.riseFallRate != null
            ? Number(td.lastPrice) / (1 + Number(td.riseFallRate))
            : null;
          updateCard(m.id, td.lastPrice, { src: m.srcTick, open: openGuess });
        }
      };
      ws.onclose = () => {
        ['gold', 'brent', 'wti'].forEach((id) => setDot(id, false));
        setTimeout(go, Math.min(15000, 1000 * Math.pow(2, retry++)));
      };
      ws.onerror = () => { try { ws.close(); } catch (_) {} };
    };
    go();
  })();

  // Gold fallback PAXG
  setTimeout(() => {
    if (state.ok.gold) return;
    connectWS('wss://data-stream.binance.vision/ws/paxgusdt@trade', {
      label: 'paxg',
      onopen: () => setDot('gold', true),
      onclose: () => { if (!state.ok.gold) setDot('gold', false); },
      onmsg: (raw) => {
        const d = JSON.parse(raw);
        updateCard('gold', d.p, {
          src: 'Binance WS · paxgusdt@trade · tokenized gold (PAXG proxy)'
        });
      }
    });
  }, 8000);

  // stale tick watchdog (no tick > 25s => red)
  setInterval(() => {
    const now = Date.now();
    ['gold', 'brent', 'wti', 'btc'].forEach((id) => {
      if (state.live[id] && state.lastTick[id] && now - state.lastTick[id] > 25000) setDot(id, false);
    });
  }, 5000);

  setInterval(() => { if ($('clock')) $('clock').textContent = clockNow(); }, 1000);
  if ($('clock')) $('clock').textContent = clockNow();

  // TradingView fill
  (function fitTv() {
    const box = document.querySelector('.tv-chart');
    if (!box) return;
    let last = '';
    let applying = false;
    const apply = () => {
      if (applying) return;
      const h = Math.round(box.clientHeight);
      const w = Math.round(box.clientWidth);
      if (h < 40 || w < 40) return;
      const key = h + 'x' + w;
      const iframe = box.querySelector('iframe');
      const curH = iframe ? iframe.style.height : '';
      if (key === last && curH === h + 'px') return;
      applying = true;
      try {
        const widget = box.querySelector('.tradingview-widget-container__widget') || box;
        if (widget.style.height !== h + 'px') widget.style.height = h + 'px';
        widget.style.width = '100%';
        box.querySelectorAll('iframe').forEach((f) => {
          if (f.style.height !== h + 'px') f.style.height = h + 'px';
          f.style.width = '100%';
        });
        last = key;
      } finally {
        applying = false;
      }
    };
    apply();
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'childList' && (m.addedNodes.length || m.removedNodes.length)) {
          apply(); break;
        }
      }
    });
    mo.observe(box, { childList: true, subtree: true });
    window.addEventListener('resize', apply);
    setTimeout(apply, 800);
    setTimeout(apply, 2500);
  })();

  // —— WebAudio alert chirp ——
  let audioCtx = null;
  let muted = false;
  try { muted = localStorage.getItem('nabd-mute') === '1'; } catch (_) {}

  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    return audioCtx;
  }

  function playAlertTone(up) {
    if (muted) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    const now = ctx.currentTime;
    const freqs = up ? [523.25, 659.25, 783.99] : [392.0, 329.63, 261.63];
    freqs.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.12, now + 0.02 + i * 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22 + i * 0.07);
      o.connect(g); g.connect(ctx.destination);
      o.start(now + i * 0.05);
      o.stop(now + 0.28 + i * 0.07);
    });
  }

  const btnMute = $('btnMute');
  function syncMuteBtn() {
    if (!btnMute) return;
    btnMute.textContent = muted ? 'صامت 🔇' : 'صوت 🔊';
    btnMute.classList.toggle('muted', muted);
  }
  syncMuteBtn();
  if (btnMute) {
    btnMute.addEventListener('click', () => {
      muted = !muted;
      try { localStorage.setItem('nabd-mute', muted ? '1' : '0'); } catch (_) {}
      syncMuteBtn();
      if (!muted) { ensureAudio(); playAlertTone(true); }
    });
  }

  // Welcome toast
  (function welcome() {
    const host = document.getElementById('toastHost');
    if (!host) return;
    try { if (sessionStorage.getItem('nabd-welcome')) return; sessionStorage.setItem('nabd-welcome', '1'); } catch (_) {}
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = 'السوق حي الحين 🔥<br><span class="sub">ذهب · برنت · WTI · بيتكوين — نبض لحظة بلحظة</span>';
    host.appendChild(t);
    setTimeout(() => { t.classList.add('hide'); setTimeout(() => t.remove(), 400); }, 4500);
  })();

  function showToast(html, ms) {
    const host = document.getElementById('toastHost');
    if (!host) return;
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = html;
    host.appendChild(t);
    setTimeout(() => { t.classList.add('hide'); setTimeout(() => t.remove(), 400); }, ms || 4000);
  }

  const lastAlert = { gold: 0, brent: 0, wti: 0, btc: 0 };
  const names = { gold: 'الذهب', brent: 'برنت', wti: 'WTI', btc: 'البيتكوين' };
  let notifyOn = false;

  const btn = $('btnNotify');
  if (btn) {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      notifyOn = true;
      btn.textContent = 'التنبيهات شغّالة ✅';
    }
    btn.addEventListener('click', async () => {
      ensureAudio();
      if (typeof Notification === 'undefined') {
        showToast('المتصفح ما يدعم التنبيهات 😅', 3000);
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        notifyOn = true;
        btn.textContent = 'التنبيهات شغّالة ✅';
        showToast('يلا! بتنبهك على أي حركة قوية فوق 1٪ 🚀', 3500);
        playAlertTone(true);
        try {
          new Notification('نبض الأسواق', { body: 'التنبيهات فعّالة — خلك قريب من السوق ⚡', icon: './icon-192.png' });
        } catch (_) {}
      } else {
        showToast('ما تم تفعيل التنبيهات — تقدر تجرب مرة ثانية من الزر', 3500);
      }
    });
  }

  const _updateCard = updateCard;
  updateCard = function(id, price, meta) {
    _updateCard(id, price, meta);
    const st = state[id];
    if (!st.open || st.price == null) return;
    const chg = ((st.price - st.open) / st.open) * 100;
    if (Math.abs(chg) < 1) return;
    const now = Date.now();
    if (now - (lastAlert[id] || 0) < 120000) return;
    lastAlert[id] = now;
    const up = chg > 0;
    const msg = up
      ? `يا سلام! ${names[id]} يطير 🚀 ${chg.toFixed(2)}٪`
      : `انتبه! ${names[id]} ينزل بسرعة 📉 ${chg.toFixed(2)}٪`;
    showToast(msg, 4200);
    playAlertTone(up);
    if (notifyOn && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification('نبض الأسواق', {
          body: msg,
          icon: './icon-192.png',
          tag: 'nabd-' + id
        });
      } catch (_) {}
    }
  };

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
  }
})();
