// 场景 B：功能回归（带详细诊断）
const S = window.XQ;
const E = window.Xiangqi;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const out = { steps: [] };
const snap = (tag) => out.steps.push(tag + ' hist=' + S.state.history.map((h) => h.text).join(',') +
  ' turn=' + S.state.turn + ' human=' + S.state.humanColor + ' mode=' + S.state.mode +
  ' thinking=' + S.state.thinking + ' over=' + JSON.stringify(S.state.over) +
  ' undoDisabled=' + document.getElementById('undoBtn').disabled);

async function idle(maxMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < (maxMs || 7000)) {
    if (!S.state.thinking && S.state.turn === 0) return true;
    await wait(60);
  }
  return false;
}
const click = (val) => {
  const btn = document.querySelector('.seg [data-value="' + val + '"]');
  btn.click();
  return !!btn;
};

await wait(300);
S.state.level = 'easy';
snap('init');

// 1. 电脑应招
S.handleSquare(7 * 9 + 7); S.handleSquare(7 * 9 + 4);
await wait(400); snap('afterRed1');
const aiReplied = await idle();
await wait(300); snap('afterAI1');
out.aiReplied = aiReplied && S.state.history.length === 2;

// 2. 悔棋
document.getElementById('undoBtn').click();
await wait(200); snap('afterUndo');
out.undoBackToStart = S.state.history.length === 0 && S.state.turn === 0;

// 3. 双人模式
click('pvp');
await wait(300); snap('pvpReset');
S.handleSquare(7 * 9 + 7); S.handleSquare(7 * 9 + 4);
await wait(300);
S.handleSquare(3 * 9 + 4); S.handleSquare(4 * 9 + 4);
await wait(300); snap('pvpMoves');
out.pvpBothSides = S.state.history.length === 2 && S.state.turn === 0;

// 4. 执黑
click('ai');
await wait(300);
click('1');
await wait(2000); snap('asBlack');
out.aiOpensAsRed = S.state.humanColor === 1 && S.state.history.length >= 1;

// 5. 将军 / 结束
const b = new Array(90).fill(0);
const put = (k, c, r, col) => { b[r * 9 + col] = E.piece(k, c); };
put(1, 0, 9, 4); put(1, 1, 0, 3);
put(5, 0, 1, 0); put(5, 0, 1, 8);
S.state.board = b; S.state.turn = 0; S.state.history = []; S.state.over = null;
S.state.lastMove = null; S.state.sel = -1; S.state.targets = [];
S.playMove(S.mk(1 * 9 + 0, 0 * 9 + 0));   // 俥九进一 沉底杀
await wait(800); snap('mate');
out.overlayShown = !document.getElementById('overlay').hidden;
out.overTitle = document.getElementById('overTitle').textContent;
out.overText = document.getElementById('overText').textContent;

// 6. 再来一局
document.getElementById('overBtn').click();
await wait(400); snap('restart');
out.restartClears = S.state.history.length === 0 && S.state.over === null &&
  document.getElementById('overlay').hidden;
return out;
