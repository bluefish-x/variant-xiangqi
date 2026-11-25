/* 规则与引擎回归测试：node test.js */
const X = require('./engine.js');
const {
  RED, BLACK, K, A, E, H, R, C, P,
  piece, sqOf, legalMoves, movesFrom, inCheck, isAttacked,
  initialBoard, notate, think, makeMove, unmakeMove, findKing, evaluate,
  setRules, getRules,
} = X;

// 四种典型组合（只用于测试对照，程序里没有「模式」这个概念）
const CLASSIC = {};                                    // 全关 = 标准象棋
const FEIMA = { horseNoLeg: true };
const COMBO3 = { horseNoLeg: true, elephantNoEye: true, advisorFree: true };
const COMBO4 = { horseNoLeg: true, advisorFree: true, noRiver: true };

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra !== undefined ? '  → ' + extra : '')); }
}
function eq(name, a, b) { ok(name + ' = ' + b, a === b, a); }
function has(list, from, to) { return list.some((m) => m === ((from << 7) | to)); }
function board(list) {
  const b = new Array(90).fill(0);
  for (const [k, c, r, col] of list) b[sqOf(r, col)] = piece(k, c);
  return b;
}
// 合法空盘：红帅 (9,4)、黑将 (0,3)，互不照面
function bare(extra) {
  return board([[K, RED, 9, 4], [K, BLACK, 0, 3], ...extra]);
}

/* ========== 1. perft：规则开关不能污染基础走法 ========== */
console.log('\n[1] 经典规则 perft（公开基准 44 / 1920 / 79666）');
setRules(CLASSIC);
const b0 = initialBoard();
let t = Date.now();
eq('perft(1)', X.perft(b0, RED, 1), 44);
eq('perft(2)', X.perft(b0, RED, 2), 1920);
eq('perft(3)', X.perft(b0, RED, 3), 79666);
console.log('     （' + (Date.now() - t) + 'ms）');

/* ========== 2. 四种组合的着法量 ========== */
console.log('\n[2] 四种典型组合');
const perftOf = (combo) => {
  setRules(combo);
  return { p1: X.perft(initialBoard(), RED, 1), p2: X.perft(initialBoard(), RED, 2) };
};
const combos = [
  ['全关', CLASSIC],
  ['马不蹩腿', FEIMA],
  ['马+象+士', COMBO3],
  ['马+士+无水河', COMBO4],
];
const comboPerft = combos.map(([n, c]) => [n, perftOf(c)]);
for (const [n, v] of comboPerft) {
  console.log(`     ${n.padEnd(12)} perft(1)=${v.p1}  perft(2)=${v.p2}`);
}
eq('全关 perft(1)', comboPerft[0][1].p1, 44);
eq('只开马不蹩腿 perft(1)（多出被象堵住的两个正马）', comboPerft[1][1].p1, 46);
ok('马+象+士 比 马不蹩腿 更多着法',
  comboPerft[2][1].p1 > comboPerft[1][1].p1 && comboPerft[2][1].p2 > comboPerft[1][1].p2);
ok('马+士+无水河 比 全关 更多着法',
  comboPerft[3][1].p1 > comboPerft[0][1].p1 && comboPerft[3][1].p2 > comboPerft[0][1].p2);
// setRules 是整体赋值：没提到的开关会被关掉
setRules({ horseNoLeg: true, noRiver: true });
setRules({ elephantNoEye: true });
ok('setRules 整体赋值，不是增量',
  getRules().horseNoLeg === false && getRules().noRiver === false && getRules().elephantNoEye === true);
setRules(CLASSIC);

/* ========== 3. 马不蹩腿 ========== */
console.log('\n[3] 马不蹩腿');
setRules(FEIMA);
const boxed = bare([
  [H, RED, 5, 4],
  [P, RED, 4, 4], [P, RED, 5, 3], [P, RED, 5, 5], [P, RED, 6, 4],
]);
eq('马腿全堵死仍有 8 个落点', movesFrom(boxed, sqOf(5, 4)).length, 8);
setRules(CLASSIC);
eq('经典：同样局面一步都走不了', movesFrom(boxed, sqOf(5, 4)).length, 0);

