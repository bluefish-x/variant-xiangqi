// 场景 D：窄屏（手机）布局，开局状态
const S = window.XQ;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await wait(400);
return { w: window.innerWidth, h: window.innerHeight, mode: S.state.mode };
