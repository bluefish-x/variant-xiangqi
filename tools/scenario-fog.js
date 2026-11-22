const S = window.XQ, E = window.Xiangqi;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await wait(500);

document.querySelector('#switches [data-rule="fog"]').click();
await wait(300);
const out = { fog: S.state.fog, preset: S.presetName() };

function hiddenCount() {
  let n = 0;
  for (let i = 0; i < 90; i++) {
    const p = S.state.board[i];
    if (!p) continue;
    if (E.colorOf(p) === S.state.humanColor) continue;
    if (E.kindOf(p) === 1) continue;
    if (!S.state.revealed[i]) n++;
  }
  return n;
}
out.hiddenAtStart = hiddenCount();

// 红走炮二平五
S.handleSquare(7 * 9 + 7); S.handleSquare(7 * 9 + 4);
await wait(400);
// 等电脑
for (let i = 0; i < 100; i++) {
  if (!S.state.thinking && S.state.turn === 0 && S.state.history.length >= 2) break;
  await wait(80);
}
out.history = S.state.history.map((h) => h.text);
out.hiddenAfterAI = hiddenCount();
out.revealedSquares = S.state.revealed.filter(Boolean).length;

// 再走一步马，制造"已现形"的对比
S.handleSquare(9 * 9 + 1); S.handleSquare(7 * 9 + 2);
await wait(400);
for (let i = 0; i < 100; i++) {
  if (!S.state.thinking && S.state.turn === 0 && S.state.history.length >= 4) break;
  await wait(80);
}
out.history2 = S.state.history.map((h) => h.text);
out.hiddenFinal = hiddenCount();
// 选中一个红子展示落点
S.handleSquare(7 * 9 + 2);
return out;
