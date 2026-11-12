'use strict';
/* 用 SVG 字串畫圖表，不依賴任何外部函式庫。顏色由 style.css 的 CSS 變數決定（淺色／深色各一組）。 */

const Charts = (() => {
  const W = 340, H = 190;
  const P = { l: 32, r: 14, t: 18, b: 26 };
  const IW = W - P.l - P.r, IH = H - P.t - P.b;
  const escA = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function axis(maxV) {
    const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
    const step = steps.find(s => maxV / s <= 4) || Math.ceil(maxV / 4);
    const top = Math.max(step, Math.ceil(maxV / step) * step);
    const ticks = [];
    for (let v = 0; v <= top; v += step) ticks.push(v);
    return { top, ticks };
  }

  const yOf = (v, top) => P.t + IH - (v / top) * IH;

  function grid(ax) {
    return ax.ticks.map(v => {
      const y = yOf(v, ax.top).toFixed(1);
      return `<line class="${v === 0 ? 'c-axis' : 'c-grid'}" x1="${P.l}" x2="${W - P.r}" y1="${y}" y2="${y}"/>` +
        `<text class="c-tick" x="${P.l - 6}" y="${y}" dy="3.5" text-anchor="end">${v}</text>`;
    }).join('');
  }

  function open(label) {
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escA(label)}">`;
  }

  /* points: [{label, value, tip}] */
  function line(points, label) {
    const n = points.length;
    const ax = axis(Math.max(1, ...points.map(p => p.value)));
    const xOf = i => n === 1 ? P.l + IW / 2 : P.l + (i / (n - 1)) * IW;
    const xy = points.map((p, i) => [xOf(i), yOf(p.value, ax.top)]);
    let s = open(label) + grid(ax);
    if (n > 1) s += `<path class="c-line" d="${xy.map(([x, y], i) => (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1)).join(' ')}"/>`;
    xy.forEach(([x, y], i) => {
      const last = i === n - 1;
      if (n <= 12 || last) s += `<circle class="c-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${last ? 4.5 : 3.5}"/>`;
    });
    const [lx, ly] = xy[n - 1];
    s += `<text class="c-val" x="${lx.toFixed(1)}" y="${(ly - 9).toFixed(1)}" text-anchor="${n === 1 ? 'middle' : 'end'}">${points[n - 1].value}</text>`;
    const marks = n === 1 ? [0] : n < 5 ? [0, n - 1] : [0, Math.floor((n - 1) / 2), n - 1];
    marks.forEach(i => {
      const anchor = n === 1 ? 'middle' : i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle';
      s += `<text class="c-tick" x="${xOf(i).toFixed(1)}" y="${H - 8}" text-anchor="${anchor}">${escA(points[i].label)}</text>`;
    });
    const hitW = n === 1 ? IW : IW / (n - 1);
    xy.forEach(([x], i) => {
      s += `<rect class="c-hit" x="${(x - hitW / 2).toFixed(1)}" y="${P.t}" width="${hitW.toFixed(1)}" height="${IH}" data-tip="${escA(points[i].tip)}" data-x="${x.toFixed(1)}" tabindex="0"/>`;
    });
    return s + '</svg>';
  }

  /* bars: [{label, value, tip}] */
  function bars(items, label, minTop) {
    const n = items.length;
    const ax = axis(Math.max(minTop || 1, ...items.map(b => b.value)));
    const slot = IW / n;
    const bw = Math.min(24, slot - 2);
    let s = open(label) + grid(ax);
    items.forEach((b, i) => {
      const cx = P.l + slot * (i + 0.5);
      const x = cx - bw / 2;
      const y0 = yOf(0, ax.top);
      if (b.value > 0) {
        const y = yOf(b.value, ax.top);
        const r = Math.min(4, (y0 - y) / 2);
        s += `<path class="c-bar" d="M${x.toFixed(1)} ${y0} V${(y + r).toFixed(1)} q0 ${-r} ${r} ${-r} h${(bw - 2 * r).toFixed(1)} q${r} 0 ${r} ${r} V${y0} Z"/>`;
        s += `<text class="c-val" x="${cx.toFixed(1)}" y="${(y - 5).toFixed(1)}" text-anchor="middle">${b.value}</text>`;
      }
      s += `<text class="c-tick" x="${cx.toFixed(1)}" y="${H - 8}" text-anchor="middle">${escA(b.label)}</text>`;
      s += `<rect class="c-hit" x="${(P.l + slot * i).toFixed(1)}" y="${P.t}" width="${slot.toFixed(1)}" height="${IH}" data-tip="${escA(b.tip)}" tabindex="0"/>`;
    });
    return s + '</svg>';
  }

  return { line, bars };
})();
