/* 规则与引擎回归测试：node test.js */
const X = require('./engine.js');
const {
  RED, BLACK, K, A, E, H, R, C, P,
  config, piece, sqOf, legalMoves, movesFrom, inCheck, isAttacked,
  initialBoard, notate, think, makeMove, unmakeMove, findKing, evaluate,
} = X;

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra !== undefined ? '  → ' + extra : '')); }
}
function eq(name, a, b) { ok(name + ' = ' + b, a === b, a); }
function has(list, from, to) { return list.some((m) => m === ((from << 7) | to)); }
function board(list) { // [[kind, color, row, col], ...]
  const b = new Array(90).fill(0);
  for (const [k, c, r, col] of list) b[sqOf(r, col)] = piece(k, c);
  return b;
}
// 合法的「互不照面」空盘：红帅 (9,4)、黑将 (0,3)
function bare(extra) {
  return board([[K, RED, 9, 4], [K, BLACK, 0, 3], ...extra]);
}

/* ========== 1. 经典规则基准值 ========== */
console.log('\n[1] 经典规则 perft（与公开基准值比对：44 / 1920 / 79666）');
config.horseLegBlocked = true;
const b0 = initialBoard();
let t = Date.now();
eq('perft(1)', X.perft(b0, RED, 1), 44);
eq('perft(2)', X.perft(b0, RED, 2), 1920);
eq('perft(3)', X.perft(b0, RED, 3), 79666);
console.log('     （' + (Date.now() - t) + 'ms）');

/* ========== 2. 变体：马不蹩腿 ========== */
console.log('\n[2] 变体规则：马永不受蹩腿限制');
config.horseLegBlocked = false;
eq('开局 perft(1)', X.perft(b0, RED, 1), 46);
t = Date.now();
const v2 = X.perft(b0, RED, 2), v3 = X.perft(b0, RED, 3);
console.log('     变体 perft(2) = ' + v2 + '，perft(3) = ' + v3 + '（' + (Date.now() - t) + 'ms）');
console.log('     开局比经典多 2 步：两个正马被自己的象堵住马腿，变体下可以走 (8,3)/(1,3)');
ok('多出的 2 步来自被象塞住的马', v2 > 1920 && v3 > 79666, v2 + '/' + v3);

// 把一匹马四面围死
const boxed = bare([
  [H, RED, 5, 4],
  [P, RED, 4, 4], [P, RED, 5, 3], [P, RED, 5, 5], [P, RED, 6, 4],
]);
config.horseLegBlocked = false;
eq('变体：马腿全堵死仍有 8 个落点', movesFrom(boxed, sqOf(5, 4)).length, 8);
config.horseLegBlocked = true;
eq('经典：同样局面马一步都走不了', movesFrom(boxed, sqOf(5, 4)).length, 0);
config.horseLegBlocked = false;

// 隔着人将军
const horseCheck = bare([[H, RED, 2, 4], [P, RED, 1, 4]]);
config.horseLegBlocked = false;
ok('变体：(1,4) 挡住马腿，马照样将军', inCheck(horseCheck, BLACK));
config.horseLegBlocked = true;
ok('经典：同一局面不算将军', !inCheck(horseCheck, BLACK));
config.horseLegBlocked = false;

// 马腿阻塞不影响可攻击格：黑将在 (2,5)，马在 (4,4)，马腿 (3,4) 被兵占住
const horseCheck2 = board([
  [K, RED, 9, 4], [K, BLACK, 2, 5],
  [H, RED, 4, 4], [P, RED, 3, 4],
]);
config.horseLegBlocked = false;
ok('变体：马腿被兵占住，马照样能将军', inCheck(horseCheck2, BLACK));
config.horseLegBlocked = true;
ok('经典：这步被蹩住', !inCheck(horseCheck2, BLACK));
config.horseLegBlocked = false;

