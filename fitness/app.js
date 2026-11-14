'use strict';
/* 彈力帶訓練：狀態、路由、各頁面。資料全部存在 localStorage，不連任何外部服務。 */

const KEY = 'bandfit:data';
const $ = (s, r = document) => r.querySelector(s);
const view = $('#view');
const modalEl = $('#modal');
const toastEl = $('#toast');
const restbar = $('#restbar');

/* ---------- 小工具 ---------- */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const dayDiff = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 864e5);
const WD = '日一二三四五六';
const fmtDate = s => { const d = parseYmd(s); return `${d.getMonth() + 1}/${d.getDate()}（${WD[d.getDay()]}）`; };
const shortDate = s => { const d = parseYmd(s); return `${d.getMonth() + 1}/${d.getDate()}`; };
const mmss = sec => `${Math.floor(sec / 60)}:${pad(sec % 60)}`;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const weekStart = d => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const bandLabel = kg => (BANDS.find(b => b.kg === kg) || { label: kg + ' kg 帶子' }).label;
/* 訓練代號：'A'、'AC'（同一天做兩套）這種字母組合，或 'free'（自選）、'menu'（菜單）。
   可以傳代號，或整筆訓練紀錄（菜單要顯示名稱） */
const isLetters = p => typeof p === 'string' && p !== 'free' && p !== 'menu';
const planKeys = () => Object.keys(state.plans).sort();
const planLabel = s => {
  const p = typeof s === 'string' ? s : s.plan;
  if (p === 'free') return '自選訓練';
  if (p === 'menu') return '菜單「' + ((s && s.title) || '未命名') + '」';
  return '訓練日 ' + String(p).split('').join('＋');
};
const exPreset = ex => ({ exId: ex.id, band: ex.band, sets: ex.sets, min: ex.min, max: ex.max });
const exMeta = ex => `${ex.band} kg · ${ex.sets} 組 × ${ex.min}–${ex.max} 下`;
const rirLabel = r => r === 3 ? '3 以上' : String(r);

/* ---------- 狀態 ---------- */
function freshState() {
  return {
    version: 4,
    settings: clone(DEFAULT_SETTINGS),
    tabata: clone(DEFAULT_TABATA),
    exercises: clone(DEFAULT_EXERCISES),
    plans: clone(DEFAULT_PLANS),
    routines: clone(DEFAULT_ROUTINES),
    sessions: [],
    active: null
  };
}

function normalize(d) {
  const s = freshState();
  if (!d || typeof d !== 'object') return s;
  if (d.settings && typeof d.settings === 'object') s.settings = { ...s.settings, ...d.settings };
  if (d.tabata && typeof d.tabata === 'object') s.tabata = { ...s.tabata, ...d.tabata };
  /* 第 1 版的資料：Tabata 還是舊預設（2 輪、輪間休息 60 秒）就換成影片的 4 輪、30 秒 */
  if ((d.version || 1) < 2 && s.tabata.rounds === 2 && s.tabata.roundRest === 60) {
    s.tabata.rounds = DEFAULT_TABATA.rounds;
    s.tabata.roundRest = DEFAULT_TABATA.roundRest;
  }
  if (!Array.isArray(s.tabata.moves) || JSON.stringify(s.tabata.moves) === JSON.stringify(OLD_TABATA_MOVES)) s.tabata.moves = clone(DEFAULT_TABATA.moves);
  if (Array.isArray(d.exercises) && d.exercises.length) s.exercises = d.exercises;
  /* 舊資料沒有「詳細姿勢」：內建動作補上預設內容，自訂動作補空清單 */
  s.exercises.forEach(e => {
    if (!Array.isArray(e.details)) {
      const def = DEFAULT_EXERCISES.find(x => x.id === e.id);
      e.details = def ? clone(def.details) : [];
    }
  });
  /* 第 3 版加了更多內建動作：舊資料補進來一次（之後自己刪掉的不會再出現） */
  if ((d.version || 1) < 3 && Array.isArray(d.exercises) && d.exercises.length) {
    DEFAULT_EXERCISES.forEach(x => { if (!s.exercises.some(e => e.id === x.id)) s.exercises.push(clone(x)); });
  }
  /* 每個動作都要有部位和建議的帶子、組數、次數（自選訓練用） */
  const GENERIC = { band: 5, sets: 3, min: 10, max: 15 };
  s.exercises.forEach(e => {
    const def = DEFAULT_EXERCISES.find(x => x.id === e.id);
    if (typeof e.group !== 'string') e.group = def ? def.group : '其他';
    Object.keys(GENERIC).forEach(k => { if (typeof e[k] !== 'number') e[k] = def ? def[k] : GENERIC[k]; });
  });
  if (Array.isArray(d.routines)) s.routines = d.routines.filter(r => r && Array.isArray(r.items));
  if (d.plans && typeof d.plans === 'object' && Object.keys(d.plans).length && Object.values(d.plans).every(p => p && Array.isArray(p.items))) {
    s.plans = d.plans;
    /* 第 4 版加了訓練日 C 到 F：舊資料補進來一次 */
    if ((d.version || 1) < 4) Object.keys(DEFAULT_PLANS).forEach(k => { if (!s.plans[k]) s.plans[k] = clone(DEFAULT_PLANS[k]); });
  }
  if (Array.isArray(d.sessions)) s.sessions = d.sessions.filter(x => x && Array.isArray(x.items) && typeof x.date === 'string');
  if (d.active && Array.isArray(d.active.items) && d.active.items.length) s.active = d.active;
  /* 第 4 版把自選和菜單的代號從 F、M 改成 free、menu，讓字母留給訓練日 */
  if ((d.version || 1) < 4) [...s.sessions, s.active].forEach(x => {
    if (x && x.plan === 'F') x.plan = 'free';
    else if (x && x.plan === 'M') x.plan = 'menu';
  });
  return s;
}

function load() {
  try { return normalize(JSON.parse(localStorage.getItem(KEY))); } catch (e) { return freshState(); }
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { toast('儲存失敗：瀏覽器的儲存空間無法寫入'); }
}

let state = load();

const exById = id => state.exercises.find(e => e.id === id);
const sessionsAsc = () => [...state.sessions].sort((a, b) => a.startedAt - b.startedAt);
const itemReps = it => it.sets.reduce((n, s) => n + (s.done ? (s.reps || 0) : 0), 0);
const itemDone = it => it.sets.filter(s => s.done).length;

function applySettings() {
  const t = state.settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  Device.setOptions(state.settings);
}

/* ---------- 推薦與進階判斷 ---------- */
/* 每個訓練日最近一次是哪天做的 */
function lastDoneMap() {
  const last = {};
  sessionsAsc().forEach(s => { if (isLetters(s.plan)) s.plan.split('').forEach(k => { last[k] = s.date; }); });
  return last;
}

/* 一套訓練日練到哪些部位 */
function planFocus(k) {
  const set = new Set();
  state.plans[k].items.forEach(it => { const ex = exById(it.exId); if (ex) set.add(ex.group); });
  return set;
}

/* 推薦搭配：先挑最久沒練的一套，再搭一套部位不重疊、也是最久沒練的 */
function pickPair(last) {
  const keys = planKeys().filter(k => state.plans[k].items.some(it => exById(it.exId)));
  if (!keys.length) return [];
  const age = k => last[k] || '';
  const order = [...keys].sort((x, y) => age(x) < age(y) ? -1 : age(x) > age(y) ? 1 : x < y ? -1 : 1);
  const main = order[0], f = planFocus(main);
  const partner = order.slice(1).find(k => ![...planFocus(k)].some(g => f.has(g)));
  return partner ? [main, partner].sort() : [main];
}

const pairLabel = ks => ks.join('＋');
const pairTitle = ks => ks.map(k => state.plans[k].title).join(' ＋ ');

function recommend() {
  const all = sessionsAsc();
  const last = all[all.length - 1];
  const today = ymd(new Date());
  const ws = weekStart(new Date());
  const weekCount = all.filter(s => parseYmd(s.date) >= ws).length;
  const letters = pickPair(lastDoneMap());
  const name = pairLabel(letters);
  if (!last) return { letters, note: `還沒有訓練紀錄，從訓練日 ${name} 開始。`, weekCount };
  const gap = dayDiff(last.date, today);
  const lp = planLabel(last);
  let note;
  if (gap <= 0) note = `今天已經練過${lp}了。下一次是訓練日 ${name}，中間至少隔一天。`;
  else if (gap === 1) note = `昨天剛練過${lp}，今天建議休息；明天再練訓練日 ${name}。`;
  else note = `上次是 ${fmtDate(last.date)}的${lp}，已經隔了 ${gap} 天，今天練訓練日 ${name}。`;
  return { letters, note, weekCount, rest: gap <= 1 };
}

/* 所有組都做完、都到次數上限、餘力都在 2 下以內 */
function canProgress(it) {
  return it.sets.length > 0 && it.sets.length >= (it.targetSets || 1) &&
    it.sets.every(s => s.done && s.reps >= it.max && s.rir != null && s.rir <= 2);
}

