(function () {
  'use strict';

  // ---------- state ----------
  const S = {
    data: null,
    view: 'dashboard',
    period: 'all',
    stock: { q: '', status: 'All', cat: 'All', sort: 'newest' },
    sold: { q: '', use: 'Business', month: 'All' },
    exCat: 'All'
  };
  const UNSOLD = ['In stock', 'Listed', 'Reserved'];
  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));

  // ---------- server calls ----------
  // The data service is the Google Apps Script attached to the sheet. It only answers with the key.
  const API_URL = 'https://script.google.com/macros/s/AKfycbxT9JkIIZHfOmQk6tUG3_YmvxmSBQCh7R4kfj8VpfV5sFmunNsNhV7xd_dMVoVyq7QLiw/exec';
  const KEY_STORE = 'vt-key';
  function getKey() { try { return localStorage.getItem(KEY_STORE) || ''; } catch (e) { return S.key || ''; } }
  function setKey(k) { S.key = k; try { if (k) localStorage.setItem(KEY_STORE, k); else localStorage.removeItem(KEY_STORE); } catch (e) { /* private mode: key lasts this visit only */ } }

  function call(fn, ...args) {
    // text/plain keeps this a "simple" request, which Google's servers accept from other websites.
    return fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ key: getKey() || S.key, fn: fn, args: args }) })
      .then(r => { if (!r.ok) throw new Error('Google returned an error (' + r.status + '). Try again in a moment.'); return r.json(); })
      .catch(e => { throw e instanceof TypeError ? new Error("Couldn't reach Google. Check your internet connection.") : e; })
      .then(res => {
        if (res.ok) return res.result;
        if (res.error === 'wrong-key') { setKey(''); askKey('That key didn\'t work. Check it and try again.'); throw new Error('Key needed'); }
        throw new Error(res.error || 'Something went wrong');
      });
  }

  // ---------- formatting ----------
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isNum = v => typeof v === 'number' && !isNaN(v);
  const gbp = (v, dp) => isNum(v) ? (v < 0 ? '−' : '') + '£' + Math.abs(v).toLocaleString('en-GB', { minimumFractionDigits: dp == null ? 2 : dp, maximumFractionDigits: dp == null ? 2 : dp }) : '—';
  const gbp0 = v => gbp(v);
  const pct = v => isNum(v) && isFinite(v) ? Math.round(v * 100) + '%' : '—';
  const ukDate = iso => { if (!iso) return '—'; const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}/${m[2]}/${m[1]}` : esc(iso); };
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthKey = iso => iso ? iso.slice(0, 7) : '';
  const monthLabel = key => { const [y, m] = key.split('-'); return MONTHS_LONG[Number(m) - 1] + ' ' + y; };
  const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
  const statusClass = s => 's-' + String(s || 'In stock').toLowerCase().replace(/\s+/g, '');

  function profitOf(i) {
    if (!isNum(i.soldFor) || !isNum(i.cost)) return null;
    return i.soldFor - i.cost - (isNum(i.postage) ? i.postage : 0) - (isNum(i.fees) ? i.fees : 0);
  }
  const isSold = i => isNum(i.soldFor);
  const isBiz = i => i.use !== 'Personal';
  function ageOf(i) { return i.boughtOn ? daysBetween(i.boughtOn, S.data.today) : null; }
  function ageBand(days) {
    if (days == null) return '';
    if (days >= S.data.settings.redDays) return 'bad';
    if (days >= S.data.settings.amberDays) return 'warn';
    return 'good';
  }

  function photoUrl(p) {
    if (!p) return '';
    if (/^https?:\/\//.test(p)) return p;
    if (/^[\w-]{20,}$/.test(p)) return 'https://lh3.googleusercontent.com/d/' + p + '=w600';
    return '';
  }
  function initials(i) {
    const w = (i.brand && i.brand !== 'Unknown' ? i.brand : i.title || '?').replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(Boolean);
    return (w[0] ? w[0][0] : '?') + (w[1] ? w[1][0] : '');
  }
  function photoBlock(i, extra) {
    const u = photoUrl(i.photo);
    const img = u ? `<img src="${esc(u)}" alt="" loading="lazy" onerror="this.remove()">` : '';
    return `<div class="ph-none">${esc(initials(i))}<small>${esc(i.category || '')}</small></div>${img}${extra || ''}`;
  }
  function thumb(i) {
    const u = photoUrl(i.photo);
    return `<div class="th"><div class="ph-none">${esc(initials(i))}</div>${u ? `<img src="${esc(u)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</div>`;
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

    const periodName = { all: 'All time', month: 'This month', '30': 'Last 30 days', tax: 'This tax year' }[S.period];
    const v = $('#view-dashboard');
    v.innerHTML = `
      <div class="head">
        <div><h1>Dashboard</h1><p>${periodName} · business sales only · ${ukDate(d.today)}</p></div>
        <div class="seg" id="periodSeg">
          ${[['all', 'All time'], ['tax', 'Tax year'], ['month', 'This month'], ['30', '30 days']].map(([k, l]) => `<button data-p="${k}" class="${S.period === k ? 'on' : ''}">${l}</button>`).join('')}
        </div>
      </div>
      <div class="kpis">
        ${kpi('Revenue', gbp0(revenue), `${sold.length} sales`, true)}
        ${kpi('Net profit', gbp0(net), `after ${gbp(exp)} expenses`)}
        ${kpi('Profit margin', revenue ? pct(net / revenue) : '—', `gross profit ${gbp0(gross)}`)}
        ${kpi('Average days to sell', avgDays == null ? '—' : avgDays + ' days', `cost of items sold ${gbp0(cogs)}`)}
        ${kpi('Items in stock', String(stock.length), `${listed.length} listed on Vinted`)}
        ${kpi('Stock value at cost', gbp0(stockValue), `listed at ${gbp0(listedValue)}`)}
        ${kpi('Sales in transit', String(transit), 'waiting for buyer to confirm')}
        ${kpi('Unknown cost sales', String(unknownCost), unknownCost ? 'left out of profit' : 'every cost is known')}
      </div>
      <div class="grid2">
        <div class="panel">
          <h3>Revenue and profit by month <span class="legend"><span><i style="background:var(--teal)"></i>Revenue</span><span><i style="background:var(--ink)"></i>Profit</span></span></h3>
          ${monthChart()}
        </div>
        <div class="panel">
          <h3>Stock age <small>days since you bought it</small></h3>
          ${agedPanel(stock)}
          <h3 style="margin-top:6px">To do</h3>
          <div class="todo">
            <button data-go="stock" data-status="In stock">Bought but not listed yet <span class="n">${items.filter(i => i.status === 'In stock').length}</span></button>
            <button data-go="stock" data-aged="drop">Over ${st.dropDays} days old: think about a price drop <span class="n">${stock.filter(i => (ageOf(i) || 0) >= st.dropDays).length}</span></button>
            <button data-sheet="listings">Live Vinted listings not matched to a SKU <span class="n">${d.listingsToMatch}</span></button>
          </div>
        </div>
      </div>
      <div class="grid3">
        <div class="panel"><h3>Profit by category <small>${periodName.toLowerCase()}</small></h3>${rankPanel(sold, i => i.category || 'Other')}</div>
        <div class="panel"><h3>Profit by source <small>ROI on cost</small></h3>${rankPanel(sold, i => i.boughtFrom || 'Unknown', true)}</div>
        <div class="panel"><h3>HMRC check <small>not tax advice</small></h3>${hmrcPanel()}</div>
      </div>`;
    $$('#periodSeg button', v).forEach(b => b.onclick = () => { S.period = b.dataset.p; renderDashboard(); });
    $$('[data-go]', v).forEach(b => b.onclick = () => {
      S.stock.status = b.dataset.status || 'All';
      S.stock.sort = b.dataset.aged ? 'oldest' : 'newest';
      S.stock.aged = b.dataset.aged || '';
      go('stock');
    });
    $$('[data-band]', v).forEach(b => b.onclick = () => { S.stock.status = 'All'; S.stock.aged = b.dataset.band; S.stock.sort = 'oldest'; go('stock'); });
    $$('[data-sheet]', v).forEach(b => b.onclick = () => window.open(d.sheetUrl, '_blank'));
  }
  const sum = (arr, f) => arr.reduce((a, x) => a + (f(x) || 0), 0);
  function kpi(k, v, dsc, hero) { return `<div class="kpi${hero ? ' hero' : ''}"><div class="k">${k}</div><div class="v">${v}</div><div class="d">${dsc}</div></div>`; }

  function monthChart() {
    const sold = S.data.items.filter(i => isBiz(i) && isSold(i) && i.soldOn);
    const byM = {};
    sold.forEach(i => { const k = monthKey(i.soldOn); byM[k] = byM[k] || { rev: 0, prof: 0 }; byM[k].rev += i.soldFor; byM[k].prof += profitOf(i) || 0; });
    S.data.expenses.forEach(e => { const k = monthKey(e.date); if (byM[k] && isNum(e.amount)) byM[k].prof -= e.amount; });
    const keys = Object.keys(byM).sort().slice(-8);
    if (!keys.length) return '<div class="empty">No sales yet.</div>';
    const max = Math.max(...keys.map(k => Math.max(byM[k].rev, byM[k].prof)), 1);
    const W = 560, H = 230, pad = 28, bw = (W - pad) / keys.length;
    const y = v => H - 24 - (Math.max(v, 0) / max) * (H - 50);
    let bars = '';
    keys.forEach((k, n) => {
      const x = pad + n * bw, w = Math.min(22, bw / 3);
      const m = byM[k];
      bars += `<rect x="${x + bw / 2 - w - 2}" y="${y(m.rev)}" width="${w}" height="${H - 24 - y(m.rev)}" rx="4" fill="var(--teal)"><title>${monthLabel(k)} revenue ${gbp(m.rev)}</title></rect>`;
      bars += `<rect x="${x + bw / 2 + 2}" y="${y(m.prof)}" width="${w}" height="${H - 24 - y(m.prof)}" rx="4" fill="var(--ink)"><title>${monthLabel(k)} net profit ${gbp(m.prof)}</title></rect>`;
      bars += `<text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${MONTHS[Number(k.slice(5)) - 1]}</text>`;
      bars += `<text x="${x + bw / 2 - w / 2 - 2}" y="${y(m.rev) - 6}" text-anchor="middle">${Math.round(m.rev)}</text>`;
      bars += `<text x="${x + bw / 2 + w / 2 + 2}" y="${y(m.prof) - 6}" text-anchor="middle"${m.prof < 0 ? ' style="fill:var(--bad)"' : ''}>${m.prof < 0 ? '−' : ''}${Math.abs(Math.round(m.prof))}</text>`;
    });
    const grid = [0.5, 1].map(f => `<line x1="${pad}" x2="${W}" y1="${y(max * f)}" y2="${y(max * f)}" stroke="var(--line)" stroke-dasharray="3 4"/><text x="0" y="${y(max * f) + 4}">£${Math.round(max * f)}</text>`).join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Revenue and profit by month">${grid}<line x1="${pad}" x2="${W}" y1="${H - 24}" y2="${H - 24}" stroke="var(--line)"/>${bars}</svg><p class="fine">Net profit per month takes off that month's expenses. Figures are £.</p>`;
  }

  function agedPanel(stock) {
    const st = S.data.settings;
    const c = { good: 0, warn: 0, bad: 0 };
    stock.forEach(i => { const b = ageBand(ageOf(i)); if (b) c[b]++; });
    return `<div class="aged">
      <button class="a-good" data-band="good"><span class="v">${c.good}</span>Under ${st.amberDays} days</button>
      <button class="a-warn" data-band="warn"><span class="v">${c.warn}</span>${st.amberDays}–${st.redDays - 1} days</button>
      <button class="a-bad" data-band="bad"><span class="v">${c.bad}</span>${st.redDays}+ days</button>
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
    return `${m(`Vinted sales in ${yr}`, calSales, st.hmrcSales, v => String(v))}
      ${m(`Vinted income in ${yr}`, calIncome, st.hmrcIncome, v => gbp(v, 0))}
      ${m(`Business income, tax year to ${ukDate(tyEnd)}`, tyIncome, st.allowance, v => gbp(v, 0))}
      <p class="fine">Vinted tells HMRC about sellers with ${st.hmrcSales}+ sales or about £${st.hmrcIncome.toLocaleString('en-GB')} in a calendar year. The £${st.allowance.toLocaleString('en-GB')} trading allowance is per tax year, on income before costs.</p>`;
  }

  // ---------- stock ----------
  function renderStock() {
    const f = S.stock, items = S.data.items.filter(i => !isSold(i) && ['Returned', 'Kept'].indexOf(i.status) < 0);
    const statuses = ['All', 'In stock', 'Listed', 'Reserved'];
    const cats = ['All'].concat(Array.from(new Set(items.map(i => i.category).filter(Boolean))).sort());
    let list = items.filter(i => f.status === 'All' || i.status === f.status);
    if (f.cat !== 'All') list = list.filter(i => i.category === f.cat);
    if (f.aged === 'drop') list = list.filter(i => (ageOf(i) || 0) >= S.data.settings.dropDays);
    else if (f.aged) list = list.filter(i => ageBand(ageOf(i)) === f.aged);
    if (f.q) { const q = f.q.toLowerCase(); list = list.filter(i => [i.sku, i.title, i.brand, i.size, i.location, i.notes].join(' ').toLowerCase().indexOf(q) >= 0); }
    const sorters = {
      newest: (a, b) => (b.boughtOn || '').localeCompare(a.boughtOn || '') || b.sku.localeCompare(a.sku),
      oldest: (a, b) => (a.boughtOn || '9').localeCompare(b.boughtOn || '9'),
      sku: (a, b) => a.sku.localeCompare(b.sku),
      price: (a, b) => (b.listedAt || 0) - (a.listedAt || 0)
    };
    list.sort(sorters[f.sort]);
    const agedLabel = { good: 'Under ' + S.data.settings.amberDays + ' days', warn: 'Getting old', bad: S.data.settings.redDays + '+ days', drop: 'Over ' + S.data.settings.dropDays + ' days' }[f.aged];

    const v = $('#view-stock');
    v.innerHTML = `
      <div class="head"><div><h1>Stock</h1><p>${items.length} items not sold yet (${items.filter(isBiz).length} business, ${items.filter(i => !isBiz(i)).length} personal) · business stock ${gbp(sum(items.filter(isBiz), i => isNum(i.cost) ? i.cost : 0))} at cost</p></div></div>
      <div class="toolbar">
        <label class="search"><svg viewBox="0 0 24 24"><path d="M15.5 14h-.8l-.3-.3A6.5 6.5 0 1 0 14 15.5l.3.3v.8l5 5 1.5-1.5zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z"/></svg><input id="stockQ" type="search" placeholder="Search SKU, brand, title, size…" value="${esc(f.q)}"></label>
        <select class="select" id="stockCat">${cats.map(c => `<option ${c === f.cat ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
        <select class="select" id="stockSort">
          ${[['newest', 'Newest bought'], ['oldest', 'Oldest first'], ['sku', 'SKU order'], ['price', 'Highest price']].map(([k, l]) => `<option value="${k}" ${f.sort === k ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
      </div>
      <div class="chips" id="stockChips">
        ${statuses.map(s => `<button class="chip ${f.status === s ? 'on' : ''}" data-s="${s}">${s}<span class="c">${s === 'All' ? items.length : items.filter(i => i.status === s).length}</span></button>`).join('')}
        ${agedLabel ? `<button class="chip on" data-clear-aged>${esc(agedLabel)} ✕</button>` : ''}
      </div>
      <div class="count">${list.length} shown</div>
      ${list.length ? `<div class="cards">${list.map(card).join('')}</div>` : '<div class="empty">Nothing matches. Try clearing the search or filters.</div>'}`;

    const q = $('#stockQ', v);
    q.oninput = () => { f.q = q.value; clearTimeout(renderStock._t); renderStock._t = setTimeout(() => { renderStock(); const n = $('#stockQ'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 200); };
    $('#stockCat', v).onchange = e => { f.cat = e.target.value; renderStock(); };
    $('#stockSort', v).onchange = e => { f.sort = e.target.value; renderStock(); };
    $$('[data-s]', v).forEach(b => b.onclick = () => { f.status = b.dataset.s; renderStock(); });
    const ca = $('[data-clear-aged]', v); if (ca) ca.onclick = () => { f.aged = ''; renderStock(); };
    $$('.card', v).forEach(c => c.onclick = () => openItem(c.dataset.sku));
  }
  function card(i) {
    const age = ageOf(i), band = ageBand(age);
    const ageTag = age != null ? `<span class="age" style="${band === 'bad' ? 'background:var(--bad)' : band === 'warn' ? 'background:var(--warn)' : ''}">${age}d</span>` : '';
    const price = isNum(i.listedAt) ? gbp(i.listedAt) : (isNum(i.cost) ? `<span class="unk">cost ${gbp(i.cost)}</span>` : '');
    return `<button class="card" data-sku="${esc(i.sku)}">
      <div class="ph">${photoBlock(i, `<span class="pill ${statusClass(i.status)}">${esc(i.status || 'In stock')}</span>${ageTag}`)}</div>
      <div class="b"><span class="sku">${esc(i.sku)}${i.location ? ' · ' + esc(i.location) : ''}${isBiz(i) ? '' : ' · Personal'}</span><span class="t">${esc(i.title)}</span>
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

    const v = $('#view-sold');
    v.innerHTML = `
      <div class="head"><div><h1>Sold</h1><p>${list.length} sales · ${gbp(rev)} revenue · ${gbp(prof)} profit before expenses</p></div>
        <div class="seg" id="useSeg">${['Business', 'Personal', 'All'].map(u => `<button data-u="${u}" class="${f.use === u ? 'on' : ''}">${u}</button>`).join('')}</div></div>
      <div class="toolbar">
        <label class="search"><svg viewBox="0 0 24 24"><path d="M15.5 14h-.8l-.3-.3A6.5 6.5 0 1 0 14 15.5l.3.3v.8l5 5 1.5-1.5zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z"/></svg><input id="soldQ" type="search" placeholder="Search sold items…" value="${esc(f.q)}"></label>
        <select class="select" id="soldMonth"><option value="All">All months</option>${months.map(m => `<option value="${m}" ${f.month === m ? 'selected' : ''}>${monthLabel(m)}</option>`).join('')}</select>
      </div>
      ${list.length ? `<div class="list">${keys.map(k => {
        const g = groups[k];
        return `<div class="month-h">${k === 'none' ? 'No date' : monthLabel(k)}<span>${g.length} · ${gbp(sum(g, i => i.soldFor))}</span></div>` + g.map(soldRow).join('');
      }).join('')}</div>` : '<div class="empty">No sales match.</div>'}`;
    $$('#useSeg button', v).forEach(b => b.onclick = () => { f.use = b.dataset.u; f.month = 'All'; renderSold(); });
    $('#soldMonth', v).onchange = e => { f.month = e.target.value; renderSold(); };
    const q = $('#soldQ', v);
    q.oninput = () => { f.q = q.value; clearTimeout(renderSold._t); renderSold._t = setTimeout(() => { renderSold(); const n = $('#soldQ'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 200); };
    $$('.li', v).forEach(r => r.onclick = () => openItem(r.dataset.sku));
  }
  function soldRow(i) {
    const p = profitOf(i);
    const days = i.boughtOn && i.soldOn ? daysBetween(i.boughtOn, i.soldOn) : null;
    const pTxt = p == null ? '<small class="unk">cost unknown</small>' : `<small class="${p >= 0 ? 'pos' : 'neg'}">${p >= 0 ? '+' : ''}${gbp(p)}</small>`;
    return `<button class="li" data-sku="${esc(i.sku)}">${thumb(i)}
      <div class="mid"><b>${esc(i.title)}</b><span>${esc(i.sku)} · ${ukDate(i.soldOn)}${days != null ? ' · ' + days + ' days' : ''}${i.status === 'In transit' ? ' · in transit' : ''}</span></div>
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
      <div class="head"><div><h1>Expenses</h1><p>${all.length} expenses · ${gbp(sum(all, e => e.amount))} in total · all counted as business costs</p></div>
        <button class="btn" id="addEx"><svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z"/></svg>Add expense</button></div>
      <div class="grid2">
        <div class="list">${list.length ? list.map(e => `<button class="li ex" data-row="${e.row}"><div class="ex-ic">${esc((e.category || '?').slice(0, 2).toUpperCase())}</div>
          <div class="mid"><b>${esc(e.description || e.category)}</b><span>${ukDate(e.date)} · ${esc(e.category)}</span></div><div class="end">${gbp(e.amount)}</div></button>`).join('') : '<div class="empty">No expenses yet.</div>'}</div>
        <div class="panel"><h3>By category</h3>
          <div class="chips" style="flex-wrap:wrap">${['All'].concat(cats).map(c => `<button class="chip ${S.exCat === c ? 'on' : ''}" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>
          <div class="rank">${Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a]).map(k => `<div class="row"><b>${esc(k)}</b><span>${gbp(byCat[k])}</span><div class="bar"><i style="width:${byCat[k] / max * 100}%"></i></div></div>`).join('')}</div>
        </div>
      </div>`;
    $('#addEx', v).onclick = () => openExpense(null);
    $$('[data-c]', v).forEach(b => b.onclick = () => { S.exCat = b.dataset.c; renderExpenses(); });
    $$('.li', v).forEach(r => r.onclick = () => openExpense(S.data.expenses.filter(e => String(e.row) === r.dataset.row)[0]));
  }

  // ---------- sheets (modals) ----------
  function openSheet(html) {
    $('#sheetBody').innerHTML = html;
    $('#sheet').classList.add('on');
    $('#sheet').setAttribute('aria-hidden', 'false');
    $('.sheet-panel').scrollTop = 0;
    $$('[data-close]').forEach(b => b.onclick = closeSheet);
  }
  function closeSheet() { $('#sheet').classList.remove('on'); $('#sheet').setAttribute('aria-hidden', 'true'); }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

  const L = name => (S.data.lists[name] || []);
  const opts = (arr, cur, blank) => (blank ? '<option value=""></option>' : '') + Array.from(new Set(arr.concat(cur ? [cur] : []))).map(o => `<option ${o === cur ? 'selected' : ''}>${esc(o)}</option>`).join('');
  const val = v => v == null ? '' : v;
  function field(label, html, full) { return `<div class="f${full ? ' full' : ''}"><label>${label}</label>${html}</div>`; }
  function money(name, v) { return `<div class="money"><input name="${name}" type="number" inputmode="decimal" step="0.01" min="0" value="${isNum(v) ? v : ''}" placeholder="0.00"></div>`; }

  function itemForm(i) {
    return `
      <div class="box"><h4>Item</h4><div class="fields">
        ${field('Title', `<input name="title" value="${esc(i.title)}" required placeholder="e.g. Vintage Nike Track Jacket Navy | Size L">`, true)}
        ${field('Brand', `<input name="brand" list="dl-brand" value="${esc(i.brand)}">`)}
        ${field('Size', `<input name="size" list="dl-size" value="${esc(i.size)}">`)}
        ${field('Category', `<select name="category">${opts(L('Category'), i.category, true)}</select>`)}
        ${field('Condition', `<select name="condition">${opts(L('Condition'), i.condition, true)}</select>`)}
      </div></div>
      <div class="box"><h4>Buying and listing</h4><div class="fields">
        ${field('Bought on', `<input name="boughtOn" type="date" value="${esc(i.boughtOn)}">`)}
        ${field('Bought from', `<select name="boughtFrom">${opts(L('Source'), i.boughtFrom, true)}</select>`)}
        ${field('Cost', money('cost', i.cost) + '<span class="fine">Leave blank if you don\'t know. It\'s kept out of profit.</span>')}
        ${field('Listed at', money('listedAt', i.listedAt))}
        ${field('Status', `<select name="status">${opts(L('Status'), i.status || 'In stock')}</select>`)}
        ${field('Location', `<select name="location">${opts(L('Location'), i.location, true)}</select>`)}
        ${field('Business or personal', `<select name="use">${opts(['Business', 'Personal'], i.use || 'Business')}</select>`)}
        ${field('Vinted listing ref', `<input name="listing" value="${esc(i.listing)}" placeholder="e.g. L012">`)}
        ${field('Notes', `<textarea name="notes">${esc(i.notes)}</textarea>`, true)}
      </div></div>`;
  }
  function datalists() {
    return `<datalist id="dl-brand">${L('Brand').map(b => `<option value="${esc(b)}">`).join('')}</datalist>
      <datalist id="dl-size">${L('Size').map(b => `<option value="${esc(b)}">`).join('')}</datalist>`;
  }

  function openItem(sku) {
    const i = S.data.items.filter(x => x.sku === sku)[0];
    if (!i) return;
    const p = profitOf(i), age = ageOf(i);
    const sold = isSold(i);
    openSheet(`
      <div class="sh-top"><h2>${esc(i.sku)}</h2><button class="x" data-close aria-label="Close">×</button></div>
      <form id="itemForm" class="sh-body" autocomplete="off">
        <div class="sh-hero">
          <label class="ph" title="Change photo">${photoBlock(i, '<span class="cam">' + (i.photo ? 'Change photo' : 'Add photo') + '</span>')}<input id="photoIn" type="file" accept="image/&#42;" hidden></label>
          <div class="sh-facts">
            <span class="pill ${statusClass(i.status)}" style="align-self:flex-start">${esc(i.status || 'In stock')}</span>
            <b style="font-size:16px;line-height:1.3">${esc(i.title)}</b>
            <div class="big">${sold ? gbp(i.soldFor) : isNum(i.listedAt) ? gbp(i.listedAt) : '—'}</div>
            <dl class="facts">
              <dt>Cost</dt><dd>${isNum(i.cost) ? gbp(i.cost) : 'Unknown'}</dd>
              ${sold ? `<dt>Profit</dt><dd class="${p == null ? 'unk' : p >= 0 ? 'pos' : 'neg'}">${p == null ? 'Unknown' : gbp(p)}</dd><dt>Sold</dt><dd>${ukDate(i.soldOn)}</dd>` : `<dt>In stock</dt><dd>${age == null ? '—' : age + ' days'}</dd>`}
              <dt>Storage</dt><dd>${esc(i.storage || '—')}</dd>
            </dl>
          </div>
        </div>
        ${sold ? '' : `<button type="button" class="btn" id="markSold"><svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>Mark as sold</button>`}
        <div id="soldSlot">${sold ? soldBox(i) : ''}</div>
        ${itemForm(i)}
        ${datalists()}
      </form>
      <div class="actions"><button class="btn ghost" data-close>Cancel</button><button class="btn" id="saveItem">Save changes</button></div>`);

    const form = $('#itemForm');
    const ms = $('#markSold');
    if (ms) ms.onclick = () => { $('#soldSlot').innerHTML = soldBox(Object.assign({}, i, { soldOn: S.data.today, soldFor: i.listedAt, channel: 'Vinted', status: 'Sold' })); ms.remove(); wireSold(form, i); $('[name=soldFor]', form).focus(); };
    if (sold) wireSold(form, i);
    $('#photoIn').onchange = e => uploadPhoto(i.sku, e.target.files[0]);
    $('#saveItem').onclick = () => save(form, i);
  }
  function soldBox(i) {
    return `<div class="box sold-box"><h4>Sale</h4><div class="fields">
      ${field('Sold for', money('soldFor', i.soldFor))}
      ${field('Sold on', `<input name="soldOn" type="date" value="${esc(i.soldOn)}">`)}
      ${field('Sale status', `<select name="saleStatus">${opts(['Sold', 'In transit'], i.status === 'In transit' ? i.status : 'Sold')}</select>`)}
      ${field('Channel', `<select name="channel">${opts(['Vinted', 'eBay', 'Depop', 'In person', 'Other'], i.channel || 'Vinted')}</select>`)}
      ${field('Postage you paid', money('postage', i.postage))}
      ${field('Fees you paid', money('fees', i.fees))}
      <div class="f full"><span class="fine">Profit: <span class="profit-preview" id="profitPrev"></span></span></div>
    </div></div>`;
  }
  function wireSold(form, i) {
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
      toast(saved.status === 'Sold' && !isSold(orig) ? 'Sold! Nice one.' : 'Saved');
    }).catch(e => { busy('#saveItem', false); toast(errMsg(e), true); });
  }

  function openNew() {
    const st = S.data.settings;
    const blank = { status: 'In stock', boughtOn: S.data.today, use: 'Business' };
    openSheet(`
      <div class="sh-top"><h2>Add an item</h2><button class="x" data-close aria-label="Close">×</button></div>
      <form id="newForm" class="sh-body" autocomplete="off">
        <div class="box"><h4>Where will it live?</h4>
          <div class="radio">
            <label><input type="radio" name="storage" value="Boxed" checked><span>Boxed (bagged)<small>SKU : ${esc(st.nextSku)}</small></span></label>
            <label><input type="radio" name="storage" value="Oversized"><span>Oversized (wardrobe)<small>OS : ${esc(st.nextOs)}</small></span></label>
          </div>
          <p class="fine">The number is given out when you save. Write it on the bag sticker.</p>
        </div>
        ${itemForm(blank)}
        <div class="box"><h4>Photo</h4><input id="newPhoto" type="file" accept="image/&#42;"><span class="fine">Optional. You can add one later.</span></div>
        ${datalists()}
      </form>
      <div class="actions"><button class="btn ghost" data-close>Cancel</button><button class="btn" id="saveNew">Add item</button></div>`);
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
        if (file) uploadPhoto(saved.sku, file);
      }).catch(e => { busy('#saveNew', false); toast(errMsg(e), true); });
    };
  }

  function openExpense(e) {
    const isNew = !e;
    e = e || { date: S.data.today, category: '', description: '', amount: '', notes: '' };
    openSheet(`
      <div class="sh-top"><h2>${isNew ? 'Add an expense' : 'Edit expense'}</h2><button class="x" data-close aria-label="Close">×</button></div>
      <form id="exForm" class="sh-body" autocomplete="off"><div class="box"><div class="fields">
        ${field('Date', `<input name="date" type="date" value="${esc(e.date)}">`)}
        ${field('Amount', money('amount', e.amount))}
        ${field('Category', `<select name="category">${opts(L('Expense category'), e.category, true)}</select>`, true)}
        ${field('What was it?', `<input name="description" value="${esc(e.description)}" placeholder="e.g. Shipping bags x10">`, true)}
        ${field('Notes', `<textarea name="notes">${esc(e.notes)}</textarea>`, true)}
      </div></div></form>
      <div class="actions">${isNew ? '<button class="btn ghost" data-close>Cancel</button>' : '<button class="btn danger" id="delEx">Delete</button>'}<button class="btn" id="saveEx">${isNew ? 'Add expense' : 'Save'}</button></div>`);
    $('#saveEx').onclick = () => {
      const o = readForm($('#exForm'));
      if (o.amount === '' || !o.date) { toast('Add a date and an amount.', true); return; }
      if (!isNew) o.row = e.row;
      busy('#saveEx', true);
      call('saveExpense', o).then(list => { S.data.expenses = list; closeSheet(); render(); toast('Expense saved'); })
        .catch(err => { busy('#saveEx', false); toast(errMsg(err), true); });
    };
    const del = $('#delEx');
    if (del) del.onclick = () => {
      if (del.dataset.sure !== 'yes') { del.dataset.sure = 'yes'; del.textContent = 'Tap again to delete'; return; }
      busy('#delEx', true);
      call('deleteExpense', e.row, e.description).then(list => { S.data.expenses = list; closeSheet(); render(); toast('Expense deleted'); })
        .catch(err => { busy('#delEx', false); toast(errMsg(err), true); });
    };
  }

  function busy(sel, on) { const b = $(sel); if (!b) return; b.disabled = on; if (on) { b.dataset.t = b.textContent; b.textContent = 'Saving…'; } else if (b.dataset.t) b.textContent = b.dataset.t; }

  // ---------- photos ----------
  function shrink(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const max = 1200, s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.82).split(',')[1]);
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => reject(new Error("That photo couldn't be read. Try a JPEG or PNG."));
      img.src = URL.createObjectURL(file);
    });
  }
  function uploadPhoto(sku, file) {
    if (!file) return;
    toast('Uploading photo…');
    shrink(file).then(b64 => call('uploadPhoto', sku, b64, 'image/jpeg')).then(id => {
      const it = S.data.items.filter(x => x.sku === sku)[0];
      if (it) it.photo = id;
      render();
      if ($('#sheet').classList.contains('on') && $('.sh-top h2') && $('.sh-top h2').textContent === sku) openItem(sku);
      toast('Photo saved');
    }).catch(e => toast(errMsg(e), true));
  }

  function seedBanner() {
    const b = $('#banner');
    if (!S.data.seedPhotosPending) { b.innerHTML = ''; return; }
    b.innerHTML = `<div class="banner"><span>Add the photos from your live Vinted listings to your stock? It takes about a minute.</span><button class="btn sm" id="seedGo">Add photos</button></div>`;
    $('#seedGo').onclick = () => {
      const btn = $('#seedGo'); btn.disabled = true;
      const step = start => call('importSeedPhotos', start).then(r => {
        btn.textContent = `Adding ${r.done} of ${r.total}…`;
        if (r.done < r.total) return step(r.done);
        return call('getData').then(d => { S.data = d; render(); toast('Photos added'); });
      });
      step(0).catch(e => { btn.disabled = false; btn.textContent = 'Try again'; toast(errMsg(e), true); });
    };
  }

  // ---------- routing ----------
  function go(view) {
    S.view = view;
    $$('.nav').forEach(n => n.classList.toggle('on', n.dataset.view === view));
    $$('.view').forEach(v => v.classList.toggle('on', v.id === 'view-' + view));
    render();
    window.scrollTo(0, 0);
  }
  function render() {
    if (!S.data) return;
    seedBanner();
    ({ dashboard: renderDashboard, stock: renderStock, sold: renderSold, expenses: renderExpenses })[S.view]();
  }
  $$('.nav').forEach(n => n.onclick = () => { if (n.dataset.view === 'stock') { S.stock.aged = ''; } go(n.dataset.view); });
  $('#fab').onclick = () => { if (S.data) openNew(); };

  // ---------- key + start-up ----------
  function askKey(msg) {
    const l = $('#loading');
    l.classList.remove('off');
    $$('.view').forEach(v => v.classList.remove('on'));
    $('#banner').innerHTML = '';
    l.innerHTML = `<form class="keybox" id="keyForm">
      <img src="apple-touch-icon.png" alt="">
      <h2>Vinted Tracker</h2>
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
    l.innerHTML = '<div class="spin"></div><p>Loading your stock…</p>';
    call('getData').then(d => {
      S.data = d;
      l.classList.add('off');
      $('#sheetLink').href = d.sheetUrl;
      go(S.view);
    }).catch(e => {
      if (errMsg(e) === 'Key needed') return;
      l.innerHTML = `<p>Couldn't load your data: ${esc(errMsg(e))}</p><button class="btn" id="retry">Try again</button>`;
      $('#retry').onclick = start;
    });
  }

  $('#forgetKey').onclick = () => { setKey(''); S.data = null; askKey(''); };
  if (getKey()) start(); else askKey('');
})();
