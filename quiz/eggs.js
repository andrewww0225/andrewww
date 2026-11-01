/* ---------- 彩蛋：練習、模擬考、題庫頁隨機冒出 mat/ 的圖 ---------- */
const rand = (a, b) => a + Math.random() * (b - a);
const eggActive = () => /^#\/s\/[^/]+\/(practice|exam|wrong|browse)$/.test(location.hash);
// 有配音效的圖：出現時依序播放這些音檔，圖會停到音效播完
const EGG_SOUNDS = {
  '2760547738392319602.webp': ['gym1.mp3', 'gym2.mp3'],
  '4701859718068680235.webp': ['suck.m4a']
};
const EGG_VOLUME = 0.3; // 音量 0～1，1 是原檔音量
const EGG_SOUND_VER = '3'; // 換掉音檔內容時改這個數字，瀏覽器才不會播到快取的舊檔
// 每張圖的出現比例（%，總和 100）：預設平均，用戶在科目頁調過就用 prefs.eggPct，新加的圖先給平均值
function eggPcts() {
  const list = window.QUIZ_MAT || [];
  const w = list.map(n => prefs.eggPct ? (prefs.eggPct[n] ?? 100 / list.length) : 1);
  const sum = w.reduce((a, b) => a + b, 0);
  return Object.fromEntries(list.map((n, i) => [n, sum ? w[i] / sum * 100 : 100 / list.length]));
}
function pickEgg(list) {
  const pct = eggPcts();
  const total = list.reduce((s, n) => s + pct[n], 0);
  if (!total) return list[Math.floor(Math.random() * list.length)];
  let r = Math.random() * total;
  for (const n of list) if ((r -= pct[n]) < 0) return n;
  return list[list.length - 1];
}
// 把第 i 張設成 p%，其他張照原本的比例分掉剩下的（原本都是 0 就平均分）
function setEggPct(i, p) {
  const list = window.QUIZ_MAT, cur = eggPcts(), name = list[i];
  p = Math.min(100, Math.max(0, +p || 0));
  const restOld = 100 - cur[name], restNew = 100 - p, others = list.length - 1;
  prefs.eggPct = Object.fromEntries(list.map(n => [n, n === name ? p
    : restOld > 0.0001 ? cur[n] * restNew / restOld : restNew / others]));
  savePrefs();
  refreshEggPct();
}
const bumpEggPct = (i, d) => setEggPct(i, eggPcts()[window.QUIZ_MAT[i]] + d);
function resetEggPct() {
  prefs.eggPct = null;
  savePrefs();
  refreshEggPct();
}
// 只更新數字，不重畫整頁（面板保持展開）
function refreshEggPct() {
  const pct = eggPcts();
  document.querySelectorAll('[data-egg]').forEach(el => { el.value = pct[window.QUIZ_MAT[+el.dataset.egg]].toFixed(1); });
}
function eggPanel() {
  const list = window.QUIZ_MAT || [];
  if (!list.length) return '';
  const pct = eggPcts();
  // 縮圖等面板展開才載入，沒打開就不會下載 30 張圖
  return `<details class="egg-pct" ontoggle="this.querySelectorAll('img[data-src]').forEach(i => { i.src = i.dataset.src; i.removeAttribute('data-src'); })"><summary>🎛️ 調整每張圖的出現比例</summary>
    <p class="muted">調高一張，其他張會照原本的比例一起降，總和維持 100%。</p>
    <div class="egg-pct-list">${list.map((n, i) => `<div class="egg-pct-row">
      <img data-src="mat/${encodeURIComponent(n)}" alt="">
      <button class="pct-btn" onclick="bumpEggPct(${i},-1)" aria-label="減少 1%">−</button>
      <input type="number" min="0" max="100" step="0.1" data-egg="${i}" value="${pct[n].toFixed(1)}" onchange="setEggPct(${i}, this.value)">%
      <button class="pct-btn" onclick="bumpEggPct(${i},1)" aria-label="增加 1%">＋</button></div>`).join('')}</div>
    <div class="row"><button class="link-btn" onclick="resetEggPct()">恢復全部平均</button></div></details>`;
}
let eggAudio = null;
function stopEggAudio() {
  if (eggAudio) { eggAudio.onended = null; eggAudio.pause(); eggAudio = null; }
}
// 先讀到每個音檔的長度，回傳 Audio 物件陣列（讀不到的檔案跳過，全都讀不到就只出圖）
function loadSounds(files) {
  return Promise.all(files.map(f => new Promise(r => {
    const a = new Audio('mat/' + encodeURIComponent(f) + '?v=' + EGG_SOUND_VER);
    a.preload = 'auto';
    a.volume = EGG_VOLUME;
    a.onloadedmetadata = () => r(a);
    a.onerror = () => r(null);
  }))).then(as => as.filter(Boolean));
}
function playSounds(audios) {
  stopEggAudio();
  let i = 0;
  const next = () => {
    if (i >= audios.length || !prefs.eggs) return (eggAudio = null);
    eggAudio = audios[i++];
    eggAudio.onended = next;
    eggAudio.play().catch(() => {}); // 瀏覽器擋自動播放時就安靜出圖
  };
  next();
}
function showEgg(pick) {
  const list = window.QUIZ_MAT || [];
  if (!list.length || !prefs.eggs || !eggActive() || document.hidden) return;
  let name = pick || pickEgg(list);
  // 音效還在播時不再抽到有音效的圖，避免聲音接連重複
  if (!pick && EGG_SOUNDS[name] && eggAudio) {
    const quiet = list.filter(n => !EGG_SOUNDS[n]);
    if (quiet.length) name = pickEgg(quiet);
  }
  const img = new Image();
  img.className = 'egg';
  img.alt = '';
  const sounds = EGG_SOUNDS[name] ? loadSounds(EGG_SOUNDS[name]) : Promise.resolve([]);
  img.onload = () => sounds.then(audios => {
    if (!eggActive() || !prefs.eggs) return;
    const vw = innerWidth, vh = innerHeight;
    const size = Math.round(rand(60, Math.min(260, vw * .35)));
    const gutter = (vw - 760) / 2; // 題目欄兩側的空白
    let x;
    if (gutter >= size + 16) {
      // 寬螢幕：整張放在左右空白處
      x = Math.random() < .5 ? rand(8, gutter - size - 8) : vw - gutter + rand(8, gutter - size - 8);
    } else {
      // 手機：從左右邊緣探出頭，只露出一部分
      const peek = rand(.3, .5) * size;
      x = Math.random() < .5 ? peek - size : vw - peek;
    }
    const soundLen = audios.reduce((t, a) => t + a.duration, 0);
    const dur = soundLen ? soundLen + .6 : rand(2.5, 5);
    img.style.cssText = `width:${size}px;left:${Math.round(x)}px;top:${Math.round(rand(.08, .85) * vh - size / 2)}px;` +
      `--rot:${Math.round(rand(-20, 20))}deg;--dur:${dur.toFixed(2)}s;` +
      `--sx:${x + size / 2 < vw / 2 ? -size : size}px`; // 從比較近的那一側滑進來
    document.body.appendChild(img);
    setTimeout(() => img.remove(), dur * 1000 + 100);
    if (audios.length) playSounds(audios);
  });
  img.src = 'mat/' + encodeURIComponent(name);
}
const eggBtn = () => (window.QUIZ_MAT || []).length ? `<button class="egg-btn ${prefs.eggs ? '' : 'off'}"
  onclick="toggleEggs()" aria-pressed="${prefs.eggs}" title="測驗途中隨機冒出圖片">${prefs.eggs ? '🎉 彩蛋：開' : '🙈 彩蛋：關'}</button>` : '';
function toggleEggs() {
  prefs.eggs = !prefs.eggs;
  savePrefs();
  if (!prefs.eggs) { document.querySelectorAll('.egg').forEach(e => e.remove()); stopEggAudio(); }
  // 只換按鈕本身，不重畫整頁（模擬考作答中也不會被清掉）
  document.querySelectorAll('.egg-btn').forEach(b => { b.outerHTML = eggBtn(); });
  const cb = document.getElementById('eggToggle');
  if (cb) cb.checked = prefs.eggs;
}
window.addEventListener('hashchange', () => { if (!eggActive()) stopEggAudio(); });
(function eggLoop() {
  setTimeout(() => { showEgg(); eggLoop(); }, rand(30, 90) * 1000); // 每 30～90 秒隨機一次
})();
