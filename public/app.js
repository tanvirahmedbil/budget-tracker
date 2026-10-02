'use strict';

/* =========================================================
   Spent — a calm, simple spending tracker.
   Everything is stored on this device (localStorage).
   ========================================================= */

const VERSION = '1.0.0';
const KEY = 'spent:v1';

const PALETTE = [
  '#FF5A3C', '#FF4D8D', '#F29A0B', '#A3B800', '#0FA968',
  '#00A8B5', '#2E7DFF', '#6C4BFF', '#B44BE1', '#8B5E3C', '#6B6B6B',
];
const DEFAULT_CATS = [
  ['Food', '#F29A0B'], ['Bike', '#2E7DFF'], ['Personal', '#6C4BFF'],
  ['Mother', '#FF4D8D'], ['Father', '#00A8B5'], ['Sister', '#FF5A3C'],
  ['Gifts', '#B44BE1'], ['Therapy', '#0FA968'], ['Bills', '#8B5E3C'],
];
const CURRENCIES = ['৳', '$', '€', '£', '₹', '¥', '₩', 'RM', 'AED'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- Dates (always local, stored as YYYY-MM-DD) ---------- */
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const today = () => iso(new Date());
const fmt = (d, o) => d.toLocaleDateString(undefined, o);

function dayName(s) {
  const t = today();
  if (s === t) return 'Today';
  if (s === iso(addDays(new Date(), -1))) return 'Yesterday';
  const d = parse(s);
  const o = { weekday: 'short', day: 'numeric', month: 'short' };
  if (d.getFullYear() !== new Date().getFullYear()) o.year = 'numeric';
  return fmt(d, o);
}
function shortDate(s) {
  const d = parse(s);
  const o = { day: 'numeric', month: 'short' };
  if (d.getFullYear() !== new Date().getFullYear()) o.year = 'numeric';
  return fmt(d, o);
}

function bounds(period, anchor) {
  const a = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  if (period === 'day') return [a, a];
  if (period === 'week') {
    const s = addDays(a, -((a.getDay() - db.settings.weekStart + 7) % 7));
    return [s, addDays(s, 6)];
  }
  if (period === 'month') return [new Date(a.getFullYear(), a.getMonth(), 1), new Date(a.getFullYear(), a.getMonth() + 1, 0)];
  return [new Date(a.getFullYear(), 0, 1), new Date(a.getFullYear(), 11, 31)];
}
function shift(period, anchor, dir) {
  if (period === 'day') return addDays(anchor, dir);
  if (period === 'week') return addDays(anchor, 7 * dir);
  if (period === 'month') return new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1);
  return new Date(anchor.getFullYear() + dir, 0, 1);
}
function periodLabel(period, anchor) {
  const [s, e] = bounds(period, anchor);
  const now = new Date();
  const isNow = iso(s) <= today() && today() <= iso(e);
  if (period === 'day') return dayName(iso(s));
  if (period === 'week') return isNow ? 'This week' : `${shortDate(iso(s))} – ${shortDate(iso(e))}`;
  if (period === 'month') {
    const o = { month: 'long' };
    if (s.getFullYear() !== now.getFullYear()) o.year = 'numeric';
    return fmt(s, o);
  }
  return String(s.getFullYear());
}
/* "this month", "on 30 Sep", "in March" — used in alerts */
function periodPhrase(period, startIso) {
  const [s, e] = bounds(period, parse(startIso));
  const isNow = iso(s) <= today() && today() <= iso(e);
  if (period === 'day') return isNow ? 'today' : `on ${shortDate(startIso)}`;
  if (period === 'week') return isNow ? 'this week' : `in the week of ${shortDate(startIso)}`;
  if (period === 'month') return isNow ? 'this month' : `in ${fmt(s, { month: 'long', year: 'numeric' })}`;
  return isNow ? 'this year' : `in ${s.getFullYear()}`;
}

/* ---------- Store ---------- */
function fresh() {
  return {
    v: 1,
    entries: [],
    cats: DEFAULT_CATS.map(([name, color]) => ({ id: uid(), name, color })),
    limits: [],
    settings: { currency: '৳', weekStart: 1, lastCat: null },
  };
}
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && Array.isArray(d.entries)) return normalize(d);
  } catch (_) { /* fall through */ }
  return fresh();
}
function normalize(d) {
  const base = fresh();
  return {
    v: 1,
    entries: (d.entries || []).filter((e) => e && e.id && e.date && +e.amount > 0),
    cats: Array.isArray(d.cats) && d.cats.length ? d.cats : base.cats,
    limits: Array.isArray(d.limits) ? d.limits : [],
    settings: { ...base.settings, ...(d.settings || {}) },
  };
}
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch (_) { toast('Could not save on this device'); }
}

