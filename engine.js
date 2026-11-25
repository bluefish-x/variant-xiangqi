/*!
 * engine.js —— 规则可变动象棋：规则与搜索引擎
 *
 * 四条规则开关（rules）：马不蹩腿 / 象不塞眼 / 士可出宫 / 无水河，
 * 全关即标准象棋。每个开关都同时作用于「走法生成」和「被攻击判定」，
 * 两边共用一个 rules 对象，避免出现「能走但走了算被将」的矛盾。
 *
 * 棋盘 10 行 × 9 列，索引 = row * 9 + col，row 0 在顶部（黑方底线）。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Xiangqi = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ================= 常量 ================= */
  const ROWS = 10, COLS = 9, SIZE = 90;
  const RED = 0, BLACK = 1;
  const K = 1, A = 2, E = 3, H = 4, R = 5, C = 6, P = 7;

  // 棋子编码：kind | (color << 3)
  const CHARS = [
    ['帥', '仕', '相', '傌', '俥', '炮', '兵'], // 红
    ['將', '士', '象', '馬', '車', '砲', '卒'], // 黑
  ];

  const D4 = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  // 马的八个落点：先直二再横一 / 先横一（旧规则里「马腿」就是直二那一步的中点）
  const HOFF = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];

  const PALACE_SQ = [
    [66, 67, 68, 75, 76, 77, 84, 85, 86], // 红方九宫
    [3, 4, 5, 12, 13, 14, 21, 22, 23],    // 黑方九宫
  ];

  const config = {
    // 兼容旧的单一开关（等价于 horseNoLeg）
    get horseLegBlocked() { return !rules.horseNoLeg; },
    set horseLegBlocked(v) { rules.horseNoLeg = !v; },
  };

  /**
   * 规则开关。默认全关 = 标准象棋。
   * 每一开关都同时作用于「走法生成」和「被攻击判定」，两边永远一致。
   */
  const rules = {
    horseNoLeg: false,     // 马不蹩腿
    elephantNoEye: false,  // 象不塞眼
    advisorFree: false,    // 士可出九宫
    noRiver: false,        // 无河界：象可过河、兵开局即可横走
  };

  /** 套用一组开关；传对象即可，未提到的项一律关掉 */
  function setRules(r) {
    const src = r || {};
    for (const k of Object.keys(rules)) rules[k] = !!src[k];
    return getRules();
  }

  function getRules() { return Object.assign({}, rules); }

  const kindOf = (p) => p & 7;
  const colorOf = (p) => p >> 3;
  const piece = (kind, color) => kind | (color << 3);
  const inBoard = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS;
  const sqOf = (r, c) => r * 9 + c;
  const rowOf = (sq) => (sq / 9) | 0;
  const colOf = (sq) => sq % 9;
  const mvFrom = (mv) => mv >> 7;
  const mvTo = (mv) => mv & 127;
  const mkMove = (from, to) => (from << 7) | to;

  function inPalace(r, c, color) {
    if (c < 3 || c > 5) return false;
    return color === RED ? r >= 7 && r <= 9 : r >= 0 && r <= 2;
  }

  /* ================= 初始局面 ================= */
  function initialBoard() {
    const b = new Array(SIZE).fill(0);
    const BACK = [R, H, E, A, K, A, E, H, R];
    for (let c = 0; c < 9; c++) {
      b[sqOf(0, c)] = piece(BACK[c], BLACK);
      b[sqOf(9, c)] = piece(BACK[c], RED);
    }
    for (const c of [1, 7]) {
      b[sqOf(2, c)] = piece(C, BLACK);
      b[sqOf(7, c)] = piece(C, RED);
    }
    for (const c of [0, 2, 4, 6, 8]) {
      b[sqOf(3, c)] = piece(P, BLACK);
      b[sqOf(6, c)] = piece(P, RED);
    }
    return b;
  }

  /* ================= 走法生成 ================= */
  function genPiece(b, from, out) {
    const p = b[from];
    if (!p) return;
    const side = p >> 3, kind = p & 7;
    const r = rowOf(from), c = colOf(from);

    const add = (rr, cc) => {
      if (!inBoard(rr, cc)) return false;
      const t = sqOf(rr, cc), q = b[t];
      if (q && (q >> 3) === side) return false;
      out.push((from << 7) | t);
      return true;
    };

    switch (kind) {
      case R: { // 俥/車：直线滑行
        for (let d = 0; d < 4; d++) {
          const dr = D4[d][0], dc = D4[d][1];
          let rr = r + dr, cc = c + dc;
          while (inBoard(rr, cc)) {
            const t = sqOf(rr, cc), q = b[t];
            if (!q) out.push((from << 7) | t);
            else {
              if ((q >> 3) !== side) out.push((from << 7) | t);
              break;
            }
            rr += dr; cc += dc;
          }
        }
        break;
      }
      case C: { // 炮：走同车，吃需隔一子（炮架）
        for (let d = 0; d < 4; d++) {
          const dr = D4[d][0], dc = D4[d][1];
          let rr = r + dr, cc = c + dc, screen = false;
          while (inBoard(rr, cc)) {
            const t = sqOf(rr, cc), q = b[t];
            if (!screen) {
              if (!q) out.push((from << 7) | t);
              else screen = true;
            } else if (q) {
              if ((q >> 3) !== side) out.push((from << 7) | t);
              break;
            }
            rr += dr; cc += dc;
          }
        }
        break;
      }
      case H: { // 马：★ 马腿规则可关
        for (let i = 0; i < 8; i++) {
          const dr = HOFF[i][0], dc = HOFF[i][1];
          if (!rules.horseNoLeg) {
            const lr = r + (Math.abs(dr) === 2 ? dr / 2 : 0);
            const lc = c + (Math.abs(dc) === 2 ? dc / 2 : 0);
            if (b[sqOf(lr, lc)]) continue; // 经典规则：马腿被占则不能走
          }
          add(r + dr, c + dc);
        }
        break;
      }
      case E: { // 相/象：田字，塞象眼，不过河（两条限制各有开关）
        for (let i = 0; i < 4; i++) {
          const dr = DIAG[i][0], dc = DIAG[i][1];
          const rr = r + dr * 2, cc = c + dc * 2;
          if (!inBoard(rr, cc)) continue;
          if (!rules.noRiver && (side === RED ? rr < 5 : rr > 4)) continue;
          if (!rules.elephantNoEye && b[sqOf(r + dr, c + dc)]) continue;
          add(rr, cc);
        }
        break;
      }
      case A: { // 仕/士：九宫斜走一步（士可出宫时解除九宫限制）
        for (let i = 0; i < 4; i++) {
          const rr = r + DIAG[i][0], cc = c + DIAG[i][1];
          if (!rules.advisorFree && !inPalace(rr, cc, side)) continue;
          add(rr, cc);
        }
        break;
      }
      case K: { // 帥/將：九宫直走一步
        for (let i = 0; i < 4; i++) {
          const rr = r + D4[i][0], cc = c + D4[i][1];
          if (!inPalace(rr, cc, side)) continue;
          add(rr, cc);
        }
        break;
      }
      case P: { // 兵/卒：向前一步，过河后可横走（无河界则随时可横走）
        const fwd = side === RED ? -1 : 1;
        add(r + fwd, c);
        const crossed = rules.noRiver || (side === RED ? r <= 4 : r >= 5);
        if (crossed) { add(r, c - 1); add(r, c + 1); }
        break;
      }
    }
  }

  function genMoves(b, side) {
    const out = [];
    for (let f = 0; f < SIZE; f++) {
      const p = b[f];
      if (p && (p >> 3) === side) genPiece(b, f, out);
    }
    return out;
  }

  function genMovesFrom(b, from) {
    const out = [];
    if (b[from]) genPiece(b, from, out);
    return out;
  }

  /* ================= 落子 / 撤销 ================= */
  function makeMove(b, mv) {
    const f = mv >> 7, t = mv & 127;
    const cap = b[t];
    b[t] = b[f];
    b[f] = 0;
    return cap;
  }

  function unmakeMove(b, mv, cap) {
    const f = mv >> 7, t = mv & 127;
    b[f] = b[t];
    b[t] = cap;
  }

  /* ================= 被攻击判定 ================= */
  /**
   * 判断 sq 是否被 by 方攻击。
   * 注意：马的判断同样不查马腿——与生成器保持同一套规则，
   * 否则会出现「能走但走了算被将」的矛盾。
   */
  function isAttacked(b, sq, by) {
    const r = rowOf(sq), c = colOf(sq);

    // 兵/卒：正面顶；过河后可横顶（无河界则随时可横顶）
    const pr = r + (by === RED ? 1 : -1);
    if (pr >= 0 && pr < ROWS) {
      const q = b[sqOf(pr, c)];
      if (q && (q >> 3) === by && (q & 7) === P) return true;
    }
    {
      const crossed = rules.noRiver || (by === RED ? r <= 4 : r >= 5);
      if (crossed) {
        for (const dc of [-1, 1]) {
          const cc = c + dc;
          if (cc < 0 || cc >= COLS) continue;
          const q = b[sqOf(r, cc)];
          if (q && (q >> 3) === by && (q & 7) === P) return true;
        }
      }
    }

    // 帥/將：贴身一格（白脸将的长距离情况在下面的滑行扫描里处理）
    for (let i = 0; i < 4; i++) {
      const rr = r + D4[i][0], cc = c + D4[i][1];
      if (!inBoard(rr, cc)) continue;
      const q = b[sqOf(rr, cc)];
      if (q && (q >> 3) === by && (q & 7) === K) return true;
    }

    // 仕/士：贴身斜格（士可出宫时不限九宫）
    for (let i = 0; i < 4; i++) {
      const rr = r + DIAG[i][0], cc = c + DIAG[i][1];
      if (!inBoard(rr, cc)) continue;
      if (!rules.advisorFree && !inPalace(rr, cc, by)) continue;
      const q = b[sqOf(rr, cc)];
      if (q && (q >> 3) === by && (q & 7) === A) return true;
    }

    // 相/象：田字，塞象眼（象眼/河界各有开关，须与生成器一致）
    for (let i = 0; i < 4; i++) {
      const dr = DIAG[i][0], dc = DIAG[i][1];
      const rr = r + dr * 2, cc = c + dc * 2;
      if (!inBoard(rr, cc)) continue;
      const q = b[sqOf(rr, cc)];
      if (!q || (q >> 3) !== by || (q & 7) !== E) continue;
      if (!rules.noRiver && (by === RED ? rr < 5 : rr > 4)) continue;
      if (!rules.elephantNoEye && b[sqOf(r + dr, c + dc)]) continue;
      return true;
    }

    // 马：马腿规则与生成器一致
    for (let i = 0; i < 8; i++) {
      const rr = r + HOFF[i][0], cc = c + HOFF[i][1];
      if (!inBoard(rr, cc)) continue;
      const q = b[sqOf(rr, cc)];
      if (!q || (q >> 3) !== by || (q & 7) !== H) continue;
      if (!rules.horseNoLeg) {
        const lr = rr + (Math.abs(HOFF[i][0]) === 2 ? -HOFF[i][0] / 2 : 0);
        const lc = cc + (Math.abs(HOFF[i][1]) === 2 ? -HOFF[i][1] / 2 : 0);
        if (b[sqOf(lr, lc)]) continue;
      }
      return true;
    }

    // 俥/車、炮、白脸将：四条直线扫描
    for (let d = 0; d < 4; d++) {
      const dr = D4[d][0], dc = D4[d][1];
      let rr = r + dr, cc = c + dc, screen = false;
      while (inBoard(rr, cc)) {
        const q = b[sqOf(rr, cc)];
        if (q) {
          if (!screen) {
            if ((q >> 3) === by) {
              const k = q & 7;
              if (k === R) return true;
              if (k === K && dc === 0) return true; // 白脸将：同列对脸即算攻击
            }
            screen = true;
          } else {
            if ((q >> 3) === by && (q & 7) === C) return true;
            break;
          }
        }
        rr += dr; cc += dc;
      }
    }

    return false;
  }

  function findKing(b, side) {
    const list = PALACE_SQ[side];
    for (let i = 0; i < list.length; i++) {
      const q = b[list[i]];
      if (q && (q >> 3) === side && (q & 7) === K) return list[i];
    }
    return -1;
  }

  function inCheck(b, side) {
    const ks = findKing(b, side);
    if (ks < 0) return true; // 无帅即负
    return isAttacked(b, ks, 1 - side);
  }

  /** 过滤掉自将（含送将、白脸将）的走法 */
  function legalMoves(b, side) {
    const out = [];
    const all = genMoves(b, side);
    for (let i = 0; i < all.length; i++) {
      const mv = all[i];
      const cap = makeMove(b, mv);
      if (!inCheck(b, side)) out.push(mv);
      unmakeMove(b, mv, cap);
    }
    return out;
  }

  function movesFrom(b, from) {
    const p = b[from];
    if (!p) return [];
    const side = p >> 3, out = [];
    const all = genMovesFrom(b, from);
    for (let i = 0; i < all.length; i++) {
      const mv = all[i];
      const cap = makeMove(b, mv);
      if (!inCheck(b, side)) out.push(mv & 127);
      unmakeMove(b, mv, cap);
    }
    return out;
  }

  /* ================= 局面评估 ================= */
  const VALUE = [0, 10000, 200, 200, 400, 900, 450, 100]; // K A E H R C P

  /** 位置分：rr = 0 表示本方底线，9 表示对方底线 */
  function pst(kind, sq, color) {
    const r = rowOf(sq), c = colOf(sq);
    const rr = color === RED ? 9 - r : r;
    switch (kind) {
      case P: {
        let v = (4 - Math.abs(c - 4)) * 4;
        if (rr >= 5) v += 40 + (rr - 5) * 18; // 过河兵价值陡增
        return v;
      }
      case H: return 20 - Math.abs(c - 4) * 4 - Math.abs(rr - 5) * 3; // 马喜中央
      case C: return 8 - Math.abs(c - 4) * 3;
      case R: return 6 - Math.abs(c - 4) * 2 + (rr >= 5 ? 8 : 0);
      default: return 0;
    }
  }

  function evaluate(b) {
    let score = 0;
    for (let i = 0; i < SIZE; i++) {
      const p = b[i];
      if (!p) continue;
      const color = p >> 3, kind = p & 7;
      const v = VALUE[kind] + pst(kind, i, color);
      score += color === RED ? v : -v;
    }
    return score;
  }

  /* ================= 搜索 ================= */
  const MATE = 100000;
  const TIMEOUT = new Error('search-timeout');

  const LEVELS = {
    easy:   { depth: 2, time: 250,  rand: 70 },
    normal: { depth: 4, time: 700,  rand: 0 },
    hard:   { depth: 6, time: 1200, rand: 0 },
  };

  function orderMoves(b, moves) {
    const n = moves.length;
    if (n < 2) return;
    const scored = new Array(n);
    for (let i = 0; i < n; i++) {
      const mv = moves[i];
      const victim = b[mv & 127];
      // MVV-LVA：先吃大子、先用小子吃
      scored[i] = [victim ? VALUE[victim & 7] * 10 - VALUE[b[mv >> 7] & 7] : 0, mv];
    }
    scored.sort((x, y) => y[0] - x[0]);
    for (let i = 0; i < n; i++) moves[i] = scored[i][1];
  }

  function search(b, side, depth, alpha, beta, ctx, ply) {
    if (((++ctx.nodes) & 1023) === 0 && Date.now() > ctx.deadline) throw TIMEOUT;
    if (depth <= 0) return side === RED ? evaluate(b) : -evaluate(b);

    const moves = genMoves(b, side);
    orderMoves(b, moves);
    let legal = 0, best = -Infinity;

    for (let i = 0; i < moves.length; i++) {
      const mv = moves[i];
      const cap = makeMove(b, mv);
      if (inCheck(b, side)) { unmakeMove(b, mv, cap); continue; }
      legal++;
      const score = -search(b, 1 - side, depth - 1, -beta, -alpha, ctx, ply + 1);
      unmakeMove(b, mv, cap);
      if (score > best) {
        best = score;
        if (score > alpha) alpha = score;
      }
      if (alpha >= beta) break;
    }

    if (legal === 0) return -MATE + ply; // 将死或困毙，都算负
    return best;
  }

  function rootSearch(b, side, depth, ctx) {
    const moves = legalMoves(b, side);
    if (!moves.length) return { move: null, score: -MATE, scored: [] };
    orderMoves(b, moves);

    let alpha = -Infinity, bestMove = moves[0], bestScore = -Infinity;
    const scored = [];
    for (let i = 0; i < moves.length; i++) {
      const mv = moves[i];
      const cap = makeMove(b, mv);
      const score = -search(b, 1 - side, depth - 1, -Infinity, -alpha, ctx, 1);
      unmakeMove(b, mv, cap);
      scored.push([mv, score]);
      if (score > bestScore) { bestScore = score; bestMove = mv; }
      if (score > alpha) alpha = score;
    }
    return { move: bestMove, score: bestScore, scored };
  }

  /**
   * 迭代加深 + 时间上限。返回 { move, score, depth, nodes }，无棋可走时返回 null。
   */
  function think(b, side, level) {
    const cfg = LEVELS[level] || LEVELS.normal;
    const ctx = { nodes: 0, deadline: Date.now() + cfg.time };
    const root = legalMoves(b, side);
    if (!root.length) return null;

    let best = { move: root[0], score: 0, depth: 0, scored: root.map((m) => [m, 0]) };
    for (let d = 1; d <= cfg.depth; d++) {
      try {
        const res = rootSearch(b, side, d, ctx);
        if (!res.move) break;
        best = { move: res.move, score: res.score, depth: d, scored: res.scored };
        if (Math.abs(res.score) > MATE - 1000) break; // 已找到杀棋
      } catch (e) {
        if (e !== TIMEOUT) throw e;
        break;
      }
    }

    if (cfg.rand > 0 && best.scored.length > 1) {
      const pool = best.scored.filter((s) => s[1] >= best.score - cfg.rand);
      if (pool.length > 1) best.move = pool[(Math.random() * pool.length) | 0][0];
    }
    return { move: best.move, score: best.score, depth: best.depth, nodes: ctx.nodes };
  }

  /* ================= 中文记谱 ================= */
  const CN_NUM = '一二三四五六七八九';

  /** 同一列有两个以上同种子时，用 前/中/后 代替列号 */
  function disambiguator(b, from, color, kind) {
    const c = colOf(from);
    const same = [];
    for (let r = 0; r < ROWS; r++) {
      const i = sqOf(r, c), q = b[i];
      if (q && (q >> 3) === color && (q & 7) === kind) same.push(i);
    }
    if (same.length < 2) return '';
    same.sort((x, y) => (color === RED ? x - y : y - x)); // 靠前的在前
    const idx = same.indexOf(from);
    if (idx < 0) return '';
    if (same.length === 2) return idx === 0 ? '前' : '后';
    if (same.length === 3) return ['前', '中', '后'][idx];
    return '';
  }

  /** 生成如「炮二平五」「馬8进7」的着法文本（b 为走子之前的局面） */
  function notate(b, mv) {
    const from = mv >> 7, to = mv & 127;
    const p = b[from];
    if (!p) return '';
    const color = p >> 3, kind = p & 7;
    const fr = rowOf(from), fc = colOf(from), tr = rowOf(to), tc = colOf(to);

    const fileOf = (col) => (color === RED ? 9 - col : col + 1);
    const num = (n) => (color === RED ? CN_NUM[n - 1] : String(n));
    const pre = disambiguator(b, from, color, kind);
    const head = pre ? pre + CHARS[color][kind - 1] : CHARS[color][kind - 1] + num(fileOf(fc));

    if (fr === tr) return head + '平' + num(fileOf(tc));

    const forward = color === RED ? tr < fr : tr > fr;
    const act = forward ? '进' : '退';
    if (fc === tc) return head + act + num(Math.abs(tr - fr));
    return head + act + num(fileOf(tc));
  }

  /* ================= 工具 ================= */
  function perft(b, side, depth) {
    if (depth === 0) return 1;
    let n = 0;
    const moves = legalMoves(b, side);
    for (let i = 0; i < moves.length; i++) {
      const cap = makeMove(b, moves[i]);
      n += perft(b, 1 - side, depth - 1);
      unmakeMove(b, moves[i], cap);
    }
    return n;
  }

  return {
    // 常量
    ROWS, COLS, SIZE, RED, BLACK, K, A, E, H, R, C, P, MATE,
    config, CHARS, LEVELS,
    // 规则开关
    rules, setRules, getRules,
    // 坐标与编码
    kindOf, colorOf, piece, sqOf, rowOf, colOf, mvFrom, mvTo, mkMove, inBoard, inPalace,
    // 规则
    initialBoard, genMoves, genMovesFrom, legalMoves, movesFrom,
    makeMove, unmakeMove, inCheck, isAttacked, findKing,
    // 引擎
    evaluate, think, perft,
    // 记谱
    notate,
  };
});
