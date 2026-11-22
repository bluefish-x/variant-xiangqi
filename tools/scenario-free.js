const S = window.XQ, E = window.Xiangqi;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await wait(400);
S.handleSquare(9 * 9 + 1);        // 选中红方右马（傌八）
return { targets: S.state.targets.length, sq: S.state.sel };