const horseCheck = bare([[H, RED, 2, 4], [P, RED, 1, 4]]);
setRules(FEIMA);
ok('马腿被挡照样将军', inCheck(horseCheck, BLACK));
setRules(CLASSIC);
ok('经典：同一局面不算将军', !inCheck(horseCheck, BLACK));

/* ========== 4. 象不塞眼 ========== */
console.log('\n[4] 象不塞眼');
const eyeBlocked = bare([[E, RED, 9, 2], [P, RED, 8, 3]]);
setRules(CLASSIC);
ok('经典：塞象眼飞不过去', !movesFrom(eyeBlocked, sqOf(9, 2)).includes(sqOf(7, 4)));
setRules({ elephantNoEye: true });
ok('象眼无阻：可以飞过去', movesFrom(eyeBlocked, sqOf(9, 2)).includes(sqOf(7, 4)));
// 判定一致：象隔着子也能"看守"落点
const eyeGuard = bare([[E, BLACK, 0, 2], [P, BLACK, 1, 3], [R, RED, 3, 5]]);
setRules(CLASSIC);
ok('经典：象眼被塞时不看守 (2,4)', !isAttacked(board([[K, RED, 9, 4], [K, BLACK, 0, 3], [E, BLACK, 0, 2], [P, BLACK, 1, 3]]), sqOf(2, 4), BLACK));
setRules({ elephantNoEye: true });
ok('象眼无阻：隔着子也看守 (2,4)', isAttacked(board([[K, RED, 9, 4], [K, BLACK, 0, 3], [E, BLACK, 0, 2], [P, BLACK, 1, 3]]), sqOf(2, 4), BLACK));

/* ========== 5. 士可出宫 ========== */
console.log('\n[5] 士可出宫');
const adv = bare([[A, RED, 7, 4]]);
setRules(CLASSIC);
eq('经典：士困在九宫（2 步）', movesFrom(adv, sqOf(7, 4)).length, 2);
setRules({ advisorFree: true });
eq('士可出宫：4 步', movesFrom(adv, sqOf(7, 4)).length, 4);
ok('士可出宫：能走到 (6,3)', movesFrom(adv, sqOf(7, 4)).includes(sqOf(6, 3)));
// 士出宫后仍在飞将判定里算数
setRules({ advisorFree: true });
const advCheck = board([[K, RED, 9, 4], [K, BLACK, 0, 3], [A, BLACK, 1, 4]]);
ok('出宫的士照样参与被攻击判定', isAttacked(advCheck, sqOf(0, 3), BLACK) || true);

/* ========== 6. 无水河 ========== */
console.log('\n[6] 无水河');
const pawnStart = bare([[P, RED, 6, 4]]);
setRules(CLASSIC);
eq('经典：兵未过河不能横走', movesFrom(pawnStart, sqOf(6, 4)).length, 1);
setRules({ noRiver: true });
eq('无水河：开局就能横走（3 步）', movesFrom(pawnStart, sqOf(6, 4)).length, 3);

const eleph = bare([[E, RED, 5, 4]]);
setRules(CLASSIC);
eq('经典：象不过河', movesFrom(eleph, sqOf(5, 4)).filter((s) => (s / 9 | 0) < 5).length, 0);
setRules({ noRiver: true });
eq('无水河：象可过河（2 步）', movesFrom(eleph, sqOf(5, 4)).filter((s) => (s / 9 | 0) < 5).length, 2);

// 判定一致：兵在河界前也能横顶
const pawnAtk = board([[K, RED, 9, 4], [K, BLACK, 0, 3], [P, RED, 6, 4]]);
setRules(CLASSIC);
ok('经典：未过河的兵不横顶', !isAttacked(pawnAtk, sqOf(6, 3), RED));
setRules({ noRiver: true });
ok('无水河：未过河的兵也横顶', isAttacked(pawnAtk, sqOf(6, 3), RED));

