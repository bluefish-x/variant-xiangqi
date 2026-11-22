const S = window.XQ, E = window.Xiangqi;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await wait(500);
const out = { preset: S.presetName(), rules: S.getRules(), errors: [] };
S.handleSquare(9 * 9 + 1);
out.horseTargets = S.state.targets.length;
// 切到「无阻」
document.querySelector('#presets [data-preset="unobstructed"]').click();
await wait(300);
out.preset2 = S.presetName();
out.rules2 = S.getRules();
S.handleSquare(9 * 9 + 1);
out.horseTargets2 = S.state.targets.length;
// 象不塞眼验证：(9,2) 象 被 (8,3) 兵塞眼
S.handleSquare(9 * 9 + 2);
out.elephantTargets = S.state.targets.length;
// 切到「狂野」
document.querySelector('#presets [data-preset="wild"]').click();
await wait(300);
out.preset3 = S.presetName();
out.rules3 = S.getRules();
S.handleSquare(6 * 9 + 4);   // 兵
out.pawnTargets = S.state.targets.length;
return out;
