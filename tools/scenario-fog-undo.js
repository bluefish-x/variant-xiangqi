const S = window.XQ, E = window.Xiangqi;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function idle(max) {
  const t0 = Date.now();
  while (Date.now() - t0 < (max || 8000)) {
    if (!S.state.thinking && S.state.turn === S.state.humanColor) return true;
    await wait(60);
  }
  return false;
}
await wait(500);
document.querySelector('#switches [data-rule="fog"]').click();
await wait(300);

const b = new Array(90).fill(0);
const put = (k, c, r, col) => { b[r * 9 + col] = E.piece(k, c); };
put(1, 0, 9, 4); put(1, 1, 0, 3);
put(5, 0, 5, 0); put(4, 1, 5, 4);
S.state.board = b;
S.state.revealed = new Array(90).fill(false);
S.state.turn = 0; S.state.history = []; S.state.over = null; S.state.lastMove = null;
S.state.sel = -1; S.state.targets = [];

S.handleSquare(5 * 9 + 0);
S.handleSquare(5 * 9 + 4);
await wait(200);
const before = { msg: S.state.revealMsg, rev: S.state.revealed[5 * 9 + 4] };
await idle();
const afterAI = { hist: S.state.history.length, turn: S.state.turn };
document.getElementById('undoBtn').click();
await wait(200);
const und = {
  hist: S.state.history.length,
  revAt54: S.state.revealed[5 * 9 + 4],
  pieceAt54: S.state.board[5 * 9 + 4],
  turn: S.state.turn,
};
return { before, afterAI, und };