function lastItem(exId) {
  const all = sessionsAsc();
  for (let i = all.length - 1; i >= 0; i--) {
    const it = all[i].items.find(x => x.exId === exId && itemDone(x) > 0);
    if (it) return { item: it, session: all[i] };
  }
  return null;
}

function progressHint(exId, band, max) {
  const l = lastItem(exId);
  return l && canProgress(l.item) && l.item.band === band && l.item.max === max ? l : null;
}

/* ---------- 對話框與提示 ---------- */
let modalResolve = null;
function openModal(html) {
  modalEl.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  modalEl.hidden = false;
}
function closeModal(result) {
  modalEl.hidden = true;
  modalEl.innerHTML = '';
  const r = modalResolve;
  modalResolve = null;
  if (r) r(result);
}
function confirmBox({ title, body = '', ok = '確定', cancel = '取消', danger = false }) {
  return new Promise(res => {
    openModal(`<h2>${esc(title)}</h2>${body ? `<p>${esc(body)}</p>` : ''}
      <div class="sheet-btns">
        <button type="button" class="btn ${danger ? 'danger' : 'primary'}" data-act="mOk">${esc(ok)}</button>
        <button type="button" class="btn" data-act="mCancel">${esc(cancel)}</button>
      </div>`);
    modalResolve = res;
  });
}
let toastTimer = null;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2600);
}

