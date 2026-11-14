'use strict';
/* 動作示意圖：用關節座標畫簡筆人形，每個動作有「開始」和「結束」兩個姿勢，彈力帶用另一個顏色。
   座標在 140×170 的格子裡，地板在 y=160。正面圖左右各一隻手腳（l、r）；側面圖預設只畫 r 那一側。 */

const Figures = (() => {
  /* 正面站姿 */
  const F = o => Object.assign({
    head: [70, 30], neck: [70, 42], lSh: [56, 48], rSh: [84, 48], hip: [70, 98],
    lHip: [62, 100], rHip: [78, 100], lKn: [60, 130], rKn: [80, 130], lFt: [58, 160], rFt: [82, 160],
    lEl: [52, 72], lHa: [50, 96], rEl: [88, 72], rHa: [90, 96]
  }, o);
  /* 側面站姿（面向右邊） */
  const S = o => Object.assign({
    side: true, head: [70, 30], neck: [70, 42], rSh: [70, 48], hip: [70, 98], rHip: [70, 98],
    rKn: [71, 130], rFt: [72, 160], rEl: [72, 72], rHa: [74, 96]
  }, o);
  /* 側面、身體前傾 */
  const BENT = { side: true, head: [104, 64], neck: [94, 72], rSh: [90, 76], hip: [56, 98], rHip: [56, 98], rKn: [64, 130], rFt: [60, 160] };
  const B = o => Object.assign({}, BENT, o);
  /* 正面、身體前傾（上半身看起來比較短） */
  const FB = o => F(Object.assign({
    head: [70, 62], neck: [70, 74], lSh: [56, 78], rSh: [84, 78], hip: [70, 104],
    lHip: [62, 106], rHip: [78, 106], lKn: [58, 132], rKn: [82, 132]
  }, o));
  /* 彈力帶是環狀的，有三種畫法：
     { loop: [...] }  整圈攤開：例如雙腳踩住下緣、雙手抓住上緣，四個點連成一圈
     { sag: [a, b] }  雙手只抓其中一層，另一層垂在下面
     [a, b, ...]      兩層疊在一起（或從側面看過去）：畫成壓扁的環 */
  const STAND_ON = [{ loop: ['lHa', 'lFt', 'rFt', 'rHa'] }];   // 雙腳踩住下緣、雙手抓住上緣
  const HOLD = { rEl: [86, 60], rHa: [78, 46] };      // 側面：手把帶子固定在肩膀前

  const FIGS = {
    lateral: {
      a: F(), b: F({ lEl: [38, 50], lHa: [20, 52], rEl: [102, 50], rHa: [120, 52] }), band: STAND_ON
    },
    pullapart: {
      a: F({ lEl: [54, 62], lHa: [62, 56], rEl: [86, 62], rHa: [78, 56] }),
      b: F({ lEl: [38, 52], lHa: [20, 52], rEl: [102, 52], rHa: [120, 52] }),
      band: [['lHa', 'rHa']]
    },
    row: {
      a: { side: true, head: [46, 92], neck: [47, 104], rSh: [47, 110], hip: [50, 152], rHip: [50, 152], rKn: [86, 146], rFt: [118, 152], rToe: [118, 138], rEl: [70, 120], rHa: [92, 128] },
      b: { side: true, head: [46, 92], neck: [47, 104], rSh: [47, 110], hip: [50, 152], rHip: [50, 152], rKn: [86, 146], rFt: [118, 152], rToe: [118, 138], rEl: [34, 130], rHa: [58, 132] },
      band: [['rHa', [118, 145]]]
    },
    press: {
      a: F({ lEl: [44, 70], lHa: [48, 46], rEl: [96, 70], rHa: [92, 46] }),
      b: F({ lEl: [48, 26], lHa: [54, 4], rEl: [92, 26], rHa: [86, 4] }),
      band: STAND_ON
    },
    chestpress: {
      a: S({ lHip: [70, 98], lKn: [64, 130], lFt: [56, 160], rKn: [78, 130], rFt: [88, 160], rEl: [58, 68], rHa: [80, 58] }),
      b: S({ lHip: [70, 98], lKn: [64, 130], lFt: [56, 160], rKn: [78, 130], rFt: [88, 160], rEl: [92, 56], rHa: [114, 54] }),
      band: [[[63, 54], 'rHa']]
    },
    frontraise: {
      a: S(), b: S({ rEl: [92, 50], rHa: [114, 50] }), band: [['rHa', [80, 160]]]
    },
    reversefly: {
      a: FB({ lEl: [58, 96], lHa: [62, 112], rEl: [82, 96], rHa: [78, 112] }),
      b: FB({ lEl: [38, 76], lHa: [20, 74], rEl: [102, 76], rHa: [120, 74] }),
      band: STAND_ON
    },
    extrot: {
      a: F({ lEl: [54, 74], lHa: [63, 80], rEl: [86, 74], rHa: [77, 80] }),
      b: F({ lEl: [54, 74], lHa: [32, 78], rEl: [86, 74], rHa: [108, 78] }),
      band: [{ sag: ['lHa', 'rHa'] }]
    },
    bentrow: {
      a: B({ rEl: [90, 100], rHa: [88, 122] }), b: B({ rEl: [70, 64], rHa: [80, 90] }), band: [['rHa', [68, 160]]]
    },
    pulldown: {
      a: F({ lEl: [46, 24], lHa: [42, 4], rEl: [94, 24], rHa: [98, 4] }),
      b: F({ lEl: [40, 72], lHa: [30, 46], rEl: [100, 72], rHa: [110, 46] }),
      band: [['lHa', 'rHa']]
    },
    shrug: {
      a: F(),
      b: F({ neck: [70, 40], lSh: [56, 41], rSh: [84, 41], lEl: [52, 66], lHa: [50, 90], rEl: [88, 66], rHa: [90, 90], arrows: [[42, 56, 42, 38], [98, 56, 98, 38]] }),
      band: STAND_ON
    },
    curl: {
      a: S(), b: S({ rEl: [72, 72], rHa: [88, 52] }), band: [['rHa', [80, 160]]]
    },
    triext: {
      a: S({ head: [72, 30], lSh: [70, 48], lEl: [61, 70], lHa: [63, 92], rEl: [76, 24], rHa: [58, 42] }),
      b: S({ head: [72, 30], lSh: [70, 48], lEl: [61, 70], lHa: [63, 92], rEl: [76, 24], rHa: [78, 2] }),
      band: [['lHa', 'rHa']]
    },
    trikick: {
      a: B({ rEl: [68, 84], rHa: [78, 108] }), b: B({ rEl: [68, 84], rHa: [44, 92] }), band: [['rHa', [68, 160]]]
    },
    pushup: {
      a: { side: true, noFeet: true, head: [122, 110], neck: [111, 117], rSh: [106, 120], hip: [62, 132], rHip: [62, 132], rKn: [40, 141], rFt: [18, 156], rEl: [107, 140], rHa: [108, 160], band: [[[108, 160], [97, 116]]] },
      b: { side: true, noFeet: true, head: [122, 136], neck: [111, 142], rSh: [106, 144], hip: [62, 147], rHip: [62, 147], rKn: [40, 151], rFt: [18, 157], rEl: [88, 134], rHa: [108, 160], band: [[[108, 160], [97, 140]]] }
    },
    chestfly: {
      a: F({ lEl: [40, 55], lHa: [22, 56], rEl: [100, 55], rHa: [118, 56], band: [[[22, 52], [56, 44], [84, 44], [118, 52]]] }),
      b: F({ lEl: [48, 68], lHa: [65, 60], rEl: [92, 68], rHa: [75, 60], band: [[[65, 56], [50, 50], [56, 44], [84, 44], [90, 50], [75, 56]]] })
    },
    squat: {
      a: S(HOLD),
      b: { side: true, head: [72, 66], neck: [68, 78], rSh: [66, 84], hip: [50, 120], rHip: [50, 120], rKn: [84, 124], rFt: [72, 160], rEl: [84, 96], rHa: [76, 82] },
      band: [['rHa', [80, 160]]]
    },
    deadlift: {
      a: { side: true, head: [104, 72], neck: [94, 80], rSh: [90, 84], hip: [54, 102], rHip: [54, 102], rKn: [68, 130], rFt: [64, 160], rEl: [89, 106], rHa: [86, 128], band: [['rHa', [72, 160]]] },
      b: S({ band: [['rHa', [80, 160]]] })
    },
    splitsquat: {
      a: { side: true, head: [68, 30], neck: [68, 42], rSh: [68, 48], hip: [68, 98], rHip: [68, 98], rKn: [84, 128], rFt: [92, 160], lHip: [68, 98], lKn: [54, 130], lFt: [38, 154], lToe: [36, 160], rEl: [84, 60], rHa: [76, 46] },
      b: { side: true, head: [68, 54], neck: [68, 66], rSh: [68, 72], hip: [68, 120], rHip: [68, 120], rKn: [96, 124], rFt: [92, 160], lHip: [68, 120], lKn: [52, 150], lFt: [28, 152], lToe: [26, 160], rEl: [84, 84], rHa: [76, 70] },
      band: [['rHa', [100, 160]]]
    },
    bridge: {
      a: { side: true, noFeet: true, head: [18, 150], neck: [30, 152], rSh: [34, 152], hip: [80, 152], rHip: [80, 152], rKn: [104, 124], rFt: [122, 158], rEl: [54, 156], rHa: [72, 158], band: [[[72, 158], [80, 145], [90, 158]]] },
      b: { side: true, noFeet: true, head: [18, 150], neck: [30, 151], rSh: [34, 150], hip: [82, 128], rHip: [82, 128], rKn: [106, 120], rFt: [122, 158], rEl: [54, 156], rHa: [72, 158], band: [[[72, 158], [82, 121], [94, 158]]] }
    },
    legkick: {
      a: { side: true, noFeet: true, head: [122, 104], neck: [110, 112], rSh: [104, 116], hip: [58, 116], rHip: [58, 116], lHip: [58, 116], lKn: [60, 158], lFt: [30, 158], rKn: [72, 146], rFt: [46, 148], rEl: [107, 137], rHa: [110, 158] },
      b: { side: true, noFeet: true, head: [122, 104], neck: [110, 112], rSh: [104, 116], hip: [58, 116], rHip: [58, 116], lHip: [58, 116], lKn: [60, 158], lFt: [30, 158], rKn: [34, 114], rFt: [10, 108], rEl: [107, 137], rHa: [110, 158] },
      band: [['rFt', 'rHa']]
    },
    lateralwalk: {
      a: F({ head: [70, 36], neck: [70, 48], lSh: [56, 54], rSh: [84, 54], hip: [70, 102], lHip: [62, 104], rHip: [78, 104], lKn: [56, 132], rKn: [84, 132], lFt: [56, 160], rFt: [84, 160], lEl: [50, 76], lHa: [64, 88], rEl: [90, 76], rHa: [76, 88] }),
      b: F({ head: [70, 36], neck: [70, 48], lSh: [56, 54], rSh: [84, 54], hip: [70, 102], lHip: [62, 104], rHip: [78, 104], lKn: [44, 132], rKn: [84, 132], lFt: [34, 160], rFt: [84, 160], lEl: [50, 76], lHa: [64, 88], rEl: [90, 76], rHa: [76, 88], arrows: [[30, 144, 10, 144]] }),
      band: [{ loop: ['lFt', 'rHa', 'lHa', 'rFt'] }]   // 扭成 8 字形：下面的圈踩在腳下，上面的圈抓在手上
    },
    calf: {
      a: S(HOLD),
      b: S({ head: [70, 22], neck: [70, 34], rSh: [70, 40], hip: [70, 90], rHip: [70, 90], rKn: [71, 122], rFt: [72, 150], rToe: [82, 160], rEl: [86, 52], rHa: [78, 38] }),
      band: [['rHa', [82, 160]]]
    },
    woodchop: {
      a: F({ lEl: [46, 72], lHa: [46, 96], rEl: [70, 78], rHa: [50, 99] }),
      b: F({ lEl: [80, 44], lHa: [102, 20], rEl: [102, 42], rHa: [107, 22] }),
      band: [['lFt', 'lHa']]
    }
  };

  const pt = (p, v) => typeof v === 'string' ? p[v] : v;
  const path = (p, pts) => pts.map(v => pt(p, v)).filter(Boolean).map(([x, y]) => `${x},${y}`).join(' ');

  function bandSvg(p, b) {
    if (b.loop) return `<polygon class="fg-band" points="${path(p, b.loop)}"/>`;
    if (b.sag) {
      const [x1, y1] = pt(p, b.sag[0]), [x2, y2] = pt(p, b.sag[1]);
      const drop = 16 + Math.max(0, 60 - Math.abs(x2 - x1)) * 0.5;   // 手越靠近，垂下來的那一層越鬆
      return `<path class="fg-band" d="M${x1} ${y1} L${x2} ${y2} Q${(x1 + x2) / 2} ${Math.max(y1, y2) + drop} ${x1} ${y1} Z"/>`;
    }
    const pts = path(p, b);
    return `<polyline class="fg-band flat" points="${pts}"/><polyline class="fg-band-in" points="${pts}"/>`;
  }

  function pose(p, band, dx, label) {
    const lines = [];
    const add = pts => { if (pts.every(k => p[k])) lines.push(path(p, pts)); };
    add(['neck', 'hip']);
    add(['lSh', 'rSh']);
    add(['lHip', 'rHip']);
    ['l', 'r'].forEach(s => {
      add([s + 'Sh', s + 'El', s + 'Ha']);
      add([s + 'Hip', s + 'Kn', s + 'Ft']);
      const ft = p[s + 'Ft'];
      if (ft && !p.noFeet) {
        const toe = p[s + 'Toe'] || (p.side ? [ft[0] + 10, ft[1]] : [ft[0] + (s === 'l' ? -6 : 6), ft[1]]);
        lines.push(`${ft[0]},${ft[1]} ${toe[0]},${toe[1]}`);
      }
    });
    const hx = p.head[0], hy = p.head[1];
    const arrows = (p.arrows || []).map(([x1, y1, x2, y2]) => {
      const a = Math.atan2(y2 - y1, x2 - x1), h = 6;
      const w1 = [x2 - h * Math.cos(a - 0.5), y2 - h * Math.sin(a - 0.5)], w2 = [x2 - h * Math.cos(a + 0.5), y2 - h * Math.sin(a + 0.5)];
      return `<path class="fg-arrow" d="M${x1} ${y1} L${x2} ${y2} M${w1[0].toFixed(1)} ${w1[1].toFixed(1)} L${x2} ${y2} L${w2[0].toFixed(1)} ${w2[1].toFixed(1)}"/>`;
    }).join('');
    return `<g transform="translate(${dx} 14)">
      <line class="fg-floor" x1="4" x2="136" y1="161.5" y2="161.5"/>
      ${(p.band || band || []).map(b => bandSvg(p, b)).join('')}
      <line class="fg-body" x1="${hx}" y1="${hy}" x2="${p.neck[0]}" y2="${p.neck[1]}"/>
      ${lines.map(l => `<polyline class="fg-body" points="${l}"/>`).join('')}
      <circle class="fg-head" cx="${hx}" cy="${hy}" r="9"/>
      ${arrows}
      <text class="fg-label" x="70" y="180" text-anchor="middle">${label}</text>
    </g>`;
  }

  function svg(id, name) {
    const f = FIGS[id];
    if (!f) return '';
    return `<svg class="fig" viewBox="0 0 320 204" role="img" aria-label="${name}的示意圖：左邊是開始姿勢，右邊是結束姿勢">
      ${pose(f.a, f.band, 8, '開始')}
      <path class="fg-arrow" d="M152 100 H168 M162 94 L168 100 L162 106"/>
      ${pose(f.b, f.band, 172, '結束')}
    </svg>`;
  }

  return { svg, has: id => !!FIGS[id], ids: () => Object.keys(FIGS) };
})();
