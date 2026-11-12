'use strict';
/* 裝置功能：螢幕恆亮（Screen Wake Lock）、提示音（Web Audio）、震動（Vibration）。
   三者都先做功能偵測，不支援時安靜略過。用法依 MDN 文件：
   - Wake Lock：navigator.wakeLock.request('screen')，只能在 HTTPS／localhost 且頁面可見時取得；
     頁面被切到背景時系統會自動釋放，回到前景要重新請求。
   - Web Audio：AudioContext 要在使用者手勢（點按）裡建立或 resume()；
     每個 OscillatorNode 只能 start() 一次，所以每個提示音都建立新的節點。
   - Vibration：navigator.vibrate(pattern)，需要使用者先跟頁面互動過；iOS Safari 沒有這個 API。 */

const Device = (() => {
  let ctx = null;
  let sentinel = null;
  let wakeWanted = false;
  const opts = { sound: true, vibrate: true };

  const support = {
    wakeLock: 'wakeLock' in navigator,
    audio: !!(window.AudioContext || window.webkitAudioContext),
    vibrate: typeof navigator.vibrate === 'function'
  };

  /* 在點按事件裡呼叫，讓之後計時器觸發的提示音可以播放 */
  function unlock() {
    if (!support.audio) return;
    try {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state !== 'running') ctx.resume().catch(() => {});
    } catch (e) { /* 忽略 */ }
  }

  function tone(freq, start, dur, vol) {
    const t0 = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }

  const SOUNDS = {
    tick: [[880, 0, 0.09]],
    go: [[988, 0, 0.14], [1319, 0.16, 0.3]],
    rest: [[660, 0, 0.3]],
    end: [[784, 0, 0.16], [784, 0.24, 0.16], [1047, 0.48, 0.5]]
  };
  const VIBES = {
    tick: 40,
    go: [250],
    rest: [100, 80, 100],
    end: [300, 120, 300, 120, 500]
  };

  function signal(kind) {
    if (opts.sound && ctx) {
      try {
        if (ctx.state !== 'running') ctx.resume().catch(() => {});
        SOUNDS[kind].forEach(([f, s, d]) => tone(f, s, d, 0.5));
      } catch (e) { /* 忽略 */ }
    }
    if (opts.vibrate && support.vibrate && kind !== 'tick') {
      try { navigator.vibrate(VIBES[kind]); } catch (e) { /* 忽略 */ }
    }
  }

  async function acquire() {
    if (!support.wakeLock || !wakeWanted || sentinel || document.visibilityState !== 'visible') return;
    try {
      const s = await navigator.wakeLock.request('screen');
      s.addEventListener('release', () => { if (sentinel === s) sentinel = null; });
      sentinel = s;
      if (!wakeWanted) release();
    } catch (e) { /* 省電模式等情況會被拒絕，忽略 */ }
  }

  function release() {
    const s = sentinel;
    sentinel = null;
    if (s) s.release().catch(() => {});
  }

  function keepAwake(on) {
    wakeWanted = !!on;
    if (wakeWanted) acquire(); else release();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') acquire();
  });

  return {
    support, unlock, signal, keepAwake,
    setOptions(o) { opts.sound = !!o.sound; opts.vibrate = !!o.vibrate; },
    isAwake: () => !!sentinel
  };
})();
