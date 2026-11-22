// 场景 C：将死 → 结算浮层
const S = window.XQ;
const E = window.Xiangqi;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await wait(300);

const b = new Array(90).fill(0);
const put = (k, c, r, col) => { b[r * 9 + col] = E.piece(k, c); };
put(1, 0, 9, 4); put(1, 1, 0, 3);          // 红帅 (9,4)、黑将 (0,3)
put(5, 0, 1, 0); put(5, 0, 1, 8);          // 两个红俥
put(2, 0, 9, 3); put(4, 0, 6, 4);          // 仕、兵 若干，让画面不那么空

S.state.board = b;
S.state.turn = 0;
S.state.history = [];
S.state.over = null;
S.state.lastMove = null;
S.state.sel = -1;
S.state.targets = [];
S.config.horseLegBlocked = false;

S.playMove(S.mk(1 * 9 + 0, 0 * 9 + 0));    // 俥九进一，沉底将死
await wait(900);
return {
  over: S.state.over,
  overlay: !document.getElementById('overlay').hidden,
  title: document.getElementById('overTitle').textContent,
};
