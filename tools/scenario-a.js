// 场景 A：红方走两步，等电脑应招，最后选中红马；同时高频采样内部状态
const S = window.XQ;
const E = window.Xiangqi;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const log = [];
let last = '';
const timer = setInterval(() => {
  const sig = S.state.history.length + '|' + S.state.turn + '|' + S.state.sel + '|' +
    (S.state.thinking ? 1 : 0) + '|' + (S.state.over ? 1 : 0);
  if (sig !== last) { last = sig; log.push(sig + ' @' + Math.round(performance.now())); }
}, 40);

async function idle(maxMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < (maxMs || 6000)) {
    if (!S.state.thinking && !S.state.over && S.state.turn === 0) return true;
    await wait(60);
  }
  return false;
}

await wait(300);
log.push('-- click 炮二平五');
S.handleSquare(7 * 9 + 7); S.handleSquare(7 * 9 + 4);
await wait(250);
await idle();
log.push('-- click 傌八进七');
S.handleSquare(9 * 9 + 1); S.handleSquare(7 * 9 + 2);
await wait(250);
await idle();
log.push('-- click 选中红马 (7,2)');
S.handleSquare(7 * 9 + 2);
log.push('-- 脚本结束，history=' + JSON.stringify(S.state.history.map((h) => h.text)));

await wait(900);
clearInterval(timer);
return {
  history: S.state.history.map((h) => h.text),
  sel: S.state.sel,
  turn: S.state.turn,
  timeline: log,
};