let db = load();
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

const catById = (id) => db.cats.find((c) => c.id === id) || { id, name: 'Other', color: '#6B6B6B' };
const liveCats = () => db.cats.filter((c) => !c.archived);
const sum = (list) => Math.round(list.reduce((a, e) => a + e.amount, 0) * 100) / 100;

function money(n) {
  const r = Math.round(n * 100) / 100;
  const s = r.toLocaleString(undefined, {
    minimumFractionDigits: Number.isInteger(r) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  const c = db.settings.currency;
  return c.length > 1 ? `${c} ${s}` : `${c}${s}`;
}
function parseAmount(v) {
  const n = parseFloat(String(v).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}
function spentIn(cat, from, to) {
  return sum(db.entries.filter((e) => e.date >= from && e.date <= to && (cat === 'all' || e.cat === cat)));
}

/* =========================================================
   UI helpers
   ========================================================= */
let toastTimer;
function toast(msg, action) {
  const el = $('#toast');
  el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button>${esc(action.label)}</button>` : ''}`;
  if (action) $('button', el).onclick = () => { action.run(); el.classList.remove('show'); };
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), action ? 4500 : 2200);
}
function shake(el) {
  el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
  if (navigator.vibrate) navigator.vibrate(30);
}
function pop(el) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }

function openSheet(html, mount) {
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  const el = document.createElement('div');
  el.className = 'sheet';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.innerHTML = `<div class="grab"></div>${html}`;
  document.body.append(scrim, el);
  void el.offsetWidth;
  scrim.classList.add('open');
  el.classList.add('open');
  const close = () => {
    scrim.classList.remove('open');
    el.classList.remove('open');
    setTimeout(() => { scrim.remove(); el.remove(); }, 380);
  };
  scrim.onclick = close;
  const onKey = (ev) => { if (ev.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } };
  document.addEventListener('keydown', onKey);
  if (mount) mount(el, close);
  return close;
}

function chipsHTML(cats, selected, { all = false, add = false } = {}) {
  let h = '';
  if (all) h += `<button class="chip ${selected === 'all' ? 'on' : ''}" data-id="all">All</button>`;
  h += cats.map((c) => `<button class="chip ${c.id === selected ? 'on' : ''}" data-id="${c.id}" style="--c:${c.color}">${esc(c.name)}</button>`).join('');
  if (add) h += '<button class="chip add" data-id="+">+ New</button>';
  return h;
}

/* Animated number roll for big totals */
function countTo(el, to) {
  const from = parseFloat(el.dataset.v || '0');
  el.dataset.v = String(to);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || from === to) { el.textContent = money(to); return; }
  const t0 = performance.now();
  const dur = 450;
  const step = (t) => {
    const p = Math.min(1, (t - t0) / dur);
    const k = 1 - Math.pow(1 - p, 3);
    el.textContent = money(from + (to - from) * k);
    if (p < 1) requestAnimationFrame(step);
    else el.textContent = money(to);
  };
  requestAnimationFrame(step);
}

/* =========================================================
   Limits & alerts
   ========================================================= */
function snapshot(dates) {
  const out = {};
  for (const l of db.limits) {
    for (const d of dates) {
      const [s, e] = bounds(l.period, parse(d));
      out[`${l.id}|${iso(s)}`] = spentIn(l.cat, iso(s), iso(e));
    }
  }
  return out;
}
/* Run a change to the data; alert if it pushed any limit over. */
function commit(mutate, dates) {
  const before = snapshot(dates);
  mutate();
  persist();
  const after = snapshot(dates);
  const crossed = [];
  for (const k of Object.keys(after)) {
    const [id, start] = k.split('|');
    const l = db.limits.find((x) => x.id === id);
    if (l && (before[k] ?? 0) <= l.amount && after[k] > l.amount) crossed.push({ l, spent: after[k], start });
  }
  if (crossed.length) showOver(crossed);
}
function limitName(l) { return l.cat === 'all' ? 'Everything' : catById(l.cat).name; }

