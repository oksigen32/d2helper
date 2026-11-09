'use strict';
/* ============================================================
   D2Helper — личный дневник игрока Dota 2
   Данные меты и билдов: OpenDota API (бесплатно, без ключа)
   Личные данные: localStorage браузера (+ экспорт/импорт JSON)
   ============================================================ */

const API = 'https://api.opendota.com/api';
const CDN = 'https://cdn.cloudflare.steamstatic.com';
const KEY = 'd2helper_db_v1';
const VERSION = '1.3.0';

const BRACKETS = [
  { v: '1', n: 'Рекрут' }, { v: '2', n: 'Страж' }, { v: '3', n: 'Рыцарь' }, { v: '4', n: 'Герой' },
  // OpenDota не отдаёт статистику по рангу Титан (bracket 8 всегда пустой) — объединяем с Божеством
  { v: '5', n: 'Легенда' }, { v: '6', n: 'Властелин' }, { v: '7', n: 'Божество / Титан' },
  { v: 'pro', n: 'Про-сцена' },
];
const ROLES = { Carry: 'Керри', Support: 'Саппорт', Nuker: 'Нюкер', Disabler: 'Контроль', Initiator: 'Инициатор', Durable: 'Танк', Escape: 'Мобильность', Pusher: 'Пушер', Jungler: 'Лесник' };
const ATTRS = { str: 'Сила', agi: 'Ловкость', int: 'Интеллект', all: 'Универсал' };
const POS = ['Pos 1 — Керри', 'Pos 2 — Мид', 'Pos 3 — Хардлейн', 'Pos 4 — Роумер', 'Pos 5 — Саппорт'];
const TRAIN_TYPES = {
  lasthit: { n: 'Ласт-хит / добивания', e: '🗡️', c: '#e4432f' },
  lane: { n: 'Лайнинг', e: '🛤️', c: '#e0ad52' },
  mechanics: { n: 'Механика / микро', e: '⚡', c: '#4ea6ff' },
  replay: { n: 'Разбор реплея', e: '🎬', c: '#a77dff' },
  pro: { n: 'Просмотр про-игр', e: '👁️', c: '#3fd0c9' },
  hero: { n: 'Практика героя', e: '🦸', c: '#4cc27a' },
  turbo: { n: 'Турбо / анранк', e: '🎮', c: '#ff8a5c' },
  theory: { n: 'Теория / гайды', e: '📚', c: '#9aa3b8' },
};
const NOTE_CATS = {
  insight: { n: 'Инсайт', c: '#e0ad52' }, mistake: { n: 'Ошибка', c: '#e4432f' }, lane: { n: 'Лайнинг', c: '#4cc27a' },
  draft: { n: 'Драфт', c: '#4ea6ff' }, matchup: { n: 'Матчап', c: '#a77dff' }, other: { n: 'Другое', c: '#8c93a6' },
};
const TIPS = [
  'Смотри на миникарту каждые 3–5 секунд — это бесплатная информация.',
  'Проигрыш — это реплей, который стоит разобрать, а не забыть.',
  'Не тильтуй: после 2 поражений подряд сделай перерыв.',
  'Сначала научись не умирать — потом научись убивать.',
  'Покупай варды, даже если ты керри. Особенно если ты керри.',
  'Один фокус на игру: сегодня — только ласт-хиты, завтра — позиционка.',
  'Тайминг важнее предмета: Блинк на 12-й минуте лучше, чем на 20-й.',
];

/* ---------- utils ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const dstr = d => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 6e4); return z.toISOString().slice(0, 10); };
const today = () => dstr(new Date());
const addDays = (s, n) => { const d = new Date(s + 'T12:00'); d.setDate(d.getDate() + n); return dstr(d); };
const fmtDate = s => new Date(s + 'T12:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
const fmtDateLong = s => new Date(s + 'T12:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
const pct = (v, d = 1) => (isFinite(v) ? v.toFixed(d) : '0') + '%';
const sign = v => (v > 0 ? '+' : '') + v;
const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c; };

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = msg;
  $('#toasts').append(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = '.3s'; setTimeout(() => el.remove(), 300); }, 2800);
}

const ICONS = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  meta: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  builds: '<path d="M14.5 4.5l5 5L9 20H4v-5zM12 7l5 5"/>',
  train: '<path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12"/>',
  mmr: '<path d="M3 17l5-5 4 4 8-9M15 7h5v5"/>',
  notes: '<path d="M5 3h10l4 4v14H5zM15 3v4h4M8 12h8M8 16h6"/>',
  goals: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/>',
  pin: '<path d="M9 4h6l-1 6 4 4H6l4-4zM12 14v7"/>',
  fire: '<path d="M12 3s5 4.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 1.5-4s.5 2.5 2.5 2.5C11 8 12 3 12 3z"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 13v4M8 21h8M9 17h6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
};
const ic = (n, cls = 'ic') => `<svg viewBox="0 0 24 24" class="${cls}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[n]}</svg>`;

/* ---------- storage ---------- */
const defaults = () => ({
  startMmr: 3000, bracket: '5', nick: '',
  mmr: [], trainings: [], notes: [], builds: {}, goals: [],
  routine: ['Ласт-хит в демо-режиме — 10 минут', 'Разобрать один свой реплей', 'Посмотреть игру про на своём герое', 'Записать 1 вывод в наблюдения'],
  checks: {},
});
let db;
try { db = Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { db = defaults(); }
if (db.bracket === '8') db.bracket = '7';
function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { toast('Не удалось сохранить данные'); } }
function cacheGet(k, maxAge) { try { const o = JSON.parse(localStorage.getItem(k)); if (o && Date.now() - o.t < maxAge) return o; } catch { } return null; }
function cacheSet(k, data) { try { localStorage.setItem(k, JSON.stringify({ t: Date.now(), data })); } catch { } }

/* ---------- OpenDota data ---------- */
let HEROES = null, HERO = {}, HERO_BY_NAME = {}, META_T = 0, ITEMS = null;
let heroesPromise = null;

