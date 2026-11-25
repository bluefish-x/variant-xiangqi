const S = window.XQ;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (rule) => document.querySelector('#switches [data-rule="' + rule + '"]').click();
await wait(500);
const out = { defaultRules: S.getRules(), badge: document.getElementById('ruleBadge').textContent };

// 开「象不塞眼」+「士可出宫」
click('elephantNoEye'); await wait(260);
click('advisorFree');   await wait(260);
out.rules2 = S.getRules();
out.badge2 = document.getElementById('ruleBadge').textContent;
S.handleSquare(9 * 9 + 2);          // 红象 (9,2)，象眼 (8,3) 被兵占着
out.elephantTargets = S.state.targets.length;

// 再开「无水河」
click('noRiver'); await wait(260);
out.rules3 = S.getRules();
out.badge3 = document.getElementById('ruleBadge').textContent;
S.handleSquare(6 * 9 + 4);          // 红兵，开局即可横走
out.pawnTargets = S.state.targets.length;
return out;