/* ---------- 路由 ---------- */
const VIEWS = {};
let current = 'home';
function routeName() {
  const n = location.hash.replace(/^#\/?/, '');
  return VIEWS[n] ? n : 'home';
}
function render() { VIEWS[current](); }
function route() {
  let name = routeName();
  if (name === 'workout' && !state.active) { location.replace('#/'); return; }
  if (current === 'tabata' && name !== 'tabata') tabataStop(true);
  current = name;
  document.body.dataset.route = name;
  document.querySelectorAll('#tabs a').forEach(a => {
    if (a.dataset.tab === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  restbar.hidden = !(name === 'workout' && rest.timer);
  Device.keepAwake(name === 'workout' || tb.running);
  render();
  window.scrollTo(0, 0);
}

/* ---------- 本週日程與建議時間 ---------- */
const WEEK = '一二三四五六日';
const daysOf = k => Array.isArray(state.settings[k]) ? state.settings[k] : [];

/* 訓練日大約要多久：每組約 45 秒＋組間休息，每換一個動作多 45 秒，四捨五入到 5 分鐘 */
function planMinutes(key) {
  const its = Array.isArray(key) ? key : state.plans[key].items;
  const sets = its.reduce((n, it) => n + it.sets, 0);
  const sec = sets * (45 + state.settings.restSec) + its.length * 45;
  return Math.max(5, Math.round(sec / 300) * 5);
}

/* 本週七天：已經練的照紀錄顯示；今天以後的彈力帶日，照推薦的搭配一天一天往下排 */
function weekSchedule() {
  const all = sessionsAsc();
  const ws = weekStart(new Date());
  const today = ymd(new Date());
  const band = daysOf('bandDays'), tabata = daysOf('tabataDays');
  const last = lastDoneMap();
  const out = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(ws); dt.setDate(dt.getDate() + i);
    const key = ymd(dt);
    const prev = new Date(dt); prev.setDate(prev.getDate() - 1);
    const done = all.filter(s => s.date === key).map(s => s.plan === 'free' ? '自' : s.plan === 'menu' ? '菜' : s.plan);
    const cell = { i, date: dt.getDate(), today: key === today, past: key < today, done, plan: null, missed: false, tabata: tabata.includes(i) };
    if (!done.length && band.includes(i)) {
      if (key < today) cell.missed = true;
      else if (!all.some(s => s.date === ymd(prev))) {
        const pair = pickPair(last);
        cell.plan = pair.join('');
        pair.forEach(k => { last[k] = key; });
      }
    }
    out.push(cell);
  }
  return out;
}

/* 合併幾套訓練日的動作；同一個動作出現兩次只留第一次 */
function mergedItems(letters) {
  const seen = new Set(), out = [];
  letters.forEach(k => (state.plans[k] ? state.plans[k].items : []).forEach(it => {
    if (exById(it.exId) && !seen.has(it.exId)) { seen.add(it.exId); out.push(it); }
  }));
  return out;
}

function lengthTip() {
  const keys = planKeys().filter(k => state.plans[k].items.length);
  if (!keys.length) return '';
  const mins = keys.map(k => planMinutes(k));
  const lo = Math.min(...mins), hi = Math.max(...mins);
  const rec = recommend().letters;
  return `單做一套約 ${lo === hi ? lo : lo + ' 到 ' + hi} 分鐘${rec.length > 1 ? `，今天建議的 ${pairLabel(rec)} 兩套一起約 ${planMinutes(mergedItems(rec))} 分鐘` : ''}（含組間休息）；`;
}

function scheduleHtml() {
  const s = state.settings;
  const band = daysOf('bandDays');
  const consecutive = band.some(i => band.includes((i + 1) % 7));
  const cells = weekSchedule().map(c => {
    const tags = [];
    c.done.forEach(p => tags.push(`<span class="wk-tag done">${esc(p)} ✓</span>`));
    if (c.plan) tags.push(`<span class="wk-tag plan">${c.plan}</span>`);
    if (c.missed) tags.push('<span class="wk-tag off">—</span>');
    if (c.tabata && !c.past) tags.push('<span class="wk-tag tb">T</span>');
    if (!tags.length) tags.push('<span class="wk-tag off">休</span>');
    return `<div class="wk ${c.today ? 'today' : ''} ${c.past ? 'past' : ''}"><span class="wk-n">${WEEK[c.i]}</span><span class="wk-d">${c.date}</span>${tags.join('')}</div>`;
  }).join('');
  const dayList = k => daysOf(k).slice().sort().map(i => WEEK[i]).join('、');
  return `<section class="card">
    <h2>本週日程</h2>
    <div class="week">${cells}</div>
    <p class="sub">字母＝彈力帶訓練日（兩個字母是同一天做兩套）　T＝Tabata（選做）　休＝休息　✓＝已完成</p>
    <p class="note">目前排的是：彈力帶在星期${dayList('bandDays') || '（還沒選）'}${daysOf('tabataDays').length ? `，Tabata 在星期${dayList('tabataDays')}` : ''}。做哪幾套會照你實際練到哪裡往下排。</p>
    ${consecutive ? '<div class="hintbox">你排的彈力帶日有連續兩天。同樣的肌群最好中間隔一天，建議到設定頁調整。</div>' : ''}
    <h3>建議訓練時間</h3>
    <ul class="plain tips">
      <li>每次長度：${lengthTip()}Tabata 約 ${Math.ceil(tabataTotal() / 60)} 分鐘。</li>
      <li>${s.trainTime ? `你設定的固定時段是 ${esc(s.trainTime)}。` : ''}早上練或晚上練，效果差不多；重點是選一個每週都排得進去的固定時段。</li>
      <li>Tabata 這類高強度運動，盡量在睡前 2 小時以前做完，比較不會影響睡眠。</li>
      <li>剛吃飽不要馬上練，等肚子不脹了再開始。</li>
    </ul>
    <a class="btn small" href="#/settings">改日程與時間</a>
  </section>`;
}

/* ---------- 首頁 ---------- */
let homeMode = 'plan';      // 首頁目前選的是：plan（訓練日）、menu（菜單）、free（自選）
let pickLetters = null;     // 手動選的訓練日字母；null 代表照推薦
const currentLetters = () => (pickLetters || recommend().letters).filter(k => state.plans[k]).sort();
let chosenRoutine = null;   // 首頁「菜單」選中的那一份
const routineById = id => state.routines.find(r => r.id === id);
function currentRoutine() { return routineById(chosenRoutine) || state.routines[0] || null; }

function routineListHtml() {
  if (!state.routines.length) return '<p class="muted">還沒有菜單，請到設定頁新增。</p>';
  const cur = currentRoutine();
  return '<p class="sub">訓練日以外的現成組合。做這些不會影響訓練日的推薦順序。</p>' + state.routines.map(r => {
    const on = r === cur;
    return `<div class="rt ${on ? 'on' : ''}">
      <button type="button" class="rt-main" data-act="pickRoutine" data-id="${esc(r.id)}" aria-pressed="${on}">
        <span class="pl-name">${esc(r.title)}</span>
        <span class="pl-meta">${r.items.length} 個動作 · 約 ${planMinutes(r.items)} 分鐘</span>
        ${r.note ? `<span class="rt-note">${esc(r.note)}</span>` : ''}
      </button>
      ${on ? planListHtml(r.items) : ''}
    </div>`;
  }).join('');
}

let freePick = [];   // 自選訓練勾選的動作 id，依勾選順序

function freeListHtml() {
  freePick = freePick.filter(id => exById(id));
  return '<p class="sub">勾選想做的動作，會照勾選的順序排。帶子和次數是建議值，訓練時照實際做的填。</p>' +
    GROUPS.map(g => {
      const list = state.exercises.filter(e => e.group === g);
      if (!list.length) return '';
      return `<h3>${esc(g)}</h3>` + list.map(e => {
        const k = freePick.indexOf(e.id);
        return `<div class="fx">
          <button type="button" class="fx-main" data-act="freeToggle" data-id="${esc(e.id)}" aria-pressed="${k >= 0}">
            <span class="fx-box">${k >= 0 ? k + 1 : ''}</span>
            <span class="fx-text"><span class="pl-name">${esc(e.name)}</span><span class="pl-meta">${exMeta(e)}</span></span>
          </button>
          <button type="button" class="btn small" data-act="exInfo" data-id="${esc(e.id)}">說明</button>
        </div>`;
      }).join('');
    }).join('');
}

function exInfoHtml(ex) {
  return `<h2>${esc(ex.name)}</h2>
    <div class="chips"><span class="chip strong">${esc(bandLabel(ex.band))}</span><span class="chip">${ex.sets} 組 × ${ex.min}–${ex.max} 下</span></div>
    ${Figures.svg(ex.id, ex.name)}
    <h3>做法</h3><p class="how">${esc(ex.how)}</p>
    <h3>容易犯的錯</h3><p class="mistakes">${esc(ex.mistakes)}</p>
    ${ex.details.length ? `<div class="more nob"><dl>${ex.details.map(d => `<dt>${esc(d.label)}</dt><dd>${esc(d.text)}</dd>`).join('')}</dl></div>` : ''}`;
}
function planListHtml(key) {
  const items = Array.isArray(key) ? key : state.plans[key].items;
  if (!items.length) return '<p class="muted">這個訓練日還沒有動作，請到設定頁新增。</p>';
  return '<ol class="plan-list">' + items.map(it => {
    const ex = exById(it.exId);
    if (!ex) return '';
    const hint = progressHint(it.exId, it.band, it.max);
    return `<li><span class="pl-name">${esc(ex.name)}${hint ? ' <span class="badge">可以加難度</span>' : ''}</span>
      <span class="pl-meta">${it.band} kg · ${it.sets} 組 × ${it.min}–${it.max} 下</span></li>`;
  }).join('') + '</ol>';
}

function lettersHtml() {
  const sel = currentLetters();
  return `<div class="letters" role="group" aria-label="選擇訓練日，可以選一套或兩套">
      ${planKeys().map(k => `<button type="button" data-act="pick" data-plan="${k}" aria-pressed="${sel.includes(k)}"><b>${k}</b><small>${esc(state.plans[k].title)}</small><small class="lt-min">約 ${planMinutes(k)} 分鐘</small></button>`).join('')}
    </div>
    <p class="sub">點字母可以加選或取消，一次最多兩套。${pickLetters ? '<button type="button" class="linkbtn" data-act="pickReset">回到建議的搭配</button>' : ''}</p>
    ${sel.map(k => `<h3 class="pl-head">${k}｜${esc(state.plans[k].title)}・約 ${planMinutes(k)} 分鐘</h3>${planListHtml(k)}`).join('')}`;
}

VIEWS.home = () => {
  const rec = recommend();
  const a = state.active;
  const sel = currentLetters();
  let startBtn = '';
  if (!a) {
    if (homeMode === 'menu') startBtn = currentRoutine() ? `<button type="button" class="btn primary big" data-act="start">開始「${esc(currentRoutine().title)}」</button>` : '';
    else if (homeMode === 'free') startBtn = `<button type="button" class="btn primary big" data-act="start" id="freeStart">開始自選訓練（${freePick.length} 個動作）</button>`;
    else startBtn = `<button type="button" class="btn primary big" data-act="start">${sel.length ? `開始訓練日 ${pairLabel(sel)}（約 ${planMinutes(mergedItems(sel))} 分鐘）` : '先選一套訓練日'}</button>`;
  }
  view.innerHTML = `
    <header class="top"><h1>彈力帶訓練</h1><a class="toplink" href="#/help">訓練原則</a></header>
    ${a ? `<section class="card notice">
      <h2>有一次還沒結束的訓練</h2>
      <p>${esc(planLabel(a))}，${fmtDate(a.date)} 開始，已完成 ${a.items.reduce((n, it) => n + itemDone(it), 0)} 組。</p>
      <div class="btn-row"><button type="button" class="btn primary" data-act="resume">繼續訓練</button>
      <button type="button" class="btn" data-act="discard">放棄</button></div>
    </section>` : ''}
    <section class="card">
      <p class="eyebrow">今天建議</p>
      <h2 class="rec">訓練日 ${pairLabel(rec.letters)}<span>${esc(pairTitle(rec.letters))}</span></h2>
      <p class="note">${esc(rec.note)}</p>
      ${rec.letters.length > 1 ? '<p class="sub">這兩套練的部位不重疊，可以同一天做；時間不夠就只做其中一套。</p>' : ''}
      <div class="seg" role="group" aria-label="選擇訓練方式">
        <button type="button" data-act="mode" data-mode="plan" aria-pressed="${homeMode === 'plan'}"><b>訓練日</b><small>A 到 ${planKeys().slice(-1)[0] || 'A'}</small></button>
        <button type="button" data-act="mode" data-mode="menu" aria-pressed="${homeMode === 'menu'}"><b>菜單</b><small>其他組合</small></button>
        <button type="button" data-act="mode" data-mode="free" aria-pressed="${homeMode === 'free'}"><b>自選</b><small>臨時挑</small></button>
      </div>
      ${homeMode === 'free' ? freeListHtml() : homeMode === 'menu' ? routineListHtml() : lettersHtml()}
      ${startBtn}
    </section>
    ${scheduleHtml()}
    <p class="foot muted">本週已練 ${rec.weekCount} 次。目標每週 2 到 3 次，中間至少隔一天。</p>`;
};

function startChecklist(plan) {
  openModal(`<h2>開始前先檢查</h2>
    <div class="checklist">
      ${CHECKLIST.map((t, i) => `<label><input type="checkbox" data-check="${i}"><span>${esc(t)}</span></label>`).join('')}
    </div>
    <div class="sheet-btns">
      <button type="button" class="btn primary big" data-act="go" data-plan="${plan}" disabled>都檢查好了，開始</button>
      <button type="button" class="btn" data-act="mCancel">取消</button>
    </div>`);
}

function createActive(plan) {
  const now = new Date();
  state.active = {
    id: 's' + now.getTime(),
    plan,
    date: ymd(now),
    startedAt: now.getTime(),
    idx: 0,
    ...(plan === 'menu' ? { title: currentRoutine().title } : {}),
    items: (plan === 'free' ? freePick.filter(id => exById(id)).map(id => exPreset(exById(id)))
      : plan === 'menu' ? currentRoutine().items.filter(it => exById(it.exId))
      : mergedItems(plan.split(''))).map(it => ({
      exId: it.exId,
      name: exById(it.exId).name,
      band: it.band,
      min: it.min,
      max: it.max,
      targetSets: it.sets,
      sets: Array.from({ length: it.sets }, () => ({ done: false, reps: null, rir: null }))
    }))
  };
  if (plan === 'free') freePick = [];
  pickLetters = null;
  homeMode = 'plan';
  save();
}

/* ---------- 訓練畫面 ---------- */
function defaultReps(it, j) {
  if (j > 0 && it.sets[j - 1].reps != null) return it.sets[j - 1].reps;
  const l = lastItem(it.exId);
  if (l && l.item.sets[j] && l.item.sets[j].reps != null) return l.item.sets[j].reps;
  return it.min;
}

VIEWS.workout = () => {
  const a = state.active;
  const i = a.idx;
  const it = a.items[i];
  const ex = exById(it.exId) || { how: '', mistakes: '', details: [] };
  const prev = lastItem(it.exId);
  const hint = progressHint(it.exId, it.band, it.max);
  const isLast = i === a.items.length - 1;
  view.innerHTML = `
    <header class="wtop">
      <button type="button" class="btn small" data-act="quit">結束</button>
      <span class="wpos">${esc(planLabel(a))}・動作 ${i + 1}／${a.items.length}</span>
    </header>
    <div class="dots" aria-hidden="true">${a.items.map((x, k) => `<i class="${k === i ? 'on' : ''} ${itemDone(x) >= x.sets.length ? 'full' : ''}"></i>`).join('')}</div>
    <section class="card">
      <h2 class="ex-name">${esc(it.name)}</h2>
      <div class="chips"><span class="chip strong">${esc(bandLabel(it.band))}</span><span class="chip">${it.targetSets} 組 × ${it.min}–${it.max} 下</span></div>
      ${hint ? `<div class="hintbox"><strong>可以加難度</strong>
        <p>上次（${fmtDate(hint.session.date)}）每一組都做到 ${it.max} 下，餘力也不多。這次挑一種方式試試：</p>
        <ul>${PROGRESS_WAYS.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>` : ''}
      ${Figures.svg(it.exId, it.name)}
      <h3>做法</h3><p class="how">${esc(ex.how)}</p>
      <h3>容易犯的錯</h3><p class="mistakes">${esc(ex.mistakes)}</p>
      ${ex.details.length ? `<details class="more" ${state.settings.showDetails ? 'open' : ''}>
        <summary>詳細姿勢</summary>
        <dl>${ex.details.map(d => `<dt>${esc(d.label)}</dt><dd>${esc(d.text)}</dd>`).join('')}</dl>
      </details>` : ''}
      ${prev ? `<p class="muted prev">上次（${fmtDate(prev.session.date)}）：${prev.item.sets.filter(s => s.done).map(s => s.reps).join('、')} 下</p>` : ''}
    </section>
    <section class="sets">
      ${it.sets.map((s, j) => `
      <div class="set ${s.done ? 'done' : ''}">
        <div class="set-row">
          <button type="button" class="check" data-act="toggle" data-j="${j}" aria-pressed="${s.done}" aria-label="第 ${j + 1} 組完成"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button>
          <span class="set-n">第 ${j + 1} 組</span>
          <div class="stepper">
            <button type="button" data-act="rep" data-j="${j}" data-d="-1" aria-label="第 ${j + 1} 組減 1 下">−</button>
            <input type="number" inputmode="numeric" min="0" max="999" data-reps="${j}" value="${s.reps == null ? '' : s.reps}" placeholder="${defaultReps(it, j)}" aria-label="第 ${j + 1} 組實際次數">
            <button type="button" data-act="rep" data-j="${j}" data-d="1" aria-label="第 ${j + 1} 組加 1 下">＋</button>
          </div>
        </div>
        <div class="rir" role="group" aria-label="第 ${j + 1} 組還剩幾下餘力">
          <span class="rir-l">還剩幾下<br>餘力</span>
          ${[0, 1, 2, 3].map(v => `<button type="button" data-act="rir" data-j="${j}" data-v="${v}" aria-pressed="${s.rir === v}">${v === 3 ? '3 以上' : v}</button>`).join('')}
        </div>
      </div>`).join('')}
      <div class="set-tools">
        <button type="button" class="btn small" data-act="addSet">＋ 加一組</button>
        ${it.sets.length > 1 ? '<button type="button" class="btn small" data-act="delSet">刪掉最後一組</button>' : ''}
      </div>
    </section>
    <section class="card restcfg">
      <span>組間休息</span>
      <div class="stepper wide">
        <button type="button" data-act="restCfg" data-d="-15" aria-label="休息減 15 秒">−</button>
        <output>${state.settings.restSec} 秒</output>
        <button type="button" data-act="restCfg" data-d="15" aria-label="休息加 15 秒">＋</button>
      </div>
      <button type="button" class="btn small" data-act="restGo">開始倒數</button>
    </section>
    <button type="button" class="btn" data-act="wAddOpen">＋ 臨時加一個動作</button>
    <div class="wnav">
      <button type="button" class="btn" data-act="wPrev" ${i === 0 ? 'disabled' : ''}>上一個</button>
      <button type="button" class="btn primary" data-act="wNext">${isLast ? '完成訓練' : '下一個動作'}</button>
    </div>`;
};

async function finishWorkout() {
  const a = state.active;
  const done = a.items.reduce((n, it) => n + itemDone(it), 0);
  const total = a.items.reduce((n, it) => n + it.sets.length, 0);
  if (done === 0) {
    if (await confirmBox({ title: '還沒有完成任何一組', body: '要放棄這次訓練嗎？不會留下紀錄。', ok: '放棄這次訓練', cancel: '繼續訓練', danger: true })) dropActive();
    return;
  }
  if (done < total && !(await confirmBox({ title: `還有 ${total - done} 組沒有打勾`, body: '確定要結束並儲存嗎？沒打勾的組不會算進次數。', ok: '儲存並結束', cancel: '繼續訓練' }))) return;
  const session = {
    id: a.id, date: a.date, startedAt: a.startedAt, endedAt: Date.now(), plan: a.plan, ...(a.title ? { title: a.title } : {}),
    items: a.items.map(it => ({ exId: it.exId, name: it.name, band: it.band, min: it.min, max: it.max, targetSets: it.targetSets, sets: it.sets }))
  };
  state.sessions.push(session);
  state.active = null;
  pickLetters = null;
  save();
  restStop();
  const reps = session.items.reduce((n, it) => n + itemReps(it), 0);
  const mins = Math.max(1, Math.round((session.endedAt - session.startedAt) / 60000));
  const up = session.items.filter(canProgress);
  openModal(`<h2>訓練完成</h2>
    <p>${esc(planLabel(session))}：完成 ${done} 組、共 ${reps} 下，花了 ${mins} 分鐘。</p>
    ${up.length ? `<div class="hintbox"><strong>下次可以加難度</strong><p>${up.map(it => esc(it.name)).join('、')}：每一組都做到次數上限，餘力也不多。</p></div>` : ''}
    <div class="sheet-btns"><button type="button" class="btn primary" data-act="mOk">好</button></div>`);
  location.hash = '#/';
}

function dropActive() {
  state.active = null;
  save();
  restStop();
  if (current === 'workout') location.hash = '#/'; else render();
}

/* ---------- 組間休息計時 ---------- */
const rest = { endAt: 0, total: 0, timer: null, lastTick: 0, hideTimer: null };
function restStart(sec) {
  clearTimeout(rest.hideTimer);
  rest.total = sec;
  rest.endAt = Date.now() + sec * 1000;
  rest.lastTick = 0;
  restbar.classList.remove('over');
  $('.rb-label', restbar).textContent = '休息';
  restbar.hidden = current !== 'workout';
  if (!rest.timer) rest.timer = setInterval(restTick, 200);
  restTick();
}
function restTick() {
  const leftMs = rest.endAt - Date.now();
  const left = Math.ceil(leftMs / 1000);
  if (left <= 0) {
    clearInterval(rest.timer);
    rest.timer = null;
    Device.signal('end');
    restbar.classList.add('over');
    $('.rb-label', restbar).textContent = '休息結束，開始下一組';
    $('.rb-time', restbar).textContent = '';
    $('.rb-fill', restbar).style.width = '100%';
    rest.hideTimer = setTimeout(() => { restbar.hidden = true; }, 5000);
    return;
  }
  if (left <= 3 && left !== rest.lastTick) { rest.lastTick = left; Device.signal('tick'); }
  $('.rb-time', restbar).textContent = mmss(left);
  $('.rb-fill', restbar).style.width = clamp(100 - (leftMs / (rest.total * 1000)) * 100, 0, 100) + '%';
}
function restStop() {
  clearInterval(rest.timer);
  clearTimeout(rest.hideTimer);
  rest.timer = null;
  restbar.hidden = true;
}

/* ---------- Tabata ---------- */
const tb = { running: false, paused: false, phases: [], i: 0, endAt: 0, leftMs: 0, timer: null, lastTick: 0, finished: false };
const TB_LABEL = { prep: '準備', work: '動作', rest: '休息', roundrest: '輪間休息' };

function tabataPhases() {
  const t = state.tabata;
  const moves = t.moves.length ? t.moves : ['動作'];
  const ph = [{ kind: 'prep', sec: 5, round: 1, cycle: 0 }];
  for (let r = 1; r <= t.rounds; r++) {
    for (let c = 1; c <= t.cycles; c++) {
      ph.push({ kind: 'work', sec: t.work, round: r, cycle: c, move: moves[(c - 1) % moves.length] });
      if (c < t.cycles) ph.push({ kind: 'rest', sec: t.rest, round: r, cycle: c });
      else if (r < t.rounds) ph.push({ kind: 'roundrest', sec: t.roundRest, round: r, cycle: c });
    }
  }
  return ph.filter(p => p.sec > 0);
}
const tabataDesc = () => `${state.tabata.work} 秒動作、${state.tabata.rest} 秒休息，${state.tabata.cycles} 個循環為一輪，共 ${state.tabata.rounds} 輪。`;
const tabataTotal = () => tabataPhases().reduce((n, p) => n + p.sec, 0) - 5;

function tabataStart() {
  tb.phases = tabataPhases();
  tb.i = 0;
  tb.running = true;
  tb.paused = false;
  tb.finished = false;
  tb.lastTick = 0;
  tb.endAt = Date.now() + tb.phases[0].sec * 1000;
  Device.keepAwake(true);
  tb.timer = setInterval(tabataTick, 100);
  render();
}
function tabataTick() {
  let changed = false;
  while (tb.running && Date.now() >= tb.endAt) {
    tb.i++;
    if (tb.i >= tb.phases.length) {
      Device.signal('end');
      tabataStop(true);
      tb.finished = true;
      if (current === 'tabata') render();
      return;
    }
    tb.endAt += tb.phases[tb.i].sec * 1000;
    tb.lastTick = 0;
    changed = true;
  }
  if (changed) {
    Device.signal(tb.phases[tb.i].kind === 'work' ? 'go' : 'rest');
    render();
    return;
  }
  const left = Math.ceil((tb.endAt - Date.now()) / 1000);
  if (left <= 3 && left !== tb.lastTick) { tb.lastTick = left; Device.signal('tick'); }
  const el = $('.tb-time');
  if (el && el.textContent !== String(left)) el.textContent = left;
}
function tabataStop(silent) {
  clearInterval(tb.timer);
  tb.timer = null;
  tb.running = false;
  tb.paused = false;
  Device.keepAwake(current === 'workout');
  if (!silent) render();
}

function tabataRunHtml() {
  const t = state.tabata;
  const p = tb.phases[tb.i];
  const nextWork = tb.phases.slice(tb.i + 1).find(x => x.kind === 'work');
  const left = tb.paused ? Math.ceil(tb.leftMs / 1000) : Math.ceil((tb.endAt - Date.now()) / 1000);
  return `<section class="tb-run" data-kind="${p.kind}">
    <p class="tb-meta">${p.kind === 'prep' ? '馬上開始' : `第 ${p.round}／${t.rounds} 輪・循環 ${p.cycle}／${t.cycles}`}</p>
    <p class="tb-phase">${TB_LABEL[p.kind]}${tb.paused ? '（已暫停）' : ''}</p>
    <p class="tb-time" aria-live="off">${Math.max(0, left)}</p>
    <p class="tb-move">${p.kind === 'work' ? esc(p.move) : nextWork ? '下一個：' + esc(nextWork.move) : ''}</p>
    <div class="btn-row">
      <button type="button" class="btn big" data-act="tbPause">${tb.paused ? '繼續' : '暫停'}</button>
      <button type="button" class="btn big" data-act="tbStop">停止</button>
    </div>
  </section>`;
}

const numField = (label, path, min, max, val) =>
  `<label class="field"><span>${label}</span><input type="number" inputmode="numeric" min="${min}" max="${max}" data-path="${path}" data-type="int" value="${val}"></label>`;

VIEWS.tabata = () => {
  if (tb.running) { view.innerHTML = `<header class="top"><h1>Tabata</h1></header>` + tabataRunHtml(); return; }
  const t = state.tabata;
  view.innerHTML = `
    <header class="top"><h1>Tabata</h1></header>
    ${tb.finished ? '<section class="card notice"><h2>完成了</h2><p>全部輪數都做完了，記得喝水、緩和一下。</p></section>' : ''}
    <section class="card">
      <p class="note"><span id="tb-desc">${tabataDesc()}</span>每個階段開始時會有提示音和震動。</p>
      <p class="tb-total">總時間 <strong id="tb-total">${mmss(tabataTotal())}</strong></p>
      <button type="button" class="btn primary big" data-act="tbStart">開始</button>
    </section>
    <section class="card">
      <h2>影片範本</h2>
      <p class="sub">照 ZEROX FITNESS COACH 的 Tabata 影片。影片是做 4 輪，輪間休息越短越好。按「套用」會把下面的動作清單換成那一組。</p>
      ${TABATA_PRESETS.map(p => `<div class="preset">
        <div class="preset-name">${esc(p.name)}<span>${p.moves.length ? p.moves.length + ' 個動作' : '動作清單還沒填'}</span></div>
        <div class="btn-row">
          ${p.moves.length ? `<button type="button" class="btn small" data-act="tbPreset" data-id="${p.id}">套用</button>` : ''}
          <a class="btn small" href="${esc(p.video)}" target="_blank" rel="noopener noreferrer">看影片</a>
        </div>
      </div>`).join('')}
    </section>
    <section class="card">
      <h2>設定</h2>
      <div class="grid2">
        ${numField('輪數', 'tabata.rounds', 1, 20, t.rounds)}
        ${numField('輪間休息（秒，越短越好）', 'tabata.roundRest', 0, 600, t.roundRest)}
        ${numField('動作（秒）', 'tabata.work', 5, 120, t.work)}
        ${numField('休息（秒）', 'tabata.rest', 0, 120, t.rest)}
        ${numField('每輪循環數', 'tabata.cycles', 1, 20, t.cycles)}
      </div>
      <label class="field"><span>動作清單（一行一個，依序輪流）</span>
        <textarea rows="5" data-path="tabata.moves" data-type="lines">${esc(t.moves.join('\n'))}</textarea></label>
    </section>`;
};

/* ---------- 歷史紀錄 ---------- */
VIEWS.history = () => {
  const all = sessionsAsc().reverse();
  view.innerHTML = `<header class="top"><h1>歷史紀錄</h1></header>` + (all.length ? all.map(s => {
    const sets = s.items.reduce((n, it) => n + itemDone(it), 0);
    const reps = s.items.reduce((n, it) => n + itemReps(it), 0);
    const mins = s.endedAt ? Math.max(1, Math.round((s.endedAt - s.startedAt) / 60000)) : null;
    return `<details class="card sess">
      <summary><span class="s-title">${fmtDate(s.date)}　${esc(planLabel(s))}</span>
        <span class="s-meta">${sets} 組・共 ${reps} 下${mins ? '・' + mins + ' 分鐘' : ''}</span></summary>
      ${s.items.map(it => `<div class="h-item">
        <div class="h-name">${esc(it.name)} <span class="muted">${it.band} kg・目標 ${it.min}–${it.max} 下</span></div>
        <div class="h-sets">${it.sets.map((x, j) => x.done
          ? `<span>第 ${j + 1} 組 ${x.reps} 下${x.rir != null ? `（餘力 ${rirLabel(x.rir)}）` : ''}</span>`
          : `<span class="muted">第 ${j + 1} 組 沒做</span>`).join('')}</div>
      </div>`).join('')}
      <button type="button" class="btn small danger-text" data-act="delSession" data-id="${esc(s.id)}">刪除這筆紀錄</button>
    </details>`;
  }).join('') : '<section class="card empty"><p>還沒有紀錄。完成第一次訓練後會出現在這裡。</p><a class="btn primary" href="#/">去首頁開始</a></section>');
};

/* ---------- 進度 ---------- */
let progressEx = null;
VIEWS.progress = () => {
  const all = sessionsAsc();
  const ws = weekStart(new Date());
  const weeks = [];
  for (let k = 7; k >= 0; k--) {
    const a = new Date(ws); a.setDate(a.getDate() - 7 * k);
    const b = new Date(a); b.setDate(b.getDate() + 7);
    const n = all.filter(s => { const d = parseYmd(s.date); return d >= a && d < b; }).length;
    weeks.push({ label: `${a.getMonth() + 1}/${a.getDate()}`, value: n, tip: `${a.getMonth() + 1}/${a.getDate()} 開始的那一週：訓練 ${n} 次` });
  }
  const names = new Map();
  all.forEach(s => s.items.forEach(it => { if (itemDone(it)) names.set(it.exId, (exById(it.exId) || it).name); }));
  const ids = [...names.keys()];
  if (!ids.includes(progressEx)) progressEx = ids[0] || null;
  let exHtml = '<p class="muted">完成第一次訓練後，這裡會出現每個動作的折線圖。</p>';
  if (progressEx) {
    const rows = [];
    all.forEach(s => {
      const its = s.items.filter(it => it.exId === progressEx && itemDone(it));
      if (!its.length) return;
      const total = its.reduce((n, it) => n + itemReps(it), 0);
      const detail = its.map(it => it.sets.filter(x => x.done).map(x => x.reps).join('、')).join('、');
      rows.push({ date: s.date, total, detail, band: its[0].band });
    });
    const pts = rows.slice(-20).map(r => ({ label: shortDate(r.date), value: r.total, tip: `${fmtDate(r.date)}：共 ${r.total} 下（${r.detail}）・${r.band} kg` }));
    exHtml = `
      <div class="chiprow" role="group" aria-label="選擇動作">${ids.map(id => `<button type="button" class="chipbtn" data-act="pickEx" data-id="${esc(id)}" aria-pressed="${id === progressEx}">${esc(names.get(id))}</button>`).join('')}</div>
      <div class="chart-wrap">${Charts.line(pts, names.get(progressEx) + '每次訓練的總次數')}
        <p class="chart-tip">點圖上的點可以看那一次的數字</p></div>
      <details class="tableview"><summary>用表格看</summary>
        <table><thead><tr><th>日期</th><th>帶子</th><th>各組次數</th><th>總次數</th></tr></thead>
        <tbody>${rows.slice().reverse().map(r => `<tr><td>${fmtDate(r.date)}</td><td>${r.band} kg</td><td>${r.detail}</td><td>${r.total}</td></tr>`).join('')}</tbody></table>
      </details>`;
  }
  view.innerHTML = `
    <header class="top"><h1>進度</h1></header>
    <section class="card">
      <h2>每週訓練次數</h2>
      <p class="sub">最近 8 週，目標每週 2 到 3 次</p>
      <div class="chart-wrap">${Charts.bars(weeks, '最近 8 週每週訓練次數', 3)}
        <p class="chart-tip">橫軸是每週星期一的日期</p></div>
    </section>
    <section class="card">
      <h2>各動作總次數</h2>
      <p class="sub">每次訓練所有組加起來的下數</p>
      ${exHtml}
    </section>`;
};

/* ---------- 設定 ---------- */
/* base 是資料路徑：'plans.A' 或 'routines.2' */
function planEditorHtml(base) {
  const p = getPath(base);
  return `<label class="field"><span>名稱</span><input type="text" data-path="${base}.title" data-keep="1" value="${esc(p.title)}"></label>
    ${p.items.map((it, i) => `<div class="pitem">
      <label class="field"><span>動作 ${i + 1}</span>
        <select data-path="${base}.items.${i}.exId">${state.exercises.map(e => `<option value="${esc(e.id)}" ${e.id === it.exId ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select></label>
      <label class="field"><span>帶子</span>
        <select data-path="${base}.items.${i}.band" data-type="int">${BANDS.map(b => `<option value="${b.kg}" ${b.kg === it.band ? 'selected' : ''}>${esc(b.label)}</option>`).join('')}</select></label>
      <div class="grid3">
        ${numField('組數', `${base}.items.${i}.sets`, 1, 10, it.sets)}
        ${numField('最少下數', `${base}.items.${i}.min`, 1, 100, it.min)}
        ${numField('最多下數', `${base}.items.${i}.max`, 1, 100, it.max)}
      </div>
      <div class="btn-row">
        <button type="button" class="btn small" data-act="pMove" data-base="${base}" data-i="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''}>上移</button>
        <button type="button" class="btn small" data-act="pMove" data-base="${base}" data-i="${i}" data-d="1" ${i === p.items.length - 1 ? 'disabled' : ''}>下移</button>
        <button type="button" class="btn small danger-text" data-act="pDel" data-base="${base}" data-i="${i}">移除</button>
      </div>
    </div>`).join('')}
    <button type="button" class="btn" data-act="pAdd" data-base="${base}">＋ 新增動作</button>`;
}

const openRoutines = new Set();   // 設定頁展開中的菜單，重畫後維持展開
VIEWS.settings = () => {
  const s = state.settings;
  view.innerHTML = `
    <header class="top"><h1>設定</h1><a class="toplink" href="#/help">說明</a></header>
    <section class="card">
      <h2>休息與提示</h2>
      ${numField('組間休息（秒，建議 60 到 90）', 'settings.restSec', 15, 300, s.restSec)}
      <label class="switch"><input type="checkbox" data-path="settings.sound" data-type="bool" ${s.sound ? 'checked' : ''}><span>提示音</span></label>
      <label class="switch"><input type="checkbox" data-path="settings.vibrate" data-type="bool" ${s.vibrate ? 'checked' : ''}><span>震動${Device.support.vibrate ? '' : '（這個瀏覽器不支援）'}</span></label>
      <button type="button" class="btn small" data-act="testSignal">試一下提示音和震動</button>
      <label class="field"><span>外觀</span>
        <select data-path="settings.theme">
          <option value="auto" ${s.theme === 'auto' ? 'selected' : ''}>跟著系統</option>
          <option value="light" ${s.theme === 'light' ? 'selected' : ''}>淺色</option>
          <option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>深色</option>
        </select></label>
    </section>
    <section class="card">
      <h2>每週日程</h2>
      <p class="sub">首頁的「本週日程」會照這裡排。彈力帶訓練日中間至少隔一天。</p>
      ${[['bandDays', '彈力帶訓練日'], ['tabataDays', 'Tabata 日（選做）']].map(([k, label]) => `
      <div class="field"><span>${label}</span>
        <div class="daypick" role="group" aria-label="${label}">
          ${[...WEEK].map((w, i) => `<label><input type="checkbox" data-days="${k}" data-d="${i}" ${daysOf(k).includes(i) ? 'checked' : ''}><span>${w}</span></label>`).join('')}
        </div>
      </div>`).join('')}
      <label class="field"><span>習慣的訓練時間（可以不填）</span><input type="time" data-path="settings.trainTime" value="${esc(s.trainTime)}"></label>
    </section>
    <section class="card">
      <h2>訓練日</h2>
      <p class="sub">首頁會從這些訓練日裡推薦搭配。可以改內容、新增或刪除。</p>
      ${planKeys().map(k => `<details class="exedit rtedit" data-rt="plan-${k}" ${openRoutines.has('plan-' + k) ? 'open' : ''}>
        <summary>${k}｜${esc(state.plans[k].title)}</summary>
        ${planEditorHtml('plans.' + k)}
        <button type="button" class="btn small danger-text" data-act="planDel" data-k="${k}">刪除訓練日 ${k}</button>
      </details>`).join('')}
      <button type="button" class="btn" data-act="planAdd">＋ 新增訓練日</button>
    </section>
    <section class="card">
      <h2>其他菜單</h2>
      <p class="sub">首頁「菜單」裡的組合。可以改內容、新增或刪除。</p>
      ${state.routines.map((r, i) => `<details class="exedit rtedit" data-rt="${esc(r.id)}" ${openRoutines.has(r.id) ? 'open' : ''}>
        <summary>${esc(r.title)}</summary>
        ${planEditorHtml('routines.' + i)}
        <label class="field"><span>說明（可以不填）</span><textarea rows="2" data-path="routines.${i}.note">${esc(r.note || '')}</textarea></label>
        <button type="button" class="btn small danger-text" data-act="rtDel" data-i="${i}">刪除這份菜單</button>
      </details>`).join('')}
      <button type="button" class="btn" data-act="rtAdd">＋ 新增菜單</button>
    </section>
    <section class="card">
      <h2>動作說明</h2>
      ${state.exercises.map((e, i) => `<details class="exedit">
        <summary>${esc(e.name)}</summary>
        <label class="field"><span>名稱</span><input type="text" data-path="exercises.${i}.name" data-keep="1" value="${esc(e.name)}"></label>
        <label class="field"><span>部位</span>
          <select data-path="exercises.${i}.group">${GROUPS.map(g => `<option ${g === e.group ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select></label>
        <label class="field"><span>建議的帶子（自選訓練和新增到訓練日時用）</span>
          <select data-path="exercises.${i}.band" data-type="int">${BANDS.map(b => `<option value="${b.kg}" ${b.kg === e.band ? 'selected' : ''}>${esc(b.label)}</option>`).join('')}</select></label>
        <div class="grid3">
          ${numField('組數', `exercises.${i}.sets`, 1, 10, e.sets)}
          ${numField('最少下數', `exercises.${i}.min`, 1, 100, e.min)}
          ${numField('最多下數', `exercises.${i}.max`, 1, 100, e.max)}
        </div>
        <label class="field"><span>做法（不超過 3 行）</span><textarea rows="4" data-path="exercises.${i}.how">${esc(e.how)}</textarea></label>
        <label class="field"><span>容易犯的錯</span><textarea rows="3" data-path="exercises.${i}.mistakes">${esc(e.mistakes)}</textarea></label>
        <label class="field"><span>詳細姿勢（一行一項，格式是「標題：內容」）</span><textarea rows="10" data-path="exercises.${i}.details" data-type="details">${esc(e.details.map(d => d.label + '：' + d.text).join('\n'))}</textarea></label>
        <button type="button" class="btn small danger-text" data-act="exDel" data-i="${i}">刪除這個動作</button>
      </details>`).join('')}
      <button type="button" class="btn" data-act="exAdd">＋ 新增自訂動作</button>
    </section>
    <section class="card">
      <h2>資料</h2>
      <p class="note">資料只存在這臺裝置的瀏覽器裡，清除瀏覽資料時可能一起被清掉。建議定期匯出備份。目前有 ${state.sessions.length} 筆訓練紀錄。</p>
      <button type="button" class="btn" data-act="exportJson">匯出 JSON</button>
      <button type="button" class="btn" data-act="importPick">匯入 JSON</button>
      <input type="file" id="importFile" accept="application/json,.json" hidden>
      <button type="button" class="btn danger" data-act="clearAll">清除所有資料</button>
    </section>`;
};

function exportPayload() {
  return JSON.stringify({ app: 'bandfit', exportedAt: new Date().toISOString(), data: state }, null, 2);
}
function exportJson() {
  const url = URL.createObjectURL(new Blob([exportPayload()], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `bandfit-${ymd(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast('已匯出 JSON 檔');
}
async function importJson(file) {
  let obj;
  try { obj = JSON.parse(await file.text()); } catch (e) { toast('匯入失敗：這不是正確的 JSON 檔'); return; }
  const data = obj && obj.data && typeof obj.data === 'object' ? obj.data : obj;
  if (!data || typeof data !== 'object' || !Array.isArray(data.sessions) || !data.plans) { toast('匯入失敗：檔案內容不是這個 app 的備份'); return; }
  if (!(await confirmBox({ title: '匯入這份備份？', body: `檔案裡有 ${data.sessions.length} 筆訓練紀錄。匯入後會取代目前這臺裝置上的所有資料。`, ok: '取代並匯入' }))) return;
  state = normalize(data);
  save();
  applySettings();
  restStop();
  render();
  toast('匯入完成');
}

/* ---------- 說明 ---------- */
VIEWS.help = () => {
  view.innerHTML = `
    <header class="top"><h1>說明</h1><a class="toplink" href="#/">回首頁</a></header>
    <section class="card"><h2>訓練原則</h2><ul class="plain">${PRINCIPLES.map(p => `<li>${esc(p)}</li>`).join('')}</ul></section>
    <section class="card"><h2>頻率</h2><p>每週 2 到 3 次，中間至少隔一天。首頁會挑最久沒練的一套訓練日，再搭一套部位不重疊的（例如 A＋C），兩套可以同一天做；也可以自己切換。</p></section>
    <section class="card"><h2>組要怎麼做</h2>
      <p>照這個 app 的順序：同一個動作做完所有組（組間休息 60 到 90 秒），再換下一個動作。這樣每一組的品質最好，帶子也不用一直換位置。</p>
      <p>趕時間的話，可以把一個「推」和一個「拉」的動作配成一對輪流做（例如胸推和划船），兩個動作之間少休息一點。研究顯示這樣練的效果差不多，但會比較喘。</p>
      <p>全部動作各做一組、輪完再重來的「循環式」比較像在練體力，每個動作的力氣會打折，想練肌肉時不建議當主要做法。</p></section>
    <section class="card"><h2>什麼時候加難度</h2>
      <p>某個動作的每一組都做到次數範圍的上限，而且每組填的餘力都在 2 下以內，下次訓練時就會出現「可以加難度」。方式有：</p>
      <ul class="plain">${PROGRESS_WAYS.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
      <p>加難度後次數會掉回範圍的下半段，這是正常的，再慢慢做回上限。</p></section>
    <section class="card"><h2>每次開始前</h2><ul class="plain">${CHECKLIST.map(p => `<li>${esc(p)}</li>`).join('')}</ul></section>
    <section class="card"><h2>關於這個 app</h2>
      <p>所有資料都存在這臺裝置的瀏覽器裡，不會傳到任何地方。請定期到設定頁匯出 JSON 備份。</p>
      <p class="muted">這臺裝置：螢幕恆亮${Device.support.wakeLock ? '可用' : '不支援'}・提示音${Device.support.audio ? '可用' : '不支援'}・震動${Device.support.vibrate ? '可用' : '不支援'}</p></section>`;
};

/* ---------- 動作（點按） ---------- */
const actions = {
  mOk: () => closeModal(true),
  mCancel: () => closeModal(false),

  mode: el => { homeMode = el.dataset.mode; render(); },
  pick: el => {
    const k = el.dataset.plan;
    let sel = currentLetters();
    if (sel.includes(k)) sel = sel.filter(x => x !== k);
    else { if (sel.length >= 2) { toast('一次最多選兩套，先取消一套再選'); return; } sel = [...sel, k].sort(); }
    pickLetters = sel;
    const y = window.scrollY; render(); window.scrollTo(0, y);
  },
  pickReset: () => { pickLetters = null; render(); },
  pickRoutine: el => { chosenRoutine = el.dataset.id; const y = window.scrollY; render(); window.scrollTo(0, y); },
  start: () => {
    if (homeMode === 'free') {
      if (!freePick.length) { toast('先勾選至少一個動作'); return; }
      startChecklist('free');
      return;
    }
    if (homeMode === 'menu') {
      const r = currentRoutine();
      if (!r || !r.items.some(it => exById(it.exId))) { toast('這份菜單沒有動作，請先到設定頁新增'); return; }
      startChecklist('menu');
      return;
    }
    const sel = currentLetters();
    if (!sel.length) { toast('先選一套訓練日'); return; }
    if (!mergedItems(sel).length) { toast('選的訓練日沒有動作，請先到設定頁新增'); return; }
    startChecklist(sel.join(''));
  },
  go: el => { closeModal(); createActive(el.dataset.plan); location.hash = '#/workout'; },
  freeToggle: el => {
    const id = el.dataset.id, k = freePick.indexOf(id);
    if (k >= 0) freePick.splice(k, 1); else freePick.push(id);
    const y = window.scrollY;
    render();
    window.scrollTo(0, y);
  },
  exInfo: el => {
    const ex = exById(el.dataset.id);
    if (ex) openModal(exInfoHtml(ex) + '<div class="sheet-btns"><button type="button" class="btn primary" data-act="mCancel">關閉</button></div>');
  },
  wAddOpen: () => {
    openModal('<h2>臨時加一個動作</h2><p class="sub">會加在這次訓練的最後面。</p>' + GROUPS.map(g => {
      const list = state.exercises.filter(e => e.group === g);
      return list.length ? `<h3>${esc(g)}</h3><div class="addlist">` + list.map(e =>
        `<button type="button" class="btn" data-act="wAddEx" data-id="${esc(e.id)}"><span>${esc(e.name)}</span><small>${exMeta(e)}</small></button>`).join('') + '</div>' : '';
    }).join('') + '<div class="sheet-btns"><button type="button" class="btn" data-act="mCancel">取消</button></div>');
  },
  wAddEx: el => {
    const ex = exById(el.dataset.id), a = state.active;
    if (!ex || !a) return;
    a.items.push({ exId: ex.id, name: ex.name, band: ex.band, min: ex.min, max: ex.max, targetSets: ex.sets,
      sets: Array.from({ length: ex.sets }, () => ({ done: false, reps: null, rir: null })) });
    save(); closeModal(); render(); toast(`已加入「${ex.name}」，排在最後`);
  },
  resume: () => { location.hash = '#/workout'; },
  discard: async () => {
    if (await confirmBox({ title: '放棄這次訓練？', body: '已經打勾的組不會留下紀錄。', ok: '放棄', danger: true })) dropActive();
  },

  toggle: el => {
    const a = state.active, it = a.items[a.idx], j = +el.dataset.j, s = it.sets[j];
    s.done = !s.done;
    if (s.done) {
      if (s.reps == null) s.reps = defaultReps(it, j);
      const allDone = a.items.every(x => x.sets.every(y => y.done));
      if (!allDone) restStart(state.settings.restSec);
    }
    save(); render();
  },
  rep: el => {
    const a = state.active, it = a.items[a.idx], j = +el.dataset.j, s = it.sets[j];
    s.reps = clamp((s.reps == null ? defaultReps(it, j) : s.reps) + (+el.dataset.d), 0, 999);
    save();
    $(`input[data-reps="${j}"]`).value = s.reps;
  },
  rir: el => {
    const a = state.active, s = a.items[a.idx].sets[+el.dataset.j], v = +el.dataset.v;
    s.rir = s.rir === v ? null : v;
    save(); render();
  },
  addSet: () => { const a = state.active; a.items[a.idx].sets.push({ done: false, reps: null, rir: null }); save(); render(); },
  delSet: () => { const a = state.active; a.items[a.idx].sets.pop(); save(); render(); },
  wPrev: () => { const a = state.active; if (a.idx > 0) { a.idx--; save(); render(); window.scrollTo(0, 0); } },
  wNext: () => {
    const a = state.active;
    if (a.idx < a.items.length - 1) { a.idx++; save(); render(); window.scrollTo(0, 0); } else finishWorkout();
  },
  quit: () => {
    openModal(`<h2>結束這次訓練？</h2>
      <div class="sheet-btns">
        <button type="button" class="btn primary" data-act="quitSave">儲存並結束</button>
        <button type="button" class="btn" data-act="quitHome">先回首頁，等一下再繼續</button>
        <button type="button" class="btn danger-text" data-act="quitDrop">放棄這次訓練，不留紀錄</button>
        <button type="button" class="btn" data-act="mCancel">繼續訓練</button>
      </div>`);
  },
  quitSave: () => { closeModal(); finishWorkout(); },
  quitHome: () => { closeModal(); location.hash = '#/'; },
  quitDrop: () => { closeModal(); dropActive(); },

  restCfg: el => {
    state.settings.restSec = clamp(state.settings.restSec + (+el.dataset.d), 15, 300);
    save();
    $('.restcfg output').textContent = state.settings.restSec + ' 秒';
  },
  restGo: () => restStart(state.settings.restSec),
  restAdj: el => {
    if (!rest.timer) return;
    const d = +el.dataset.d * 1000;
    rest.endAt = Math.max(Date.now() + 1000, rest.endAt + d);
    rest.total = Math.max(rest.total + d / 1000, Math.ceil((rest.endAt - Date.now()) / 1000));
    restTick();
  },
  restSkip: () => restStop(),

  tbStart: () => tabataStart(),
  tbPreset: el => {
    const p = TABATA_PRESETS.find(x => x.id === el.dataset.id);
    if (!p || !p.moves.length) return;
    state.tabata.moves = clone(p.moves);
    state.tabata.cycles = p.moves.length;
    save(); render(); toast(`已套用「${p.name}」的動作`);
  },
  tbPause: () => {
    if (!tb.running) return;
    if (tb.paused) {
      tb.paused = false;
      tb.endAt = Date.now() + tb.leftMs;
      tb.timer = setInterval(tabataTick, 100);
    } else {
      tb.paused = true;
      tb.leftMs = tb.endAt - Date.now();
      clearInterval(tb.timer);
      tb.timer = null;
    }
    render();
  },
  tbStop: () => tabataStop(),

  delSession: async el => {
    const s = state.sessions.find(x => x.id === el.dataset.id);
    if (!s) return;
    if (!(await confirmBox({ title: '刪除這筆紀錄？', body: `${fmtDate(s.date)}的${planLabel(s)}，刪除後無法復原。`, ok: '刪除', danger: true }))) return;
    state.sessions = state.sessions.filter(x => x.id !== s.id);
    save(); render(); toast('已刪除');
  },

  pickEx: el => { progressEx = el.dataset.id; render(); },

  pMove: el => {
    const items = getPath(el.dataset.base).items, i = +el.dataset.i, k = i + (+el.dataset.d);
    if (k < 0 || k >= items.length) return;
    [items[i], items[k]] = [items[k], items[i]];
    save(); render();
  },
  pDel: el => { getPath(el.dataset.base).items.splice(+el.dataset.i, 1); save(); render(); },
  pAdd: el => {
    getPath(el.dataset.base).items.push(exPreset(state.exercises[0]));
    save(); render();
  },
  planAdd: () => {
    const k = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').find(c => !state.plans[c]);
    if (!k) { toast('訓練日已經用到 Z 了'); return; }
    state.plans[k] = { title: '新訓練日', items: [exPreset(state.exercises[0])] };
    openRoutines.add('plan-' + k);
    save(); render();
    const el = document.querySelector(`.rtedit[data-rt="plan-${k}"]`);
    if (el) el.scrollIntoView({ block: 'start' });
  },
  planDel: async el => {
    const k = el.dataset.k;
    if (planKeys().length <= 1) { toast('至少要留一套訓練日'); return; }
    if (!(await confirmBox({ title: `刪除訓練日 ${k}？`, body: '過去的訓練紀錄會保留。', ok: '刪除', danger: true }))) return;
    delete state.plans[k];
    pickLetters = null;
    save(); render();
  },
  rtAdd: () => {
    const r = { id: 'r' + Date.now(), title: '新菜單', note: '', items: [exPreset(state.exercises[0])] };
    state.routines.push(r);
    openRoutines.add(r.id);
    save(); render();
    const el = document.querySelector(`.rtedit[data-rt="${r.id}"]`);
    if (el) el.scrollIntoView({ block: 'start' });
  },
  rtDel: async el => {
    const i = +el.dataset.i, r = state.routines[i];
    if (!(await confirmBox({ title: `刪除菜單「${r.title}」？`, body: '過去用這份菜單做的訓練紀錄會保留。', ok: '刪除', danger: true }))) return;
    state.routines.splice(i, 1);
    save(); render();
  },
  exAdd: () => {
    state.exercises.push({ id: 'ex' + Date.now(), group: '其他', band: 5, sets: 3, min: 10, max: 15, name: '新動作', how: '', mistakes: '', details: [] });
    save(); render();
    const all = document.querySelectorAll('.exedit');
    const last = all[all.length - 1];
    last.open = true;
    last.scrollIntoView({ block: 'center' });
  },
  exDel: async el => {
    const i = +el.dataset.i, ex = state.exercises[i];
    if (state.exercises.length <= 1) { toast('至少要留一個動作'); return; }
    if (planKeys().some(k => state.plans[k].items.some(it => it.exId === ex.id)) || state.routines.some(r => r.items.some(it => it.exId === ex.id))) { toast('這個動作還在訓練日或菜單裡，請先從那裡移除'); return; }
    if (!(await confirmBox({ title: `刪除「${ex.name}」？`, body: '過去的訓練紀錄會保留。', ok: '刪除', danger: true }))) return;
    state.exercises.splice(i, 1);
    save(); render();
  },

  testSignal: () => Device.signal('end'),
  exportJson: () => exportJson(),
  importPick: () => $('#importFile').click(),
  clearAll: async () => {
    if (!(await confirmBox({ title: '清除所有資料？', body: `會刪掉 ${state.sessions.length} 筆訓練紀錄，並把動作和設定還原成預設值。`, ok: '繼續', danger: true }))) return;
    if (!(await confirmBox({ title: '真的要清除嗎？', body: '清除後無法復原。如果還沒匯出備份，請先按取消。', ok: '全部清除', danger: true }))) return;
    try { localStorage.removeItem(KEY); } catch (e) { /* 忽略 */ }
    state = freshState();
    pickLetters = null;
    save(); applySettings(); restStop(); render(); toast('已清除所有資料');
  }
};

document.addEventListener('click', e => {
  Device.unlock();
  const tip = e.target.closest('[data-tip]');
  if (tip) { showTip(tip); return; }
  const el = e.target.closest('[data-act]');
  if (el) { if (!el.disabled && actions[el.dataset.act]) actions[el.dataset.act](el, e); return; }
  if (e.target === modalEl) closeModal(false);
});

function showTip(el) {
  const wrap = el.closest('.chart-wrap');
  if (!wrap) return;
  $('.chart-tip', wrap).textContent = el.dataset.tip;
  wrap.querySelectorAll('.c-hit.on').forEach(x => x.classList.remove('on'));
  el.classList.add('on');
}
document.addEventListener('focusin', e => { if (e.target.matches && e.target.matches('[data-tip]')) showTip(e.target); });
document.addEventListener('pointerover', e => { if (e.pointerType === 'mouse' && e.target.matches && e.target.matches('[data-tip]')) showTip(e.target); });

/* 記住「詳細姿勢」要展開還是收起來（toggle 事件不會往上傳，所以用捕獲階段） */
document.addEventListener('toggle', e => {
  if (e.target.matches && e.target.matches('details.rtedit')) {
    if (e.target.open) openRoutines.add(e.target.dataset.rt); else openRoutines.delete(e.target.dataset.rt);
  }
  if (e.target.matches && e.target.matches('details.more') && state.settings.showDetails !== e.target.open) {
    state.settings.showDetails = e.target.open;
    save();
  }
}, true);

/* ---------- 輸入欄位 ---------- */
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.reps != null && state.active) {
    const v = parseInt(el.value, 10);
    state.active.items[state.active.idx].sets[+el.dataset.reps].reps = isNaN(v) ? null : clamp(v, 0, 999);
    save();
  }
  if (el.dataset.check != null) {
    const all = [...modalEl.querySelectorAll('[data-check]')].every(c => c.checked);
    $('[data-act="go"]', modalEl).disabled = !all;
  }
});

function getPath(path) { return path.split('.').reduce((o, k) => o[k], state); }
function setPath(path, val) {
  const ks = path.split('.');
  const last = ks.pop();
  ks.reduce((o, k) => o[k], state)[last] = val;
}

document.addEventListener('change', e => {
  const el = e.target;
  if (el.id === 'importFile') { if (el.files[0]) importJson(el.files[0]); el.value = ''; return; }
  if (el.dataset.days) {
    const k = el.dataset.days;
    state.settings[k] = [...document.querySelectorAll(`input[data-days="${k}"]`)].filter(c => c.checked).map(c => +c.dataset.d);
    save();
    return;
  }
  const path = el.dataset.path;
  if (!path) return;
  const type = el.dataset.type;
  let v;
  if (type === 'int') {
    v = parseInt(el.value, 10);
    if (el.tagName === 'INPUT') {
      const mn = +el.min, mx = +el.max;
      v = clamp(isNaN(v) ? mn : v, mn, mx);
      el.value = v;
    }
  } else if (type === 'bool') v = el.checked;
  else if (type === 'lines') v = el.value.split('\n').map(s => s.trim()).filter(Boolean);
  else if (type === 'details') v = el.value.split('\n').map(s => s.trim()).filter(Boolean).map(s => {
    const k = s.search(/[：:]/);
    return k > 0 ? { label: s.slice(0, k).trim(), text: s.slice(k + 1).trim() } : { label: '補充', text: s };
  });
  else {
    v = el.value.trim();
    if (!v && el.dataset.keep) { el.value = getPath(path); return; }
  }
  setPath(path, v);

  /* 最少下數不能大於最多下數 */
  const m = path.match(/^(plans\.[A-Z]\.items\.\d+|routines\.\d+\.items\.\d+|exercises\.\d+)\.(min|max)$/);
  if (m) {
    const it = getPath(m[1]);
    if (it.min > it.max) {
      const other = m[2] === 'min' ? 'max' : 'min';
      it[other] = v;
      const sib = $(`[data-path="${m[1]}.${other}"]`);
      if (sib) sib.value = v;
    }
  }
  const pt = path.match(/^plans\.([A-Z])\.title$/);
  if (pt) { const sum = el.closest('details'); if (sum) $('summary', sum).textContent = pt[1] + '｜' + state.plans[pt[1]].title; }
  const rt = path.match(/^routines\.(\d+)\.title$/);
  if (rt) { const sum = el.closest('details'); if (sum) $('summary', sum).textContent = state.routines[+rt[1]].title; }
  const n = path.match(/^exercises\.(\d+)\.name$/);
  if (n) {
    const ex = state.exercises[+n[1]];
    document.querySelectorAll('select[data-path$=".exId"] option').forEach(o => { if (o.value === ex.id) o.textContent = ex.name; });
    const sum = el.closest('details');
    if (sum) $('summary', sum).textContent = ex.name;
  }
  save();
  if (path.startsWith('settings.')) applySettings();
  if (path.startsWith('tabata.')) { const t = $('#tb-total'); if (t) { t.textContent = mmss(tabataTotal()); $('#tb-desc').textContent = tabataDesc(); } }
});

/* ---------- 啟動 ---------- */
applySettings();
window.addEventListener('hashchange', route);
route();

if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
