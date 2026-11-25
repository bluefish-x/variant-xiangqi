const S = window.XQ;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await wait(400);
// 关掉「马不蹩腿」= 回到经典
document.querySelector('#switches [data-rule="horseNoLeg"]').click();
await wait(400);
S.handleSquare(9 * 9 + 1);
return { targets: S.state.targets.length, rules: S.getRules(), badge: document.getElementById('ruleBadge').textContent };
