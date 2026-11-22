const S = window.XQ, E = window.Xiangqi;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await wait(400);
document.querySelector('.seg [data-value="classic"]').click();
await wait(400);
S.handleSquare(9 * 9 + 1);
return { targets: S.state.targets.length, badge: document.getElementById('ruleBadge').textContent };