function showOver(list) {
  const lines = list.map(({ l, spent, start }) =>
    `<b>${esc(limitName(l))}</b> is at <b>${esc(money(spent))}</b> ${esc(periodPhrase(l.period, start))} — your limit is ${esc(money(l.amount))}.`).join('<br><br>');
  const el = document.createElement('div');
  el.className = 'over';
  el.setAttribute('role', 'alertdialog');
  el.innerHTML = `<h1 class="display">Over.</h1><p>${lines}</p><button class="btn">Got it</button>`;
  document.body.append(el);
  void el.offsetWidth;
  el.classList.add('open');
  if (navigator.vibrate) navigator.vibrate([60, 60, 60]);
  $('.btn', el).onclick = () => { el.classList.remove('open'); setTimeout(() => el.remove(), 260); };

  list.forEach(({ l, spent, start }) => notify(
    `Over limit: ${limitName(l)}`,
    `${money(spent)} ${periodPhrase(l.period, start)} · limit ${money(l.amount)}`,
    `limit-${l.id}-${start}`,
  ));
}

async function notify(title, body, tag) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const opts = { body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' };
  try {
    const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
    if (reg) await reg.showNotification(title, opts);
    else new Notification(title, opts);
  } catch (_) { /* in-app alert already shown */ }
}

/* =========================================================
   ADD
   ========================================================= */
const add = { date: today(), cat: null };

function renderAdd() {
  if (add.cat && !liveCats().some((c) => c.id === add.cat)) add.cat = null;
  if (!add.cat && db.settings.lastCat && liveCats().some((c) => c.id === db.settings.lastCat)) add.cat = db.settings.lastCat;

  const isToday = add.date === today();
  $$('[data-cur]').forEach((el) => { el.textContent = db.settings.currency; });
  $('#add-date-label').textContent = dayName(add.date);
  $('#add-date').value = add.date;
  $('#add-date').max = today();
  $('#add-date').closest('.when').classList.toggle('changed', !isToday);
  $('#add-cats').innerHTML = chipsHTML(liveCats(), add.cat, { add: true });
  $('#sofar-label').textContent = isToday ? 'Today so far' : `${dayName(add.date)} total`;
  $('#sofar').textContent = money(spentIn('all', add.date, add.date));
}

function saveEntry() {
  const amtEl = $('#amt');
  const amount = parseAmount(amtEl.value);
  if (!amount) { shake($('#amt-wrap')); amtEl.focus(); return; }
  if (!add.cat) { shake($('#add-cats')); toast('Pick a category'); return; }

  const e = { id: uid(), amount, note: $('#note').value.trim(), cat: add.cat, date: add.date, ts: Date.now() };
  db.settings.lastCat = add.cat;
  commit(() => db.entries.push(e), [e.date]);

  amtEl.value = '';
  $('#note').value = '';
  document.activeElement && document.activeElement.blur();
  renderAdd();
  pop($('#sofar'));
  toast(`Saved · ${money(amount)} · ${catById(e.cat).name}`);
}

$('#add-cats').addEventListener('click', (ev) => {
  const b = ev.target.closest('.chip');
  if (!b) return;
  if (b.dataset.id === '+') { openCatSheet(null, (c) => { add.cat = c.id; renderAdd(); }); return; }
  add.cat = add.cat === b.dataset.id ? null : b.dataset.id;
  renderAdd();
});
$('#add-date').addEventListener('change', (ev) => {
  add.date = ev.target.value || today();
  if (add.date > today()) add.date = today();
  renderAdd();
});
$('#save').addEventListener('click', saveEntry);
$('#amt').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') $('#note').focus(); });
$('#note').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') ev.target.blur(); });

/* =========================================================
   VIEW
   ========================================================= */