function setHeroes(list, t) {
  HEROES = list.slice().sort((a, b) => a.localized_name.localeCompare(b.localized_name));
  HERO = {}; HERO_BY_NAME = {};
  HEROES.forEach(h => { HERO[h.id] = h; HERO_BY_NAME[h.localized_name.toLowerCase()] = h; });
  META_T = t;
  $('#heroList').innerHTML = HEROES.map(h => `<option value="${esc(h.localized_name)}">`).join('');
  const st = $('#metaStatus');
  st.className = 'meta-status ok';
  $('.txt', st).textContent = 'Мета: ' + new Date(t).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function loadHeroes(force = false) {
  if (!force && HEROES) return Promise.resolve(true);
  if (!force) { const c = cacheGet('d2h_heroes', 6 * 36e5); if (c) { setHeroes(c.data, c.t); return Promise.resolve(true); } }
  if (heroesPromise) return heroesPromise;
  const st = $('#metaStatus'); st.className = 'meta-status load'; $('.txt', st).textContent = 'Загружаю мету…';
  heroesPromise = fetch(API + '/heroStats')
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(d => { cacheSet('d2h_heroes', d); setHeroes(d, Date.now()); if (force) toast('Мета обновлена ✓'); return true; })
    .catch(() => {
      const c = cacheGet('d2h_heroes', Infinity);
      if (c) { setHeroes(c.data, c.t); toast('Нет связи с OpenDota — показаны сохранённые данные'); return true; }
      st.className = 'meta-status'; $('.txt', st).textContent = 'Нет связи с OpenDota';
      return false;
    })
    .finally(() => { heroesPromise = null; });
  return heroesPromise;
}

let ITEM_BY_KEY = {};
async function loadItems() {
  if (ITEMS) return ITEMS;
  const c = cacheGet('d2h_items2', 7 * 864e5);
  if (c) ITEMS = c.data;
  else {
    const r = await fetch(API + '/constants/items');
    const d = await r.json();
    const map = {};
    Object.entries(d).forEach(([key, it]) => { if (it && it.id != null) map[it.id] = { key, n: it.dname || key, img: it.img, cost: it.cost || 0, tier: it.tier || 0 }; });
    cacheSet('d2h_items2', map);
    ITEMS = map;
  }
  ITEM_BY_KEY = {};
  Object.values(ITEMS).forEach(it => { ITEM_BY_KEY[it.key] = it; });
  return ITEMS;
}

/* Способности и таланты героя (OpenDota constants) */
// В OpenDota у части талантов нет чисел ("+{s:value} Radius") — показываем направление стрелкой
function cleanTalent(d) {
  if (!/\{s:/.test(d)) return d;
  const neg = /^\s*-/.test(d);
  const rest = d.replace(/\{s:[^}]+\}[%sx]?/g, '').replace(/^[\s+\-x\/%]+/, '').replace(/\s{2,}/g, ' ').trim();
  return (neg ? '↓ ' : '↑ ') + rest;
}
let ABIL_SRC = null;
async function loadHeroAbilities(h) {
  const k = 'd2h_abil2_' + h.id;
  const c = cacheGet(k, 3 * 864e5);
  if (c) return c.data;
  if (!ABIL_SRC) {
    ABIL_SRC = Promise.all([
      fetch(API + '/constants/hero_abilities').then(r => r.json()),
      fetch(API + '/constants/abilities').then(r => r.json()),
    ]).catch(e => { ABIL_SRC = null; throw e; });
  }
  const [ha, ab] = await ABIL_SRC;
  const e = ha[h.name];
  if (!e) throw new Error('no abilities');
  const list = [];
  (e.abilities || []).forEach((n, slot) => {
    const a = ab[n];
    if (!a || !a.dname || n === 'generic_hidden') return;
    const beh = [].concat(a.behavior || []);
    if (beh.includes('Hidden') || beh.includes('Not Learnable')) return;
    list.push({ key: n, dname: a.dname, img: a.img || '', innate: !!a.is_innate, desc: String(a.desc || '').slice(0, 260), slot });
  });
  const learn = list.filter(a => !a.innate);
  const ult = learn.find(a => a.slot === 5) || learn[learn.length - 1];
  learn.forEach(a => { a.ult = a === ult; });
  const talents = (e.talents || []).map(t => ({
    key: t.name, tier: t.level,
    dname: cleanTalent(String(ab[t.name]?.dname || t.name)),
  }));
  const data = { abilities: learn, innate: list.filter(a => a.innate), talents };
  cacheSet(k, data);
  return data;
}

async function loadItemPop(id) {
  const k = 'd2h_pop_' + id;
  const c = cacheGet(k, 12 * 36e5);
  if (c) return c.data;
  const r = await fetch(`${API}/heroes/${id}/itemPopularity`);
  if (!r.ok) throw new Error(r.status);
  const d = await r.json();
  cacheSet(k, d);
  return d;
}

const heroImg = h => CDN + h.img;
const heroByName = n => HERO_BY_NAME[String(n || '').trim().toLowerCase()];
const heroImgByName = n => { const h = heroByName(n); return h ? heroImg(h) : ''; };

function bracketStats(b) {
  const k = b === 'pro' ? 20 : 300;
  const rows = HEROES.map(h => {
    const picks = (b === 'pro' ? h.pro_pick : h[b + '_pick']) || 0;
    const wins = (b === 'pro' ? h.pro_win : h[b + '_win']) || 0;
    return { h, picks, wins, ban: h.pro_ban || 0 };
  });
  const matches = rows.reduce((a, r) => a + r.picks, 0) / 10 || 1;
  rows.forEach(r => {
    r.wr = r.picks ? r.wins / r.picks * 100 : 0;
    r.pr = r.picks / matches * 100;
    r.br = r.ban / matches * 100;
    const adj = (r.wins + 0.5 * k) / (r.picks + k) * 100;
    r.score = (adj - 50) + (Math.min(r.pr, 30) - 8) * 0.07 + (b === 'pro' ? r.br * 0.02 : 0);
    r.tier = r.score >= 2.6 ? 'S' : r.score >= 1 ? 'A' : r.score >= -0.6 ? 'B' : r.score >= -2.2 ? 'C' : 'D';
  });
  return rows;
}

/* ---------- MMR helpers ---------- */
function mmrSeries() {
  const list = db.mmr.slice().sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  let cur = +db.startMmr || 0;
  return list.map(e => { cur += e.result === 'W' ? Math.abs(+e.delta) : -Math.abs(+e.delta); return { ...e, after: cur }; });
}
function mmrStats() {
  const s = mmrSeries();
  const cur = s.length ? s[s.length - 1].after : +db.startMmr;
  const peak = Math.max(+db.startMmr, ...s.map(e => e.after));
  const weekAgo = addDays(today(), -7);
  const week = s.filter(e => e.date > weekAgo).reduce((a, e) => a + (e.result === 'W' ? 1 : -1) * Math.abs(+e.delta), 0);
  const wins = s.filter(e => e.result === 'W').length;
  let streak = 0, st = null;
  for (let i = s.length - 1; i >= 0; i--) { if (st === null) st = s[i].result; if (s[i].result === st) streak++; else break; }
  return { s, cur, peak, week, wins, games: s.length, wr: s.length ? wins / s.length * 100 : 0, streak, streakType: st };
}

/* ---------- training helpers ---------- */
function activeDays() {
  const set = new Set(db.trainings.map(t => t.date));
  Object.entries(db.checks).forEach(([d, arr]) => { if (arr && arr.length) set.add(d); });
  return set;
}
function trainStreak() {
  const set = activeDays();
  let d = today(), n = 0;
  if (!set.has(d)) d = addDays(d, -1);
  while (set.has(d)) { n++; d = addDays(d, -1); }
  return n;
}
function minutesByDay() {
  const m = {};
  db.trainings.forEach(t => { m[t.date] = (m[t.date] || 0) + (+t.minutes || 0); });
  Object.entries(db.checks).forEach(([d, arr]) => { if (arr && arr.length) m[d] = (m[d] || 0) + arr.length * 10; });
  return m;
}

/* ---------- modal / forms ---------- */
function fieldHtml(f) {
  const v = f.value ?? '';
  const req = f.required ? 'required' : '';
  let input;
  if (f.type === 'textarea') input = `<textarea class="input" name="${f.name}" rows="${f.rows || 4}" placeholder="${esc(f.ph || '')}" ${req}>${esc(v)}</textarea>`;
  else if (f.type === 'select') input = `<select class="input" name="${f.name}">${f.options.map(([val, lab]) => `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(lab)}</option>`).join('')}</select>`;
  else if (f.type === 'stars') input = `<div class="star-input">${[5, 4, 3, 2, 1].map(n => `<input type="radio" id="st${n}" name="${f.name}" value="${n}" ${+v === n ? 'checked' : ''}><label for="st${n}">★</label>`).join('')}</div>`;
  else if (f.type === 'hero') input = `<input class="input" name="${f.name}" list="heroList" value="${esc(v)}" placeholder="${esc(f.ph || 'Начни вводить имя героя')}" autocomplete="off" ${req}>`;
  else input = `<input class="input" type="${f.type || 'text'}" name="${f.name}" value="${esc(v)}" placeholder="${esc(f.ph || '')}" ${f.min != null ? `min="${f.min}"` : ''} ${req}>`;
  return `<div class="field ${f.full ? 'full' : ''}"><label>${esc(f.label)}</label>${input}</div>`;
}
function openModal(title, fields, onSubmit, submitText = 'Сохранить') {
  $('#modalTitle').textContent = title;
  $('.modal').classList.remove('wide');
  modalOnClose = null;
  const form = $('#modalForm');
  form.innerHTML = `<div class="form-grid">${fields.map(fieldHtml).join('')}</div>
    <div class="modal-foot"><button type="button" class="btn btn-ghost" data-close>Отмена</button><button class="btn btn-primary">${esc(submitText)}</button></div>`;
  form.onsubmit = e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    if (onSubmit(data) !== false) closeModal();
  };
  $('#modal').hidden = false;
  setTimeout(() => { const first = $('input:not([type=radio]),textarea,select', form); first && first.focus(); }, 30);
}
let modalOnClose = null;
function closeModal() {
  $('#modal').hidden = true;
  const f = modalOnClose; modalOnClose = null; f && f();
}
// Своё окно подтверждения (стандартный confirm() блокируется в режиме приложения)
function askConfirm(text, yes = 'Удалить') {
  return new Promise(resolve => {
    let done = false;
    const finish = v => { if (!done) { done = true; resolve(v); } };
    $('#modalTitle').textContent = 'Подтверждение';
    $('.modal').classList.remove('wide');
    const form = $('#modalForm');
    form.innerHTML = `<p style="margin:0;font-size:15px">${esc(text)}</p>
      <div class="modal-foot"><button type="button" class="btn btn-ghost" data-close>Отмена</button><button class="btn btn-primary" id="cfYes">${esc(yes)}</button></div>`;
    form.onsubmit = e => { e.preventDefault(); finish(true); closeModal(); };
    modalOnClose = () => finish(false);
    $('#modal').hidden = false;
    setTimeout(() => $('#cfYes')?.focus(), 30);
  });
}
document.addEventListener('click', e => { if (e.target.closest('[data-close]') || e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

/* ---------- canvas line chart ---------- */
function drawLine(cv, vals, labels) {
  if (!cv) return;
  const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
  cv.width = w * dpr; cv.height = h * dpr;
  const c = cv.getContext('2d'); c.scale(dpr, dpr);
  c.font = '11px Inter, sans-serif';
  if (vals.length < 2) {
    c.fillStyle = '#5e6578'; c.textAlign = 'center';
    c.font = '13px Inter, sans-serif';
    c.fillText('Добавь хотя бы 2 игры, чтобы увидеть график', w / 2, h / 2);
    return;
  }
  const pad = { l: 46, r: 14, t: 14, b: 24 };
  let min = Math.min(...vals), max = Math.max(...vals);
  const span = Math.max(max - min, 50); min -= span * 0.12; max += span * 0.12;
  const X = i => pad.l + i / (vals.length - 1) * (w - pad.l - pad.r);
  const Y = v => pad.t + (1 - (v - min) / (max - min)) * (h - pad.t - pad.b);
  // grid
  c.strokeStyle = 'rgba(255,255,255,.06)'; c.fillStyle = '#5e6578'; c.textAlign = 'right'; c.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const v = min + (max - min) * i / 4, y = Y(v);
    c.beginPath(); c.moveTo(pad.l, y); c.lineTo(w - pad.r, y); c.stroke();
    c.fillText(Math.round(v), pad.l - 8, y + 4);
  }
  // x labels
  c.textAlign = 'center';
  const step = Math.ceil(vals.length / Math.max(2, Math.floor((w - 60) / 70)));
  labels.forEach((l, i) => { if (i % step === 0 || i === vals.length - 1) c.fillText(l, X(i), h - 6); });
  // area
  const g = c.createLinearGradient(0, pad.t, 0, h - pad.b);
  g.addColorStop(0, 'rgba(228,67,47,.35)'); g.addColorStop(1, 'rgba(228,67,47,0)');
  c.beginPath(); vals.forEach((v, i) => i ? c.lineTo(X(i), Y(v)) : c.moveTo(X(i), Y(v)));
  c.lineTo(X(vals.length - 1), h - pad.b); c.lineTo(X(0), h - pad.b); c.closePath(); c.fillStyle = g; c.fill();
  // line
  const lg = c.createLinearGradient(pad.l, 0, w - pad.r, 0);
  lg.addColorStop(0, '#e4432f'); lg.addColorStop(1, '#e0ad52');
  c.beginPath(); vals.forEach((v, i) => i ? c.lineTo(X(i), Y(v)) : c.moveTo(X(i), Y(v)));
  c.strokeStyle = lg; c.lineWidth = 2.5; c.lineJoin = 'round'; c.stroke();
  // last point
  const lx = X(vals.length - 1), ly = Y(vals[vals.length - 1]);
  c.beginPath(); c.arc(lx, ly, 7, 0, 7); c.fillStyle = 'rgba(224,173,82,.25)'; c.fill();
  c.beginPath(); c.arc(lx, ly, 4, 0, 7); c.fillStyle = '#e0ad52'; c.fill();
}

/* ---------- router ---------- */
const VIEWS = {
  dashboard: { t: 'Главная', icon: 'home', group: 'Обзор', render: renderDashboard },
  meta: { t: 'Мета', icon: 'meta', group: 'Обзор', render: renderMeta, crumb: 'Актуальный патч · OpenDota' },
  builds: { t: 'Билды героев', icon: 'builds', group: 'Обзор', render: renderBuilds },
  mmr: { t: 'ПТС / MMR', icon: 'mmr', group: 'Дневник', render: renderMmr, badge: () => db.mmr.length },
  training: { t: 'Тренировки', icon: 'train', group: 'Дневник', render: renderTraining, badge: () => db.trainings.length },
  notes: { t: 'Наблюдения', icon: 'notes', group: 'Дневник', render: renderNotes, badge: () => db.notes.length },
  goals: { t: 'Цели', icon: 'goals', group: 'Дневник', render: renderGoals, badge: () => db.goals.filter(g => !g.done).length },
  settings: { t: 'Настройки', icon: 'settings', group: 'Система', render: renderSettings },
};
function renderNav(active) {
  let html = '', grp = '';
  Object.entries(VIEWS).forEach(([k, v]) => {
    if (v.group !== grp) { grp = v.group; html += `<div class="nav-group">${grp}</div>`; }
    const b = v.badge ? v.badge() : 0;
    html += `<a href="#/${k}" class="${k === active ? 'active' : ''}">${ic(v.icon)}<span>${v.t}</span>${b ? `<em class="badge">${b}</em>` : ''}</a>`;
  });
  $('#nav').innerHTML = html;
}
let CURRENT = null;
function route() {
  const parts = (location.hash.replace(/^#\/?/, '') || 'dashboard').split('/');
  const name = parts[0], param = parts.slice(1);
  const v = VIEWS[name] ? name : 'dashboard';
  CURRENT = { name: v, param };
  renderNav(v);
  $('#pageTitle').textContent = VIEWS[v].t;
  $('#crumb').textContent = VIEWS[v].crumb || 'D2Helper · ' + VIEWS[v].group;
  $('#topActions').innerHTML = '';
  const view = $('#view');
  view.style.animation = 'none'; void view.offsetWidth; view.style.animation = '';
  VIEWS[v].render(view, param);
  window.scrollTo(0, 0);
}
function rerender() { if (CURRENT) { renderNav(CURRENT.name); VIEWS[CURRENT.name].render($('#view'), CURRENT.param); } }
window.addEventListener('hashchange', route);
let rsz; window.addEventListener('resize', () => { clearTimeout(rsz); rsz = setTimeout(() => { $$('canvas[data-chart]').forEach(cv => cv._draw && cv._draw()); }, 150); });

function setActions(html) { $('#topActions').innerHTML = html; }
function loadingView(el, text = 'Загружаю данные OpenDota…') { el.innerHTML = `<div class="spinner"></div><p class="muted" style="text-align:center">${text}</p>`; }
function offlineView(el, retry) {
  el.innerHTML = `<div class="card empty"><div class="big">📡</div><h3>Не удалось загрузить данные OpenDota</h3><p>Проверь подключение к интернету и попробуй снова.</p><button class="btn btn-primary" id="retry">Повторить</button></div>`;
  $('#retry').onclick = retry;
}
async function withHeroes(el, fn) {
  if (HEROES) return fn();
  loadingView(el);
  const ok = await loadHeroes();
  if (CURRENT && el === $('#view')) ok ? fn() : offlineView(el, () => withHeroes(el, fn));
}

/* ============================================================
   ГЛАВНАЯ
   ============================================================ */
function renderDashboard(el) {
  const m = mmrStats();
  const streak = trainStreak();
  const weekAgo = addDays(today(), -7);
  const weekMin = db.trainings.filter(t => t.date > weekAgo).reduce((a, t) => a + (+t.minutes || 0), 0);
  const hr = new Date().getHours();
  const hello = hr < 6 ? 'Доброй ночи' : hr < 12 ? 'Доброе утро' : hr < 18 ? 'Добрый день' : 'Добрый вечер';
  const checks = db.checks[today()] || [];
  const goalsOpen = db.goals.filter(g => !g.done);
  const notes = db.notes.slice().sort((a, b) => (b.pinned - a.pinned) || b.date.localeCompare(a.date)).slice(0, 3);
  const bName = BRACKETS.find(b => b.v === db.bracket)?.n;

  setActions(`<a class="btn btn-ghost" href="#/notes">${ic('notes')}Запись</a><button class="btn btn-primary" id="dAddGame">${ic('plus')}Записать игру</button>`);

  el.innerHTML = `
  <div class="stack">
    <div class="hello">
      <svg class="hello-art" viewBox="0 0 32 32"><path d="M4 4h8l16 16v8h-8L4 12z" fill="currentColor"/><path d="M28 4v8l-6 6-8-8 6-6z" fill="currentColor"/><path d="M4 28v-8l6-6 8 8-6 6z" fill="currentColor"/></svg>
      <h2>${hello}${db.nick ? ', ' + esc(db.nick) : ''}!</h2>
      <p>${fmtDateLong(today()).replace(/\s?г\.$/, '')}. ${checks.length >= db.routine.length && db.routine.length ? 'Дневная рутина выполнена — так держать 🔥' : `Сегодня в рутине: ${checks.length} из ${db.routine.length}. Небольшой шаг каждый день — и ПТС растёт.`}</p>    </div>

    <div class="grid g4">
      <div class="card kpi" style="--accent:var(--gold)"><div class="lbl">${ic('trophy')}Текущий ПТС</div><div class="val">${m.cur}</div><div class="hint">Пик: ${m.peak}</div></div>
      <div class="card kpi" style="--accent:${m.week >= 0 ? 'var(--green)' : 'var(--red)'}"><div class="lbl">${ic('mmr')}За 7 дней</div><div class="val ${m.week >= 0 ? 'pos' : 'neg'}">${sign(m.week)}</div><div class="hint">${m.games} ${plural(m.games, 'игра', 'игры', 'игр')} всего · WR ${pct(m.wr, 0)}</div></div>
      <div class="card kpi" style="--accent:var(--red)"><div class="lbl">${ic('fire')}Серия тренировок</div><div class="val">${streak} <small style="font-size:16px;color:var(--muted)">${plural(streak, 'день', 'дня', 'дней')}</small></div><div class="hint">${streak ? 'Не прерывай серию!' : 'Начни сегодня'}</div></div>
      <div class="card kpi" style="--accent:var(--blue)"><div class="lbl">${ic('clock')}Тренировки / неделя</div><div class="val">${Math.floor(weekMin / 60)}<small style="font-size:16px;color:var(--muted)">ч</small> ${weekMin % 60}<small style="font-size:16px;color:var(--muted)">м</small></div><div class="hint">${db.trainings.filter(t => t.date > weekAgo).length} сессий</div></div>
    </div>

    <div class="grid g-main">
      <div class="stack">
        <div class="card">
          <div class="card-head"><div><h3>Динамика ПТС</h3><div class="sub">Последние 30 игр</div></div><a class="btn btn-ghost btn-sm" href="#/mmr">Все игры</a></div>
          <canvas class="chart sm" id="dChart" data-chart></canvas>
        </div>
        <div class="card">
          <div class="card-head"><div><h3>Топ меты · ${esc(bName)}</h3><div class="sub">Лучшие герои по винрейту и пикрейту</div></div><a class="btn btn-ghost btn-sm" href="#/meta">Вся мета</a></div>
          <div id="dMeta"><div class="spinner" style="margin:20px auto"></div></div>
        </div>
      </div>
      <div class="stack">
        <div class="card">
          <div class="card-head"><h3>Рутина на сегодня</h3><span class="sub">${checks.length}/${db.routine.length}</span></div>
          <div class="progress" style="margin-bottom:14px"><i style="width:${db.routine.length ? checks.length / db.routine.length * 100 : 0}%"></i></div>
          <div class="list" id="dRoutine">${routineHtml()}</div>
        </div>
        <div class="card">
          <div class="card-head"><h3>Цели</h3><a class="btn btn-ghost btn-sm" href="#/goals">Все</a></div>
          <div class="list">${goalsOpen.slice(0, 4).map(g => `<div class="goal" data-gid="${g.id}"><span class="box" data-toggle-goal></span><span class="t">${esc(g.text)}</span></div>`).join('') || '<div class="muted">Поставь цель — например «Апнуть 4000 ПТС» или «Освоить Puck».</div>'}</div>
        </div>
        <div class="card">
          <div class="card-head"><h3>Последние наблюдения</h3><a class="btn btn-ghost btn-sm" href="#/notes">Все</a></div>
          <div class="list">${notes.map(n => {
            const c = NOTE_CATS[n.cat] || NOTE_CATS.other;
            return `<a href="#/notes" class="session" style="border-left:3px solid ${c.c}"><div class="body"><span class="cat" style="--c:${c.c}">${c.n}</span><br><b>${esc(n.title)}</b><div class="meta">${fmtDate(n.date)}${n.hero ? ' · ' + esc(n.hero) : ''}</div></div></a>`;
          }).join('') || '<div class="muted">Пока пусто. Записывай выводы после каждой игры.</div>'}</div>
        </div>
      </div>
    </div>
  </div>`;

  const cv = $('#dChart'); const s30 = m.s.slice(-30);
  cv._draw = () => drawLine(cv, [+db.startMmr, ...s30.map(e => e.after)].slice(-31), ['', ...s30.map(e => fmtDate(e.date))].slice(-31));
  if (s30.length >= 30) cv._draw = () => drawLine(cv, s30.map(e => e.after), s30.map(e => fmtDate(e.date)));
  requestAnimationFrame(cv._draw);

  bindRoutine(el);
  $$('[data-toggle-goal]', el).forEach(b => b.onclick = () => { const g = db.goals.find(x => x.id === b.closest('[data-gid]').dataset.gid); g.done = true; g.doneAt = today(); save(); toast('Цель выполнена 🏆'); rerender(); });
  $('#dAddGame').onclick = () => openGameModal();

  loadHeroes().then(ok => {
    const box = $('#dMeta'); if (!box) return;
    if (!ok) { box.innerHTML = '<div class="muted">Нет связи с OpenDota.</div>'; return; }
    const rows = bracketStats(db.bracket).filter(r => r.pr >= 1).sort((a, b) => b.score - a.score).slice(0, 6);
    box.innerHTML = `<table class="table"><tbody>${rows.map(r => `
      <tr style="cursor:pointer" onclick="location.hash='#/builds/${r.h.id}'">
        <td><div class="hcell"><img src="${heroImg(r.h)}" alt="">${esc(r.h.localized_name)}</div></td>
        <td class="hide-m muted">${r.h.roles.slice(0, 2).map(x => ROLES[x] || x).join(', ')}</td>
        <td><b class="${r.wr >= 50 ? 'pos' : 'neg'}">${pct(r.wr)}</b></td>
        <td><span class="tbadge t-${r.tier}">${r.tier}</span></td>
      </tr>`).join('')}</tbody></table>`;
  });
}

function routineHtml() {
  const checks = db.checks[today()] || [];
  if (!db.routine.length) return '<div class="muted">Добавь пункты рутины во вкладке «Тренировки».</div>';
  return db.routine.map((r, i) => `<div class="check ${checks.includes(i) ? 'done' : ''}" data-ri="${i}"><span class="box"></span><span class="t">${esc(r)}</span></div>`).join('');
}
function bindRoutine(el) {
  $$('[data-ri]', el).forEach(c => c.onclick = () => {
    const i = +c.dataset.ri, d = today();
    const arr = db.checks[d] = db.checks[d] || [];
    const k = arr.indexOf(i);
    k >= 0 ? arr.splice(k, 1) : arr.push(i);
    if (arr.length === db.routine.length && k < 0) toast('Рутина дня выполнена! 🔥');
    save(); rerender();
  });
}

/* ============================================================
   МЕТА
   ============================================================ */
const metaUI = { role: '', attr: '', q: '', sort: 'score', dir: -1, mode: 'tiers', minPr: true, pos: 0 };
function renderMeta(el) {
  setActions(`<div class="seg" id="mMode"><button data-m="tiers" class="${metaUI.mode === 'tiers' ? 'on' : ''}">Тир-лист</button><button data-m="table" class="${metaUI.mode === 'table' ? 'on' : ''}">Таблица</button></div>`);
  $$('#mMode button').forEach(b => b.onclick = () => { metaUI.mode = b.dataset.m; renderMeta(el); });
  withHeroes(el, () => {
    el.innerHTML = `
      <div class="stack">
        <div class="card">
          <div class="row" style="margin-bottom:14px">
            <div class="chips" id="mBr">${BRACKETS.map(b => `<button class="chip ${db.bracket === b.v ? 'on' : ''}" data-b="${b.v}">${b.n}</button>`).join('')}</div>
          </div>
          <div class="row">
            <label class="search">${ic('search')}<input class="input" id="mQ" placeholder="Поиск героя…" value="${esc(metaUI.q)}"></label>
            <select class="input" id="mPos" style="width:auto" title="Позиции определяются по про-матчам за 60 дней"><option value="0">Все позиции</option>${POS.map((p, i) => `<option value="${i + 1}" ${metaUI.pos === i + 1 ? 'selected' : ''}>${p}</option>`).join('')}</select>
            <select class="input" id="mRole" style="width:auto"><option value="">Все роли</option>${Object.entries(ROLES).map(([k, v]) => `<option value="${k}" ${metaUI.role === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
            <div class="chips" id="mAttr"><button class="chip ${!metaUI.attr ? 'on' : ''}" data-a="">Все</button>${Object.entries(ATTRS).map(([k, v]) => `<button class="chip ${metaUI.attr === k ? 'on' : ''}" data-a="${k}"><span class="attr a-${k}"></span> ${v}</button>`).join('')}</div>
          </div>
        </div>
        <div class="card" id="mList"></div>
        <p class="dim" style="font-size:12px;margin:0">Источник: OpenDota (публичные матчи за последнее время). Тир считается по винрейту со сглаживанием и популярности героя. Данные обновляются автоматически раз в 6 часов или по кнопке «Обновить мету».</p>
      </div>`;
    $$('#mBr .chip').forEach(c => c.onclick = () => { db.bracket = c.dataset.b; save(); $$('#mBr .chip').forEach(x => x.classList.toggle('on', x === c)); drawMetaList(); });
    $$('#mAttr .chip').forEach(c => c.onclick = () => { metaUI.attr = c.dataset.a; $$('#mAttr .chip').forEach(x => x.classList.toggle('on', x === c)); drawMetaList(); });
    $('#mRole').onchange = e => { metaUI.role = e.target.value; drawMetaList(); };
    $('#mPos').onchange = e => { metaUI.pos = +e.target.value; drawMetaList(); };
    $('#mQ').oninput = e => { metaUI.q = e.target.value; drawMetaList(); };
    drawMetaList();
  });
}
function drawMetaList() {
  const box = $('#mList'); if (!box) return;
  let rows = bracketStats(db.bracket);
  if (!rows.some(r => r.picks > 0)) { box.innerHTML = '<div class="empty"><div class="big">📭</div>OpenDota сейчас не отдаёт статистику по этому рангу. Выбери соседний ранг.</div>'; return; }
  if (metaUI.pos && !ALLPOS) {
    box.innerHTML = '<div class="spinner"></div><p class="muted" style="text-align:center">Определяю позиции героев по про-матчам… (первый раз до 15 секунд)</p>';
    loadAllPositions().then(drawMetaList).catch(() => { ALLPOS = {}; toast('Не удалось загрузить позиции — использую роли героев'); drawMetaList(); });
    return;
  }
  if (metaUI.pos) rows = rows.filter(r => heroFitsPos(r.h, metaUI.pos));
  const q = metaUI.q.trim().toLowerCase();
  rows = rows.filter(r => (!metaUI.role || r.h.roles.includes(metaUI.role)) && (!metaUI.attr || r.h.primary_attr === metaUI.attr) && (!q || r.h.localized_name.toLowerCase().includes(q)));
  const isPro = db.bracket === 'pro';
  if (metaUI.mode === 'tiers') {
    rows.sort((a, b) => b.score - a.score);
    const tiers = ['S', 'A', 'B', 'C', 'D'];
    box.innerHTML = tiers.map(t => {
      const list = rows.filter(r => r.tier === t);
      return `<div class="tier-row"><div class="tier-label t-${t}">${t}</div><div class="tier-heroes">${list.map(r => `
        <a class="hero-chip" href="#/builds/${r.h.id}" title="${esc(r.h.localized_name)} · WR ${pct(r.wr)} · пик ${pct(r.pr)}">
          <img src="${heroImg(r.h)}" alt="" loading="lazy"><span class="wr"><b class="${r.wr >= 50 ? 'pos' : 'neg'}">${pct(r.wr)}</b><span class="muted">${pct(r.pr, 0)}</span></span>
        </a>`).join('') || '<span class="dim" style="align-self:center">—</span>'}</div></div>`;
    }).join('');
  } else {
    const key = metaUI.sort, dir = metaUI.dir;
    rows.sort((a, b) => key === 'name' ? dir * a.h.localized_name.localeCompare(b.h.localized_name) * -1 : dir * ((b[key] - a[key]) * -1));
    const maxPr = Math.max(...rows.map(r => r.pr), 1);
    const th = (k, l, cls = '') => `<th class="sortable ${cls}" data-s="${k}">${l}${metaUI.sort === k ? (metaUI.dir < 0 ? ' ↓' : ' ↑') : ''}</th>`;
    box.innerHTML = `<div style="overflow-x:auto"><table class="table"><thead><tr>
      <th>#</th>${th('name', 'Герой')}<th class="hide-m">Роли</th>${th('score', 'Тир')}${th('wr', 'Винрейт')}${th('pr', 'Пикрейт')}${isPro ? th('br', 'Банрейт', 'hide-m') : ''}${th('picks', 'Игр', 'hide-m')}
      </tr></thead><tbody>${rows.map((r, i) => `
      <tr style="cursor:pointer" onclick="location.hash='#/builds/${r.h.id}'">
        <td class="dim">${i + 1}</td>
        <td><div class="hcell"><img src="${heroImg(r.h)}" alt="" loading="lazy"><span><span class="attr a-${r.h.primary_attr}"></span> ${esc(r.h.localized_name)}</span></div></td>
        <td class="hide-m muted" style="font-size:12.5px">${r.h.roles.slice(0, 3).map(x => ROLES[x] || x).join(' · ')}</td>
        <td><span class="tbadge t-${r.tier}">${r.tier}</span></td>
        <td><b class="${r.wr >= 50 ? 'pos' : 'neg'}">${pct(r.wr, 2)}</b></td>
        <td><div class="row" style="flex-wrap:nowrap"><span style="width:48px">${pct(r.pr)}</span><div class="bar" style="flex:1"><i style="width:${r.pr / maxPr * 100}%"></i></div></div></td>
        ${isPro ? `<td class="hide-m">${pct(r.br)}</td>` : ''}
        <td class="hide-m muted">${r.picks.toLocaleString('ru-RU')}</td>
      </tr>`).join('')}</tbody></table></div>`;
    $$('th[data-s]', box).forEach(t => t.onclick = () => { const k = t.dataset.s; if (metaUI.sort === k) metaUI.dir *= -1; else { metaUI.sort = k; metaUI.dir = -1; } drawMetaList(); });
  }
  if (!rows.length) box.innerHTML = '<div class="empty">Ничего не найдено</div>';
}

/* ============================================================
   БИЛДЫ
   ============================================================ */
let buildsQ = '';
function renderBuilds(el, p = []) {
  const [id, mode, bid, posArg] = p;
  withHeroes(el, () => {
    const h = HERO[id];
    if (!h) { draft = null; return renderHeroPicker(el); }
    if (mode === 'edit') return renderBuildEditor(el, h, bid, +posArg || 0);
    draft = null;
    renderHeroPage(el, h);
  });
}
function renderHeroPicker(el) {
  const myIds = Object.keys(db.builds).filter(k => db.builds[k] && db.builds[k].length);
  el.innerHTML = `
    <div class="stack">
      ${myIds.length ? `<div class="card"><div class="card-head"><h3>Мои билды</h3><span class="sub">${myIds.length} ${plural(myIds.length, 'герой', 'героя', 'героев')}</span></div>
        <div class="hero-grid" style="margin:0">${myIds.map(k => HERO[k]).filter(Boolean).map(h => `<a class="hero-tile" href="#/builds/${h.id}"><img src="${heroImg(h)}" alt=""><span>${esc(h.localized_name)}</span><em class="mark">${db.builds[h.id].length}</em></a>`).join('')}</div></div>` : ''}
      <div class="card">
        <div class="row" style="margin-bottom:18px"><label class="search">${ic('search')}<input class="input" id="bQ" placeholder="Найти героя…" value="${esc(buildsQ)}"></label></div>
        <div id="bGrid"></div>
      </div>
    </div>`;
  const draw = () => {
    const q = buildsQ.trim().toLowerCase();
    $('#bGrid').innerHTML = Object.entries(ATTRS).map(([a, n]) => {
      const list = HEROES.filter(h => h.primary_attr === a && (!q || h.localized_name.toLowerCase().includes(q)));
      if (!list.length) return '';
      return `<div class="attr-group"><h4><span class="attr a-${a}"></span>${n}</h4><div class="hero-grid">${list.map(h => `
        <a class="hero-tile" href="#/builds/${h.id}"><img src="${heroImg(h)}" alt="" loading="lazy"><span>${esc(h.localized_name)}</span>${db.builds[h.id]?.length ? '<em class="mark">★</em>' : ''}</a>`).join('')}</div></div>`;
    }).join('') || '<div class="empty">Герой не найден</div>';
  };
  $('#bQ').oninput = e => { buildsQ = e.target.value; draw(); };
  draw();
}

function renderHeroPage(el, h) {
  const st = bracketStats(db.bracket).find(r => r.h.id === h.id);
  const games = mmrSeries().filter(e => heroByName(e.hero)?.id === h.id);
  const myW = games.filter(g => g.result === 'W').length;
  const builds = db.builds[h.id] || [];
  const heroNotes = db.notes.filter(n => heroByName(n.hero)?.id === h.id);
  const bName = BRACKETS.find(b => b.v === db.bracket)?.n;
  $('#pageTitle').textContent = h.localized_name;
  $('#crumb').textContent = 'Билды героев · ' + ATTRS[h.primary_attr];
  setActions(`<a class="btn btn-ghost" href="#/builds">${ic('back')}Все герои</a><button class="btn btn-primary" id="hNew">${ic('plus')}Новое руководство</button>`);

  el.innerHTML = `
  <div class="stack">
    <div class="hero-head">
      <div class="bg" style="background-image:url('${heroImg(h)}')"></div>
      <div class="inner">
        <img class="portrait" src="${heroImg(h)}" alt="">
        <div style="flex:1;min-width:240px">
          <div class="row"><span class="tag"><span class="attr a-${h.primary_attr}"></span>${ATTRS[h.primary_attr]}</span><span class="tag">${h.attack_type === 'Melee' ? 'Ближний бой' : 'Дальний бой'}</span>${h.roles.map(r => `<span class="tag">${ROLES[r] || r}</span>`).join('')}</div>
          <h2 style="margin-top:8px">${esc(h.localized_name)}</h2>
          <div class="hero-stats">
            <div><b><span class="tbadge t-${st.tier}" style="width:34px;height:30px;font-size:18px">${st.tier}</span></b><span>Тир · ${esc(bName)}</span></div>
            <div><b class="${st.wr >= 50 ? 'pos' : 'neg'}">${pct(st.wr, 2)}</b><span>Винрейт</span></div>
            <div><b>${pct(st.pr)}</b><span>Пикрейт</span></div>
            <div><b>${h.pro_pick || 0} / ${h.pro_ban || 0}</b><span>Про пики / баны</span></div>
            <div><b>${games.length ? `${myW}–${games.length - myW}` : '—'}</b><span>Мои игры</span></div>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><div><h3>🧭 Позиции</h3><div class="sub">На какие позиции берут ${esc(h.localized_name)} в про-матчах за полгода. Выбери позицию — предметы и твои руководства отфильтруются</div></div></div>
      <div id="hPos"><div class="spinner" style="margin:16px auto"></div></div>
    </div>

    <div class="grid g2" id="hMatchups">
      <div class="card mu good"><div class="card-head"><div><h3>💪 Силён против</h3><div class="sub">Топ-5 героев, против которых ${esc(h.localized_name)} чаще побеждает</div></div></div><div class="mu-list"><div class="spinner" style="margin:16px auto"></div></div></div>
      <div class="card mu bad"><div class="card-head"><div><h3>⚠️ Слаб против</h3><div class="sub">Топ-5 героев, против которых ${esc(h.localized_name)} чаще проигрывает</div></div></div><div class="mu-list"><div class="spinner" style="margin:16px auto"></div></div></div>
    </div>

    <div class="card">
      <div class="card-head"><div><h3>Популярные предметы</h3><div class="sub">Что чаще всего покупают на ${esc(h.localized_name)} в публичных матчах, все позиции вместе (OpenDota)</div></div></div>
      <div id="hItems"><div class="spinner" style="margin:20px auto"></div></div>
    </div>

    <div class="card">
      <div class="card-head"><div><h3>Мои руководства</h3><div class="sub">Свои сборки</div></div><button class="btn btn-ghost btn-sm" id="hNew2">${ic('plus')}Новое руководство</button></div>
      <div class="list" id="hBuilds"></div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="card-head"><h3>Наблюдения по герою</h3><button class="btn btn-ghost btn-sm" id="hNote">${ic('plus')}Запись</button></div>
        <div class="list">${heroNotes.map(n => { const c = NOTE_CATS[n.cat] || NOTE_CATS.other; return `<div class="session" style="border-left:3px solid ${c.c}"><div class="body"><span class="cat" style="--c:${c.c}">${c.n}</span> <span class="dim" style="font-size:12px">· ${fmtDate(n.date)}</span><br><b>${esc(n.title)}</b><div class="meta" style="white-space:pre-wrap">${esc(n.text).slice(0, 220)}</div></div></div>`; }).join('') || '<div class="muted">Нет записей. Добавь, что понял про героя.</div>'}</div>
      </div>
    </div>
  </div>`;

  loadMatchups(h.id).then(list => drawMatchups(h, list)).catch(() => {
    $$('#hMatchups .mu-list').forEach(b => { b.innerHTML = '<div class="muted">Не удалось загрузить матчапы OpenDota.</div>'; });
  });

  const goNew = () => { location.hash = `#/builds/${h.id}/edit/new` + (heroPos[h.id] ? '/' + heroPos[h.id] : ''); };
  $('#hNew').onclick = goNew; $('#hNew2').onclick = goNew;
  $('#hNote').onclick = () => openNoteModal({ hero: h.localized_name });
  curAbil = null;
  drawBuildCards(h, null);
  Promise.all([loadItems(), loadHeroAbilities(h).catch(() => null)]).then(([, abil]) => drawBuildCards(h, abil)).catch(() => { });
  Promise.all([loadItems(), loadHeroPositions(h.id)]).then(([, data]) => drawHeroPositions(h, data))
    .catch(() => { const b = $('#hPos'); if (b) b.innerHTML = '<div class="muted">Не удалось загрузить позиции из OpenDota. Попробуй позже.</div>'; });

  Promise.all([loadItems(), loadItemPop(h.id)]).then(([items, pop]) => {
    const box = $('#hItems'); if (!box) return;
    const phases = [['start_game_items', 'Старт'], ['early_game_items', 'Ранняя игра'], ['mid_game_items', 'Мид-гейм'], ['late_game_items', 'Лейт']];
    box.innerHTML = `<div class="grid g4">${phases.map(([k, n]) => {
      const list = Object.entries(pop[k] || {}).map(([id, cnt]) => ({ it: items[id], cnt })).filter(x => x.it).sort((a, b) => b.cnt - a.cnt).slice(0, 8);
      const max = list[0]?.cnt || 1;
      return `<div class="phase"><h4>${n}</h4><div class="items">${list.map(x => `
        <div class="item" title="${esc(x.it.n)} · ${x.it.cost} золота"><img src="${CDN + x.it.img}" alt="" loading="lazy"><span class="nm">${esc(x.it.n)}</span><div class="bar"><i style="width:${x.cnt / max * 100}%"></i></div></div>`).join('') || '<span class="dim">Нет данных</span>'}</div></div>`;
    }).join('')}</div>`;
  }).catch(() => { const box = $('#hItems'); if (box) box.innerHTML = '<div class="muted">Не удалось загрузить предметы OpenDota.</div>'; });
}

/* ---------- матчапы: против кого герой силён / слаб ---------- */
async function loadMatchups(id) {
  const k = 'd2h_mu_' + id;
  const c = cacheGet(k, 12 * 36e5);
  if (c) return c.data;
  const r = await fetch(`${API}/heroes/${id}/matchups`);
  if (!r.ok) throw new Error(r.status);
  const d = await r.json();
  cacheSet(k, d);
  return d;
}
function drawMatchups(h, raw) {
  const box = $('#hMatchups'); if (!box) return;
  const MIN_GAMES = 10, K = 20; // отсекаем малые выборки и сглаживаем винрейт к 50%
  const rows = raw.filter(m => HERO[m.hero_id] && m.games_played >= MIN_GAMES).map(m => ({
    h: HERO[m.hero_id], games: m.games_played, wr: m.wins / m.games_played * 100,
    score: (m.wins + K * 0.5) / (m.games_played + K) * 100,
  }));
  const good = rows.filter(r => r.wr > 50).sort((a, b) => b.score - a.score).slice(0, 5);
  const bad = rows.filter(r => r.wr < 50).sort((a, b) => a.score - b.score).slice(0, 5);
  const total = raw.reduce((a, m) => a + m.games_played, 0);
  const row = (r, cls) => `
    <a class="mu-row" href="#/builds/${r.h.id}" title="Открыть ${esc(r.h.localized_name)}">
      <img src="${heroImg(r.h)}" alt="" loading="lazy">
      <div class="mu-body"><b>${esc(r.h.localized_name)}</b><div class="bar"><i class="${cls}" style="width:${Math.min(100, Math.abs(r.wr - 50) * 4)}%"></i></div></div>
      <div class="mu-wr"><b class="${cls === 'g' ? 'pos' : 'neg'}">${pct(r.wr, 0)}</b><span>${r.games} ${plural(r.games, 'игра', 'игры', 'игр')}</span></div>
    </a>`;
  const empty = '<div class="muted">Недостаточно данных по этому герою.</div>';
  $('.good .mu-list', box).innerHTML = good.map(r => row(r, 'g')).join('') || empty;
  $('.bad .mu-list', box).innerHTML = bad.map(r => row(r, 'b')).join('') || empty;
  $$('.mu .sub', box).forEach(s => { if (!s.dataset.n) { s.dataset.n = 1; s.insertAdjacentHTML('beforeend', ` · матчи высокого уровня (OpenDota), ${total.toLocaleString('ru-RU')} игр`); } });
}

/* ============================================================
   РУКОВОДСТВА (билды как в Dota): группы предметов, прокачка, таланты
   ============================================================ */
const DEFAULT_GROUPS = ['Стартовые предметы', 'Ранняя игра', 'Мид-гейм', 'Поздняя игра', 'Ситуативные'];
const MAX_LVL = 18, NO_POINT = new Set([17]), TALENT_LV = [10, 15, 20, 25];
const ITEM_SKIP = /^(recipe_|aegis$|cheese$|royale_with_cheese$|refresher_shard$|ultimate_scepter_roshan$|aghanims_shard_roshan$|ultimate_scepter_2$|winters_curse|mutation_|seer_stone|river_painter|famango|great_famango|greater_famango|banana$|tango_single$|courier$|flying_courier$|stout_shield$|pocket_roshan$|necronomicon|trident$|diffusal_blade_2$)/;
let draft = null;

const itemImg = k => { const it = ITEM_BY_KEY[k]; return it ? CDN + it.img : ''; };
const itemName = k => ITEM_BY_KEY[k]?.n || k;

function normalizeBuild(b) {
  if (!b.groups) {
    const legacy = [b.items && 'Предметы: ' + b.items, b.skills && 'Прокачка: ' + b.skills, b.note].filter(Boolean).join('\n\n');
    b.groups = DEFAULT_GROUPS.map(n => ({ id: uid(), name: n, items: [] }));
    b.note = legacy; delete b.items;
    b.skills = [];
  }
  if (!Array.isArray(b.skills)) b.skills = [];
  b.skills = Array.from({ length: MAX_LVL }, (_, i) => b.skills[i] || null);
  b.talents = b.talents || {};
  return b;
}

function skillCheck(seq, abil) {
  const cnt = {};
  for (let L = 1; L <= MAX_LVL; L++) {
    const k = seq[L - 1]; if (!k) continue;
    if (NO_POINT.has(L)) return `На ${L} уровне нет очка способностей`;
    const r = (cnt[k] = (cnt[k] || 0) + 1);
    if (k === 'T') {
      if (r > 2) return 'До 18 уровня можно взять только 2 таланта';
      if (L < TALENT_LV[r - 1]) return `${r}-й талант можно взять с ${TALENT_LV[r - 1]} уровня`;
      continue;
    }
    const a = abil.abilities.find(x => x.key === k); if (!a) continue;
    if (a.ult) {
      if (r > 3) return `${a.dname}: максимум 3 уровня`;
      if (L < r * 6) return `${a.dname} (${r} ур.) доступен с ${r * 6} уровня героя`;
    } else {
      if (r > 4) return `${a.dname}: максимум 4 уровня`;
      if (L < 2 * r - 1) return `${a.dname} (${r} ур.) доступен с ${2 * r - 1} уровня героя`;
    }
  }
  return null;
}

/* ---------- позиции героя (про-матчи, OpenDota explorer) ---------- */
// Позиция игрока: мид = игрок центральной линии с наибольшим GPM (саппорт, зашедший на мид, мидером не считается);
// остальные 4 игрока команды по GPM: 1-й → pos 1, 2-й → pos 3, 3-й → pos 4, 4-й → pos 5
const POS_SHORT = ['Керри', 'Мид', 'Хардлейн', 'Роумер', 'Саппорт'];
const POS_CASE = `CASE WHEN is_mid THEN 2 WHEN rk = 1 THEN 1 WHEN rk = 2 THEN 3 WHEN rk = 3 THEN 4 ELSE 5 END`;
const posCTE = (where, cols = '') => `
  p0 AS (SELECT pm.match_id, pm.hero_id, pm.lane_role, pm.gold_per_min AS gpm, (pm.player_slot < 128) AS rad ${cols},
    row_number() OVER (PARTITION BY pm.match_id, (pm.player_slot < 128), (pm.lane_role = 2) ORDER BY pm.gold_per_min DESC) AS rk_mid
    FROM player_matches pm JOIN matches m USING (match_id) WHERE pm.lane_role IS NOT NULL AND ${where}),
  p1 AS (SELECT *, (lane_role = 2 AND rk_mid = 1) AS is_mid FROM p0),
  p AS (SELECT *, row_number() OVER (PARTITION BY match_id, rad, is_mid ORDER BY gpm DESC) AS rk FROM p1)`;
async function explorer(sql) {
  const r = await fetch(API + '/explorer?sql=' + encodeURIComponent(sql));
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.err) throw new Error(d.err || r.status);
  return d.rows || [];
}
async function loadHeroPositions(heroId) {
  const id = parseInt(heroId, 10);
  const k = 'd2h_pos2_' + id;
  const c = cacheGet(k, 24 * 36e5);
  if (c) return c.data;
  const base = `WITH ms AS (SELECT pm.match_id FROM player_matches pm JOIN matches m USING (match_id)
      WHERE pm.hero_id = ${id} AND m.start_time > extract(epoch from now() - interval '180 days')),
    ${posCTE('pm.match_id IN (SELECT match_id FROM ms)', `, ((pm.player_slot < 128) = m.radiant_win) AS win,
      ARRAY[pm.item_0,pm.item_1,pm.item_2,pm.item_3,pm.item_4,pm.item_5] AS inv`)}`;
  const [stats, items] = await Promise.all([
    explorer(`${base} SELECT ${POS_CASE} AS pos, count(*) AS games, sum(CASE WHEN win THEN 1 ELSE 0 END) AS wins FROM p WHERE hero_id = ${id} GROUP BY 1`),
    explorer(`${base}, q AS (SELECT ${POS_CASE} AS pos, unnest(inv) AS item FROM p WHERE hero_id = ${id})
      SELECT pos, item, count(*) AS n FROM q WHERE item > 0 GROUP BY 1, 2 HAVING count(*) >= 3`),
  ]);
  const data = { stats: stats.map(r => ({ pos: +r.pos, games: +r.games, wins: +r.wins })), items: items.map(r => ({ pos: +r.pos, item: +r.item, n: +r.n })) };
  cacheSet(k, data);
  return data;
}
let ALLPOS = null, allPosPromise = null;
function loadAllPositions() {
  if (ALLPOS) return Promise.resolve(ALLPOS);
  const c = cacheGet('d2h_allpos2', 24 * 36e5);
  if (c) return Promise.resolve(ALLPOS = c.data);
  if (allPosPromise) return allPosPromise;
  allPosPromise = explorer(`WITH ${posCTE(`m.start_time > extract(epoch from now() - interval '60 days')`)}
    SELECT hero_id, ${POS_CASE} AS pos, count(*) AS games FROM p GROUP BY 1, 2`)
    .then(rows => {
      const map = {};
      rows.forEach(r => { const m = map[r.hero_id] = map[r.hero_id] || { total: 0 }; m[r.pos] = +r.games; m.total += +r.games; });
      cacheSet('d2h_allpos2', map);
      return (ALLPOS = map);
    })
    .finally(() => { allPosPromise = null; });
  return allPosPromise;
}
// Подходит ли герой на позицию: по про-матчам (≥12% игр и минимум 3 игры), а если игр мало — по ролям героя
function heroFitsPos(h, pos) {
  const m = ALLPOS && ALLPOS[h.id];
  if (m && m.total >= 15) return (m[pos] || 0) >= 3 && (m[pos] || 0) / m.total >= 0.12;
  const r = h.roles;
  const sup = r.includes('Support');
  if (pos === 1) return r.includes('Carry') && !sup;
  if (pos === 2) return r.includes('Nuker') && (r.includes('Carry') || r.includes('Escape')) && !sup;
  if (pos === 3) return (r.includes('Durable') || r.includes('Initiator')) && !sup;
  return sup;
}

const heroPos = {}; // выбранная позиция на странице героя: heroId → 0..5
let curAbil = null;
function drawHeroPositions(h, data) {
  const box = $('#hPos'); if (!box) return;
  const total = data.stats.reduce((a, s) => a + s.games, 0);
  const list = data.stats.filter(s => s.games >= 5 && s.games / total >= 0.04).sort((a, b) => a.pos - b.pos);
  if (!list.length) { box.innerHTML = `<div class="muted">Слишком мало про-матчей с ${esc(h.localized_name)} за последние полгода, чтобы определить позиции.</div>`; return; }
  if (heroPos[h.id] == null) heroPos[h.id] = list.slice().sort((a, b) => b.games - a.games)[0].pos;
  const sel = heroPos[h.id];
  const tab = (pos, title, sub, share, extra = '') => `<button type="button" class="pos-tab ${sel === pos ? 'on' : ''}" data-pos="${pos}">
      <b>${title}</b><span>${sub}</span>${extra}<i class="pbar"><i style="width:${share}%"></i></i></button>`;
  const tabs = tab(0, 'Все', 'позиции', 100, `<em>${total} ${plural(total, 'игра', 'игры', 'игр')}</em>`) + list.map(s => {
    const share = s.games / total * 100, wr = s.wins / s.games * 100;
    return tab(s.pos, 'Pos ' + s.pos, POS_SHORT[s.pos - 1], share, `<em>${pct(share, 0)} игр · <span class="${wr >= 50 ? 'pos' : 'neg'}">WR ${pct(wr, 0)}</span></em>`);
  }).join('');
  // предметы в конце игры на выбранной позиции
  const games = sel ? (data.stats.find(s => s.pos === sel)?.games || 0) : total;
  const agg = {};
  data.items.filter(it => !sel || it.pos === sel).forEach(it => { agg[it.item] = (agg[it.item] || 0) + it.n; });
  const top = Object.entries(agg).map(([id, n]) => ({ it: ITEMS?.[id], n })).filter(x => x.it && !ITEM_SKIP.test(x.it.key) && !['tpscroll', 'ward_observer', 'ward_sentry', 'dust', 'smoke_of_deceit', 'tango', 'flask', 'clarity', 'enchanted_mango', 'faerie_fire', 'blood_grenade'].includes(x.it.key))
    .sort((a, b) => b.n - a.n).slice(0, 12);
  box.innerHTML = `<div class="pos-tabs">${tabs}</div>
    <div class="lbl" style="margin-top:16px">${sel ? `Чаще всего в инвентаре к концу игры на Pos ${sel} · ${POS_SHORT[sel - 1]}` : 'Чаще всего в инвентаре к концу игры (все позиции)'}</div>
    <div class="pos-items">${top.map(x => `<div class="pos-item" title="${esc(x.it.n)}"><img src="${CDN + x.it.img}" alt="" loading="lazy"><span>${esc(x.it.n)}</span><em>${pct(Math.min(100, x.n / games * 100), 0)}</em></div>`).join('') || '<span class="muted">Нет данных</span>'}</div>`;
  $$('.pos-tab', box).forEach(b => b.onclick = () => { heroPos[h.id] = +b.dataset.pos; drawHeroPositions(h, data); drawBuildCards(h, curAbil); });
  drawBuildCards(h, curAbil);
}

/* ---------- отображение готового руководства ---------- */
function drawBuildCards(h, abil) {
  const box = $('#hBuilds'); if (!box) return;
  if (abil) curAbil = abil;
  abil = abil || curAbil;
  const allBuilds = db.builds[h.id] || [];
  const sel = heroPos[h.id] || 0;
  const builds = sel ? allBuilds.filter(b => !b.pos || b.pos === POS[sel - 1]) : allBuilds;
  if (!allBuilds.length) { box.innerHTML = `<div class="empty"><div class="big">🛠️</div>Создай своё первое руководство на ${esc(h.localized_name)}: предметы по стадиям игры, порядок прокачки и таланты.</div>`; return; }
  if (!builds.length) { box.innerHTML = `<div class="empty"><div class="big">🧭</div>Нет руководств для Pos ${sel} · ${POS_SHORT[sel - 1]}. Всего руководств на героя: ${allBuilds.length} — выбери «Все» или создай новое для этой позиции.</div>`; return; }
  const abilByKey = {}; (abil?.abilities || []).forEach(a => { abilByKey[a.key] = a; });
  box.innerHTML = (sel && builds.length < allBuilds.length ? `<div class="muted" style="font-size:12.5px">Показаны руководства для Pos ${sel} и без позиции · ${builds.length} из ${allBuilds.length}</div>` : '') + builds.map(b => {
    let body = '';
    if (b.groups) {
      body += b.groups.filter(g => g.items.length).map(g => {
        const cost = g.items.reduce((a, k) => a + (ITEM_BY_KEY[k]?.cost || 0), 0);
        return `<div class="lbl">${esc(g.name)}${cost ? ` <span class="gold-cost">${cost.toLocaleString('ru-RU')}</span>` : ''}</div>
          <div class="iline">${g.items.map(k => itemImg(k) ? `<img src="${itemImg(k)}" alt="" title="${esc(itemName(k))}" loading="lazy">` : `<span class="tag">${esc(itemName(k))}</span>`).join('')}</div>`;
      }).join('');
      const skills = b.skills || [];
      if (skills.some(Boolean)) {
        body += `<div class="lbl">Порядок прокачки</div><div class="sline">${skills.map((k, i) => {
          const L = i + 1; if (NO_POINT.has(L) && !k) return '';
          let face = '<i class="ph"></i>';
          if (k === 'T') face = '<i class="tt">T</i>';
          else if (k) { const a = abilByKey[k]; face = a?.img ? `<img src="${CDN + a.img}" alt="" title="${esc(a.dname)}">` : `<i class="ph" title="${esc(k)}"></i>`; }
          return `<div class="sl">${face}<span>${L}</span></div>`;
        }).join('')}</div>`;
      }
      const tal = Object.entries(b.talents || {}).filter(([, v]) => v).sort((a, b2) => b2[0] - a[0]);
      if (tal.length) {
        const tn = k => abil?.talents.find(t => t.key === k)?.dname || k;
        body += `<div class="lbl">Таланты</div><div class="tlist">${tal.map(([lv, k]) => `<div><b>${lv}</b>${esc(tn(k))}</div>`).join('')}</div>`;
      }
      if (b.note) body += `<div class="lbl">Заметки / матчапы</div><pre>${esc(b.note)}</pre>`;
    } else {
      body += `${b.items ? `<div class="lbl">Предметы</div><pre>${esc(b.items)}</pre>` : ''}${b.skills ? `<div class="lbl">Прокачка / таланты</div><pre>${esc(b.skills)}</pre>` : ''}${b.note ? `<div class="lbl">Заметки / матчапы</div><pre>${esc(b.note)}</pre>` : ''}`;
    }
    return `<div class="build-card" data-bid="${b.id}">
      <div class="row"><h4>${esc(b.title)}</h4>${b.pos ? `<span class="tag">${esc(b.pos)}</span>` : ''}<span class="spacer"></span>
        <button class="icon-btn" data-edit title="Редактировать">${ic('edit')}</button><button class="icon-btn danger" data-del title="Удалить">${ic('trash')}</button></div>
      ${body}</div>`;
  }).join('');
  $$('[data-bid]', box).forEach(c => {
    const b = builds.find(x => x.id === c.dataset.bid);
    $('[data-edit]', c).onclick = () => { location.hash = `#/builds/${h.id}/edit/${b.id}`; };
    $('[data-del]', c).onclick = async () => { if (await askConfirm('Удалить руководство «' + b.title + '»?')) { db.builds[h.id] = (db.builds[h.id] || []).filter(x => x !== b); save(); rerender(); } };
  });
}

/* ---------- редактор ---------- */
async function renderBuildEditor(el, h, bid, posArg = 0) {
  const list = db.builds[h.id] || [];
  const src = bid && bid !== 'new' ? list.find(b => b.id === bid) : null;
  const key = h.id + '/' + (src ? src.id : 'new');
  if (!draft || draft._key !== key) {
    draft = src ? normalizeBuild(JSON.parse(JSON.stringify(src))) : normalizeBuild({ title: '', pos: POS[posArg - 1] || '', groups: DEFAULT_GROUPS.map(n => ({ id: uid(), name: n, items: [] })), skills: [], talents: {}, note: '' });
    draft._key = key;
  }
  $('#pageTitle').textContent = src ? 'Редактирование руководства' : 'Новое руководство';
  $('#crumb').textContent = 'Билды героев · ' + h.localized_name;
  setActions(`<a class="btn btn-ghost" href="#/builds/${h.id}">Отмена</a><button class="btn btn-primary" id="eSave">Сохранить руководство</button>`);
  $('#eSave').onclick = () => saveDraft(h, src);

  loadingView(el, 'Загружаю предметы и способности…');
  let abil = null;
  try { [, abil] = await Promise.all([loadItems(), loadHeroAbilities(h).catch(() => null)]); }
  catch { return offlineView(el, () => renderBuildEditor(el, h, bid)); }
  if (!draft || draft._key !== key || !location.hash.includes('/edit/')) return;

  el.innerHTML = `
  <div class="stack">
    <div class="card ed-head">
      <img src="${heroImg(h)}" alt="">
      <div class="form-grid" style="flex:1">
        <div class="field"><label>Название руководства</label><input class="input" id="eTitle" value="${esc(draft.title)}" placeholder="Например: Быстрый Battle Fury фарм" maxlength="60"></div>
        <div class="field"><label>Позиция</label><select class="input" id="ePos"><option value="">—</option>${POS.map(p => `<option ${draft.pos === p ? 'selected' : ''}>${p}</option>`).join('')}</select></div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><div><h3>Предметы</h3><div class="sub">Нажми «+», чтобы добавить предмет. Перетаскивай иконки, чтобы менять порядок или переносить между группами. Название группы можно изменить, кликнув по нему.</div></div>
        <button class="btn btn-ghost btn-sm" id="eAddGroup">${ic('plus')}Группа</button></div>
      <div id="eGroups"></div>
    </div>

    <div class="card">
      <div class="card-head"><div><h3>Порядок прокачки</h3><div class="sub" id="eSkillSub"></div></div>
        <button class="btn btn-ghost btn-sm" id="eSkillReset">Сбросить</button></div>
      <div id="eSkills"></div>
    </div>

    <div class="card">
      <div class="card-head"><div><h3>Таланты</h3><div class="sub">Выбери по одному таланту на каждом уровне</div></div></div>
      <div id="eTalents"></div>
    </div>

    <div class="card">
      <div class="field"><label>Заметки, матчапы, тайминги</label><textarea class="input" id="eNote" rows="4" placeholder="Против кого хорош / плох, когда что покупать, ключевые тайминги…">${esc(draft.note || '')}</textarea></div>
    </div>
  </div>`;

  $('#eTitle').oninput = e => { draft.title = e.target.value; };
  $('#ePos').onchange = e => { draft.pos = e.target.value; };
  $('#eNote').oninput = e => { draft.note = e.target.value; };
  $('#eAddGroup').onclick = () => { draft.groups.push({ id: uid(), name: 'Новая группа', items: [] }); drawGroups(h); const inp = $$('#eGroups [data-gname]').pop(); inp && (inp.focus(), inp.select()); };
  drawGroups(h);
  if (abil && abil.abilities.length) {
    $('#eSkillReset').onclick = () => { draft.skills = Array(MAX_LVL).fill(null); drawSkills(abil); };
    drawSkills(abil); drawTalents(abil);
  } else {
    $('#eSkills').innerHTML = '<div class="muted">Не удалось загрузить способности героя из OpenDota. Попробуй позже.</div>';
    $('#eTalents').innerHTML = ''; $('#eSkillReset').hidden = true;
  }
}

function saveDraft(h, src) {
  const t = $('#eTitle'); if (t) draft.title = t.value;
  if (!draft.title.trim()) { toast('Дай руководству название'); t && t.focus(); return; }
  const data = JSON.parse(JSON.stringify(draft)); delete data._key;
  data.title = data.title.trim();
  const list = db.builds[h.id] = db.builds[h.id] || [];
  if (src) Object.keys(src).forEach(k => delete src[k]), Object.assign(src, data);
  else list.unshift({ ...data, id: uid(), date: today() });
  save(); draft = null; toast('Руководство сохранено ✓');
  location.hash = '#/builds/' + h.id;
}

let dragSrc = null;
function drawGroups(h) {
  const box = $('#eGroups'); if (!box) return;
  box.innerHTML = draft.groups.map((g, gi) => {
    const cost = g.items.reduce((a, k) => a + (ITEM_BY_KEY[k]?.cost || 0), 0);
    return `<div class="igroup" data-gi="${gi}">
      <div class="igroup-head">
        <input class="gname" data-gname value="${esc(g.name)}" maxlength="40" title="Нажми, чтобы переименовать">
        ${cost ? `<span class="gold-cost">${cost.toLocaleString('ru-RU')}</span>` : ''}
        <span class="spacer"></span>
        <button class="icon-btn" data-up title="Выше" ${gi === 0 ? 'disabled' : ''}>↑</button>
        <button class="icon-btn" data-down title="Ниже" ${gi === draft.groups.length - 1 ? 'disabled' : ''}>↓</button>
        <button class="icon-btn danger" data-delg title="Удалить группу">${ic('trash')}</button>
      </div>
      <div class="islots" data-drop="${gi}">
        ${g.items.map((k, ii) => `<div class="islot" draggable="true" data-ii="${ii}" title="${esc(itemName(k))} · ${ITEM_BY_KEY[k]?.cost || 0} золота">${itemImg(k) ? `<img src="${itemImg(k)}" alt="">` : `<small>${esc(itemName(k))}</small>`}<button class="rm" data-rm title="Убрать">×</button></div>`).join('')}
        <button class="islot add" data-add title="Добавить предмет">+</button>
      </div>
    </div>`;
  }).join('') || '<div class="muted">Нет групп. Нажми «Группа», чтобы добавить.</div>';

  $$('.igroup', box).forEach(gEl => {
    const gi = +gEl.dataset.gi, g = draft.groups[gi];
    $('[data-gname]', gEl).oninput = e => { g.name = e.target.value; };
    $('[data-gname]', gEl).onblur = e => { if (!e.target.value.trim()) { g.name = 'Без названия'; e.target.value = g.name; } };
    $('[data-up]', gEl).onclick = () => { draft.groups.splice(gi - 1, 0, draft.groups.splice(gi, 1)[0]); drawGroups(h); };
    $('[data-down]', gEl).onclick = () => { draft.groups.splice(gi + 1, 0, draft.groups.splice(gi, 1)[0]); drawGroups(h); };
    $('[data-delg]', gEl).onclick = async () => { if (!g.items.length || await askConfirm(`Удалить группу «${g.name}» вместе с предметами?`)) { draft.groups.splice(gi, 1); drawGroups(h); } };
    $('[data-add]', gEl).onclick = () => openItemPicker(h, gi);
    $$('.islot[data-ii]', gEl).forEach(s => {
      const ii = +s.dataset.ii;
      $('[data-rm]', s).onclick = e => { e.stopPropagation(); g.items.splice(ii, 1); drawGroups(h); };
      s.ondragstart = e => { dragSrc = { gi, ii }; s.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', ''); };
      s.ondragend = () => { s.classList.remove('dragging'); $$('.islots.over').forEach(x => x.classList.remove('over')); };
    });
    const zone = $('.islots', gEl);
    zone.ondragover = e => { if (!dragSrc) return; e.preventDefault(); zone.classList.add('over'); };
    zone.ondragleave = e => { if (!zone.contains(e.relatedTarget)) zone.classList.remove('over'); };
    zone.ondrop = e => {
      e.preventDefault(); zone.classList.remove('over');
      if (!dragSrc) return;
      const from = draft.groups[dragSrc.gi];
      const target = e.target.closest('.islot[data-ii]');
      let to = target ? +target.dataset.ii : g.items.length;
      const [k] = from.items.splice(dragSrc.ii, 1);
      if (from === g && dragSrc.ii < to) to--;
      g.items.splice(Math.max(0, to), 0, k);
      dragSrc = null; drawGroups(h);
    };
  });
}

function openItemPicker(h, gi) {
  let tab = 'pop', q = '';
  const g = draft.groups[gi];
  $('#modalTitle').textContent = 'Добавить в «' + g.name + '»';
  $('.modal').classList.add('wide');
  modalOnClose = null;
  const form = $('#modalForm');
  form.onsubmit = e => e.preventDefault();
  form.innerHTML = `
    <div class="row">
      <label class="search">${ic('search')}<input class="input" id="pQ" placeholder="Поиск предмета (англ. название)…" autocomplete="off"></label>
      <div class="seg" id="pTabs"><button type="button" data-t="pop" class="on">Популярные на герое</button><button type="button" data-t="all">Все предметы</button><button type="button" data-t="neutral">Нейтральные</button></div>
    </div>
    <div class="pgrid" id="pGrid"><div class="spinner" style="margin:30px auto;grid-column:1/-1"></div></div>
    <div class="modal-foot"><span class="muted" id="pCount" style="margin-right:auto;align-self:center"></span><button type="button" class="btn btn-primary" data-close>Готово</button></div>`;
  $('#modal').hidden = false;

  const all = Object.values(ITEMS).filter(it => it.img && !ITEM_SKIP.test(it.key) && !/recipe/i.test(it.n) && (it.cost > 0 || it.tier || /ward/.test(it.key)));
  const base = all.filter(it => !it.tier).sort((a, b) => a.cost - b.cost || a.n.localeCompare(b.n));
  const neutral = all.filter(it => it.tier).sort((a, b) => a.tier - b.tier || a.n.localeCompare(b.n));
  let pop = null;
  loadItemPop(h.id).then(p => {
    const seen = new Set(); pop = [];
    ['start_game_items', 'early_game_items', 'mid_game_items', 'late_game_items'].forEach(ph => {
      Object.entries(p[ph] || {}).sort((a, b) => b[1] - a[1]).forEach(([id]) => { const it = ITEMS[id]; if (it && !seen.has(it.key) && !ITEM_SKIP.test(it.key)) { seen.add(it.key); pop.push(it); } });
    });
    draw();
  }).catch(() => { pop = []; draw(); });

  const updCount = () => { $('#pCount').textContent = `В группе: ${g.items.length}`; };
  function draw() {
    const grid = $('#pGrid'); if (!grid) return;
    const s = q.trim().toLowerCase();
    let list = s ? [...base, ...neutral].filter(it => it.n.toLowerCase().includes(s) || it.key.includes(s.replace(/\s+/g, '_')))
      : tab === 'pop' ? pop : tab === 'neutral' ? neutral : base;
    if (list === null) { grid.innerHTML = '<div class="spinner" style="margin:30px auto;grid-column:1/-1"></div>'; return; }
    grid.innerHTML = list.map(it => `<button type="button" class="pitem" data-k="${esc(it.key)}" title="${esc(it.n)}"><img src="${CDN + it.img}" alt="" loading="lazy"><span>${esc(it.n)}</span><em>${it.tier ? 'Тир ' + it.tier : it.cost ? it.cost : 'бесплатно'}</em></button>`).join('')
      || '<div class="muted" style="grid-column:1/-1;padding:20px;text-align:center">Ничего не найдено</div>';
    $$('.pitem', grid).forEach(b => b.onclick = () => {
      g.items.push(b.dataset.k); drawGroups(h); updCount();
      b.classList.remove('added'); void b.offsetWidth; b.classList.add('added');
    });
    updCount();
  }
  $('#pQ').oninput = e => { q = e.target.value; draw(); };
  $$('#pTabs button').forEach(b => b.onclick = () => { tab = b.dataset.t; q = ''; $('#pQ').value = ''; $$('#pTabs button').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  draw();
  setTimeout(() => $('#pQ')?.focus(), 30);
}

function drawSkills(abil) {
  const box = $('#eSkills'); if (!box) return;
  const used = draft.skills.filter(Boolean).length;
  $('#eSkillSub').textContent = `Нажимай на клетку, чтобы выбрать, что качать на этом уровне · очков распределено: ${used} из 17`;
  const rank = {};
  const ranks = draft.skills.map(k => k ? (rank[k] = (rank[k] || 0) + 1) : 0);
  const rows = [...abil.abilities.map(a => ({ key: a.key, a })), { key: 'T' }];
  const lv = Array.from({ length: MAX_LVL }, (_, i) => i + 1);
  box.innerHTML = `
    ${abil.innate.length ? `<div class="innate">${abil.innate.map(a => `<span class="tag">${a.img ? `<img src="${CDN + a.img}" alt="" onerror="this.remove()">` : ''}Врождённая: <b>${esc(a.dname)}</b></span>`).join('')}</div>` : ''}
    <div class="sgrid"><table>
      <thead><tr><th></th>${lv.map(L => `<th class="${NO_POINT.has(L) ? 'dim2' : ''}">${L}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td><div class="sname">${r.a ? `${r.a.img ? `<img src="${CDN + r.a.img}" alt="" title="${esc(r.a.desc)}">` : ''}<span>${esc(r.a.dname)}${r.a.ult ? '<em class="ulttag">Ульта</em>' : ''}</span>` : '<i class="tico">T</i><span>Талант</span>'}</div></td>
        ${lv.map(L => {
          const on = draft.skills[L - 1] === r.key;
          const lock = NO_POINT.has(L) || (r.key === 'T' && L < 10);
          return `<td><button type="button" class="scell ${on ? 'on' : ''} ${r.key === 'T' ? 't' : ''} ${lock ? 'lock' : ''}" data-k="${esc(r.key)}" data-l="${L}" ${lock ? 'disabled' : ''}>${on ? ranks[L - 1] : ''}</button></td>`;
        }).join('')}
      </tr>`).join('')}</tbody>
    </table></div>`;
  $$('.scell:not(.lock)', box).forEach(c => c.onclick = () => {
    const L = +c.dataset.l, k = c.dataset.k;
    const next = draft.skills.slice();
    next[L - 1] = next[L - 1] === k ? null : k;
    const err = skillCheck(next, abil);
    if (err) { toast(err); c.classList.add('shake'); setTimeout(() => c.classList.remove('shake'), 400); return; }
    draft.skills = next; drawSkills(abil);
  });
}

function drawTalents(abil) {
  const box = $('#eTalents'); if (!box) return;
  if (!abil.talents.length) { box.innerHTML = '<div class="muted">Нет данных о талантах.</div>'; return; }
  box.innerHTML = `<div class="ttree">${[4, 3, 2, 1].map(tier => {
    const lvl = TALENT_LV[tier - 1];
    const opts = abil.talents.filter(t => t.tier === tier);
    const [a, b] = [opts[0], opts[1]];
    const btn = t => t ? `<button type="button" class="topt ${draft.talents[lvl] === t.key ? 'on' : ''}" data-lv="${lvl}" data-k="${esc(t.key)}">${esc(t.dname)}</button>` : '<span></span>';
    return `<div class="trow">${btn(a)}<div class="tlv">${lvl}</div>${btn(b)}</div>`;
  }).join('')}</div>`;
  $$('.topt', box).forEach(b => b.onclick = () => {
    const lv = b.dataset.lv, k = b.dataset.k;
    draft.talents[lv] = draft.talents[lv] === k ? null : k;
    drawTalents(abil);
  });
}

/* ============================================================
   ПТС / MMR
   ============================================================ */
let quickRes = 'W';
function openGameModal(e = {}) {
  openModal(e.id ? 'Редактировать игру' : 'Записать игру', [
    { name: 'result', label: 'Результат', type: 'select', value: e.result || 'W', options: [['W', 'Победа'], ['L', 'Поражение']] },
    { name: 'delta', label: 'Изменение ПТС', type: 'number', value: e.delta ?? 25, min: 0, required: true },
    { name: 'hero', label: 'Герой', type: 'hero', value: e.hero || '' },
    { name: 'pos', label: 'Позиция', type: 'select', value: e.pos || '', options: [['', '—'], ...POS.map(p => [p, p])] },
    { name: 'date', label: 'Дата', type: 'date', value: e.date || today(), required: true },
    { name: 'kda', label: 'K / D / A', value: e.kda || '', ph: '8/3/12' },
    { name: 'note', label: 'Комментарий', type: 'textarea', full: true, rows: 3, value: e.note || '', ph: 'Что получилось, что нет?' },
  ], d => {
    d.delta = Math.abs(+d.delta || 0);
    if (e.id) Object.assign(db.mmr.find(x => x.id === e.id), d); else db.mmr.push({ id: uid(), ...d });
    save(); toast(d.result === 'W' ? `Победа! +${d.delta} 🏆` : `Поражение −${d.delta}. Разбери реплей 💪`); rerender();
  });
}
function renderMmr(el) {
  const m = mmrStats();
  setActions(`<button class="btn btn-ghost" id="mStart">Стартовый ПТС: ${db.startMmr}</button><button class="btn btn-primary" id="mAdd">${ic('plus')}Подробная запись</button>`);
  const byHero = {};
  m.s.forEach(e => { if (!e.hero) return; const k = e.hero; byHero[k] = byHero[k] || { n: k, g: 0, w: 0, d: 0 }; byHero[k].g++; if (e.result === 'W') byHero[k].w++; byHero[k].d += e.result === 'W' ? +e.delta : -e.delta; });
  const heroes = Object.values(byHero).sort((a, b) => b.g - a.g).slice(0, 6);
  const byPos = {};
  m.s.forEach(e => { if (!e.pos) return; byPos[e.pos] = byPos[e.pos] || { g: 0, w: 0 }; byPos[e.pos].g++; if (e.result === 'W') byPos[e.pos].w++; });

  el.innerHTML = `
  <div class="stack">
    <div class="grid g4">
      <div class="card kpi" style="--accent:var(--gold)"><div class="lbl">${ic('trophy')}Текущий</div><div class="val">${m.cur}</div><div class="hint">Пик: ${m.peak} · старт: ${db.startMmr}</div></div>
      <div class="card kpi" style="--accent:${m.cur - db.startMmr >= 0 ? 'var(--green)' : 'var(--red)'}"><div class="lbl">${ic('mmr')}Всего</div><div class="val ${m.cur - db.startMmr >= 0 ? 'pos' : 'neg'}">${sign(m.cur - db.startMmr)}</div><div class="hint">За 7 дней: <b class="${m.week >= 0 ? 'pos' : 'neg'}">${sign(m.week)}</b></div></div>
      <div class="card kpi" style="--accent:var(--blue)"><div class="lbl">Винрейт</div><div class="val">${pct(m.wr)}</div><div class="hint">${m.wins}W – ${m.games - m.wins}L</div></div>
      <div class="card kpi" style="--accent:${m.streakType === 'L' ? 'var(--red)' : 'var(--green)'}"><div class="lbl">${ic('fire')}Серия</div><div class="val ${m.streakType === 'L' ? 'neg' : 'pos'}">${m.streak ? m.streak + (m.streakType === 'W' ? 'W' : 'L') : '—'}</div><div class="hint">${m.streakType === 'L' && m.streak >= 2 ? 'Сделай перерыв, не тильтуй' : m.streak >= 3 ? 'Ты в огне!' : 'Текущая серия'}</div></div>
    </div>

    <div class="card">
      <div class="card-head"><h3>Быстрая запись игры</h3><span class="sub">ПТС посчитается автоматически</span></div>
      <form class="quick" id="qForm">
        <div class="field"><label>Итог</label><div class="wl"><button type="button" class="w ${quickRes === 'W' ? 'on' : ''}" data-r="W">Победа</button><button type="button" class="l ${quickRes === 'L' ? 'on' : ''}" data-r="L">Поражение</button></div></div>
        <div class="field"><label>Герой</label><input class="input" name="hero" list="heroList" placeholder="Герой" autocomplete="off"></div>
        <div class="field"><label>Позиция</label><select class="input" name="pos"><option value="">—</option>${POS.map(p => `<option>${p}</option>`).join('')}</select></div>
        <div class="field"><label>± ПТС</label><input class="input" type="number" name="delta" value="25" min="0"></div>
        <div class="field"><label>Дата</label><input class="input" type="date" name="date" value="${today()}"></div>
        <div class="field full"><label>Комментарий</label><input class="input" name="note" placeholder="Коротко: что решило игру"></div>
        <button class="btn btn-primary">${ic('plus')}Записать</button>
      </form>
    </div>

    <div class="card">
      <div class="card-head"><div><h3>График ПТС</h3><div class="sub">${m.games} ${plural(m.games, 'игра', 'игры', 'игр')}</div></div></div>
      <canvas class="chart" id="mChart" data-chart></canvas>
    </div>

    <div class="grid g-main">
      <div class="card">
        <div class="card-head"><h3>История игр</h3></div>
        ${m.s.length ? `<div style="overflow-x:auto"><table class="table"><thead><tr><th></th><th>Герой</th><th class="hide-m">Позиция</th><th>±</th><th>ПТС</th><th class="hide-m">Дата</th><th></th></tr></thead><tbody>
        ${m.s.slice().reverse().map(e => `<tr data-id="${e.id}">
          <td><span class="res ${e.result}">${e.result === 'W' ? 'W' : 'L'}</span></td>
          <td><div class="mini-hero">${heroImgByName(e.hero) ? `<img src="${heroImgByName(e.hero)}" alt="">` : ''}<div><b>${esc(e.hero || '—')}</b>${e.kda ? ` <span class="dim">${esc(e.kda)}</span>` : ''}${e.note ? `<div class="muted" style="font-size:12px">${esc(e.note)}</div>` : ''}</div></div></td>
          <td class="hide-m muted">${esc((e.pos || '').split(' — ')[0] || '—')}</td>
          <td><b class="${e.result === 'W' ? 'pos' : 'neg'}">${e.result === 'W' ? '+' : '−'}${e.delta}</b></td>
          <td>${e.after}</td>
          <td class="hide-m muted">${fmtDate(e.date)}</td>
          <td style="white-space:nowrap"><button class="icon-btn" data-edit>${ic('edit')}</button><button class="icon-btn danger" data-del>${ic('trash')}</button></td>
        </tr>`).join('')}</tbody></table></div>` : '<div class="empty"><div class="big">📈</div>Запиши первую игру — и здесь появится твоя история.</div>'}
      </div>
      <div class="stack">
        <div class="card">
          <div class="card-head"><h3>Мои герои</h3></div>
          <div class="list">${heroes.map(x => `<div class="session"><div class="mini-hero">${heroImgByName(x.n) ? `<img src="${heroImgByName(x.n)}" alt="">` : ''}</div><div class="body"><b>${esc(x.n)}</b><div class="meta">${x.g} ${plural(x.g, 'игра', 'игры', 'игр')} · WR ${pct(x.w / x.g * 100, 0)}</div></div><b class="${x.d >= 0 ? 'pos' : 'neg'}">${sign(x.d)}</b></div>`).join('') || '<div class="muted">Указывай героя при записи игры.</div>'}</div>
        </div>
        <div class="card">
          <div class="card-head"><h3>По позициям</h3></div>
          <div class="list">${POS.filter(p => byPos[p]).map(p => { const x = byPos[p], wr = x.w / x.g * 100; return `<div><div class="row" style="justify-content:space-between;font-size:13px"><span>${p}</span><span><b class="${wr >= 50 ? 'pos' : 'neg'}">${pct(wr, 0)}</b> <span class="dim">· ${x.g}</span></span></div><div class="progress" style="margin-top:6px"><i style="width:${wr}%;${wr < 50 ? 'background:linear-gradient(90deg,var(--red),#ff8a5c)' : ''}"></i></div></div>`; }).join('') || '<div class="muted">Указывай позицию при записи игры.</div>'}</div>
        </div>
      </div>
    </div>
  </div>`;

  const cv = $('#mChart');
  cv._draw = () => drawLine(cv, [+db.startMmr, ...m.s.map(e => e.after)], ['старт', ...m.s.map(e => fmtDate(e.date))]);
  requestAnimationFrame(cv._draw);

  $$('.wl button', el).forEach(b => b.onclick = () => { quickRes = b.dataset.r; $$('.wl button', el).forEach(x => x.classList.toggle('on', x === b)); });
  $('#qForm').onsubmit = ev => {
    ev.preventDefault();
    const d = Object.fromEntries(new FormData(ev.target).entries());
    d.result = quickRes; d.delta = Math.abs(+d.delta || 0); d.date = d.date || today();
    db.mmr.push({ id: uid(), ...d }); save();
    toast(d.result === 'W' ? `Победа! +${d.delta} 🏆` : `Поражение −${d.delta}. Разбери реплей 💪`);
    rerender();
  };
  $('#mAdd').onclick = () => openGameModal();
  $('#mStart').onclick = () => openModal('Стартовый ПТС', [{ name: 'startMmr', label: 'С какого ПТС ты начинаешь вести дневник', type: 'number', value: db.startMmr, full: true, required: true }], d => { db.startMmr = +d.startMmr || 0; save(); rerender(); });
  $$('tr[data-id]', el).forEach(tr => {
    const e = db.mmr.find(x => x.id === tr.dataset.id);
    $('[data-edit]', tr).onclick = () => openGameModal(e);
    $('[data-del]', tr).onclick = async () => { if (await askConfirm('Удалить запись игры?')) { db.mmr = db.mmr.filter(x => x !== e); save(); rerender(); } };
  });
}

/* ============================================================
   ТРЕНИРОВКИ
   ============================================================ */
function openTrainModal(t = {}) {
  openModal(t.id ? 'Редактировать тренировку' : 'Новая тренировка', [
    { name: 'type', label: 'Тип', type: 'select', value: t.type || 'lasthit', options: Object.entries(TRAIN_TYPES).map(([k, v]) => [k, v.e + ' ' + v.n]) },
    { name: 'minutes', label: 'Длительность (мин)', type: 'number', value: t.minutes ?? 30, min: 1, required: true },
    { name: 'date', label: 'Дата', type: 'date', value: t.date || today(), required: true },
    { name: 'hero', label: 'Герой (если есть)', type: 'hero', value: t.hero || '' },
    { name: 'focus', label: 'Фокус', full: true, value: t.focus || '', ph: 'Например: добить 80+ крипов к 10 минуте', required: true },
    { name: 'rating', label: 'Оценка сессии', type: 'stars', value: t.rating || 4, full: true },
    { name: 'note', label: 'Что понял / что улучшить', type: 'textarea', full: true, rows: 3, value: t.note || '' },
  ], d => {
    d.minutes = +d.minutes || 0; d.rating = +d.rating || 0;
    if (t.id) Object.assign(db.trainings.find(x => x.id === t.id), d); else db.trainings.push({ id: uid(), ...d });
    save(); toast('Тренировка записана 💪'); rerender();
  });
}
function renderTraining(el) {
  setActions(`<button class="btn btn-primary" id="tAdd">${ic('plus')}Тренировка</button>`);
  const streak = trainStreak();
  const mins = minutesByDay();
  const total = db.trainings.reduce((a, t) => a + (+t.minutes || 0), 0);
  // heatmap: 18 weeks ending this week
  const now = new Date(); const dow = (now.getDay() + 6) % 7;
  const start = addDays(today(), -dow - 7 * 17);
  const cells = [];
  for (let i = 0; i < 18 * 7; i++) {
    const d = addDays(start, i); if (d > today()) { cells.push('<i style="visibility:hidden"></i>'); continue; }
    const v = mins[d] || 0, l = v === 0 ? 0 : v < 20 ? 1 : v < 45 ? 2 : v < 90 ? 3 : 4;
    cells.push(`<i class="l${l} ${d === today() ? 'today' : ''}" title="${fmtDate(d)}: ${v} мин"></i>`);
  }
  const byType = {};
  db.trainings.forEach(t => byType[t.type] = (byType[t.type] || 0) + (+t.minutes || 0));
  const maxType = Math.max(1, ...Object.values(byType));
  const list = db.trainings.slice().sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const checks = db.checks[today()] || [];

  el.innerHTML = `
  <div class="stack">
    <div class="grid g4">
      <div class="card kpi" style="--accent:var(--red)"><div class="lbl">${ic('fire')}Серия</div><div class="val">${streak}</div><div class="hint">${plural(streak, 'день', 'дня', 'дней')} подряд</div></div>
      <div class="card kpi" style="--accent:var(--blue)"><div class="lbl">${ic('clock')}Всего времени</div><div class="val">${Math.floor(total / 60)}ч ${total % 60}м</div><div class="hint">${db.trainings.length} ${plural(db.trainings.length, 'сессия', 'сессии', 'сессий')}</div></div>
      <div class="card kpi" style="--accent:var(--gold)"><div class="lbl">Активных дней</div><div class="val">${activeDays().size}</div><div class="hint">за всё время</div></div>
      <div class="card kpi" style="--accent:var(--green)"><div class="lbl">Рутина сегодня</div><div class="val">${checks.length}/${db.routine.length}</div><div class="hint">${checks.length >= db.routine.length && db.routine.length ? 'Выполнено ✓' : 'Осталось ' + (db.routine.length - checks.length)}</div></div>
    </div>

    <div class="card">
      <div class="card-head"><div><h3>Карта активности</h3><div class="sub">Последние 18 недель · рутина + тренировки</div></div>
        <div class="legend">меньше <i style="background:var(--panel3)"></i><i style="background:rgba(228,67,47,.3)"></i><i style="background:rgba(228,67,47,.55)"></i><i style="background:rgba(228,67,47,.8)"></i><i style="background:#ff6a4d"></i> больше</div></div>
      <div class="heat">${cells.join('')}</div>
    </div>

    <div class="grid g-main">
      <div class="card">
        <div class="card-head"><h3>Журнал тренировок</h3></div>
        <div class="list">${list.map(t => { const ty = TRAIN_TYPES[t.type] || TRAIN_TYPES.theory; return `
          <div class="session" data-id="${t.id}">
            <div class="type-ic" style="background:${ty.c}22;color:${ty.c}">${ty.e}</div>
            <div class="body"><b>${esc(t.focus)}</b><div class="meta">${ty.n} · ${t.minutes} мин · ${fmtDate(t.date)}${t.hero ? ' · ' + esc(t.hero) : ''} <span class="stars">${'★'.repeat(t.rating || 0)}</span></div>${t.note ? `<div class="meta" style="margin-top:4px;color:#c8c4bd;white-space:pre-wrap">${esc(t.note)}</div>` : ''}</div>
            <button class="icon-btn" data-edit>${ic('edit')}</button><button class="icon-btn danger" data-del>${ic('trash')}</button>
          </div>`; }).join('') || '<div class="empty"><div class="big">🏋️</div>Запиши первую тренировку: ласт-хит, разбор реплея, механика…</div>'}</div>
      </div>
      <div class="stack">
        <div class="card">
          <div class="card-head"><h3>Дневная рутина</h3><button class="btn btn-ghost btn-sm" id="rEdit">${ic('edit')}Изменить</button></div>
          <div class="list">${routineHtml()}</div>
        </div>
        <div class="card">
          <div class="card-head"><h3>Время по типам</h3></div>
          <div class="list">${Object.entries(TRAIN_TYPES).filter(([k]) => byType[k]).map(([k, v]) => `<div><div class="row" style="justify-content:space-between;font-size:13px"><span>${v.e} ${v.n}</span><b>${byType[k]} мин</b></div><div class="progress" style="margin-top:6px"><i style="width:${byType[k] / maxType * 100}%;background:${v.c}"></i></div></div>`).join('') || '<div class="muted">Пока нет данных</div>'}</div>
        </div>
      </div>
    </div>
  </div>`;

  $('#tAdd').onclick = () => openTrainModal();
  bindRoutine(el);
  $('#rEdit').onclick = () => openModal('Дневная рутина', [{ name: 'r', label: 'Каждый пункт с новой строки', type: 'textarea', rows: 7, full: true, value: db.routine.join('\n') }], d => {
    db.routine = d.r.split('\n').map(s => s.trim()).filter(Boolean); db.checks[today()] = []; save(); rerender();
  });
  $$('.session[data-id]', el).forEach(c => {
    const t = db.trainings.find(x => x.id === c.dataset.id);
    $('[data-edit]', c).onclick = () => openTrainModal(t);
    $('[data-del]', c).onclick = async () => { if (await askConfirm('Удалить тренировку?')) { db.trainings = db.trainings.filter(x => x !== t); save(); rerender(); } };
  });
}

/* ============================================================
   НАБЛЮДЕНИЯ
   ============================================================ */
const notesUI = { q: '', cat: '' };
function openNoteModal(n = {}) {
  openModal(n.id ? 'Редактировать запись' : 'Новое наблюдение', [
    { name: 'title', label: 'Заголовок', full: true, value: n.title || '', ph: 'Например: Против Bristleback не собирать Радиант', required: true },
    { name: 'cat', label: 'Категория', type: 'select', value: n.cat || 'insight', options: Object.entries(NOTE_CATS).map(([k, v]) => [k, v.n]) },
    { name: 'hero', label: 'Герой (необязательно)', type: 'hero', value: n.hero || '' },
    { name: 'text', label: 'Текст', type: 'textarea', full: true, rows: 6, value: n.text || '', ph: 'Что заметил, почему это важно, что делать в следующий раз…' },
    { name: 'tags', label: 'Теги через запятую', full: true, value: (n.tags || []).join(', '), ph: 'варды, тайминги, тильт' },
  ], d => {
    d.tags = d.tags.split(',').map(s => s.trim()).filter(Boolean);
    if (n.id) Object.assign(db.notes.find(x => x.id === n.id), d); else db.notes.push({ id: uid(), date: today(), pinned: false, ...d });
    save(); toast('Запись сохранена ✍️'); rerender();
  });
}
function renderNotes(el) {
  setActions(`<button class="btn btn-primary" id="nAdd">${ic('plus')}Новая запись</button>`);
  el.innerHTML = `
    <div class="stack">
      <div class="card"><div class="row">
        <label class="search">${ic('search')}<input class="input" id="nQ" placeholder="Поиск по записям, героям, тегам…" value="${esc(notesUI.q)}"></label>
        <div class="chips" id="nCat"><button class="chip ${!notesUI.cat ? 'on' : ''}" data-c="">Все</button>${Object.entries(NOTE_CATS).map(([k, v]) => `<button class="chip ${notesUI.cat === k ? 'on' : ''}" data-c="${k}">${v.n}</button>`).join('')}</div>
      </div></div>
      <div id="nGrid"></div>
    </div>`;
  const draw = () => {
    const q = notesUI.q.trim().toLowerCase();
    const list = db.notes.filter(n => (!notesUI.cat || n.cat === notesUI.cat) && (!q || [n.title, n.text, n.hero, ...(n.tags || [])].join(' ').toLowerCase().includes(q)))
      .sort((a, b) => (b.pinned - a.pinned) || b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    $('#nGrid').innerHTML = list.length ? `<div class="notes-grid">${list.map(n => {
      const c = NOTE_CATS[n.cat] || NOTE_CATS.other;
      return `<div class="note ${n.pinned ? 'pinned' : ''}" style="--c:${c.c}" data-id="${n.id}">
        <div class="acts"><button class="icon-btn" data-pin title="Закрепить" style="${n.pinned ? 'color:var(--gold)' : ''}">${ic('pin')}</button><button class="icon-btn" data-edit>${ic('edit')}</button><button class="icon-btn danger" data-del>${ic('trash')}</button></div>
        <span class="cat">${c.n}</span>
        <h4>${esc(n.title)}</h4>
        ${n.text ? `<div class="text">${esc(n.text)}</div>` : ''}
        <div class="foot">${n.hero ? `<span class="tag">${heroImgByName(n.hero) ? `<img src="${heroImgByName(n.hero)}" style="width:22px;height:13px;border-radius:2px;object-fit:cover">` : ''}${esc(n.hero)}</span>` : ''}${(n.tags || []).map(t => `<span class="tag">#${esc(t)}</span>`).join('')}<span class="spacer"></span>${fmtDate(n.date)}</div>
      </div>`;
    }).join('')}</div>` : `<div class="card empty"><div class="big">📝</div>${db.notes.length ? 'Ничего не найдено' : 'Здесь будут твои наблюдения: ошибки, инсайты, матчапы. Пиши после каждой важной игры.'}</div>`;
    $$('.note', el).forEach(c => {
      const n = db.notes.find(x => x.id === c.dataset.id);
      $('[data-pin]', c).onclick = () => { n.pinned = !n.pinned; save(); draw(); };
      $('[data-edit]', c).onclick = () => openNoteModal(n);
      $('[data-del]', c).onclick = async () => { if (await askConfirm('Удалить запись?')) { db.notes = db.notes.filter(x => x !== n); save(); rerender(); } };
    });
  };
  $('#nAdd').onclick = () => openNoteModal();
  $('#nQ').oninput = e => { notesUI.q = e.target.value; draw(); };
  $$('#nCat .chip').forEach(c => c.onclick = () => { notesUI.cat = c.dataset.c; $$('#nCat .chip').forEach(x => x.classList.toggle('on', x === c)); draw(); });
  draw();
}

/* ============================================================
   ЦЕЛИ
   ============================================================ */
function renderGoals(el) {
  const open = db.goals.filter(g => !g.done), done = db.goals.filter(g => g.done);
  const p = db.goals.length ? done.length / db.goals.length * 100 : 0;
  const goalHtml = g => `<div class="goal ${g.done ? 'done' : ''}" data-id="${g.id}"><span class="box" data-t></span><span class="t">${esc(g.text)}${g.deadline ? ` <span class="tag">до ${fmtDate(g.deadline)}</span>` : ''}</span><button class="icon-btn danger" data-del>${ic('trash')}</button></div>`;
  el.innerHTML = `
    <div class="stack">
      <div class="card">
        <div class="card-head"><div><h3>Прогресс целей</h3><div class="sub">${done.length} из ${db.goals.length} выполнено</div></div><b style="font-family:'Exo 2';font-size:22px">${Math.round(p)}%</b></div>
        <div class="progress"><i style="width:${p}%"></i></div>
        <form class="row" id="gForm" style="margin-top:18px">
          <input class="input" name="text" placeholder="Новая цель: «Апнуть 4000 ПТС», «80 крипов к 10 мин на Антимаге»…" style="flex:3;min-width:220px" required>
          <input class="input" type="date" name="deadline" style="flex:1;min-width:150px" title="Дедлайн (необязательно)">
          <button class="btn btn-primary">${ic('plus')}Добавить</button>
        </form>
      </div>
      <div class="grid g2">
        <div class="card"><div class="card-head"><h3>В процессе</h3><span class="sub">${open.length}</span></div><div class="list">${open.map(goalHtml).join('') || '<div class="muted">Нет активных целей</div>'}</div></div>
        <div class="card"><div class="card-head"><h3>Выполнено 🏆</h3><span class="sub">${done.length}</span></div><div class="list">${done.map(goalHtml).join('') || '<div class="muted">Пока ничего — всё впереди</div>'}</div></div>
      </div>
    </div>`;
  $('#gForm').onsubmit = e => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target).entries()); db.goals.push({ id: uid(), text: d.text.trim(), deadline: d.deadline, done: false }); save(); rerender(); };
  $$('.goal', el).forEach(c => {
    const g = db.goals.find(x => x.id === c.dataset.id);
    $('[data-t]', c).onclick = () => { g.done = !g.done; if (g.done) toast('Цель выполнена 🏆'); save(); rerender(); };
    $('[data-del]', c).onclick = async () => { if (await askConfirm('Удалить цель?')) { db.goals = db.goals.filter(x => x !== g); save(); rerender(); } };
  });
}

/* ============================================================
   НАСТРОЙКИ
   ============================================================ */
function renderSettings(el) {
  el.innerHTML = `
  <div class="grid g2">
    <div class="card">
      <div class="card-head"><h3>Профиль</h3></div>
      <form id="sForm" class="form-grid">
        ${fieldHtml({ name: 'nick', label: 'Ник', value: db.nick, ph: 'Как к тебе обращаться' })}
        ${fieldHtml({ name: 'startMmr', label: 'Стартовый ПТС', type: 'number', value: db.startMmr })}
        ${fieldHtml({ name: 'bracket', label: 'Твой ранг (для меты)', type: 'select', value: db.bracket, options: BRACKETS.map(b => [b.v, b.n]), full: true })}
        <div class="full"><button class="btn btn-primary">Сохранить</button></div>
      </form>
    </div>
    <div class="card">
      <div class="card-head"><h3>Данные</h3></div>
      <p class="muted" style="margin-top:0">Все записи хранятся локально в этом браузере. Делай резервную копию, чтобы не потерять дневник.</p>
      <div class="row">
        <button class="btn btn-gold" id="sExport">Экспорт в JSON</button>
        <label class="btn btn-ghost">Импорт из JSON<input type="file" accept=".json,application/json" id="sImport" hidden></label>
      </div>
      <div class="row" style="margin-top:16px">
        <button class="btn btn-ghost" id="sCache">Очистить кэш OpenDota</button>
        <button class="btn btn-ghost" id="sWipe" style="color:var(--red)">Удалить все записи</button>
      </div>
      <p class="dim" style="font-size:12px;margin-bottom:0">Записей: игр ${db.mmr.length}, тренировок ${db.trainings.length}, наблюдений ${db.notes.length}, билдов ${Object.values(db.builds).reduce((a, b) => a + b.length, 0)}, целей ${db.goals.length}.</p>
      <p class="dim" style="font-size:12px;margin-bottom:0">Версия D2Helper: ${VERSION}</p>
    </div>
  </div>`;
  $('#sForm').onsubmit = e => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target).entries()); db.nick = d.nick.trim(); db.startMmr = +d.startMmr || 0; db.bracket = d.bracket; save(); toast('Сохранено'); };
  $('#sExport').onclick = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `d2helper-backup-${today()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $('#sImport').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    f.text().then(async t => { const d = JSON.parse(t); if (!await askConfirm('Заменить текущие данные данными из файла?', 'Заменить')) return; db = Object.assign(defaults(), d); if (db.bracket === '8') db.bracket = '7'; save(); toast('Данные импортированы'); rerender(); })
      .catch(() => toast('Файл не похож на резервную копию D2Helper'));
  };
  $('#sCache').onclick = () => { Object.keys(localStorage).filter(k => k.startsWith('d2h_')).forEach(k => localStorage.removeItem(k)); HEROES = null; ITEMS = null; toast('Кэш очищен'); loadHeroes(true); };
  $('#sWipe').onclick = async () => { if (await askConfirm('Точно удалить ВСЕ записи дневника: игры, тренировки, наблюдения, руководства и цели? Это нельзя отменить.', 'Удалить всё')) { db = defaults(); save(); toast('Дневник очищен'); rerender(); } };
}

/* ---------- init ---------- */
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => { });
}
$('#refreshMeta').onclick = () => loadHeroes(true).then(ok => { if (ok && CURRENT && ['meta', 'builds', 'dashboard'].includes(CURRENT.name)) rerender(); });
route();
loadHeroes();