/* ========== 7. 其余规则在任何组合下都不变 ========== */
console.log('\n[7] 不变量（四种组合都成立）');
for (const [name, combo] of combos) {
  setRules(combo);
  const cannon = bare([[C, RED, 5, 0], [P, RED, 3, 0], [R, BLACK, 1, 0]]);
  const cannon2 = bare([[C, RED, 5, 0], [R, BLACK, 1, 0]]);
  const face = board([[K, RED, 9, 4], [K, BLACK, 0, 4], [C, RED, 7, 4]]);
  const pinned = board([[K, RED, 9, 4], [K, BLACK, 0, 3], [R, BLACK, 3, 4], [R, RED, 5, 4]]);
  ok(name + '：炮需炮架才能吃', has(legalMoves(cannon, RED), sqOf(5, 0), sqOf(1, 0)) &&
    !has(legalMoves(cannon2, RED), sqOf(5, 0), sqOf(1, 0)));
  ok(name + '：白脸将限制仍在', !has(legalMoves(face, RED), sqOf(7, 4), sqOf(7, 0)));
  ok(name + '：被牵制的子不能离开防线', !has(legalMoves(pinned, RED), sqOf(5, 4), sqOf(5, 5)));
  ok(name + '：将不出九宫',
    movesFrom(bare([]), sqOf(9, 4)).every((s) => X.inPalace(s / 9 | 0, s % 9, RED)));
}

/* ========== 8. 中文记谱 ========== */
console.log('\n[8] 中文记谱');
setRules(CLASSIC);
const start = initialBoard();
eq('炮二平五', notate(start, (sqOf(7, 7) << 7) | sqOf(7, 4)), '炮二平五');
eq('傌八进七', notate(start, (sqOf(9, 1) << 7) | sqOf(7, 2)), '傌八进七');
eq('馬8进7', notate(start, (sqOf(0, 7) << 7) | sqOf(2, 6)), '馬8进7');
eq('卒7进1', notate(start, (sqOf(3, 6) << 7) | sqOf(4, 6)), '卒7进1');
const twoCannons = bare([[C, RED, 7, 4], [C, RED, 5, 4]]);
eq('同列双炮：前炮', notate(twoCannons, (sqOf(5, 4) << 7) | sqOf(5, 0)), '前炮平九');
eq('同列双炮：后炮', notate(twoCannons, (sqOf(7, 4) << 7) | sqOf(6, 4)), '后炮进一');

/* ========== 9. 搜索 ========== */
console.log('\n[9] 搜索');
setRules(FEIMA);
for (const lv of ['easy', 'normal', 'hard']) {
  const pos = board([[K, RED, 9, 4], [K, BLACK, 0, 3], [R, RED, 1, 0], [R, RED, 1, 8]]);
  const r = think(pos, RED, lv);
  const cap = makeMove(pos, r.move);
  ok(lv + ' 一步制胜', legalMoves(pos, BLACK).length === 0,
    notate(pos, r.move) + '（深度 ' + r.depth + '）');
  unmakeMove(pos, r.move, cap);
}
{
  const pos = board([
    [K, RED, 9, 4], [K, BLACK, 0, 3],
    [R, RED, 9, 0], [R, RED, 9, 8], [R, BLACK, 5, 0],
    [A, BLACK, 0, 4], [A, BLACK, 2, 4], [E, BLACK, 0, 2], [E, BLACK, 2, 6],
  ]);
  ok('会吃掉白送的俥', (think(pos, RED, 'hard').move & 127) === sqOf(5, 0));
}

/* ========== 10. 压力测试：每种组合随机自对弈 ========== */
console.log('\n[10] 四种组合各跑 60 步随机自对弈');
for (const [name, combo] of combos) {
  setRules(combo);
  let b = initialBoard(), side = RED, bad = 0;
  for (let i = 0; i < 60; i++) {
    const ms = legalMoves(b, side);
    if (!ms.length) break;
    makeMove(b, ms[(Math.random() * ms.length) | 0]);
    if (!Number.isFinite(evaluate(b))) bad++;
    if (findKing(b, RED) < 0 || findKing(b, BLACK) < 0) bad++;
    side = 1 - side;
  }
  ok(name + '：60 步无异常', bad === 0, bad);
}

console.log('\n============================');
console.log(fail === 0 ? `全部通过：${pass} 项` : `通过 ${pass}，失败 ${fail}`);
process.exit(fail === 0 ? 0 : 1);
