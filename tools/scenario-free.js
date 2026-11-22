const S = window.XQ;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await wait(400);
S.handleSquare(9 * 9 + 1);        // 选中红方右马（傌八）
return { targets: S.state.targets.length, preset: S.presetName() };