const PERIODS = [['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['year', 'Year'], ['range', 'Range']];
const view = {
  period: 'month',
  anchor: new Date(),
  from: iso(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
  to: today(),
  cat: 'all',
  show: 'cats',
};

function viewRange() {
  if (view.period === 'range') return view.from <= view.to ? [view.from, view.to] : [view.to, view.from];
  return bounds(view.period, view.anchor).map(iso);
}

function renderView() {
  const [from, to] = viewRange();

  $('#periods').innerHTML = PERIODS.map(([k, l]) => `<button class="chip ${view.period === k ? 'on' : ''}" data-p="${k}">${l}</button>`).join('');

  const isRange = view.period === 'range';
  $('#stepper').hidden = isRange;
  $('#range').hidden = !isRange;
  if (isRange) {
    $('#from').value = view.from; $('#to').value = view.to;
    $('#from-label').textContent = shortDate(view.from);
    $('#to-label').textContent = shortDate(view.to);
  } else {
    $('#period-label').textContent = periodLabel(view.period, view.anchor);
    $('#next').disabled = iso(bounds(view.period, shift(view.period, view.anchor, 1))[0]) > today();
  }

  const used = new Set(db.entries.map((e) => e.cat));
  const cats = db.cats.filter((c) => !c.archived || used.has(c.id));
  $('#view-cats').innerHTML = chipsHTML(cats, view.cat, { all: true });

  const list = db.entries
    .filter((e) => e.date >= from && e.date <= to && (view.cat === 'all' || e.cat === view.cat))
    .sort((a, b) => (b.date.localeCompare(a.date)) || (b.ts - a.ts));
  const total = sum(list);

  const where = view.cat === 'all' ? 'Everything' : catById(view.cat).name;
  const when = isRange ? `${shortDate(from)} – ${shortDate(to)}` : periodLabel(view.period, view.anchor);
  $('#total-caption').textContent = `${where} · ${when}`;
  countTo($('#total'), total);
  $('#total-count').textContent = list.length === 1 ? '1 entry' : `${list.length} entries`;

  // Which tables make sense right now
  const segs = [];
  if (view.cat === 'all') segs.push(['cats', 'Categories']);
  if (view.period !== 'day' && from !== to) segs.push(['days', 'Days']);
  segs.push(['items', 'Items']);
  if (!segs.some(([k]) => k === view.show)) view.show = segs[0][0];
  $('#seg').innerHTML = segs.map(([k, l]) => `<button class="${view.show === k ? 'on' : ''}" data-s="${k}">${l}</button>`).join('');
  $('#seg').hidden = segs.length < 2 || !list.length;

  const table = $('#table');
  if (!list.length) {
    table.innerHTML = '<div class="empty"><h2>Nothing.</h2><p>No spending here yet.</p></div>';
    return;
  }

  if (view.show === 'cats') {
    const by = new Map();
    list.forEach((e) => by.set(e.cat, (by.get(e.cat) || 0) + e.amount));
    const rows = [...by].sort((a, b) => b[1] - a[1]);
    const max = rows[0][1];
    table.innerHTML = `<div class="rows">${rows.map(([id, amt]) => {
      const c = catById(id);
      return `<button class="r" data-cat="${id}" style="--c:${c.color}">
        <span class="main"><span class="t" style="color:${c.color}">${esc(c.name)}</span>
        <span class="bar"><b style="width:${Math.max(2, (amt / max) * 100)}%"></b></span></span>
        <span><span class="amt">${money(amt)}</span><span class="pct">${Math.round((amt / total) * 100)}%</span></span>
      </button>`;
    }).join('')}</div>`;
  } else if (view.show === 'days') {
    const by = new Map();
    list.forEach((e) => { const d = by.get(e.date) || { amt: 0, n: 0 }; d.amt += e.amount; d.n++; by.set(e.date, d); });
    const max = Math.max(...[...by.values()].map((d) => d.amt));
    table.innerHTML = `<div class="rows">${[...by].map(([d, { amt, n }]) => `
      <button class="r" data-day="${d}">
        <span class="main"><span class="t">${esc(dayName(d))}</span>
        <span class="bar"><b style="width:${Math.max(2, (amt / max) * 100)}%;background:var(--violet)"></b></span></span>
        <span><span class="amt">${money(amt)}</span><span class="pct">${n} ${n === 1 ? 'item' : 'items'}</span></span>
      </button>`).join('')}</div>`;
  } else {
    let h = '';
    let cur = '';
    list.forEach((e) => {
      if (e.date !== cur) {
        cur = e.date;
        h += `<div class="day-h"><span>${esc(dayName(cur))}</span><span>${money(sum(list.filter((x) => x.date === cur)))}</span></div>`;
      }
      const c = catById(e.cat);
      h += `<button class="r" data-entry="${e.id}">
        <span class="main"><span class="t">${esc(e.note || c.name)}</span>
        <span class="s"><i style="color:${c.color}">● ${esc(c.name)}</i></span></span>
        <span class="amt">${money(e.amount)}</span>
      </button>`;
    });
    table.innerHTML = h;
  }
}

$('#periods').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-p]');
  if (!b) return;
  view.period = b.dataset.p;
  view.anchor = new Date();
  renderView();
});
$('#prev').addEventListener('click', () => { view.anchor = shift(view.period, view.anchor, -1); renderView(); });
$('#next').addEventListener('click', () => { view.anchor = shift(view.period, view.anchor, 1); renderView(); });
$('#from').addEventListener('change', (ev) => { if (ev.target.value) view.from = ev.target.value; renderView(); });
$('#to').addEventListener('change', (ev) => { if (ev.target.value) view.to = ev.target.value; renderView(); });
$('#view-cats').addEventListener('click', (ev) => {
  const b = ev.target.closest('.chip');
  if (!b) return;
  view.cat = b.dataset.id;
  if (view.cat !== 'all') view.show = 'items';
  renderView();
});
$('#seg').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-s]');
  if (!b) return;
  view.show = b.dataset.s;
  renderView();
});
$('#table').addEventListener('click', (ev) => {
  const r = ev.target.closest('.r');
  if (!r) return;
  if (r.dataset.cat) { view.cat = r.dataset.cat; view.show = 'items'; renderView(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  else if (r.dataset.day) { view.period = 'day'; view.anchor = parse(r.dataset.day); view.show = 'items'; renderView(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  else if (r.dataset.entry) openEntrySheet(db.entries.find((e) => e.id === r.dataset.entry));
});

function openEntrySheet(entry) {
  if (!entry) return;
  const draft = { ...entry };
  const cats = db.cats.filter((c) => !c.archived || c.id === entry.cat);
  openSheet(`
    <h2>Edit</h2>
    <label class="amount"><span class="cur">${esc(db.settings.currency)}</span>
      <input class="e-amt" type="text" inputmode="decimal" value="${draft.amount}" aria-label="Amount"></label>
    <input class="field e-note" type="text" placeholder="On what?" maxlength="80" value="${esc(draft.note)}" aria-label="What was it for">
    <p class="label">Category</p>
    <div class="chips e-cats">${chipsHTML(cats, draft.cat)}</div>
    <p class="label">Date</p>
    <label class="pill when"><span class="e-date-l">${esc(dayName(draft.date))}</span><input class="e-date" type="date" value="${draft.date}" max="${today()}" aria-label="Date"></label>
    <button class="btn e-save">Save changes</button>
    <button class="btn ghost small danger e-del">Delete</button>
  `, (el, close) => {
    $('.e-cats', el).onclick = (ev) => {
      const b = ev.target.closest('.chip'); if (!b) return;
      draft.cat = b.dataset.id;
      $('.e-cats', el).innerHTML = chipsHTML(cats, draft.cat);
    };
    $('.e-date', el).onchange = (ev) => {
      if (!ev.target.value) return;
      draft.date = ev.target.value > today() ? today() : ev.target.value;
      $('.e-date-l', el).textContent = dayName(draft.date);
    };
    $('.e-save', el).onclick = () => {
      const amount = parseAmount($('.e-amt', el).value);
      if (!amount) { shake($('.amount', el)); return; }
      const oldDate = entry.date;
      commit(() => Object.assign(entry, draft, { amount, note: $('.e-note', el).value.trim() }), [oldDate, draft.date]);
      close(); refresh(); toast('Updated');
    };
    $('.e-del', el).onclick = () => {
      const i = db.entries.indexOf(entry);
      db.entries.splice(i, 1);
      persist(); close(); refresh();
      toast('Deleted', { label: 'Undo', run: () => { db.entries.splice(i, 0, entry); persist(); refresh(); } });
    };
  });
}

/* =========================================================
   LIMITS
   ========================================================= */
const PER = { day: 'a day', week: 'a week', month: 'a month' };
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

function renderLimits() {
  // Notification state
  const n = $('#notif');
  if (!('Notification' in window)) {
    n.innerHTML = isIOS && !isStandalone()
      ? '<div class="notif">On iPhone, add Spent to your Home Screen first — then you can turn on notifications here.</div>'
      : '<div class="notif">This browser can’t show notifications. You’ll still see an alert in the app.</div>';
  } else if (Notification.permission === 'granted') {
    n.innerHTML = '<div class="notif ok">✓ Notifications are on</div>';
  } else if (Notification.permission === 'denied') {
    n.innerHTML = '<div class="notif">Notifications are blocked. Allow them for Spent in your phone settings.</div>';
  } else {
    n.innerHTML = '<div class="notif"><span>Want a ping when you go over?</span><button class="pill" id="notif-on">Turn on</button></div>';
    $('#notif-on').onclick = async () => {
      try { await Notification.requestPermission(); } catch (_) { /* ignore */ }
      renderLimits();
      if (Notification.permission === 'granted') notify('You’re all set', 'Spent will ping you when a limit is crossed.', 'hello');
    };
  }

  const box = $('#limits');
  if (!db.limits.length) {
    box.innerHTML = '<div class="empty"><h2>None yet.</h2><p>Try “Therapy, 5,000 a month”.</p></div>';
    return;
  }
  box.innerHTML = db.limits.map((l) => {
    const [s, e] = bounds(l.period, new Date()).map(iso);
    const spent = spentIn(l.cat, s, e);
    const over = spent > l.amount;
    const color = l.cat === 'all' ? 'var(--ink)' : catById(l.cat).color;
    const pct = Math.min(100, (spent / l.amount) * 100);
    const right = over ? `Over by ${money(spent - l.amount)}` : `${money(l.amount - spent)} left`;
    return `<button class="limit ${over ? 'over' : ''}" data-id="${l.id}">
      <span class="head"><span class="name" style="color:${color}">${esc(limitName(l))}</span><span class="per">${PER[l.period]}</span></span>
      <span class="bar"><b style="width:${Math.max(pct, 1.5)}%;background:${over ? 'var(--red)' : color}"></b></span>
      <span class="nums"><span><b>${money(spent)}</b> of ${money(l.amount)}</span><span>${right}</span></span>
    </button>`;
  }).join('');
}

function openLimitSheet(limit) {
  const draft = limit ? { ...limit } : { id: uid(), cat: 'all', period: 'month', amount: 0 };
  const cats = liveCats();
  const catChips = () => `<button class="chip ${draft.cat === 'all' ? 'on' : ''}" data-id="all">Everything</button>${chipsHTML(cats, draft.cat)}`;
  const perSeg = () => Object.keys(PER).map((p) => `<button class="${draft.period === p ? 'on' : ''}" data-p="${p}">${p[0].toUpperCase() + p.slice(1)}</button>`).join('');
  openSheet(`
    <h2>${limit ? 'Edit limit' : 'New limit'}</h2>
    <p class="label">For</p>
    <div class="chips l-cats">${catChips()}</div>
    <p class="label">Every</p>
    <div class="seg l-per">${perSeg()}</div>
    <p class="label">Up to</p>
    <label class="amount" style="margin-top:0"><span class="cur">${esc(db.settings.currency)}</span>
      <input class="l-amt" type="text" inputmode="decimal" placeholder="0" value="${draft.amount || ''}" aria-label="Limit amount"></label>
    <button class="btn l-save">${limit ? 'Save' : 'Set limit'}</button>
    ${limit ? '<button class="btn ghost small danger l-del">Remove limit</button>' : ''}
  `, (el, close) => {
    $('.l-cats', el).onclick = (ev) => {
      const b = ev.target.closest('.chip'); if (!b) return;
      draft.cat = b.dataset.id; $('.l-cats', el).innerHTML = catChips();
    };
    $('.l-per', el).onclick = (ev) => {
      const b = ev.target.closest('[data-p]'); if (!b) return;
      draft.period = b.dataset.p; $('.l-per', el).innerHTML = perSeg();
    };
    $('.l-save', el).onclick = () => {
      draft.amount = parseAmount($('.l-amt', el).value);
      if (!draft.amount) { shake($('.amount', el)); return; }
      if (limit) Object.assign(limit, draft); else db.limits.push(draft);
      persist(); close(); renderLimits();
      toast(limit ? 'Limit updated' : 'Limit set');
    };
    if (limit) $('.l-del', el).onclick = () => {
      db.limits = db.limits.filter((x) => x.id !== limit.id);
      persist(); close(); renderLimits(); toast('Limit removed');
    };
  });
}

$('#add-limit').addEventListener('click', () => openLimitSheet(null));
$('#limits').addEventListener('click', (ev) => {
  const b = ev.target.closest('.limit');
  if (b) openLimitSheet(db.limits.find((l) => l.id === b.dataset.id));
});

/* =========================================================
   SETUP
   ========================================================= */
let installPrompt = null;
window.addEventListener('beforeinstallprompt', (ev) => { ev.preventDefault(); installPrompt = ev; });

function renderSetup() {
  const s = db.settings;
  const cats = liveCats();
  const custom = !CURRENCIES.includes(s.currency);
  $('#setup').innerHTML = `
    <section class="group">
      <p class="label">Currency</p>
      <div class="chips" id="cur">
        ${CURRENCIES.map((c) => `<button class="chip ${s.currency === c ? 'on' : ''}" data-c="${esc(c)}">${esc(c)}</button>`).join('')}
        <button class="chip ${custom ? 'on' : ''}" data-c="?">${custom ? esc(s.currency) : 'Other'}</button>
      </div>
    </section>

    <section class="group">
      <p class="label">Week starts on</p>
      <div class="seg" id="wk">
        ${[6, 0, 1].map((d) => `<button class="${s.weekStart === d ? 'on' : ''}" data-d="${d}">${WEEKDAYS[d].slice(0, 3)}</button>`).join('')}
      </div>
    </section>

    <section class="group">
      <p class="label">Categories</p>
      <div class="list" id="cat-list">
        ${cats.map((c) => `<button class="item" data-id="${c.id}" style="--c:${c.color}"><span class="dot"></span><span class="grow">${esc(c.name)}</span><span class="dim">Edit</span></button>`).join('')}
        <button class="item" data-id="+"><span class="grow">+ New category</span></button>
      </div>
    </section>

    <section class="group">
      <p class="label">Your data</p>
      <div class="list">
        <button class="item" id="exp-csv"><span class="grow">Download spreadsheet</span><span class="dim">.csv</span></button>
        <button class="item" id="exp-json"><span class="grow">Back up</span><span class="dim">.json</span></button>
        <button class="item" id="imp-json"><span class="grow">Restore from backup</span></button>
        <button class="item danger" id="wipe"><span class="grow">Erase everything</span></button>
      </div>
      <p class="note">Everything stays on this phone — nothing is uploaded. Back up now and then so you never lose it.</p>
      <input type="file" id="imp-file" accept="application/json,.json" hidden>
    </section>

    ${isStandalone() ? '' : `
    <section class="group">
      <p class="label">Install</p>
      ${installPrompt ? '<button class="btn" id="install" style="margin-top:0">Install Spent</button>' : ''}
      <p class="note">${isIOS
        ? 'iPhone: open this page in <b>Safari</b>, tap <b>Share</b>, then <b>Add to Home Screen</b>.'
        : 'Android: open the browser menu <b>⋮</b> and tap <b>Install app</b> or <b>Add to Home screen</b>.'}</p>
    </section>`}

    <p class="foot">Spent ${VERSION}</p>
  `;

  $('#cur').onclick = (ev) => {
    const b = ev.target.closest('[data-c]'); if (!b) return;
    let c = b.dataset.c;
    if (c === '?') {
      c = (prompt('Currency symbol or code', custom ? s.currency : '') || '').trim().slice(0, 4);
      if (!c) return;
    }
    s.currency = c; persist(); refresh();
  };
  $('#wk').onclick = (ev) => {
    const b = ev.target.closest('[data-d]'); if (!b) return;
    s.weekStart = +b.dataset.d; persist(); refresh();
  };
  $('#cat-list').onclick = (ev) => {
    const b = ev.target.closest('.item'); if (!b) return;
    openCatSheet(b.dataset.id === '+' ? null : db.cats.find((c) => c.id === b.dataset.id));
  };
  $('#exp-csv').onclick = exportCSV;
  $('#exp-json').onclick = exportJSON;
  $('#imp-json').onclick = () => $('#imp-file').click();
  $('#imp-file').onchange = importJSON;
  $('#wipe').onclick = () => {
    if (!confirm('Erase all spending, categories and limits? This cannot be undone.')) return;
    db = fresh(); persist(); add.cat = null; refresh(); toast('Fresh start');
  };
  const inst = $('#install');
  if (inst) inst.onclick = async () => { installPrompt.prompt(); await installPrompt.userChoice.catch(() => {}); installPrompt = null; renderSetup(); };
}

function openCatSheet(cat, onCreate) {
  const draft = cat ? { ...cat } : { id: uid(), name: '', color: PALETTE[db.cats.length % PALETTE.length] };
  const sw = () => PALETTE.map((p) => `<button class="swatch ${draft.color === p ? 'on' : ''}" data-c="${p}" style="--c:${p}" aria-label="Color ${p}"></button>`).join('');
  openSheet(`
    <h2 class="c-name" style="color:${draft.color}">${cat ? esc(cat.name) : 'New category'}</h2>
    <input class="field k-name" type="text" placeholder="Name" maxlength="24" value="${esc(draft.name)}" aria-label="Category name">
    <p class="label">Color</p>
    <div class="swatches k-sw">${sw()}</div>
    <button class="btn k-save">${cat ? 'Save' : 'Add category'}</button>
    ${cat ? '<button class="btn ghost small danger k-del">Remove category</button><p class="note">Past spending in this category is kept.</p>' : ''}
  `, (el, close) => {
    const title = $('.c-name', el);
    $('.k-name', el).oninput = (ev) => { title.textContent = ev.target.value.trim() || (cat ? cat.name : 'New category'); };
    $('.k-sw', el).onclick = (ev) => {
      const b = ev.target.closest('.swatch'); if (!b) return;
      draft.color = b.dataset.c; title.style.color = draft.color; $('.k-sw', el).innerHTML = sw();
    };
    $('.k-save', el).onclick = () => {
      draft.name = $('.k-name', el).value.trim();
      if (!draft.name) { shake($('.k-name', el)); return; }
      if (cat) Object.assign(cat, draft); else db.cats.push(draft);
      persist(); close(); refresh();
      if (!cat && onCreate) onCreate(draft);
    };
    if (cat) $('.k-del', el).onclick = () => {
      if (!confirm(`Remove “${cat.name}”? Past spending stays in your history.`)) return;
      cat.archived = true;
      db.limits = db.limits.filter((l) => l.cat !== cat.id);
      persist(); close(); refresh(); toast(`${cat.name} removed`);
    };
  });
}

async function deliver(filename, text, type) {
  const blob = new Blob([text], { type });
  const file = new File([blob], filename, { type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return; }
    catch (err) { if (err && err.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function exportCSV() {
  const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = [['Date', 'Category', 'What', 'Amount']].concat(
    [...db.entries].sort((a, b) => a.date.localeCompare(b.date) || a.ts - b.ts)
      .map((e) => [e.date, catById(e.cat).name, e.note, e.amount]),
  );
  deliver(`spent-${today()}.csv`, rows.map((r) => r.map(q).join(',')).join('\n'), 'text/csv');
}
function exportJSON() {
  deliver(`spent-backup-${today()}.json`, JSON.stringify(db, null, 2), 'application/json');
}
function importJSON(ev) {
  const f = ev.target.files[0];
  ev.target.value = '';
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!d || !Array.isArray(d.entries)) throw new Error('bad');
      if (!confirm(`Restore ${d.entries.length} entries? This replaces what’s on this phone now.`)) return;
      db = normalize(d); persist(); add.cat = null; refresh(); toast('Restored');
    } catch (_) { toast('That file isn’t a Spent backup'); }
  };
  r.readAsText(f);
}

/* =========================================================
   Navigation
   ========================================================= */
const RENDER = { add: renderAdd, view: renderView, limits: renderLimits, setup: renderSetup };
let tab = 'add';

function go(t) {
  tab = t;
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === `v-${t}`));
  $$('.nav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
  window.scrollTo(0, 0);
  RENDER[t]();
}
function refresh() { RENDER[tab](); }

$('.nav').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-tab]');
  if (b && b.dataset.tab !== tab) go(b.dataset.tab);
});

// When the app comes back after midnight, "Today" should mean today.
let lastDay = today();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (today() !== lastDay) {
    if (add.date === lastDay) add.date = today();
    lastDay = today();
  }
  refresh();
});
// Keep multiple open tabs in sync.
window.addEventListener('storage', (ev) => { if (ev.key === KEY) { db = load(); refresh(); } });

go('add');

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
