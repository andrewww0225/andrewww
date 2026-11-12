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
const rirLabel = r => r === 3 ? '3 以上' : String(r);

/* ---------- 狀態 ---------- */
function freshState() {
  return {
    version: 1,
    settings: clone(DEFAULT_SETTINGS),
    tabata: clone(DEFAULT_TABATA),
    exercises: clone(DEFAULT_EXERCISES),
    plans: clone(DEFAULT_PLANS),
    sessions: [],
    active: null
  };
}

function normalize(d) {
  const s = freshState();
  if (!d || typeof d !== 'object') return s;
  if (d.settings && typeof d.settings === 'object') s.settings = { ...s.settings, ...d.settings };
  if (d.tabata && typeof d.tabata === 'object') s.tabata = { ...s.tabata, ...d.tabata };
  if (!Array.isArray(s.tabata.moves) || JSON.stringify(s.tabata.moves) === JSON.stringify(OLD_TABATA_MOVES)) s.tabata.moves = clone(DEFAULT_TABATA.moves);
  if (Array.isArray(d.exercises) && d.exercises.length) s.exercises = d.exercises;
  /* 舊資料沒有「詳細姿勢」：內建動作補上預設內容，自訂動作補空清單 */
  s.exercises.forEach(e => {
    if (!Array.isArray(e.details)) {
      const def = DEFAULT_EXERCISES.find(x => x.id === e.id);
      e.details = def ? clone(def.details) : [];
    }
  });
  if (d.plans && d.plans.A && d.plans.B && Array.isArray(d.plans.A.items) && Array.isArray(d.plans.B.items)) s.plans = d.plans;
  if (Array.isArray(d.sessions)) s.sessions = d.sessions.filter(x => x && Array.isArray(x.items) && typeof x.date === 'string');
  if (d.active && Array.isArray(d.active.items) && d.active.items.length) s.active = d.active;
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
function recommend() {
  const all = sessionsAsc();
  const last = all[all.length - 1];
  const today = ymd(new Date());
  const ws = weekStart(new Date());
  const weekCount = all.filter(s => parseYmd(s.date) >= ws).length;
  if (!last) return { plan: 'A', note: '還沒有訓練紀錄，從訓練日 A 開始。', weekCount };
  const plan = last.plan === 'A' ? 'B' : 'A';
  const gap = dayDiff(last.date, today);
  let note;
  if (gap <= 0) note = `今天已經練過訓練日 ${last.plan} 了。下一次是訓練日 ${plan}，中間至少隔一天。`;
  else if (gap === 1) note = `昨天剛練過訓練日 ${last.plan}，今天建議休息；明天再練訓練日 ${plan}。`;
  else note = `上次是 ${fmtDate(last.date)}的訓練日 ${last.plan}，已經隔了 ${gap} 天，今天換訓練日 ${plan}。`;
  return { plan, note, weekCount, rest: gap <= 1 };
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

/* ---------- 首頁 ---------- */
let chosenPlan = null;
function planListHtml(key) {
  const items = state.plans[key].items;
  if (!items.length) return '<p class="muted">這個訓練日還沒有動作，請到設定頁新增。</p>';
  return '<ol class="plan-list">' + items.map(it => {
    const ex = exById(it.exId);
    if (!ex) return '';
    const hint = progressHint(it.exId, it.band, it.max);
    return `<li><span class="pl-name">${esc(ex.name)}${hint ? ' <span class="badge">可以加難度</span>' : ''}</span>
      <span class="pl-meta">${it.band} kg · ${it.sets} 組 × ${it.min}–${it.max} 下</span></li>`;
  }).join('') + '</ol>';
}

VIEWS.home = () => {
  const rec = recommend();
  const pick = chosenPlan || rec.plan;
  const a = state.active;
  view.innerHTML = `
    <header class="top"><h1>彈力帶訓練</h1><a class="toplink" href="#/help">訓練原則</a></header>
    ${a ? `<section class="card notice">
      <h2>有一次還沒結束的訓練</h2>
      <p>訓練日 ${esc(a.plan)}，${fmtDate(a.date)} 開始，已完成 ${a.items.reduce((n, it) => n + itemDone(it), 0)} 組。</p>
      <div class="btn-row"><button type="button" class="btn primary" data-act="resume">繼續訓練</button>
      <button type="button" class="btn" data-act="discard">放棄</button></div>
    </section>` : ''}
    <section class="card">
      <p class="eyebrow">今天建議</p>
      <h2 class="rec">訓練日 ${rec.plan}<span>${esc(state.plans[rec.plan].title)}</span></h2>
      <p class="note">${esc(rec.note)}</p>
      <div class="seg" role="group" aria-label="選擇訓練日">
        ${['A', 'B'].map(k => `<button type="button" data-act="pick" data-plan="${k}" aria-pressed="${pick === k}">${k}｜${esc(state.plans[k].title)}</button>`).join('')}
      </div>
      ${planListHtml(pick)}
      ${a ? '' : `<button type="button" class="btn primary big" data-act="start">開始訓練日 ${pick}</button>`}
    </section>
    <p class="foot muted">本週已練 ${rec.weekCount} 次。目標每週 2 到 3 次，A 和 B 交替，中間至少隔一天。</p>`;
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
    items: state.plans[plan].items.filter(it => exById(it.exId)).map(it => ({
      exId: it.exId,
      name: exById(it.exId).name,
      band: it.band,
      min: it.min,
      max: it.max,
      targetSets: it.sets,
      sets: Array.from({ length: it.sets }, () => ({ done: false, reps: null, rir: null }))
    }))
  };
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
      <span class="wpos">訓練日 ${esc(a.plan)}・動作 ${i + 1}／${a.items.length}</span>
    </header>
    <div class="dots" aria-hidden="true">${a.items.map((x, k) => `<i class="${k === i ? 'on' : ''} ${itemDone(x) >= x.sets.length ? 'full' : ''}"></i>`).join('')}</div>
    <section class="card">
      <h2 class="ex-name">${esc(it.name)}</h2>
      <div class="chips"><span class="chip strong">${esc(bandLabel(it.band))}</span><span class="chip">${it.targetSets} 組 × ${it.min}–${it.max} 下</span></div>
      ${hint ? `<div class="hintbox"><strong>可以加難度</strong>
        <p>上次（${fmtDate(hint.session.date)}）每一組都做到 ${it.max} 下，餘力也不多。這次挑一種方式試試：</p>
        <ul>${PROGRESS_WAYS.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>` : ''}
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
    id: a.id, date: a.date, startedAt: a.startedAt, endedAt: Date.now(), plan: a.plan,
    items: a.items.map(it => ({ exId: it.exId, name: it.name, band: it.band, min: it.min, max: it.max, targetSets: it.targetSets, sets: it.sets }))
  };
  state.sessions.push(session);
  state.active = null;
  chosenPlan = null;
  save();
  restStop();
  const reps = session.items.reduce((n, it) => n + itemReps(it), 0);
  const mins = Math.max(1, Math.round((session.endedAt - session.startedAt) / 60000));
  const up = session.items.filter(canProgress);
  openModal(`<h2>訓練完成</h2>
    <p>訓練日 ${esc(session.plan)}：完成 ${done} 組、共 ${reps} 下，花了 ${mins} 分鐘。</p>
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
      <p class="sub">照 ZEROX FITNESS COACH 的 Tabata 影片。按「套用」會把下面的動作清單換成那一組。</p>
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
        ${numField('輪間休息（秒）', 'tabata.roundRest', 0, 600, t.roundRest)}
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
      <summary><span class="s-title">${fmtDate(s.date)}　訓練日 ${esc(s.plan)}</span>
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
function planEditorHtml(key) {
  const p = state.plans[key];
  return `<section class="card">
    <h2>訓練日 ${key}</h2>
    <label class="field"><span>名稱</span><input type="text" data-path="plans.${key}.title" data-keep="1" value="${esc(p.title)}"></label>
    ${p.items.map((it, i) => `<div class="pitem">
      <label class="field"><span>動作 ${i + 1}</span>
        <select data-path="plans.${key}.items.${i}.exId">${state.exercises.map(e => `<option value="${esc(e.id)}" ${e.id === it.exId ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select></label>
      <label class="field"><span>帶子</span>
        <select data-path="plans.${key}.items.${i}.band" data-type="int">${BANDS.map(b => `<option value="${b.kg}" ${b.kg === it.band ? 'selected' : ''}>${esc(b.label)}</option>`).join('')}</select></label>
      <div class="grid3">
        ${numField('組數', `plans.${key}.items.${i}.sets`, 1, 10, it.sets)}
        ${numField('最少下數', `plans.${key}.items.${i}.min`, 1, 100, it.min)}
        ${numField('最多下數', `plans.${key}.items.${i}.max`, 1, 100, it.max)}
      </div>
      <div class="btn-row">
        <button type="button" class="btn small" data-act="pMove" data-plan="${key}" data-i="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''}>上移</button>
        <button type="button" class="btn small" data-act="pMove" data-plan="${key}" data-i="${i}" data-d="1" ${i === p.items.length - 1 ? 'disabled' : ''}>下移</button>
        <button type="button" class="btn small danger-text" data-act="pDel" data-plan="${key}" data-i="${i}">移除</button>
      </div>
    </div>`).join('')}
    <button type="button" class="btn" data-act="pAdd" data-plan="${key}">＋ 新增動作到訓練日 ${key}</button>
  </section>`;
}

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
    ${planEditorHtml('A')}
    ${planEditorHtml('B')}
    <section class="card">
      <h2>動作說明</h2>
      ${state.exercises.map((e, i) => `<details class="exedit">
        <summary>${esc(e.name)}</summary>
        <label class="field"><span>名稱</span><input type="text" data-path="exercises.${i}.name" data-keep="1" value="${esc(e.name)}"></label>
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
    <section class="card"><h2>頻率</h2><p>每週 2 到 3 次，訓練日 A 和 B 交替，中間至少隔一天。首頁會依最近一次的紀錄建議今天做哪一天，也可以自己切換。</p></section>
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

  pick: el => { chosenPlan = el.dataset.plan; render(); },
  start: () => {
    const plan = chosenPlan || recommend().plan;
    if (!state.plans[plan].items.some(it => exById(it.exId))) { toast('這個訓練日沒有動作，請先到設定頁新增'); return; }
    startChecklist(plan);
  },
  go: el => { closeModal(); createActive(el.dataset.plan); location.hash = '#/workout'; },
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
    if (!(await confirmBox({ title: '刪除這筆紀錄？', body: `${fmtDate(s.date)} 的訓練日 ${s.plan}，刪除後無法復原。`, ok: '刪除', danger: true }))) return;
    state.sessions = state.sessions.filter(x => x.id !== s.id);
    save(); render(); toast('已刪除');
  },

  pickEx: el => { progressEx = el.dataset.id; render(); },

  pMove: el => {
    const items = state.plans[el.dataset.plan].items, i = +el.dataset.i, k = i + (+el.dataset.d);
    if (k < 0 || k >= items.length) return;
    [items[i], items[k]] = [items[k], items[i]];
    save(); render();
  },
  pDel: el => { state.plans[el.dataset.plan].items.splice(+el.dataset.i, 1); save(); render(); },
  pAdd: el => {
    state.plans[el.dataset.plan].items.push({ exId: state.exercises[0].id, band: 5, sets: 3, min: 10, max: 15 });
    save(); render();
  },
  exAdd: () => {
    state.exercises.push({ id: 'ex' + Date.now(), name: '新動作', how: '', mistakes: '', details: [] });
    save(); render();
    const all = document.querySelectorAll('.exedit');
    const last = all[all.length - 1];
    last.open = true;
    last.scrollIntoView({ block: 'center' });
  },
  exDel: async el => {
    const i = +el.dataset.i, ex = state.exercises[i];
    if (state.exercises.length <= 1) { toast('至少要留一個動作'); return; }
    if (['A', 'B'].some(k => state.plans[k].items.some(it => it.exId === ex.id))) { toast('這個動作還在訓練日裡，請先從訓練日移除'); return; }
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
    chosenPlan = null;
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
  const m = path.match(/^(plans\.[AB]\.items\.\d+)\.(min|max)$/);
  if (m) {
    const it = getPath(m[1]);
    if (it.min > it.max) {
      const other = m[2] === 'min' ? 'max' : 'min';
      it[other] = v;
      const sib = $(`[data-path="${m[1]}.${other}"]`);
      if (sib) sib.value = v;
    }
  }
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
