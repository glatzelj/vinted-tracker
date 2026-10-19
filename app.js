(function () {
  'use strict';

  // ---------- state ----------
  const S = {
    data: null,
    view: 'dashboard',
    period: 'all',
    stock: { q: '', status: 'All', cat: 'All', sort: 'newest', aged: '' },
    sold: { q: '', use: 'Business', month: 'All' },
    exCat: 'All',
    insTab: 'report',
    report: { month: null },
    lead: { by: 'brand', sort: 'profit', period: 'all' },
    lastList: [],
    loadedAt: 0,
    draft: { photos: [], notes: '', result: null, busy: false }
  };
  const PREF_STORE = 'vt-prefs';
  function prefs() { try { return JSON.parse(localStorage.getItem(PREF_STORE) || '{}'); } catch (e) { return {}; } }
  function setPref(k, v) { const p = prefs(); p[k] = v; try { localStorage.setItem(PREF_STORE, JSON.stringify(p)); } catch (e) { /* not saved in private mode */ } applyPrefs(); }
  function applyPrefs() { document.documentElement.dataset.corners = prefs().corners || 'round'; }
  applyPrefs();
  const UNSOLD = ['In stock', 'Listed', 'Reserved'];
  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));

  // ---------- data service ----------
  // The data service is the Google Apps Script attached to the sheet. It only answers with the key.
  const API_URL = 'https://script.google.com/macros/s/AKfycbxT9JkIIZHfOmQk6tUG3_YmvxmSBQCh7R4kfj8VpfV5sFmunNsNhV7xd_dMVoVyq7QLiw/exec';
  const KEY_STORE = 'vt-key';
  function getKey() { try { return localStorage.getItem(KEY_STORE) || S.key || ''; } catch (e) { return S.key || ''; } }
  function setKey(k) { S.key = k; try { if (k) localStorage.setItem(KEY_STORE, k); else localStorage.removeItem(KEY_STORE); } catch (e) { /* private mode: key lasts this visit only */ } }

  function call(fn, ...args) {
    if (window.VT_MOCK) return window.VT_MOCK(fn, args);
    // text/plain keeps this a "simple" request, which Google's servers accept from other websites.
    return fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ key: getKey(), fn: fn, args: args }) })
      .then(r => { if (!r.ok) throw new Error('Google returned an error (' + r.status + '). Try again in a moment.'); return r.json(); })
      .catch(e => { throw e instanceof TypeError ? new Error("Couldn't reach Google. Check your internet connection.") : e; })
      .then(res => {
        if (res.ok) return res.result;
        if (res.error === 'wrong-key') { setKey(''); askKey("That key didn't work. Check it and try again."); throw new Error('Key needed'); }
        throw new Error(res.error || 'Something went wrong');
      });
  }

  // ---------- icons ----------
  const ICON = {
    hanger: '<svg viewBox="0 0 64 64"><path d="M32 10a7 7 0 0 0-7 7h4a3 3 0 1 1 3 3 2 2 0 0 0-2 2v5.2L6.6 41.6A4 4 0 0 0 8.7 49h46.6a4 4 0 0 0 2.1-7.4L34 27.2V23.6A7 7 0 0 0 32 10zm0 20.8L55.3 45H8.7z"/></svg>',
    refresh: '<svg viewBox="0 0 24 24"><path d="M17.65 6.35A7.96 7.96 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4z"/></svg>',
    edit: '<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75zM20.7 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75z"/></svg>',
    ext: '<svg viewBox="0 0 24 24"><path d="M14 3v2h3.6l-9.8 9.8 1.4 1.4L19 6.4V10h2V3zM19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2z"/></svg>',
    prev: '<svg viewBox="0 0 24 24"><path d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4L10.8 12z"/></svg>',
    next: '<svg viewBox="0 0 24 24"><path d="M10 6 8.6 7.4 13.2 12l-4.6 4.6L10 18l6-6z"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z"/></svg>',
    tick: '<svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z"/></svg>',
    search: '<svg viewBox="0 0 24 24"><path d="M15.5 14h-.8l-.3-.3A6.5 6.5 0 1 0 14 15.5l.3.3v.8l5 5 1.5-1.5zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z"/></svg>',
    bag: '<svg viewBox="0 0 24 24"><path d="M20 7h-4V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2H4a1 1 0 0 0-1 1v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a1 1 0 0 0-1-1zM10 5h4v2h-4z"/></svg>',
    pound: '<svg viewBox="0 0 24 24"><path d="M14.5 3C11.5 3 9 5.2 9 8.4V11H6v2h3v4.5L7 19v2h12v-2h-8v-6h4v-2h-4V8.4C11 6.4 12.6 5 14.5 5c1.2 0 2.1.4 2.9 1.1l1.3-1.5A6 6 0 0 0 14.5 3z"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm.5-13H11v6l5.2 3.2.8-1.3-4.5-2.7z"/></svg>',
    truck: '<svg viewBox="0 0 24 24"><path d="M20 8h-3V4H3a2 2 0 0 0-2 2v11h2a3 3 0 0 0 6 0h6a3 3 0 0 0 6 0h2v-5zM6 18.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm13.5-9 2 2.5H17V9.5zM18 18.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/></svg>',
    help: '<svg viewBox="0 0 24 24"><path d="M11 18h2v-2h-2zm1-16a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm0-14a4 4 0 0 0-4 4h2a2 2 0 1 1 4 0c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5a4 4 0 0 0-4-4z"/></svg>',
    tag: '<svg viewBox="0 0 24 24"><path d="M21.4 11.6l-9-9A2 2 0 0 0 11 2H4a2 2 0 0 0-2 2v7c0 .6.2 1.1.6 1.4l9 9a2 2 0 0 0 2.8 0l7-7a2 2 0 0 0 0-2.8zM6.5 8a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/></svg>',
    spark: '<svg viewBox="0 0 24 24"><path d="M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9zM19 14l.9 2.6 2.6.9-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9zM5 15l.7 1.8 1.8.7-1.8.7L5 20l-.7-1.8-1.8-.7 1.8-.7z"/></svg>',
    gear: '<svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7 7 0 0 0-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84a.48.48 0 0 0-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.48.48 0 0 0-.59.22L2.74 8.87a.48.48 0 0 0 .12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.48.48 0 0 0-.12-.61zM12 15.6a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2z"/></svg>',
    copy: '<svg viewBox="0 0 24 24"><path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11z"/></svg>',
    camera: '<svg viewBox="0 0 24 24"><path d="M9 3 7.2 5H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.2L15 3zm3 15a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/></svg>',
    receipt: '<svg viewBox="0 0 24 24"><path d="M19 3H5a2 2 0 0 0-2 2v14l3-2 3 2 3-2 3 2 3-2 3 2V5a2 2 0 0 0-2-2zm-3 12H8v-2h8zm0-4H8V9h8zm0-4H8V5h8z"/></svg>'
  };

  // ---------- formatting ----------
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isNum = v => typeof v === 'number' && !isNaN(v);
  const gbp = (v, dp) => isNum(v) ? (v < 0 ? '−' : '') + '£' + Math.abs(v).toLocaleString('en-GB', { minimumFractionDigits: dp == null ? 2 : dp, maximumFractionDigits: dp == null ? 2 : dp }) : '—';
  const pct = v => isNum(v) && isFinite(v) ? Math.round(v * 100) + '%' : '—';
  const ukDate = iso => { if (!iso) return '—'; const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}/${m[2]}/${m[1]}` : esc(iso); };
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthKey = iso => iso ? iso.slice(0, 7) : '';
  const monthLabel = key => { const [y, m] = key.split('-'); return MONTHS_LONG[Number(m) - 1] + ' ' + y; };
  const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
  const statusClass = s => 's-' + String(s || 'In stock').toLowerCase().replace(/\s+/g, '');
  // Title Case, leaving short joining words lower case ("Bought on", "Days to Sell").
  const MINOR = ['a', 'an', 'the', 'and', 'but', 'or', 'nor', 'for', 'of', 'on', 'in', 'at', 'to', 'by', 'as', 'vs', 'per', 'via'];
  const tc = s => String(s || '').split(' ').map((w, i) => (i > 0 && MINOR.indexOf(w.toLowerCase()) >= 0) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  function profitOf(i) {
    if (!isNum(i.soldFor) || !isNum(i.cost)) return null;
    return i.soldFor - i.cost - (isNum(i.postage) ? i.postage : 0) - (isNum(i.fees) ? i.fees : 0);
  }
  // SKU sorting: bagged SKUs first, then pre-SKU items, oversized (OS) always last.
  const skuRank = i => /^SKU/.test(i.sku) ? 0 : /^PRE/.test(i.sku) ? 1 : 2;
  const skuNum = i => Number((String(i.sku).match(/(\d+)\s*$/) || [0, 0])[1]);
  const isSold = i => isNum(i.soldFor);
  const isBiz = i => i.use !== 'Personal';
  const sum = (arr, f) => arr.reduce((a, x) => a + (f(x) || 0), 0);
  function ageOf(i) { return i.boughtOn ? daysBetween(i.boughtOn, S.data.today) : null; }
  function ageBand(days) {
    if (days == null) return '';
    if (days >= S.data.settings.redDays) return 'bad';
    if (days >= S.data.settings.amberDays) return 'warn';
    return 'good';
  }

  function photoUrl(p, w) {
    if (!p) return '';
    if (/^https?:\/\//.test(p)) return p;
    if (/^[\w-]{20,}$/.test(p)) return 'https://lh3.googleusercontent.com/d/' + p + '=w' + (w || 600);
    return '';
  }
  function photoInner(i, w) {
    const u = photoUrl(i.photo, w);
    return `<div class="ph-none">${ICON.hanger}</div>${u ? `<img src="${esc(u)}" alt="" loading="lazy" onerror="this.parentNode.classList.remove('has');this.remove()">` : ''}`;
  }
  const hasPhoto = i => !!photoUrl(i.photo);
  function vintedUrl(i) {
    const v = String(i.listing || '').trim();
    if (!v) return '';
    if (/^https?:\/\//.test(v)) return v;
    const id = (S.data.listingIds || {})[v] || (/^\d{6,}$/.test(v) ? v : '');
    return id ? 'https://www.vinted.co.uk/items/' + id : '';
  }

  function toast(msg, err) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast on' + (err ? ' err' : '');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { t.className = 'toast' + (err ? ' err' : ''); }, err ? 5000 : 2600);
  }
  const errMsg = e => (e && e.message ? e.message : String(e)).replace(/^Exception:\s*/, '');

  // ---------- periods ----------
  function taxYearStart(today) {
    const y = Number(today.slice(0, 4));
    const start = `${y}-04-06`;
    return today >= start ? start : `${y - 1}-04-06`;
  }
  function periodRange() {
    const t = S.data.today;
    if (S.period === 'month') return [t.slice(0, 7) + '-01', t];
    if (S.period === '30') { const d = new Date(Date.parse(t) - 29 * 86400000); return [d.toISOString().slice(0, 10), t]; }
    if (S.period === 'tax') return [taxYearStart(t), t];
    return ['0000-00-00', '9999-12-31'];
  }
  const inRange = (iso, r) => !!iso && iso >= r[0] && iso <= r[1];

  function header(title, accent, sub, logo) {
    const now = new Date();
    const h = now.getHours();
    const greet = h < 12 ? 'Good Morning' : h < 18 ? 'Good Afternoon' : 'Good Evening';
    return `<div class="top">
      <div class="hd-left">${logo ? '<span class="logo-mark"><img src="logo.jpg" alt=""></span>' : ''}<div class="hello"><small>${greet} · ${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}</small>
      <h1>${esc(title)}${accent ? (title ? ' ' : '') + '<em>' + esc(accent) + '</em>' : ''}</h1></div></div>
      <div class="top-btns"><button class="icon-btn" data-refresh aria-label="Refresh">${ICON.refresh}</button><button class="icon-btn" data-goto="settings" aria-label="Settings">${ICON.gear}</button></div>
    </div>${sub ? `<p class="sub">${sub}</p>` : ''}`;
  }

  // ---------- dashboard ----------
  function renderDashboard() {
    const d = S.data, items = d.items, st = d.settings;
    const r = periodRange(), all = S.period === 'all';
    const sold = items.filter(i => isBiz(i) && isSold(i) && (all || inRange(i.soldOn, r)));
    const revenue = sum(sold, i => i.soldFor);
    const cogs = sum(sold, i => isNum(i.cost) ? i.cost : 0);
    const gross = sum(sold, i => profitOf(i) || 0);
    const exp = sum(d.expenses.filter(e => all || inRange(e.date, r)), e => isNum(e.amount) ? e.amount : 0);
    const net = gross - exp;
    const unknownCost = sold.filter(i => !isNum(i.cost)).length;
    const days = sold.map(i => i.boughtOn && i.soldOn ? daysBetween(i.boughtOn, i.soldOn) : null).filter(v => v != null);
    const avgDays = days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : null;
    const stock = items.filter(i => isBiz(i) && !isSold(i) && UNSOLD.indexOf(i.status) >= 0);
    const stockValue = sum(stock, i => isNum(i.cost) ? i.cost : 0);
    const listed = items.filter(i => i.status === 'Listed');
    const listedValue = sum(listed, i => isNum(i.listedAt) ? i.listedAt : 0);
    const transit = items.filter(i => i.status === 'In transit').length;
    const periodName = { all: 'All Time', month: 'This Month', '30': 'Last 30 Days', tax: 'This Tax Year' }[S.period];

    const v = $('#view-dashboard');
    v.innerHTML = `
      ${header('', 'Dashboard', '', true)}
      ${profileCard()}
      ${insightCards()}
      ${actionPanels()}
      <div class="hero">
        <div class="seg" id="periodSeg">
          ${[['all', 'All Time'], ['tax', 'Tax Year'], ['month', 'This Month'], ['30', '30 Days']].map(([k, l]) => `<button data-p="${k}" class="${S.period === k ? 'on' : ''}">${l}</button>`).join('')}
        </div>
        <div class="k">Net Profit · ${periodName}</div>
        <div class="v">${gbp(net)}</div>
        <div class="hero-row">
          <div><span>Revenue</span><b>${gbp(revenue)}</b></div>
          <div><span>Margin</span><b>${revenue ? pct(net / revenue) : '—'}</b></div>
          <div><span>Sales</span><b>${sold.length}</b></div>
        </div>
      </div>
      <div class="kpis">
        ${kpi(ICON.bag, 'Items in Stock', String(stock.length), `${listed.length} listed on Vinted`)}
        ${kpi(ICON.pound, 'Stock Value at Cost', gbp(stockValue), `listed at ${gbp(listedValue)}`)}
        ${kpi(ICON.clock, 'Average Days to Sell', avgDays == null ? '—' : avgDays + ' days', `cost of items sold ${gbp(cogs)}`)}
        ${kpi(ICON.truck, 'Sales in Transit', String(transit), `${gbp(exp)} expenses · ${unknownCost} unknown cost`)}
      </div>
      <div class="grid2">
        <div class="panel">
          <h3>Revenue and Profit by Month <span class="legend"><span><i style="background:var(--teal-hi)"></i>Revenue</span><span><i class="dotted"></i>Profit</span></span></h3>
          ${monthChart()}
        </div>
        <div class="panel">
          <h3>Stock Age <small>Days Since Bought</small></h3>
          ${agedPanel(stock)}
          <h3 style="margin-top:4px">To Do</h3>
          <div class="todo">
            <button data-go="stock" data-status="In stock">Bought but Not Listed Yet <span class="n">${items.filter(i => i.status === 'In stock').length}</span></button>
            <button data-go="stock" data-status="No photo">Items Without a Photo <span class="n">${items.filter(i => !isSold(i) && !hasPhoto(i)).length}</span></button>
            <button data-go="stock" data-aged="drop">Over ${st.dropDays} Days Old: Consider a Price Drop <span class="n">${stock.filter(i => (ageOf(i) || 0) >= st.dropDays).length}</span></button>
            <button data-go="stock" data-aged="relist">Listed ${st.relistDays}+ Days: Relist or Bump <span class="n">${items.filter(i => i.status === 'Listed' && (ageOf(i) || 0) >= st.relistDays).length}</span></button>
          </div>
        </div>
      </div>
      <div class="grid3">
        <div class="panel"><h3>Profit by Category <small>${periodName}</small></h3>${rankPanel(sold, i => i.category || 'Other')}</div>
        <div class="panel"><h3>Profit by Source <small>ROI on Cost</small></h3>${rankPanel(sold, i => i.boughtFrom || 'Unknown', true)}</div>
        <div class="panel"><h3>HMRC Check <small>Not Tax Advice</small></h3>${hmrcPanel()}</div>
      </div>`;
    wireChart();
    wireActionPanels(v);
    $$('#periodSeg button', v).forEach(b => b.onclick = () => { S.period = b.dataset.p; renderDashboard(); });
    $$('[data-go]', v).forEach(b => b.onclick = () => {
      S.stock.status = b.dataset.status || 'All';
      S.stock.sort = b.dataset.aged ? 'oldest' : 'newest';
      S.stock.aged = b.dataset.aged || '';
      go('stock');
    });
    $$('[data-band]', v).forEach(b => b.onclick = () => { S.stock.status = 'All'; S.stock.aged = b.dataset.band; S.stock.sort = 'oldest'; go('stock'); });
    $$('[data-sheet]', v).forEach(b => b.onclick = () => window.open(d.sheetUrl, '_blank'));
    const pe = $('#editProfile', v); if (pe) pe.onclick = openProfile;
    $$('[data-ins]', v).forEach(b => b.onclick = () => { S.insTab = b.dataset.ins; S.report.month = null; go('insights'); });
  }
  // ---------- To Post + Needs Checking (from the Gmail reader) ----------
  function actionPanels() {
    const a = S.data.auto || { inbox: [], toPost: [] };
    let html = '';
    if (a.toPost.length) {
      const rows = a.toPost.slice().sort((x, y) => (x.postBy || '9').localeCompare(y.postBy || '9'));
      html += `<div class="panel post-panel"><h3>To Post <small>${rows.length} Waiting</small></h3><div class="act-list">${rows.map(t => {
        const left = t.postBy ? daysBetween(S.data.today, t.postBy) : null;
        const cls = left == null ? '' : left <= 1 ? 'bad' : left <= 3 ? 'warn' : 'good';
        const it = S.data.items.filter(i => i.sku === t.sku)[0] || {};
        return `<div class="act">${thumbFor(it)}<div class="mid"><b>${esc(t.title)}</b><span>${esc(t.sku)}${t.postBy ? ` · Post by ${ukDate(t.postBy)}` : ' · label not made yet'}</span></div>
          ${left != null ? `<span class="due ${cls}">${left <= 0 ? 'Today' : left + 'd'}</span>` : ''}<button class="btn sm ghost" data-posted="${t.row}" data-sku="${esc(t.sku)}">Posted</button></div>`;
      }).join('')}</div></div>`;
    }
    if (a.inbox.length) {
      html += `<div class="panel check-panel"><h3>Needs Checking <small>From Your Vinted Emails</small></h3><div class="act-list">${a.inbox.map(e => {
        const d = e.details || {};
        if (e.type === 'Sale') {
          const cands = (d.candidates || []).filter(c => c.score > 0.3);
          const unsold = S.data.items.filter(i => !isSold(i)).sort((x, y) => x.sku.localeCompare(y.sku));
          return `<div class="act col"><div class="act-top">${d.img ? `<div class="th"><img src="${esc(d.img)}" alt=""></div>` : ''}<div class="mid"><b>Sold: ${esc(e.title)}</b><span>${gbp(e.price)} · ${ukDate(d.date || e.received)}${d.bundle ? ' · bundle: pick the main item, then mark the others sold by hand' : ''}</span></div></div>
            <div class="act-do"><select class="select" data-pick="${e.row}"><option value="">Which item sold?</option>${cands.map(c => `<option value="${esc(c.sku)}">${esc(c.sku)} · ${esc(c.title)} (best match)</option>`).join('')}${unsold.map(i => `<option value="${esc(i.sku)}">${esc(i.sku)} · ${esc(i.title)}</option>`).join('')}</select>
            <button class="btn sm" data-sale="${e.row}" data-id="${esc(e.id)}">Confirm</button><button class="btn sm ghost" data-dismiss="${e.row}" data-id="${esc(e.id)}">Ignore</button></div></div>`;
        }
        return `<div class="act col"><div class="act-top"><div class="ex-ic">${ICON.bag}</div><div class="mid"><b>Bought: ${esc(e.title)}</b><span>${gbp(e.price)} paid · ${ukDate(d.date || e.received)}${d.seller ? ' · from ' + esc(d.seller) : ''}${d.bundle ? ' · bundle: add each item, then tap Done' : ''}</span></div></div>
          <div class="act-do"><button class="btn sm" data-addbuy="${e.row}" data-id="${esc(e.id)}">Add as Item</button>${d.bundle ? `<button class="btn sm ghost" data-done="${e.row}" data-id="${esc(e.id)}">Done</button>` : ''}<button class="btn sm ghost" data-dismiss="${e.row}" data-id="${esc(e.id)}">Ignore</button></div></div>`;
      }).join('')}</div></div>`;
    }
    return html;
  }
  function thumbFor(i) { return `<div class="th">${photoInner(i, 200)}</div>`; }

  function wireActionPanels(v) {
    const a = S.data.auto || { inbox: [] };
    const after = res => { S.data.auto = res.auto || res; render(); };
    $$('[data-posted]', v).forEach(b => b.onclick = () => { b.disabled = true; call('markPosted', Number(b.dataset.posted), b.dataset.sku).then(r => { S.data.auto = r; render(); toast('Marked as Posted'); }).catch(e => { b.disabled = false; toast(errMsg(e), true); }); });
    $$('[data-dismiss]', v).forEach(b => b.onclick = () => { b.disabled = true; call('resolveInbox', Number(b.dataset.dismiss), b.dataset.id, 'dismiss', '').then(r => { S.data.auto = r; render(); }).catch(e => { b.disabled = false; toast(errMsg(e), true); }); });
    $$('[data-done]', v).forEach(b => b.onclick = () => { b.disabled = true; call('resolveInbox', Number(b.dataset.done), b.dataset.id, 'done', '').then(r => { S.data.auto = r; render(); }).catch(e => { b.disabled = false; toast(errMsg(e), true); }); });
    $$('[data-sale]', v).forEach(b => b.onclick = () => {
      const sku = $(`[data-pick="${b.dataset.sale}"]`, v).value;
      if (!sku) { toast('Pick which item sold first.', true); return; }
      b.disabled = true;
      call('resolveInbox', Number(b.dataset.sale), b.dataset.id, 'sale', sku).then(() => refresh(true)).then(() => toast(sku + ' Marked as Sold')).catch(e => { b.disabled = false; toast(errMsg(e), true); });
    });
    $$('[data-addbuy]', v).forEach(b => b.onclick = () => {
      const e = a.inbox.filter(x => String(x.row) === b.dataset.addbuy)[0];
      const d = e.details || {};
      openNew({ title: d.bundle ? '' : e.title, cost: d.bundle ? '' : e.price, boughtFrom: 'Vinted', boughtOn: d.date || e.received, notes: 'Vinted order "' + e.title + '"' + (d.seller ? ' from ' + d.seller : '') }, saved => {
        if (!d.bundle) call('resolveInbox', e.row, e.id, 'done', '').then(r => { S.data.auto = r; render(); }).catch(() => {});
      });
    });
    void after;
  }

  function kpi(ic, k, v, dsc) { return `<div class="kpi"><div class="ic">${ic}</div><div><div class="k">${k}</div><div class="v">${v}</div></div><div class="d">${dsc}</div></div>`; }

  function profileCard() {
    const p = S.data.profile || {};
    const items = S.data.items;
    const biz = items.filter(i => isSold(i) && isBiz(i)).length;
    const pers = items.filter(i => isSold(i) && !isBiz(i)).length;
    const rating = Number(p.rating);
    const stars = isFinite(rating) && rating > 0 ? '★★★★★'.slice(0, Math.round(rating)) + '☆☆☆☆☆'.slice(0, 5 - Math.round(rating)) : '';
    const photo = photoUrl(p.photo, 200);
    const name = p.username ? '@' + p.username.replace(/^@/, '') : 'Add Your Vinted Profile';
    return `<div class="profile">
      <div class="avatar"><span style="${photo ? `background-image:url('${esc(photo)}')` : ''}">${photo ? '' : esc((p.username || 'V').replace(/^@/, '').charAt(0).toUpperCase())}</span></div>
      <div class="p-mid">
        <div class="p-name">${esc(name)}</div>
        <div class="p-stars">${stars ? `<b>${stars}</b>${rating.toFixed(1)}` : ''}${p.reviews ? ` · ${esc(p.reviews)} Reviews` : stars ? '' : 'Tap the pencil to add your photo, username and reviews'}</div>
        <div class="p-stats">
          <div><b>${biz}</b><span>Business Sales</span></div>
          <div><b>${pers}</b><span>Personal Sales</span></div>
          <div><b>${biz + pers}</b><span>Total Sales</span></div>
        </div>
      </div>
      <button class="icon-btn" id="editProfile" aria-label="Edit profile">${ICON.edit}</button>
    </div>`;
  }

  // Smooth line through points (Catmull-Rom turned into Bézier curves).
  function smooth(pts) {
    if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : '';
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0]},${p2[1].toFixed(1)}`;
    }
    return d;
  }

  function monthSeries() {
    const sold = S.data.items.filter(i => isBiz(i) && isSold(i) && i.soldOn);
    const byM = {};
    sold.forEach(i => { const k = monthKey(i.soldOn); byM[k] = byM[k] || { rev: 0, prof: 0, n: 0, exp: 0 }; byM[k].rev += i.soldFor; byM[k].prof += profitOf(i) || 0; byM[k].n++; });
    S.data.expenses.forEach(e => { const k = monthKey(e.date); if (byM[k] && isNum(e.amount)) { byM[k].prof -= e.amount; byM[k].exp += e.amount; } });
    return Object.keys(byM).sort().slice(-8).map(k => Object.assign({ k }, byM[k]));
  }

  function monthChart() {
    const ms = monthSeries();
    if (!ms.length) return '<div class="empty">No sales yet.</div>';
    const narrow = window.innerWidth < 700;
    const W = narrow ? 340 : 600, H = narrow ? 200 : 250, L = 12, R = 12, T = 18, B = 30;
    const hi = Math.max(...ms.map(m => Math.max(m.rev, m.prof)), 1);
    const lo = Math.min(0, ...ms.map(m => m.prof));
    const xs = n => ms.length === 1 ? W / 2 : L + n * (W - L - R) / (ms.length - 1);
    const y = v => T + (hi - v) / (hi - lo) * (H - T - B);
    const rev = ms.map((m, n) => [xs(n), y(m.rev)]);
    const prof = ms.map((m, n) => [xs(n), y(m.prof)]);
    const area = smooth(rev) + ` L${rev[rev.length - 1][0]},${y(lo)} L${rev[0][0]},${y(lo)} Z`;
    const grid = [0.25, 0.5, 0.75, 1].map(f => `<line x1="0" x2="${W}" y1="${y(hi * f)}" y2="${y(hi * f)}" class="gl"/>`).join('');
    const zero = lo < 0 ? `<line x1="0" x2="${W}" y1="${y(0)}" y2="${y(0)}" class="zl"/>` : '';
    const anchor = n => ms.length === 1 ? 'middle' : n === 0 ? 'start' : n === ms.length - 1 ? 'end' : 'middle';
    const labels = ms.map((m, n) => `<text x="${xs(n)}" y="${H - 8}" text-anchor="${anchor(n)}">${MONTHS[Number(m.k.slice(5)) - 1]}</text>`).join('');
    const hits = ms.map((m, n) => {
      const half = ms.length === 1 ? W / 2 : (W - L - R) / (ms.length - 1) / 2;
      return `<rect class="hit" data-i="${n}" x="${Math.max(0, xs(n) - half)}" y="0" width="${half * 2}" height="${H}"/>`;
    }).join('');
    S.chart = { ms, rev, prof, W, H };
    return `<div class="chart-head" id="chartHead"></div>
      <div class="chart-wrap">
        <svg class="chart" id="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Revenue and profit by month">
          <defs>
            <linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2FD1D8" stop-opacity=".42"/><stop offset=".6" stop-color="#007782" stop-opacity=".12"/><stop offset="1" stop-color="#007782" stop-opacity="0"/></linearGradient>
            <linearGradient id="gLine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0C8E99"/><stop offset="1" stop-color="#5BE3EA"/></linearGradient>
            <filter id="glow" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          </defs>
          ${grid}${zero}
          <path d="${area}" fill="url(#gArea)"/>
          <path d="${smooth(rev)}" fill="none" stroke="url(#gLine)" stroke-width="3.5" stroke-linecap="round" filter="url(#glow)"/>
          <path d="${smooth(prof)}" fill="none" stroke="rgba(243,241,236,.85)" stroke-width="2" stroke-dasharray="1 6" stroke-linecap="round"/>
          <line id="cGuide" class="guide" x1="0" x2="0" y1="${T - 6}" y2="${H - B}"/>
          <circle id="cRev" r="6" class="dot-rev"/><circle id="cProf" r="4.5" class="dot-prof"/>
          ${labels}${hits}
        </svg>
      </div>
      <p class="fine">Tap a month. The solid line is revenue; the dotted line is net profit after that month's expenses.</p>`;
  }

  function wireChart() {
    const c = S.chart, svg = $('#chart');
    if (!c || !svg) return;
    const show = n => {
      const m = c.ms[n];
      $('#chartHead').innerHTML = `<div><span>${monthLabel(m.k)}</span><b>${gbp(m.rev)}</b></div>
        <div class="ch-stats"><div><span>Net Profit</span><b class="${m.prof < 0 ? 'neg' : 'pos'}">${gbp(m.prof)}</b></div><div><span>Sales</span><b>${m.n}</b></div><div><span>Expenses</span><b>${gbp(m.exp)}</b></div></div>`;
      $('#cGuide', svg).setAttribute('x1', c.rev[n][0]); $('#cGuide', svg).setAttribute('x2', c.rev[n][0]);
      $('#cRev', svg).setAttribute('cx', c.rev[n][0]); $('#cRev', svg).setAttribute('cy', c.rev[n][1]);
      $('#cProf', svg).setAttribute('cx', c.prof[n][0]); $('#cProf', svg).setAttribute('cy', c.prof[n][1]);
      $$('text', svg).forEach((t, i) => t.classList.toggle('on', i === n));
    };
    $$('.hit', svg).forEach(r => { r.addEventListener('click', () => show(Number(r.dataset.i))); r.addEventListener('mouseenter', () => show(Number(r.dataset.i))); });
    show(c.ms.length - 1);
  }

  function agedPanel(stock) {
    const st = S.data.settings;
    const c = { good: 0, warn: 0, bad: 0 };
    stock.forEach(i => { const b = ageBand(ageOf(i)); if (b) c[b]++; });
    return `<div class="aged">
      <button class="a-good" data-band="good"><span class="v">${c.good}</span><span class="l">Under ${st.amberDays} Days</span></button>
      <button class="a-warn" data-band="warn"><span class="v">${c.warn}</span><span class="l">${st.amberDays}–${st.redDays - 1} Days</span></button>
      <button class="a-bad" data-band="bad"><span class="v">${c.bad}</span><span class="l">${st.redDays}+ Days</span></button>
    </div>`;
  }

  function rankPanel(sold, keyFn, roi) {
    const g = {};
    sold.forEach(i => { const k = keyFn(i); g[k] = g[k] || { p: 0, c: 0, n: 0 }; g[k].p += profitOf(i) || 0; g[k].c += isNum(i.cost) ? i.cost : 0; g[k].n++; });
    const rows = Object.keys(g).map(k => ({ k, ...g[k] })).sort((a, b) => b.p - a.p).slice(0, 6);
    if (!rows.length) return '<div class="empty">No sales in this period.</div>';
    const max = Math.max(...rows.map(r => r.p), 1);
    return `<div class="rank">${rows.map(r => `<div class="row"><b>${esc(r.k)} <span class="count">· ${r.n}</span></b><span>${gbp(r.p)}${roi ? ` · ${r.c ? pct(r.p / r.c) : '—'}` : ''}</span><div class="bar"><i style="width:${Math.max(2, r.p / max * 100)}%"></i></div></div>`).join('')}</div>`;
  }

  function hmrcPanel() {
    const d = S.data, st = d.settings, t = d.today, yr = t.slice(0, 4);
    // Vinted reports every sale it handles in a calendar year, business or personal.
    const cal = d.items.filter(i => isSold(i) && i.soldOn && i.soldOn.slice(0, 4) === yr && (i.channel || 'Vinted') === 'Vinted');
    const calSales = cal.length, calIncome = sum(cal, i => i.soldFor);
    const ty = taxYearStart(t);
    const tyIncome = sum(d.items.filter(i => isBiz(i) && isSold(i) && i.soldOn >= ty), i => i.soldFor);
    const tyEnd = (Number(ty.slice(0, 4)) + 1) + '-04-05';
    const m = (label, val, lim, fmt) => {
      const p = Math.min(100, val / lim * 100);
      return `<div class="meter"><div class="top">${label}<span>${fmt(val)} / ${fmt(lim)}</span></div><div class="track"><i class="${p >= 100 ? 'bad' : p >= 75 ? 'warn' : ''}" style="width:${p}%"></i></div></div>`;
    };
    return `${m(`Vinted Sales in ${yr}`, calSales, st.hmrcSales, v => String(v))}
      ${m(`Vinted Income in ${yr}`, calIncome, st.hmrcIncome, v => gbp(v, 0))}
      ${m(`Business Income to ${ukDate(tyEnd)}`, tyIncome, st.allowance, v => gbp(v, 0))}
      <p class="fine">Vinted tells HMRC about sellers with ${st.hmrcSales}+ sales or about £${st.hmrcIncome.toLocaleString('en-GB')} in a calendar year. The £${st.allowance.toLocaleString('en-GB')} trading allowance is per tax year, on income before costs.</p>`;
  }

  // ---------- insights: monthly report + leaderboard ----------
  const bizSales = () => S.data.items.filter(i => isBiz(i) && isSold(i) && i.soldOn);
  const shiftMonth = (key, n) => { const [y, m] = key.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return d.toISOString().slice(0, 7); };
  const daysIn = key => { const [y, m] = key.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
  function weekOf(iso) { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7); return d.toISOString().slice(0, 10); }
  const addDays = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);

  function reportMonths() {
    const first = bizSales().map(i => monthKey(i.soldOn)).sort()[0];
    const now = monthKey(S.data.today), out = [];
    for (let k = first || now; k <= now; k = shiftMonth(k, 1)) out.push(k);
    return out;
  }
  // The fresh report is last month's during the first week, otherwise this month so far.
  const defaultReport = () => Number(S.data.today.slice(8)) <= 7 ? shiftMonth(monthKey(S.data.today), -1) : monthKey(S.data.today);

  function monthStats(key) {
    const sold = bizSales().filter(i => monthKey(i.soldOn) === key);
    const known = sold.filter(i => profitOf(i) != null);
    const gross = sum(known, profitOf);
    const exp = sum(S.data.expenses.filter(e => monthKey(e.date) === key), e => isNum(e.amount) ? e.amount : 0);
    const days = sold.filter(i => i.boughtOn).map(i => daysBetween(i.boughtOn, i.soldOn));
    const bought = S.data.items.filter(i => isBiz(i) && monthKey(i.boughtOn) === key);
    return {
      key, sold, known, n: sold.length, rev: sum(sold, i => i.soldFor), gross, exp, net: gross - exp,
      avgProfit: known.length ? gross / known.length : null,
      avgDays: days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : null,
      bought: bought.length, spent: sum(bought, i => isNum(i.cost) ? i.cost : 0),
      unknown: sold.length - known.length
    };
  }

  // Weeks in a row (Monday to Sunday) with at least one business sale, up to the given day.
  function streaks(upTo) {
    const weeks = new Set(bizSales().filter(i => i.soldOn <= upTo).map(i => weekOf(i.soldOn)));
    let w = weekOf(upTo), cur = 0;
    if (!weeks.has(w) && upTo === S.data.today) w = addDays(w, -7); // this week isn't over yet
    while (weeks.has(w)) { cur++; w = addDays(w, -7); }
    let best = 0, run = 0, prev = null;
    Array.from(weeks).sort().forEach(x => { run = prev && addDays(prev, 7) === x ? run + 1 : 1; best = Math.max(best, run); prev = x; });
    return { cur, best };
  }

  const SALE_MARKS = [1, 10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 750, 1000];
  const PROFIT_MARKS = [100, 250, 500, 750, 1000, 1500, 2000, 3000, 4000, 5000, 7500, 10000, 15000, 20000];
  function milestones(st, prevMonths) {
    const out = [], start = st.key + '-01', end = st.key + '-31';
    const all = bizSales();
    const before = all.filter(i => i.soldOn < start), upto = all.filter(i => i.soldOn <= end);
    SALE_MARKS.forEach(m => { if (before.length < m && upto.length >= m) out.push({ ic: '🏷️', t: m === 1 ? 'First Sale' : `${m} Sales`, d: m === 1 ? 'The very first one' : 'Lifetime business sales' }); });
    const pb = sum(before, i => profitOf(i) || 0), pu = sum(upto, i => profitOf(i) || 0);
    PROFIT_MARKS.forEach(m => { if (pb < m && pu >= m) out.push({ ic: '💷', t: gbp(m, 0) + ' Profit', d: 'Lifetime profit on sales' }); });
    if (st.n && prevMonths.length && prevMonths.every(p => st.net > p.net)) out.push({ ic: '🏆', t: 'Best Month Ever', d: 'Highest net profit so far' });
    const goal = S.data.settings.monthlyGoal;
    if (goal > 0 && st.net >= goal) out.push({ ic: '🎯', t: 'Goal Smashed', d: `${gbp(st.net, 0)} of ${gbp(goal, 0)}` });
    return out;
  }

  function deltaTag(now, then, lowerBetter, fmt) {
    if (!isNum(now) || !isNum(then)) return '<span class="dl">—</span>';
    const diff = now - then;
    if (Math.abs(diff) < 0.005) return '<span class="dl">Same</span>';
    const good = lowerBetter ? diff < 0 : diff > 0;
    return `<span class="dl ${good ? 'up' : 'down'}">${diff > 0 ? '▲' : '▼'} ${fmt(Math.abs(diff))}</span>`;
  }

  function goalRing(net, goal) {
    const p = Math.max(0, Math.min(1, net / goal)), R = 52, C = 2 * Math.PI * R;
    return `<div class="ring-wrap"><svg class="ring" viewBox="0 0 128 128">
        <circle cx="64" cy="64" r="${R}" class="ring-bg"/>
        <circle cx="64" cy="64" r="${R}" class="ring-fg" stroke-dasharray="${(C * p).toFixed(1)} ${C.toFixed(1)}"/>
      </svg><div class="ring-mid"><b>${Math.round(net / goal * 100)}%</b><span>of ${gbp(goal, 0)}</span></div></div>`;
  }

  function calendar(st) {
    const counts = {};
    st.sold.forEach(i => { const d = Number(i.soldOn.slice(8)); counts[d] = (counts[d] || 0) + 1; });
    const lead = (new Date(st.key + '-01T00:00:00Z').getUTCDay() + 6) % 7;
    const today = S.data.today, n = daysIn(st.key);
    let cells = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => `<i class="cal-h">${d}</i>`).join('') + '<i></i>'.repeat(lead);
    for (let d = 1; d <= n; d++) {
      const iso = st.key + '-' + String(d).padStart(2, '0'), c = counts[d] || 0;
      cells += `<i class="cal-d${c ? ' l' + Math.min(c, 3) : ''}${iso === today ? ' now' : ''}${iso > today ? ' fut' : ''}" title="${c} sale${c === 1 ? '' : 's'}">${d}</i>`;
    }
    return `<div class="cal">${cells}</div>`;
  }

  function highlight(label, i, val) {
    return `<button class="hl" data-sku="${esc(i.sku)}"><div class="th">${photoInner(i, 200)}</div><div><small>${label}</small><b>${esc(i.title || i.sku)}</b><span>${val}</span></div></button>`;
  }

  function renderReport(v) {
    const months = reportMonths();
    let key = S.report.month || defaultReport();
    if (months.indexOf(key) < 0) key = months[months.length - 1];
    S.report.month = key;
    const ix = months.indexOf(key), live = key === monthKey(S.data.today);
    const st = monthStats(key), pv = monthStats(shiftMonth(key, -1));
    const prevMonths = months.slice(0, ix).map(monthStats);
    const end = live ? S.data.today : key + '-' + daysIn(key);
    const sk = streaks(end), ms = milestones(st, prevMonths), goal = S.data.settings.monthlyGoal;
    const mName = MONTHS_LONG[Number(key.slice(5)) - 1];

    const k = st.known;
    const best = k.slice().sort((a, b) => profitOf(b) - profitOf(a))[0];
    const roiOf = i => i.cost > 0 ? profitOf(i) / i.cost : null;
    const bestRoi = k.filter(i => roiOf(i) != null && i !== best).sort((a, b) => roiOf(b) - roiOf(a))[0];
    const fast = st.sold.filter(i => i.boughtOn).sort((a, b) => daysBetween(a.boughtOn, a.soldOn) - daysBetween(b.boughtOn, b.soldOn))[0];
    const brands = {};
    st.sold.forEach(i => { const b = (i.brand || '').trim(); if (!b) return; brands[b] = brands[b] || { n: 0, p: 0 }; brands[b].n++; brands[b].p += profitOf(i) || 0; });
    const topBrand = Object.keys(brands).sort((a, b) => brands[b].p - brands[a].p)[0];
    const cats = {};
    st.sold.forEach(i => { const c = i.category || 'Other'; cats[c] = (cats[c] || 0) + 1; });
    const catRows = Object.keys(cats).sort((a, b) => cats[b] - cats[a]);
    const shown = catRows.slice(0, 5), restN = sum(catRows.slice(5), c => cats[c]);

    const cmp = [
      ['Sales', st.n, pv.n, false, x => String(Math.round(x)), x => String(x)],
      ['Revenue', st.rev, pv.rev, false, x => gbp(x, 0), x => gbp(x)],
      ['Net Profit', st.net, pv.net, false, x => gbp(x, 0), x => gbp(x)],
      ['Profit per Sale', st.avgProfit, pv.avgProfit, false, x => gbp(x), x => gbp(x)],
      ['Days to Sell', st.avgDays, pv.avgDays, true, x => Math.round(x) + 'd', x => isNum(x) ? x + ' days' : '—'],
      ['Items Bought', st.bought, pv.bought, false, x => String(Math.round(x)), x => String(x)],
      ['Spent on Stock', st.spent, pv.spent, true, x => gbp(x, 0), x => gbp(x)],
      ['Expenses', st.exp, pv.exp, true, x => gbp(x, 0), x => gbp(x)]
    ];

    v.querySelector('#insBody').innerHTML = `
      <div class="rep-nav">
        <button class="icon-btn" id="repPrev" ${ix > 0 ? '' : 'disabled'} aria-label="Previous month">${ICON.prev}</button>
        <div><b>${mName} ${key.slice(0, 4)}</b><small>${live ? 'So Far This Month' : 'Monthly Report'}</small></div>
        <button class="icon-btn" id="repNext" ${ix < months.length - 1 ? '' : 'disabled'} aria-label="Next month">${ICON.next}</button>
      </div>
      <div class="hero rep-hero">
        <div class="rep-top"><span class="logo-mark sm"><img src="logo.jpg" alt=""></span><span>Your ${mName}${live ? ' So Far' : ''}</span></div>
        <div class="k">Net Profit</div>
        <div class="v">${gbp(st.net)}</div>
        <p class="rep-line">${st.n ? `${st.n} sale${st.n === 1 ? '' : 's'} · ${gbp(st.rev)} revenue` : 'No sales this month yet'}${pv.n || pv.net ? ` · ${st.net >= pv.net ? '▲' : '▼'} ${gbp(Math.abs(st.net - pv.net), 0)} vs ${MONTHS[Number(pv.key.slice(5)) - 1]}` : ''}</p>
        <div class="hero-row">
          <div><span>Week Streak</span><b>${sk.cur} 🔥</b></div>
          <div><span>Best Streak</span><b>${sk.best}</b></div>
          <div><span>Bought</span><b>${st.bought}</b></div>
        </div>
      </div>
      ${ms.length ? `<div class="panel"><h3>Milestones <small>${ms.length} This Month</small></h3><div class="badges">${ms.map(m => `<div class="badge"><i>${m.ic}</i><b>${esc(m.t)}</b><span>${esc(m.d)}</span></div>`).join('')}</div></div>` : ''}
      <div class="grid2">
        <div class="panel">
          <h3>Sales Calendar <small>${Object.keys(st.sold.reduce((a, i) => (a[i.soldOn] = 1, a), {})).length} Selling Days</small></h3>
          ${calendar(st)}
          <p class="fine">Keep a sale going every week to grow your streak. The current week doesn't break it until it's over.</p>
        </div>
        <div class="panel">
          <h3>Monthly Goal <small>Net Profit</small></h3>
          ${goal > 0 ? goalRing(st.net, goal) + `<p class="fine" style="text-align:center">${st.net >= goal ? 'Goal reached. Nice work!' : live ? `${gbp(goal - st.net)} to go with ${daysIn(key) - Number(S.data.today.slice(8))} days left.` : `Finished ${gbp(goal - st.net)} short.`}</p>` : `<div class="empty" style="padding:24px 12px">No goal set yet.</div><button class="btn ghost" data-goto="settings">Set a Monthly Goal</button>`}
        </div>
      </div>
      <div class="panel">
        <h3>Compared to ${MONTHS_LONG[Number(pv.key.slice(5)) - 1]}</h3>
        <div class="cmp">${cmp.map(([l, a, b, lower, df, f]) => `<div class="cmp-row"><span>${l}</span><b>${f(a)}</b>${deltaTag(a, b, lower, df)}</div>`).join('')}</div>
        ${st.unknown ? `<p class="fine">${st.unknown} sale${st.unknown === 1 ? ' has' : 's have'} an unknown cost, so ${st.unknown === 1 ? "it isn't" : "they aren't"} counted in profit.</p>` : ''}
      </div>
      ${st.n ? `<div class="panel">
        <h3>Highlights</h3>
        <div class="hls">
          ${best ? highlight('Best Flip', best, gbp(profitOf(best)) + ' profit') : ''}
          ${bestRoi ? highlight('Highest ROI', bestRoi, pct(roiOf(bestRoi)) + ' on ' + gbp(bestRoi.cost)) : ''}
          ${fast ? highlight('Fastest Sale', fast, daysBetween(fast.boughtOn, fast.soldOn) + ' days from buying') : ''}
          ${topBrand ? `<button class="hl" data-brand="${esc(topBrand)}"><div class="th hl-ic">${ICON.tag}</div><div><small>Top Brand</small><b>${esc(topBrand)}</b><span>${brands[topBrand].n} sold · ${gbp(brands[topBrand].p)} profit</span></div></button>` : ''}
        </div>
      </div>
      <div class="panel">
        <h3>What Sold <small>By Category</small></h3>
        <div class="split">${shown.map((c, n) => `<i style="flex:${cats[c]};opacity:${1 - n * 0.16}"></i>`).join('')}${restN ? `<i style="flex:${restN};opacity:.2"></i>` : ''}</div>
        <div class="rank">${shown.map(c => `<div class="row"><b>${esc(c)}</b><span>${cats[c]} · ${pct(cats[c] / st.n)}</span></div>`).join('')}${restN ? `<div class="row"><b>Everything Else</b><span>${restN} · ${pct(restN / st.n)}</span></div>` : ''}</div>
      </div>` : ''}`;

    $('#repPrev', v).onclick = () => { S.report.month = months[ix - 1]; renderInsights(); };
    $('#repNext', v).onclick = () => { S.report.month = months[ix + 1]; renderInsights(); };
    $$('.hl[data-sku]', v).forEach(b => b.onclick = () => openItem(b.dataset.sku));
    $$('.hl[data-brand]', v).forEach(b => b.onclick = () => { S.sold = { q: b.dataset.brand, use: 'Business', month: key }; go('sold'); });
    $$('[data-goto]', v).forEach(b => b.onclick = () => go(b.dataset.goto));

    // Confetti once per month for each new set of milestones.
    const tag = 'vt-cele-' + key, sig = ms.map(m => m.t).join('|');
    let seen = ''; try { seen = localStorage.getItem(tag) || ''; } catch (e) { /* private mode */ }
    if (sig && seen !== sig) { try { localStorage.setItem(tag, sig); } catch (e) { /* private mode */ } setTimeout(confetti, 250); }
  }

  function confetti() {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const c = document.createElement('canvas'), x = c.getContext('2d');
    c.className = 'confetti'; document.body.appendChild(c);
    const W = c.width = innerWidth, H = c.height = innerHeight;
    const cols = ['#6AE8EE', '#1FB5C1', '#007782', '#F3F1EC', '#5FD49A', '#F2B45A'];
    const ps = Array.from({ length: 140 }, () => ({ x: W / 2 + (Math.random() - .5) * W * .3, y: H * .35, vx: (Math.random() - .5) * 14, vy: -Math.random() * 14 - 4, r: Math.random() * 6.28, vr: (Math.random() - .5) * .3, w: 6 + Math.random() * 6, c: cols[Math.floor(Math.random() * cols.length)] }));
    const t0 = performance.now();
    (function frame(t) {
      x.clearRect(0, 0, W, H);
      ps.forEach(p => { p.vy += .35; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.w / 2, -p.w / 4, p.w, p.w / 2); x.restore(); });
      if (t - t0 < 3200) requestAnimationFrame(frame); else c.remove();
    })(t0);
  }

  function leaderRows() {
    const f = S.lead, t = S.data.today;
    const from = f.period === 'tax' ? taxYearStart(t) : f.period === '90' ? addDays(t, -89) : f.period === 'year' ? t.slice(0, 4) + '-01-01' : '0000';
    const keyOf = i => f.by === 'brand' ? ((i.brand || '').trim() || 'No Brand') : (i.category || 'Other');
    const g = {};
    const grp = i => { const k = keyOf(i), id = k.toLowerCase(); return g[id] = g[id] || { k, n: 0, p: 0, c: 0, kn: 0, dSum: 0, dN: 0, stock: 0, allSold: 0 }; };
    S.data.items.filter(isBiz).forEach(i => {
      const r = grp(i);
      if (isSold(i)) r.allSold++; else if (UNSOLD.indexOf(i.status) >= 0) r.stock++;
      if (!isSold(i) || !i.soldOn || i.soldOn < from) return;
      r.n++;
      const p = profitOf(i);
      if (p != null) { r.p += p; r.c += i.cost; r.kn++; }
      if (i.boughtOn) { r.dSum += daysBetween(i.boughtOn, i.soldOn); r.dN++; }
    });
    const rows = Object.keys(g).map(id => {
      const r = g[id];
      return Object.assign(r, { roi: r.c > 0 ? r.p / r.c : null, days: r.dN ? Math.round(r.dSum / r.dN) : null, avg: r.kn ? r.p / r.kn : null, thru: r.allSold + r.stock ? r.allSold / (r.allSold + r.stock) : null });
    }).filter(r => r.n > 0);
    const ok = r => f.sort === 'profit' ? true : f.sort === 'roi' ? r.kn >= 2 && r.roi != null : r.dN >= 2;
    const val = r => f.sort === 'profit' ? r.p : f.sort === 'roi' ? r.roi : -r.days;
    const ranked = rows.filter(ok).sort((a, b) => val(b) - val(a) || b.n - a.n);
    const rest = rows.filter(r => !ok(r)).sort((a, b) => b.n - a.n || b.p - a.p);
    return { ranked, rest };
  }

  function renderLeaderboard(v) {
    const f = S.lead, { ranked, rest } = leaderRows();
    const metric = r => f.sort === 'profit' ? gbp(r.p) : f.sort === 'roi' ? pct(r.roi) : r.days + ' days';
    const top = ranked.length ? (f.sort === 'speed' ? Math.max(...ranked.map(r => r.days), 1) : Math.max(...ranked.map(r => f.sort === 'roi' ? r.roi : r.p), 0.01)) : 1;
    const barW = r => f.sort === 'speed' ? Math.max(4, (1 - r.days / (top + 1)) * 100) : Math.max(3, (f.sort === 'roi' ? r.roi : r.p) / top * 100);
    const row = (r, n) => `<button class="lb-row${n == null ? ' dim' : ''}" data-k="${esc(r.k)}">
        <span class="lb-pos${n != null && n < 3 ? ' m' + n : ''}">${n == null ? '–' : n + 1}</span>
        <span class="lb-name"><b>${esc(r.k)}</b><small>${r.n} sold${r.stock ? ` · ${r.stock} in stock` : ''}${r.thru != null ? ` · ${pct(r.thru)} sell-through` : ''}</small></span>
        <span class="lb-val"><b>${n == null ? '—' : metric(r)}</b><small>${[f.sort !== 'profit' ? gbp(r.p, 0) : r.roi != null ? pct(r.roi) + ' ROI' : '', f.sort !== 'speed' && r.days != null ? r.days + 'd' : f.sort === 'speed' && r.avg != null ? gbp(r.avg) + ' avg' : ''].filter(Boolean).join(' · ')}</small></span>
        ${n == null ? '' : `<span class="lb-bar"><i style="width:${barW(r).toFixed(1)}%"></i></span>`}
      </button>`;
    v.querySelector('#insBody').innerHTML = `
      <div class="lb-ctrls">
        <div class="seg" id="lbBy">${[['brand', 'Brands'], ['category', 'Categories']].map(([k, l]) => `<button data-v="${k}" class="${f.by === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        <div class="seg" id="lbSort">${[['profit', 'Profit'], ['roi', 'ROI'], ['speed', 'Speed']].map(([k, l]) => `<button data-v="${k}" class="${f.sort === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        <div class="seg" id="lbPeriod">${[['all', 'All Time'], ['tax', 'Tax Year'], ['year', String(S.data.today.slice(0, 4))], ['90', '90 Days']].map(([k, l]) => `<button data-v="${k}" class="${f.period === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      </div>
      <div class="panel">
        <h3>${f.by === 'brand' ? 'Brand' : 'Category'} Leaderboard <small>${{ profit: 'Total Profit', roi: 'Return on Cost', speed: 'Fastest to Sell' }[f.sort]}</small></h3>
        ${ranked.length ? `<div class="lb">${ranked.map(row).join('')}</div>` : '<div class="empty">No sales in this period.</div>'}
        ${rest.length ? `<h3 style="margin-top:6px">Not Ranked Yet <small>Fewer Than 2 Sales${f.sort === 'roi' ? ' with a Known Cost' : ''}</small></h3><div class="lb">${rest.map(r => row(r, null)).join('')}</div>` : ''}
        <p class="fine">${f.sort === 'speed' ? 'Average days from buying to selling.' : f.sort === 'roi' ? 'Profit divided by what you paid, for sales with a known cost.' : 'Profit after cost, postage and fees. Sales with an unknown cost add nothing.'} Sell-through is all-time sold ÷ (sold + still in stock).${f.by === 'brand' ? ' Tap a brand to see its sales.' : ''}</p>
      </div>`;
    [['#lbBy', 'by'], ['#lbSort', 'sort'], ['#lbPeriod', 'period']].forEach(([sel, k]) => $$(sel + ' button', v).forEach(b => b.onclick = () => { S.lead[k] = b.dataset.v; renderInsights(); }));
    if (f.by === 'brand') $$('.lb-row', v).forEach(b => b.onclick = () => { S.sold = { q: b.dataset.k === 'No Brand' ? '' : b.dataset.k, use: 'Business', month: 'All' }; go('sold'); });
  }

  function renderInsights() {
    const v = $('#view-insights');
    v.innerHTML = `${header('', 'Insights')}
      <div class="seg ins-tabs" id="insTabs">${[['report', 'Monthly Report'], ['leaders', 'Leaderboard']].map(([k, l]) => `<button data-t="${k}" class="${S.insTab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div id="insBody"></div>`;
    $$('#insTabs button', v).forEach(b => b.onclick = () => { S.insTab = b.dataset.t; renderInsights(); });
    if (S.insTab === 'leaders') renderLeaderboard(v); else renderReport(v);
    wireRefresh(v);
  }

  // Dashboard teaser for the report and leaderboard (the only way in on phones).
  function insightCards() {
    const key = defaultReport(), live = key === monthKey(S.data.today), st = monthStats(key);
    const mName = MONTHS_LONG[Number(key.slice(5)) - 1];
    const { ranked } = (function () { const keep = S.lead; S.lead = { by: 'brand', sort: 'profit', period: 'all' }; const r = leaderRows(); S.lead = keep; return r; })();
    const lead = ranked[0];
    return `<div class="ins-cards">
      <button class="ins-card rep" data-ins="report"><span class="logo-mark sm"><img src="logo.jpg" alt=""></span><span><small>${live ? 'Monthly Report' : 'New Report Ready'}</small><b>Your ${mName}${live ? ' So Far' : ''}</b><em>${st.n} sale${st.n === 1 ? '' : 's'} · ${gbp(st.net)} net</em></span>${ICON.next}</button>
      <button class="ins-card" data-ins="leaders"><i class="ins-ic">${ICON.tag}</i><span><small>Brand Leaderboard</small><b>${lead ? esc(lead.k) : 'No Sales Yet'}</b><em>${lead ? 'Top earner · ' + gbp(lead.p) : 'Sell something to start'}</em></span>${ICON.next}</button>
    </div>`;
  }

  // ---------- stock ----------
  function renderStock() {
    const f = S.stock, items = S.data.items.filter(i => !isSold(i) && ['Returned', 'Kept'].indexOf(i.status) < 0);
    const chips = [['All', items.length], ['In stock', items.filter(i => i.status === 'In stock').length], ['Listed', items.filter(i => i.status === 'Listed').length], ['No photo', items.filter(i => !hasPhoto(i)).length]];
    const cats = ['All'].concat(Array.from(new Set(items.map(i => i.category).filter(Boolean))).sort());
    let list = items.filter(i => f.status === 'All' || (f.status === 'No photo' ? !hasPhoto(i) : i.status === f.status));
    if (f.cat !== 'All') list = list.filter(i => i.category === f.cat);
    if (f.aged === 'drop') list = list.filter(i => (ageOf(i) || 0) >= S.data.settings.dropDays);
    else if (f.aged === 'relist') list = list.filter(i => i.status === 'Listed' && (ageOf(i) || 0) >= S.data.settings.relistDays);
    else if (f.aged) list = list.filter(i => ageBand(ageOf(i)) === f.aged);
    if (f.q) { const q = f.q.toLowerCase(); list = list.filter(i => [i.sku, i.title, i.brand, i.size, i.location, i.notes].join(' ').toLowerCase().indexOf(q) >= 0); }
    const sorters = {
      newest: (a, b) => (b.boughtOn || '').localeCompare(a.boughtOn || '') || b.sku.localeCompare(a.sku),
      oldest: (a, b) => (a.boughtOn || '9').localeCompare(b.boughtOn || '9'),
      skuDesc: (a, b) => skuRank(a) - skuRank(b) || skuNum(b) - skuNum(a),
      sku: (a, b) => skuRank(a) - skuRank(b) || skuNum(a) - skuNum(b),
      price: (a, b) => (b.listedAt || 0) - (a.listedAt || 0)
    };
    list.sort(sorters[f.sort]);
    S.lastList = list.map(i => i.sku);
    const agedLabel = { good: 'Under ' + S.data.settings.amberDays + ' Days', warn: 'Getting Old', bad: S.data.settings.redDays + '+ Days', drop: 'Over ' + S.data.settings.dropDays + ' Days', relist: 'Relist or Bump' }[f.aged];

    const v = $('#view-stock');
    v.innerHTML = `
      ${header('', 'Stock', `${items.length} items not sold yet · ${items.filter(isBiz).length} business, ${items.filter(i => !isBiz(i)).length} personal · business stock ${gbp(sum(items.filter(isBiz), i => isNum(i.cost) ? i.cost : 0))} at cost`)}
      <div class="toolbar">
        <label class="search">${ICON.search}<input id="stockQ" type="search" placeholder="Search SKU, Brand, Title, Size…" value="${esc(f.q)}"></label>
        <select class="select" id="stockCat">${cats.map(c => `<option value="${esc(c)}" ${c === f.cat ? 'selected' : ''}>${c === 'All' ? 'All Categories' : esc(c)}</option>`).join('')}</select>
        <select class="select" id="stockSort">
          ${[['newest', 'Newest Bought'], ['oldest', 'Oldest First'], ['skuDesc', 'SKU: High to Low'], ['sku', 'SKU: Low to High'], ['price', 'Highest Price']].map(([k, l]) => `<option value="${k}" ${f.sort === k ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
      </div>
      <div class="chips">
        ${chips.map(([s, n]) => `<button class="chip ${f.status === s ? 'on' : ''}" data-s="${s}">${tc(s)}<span class="c">${n}</span></button>`).join('')}
        ${agedLabel ? `<button class="chip on" data-clear-aged>${esc(agedLabel)} ✕</button>` : ''}
      </div>
      <div class="count">${list.length} Shown${f.status === 'No photo' && list.length ? ' · open one, add its photo, then use › to move to the next' : ''}</div>
      ${list.length ? `<div class="cards">${list.map(card).join('')}</div>` : '<div class="empty">Nothing matches. Try clearing the search or filters.</div>'}`;

    const q = $('#stockQ', v);
    q.oninput = () => { f.q = q.value; clearTimeout(renderStock._t); renderStock._t = setTimeout(() => { renderStock(); const n = $('#stockQ'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 200); };
    $('#stockCat', v).onchange = e => { f.cat = e.target.value; renderStock(); };
    $('#stockSort', v).onchange = e => { f.sort = e.target.value; renderStock(); };
    $$('[data-s]', v).forEach(b => b.onclick = () => { f.status = b.dataset.s; renderStock(); });
    const ca = $('[data-clear-aged]', v); if (ca) ca.onclick = () => { f.aged = ''; renderStock(); };
    $$('.card', v).forEach(c => c.onclick = () => openItem(c.dataset.sku));
    wireRefresh(v);
  }
  function card(i) {
    const age = ageOf(i), band = ageBand(age);
    const ageTag = age != null ? `<span class="age ${band}">${age}d</span>` : '';
    const price = isNum(i.listedAt) ? gbp(i.listedAt) : (isNum(i.cost) ? `<span class="unk">Cost ${gbp(i.cost)}</span>` : '');
    return `<button class="card" data-sku="${esc(i.sku)}">
      <div class="ph${hasPhoto(i) ? ' has' : ''}">${photoInner(i)}<span class="pill ${statusClass(i.status)}">${esc(tc(i.status || 'In stock'))}</span>${ageTag}</div>
      <div class="b"><span class="sku">${esc(i.sku)}${i.location ? ' · ' + esc(i.location) : ''}${isBiz(i) ? '' : ' · PERSONAL'}</span><span class="t">${esc(i.title)}</span>
      <div class="r"><span>${esc(i.size || '')}</span><b>${price}</b></div></div></button>`;
  }

  // ---------- sold ----------
  function renderSold() {
    const f = S.sold;
    let list = S.data.items.filter(isSold);
    if (f.use !== 'All') list = list.filter(i => (f.use === 'Business') === isBiz(i));
    const months = Array.from(new Set(list.map(i => monthKey(i.soldOn)).filter(Boolean))).sort().reverse();
    if (f.month !== 'All') list = list.filter(i => monthKey(i.soldOn) === f.month);
    if (f.q) { const q = f.q.toLowerCase(); list = list.filter(i => [i.sku, i.title, i.brand].join(' ').toLowerCase().indexOf(q) >= 0); }
    list.sort((a, b) => (b.soldOn || '').localeCompare(a.soldOn || ''));
    const rev = sum(list, i => i.soldFor), prof = sum(list, i => profitOf(i) || 0);
    const groups = {};
    list.forEach(i => { const k = monthKey(i.soldOn) || 'none'; (groups[k] = groups[k] || []).push(i); });
    const keys = Object.keys(groups).filter(k => k !== 'none').sort().reverse().concat(groups.none ? ['none'] : []);
    S.lastList = [].concat(...keys.map(k => groups[k].map(i => i.sku)));

    const v = $('#view-sold');
    v.innerHTML = `
      ${header('', 'Sales', `${list.length} sales · ${gbp(rev)} revenue · ${gbp(prof)} profit before expenses`)}
      <div class="toolbar">
        <div class="seg" id="useSeg">${['Business', 'Personal', 'All'].map(u => `<button data-u="${u}" class="${f.use === u ? 'on' : ''}">${u}</button>`).join('')}</div>
        <label class="search">${ICON.search}<input id="soldQ" type="search" placeholder="Search Sold Items…" value="${esc(f.q)}"></label>
        <select class="select" id="soldMonth"><option value="All">All Months</option>${months.map(m => `<option value="${m}" ${f.month === m ? 'selected' : ''}>${monthLabel(m)}</option>`).join('')}</select>
      </div>
      ${list.length ? `<div class="list">${keys.map(k => {
        const g = groups[k];
        return `<div class="month-h">${k === 'none' ? 'No Date' : monthLabel(k)}<span>${g.length} · ${gbp(sum(g, i => i.soldFor))}</span></div>` + g.map(soldRow).join('');
      }).join('')}</div>` : '<div class="empty">No sales match.</div>'}`;
    $$('#useSeg button', v).forEach(b => b.onclick = () => { f.use = b.dataset.u; f.month = 'All'; renderSold(); });
    $('#soldMonth', v).onchange = e => { f.month = e.target.value; renderSold(); };
    const q = $('#soldQ', v);
    q.oninput = () => { f.q = q.value; clearTimeout(renderSold._t); renderSold._t = setTimeout(() => { renderSold(); const n = $('#soldQ'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 200); };
    $$('.li', v).forEach(r => r.onclick = () => openItem(r.dataset.sku));
    wireRefresh(v);
  }
  function soldRow(i) {
    const p = profitOf(i);
    const days = i.boughtOn && i.soldOn ? daysBetween(i.boughtOn, i.soldOn) : null;
    const pTxt = p == null ? '<small class="unk">Cost Unknown</small>' : `<small class="${p >= 0 ? 'pos' : 'neg'}">${p >= 0 ? '+' : ''}${gbp(p)}</small>`;
    return `<button class="li" data-sku="${esc(i.sku)}"><div class="th sold">${photoInner(i, 200)}</div>
      <div class="mid"><b>${esc(i.title)}</b><span>${esc(i.sku)} · ${ukDate(i.soldOn)}${days != null ? ' · ' + days + ' days' : ''}${i.status === 'In transit' ? ' · In Transit' : ''}</span></div>
      <div class="end">${gbp(i.soldFor)}${pTxt}</div></button>`;
  }

  // ---------- expenses ----------
  function renderExpenses() {
    const all = S.data.expenses.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const cats = Array.from(new Set(all.map(e => e.category).filter(Boolean)));
    const list = S.exCat === 'All' ? all : all.filter(e => e.category === S.exCat);
    const byCat = {};
    all.forEach(e => { byCat[e.category || 'Other'] = (byCat[e.category || 'Other'] || 0) + (isNum(e.amount) ? e.amount : 0); });
    const max = Math.max(...Object.values(byCat), 1);
    const v = $('#view-expenses');
    v.innerHTML = `
      ${header('', 'Expenses', `${all.length} expenses · ${gbp(sum(all, e => e.amount))} in total · all counted as business costs`)}
      <div class="toolbar"><button class="btn" id="addEx">${ICON.plus}Add Expense</button></div>
      <div class="grid2">
        <div class="list">${list.length ? list.map(e => `<button class="li ex" data-row="${e.row}"><div class="ex-ic">${esc((e.category || '?').slice(0, 2).toUpperCase())}</div>
          <div class="mid"><b>${esc(e.description || e.category)}</b><span>${ukDate(e.date)} · ${esc(e.category)}</span></div><div class="end">${gbp(e.amount)}</div></button>`).join('') : '<div class="empty">No expenses yet.</div>'}</div>
        <div class="panel"><h3>By Category</h3>
          <div class="chips" style="flex-wrap:wrap">${['All'].concat(cats).map(c => `<button class="chip ${S.exCat === c ? 'on' : ''}" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>
          <div class="rank">${Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a]).map(k => `<div class="row"><b>${esc(k)}</b><span>${gbp(byCat[k])}</span><div class="bar"><i style="width:${byCat[k] / max * 100}%"></i></div></div>`).join('')}</div>
        </div>
      </div>`;
    $('#addEx', v).onclick = () => openExpense(null);
    $$('[data-c]', v).forEach(b => b.onclick = () => { S.exCat = b.dataset.c; renderExpenses(); });
    $$('.li', v).forEach(r => r.onclick = () => openExpense(S.data.expenses.filter(e => String(e.row) === r.dataset.row)[0]));
    wireRefresh(v);
  }

  // ---------- sheets (panels) ----------
  function openSheet(html) {
    $('#sheetBody').innerHTML = html;
    $('#sheet').classList.add('on');
    $('#sheet').setAttribute('aria-hidden', 'false');
    $('.sheet-panel').scrollTop = 0;
    $$('[data-close]').forEach(b => b.onclick = closeSheet);
  }
  function closeSheet() { $('#sheet').classList.remove('on'); $('#sheet').setAttribute('aria-hidden', 'true'); S.openSku = null; }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

  const L = name => (S.data.lists[name] || []);
  const opts = (arr, cur, blank, label) => (blank ? '<option value=""></option>' : '') + Array.from(new Set(arr.concat(cur ? [cur] : []))).map(o => `<option value="${esc(o)}" ${o === cur ? 'selected' : ''}>${esc(label ? label(o) : o)}</option>`).join('');
  function field(label, html, full) { return `<div class="f${full ? ' full' : ''}"><label>${label}</label>${html}</div>`; }
  // Date box that always reads DD/MM/YYYY; the real date picker sits invisibly on top, so tapping still opens it.
  function dateInput(attrs, v) {
    return `<label class="dt"><span>${v ? ukDate(v) : 'DD/MM/YYYY'}</span><input ${attrs} type="date" value="${esc(v || '')}"></label>`;
  }
  document.addEventListener('input', e => { const t = e.target; if (t.type === 'date' && t.parentNode.classList.contains('dt')) t.previousElementSibling.textContent = t.value ? ukDate(t.value) : 'DD/MM/YYYY'; });
  document.addEventListener('change', e => { const t = e.target; if (t.type === 'date' && t.parentNode.classList.contains('dt')) t.previousElementSibling.textContent = t.value ? ukDate(t.value) : 'DD/MM/YYYY'; });
  function money(name, v) { return `<div class="money"><input name="${name}" type="number" inputmode="decimal" step="0.01" min="0" value="${isNum(v) ? v : ''}" placeholder="0.00"></div>`; }
  const closeBtn = `<button class="x" data-close aria-label="Close">${ICON.close}</button>`;

  function itemForm(i) {
    return `
      <div class="box"><h4>Item</h4><div class="fields">
        ${field('Title', `<input name="title" value="${esc(i.title)}" required placeholder="e.g. Vintage Nike Track Jacket Navy | Size L">`, true)}
        ${field('Brand', `<input name="brand" list="dl-brand" value="${esc(i.brand)}">`)}
        ${field('Size', `<input name="size" list="dl-size" value="${esc(i.size)}">`)}
        ${field('Category', `<select name="category">${opts(L('Category'), i.category, true)}</select>`)}
        ${field('Condition', `<select name="condition">${opts(L('Condition'), i.condition, true)}</select>`)}
      </div></div>
      <div class="box"><h4>Buying and Listing</h4><div class="fields">
        ${field('Bought on', dateInput('name="boughtOn"', i.boughtOn))}
        ${field('Bought From', `<select name="boughtFrom">${opts(L('Source'), i.boughtFrom, true)}</select>`)}
        ${field('Cost', money('cost', i.cost))}
        ${field('Listed At', money('listedAt', i.listedAt))}
        <p class="fine f full" style="margin-top:-6px">Leave the cost blank if you don't know it. It's kept out of profit.</p>
        ${field('Status', `<select name="status">${opts(L('Status'), i.status || 'In stock', false, tc)}</select>`)}
        ${field('Location', `<select name="location">${opts(L('Location'), i.location, true)}</select>`)}
        ${field('Notes', `<textarea name="notes">${esc(i.notes)}</textarea>`, true)}
      </div></div>
      <details class="adv box"><summary>Advanced</summary><div class="fields">
        ${field('Business or Personal', `<select name="use">${opts(['Business', 'Personal'], i.use || 'Business')}</select>`)}
        ${field('Storage', `<select name="storage">${opts(L('Storage'), i.storage || 'Boxed')}</select>`)}
        ${field('Vinted Listing Link', `<input name="listing" value="${esc(i.listing)}" placeholder="Paste the Vinted link once it's listed">`, true)}
        <p class="fine f full">The link powers the View on Vinted button. Items matched from your old listings show a short code like L012 here.</p>
      </div></details>`;
  }
  function datalists() {
    return `<datalist id="dl-brand">${L('Brand').map(b => `<option value="${esc(b)}">`).join('')}</datalist>
      <datalist id="dl-size">${L('Size').map(b => `<option value="${esc(b)}">`).join('')}</datalist>`;
  }

  function openItem(sku) {
    const i = S.data.items.filter(x => x.sku === sku)[0];
    if (!i) return;
    S.openSku = sku;
    const p = profitOf(i), age = ageOf(i);
    const sold = isSold(i);
    const ix = S.lastList.indexOf(sku);
    const prevSku = ix > 0 ? S.lastList[ix - 1] : '', nextSku = ix >= 0 && ix < S.lastList.length - 1 ? S.lastList[ix + 1] : '';
    const vurl = vintedUrl(i);
    openSheet(`
      <div class="sh-top"><h2>${esc(i.sku)}</h2>
        <div class="sh-nav"><button class="x" id="prevItem" ${prevSku ? '' : 'disabled'} aria-label="Previous item">${ICON.prev}</button><button class="x" id="nextItem" ${nextSku ? '' : 'disabled'} aria-label="Next item">${ICON.next}</button>${closeBtn}</div></div>
      <form id="itemForm" class="sh-body" autocomplete="off">
        <div class="sh-hero">
          <label class="ph${hasPhoto(i) ? ' has' : ''}" title="Change photo">${photoInner(i)}<span class="cam">${hasPhoto(i) ? 'Change Photo' : 'Add Photo'}</span><input id="photoIn" type="file" accept="image/&#42;" hidden></label>
          <div class="sh-facts">
            <span class="pill ${statusClass(i.status)}" style="align-self:flex-start">${esc(tc(i.status || 'In stock'))}</span>
            <b style="font-size:16px;line-height:1.3">${esc(i.title)}</b>
            <div class="big">${sold ? gbp(i.soldFor) : isNum(i.listedAt) ? gbp(i.listedAt) : '—'}</div>
            <dl class="facts">
              <dt>Cost</dt><dd>${isNum(i.cost) ? gbp(i.cost) : 'Unknown'}</dd>
              ${sold ? `<dt>Profit</dt><dd class="${p == null ? 'unk' : p >= 0 ? 'pos' : 'neg'}">${p == null ? 'Unknown' : gbp(p)}</dd><dt>Sold</dt><dd>${ukDate(i.soldOn)}</dd>` : `<dt>In Stock</dt><dd>${age == null ? '—' : age + ' days'}</dd>`}
              <dt>Storage</dt><dd>${esc(i.storage || '—')}</dd>
            </dl>
          </div>
        </div>
        <div class="row-btns">
          ${sold ? '' : `<button type="button" class="btn" id="markSold">${ICON.tick}Mark as Sold</button>`}
          ${vurl ? `<a class="btn ghost" href="${esc(vurl)}" target="_blank" rel="noopener">${ICON.ext}View on Vinted</a>` : ''}
          ${sold || !(S.data.ai || {}).ready ? '' : `<button type="button" class="btn ghost" id="suggestBtn">${ICON.spark}Suggest a Price</button>`}
        </div>
        <div id="suggestOut"></div>
        <div id="soldSlot">${sold ? soldBox(i) : ''}</div>
        ${itemForm(i)}
        ${datalists()}
      </form>
      <div class="actions"><button class="btn ghost" data-close>Cancel</button><button class="btn" id="saveItem">Save Changes</button></div>`);

    const form = $('#itemForm');
    const ms = $('#markSold');
    if (ms) ms.onclick = () => { $('#soldSlot').innerHTML = soldBox(Object.assign({}, i, { soldOn: S.data.today, soldFor: i.listedAt, channel: 'Vinted', status: 'Sold' })); ms.remove(); wireSold(form); $('[name=soldFor]', form).focus(); };
    if (sold) wireSold(form);
    $('#photoIn').onchange = e => uploadPhoto(i.sku, e.target.files[0]);
    $('#saveItem').onclick = () => save(form, i);
    const sb = $('#suggestBtn');
    if (sb) sb.onclick = () => {
      sb.disabled = true; sb.innerHTML = '<span class="spin sm"></span>Thinking…';
      call('suggestPrice', i.sku).then(r => {
        sb.remove();
        $('#suggestOut').innerHTML = `<div class="box suggest"><h4>Suggested Price</h4><div class="sug-row"><b>${gbp(r.price, 0)}</b><span>${esc(r.reason || '')}</span></div>
          <button type="button" class="btn" id="useSug">Use ${gbp(r.price, 0)}</button><p class="fine">This fills in Listed At. Change it on Vinted too, then tap Save Changes.</p></div>`;
        $('#useSug').onclick = () => { const el = $('[name=listedAt]', form); el.value = r.price; el.dispatchEvent(new Event('input', { bubbles: true })); toast('Listed At set to ' + gbp(r.price, 0)); };
      }).catch(e => { sb.disabled = false; sb.innerHTML = ICON.spark + 'Suggest a Price'; toast(errMsg(e), true); });
    };
    $('#prevItem').onclick = () => prevSku && openItem(prevSku);
    $('#nextItem').onclick = () => nextSku && openItem(nextSku);
  }
  function soldBox(i) {
    return `<div class="box sold-box"><h4>Sale</h4><div class="fields">
      ${field('Sold For', money('soldFor', i.soldFor))}
      ${field('Sold on', dateInput('name="soldOn"', i.soldOn))}
      ${field('Sale Status', `<select name="saleStatus">${opts(['Sold', 'In transit'], i.status === 'In transit' ? i.status : 'Sold', false, tc)}</select>`)}
      ${field('Channel', `<select name="channel">${opts(['Vinted', 'eBay', 'Depop', 'In person', 'Other'], i.channel || 'Vinted', false, tc)}</select>`)}
      ${field('Postage You Paid', money('postage', i.postage))}
      ${field('Fees You Paid', money('fees', i.fees))}
      <div class="f full"><span class="fine">Profit: <span class="profit-preview" id="profitPrev"></span></span></div>
    </div></div>`;
  }
  function wireSold(form) {
    const upd = () => {
      const g = n => { const el = $(`[name=${n}]`, form); return el && el.value !== '' ? Number(el.value) : null; };
      const cost = g('cost');
      const sf = g('soldFor');
      const el = $('#profitPrev');
      if (!el) return;
      if (sf == null) { el.textContent = 'enter a sale price'; el.className = 'profit-preview unk'; return; }
      if (cost == null) { el.textContent = 'cost unknown, so kept out of profit'; el.className = 'profit-preview unk'; return; }
      const p = sf - cost - (g('postage') || 0) - (g('fees') || 0);
      el.textContent = gbp(p) + (cost ? ' (' + pct(p / cost) + ' ROI)' : '');
      el.className = 'profit-preview ' + (p >= 0 ? 'pos' : 'neg');
    };
    $$('input', form).forEach(x => x.addEventListener('input', upd));
    upd();
  }

  function readForm(form) {
    const o = {};
    $$('input[name],select[name],textarea[name]', form).forEach(el => {
      if (el.type === 'radio' && !el.checked) return;
      let v = el.value.trim();
      if (el.type === 'number') v = v === '' ? '' : Number(v);
      o[el.name] = v;
    });
    return o;
  }

  function save(form, orig) {
    const o = readForm(form);
    if (!o.title) { toast('Give the item a title first.', true); return; }
    if ('soldFor' in o) {
      if (o.soldFor === '' && !isSold(orig)) { delete o.soldFor; delete o.soldOn; delete o.channel; delete o.postage; delete o.fees; delete o.saleStatus; }
      else {
        if (o.soldFor === '') { toast('Add the sale price, or clear the date to undo the sale.', true); return; }
        if (!o.soldOn) { toast('Add the date it sold.', true); return; }
        o.status = o.saleStatus;
        delete o.saleStatus;
      }
    }
    const item = Object.assign({ sku: orig.sku }, o);
    busy('#saveItem', true);
    call('saveItem', item).then(saved => {
      const ix = S.data.items.findIndex(x => x.sku === saved.sku);
      S.data.items[ix] = saved;
      closeSheet(); render();
      toast(saved.status === 'Sold' && !isSold(orig) ? 'Sold! Nice One.' : 'Saved');
    }).catch(e => { busy('#saveItem', false); toast(errMsg(e), true); });
  }

  function openNew(pre, after) {
    const st = S.data.settings;
    const blank = Object.assign({ status: 'In stock', boughtOn: S.data.today, use: 'Business' }, pre || {});
    openSheet(`
      <div class="sh-top"><h2>Add an Item</h2>${closeBtn}</div>
      <form id="newForm" class="sh-body" autocomplete="off">
        <div class="box"><h4>Where Will It Live?</h4>
          <div class="radio">
            <label><input type="radio" name="storage" value="Boxed" checked><span>Boxed<small>SKU : ${esc(st.nextSku)}</small></span></label>
            <label><input type="radio" name="storage" value="Oversized"><span>Oversized<small>OS : ${esc(st.nextOs)}</small></span></label>
          </div>
          <p class="fine">The number is given out when you save. Write it on the bag sticker.</p>
        </div>
        ${itemForm(blank)}
        <div class="box"><h4>Photo</h4><div class="f"><input id="newPhoto" type="file" accept="image/&#42;"></div><span class="fine">Optional. You can add one later.</span></div>
        ${datalists()}
      </form>
      <div class="actions"><button class="btn ghost" data-close>Cancel</button><button class="btn" id="saveNew">Add Item</button></div>`);
    const form = $('#newForm');
    $$('[name=storage]', form).forEach(r => r.onchange = () => { if (r.checked && r.value === 'Oversized') $('[name=location]', form).value = 'Wardrobe'; });
    $('#saveNew').onclick = () => {
      const o = readForm(form);
      o.storage = $('[name=storage]:checked', form).value;
      if (!o.title) { toast('Give the item a title first.', true); return; }
      const file = $('#newPhoto').files[0];
      busy('#saveNew', true);
      call('saveItem', o).then(saved => {
        S.data.items.push(saved);
        if (saved.sku.indexOf('OS') === 0) st.nextOs = ('00' + (Number(st.nextOs) + 1)).slice(-3);
        else st.nextSku = ('000' + (Number(st.nextSku) + 1)).slice(-4);
        closeSheet(); go('stock');
        toast('Added as ' + saved.sku);
        if (after) after(saved);
        if (file) uploadPhoto(saved.sku, file);
      }).catch(e => { busy('#saveNew', false); toast(errMsg(e), true); });
    };
  }

  function openExpense(e) {
    const isNew = !e;
    e = e || { date: S.data.today, category: '', description: '', amount: '', notes: '' };
    openSheet(`
      <div class="sh-top"><h2>${isNew ? 'Add an Expense' : 'Edit Expense'}</h2>${closeBtn}</div>
      <form id="exForm" class="sh-body" autocomplete="off"><div class="box"><div class="fields">
        ${field('Date', dateInput('name="date"', e.date))}
        ${field('Amount', money('amount', e.amount))}
        ${field('Category', `<select name="category">${opts(L('Expense category'), e.category, true)}</select>`, true)}
        ${field('What Was It?', `<input name="description" value="${esc(e.description)}" placeholder="e.g. Shipping bags x10">`, true)}
        ${field('Notes', `<textarea name="notes">${esc(e.notes)}</textarea>`, true)}
      </div></div></form>
      <div class="actions">${isNew ? '<button class="btn ghost" data-close>Cancel</button>' : '<button class="btn danger" id="delEx">Delete</button>'}<button class="btn" id="saveEx">${isNew ? 'Add Expense' : 'Save'}</button></div>`);
    $('#saveEx').onclick = () => {
      const o = readForm($('#exForm'));
      if (o.amount === '' || !o.date) { toast('Add a date and an amount.', true); return; }
      if (!isNew) o.row = e.row;
      busy('#saveEx', true);
      call('saveExpense', o).then(list => { S.data.expenses = list; closeSheet(); render(); toast('Expense Saved'); })
        .catch(err => { busy('#saveEx', false); toast(errMsg(err), true); });
    };
    const del = $('#delEx');
    if (del) del.onclick = () => {
      if (del.dataset.sure !== 'yes') { del.dataset.sure = 'yes'; del.textContent = 'Tap Again to Delete'; return; }
      busy('#delEx', true);
      call('deleteExpense', e.row, e.description).then(list => { S.data.expenses = list; closeSheet(); render(); toast('Expense Deleted'); })
        .catch(err => { busy('#delEx', false); toast(errMsg(err), true); });
    };
  }

  function openProfile() {
    const p = S.data.profile || {};
    openSheet(`
      <div class="sh-top"><h2>Your Vinted Profile</h2>${closeBtn}</div>
      <form id="profForm" class="sh-body" autocomplete="off">
        <div class="box"><h4>Shown on Your Dashboard</h4><div class="fields">
          ${field('Username', `<input name="username" value="${esc(p.username)}" placeholder="yourname" autocapitalize="off">`, true)}
          ${field('Reviews', `<input name="reviews" type="number" inputmode="numeric" min="0" step="1" value="${esc(p.reviews)}">`)}
          ${field('Star Rating', `<input name="rating" type="number" inputmode="decimal" min="0" max="5" step="0.1" value="${esc(p.rating)}" placeholder="e.g. 4.9">`)}
          ${field('Profile Photo', '<input id="avatarIn" type="file" accept="image/&#42;">', true)}
        </div><p class="fine">Copy these from your Vinted profile. The app doesn't read Vinted, so update them now and then.</p></div>
      </form>
      <div class="actions"><button class="btn ghost" data-close>Cancel</button><button class="btn" id="saveProf">Save</button></div>`);
    $('#saveProf').onclick = () => {
      const o = readForm($('#profForm'));
      const file = $('#avatarIn').files[0];
      busy('#saveProf', true);
      call('saveProfile', o)
        .then(prof => file ? shrink(file, 600).then(b64 => call('uploadAvatar', b64, 'image/jpeg')) : prof)
        .then(prof => { S.data.profile = prof; closeSheet(); render(); toast('Profile Saved'); })
        .catch(err => { busy('#saveProf', false); toast(errMsg(err), true); });
    };
  }

  function busy(sel, on) { const b = $(sel); if (!b) return; b.disabled = on; if (on) { b.dataset.t = b.textContent; b.textContent = 'Saving…'; } else if (b.dataset.t) b.textContent = b.dataset.t; }

  // ---------- photos ----------
  // Gentle auto-exposure, only when a photo is dull or dark: lifts it so the brightest 1% sits near white.
  function autoExpose(ctx, w, h) {
    try {
      const d = ctx.getImageData(0, 0, w, h), px = d.data, hist = new Array(256).fill(0);
      let n = 0, total = 0;
      for (let i = 0; i < px.length; i += 16) { const l = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000 | 0; hist[l]++; total += l; n++; }
      let c = 0, p99 = 255;
      for (let v = 0; v < 256; v++) { c += hist[v]; if (c >= n * 0.99) { p99 = v; break; } }
      const mean = total / n;
      let gain = 1;
      if (p99 < 238) gain = Math.min(1.3, 245 / Math.max(p99, 1));
      if (mean * gain < 105) gain = Math.min(1.35, Math.max(gain, 115 / Math.max(mean, 1)));
      if (gain < 1.04) return;
      for (let i = 0; i < px.length; i += 4) {
        for (let k = 0; k < 3; k++) { const v = (px[i + k] * gain - 128) * 1.04 + 128; px[i + k] = v < 0 ? 0 : v > 255 ? 255 : v; }
      }
      ctx.putImageData(d, 0, 0);
    } catch (e) { /* leave the photo as it is */ }
  }
  function shrink(file, max) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, (max || 1200) / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, c.width, c.height);
        autoExpose(ctx, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.82).split(',')[1]);
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => reject(new Error("That photo couldn't be read. Try a JPEG or PNG."));
      img.src = URL.createObjectURL(file);
    });
  }
  function uploadPhoto(sku, file) {
    if (!file) return;
    toast('Uploading Photo…');
    shrink(file).then(b64 => sendPhoto(sku, b64)).catch(e => toast(errMsg(e), true));
  }
  function uploadB64(sku, b64) { toast('Uploading Photo…'); sendPhoto(sku, b64).catch(e => toast(errMsg(e), true)); }
  function sendPhoto(sku, b64) {
    return call('uploadPhoto', sku, b64, 'image/jpeg').then(id => {
      const it = S.data.items.filter(x => x.sku === sku)[0];
      if (it) it.photo = id;
      render();
      if (S.openSku === sku) openItem(sku);
      toast('Photo Saved');
    });
  }

  function seedBanner() {
    const b = $('#banner');
    if (!S.data.seedPhotosPending) { b.innerHTML = ''; return; }
    b.innerHTML = `<div class="banner"><span>Add the photos from your live Vinted listings to your stock? It takes about a minute.</span><button class="btn sm" id="seedGo">Add Photos</button></div>`;
    $('#seedGo').onclick = () => {
      const btn = $('#seedGo'); btn.disabled = true;
      const step = start => call('importSeedPhotos', start).then(r => {
        btn.textContent = `Adding ${r.done} of ${r.total}…`;
        if (r.done < r.total) return step(r.done);
        return call('getData').then(d => { S.data = d; render(); toast('Photos Added'); });
      });
      step(0).catch(e => { btn.disabled = false; btn.textContent = 'Try Again'; toast(errMsg(e), true); });
    };
  }

  // ---------- AI listing generator ----------
  function renderList() {
    const d = S.draft, ai = S.data.ai || {}, st = S.data.settings, r = d.result;
    const v = $('#view-list');
    v.innerHTML = `
      ${header('Draft a', 'Listing', 'Add a few photos (front, back, labels, any flaws). Gemini writes the listing in your format and prices it from your own sales.')}
      ${ai.ready ? '' : '<div class="banner warn-b"><span>The Gemini key isn\'t set up yet, so drafting won\'t work until it is.</span></div>'}
      <div class="panel">
        <h3>Photos <small>${d.photos.length}/6 · First Is the Main Photo</small></h3>
        <div class="shots">
          ${d.photos.map((p, n) => `<div class="shot${n === 0 ? ' is-main' : ''}"><img src="${p.url}" alt=""><button type="button" class="shot-x" data-del="${n}" aria-label="Remove photo">${ICON.close}</button>${n === 0 ? '<span>Main</span>' : `<button type="button" class="shot-main" data-main="${n}">Make Main</button>`}</div>`).join('')}
          ${d.photos.length < 6 ? `<label class="shot add">${ICON.camera}<span>Add Photos</span><input id="shotIn" type="file" accept="image/&#42;" multiple hidden></label>` : ''}
        </div>
        <div class="f"><label>Anything the Photos Don't Show</label><textarea id="draftNotes" placeholder="e.g. Size L, pit to pit 23in, small mark on cuff, paid £4 at a car boot">${esc(d.notes)}</textarea></div>
        <button class="btn big" id="genBtn" ${!d.photos.length || d.busy || !ai.ready ? 'disabled' : ''}>${d.busy ? '<span class="spin sm"></span>Writing Your Listing…' : ICON.spark + (r ? 'Write It Again' : 'Write My Listing')}</button>
      </div>
      ${r ? draftResult(r, st) : ''}`;

    const inp = $('#shotIn', v);
    if (inp) inp.onchange = e => addShots(Array.from(e.target.files || []));
    $$('[data-del]', v).forEach(b => b.onclick = () => { d.photos.splice(Number(b.dataset.del), 1); renderList(); });
    $$('[data-main]', v).forEach(b => b.onclick = () => { const p = d.photos.splice(Number(b.dataset.main), 1)[0]; d.photos.unshift(p); renderList(); });
    $('#draftNotes', v).oninput = e => { d.notes = e.target.value; };
    $('#genBtn', v).onclick = generate;
    if (r) wireResult(v);
    wireRefresh(v);
  }

  function addShots(files) {
    const d = S.draft;
    const room = 6 - d.photos.length;
    Promise.all(files.slice(0, room).map(f => shrink(f, 1024).then(b64 => ({ b64: b64, url: 'data:image/jpeg;base64,' + b64 }))))
      .then(ps => { d.photos = d.photos.concat(ps); renderList(); })
      .catch(e => toast(errMsg(e), true));
    if (files.length > room) toast('Up to 6 photos. The first ' + room + ' were added.');
  }

  function generate() {
    const d = S.draft;
    if (!d.photos.length || d.busy) return;
    d.busy = true; renderList();
    call('generateListing', d.photos.map(p => ({ data: p.b64, mime: 'image/jpeg' })), d.notes)
      .then(res => { d.result = res; d.busy = false; renderList(); setTimeout(() => { const el = $('#draftOut'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50); })
      .catch(e => { d.busy = false; renderList(); toast(errMsg(e), true); });
  }

  function draftResult(r, st) {
    const cats = L('Category'), conds = L('Condition');
    const chips = [['Brand', r.brand], ['Size', r.size], ['Colour', r.colour], ['Condition', r.condition], ['Category', r.category], ['On Vinted', r.vintedCategory]].filter(x => x[1]);
    return `<div id="draftOut" class="draft">
      ${r.warnings ? `<div class="banner bad-b"><span><b>Check This First:</b> ${esc(r.warnings)}</span></div>` : ''}
      <div class="prices">
        <div class="pr is-main"><span>List At</span><b>${gbp(r.listPrice, 0)}</b></div>
        <div class="pr"><span>Expect</span><b>${gbp(r.expectedPrice, 0)}</b></div>
        <div class="pr"><span>Lowest Offer</span><b>${gbp(r.floorPrice, 0)}</b></div>
      </div>
      <div class="panel">
        <h3>Title <button class="link-btn" data-copy="title">${ICON.copy}Copy</button></h3>
        <div class="f"><input id="dTitle" value="${esc(r.title)}"></div>
        <h3>Description <button class="link-btn" data-copy="desc">${ICON.copy}Copy</button></h3>
        <div class="f"><textarea id="dDesc" rows="12">${esc(r.description)}</textarea></div>
        <div class="meta">${chips.map(([k, val]) => `<span><small>${k}</small>${esc(val)}</span>`).join('')}</div>
        <p class="fine">Confidence: ${esc(tc(r.confidence || 'medium'))} · ${esc(r.model || 'Gemini')} · check measurements and flaws before posting.</p>
      </div>
      <div class="panel">
        <h3>Save as an Item</h3>
        <div class="radio">
          <label><input type="radio" name="dStore" value="Boxed" checked><span>Boxed<small>SKU : ${esc(st.nextSku)}</small></span></label>
          <label><input type="radio" name="dStore" value="Oversized"><span>Oversized<small>OS : ${esc(st.nextOs)}</small></span></label>
        </div>
        <div class="fields">
          ${field('What You Paid', money('dCost', ''))}
          ${field('Bought From', `<select id="dFrom">${opts(L('Source'), '', true)}</select>`)}
          ${field('Bought on', dateInput('id="dOn"', S.data.today))}
          ${field('Category', `<select id="dCat">${opts(cats, cats.indexOf(r.category) >= 0 ? r.category : '', true)}</select>`)}
        </div>
        <input type="hidden" id="dCond" value="${esc(conds.indexOf(r.condition) >= 0 ? r.condition : '')}">
        <div class="row-btns"><button class="btn ghost" id="dReset">Start Again</button><button class="btn" id="dSave">${ICON.tick}Save as Item</button></div>
      </div>
    </div>`;
  }

  function copyText(t) {
    const done = () => toast('Copied');
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t).then(done, () => fallbackCopy(t, done));
    fallbackCopy(t, done);
  }
  function fallbackCopy(t, done) {
    const ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { toast('Select the text and copy it by hand.', true); }
    ta.remove();
  }

  function wireResult(v) {
    const d = S.draft, r = d.result;
    $('#dTitle', v).oninput = e => { r.title = e.target.value; };
    $('#dDesc', v).oninput = e => { r.description = e.target.value; };
    $$('[data-copy]', v).forEach(b => b.onclick = () => copyText(b.dataset.copy === 'title' ? r.title : r.description));
    $('#dReset', v).onclick = () => { S.draft = { photos: [], notes: '', result: null, busy: false }; renderList(); window.scrollTo(0, 0); };
    $('#dSave', v).onclick = () => {
      const cost = $('[name=dCost]', v).value;
      const item = {
        title: r.title, brand: r.brand || '', size: r.size || '', category: $('#dCat', v).value, condition: $('#dCond', v).value,
        listedAt: isNum(r.listPrice) ? r.listPrice : '', cost: cost === '' ? '' : Number(cost),
        boughtFrom: $('#dFrom', v).value, boughtOn: $('#dOn', v).value, status: 'In stock',
        storage: $('[name=dStore]:checked', v).value, notes: r.description
      };
      if (item.storage === 'Oversized') item.location = 'Wardrobe';
      busy('#dSave', true);
      call('saveItem', item).then(saved => {
        const st = S.data.settings;
        S.data.items.push(saved);
        if (saved.sku.indexOf('OS') === 0) st.nextOs = ('00' + (Number(st.nextOs) + 1)).slice(-3);
        else st.nextSku = ('000' + (Number(st.nextSku) + 1)).slice(-4);
        const main = d.photos[0];
        S.draft = { photos: [], notes: '', result: null, busy: false };
        toast('Saved as ' + saved.sku + '. Write it on the sticker.');
        S.lastList = [saved.sku];
        go('stock'); openItem(saved.sku);
        if (main) uploadB64(saved.sku, main.b64);
      }).catch(e => { busy('#dSave', false); toast(errMsg(e), true); });
    };
  }

  // ---------- settings ----------
  function renderSettings() {
    const d = S.data, st = d.settings, p = d.profile || {}, ai = d.ai || {}, corners = prefs().corners || 'round';
    const v = $('#view-settings');
    v.innerHTML = `
      ${header('', 'Settings')}
      <div class="set-grid">
        <div class="panel">
          <h3>Vinted Profile</h3>
          <p class="fine">${p.username ? '@' + esc(p.username.replace(/^@/, '')) + (p.rating ? ' · ' + esc(p.rating) + '★' : '') + (p.reviews ? ' · ' + esc(p.reviews) + ' reviews' : '') : 'Not added yet.'}</p>
          <button class="btn ghost" id="setProfile">${ICON.edit}Edit Profile</button>
        </div>
        <div class="panel">
          <h3>Stock Age <small>Days Since Bought</small></h3>
          <div class="fields">
            ${field('Amber From', `<input id="sAmber" type="number" inputmode="numeric" min="1" value="${st.amberDays}">`)}
            ${field('Red From', `<input id="sRed" type="number" inputmode="numeric" min="1" value="${st.redDays}">`)}
            ${field('Price-Drop Prompt From', `<input id="sDrop" type="number" inputmode="numeric" min="1" value="${st.dropDays}">`)}
            ${field('Relist Reminder From', `<input id="sRelist" type="number" inputmode="numeric" min="1" value="${st.relistDays}">`)}
          </div>
          <button class="btn" id="saveAge">Save</button>
        </div>
        <div class="panel">
          <h3>Monthly Report <small>Emailed on the 1st</small></h3>
          ${field('Monthly Profit Goal', `<div class="money"><input id="sGoal" type="number" inputmode="decimal" min="0" step="1" value="${st.monthlyGoal > 0 ? st.monthlyGoal : ''}" placeholder="No goal"></div>`)}
          <p class="fine">Net profit you're aiming for each month. It fills the ring on your report. Leave it empty for no goal.</p>
          <button class="btn" id="saveGoal">Save Goal</button>
        </div>
        <div class="panel">
          <h3>Vinted Emails <small>${d.automationOn ? 'Checked Every Hour' : 'Not Switched On'}</small></h3>
          <p class="fine">${d.automationOn ? 'Sales, posting, completed orders, purchases and bump invoices are read from your Gmail automatically. Anything unclear lands in Needs Checking on the dashboard.' + ((d.auto || {}).lastScan ? ' Last checked ' + esc(new Date(d.auto.lastScan).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })) + '.' : '') : 'Run setupAutomation once in the script editor to switch this on.'}</p>
          <p class="fine">Weekly backup every Sunday (last 8 kept in Drive › VintVault Backups) and a summary email every Monday morning.</p>
          <button class="btn ghost" id="scanNow" ${d.automationOn ? '' : 'disabled'}>${ICON.refresh}Check Emails Now</button>
        </div>
        <div class="panel">
          <h3>Tax-Year Export</h3>
          <div class="f"><label>Tax Year</label><select class="select" id="taxYear">${taxYears().map(y => `<option value="${y}">06/04/${y} – 05/04/${y + 1}</option>`).join('')}</select></div>
          <p class="fine">A spreadsheet file (CSV) of business sales and expenses for that tax year, with totals. Personal sales are left out.</p>
          <button class="btn ghost" id="taxCsv">${ICON.receipt}Download CSV</button>
        </div>
        <div class="panel">
          <h3>Listing Generator</h3>
          <p class="fine">${ai.ready ? 'Gemini is connected' + (ai.model ? ' (' + esc(ai.model) + ')' : '') + '. Your key is stored in your private Google project.' : 'Not connected. Add GEMINI_API_KEY in the script\'s Project Settings.'}</p>
        </div>
        <div class="panel">
          <h3>Appearance</h3>
          <div class="f"><label>Corners</label>
            <div class="seg" id="cornerSeg">${[['round', 'Rounded'], ['soft', 'Subtle'], ['sharp', 'Sharp']].map(([k, l]) => `<button data-c="${k}" class="${corners === k ? 'on' : ''}">${l}</button>`).join('')}</div>
          </div>
          <p class="fine">Saved on this device only.</p>
        </div>
        <div class="panel">
          <h3>Your Data</h3>
          <p class="fine">Everything you save here goes straight into your Google Sheet. Edits made in the sheet show up after a refresh.</p>
          <div class="row-btns"><a class="btn ghost" href="${esc(d.sheetUrl)}" target="_blank" rel="noopener">${ICON.ext}Open the Sheet</a><button class="btn ghost" data-refresh-btn>${ICON.refresh}Refresh Now</button></div>
        </div>
        <div class="panel">
          <h3>This Device</h3>
          <p class="fine">Locking removes your app key from this device. You'll need the key to get back in.</p>
          <button class="btn danger" id="lockDev">Lock This Device</button>
        </div>
      </div>
      <p class="fine" style="text-align:center;margin-top:8px">VintVault · data from your private Google Sheet</p>`;
    $('#setProfile', v).onclick = openProfile;
    $('#saveAge', v).onclick = () => {
      const s = { amberDays: $('#sAmber', v).value, redDays: $('#sRed', v).value, dropDays: $('#sDrop', v).value, relistDays: $('#sRelist', v).value };
      if (Number(s.amberDays) >= Number(s.redDays)) { toast('Red needs to be more days than amber.', true); return; }
      busy('#saveAge', true);
      call('saveSettings', s).then(ns => { S.data.settings = ns; renderSettings(); toast('Settings Saved'); })
        .catch(e => { busy('#saveAge', false); toast(errMsg(e), true); });
    };
    $('#saveGoal', v).onclick = () => {
      busy('#saveGoal', true);
      call('saveSettings', { monthlyGoal: $('#sGoal', v).value.trim() }).then(ns => { S.data.settings = ns; renderSettings(); toast('Goal Saved'); })
        .catch(e => { busy('#saveGoal', false); toast(errMsg(e), true); });
    };
    $('#scanNow', v).onclick = () => {
      busy('#scanNow', true);
      call('checkEmailsNow').then(r => {
        S.data = r.data; S.loadedAt = Date.now(); renderSettings();
        const x = r.result || {};
        toast(x.busy ? 'Already checking, try again in a minute' : `Read ${x.read || 0} emails · ${x.sales || 0} sales · ${x.toCheck || 0} to check`);
      }).catch(e => { busy('#scanNow', false); toast(errMsg(e), true); });
    };
    $('#taxCsv', v).onclick = () => downloadTaxCsv(Number($('#taxYear', v).value));
    $$('#cornerSeg button', v).forEach(b => b.onclick = () => { setPref('corners', b.dataset.c); renderSettings(); });
    $('[data-refresh-btn]', v).onclick = () => refresh(false);
    $('#lockDev', v).onclick = () => { setKey(''); S.data = null; askKey(''); };
    wireRefresh(v);
  }

  // ---------- tax-year export ----------
  function taxYears() {
    const dates = S.data.items.filter(isSold).map(i => i.soldOn).concat(S.data.expenses.map(e => e.date)).filter(Boolean);
    const startOf = iso => { const y = Number(iso.slice(0, 4)); return iso >= y + '-04-06' ? y : y - 1; };
    const ys = Array.from(new Set(dates.map(startOf).concat([startOf(S.data.today)]))).sort((a, b) => b - a);
    return ys;
  }
  function downloadTaxCsv(y) {
    const from = y + '-04-06', to = (y + 1) + '-04-05';
    const inYear = d => d && d >= from && d <= to;
    const q = v => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const n2 = v => isNum(v) ? v.toFixed(2) : '';
    const sales = S.data.items.filter(i => isBiz(i) && isSold(i) && inYear(i.soldOn)).sort((a, b) => a.soldOn.localeCompare(b.soldOn));
    const exps = S.data.expenses.filter(e => inYear(e.date)).sort((a, b) => a.date.localeCompare(b.date));
    const rows = [['VintVault tax-year export', `06/04/${y} to 05/04/${y + 1}`], [], ['SALES'], ['Date sold', 'SKU', 'Item', 'Sold for (£)', 'Cost (£)', 'Postage (£)', 'Fees (£)', 'Profit (£)', 'Bought on', 'Bought from']];
    sales.forEach(i => rows.push([ukDate(i.soldOn), i.sku, i.title, n2(i.soldFor), isNum(i.cost) ? n2(i.cost) : 'Unknown', n2(i.postage), n2(i.fees), n2(profitOf(i)), i.boughtOn ? ukDate(i.boughtOn) : '', i.boughtFrom || '']));
    const income = sum(sales, i => i.soldFor), costs = sum(sales, i => isNum(i.cost) ? i.cost : 0), gross = sum(sales, i => profitOf(i) || 0);
    rows.push([], ['EXPENSES'], ['Date', 'Category', 'Description', 'Amount (£)', 'Notes']);
    exps.forEach(e => rows.push([ukDate(e.date), e.category, e.description, n2(e.amount), e.notes || '']));
    const exTotal = sum(exps, e => isNum(e.amount) ? e.amount : 0);
    rows.push([], ['TOTALS'], ['Sales income (£)', income.toFixed(2)], ['Cost of items sold (£)', costs.toFixed(2)], ['Expenses (£)', exTotal.toFixed(2)], ['Net profit (£)', (gross - exTotal).toFixed(2)],
      ['Sales with unknown cost', sales.filter(i => !isNum(i.cost)).length], [], ['Not tax advice. Check with HMRC or an accountant.']);
    const csv = '﻿' + rows.map(r => r.map(q).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `VintVault tax year ${y}-${String(y + 1).slice(2)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('Export Ready');
  }

  // ---------- add menu ----------
  function openAddMenu() {
    openSheet(`
      <div class="sh-top"><h2>Add</h2>${closeBtn}</div>
      <div class="sh-body add-menu">
        <button class="am" id="amList"><i>${ICON.spark}</i><span><b>Draft a Listing with AI</b><small>Photos in, title, description and price out</small></span></button>
        <button class="am" id="amItem"><i>${ICON.bag}</i><span><b>Add an Item</b><small>Something you've bought, filled in by hand</small></span></button>
        <button class="am" id="amEx"><i>${ICON.receipt}</i><span><b>Add an Expense</b><small>Bags, bumps, car boot fees and more</small></span></button>
      </div>`);
    $('#amList').onclick = () => { closeSheet(); go('list'); };
    $('#amItem').onclick = () => openNew();
    $('#amEx').onclick = () => openExpense(null);
  }

  // ---------- refresh ----------
  // Changes made straight in the sheet show up here after a refresh (button, or coming back to the app).
  function refresh(quiet) {
    const btns = $$('[data-refresh]');
    btns.forEach(b => b.classList.add('spin'));
    return call('getData').then(d => {
      S.data = d; S.loadedAt = Date.now();
      if (!$('#sheet').classList.contains('on')) render();
      if (!quiet) toast('Up to Date');
    }).catch(e => { if (!quiet) toast(errMsg(e), true); })
      .then(() => $$('[data-refresh]').forEach(b => b.classList.remove('spin')));
  }
  function wireRefresh(v) { $$('[data-refresh]', v).forEach(b => b.onclick = () => refresh(false)); }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && S.data && Date.now() - S.loadedAt > 60000) refresh(true);
  });

  // ---------- no zooming ----------
  ['gesturestart', 'gesturechange'].forEach(ev => document.addEventListener(ev, e => e.preventDefault(), { passive: false }));
  document.addEventListener('touchmove', e => { if (e.touches && e.touches.length > 1) e.preventDefault(); }, { passive: false });
  let lastTap = 0;
  document.addEventListener('touchend', e => { const n = Date.now(); if (n - lastTap < 300 && !e.target.closest('input,textarea,select')) e.preventDefault(); lastTap = n; }, { passive: false });

  // ---------- routing ----------
  function go(view) {
    S.view = view;
    $$('.nav[data-view]').forEach(n => n.classList.toggle('on', n.dataset.view === view));
    $$('.view').forEach(v => v.classList.toggle('on', v.id === 'view-' + view));
    render();
    window.scrollTo(0, 0);
  }
  function render() {
    if (!S.data) return;
    seedBanner();
    ({ dashboard: renderDashboard, stock: renderStock, sold: renderSold, expenses: renderExpenses, list: renderList, settings: renderSettings, insights: renderInsights })[S.view]();
    wireRefresh(document);
    $$('[data-goto]').forEach(b => b.onclick = () => go(b.dataset.goto));
  }
  $$('.nav[data-view]').forEach(n => n.onclick = () => { if (n.dataset.view === 'stock') { S.stock.aged = ''; } go(n.dataset.view); });
  $$('[data-add]').forEach(b => b.onclick = () => { if (S.data) openAddMenu(); });

  // ---------- key + start-up ----------
  function askKey(msg) {
    const l = $('#loading');
    l.classList.remove('off');
    $$('.view').forEach(v => v.classList.remove('on'));
    $('#banner').innerHTML = '';
    l.innerHTML = `<form class="keybox" id="keyForm">
      <span class="logo-mark big"><img src="logo.jpg" alt=""></span>
      <h2>Vint<span style="color:var(--teal-hi)">Vault</span></h2>
      <p>Enter your app key to unlock your data. You only need to do this once on each device.</p>
      ${msg ? `<p class="err">${esc(msg)}</p>` : ''}
      <input id="keyIn" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="xxxxxxxx-xxxxxxxx-xxxxxxxx-xxxxxxxx">
      <button class="btn" type="submit">Unlock</button>
    </form>`;
    $('#keyForm').onsubmit = ev => { ev.preventDefault(); const k = $('#keyIn').value.trim(); if (!k) return; setKey(k); start(); };
    setTimeout(() => { const i = $('#keyIn'); if (i) i.focus(); }, 50);
  }

  function start() {
    const l = $('#loading');
    l.classList.remove('off');
    l.innerHTML = '<div class="spin"></div><p>Loading Your Stock…</p>';
    call('getData').then(d => {
      S.data = d; S.loadedAt = Date.now();
      l.classList.add('off');
      $('#sheetLink').href = d.sheetUrl;
      go(S.view);
    }).catch(e => {
      if (errMsg(e) === 'Key needed') return;
      l.innerHTML = `<p>Couldn't load your data: ${esc(errMsg(e))}</p><button class="btn" id="retry">Try Again</button>`;
      $('#retry').onclick = start;
    });
  }

  $('#forgetKey').onclick = () => { setKey(''); S.data = null; askKey(''); };
  // Links from the monthly email: …/#report=2026-10
  const deep = location.hash.match(/^#report=(\d{4}-\d{2})$/);
  if (deep) { S.view = 'insights'; S.insTab = 'report'; S.report.month = deep[1]; history.replaceState(null, '', location.pathname + location.search); }
  if (window.VT_MOCK || getKey()) start(); else askKey('');
})();
