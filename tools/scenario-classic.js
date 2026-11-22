const S = window.XQ;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await wait(400);
document.querySelector('#presets [data-preset="classic"]').click();
await wait(400);
S.handleSquare(9 * 9 + 1);
return { targets: S.state.targets.length, preset: S.presetName() };