/* ========== 3. 其余规则不变 ========== */
console.log('\n[3] 其余规则保持标准象棋');
eq('塞象眼：相不能飞田',
  movesFrom(bare([[E, RED, 9, 2], [P, RED, 8, 3]]), sqOf(9, 2)).includes(sqOf(7, 4)), false);
eq('象不过河',
  movesFrom(bare([[E, RED, 5, 4]]), sqOf(5, 4)).filter((to) => (to / 9 | 0) < 5).length, 0);
ok('炮隔一子可以吃',
  has(legalMoves(bare([[C, RED, 5, 0], [P, RED, 3, 0], [R, BLACK, 1, 0]]), RED), sqOf(5, 0), sqOf(1, 0)));
ok('炮无炮架不能吃',
  !has(legalMoves(bare([[C, RED, 5, 0], [R, BLACK, 1, 0]]), RED), sqOf(5, 0), sqOf(1, 0)));
eq('兵未过河不能横走', movesFrom(bare([[P, RED, 6, 4]]), sqOf(6, 4)).length, 1);
eq('兵过河后可横走', movesFrom(bare([[P, RED, 4, 4]]), sqOf(4, 4)).length, 3);
eq('仕不出九宫',
  movesFrom(bare([[A, RED, 8, 4]]), sqOf(8, 4)).every((to) => X.inPalace(to / 9 | 0, to % 9, RED)), true);
eq('将不出九宫',
  movesFrom(bare([]), sqOf(9, 4)).every((to) => X.inPalace(to / 9 | 0, to % 9, RED)), true);

// 白脸将：两帅之间的挡子不能离开中线
const face = board([
  [K, RED, 9, 4], [K, BLACK, 0, 4], [C, RED, 7, 4],
]);
ok('白脸将：挡子横移非法（会照面）',
  !has(legalMoves(face, RED), sqOf(7, 4), sqOf(7, 0)));
ok('白脸将：沿中线移动合法',
  has(legalMoves(face, RED), sqOf(7, 4), sqOf(6, 4)));

// 送将 / 被牵制
const pinned = board([
  [K, RED, 9, 4], [K, BLACK, 0, 3],
  [R, BLACK, 3, 4], [R, RED, 5, 4],
]);
ok('被牵制的子不能离开防线',
  !has(legalMoves(pinned, RED), sqOf(5, 4), sqOf(5, 5)));
ok('沿防线移动仍然合法',
  has(legalMoves(pinned, RED), sqOf(5, 4), sqOf(4, 4)));

/* ========== 4. 中文记谱 ========== */
console.log('\n[4] 中文记谱');
const start = initialBoard();
eq('炮二平五', notate(start, (sqOf(7, 7) << 7) | sqOf(7, 4)), '炮二平五');
eq('傌八进七', notate(start, (sqOf(9, 1) << 7) | sqOf(7, 2)), '傌八进七');
eq('傌八进九', notate(start, (sqOf(9, 1) << 7) | sqOf(7, 0)), '傌八进九');
eq('馬8进7', notate(start, (sqOf(0, 7) << 7) | sqOf(2, 6)), '馬8进7');
eq('卒7进1', notate(start, (sqOf(3, 6) << 7) | sqOf(4, 6)), '卒7进1');
eq('俥九进一', notate(start, (sqOf(9, 0) << 7) | sqOf(8, 0)), '俥九进一');
eq('炮八平五', notate(start, (sqOf(7, 1) << 7) | sqOf(7, 4)), '炮八平五');
// 同列双炮：前/后（红方 row 小的更靠前）
const twoCannons = bare([[C, RED, 7, 4], [C, RED, 5, 4]]);
eq('同列双炮：靠前的叫「前炮」', notate(twoCannons, (sqOf(5, 4) << 7) | sqOf(5, 0)), '前炮平九');
eq('同列双炮：靠后的叫「后炮」', notate(twoCannons, (sqOf(7, 4) << 7) | sqOf(6, 4)), '后炮进一');

