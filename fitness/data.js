'use strict';
/* 預設資料：動作、訓練日、Tabata、說明文字。使用者改過的內容存在 localStorage，不會被這裡覆蓋。 */

const BANDS = [
  { kg: 5, label: '5 kg 帶子' },
  { kg: 10, label: '10 kg 帶子' },
  { kg: 15, label: '5 kg ＋ 10 kg 兩條一起' }
];

const DEFAULT_EXERCISES = [
  {
    id: 'lateral',
    name: '側平舉',
    how: '雙腳踩住帶子，雙手抓住另一端。手肘微彎，往身體兩側抬到與肩同高，停一下再慢慢放下。',
    mistakes: '聳肩、用甩的把手帶上去、抬得比肩膀還高。'
  },
  {
    id: 'pullapart',
    name: '彈力帶拉開',
    how: '雙手與肩同寬抓住帶子，手臂在胸口高度往前伸直。往兩側拉開到帶子碰到胸口，夾緊肩胛骨再慢慢回來。',
    mistakes: '聳肩、腰往後仰、手肘彎太多變成划船。'
  },
  {
    id: 'row',
    name: '坐姿划船（腳踩帶）',
    how: '坐在地上雙腿伸直，帶子繞過腳掌，雙手抓住另一端。挺胸，手肘貼近身體往後拉到肚子兩側，再慢慢放回。',
    mistakes: '駝背、身體前後晃借力、聳肩。帶子沒勾穩腳掌會彈回來。'
  },
  {
    id: 'press',
    name: '肩推',
    how: '雙腳踩住帶子，雙手抓帶子舉到肩膀高度、掌心朝前。收緊肚子，往上推到手臂接近伸直，再慢慢放回肩膀。',
    mistakes: '腰往後凹、聳肩、手肘往外張太開。'
  },
  {
    id: 'chestpress',
    name: '彈力帶胸推',
    how: '帶子繞過上背（肩胛骨的高度），雙手各抓一端放在胸口兩側。往前推到手臂接近伸直，再慢慢收回。',
    mistakes: '帶子滑到脖子、聳肩、手肘鎖死、身體前傾借力。'
  }
];

const DEFAULT_PLANS = {
  A: {
    title: '肩膀和上背',
    items: [
      { exId: 'lateral', band: 5, sets: 3, min: 12, max: 20 },
      { exId: 'pullapart', band: 5, sets: 3, min: 15, max: 20 },
      { exId: 'row', band: 10, sets: 3, min: 10, max: 15 },
      { exId: 'press', band: 10, sets: 2, min: 8, max: 12 }
    ]
  },
  B: {
    title: '胸和肩',
    items: [
      { exId: 'chestpress', band: 10, sets: 3, min: 8, max: 15 },
      { exId: 'lateral', band: 5, sets: 3, min: 12, max: 20 },
      { exId: 'row', band: 10, sets: 3, min: 10, max: 15 },
      { exId: 'pullapart', band: 5, sets: 2, min: 15, max: 20 }
    ]
  }
};

const DEFAULT_SETTINGS = { restSec: 75, sound: true, vibrate: true, theme: 'auto' };

const DEFAULT_TABATA = {
  work: 20,
  rest: 10,
  cycles: 8,
  rounds: 2,
  roundRest: 60,
  moves: ['開合跳', '深蹲', '登山者', '原地高抬腿']
};

const CHECKLIST = [
  '彈力帶整條看過、拉一下，沒有裂縫或缺口',
  '腳踩穩（踩在腳掌中間，地板不滑）',
  '帶子的位置不會壓到脖子'
];

const PROGRESS_WAYS = [
  '手抓更靠近腳，縮短帶子',
  '把帶子多繞一圈',
  '換更重的帶子（5 kg 換 10 kg，或兩條一起用）'
];

const PRINCIPLES = [
  '不需要每組都力竭。目標是做到「再多做 1 到 2 下就會失敗或姿勢跑掉」。',
  '最後一組可以更接近力竭。',
  '動作變形、肩膀聳起來就停。',
  '推和拉的量要大致平衡，所以 B 日有胸推，也不能省略划船和拉開。'
];
