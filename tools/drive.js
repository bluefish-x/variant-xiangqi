#!/usr/bin/env node
/**
 * 用 Chrome DevTools Protocol 打开页面、执行一段脚本、截图。
 *
 *   node tools/drive.js <page.html> <script.js> <out.png> [width] [height]
 *
 * script.js 的内容会被包进 async 函数，在里面可以 await，
 * 返回值会打印到控制台。页面里的 console 输出和未捕获异常也会转发出来。
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => fs.existsSync(p));
if (!CHROME) { console.error('找不到 Chrome/Edge'); process.exit(1); }

const [pageArg, scriptArg, outArg, wArg, hArg] = process.argv.slice(2);
const pageUrl = 'file:///' + path.resolve(pageArg).replace(/\\/g, '/');
const scriptBody = fs.readFileSync(path.resolve(scriptArg), 'utf8');
const outPng = path.resolve(outArg);
const W = Number(wArg) || 1280, H = Number(hArg) || 900;

const PORT = 9300 + Math.floor(Math.random() * 300);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(p) {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}${p}`);
      if (r.ok) return await r.json();
    } catch (e) { /* not up yet */ }
    await sleep(120);
  }
  throw new Error('CDP 未就绪: ' + p);
}

(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-'));
  const chrome = spawn(CHROME, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-breakpad',
    '--hide-scrollbars', '--mute-audio', '--no-first-run', '--disable-extensions',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    `--window-size=${W},${H}`, 'about:blank',
  ], { stdio: 'ignore' });

  let ws;
  try {
    await getJson('/json/version');
    const list = await getJson('/json/list');
    const target = list.find((t) => t.type === 'page');
    if (!target) throw new Error('找不到页面 target');

    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

    let id = 0;
    const pending = new Map();
    const events = [];
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      } else if (msg.method) {
        events.push(msg);
        if (msg.method === 'Runtime.consoleAPICalled') {
          const text = msg.params.args.map((a) => a.value !== undefined ? a.value : a.description).join(' ');
          console.log('  [page] ' + text);
        } else if (msg.method === 'Runtime.exceptionThrown') {
          const d = msg.params.exceptionDetails;
          console.log('  [page ERROR] ' + (d.exception && d.exception.description || d.text));
        }
      }
    };
    const send = (method, params) => new Promise((resolve, reject) => {
      const mid = ++id;
      pending.set(mid, { resolve, reject });
      ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
    });

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: W, height: H, deviceScaleFactor: 1, mobile: false,
    });
    await send('Page.navigate', { url: pageUrl });

    // 等待 load + XQ 就绪
    for (let i = 0; i < 80; i++) {
      const r = await send('Runtime.evaluate', {
        expression: 'document.readyState === "complete" && !!window.XQ',
        returnByValue: true,
      });
      if (r.result.value) break;
      await sleep(120);
    }
    await sleep(200);

    const wrapped = `(async () => { ${scriptBody} })()`;
    const res = await send('Runtime.evaluate', {
      expression: wrapped, awaitPromise: true, returnByValue: true,
    });
    if (res.exceptionDetails) {
      console.log('  [script ERROR] ' + JSON.stringify(res.exceptionDetails.exception && res.exceptionDetails.exception.description));
    } else {
      console.log('  [script] ' + JSON.stringify(res.result.value));
    }

    await sleep(120);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(outPng, Buffer.from(shot.data, 'base64'));
    console.log('  ✓ 截图 ' + outPng);
  } finally {
    try { ws && ws.close(); } catch (e) { }
    chrome.kill('SIGKILL');
  }
  process.exit(0);
})().catch((e) => { console.error('失败: ' + e.message); process.exit(1); });