/* ========== 5. 搜索 ========== */
console.log('\n[5] 搜索');
// 一步制胜（俥沉底将死 或 帅移开造成困毙）
for (const lv of ['easy', 'normal', 'hard']) {
  const pos = board([
    [K, RED, 9, 4], [K, BLACK, 0, 3],
    [R, RED, 1, 0], [R, RED, 1, 8],
  ]);
  const r = think(pos, RED, lv);
  const mv = r.move;
  const cap = makeMove(pos, mv);
  const noMoves = legalMoves(pos, BLACK).length === 0;
  unmakeMove(pos, mv, cap);
  ok(lv + ' 一步制胜', noMoves, notate(pos, mv) + '（' + r.depth + ' 层 / ' + r.nodes + ' 节点）');
  console.log('     ' + notate(pos, mv) + ' — 深度 ' + r.depth + '，节点 ' + r.nodes);
}

// 白吃一个俥
{
  const pos = board([
    [K, RED, 9, 4], [K, BLACK, 0, 3],
    [R, RED, 9, 0], [R, RED, 9, 8],
    [R, BLACK, 5, 0], [A, BLACK, 0, 4], [A, BLACK, 2, 4],
    [E, BLACK, 0, 2], [E, BLACK, 2, 6],
  ]);
  const r = think(pos, RED, 'hard');
  ok('会吃掉白送的俥', (r.move & 127) === sqOf(5, 0), notate(pos, r.move));
}
// 无棋可走时返回 null
{
  const mated = board([[K, BLACK, 0, 3], [K, RED, 9, 4], [R, RED, 1, 0], [R, RED, 1, 8]]);
  makeMove(mated, (sqOf(1, 0) << 7) | sqOf(0, 0));
  ok('被将死时 think 返回 null', think(mated, BLACK, 'normal') === null);
}
// 变体下 AI 会走「翻山马」：马腿被堵、而且只有这匹马能吃子
{
  const pos = board([
    [K, RED, 9, 4], [K, BLACK, 0, 3],
    [H, RED, 5, 4], [P, RED, 4, 4], [P, RED, 5, 3], [P, RED, 5, 5], [P, RED, 6, 4],
    [R, BLACK, 3, 5],
  ]);
  config.horseLegBlocked = false;
  const r = think(pos, RED, 'normal');
  ok('变体：四面被围的马仍能吃掉黑俥', (r.move & 127) === sqOf(3, 5), notate(pos, r.move));
  config.horseLegBlocked = true;
  const r2 = think(pos, RED, 'normal');
  ok('经典：同一局面马寸步难行（AI 只能走兵）', (r2.move >> 7) !== sqOf(5, 4), notate(pos, r2.move));
  config.horseLegBlocked = false;
}

/* ========== 6. 随机对弈压力测试 ========== */
console.log('\n[6] 随机自对弈 2 局 × 80 步');
let crash = 0, badEval = 0;
for (let g = 0; g < 2; g++) {
  let b = initialBoard(), side = RED;
  for (let i = 0; i < 80; i++) {
    const ms = legalMoves(b, side);
    if (!ms.length) break;
    const mv = ms[(Math.random() * ms.length) | 0];
    makeMove(b, mv);
    if (!Number.isFinite(evaluate(b)) || Math.abs(evaluate(b)) > 200000) badEval++;
    side = 1 - side;
    if (findKing(b, RED) < 0 || findKing(b, BLACK) < 0) crash++;
  }
  ok('第 ' + (g + 1) + ' 局跑完 80 步无异常', crash === 0 && badEval === 0);
}
ok('双方帅将始终在盘上', crash === 0, crash);

console.log('\n============================');
console.log(fail === 0 ? `全部通过：${pass} 项` : `通过 ${pass}，失败 ${fail}`);
process.exit(fail === 0 ? 0 : 1);
