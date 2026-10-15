/* M1 · 上下文是预算 */
(function () {
  "use strict";
  const { h, $, $$, reduced, term, Store, choice, copyBlock, section, todo, route } = window.Course;
  const ID = "M1";
  const fmt = (n) => Math.round(n).toLocaleString("en-US");
  const k = (n) => (n >= 1e6 ? (n / 1e6).toFixed(n % 1e6 ? 2 : 0) + "M" : n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(Math.round(n)));

  // ===== measured on this machine: pi 0.99.2, openai-codex/gpt-6-astra, 2026-10-13 =====
  // Each value = difference between two real runs of `pi --mode json --no-session ... "只回答一个字：好"`.
  const FIXED = [
    { id: "prompt", nm: "你的提示与消息格式", ds: "这次的提示只有 9 个字。其余是消息的包装。", tok: 68, c: "var(--c-user)", flag: null },
    { id: "base", nm: "pi 基础系统提示", ds: "基础说明、规则、pi 文档索引、工作目录。", tok: 444, c: "var(--c-harness)", flag: "--system-prompt <文字>（替换）" },
    { id: "agents", nm: "AGENTS.md", ds: "实验目录里的一行说明。", tok: 83, c: "color-mix(in srgb, var(--c-user) 60%, var(--c-harness))", flag: "-nc" },
    { id: "builtin", nm: "4 个内置工具", ds: "read、bash、edit、write 的说明和参数格式。", tok: 696, c: "var(--c-tool)", flag: "-nbt" },
    { id: "ext", nm: "pi-web-access 的 3 个工具", ds: "你装的联网扩展：web_search 等。", tok: 1476, c: "color-mix(in srgb, var(--c-tool) 55%, var(--c-model))", flag: "-ne" },
  ];
  const TOTAL = FIXED.reduce((a, b) => a + b.tok, 0); // 2767
  const W = 272000, RES = 16384, KEEP = 20000;

  // ================= §0 hero: the bill =================
  function bill() {
    const on = Object.fromEntries(FIXED.map((f) => [f.id, true]));
    const total = h("span", { class: "v" });
    const bar = h("div", { class: "bill-bar", role: "img", "aria-label": "一次请求的固定成本构成" });
    const segs = FIXED.map((f) => { const wide = f.tok / TOTAL > 0.12; const s = h("div", { class: "bill-seg", style: { background: f.c }, title: f.nm + " · " + fmt(f.tok) }, h("b", null, fmt(f.tok)), wide ? h("span", null, f.nm) : null); bar.append(s); return s; });
    const cmd = h("pre");
    const items = FIXED.map((f, i) => h("button", { class: "bill-item" + (f.flag ? "" : " fixed"), "aria-pressed": "true", disabled: !f.flag || null, title: f.flag ? "点击开关" : "这一项去不掉",
      onclick: () => { if (!f.flag) return; on[f.id] = !on[f.id]; paint(); } },
      h("span", { class: "sw", style: { background: f.c } }), h("span", null, h("div", { class: "nm" }, f.nm), h("div", { class: "ds" }, f.ds), h("div", { class: "ds", style: { marginTop: "4px" } }, f.flag ? ["关闭：", h("code", null, f.flag.split("（")[0])] : "无法关闭")), h("span", { class: "tk" }, fmt(f.tok))));
    function paint() {
      let sum = 0; FIXED.forEach((f) => { if (on[f.id]) sum += f.tok; });
      total.textContent = fmt(sum);
      FIXED.forEach((f, i) => { segs[i].style.flexBasis = on[f.id] ? (f.tok / TOTAL) * 100 + "%" : "0%"; segs[i].classList.toggle("off", !on[f.id]); items[i].setAttribute("aria-pressed", on[f.id]); });
      const flags = FIXED.filter((f) => f.flag && !on[f.id]).map((f) => f.flag.split("（")[0]);
      cmd.textContent = "pi " + (flags.length ? flags.join(" ") + " " : "") + '"只回答一个字：好"';
    }
    paint();
    return h("div", { class: "panel bill" },
      h("div", { class: "hero-lbl" }, h("span", null, "你本机一次请求的固定成本 · 你还没说正事"), h("span", null, "实测 · pi 0.99.2 · gpt-6-astra")),
      h("div", { class: "bill-total", style: { marginTop: "12px" } }, total, h("span", { class: "u" }, "input token · 每次请求都要付")),
      bar,
      h("div", { class: "bill-legend" }, items),
      h("div", { class: "flagline" }, h("div", { class: "mute", style: { fontSize: "15px", marginBottom: "4px" } }, "对应的启动命令（点上面的卡片开关各项）"), cmd));
  }

  // ================= §3 growth =================
  // M0's real run: provider-reported context (input + cacheRead) of each request.
  const M0REQ = [
    [2769, "第一次请求：只有固定成本和你的提示", "—"],
    [3140, "模型调用 bash（ls 和测试），工具返回一大段报错", "上一轮追加：工具调用 + 报错输出"],
    [3188, "模型调用 read 读 calc.py，工具返回 2 行代码", "上一轮追加：工具调用 + 2 行"],
    [3272, "模型调用 read 读 test_calc.py，工具返回 4 行代码", "上一轮追加：工具调用 + 4 行"],
    [3334, "模型调用 edit 改一处，工具只回一句 Successfully replaced", "上一轮追加：工具调用 + 一句话"],
    [3374, "模型调用 bash 重跑测试，工具返回「全部通过」", "上一轮追加：工具调用 + 一行"],
  ];
  function growth() {
    const max = Math.max(...M0REQ.slice(1).map((r, i) => r[0] - M0REQ[i][0]));
    return h("div", null,
      h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" },
        h("thead", null, h("tr", null, h("th", null, "请求"), h("th", { style: { textAlign: "right" } }, "这次请求的 token"), h("th", { style: { textAlign: "right" } }, "比上一次多"), h("th", null, "多出来的是什么"))),
        h("tbody", null, M0REQ.map(([tok, what], i) => {
          const d = i ? tok - M0REQ[i - 1][0] : null;
          return h("tr", null,
            h("td", { style: { whiteSpace: "nowrap", fontWeight: 600 } }, "第 " + (i + 1) + " 次"),
            h("td", { class: "n" }, fmt(tok)),
            h("td", { class: "n" }, d == null ? "—" : "+" + fmt(d)),
            h("td", null, what, d != null ? h("div", { class: "bar", style: { width: (d / max) * 100 + "%" } }) : null));
        })))),
      h("p", { class: "mute", style: { fontSize: "15px", margin: "8px 0 0" } }, "数据：M0 那次真实运行，每次请求由提供者报告的上下文 token（input + cacheRead）。两次请求之差 = 这一轮追加进历史的内容。"),
      h("div", { class: "panel", style: { marginTop: "14px", padding: "14px 18px", display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "center", flexWrap: "wrap" } },
        h("div", null, h("b", null, "另测一次：读一个 400 行的文本文件（3.5 KB）"), h("div", { class: "mute", style: { fontSize: "15px" } }, "单独的一次实测：读之前和读之后两次请求之差。")),
        h("div", { style: { fontSize: "30px", fontWeight: 900, fontVariantNumeric: "tabular-nums" } }, "+1,637")));
  }
  function estimator() {
    const ta = h("textarea", { id: "m1-est", spellcheck: "false", "aria-label": "粘贴任意文字估算 token" });
    ta.value = "上下文是一次请求里模型能看到的全部内容。\nThe model sees only what is in the request.";
    const big = h("div", { class: "big" }), det = h("div", { class: "dim", style: { fontSize: "15px" } }), pct = h("div", { class: "mute", style: { fontSize: "15px" } });
    const run = () => {
      const s = ta.value; let cjk = 0, other = 0;
      for (const ch of s) { if (/[　-〿㐀-鿿＀-￯]/.test(ch)) cjk++; else if (!/\s/.test(ch)) other++; }
      const ws = (s.match(/\s+/g) || []).length;
      const est = cjk * 0.65 + (other + ws) / 5;
      big.textContent = "≈ " + fmt(est);
      det.textContent = `${fmt(cjk)} 个中文字符 × 0.65 + ${fmt(other + ws)} 个其他字符 ÷ 5`;
      pct.textContent = `约占 272k 窗口的 ${(est / W * 100).toFixed(2)}%`;
    };
    ta.addEventListener("input", run); run();
    return h("div", { class: "panel est" }, ta, h("div", { class: "out" }, h("div", { class: "mute", style: { fontSize: "15px" } }, "粗略估算（误差约 ±30%）"), big, det, pct,
      h("div", { class: "mute", style: { fontSize: "15px", lineHeight: 1.6 } }, "系数来自本机实测：1,000 个汉字 ≈ 651 token；2,800 个英文字符 ≈ 552 token。代码和日志里符号多，通常更贵。")));
  }

  // ================= §4 footer =================
  const FOOT = [
    ["↑2.9k", "累计 input", "这个会话里所有请求的未缓存输入之和。只增不减。压缩、切分支都不会让它变小。"],
    ["↓10", "累计 output", "模型累计输出的 token。包括工具调用的参数文字。"],
    ["R2.7k", "累计缓存读取", "所有请求里命中提示缓存的 token 之和。没有命中时这一项不显示。"],
    ["CH96.6%", "最近一次缓存命中率", "最近一次请求里，cacheRead 占全部输入的比例。高说明前缀稳定，便宜。"],
    ["$0.032 (sub)", "累计费用", "按模型的目录价算出的费用。(sub) 表示你用的是订阅：这笔钱不会真的扣，但它反映了用量。"],
    ["1.0%/272k", "当前上下文", "最近一次回复后的上下文大小，占模型窗口的比例。超过 70% 变黄，超过 90% 变红。压缩后显示 ?，直到下一次回复。"],
    ["(auto)", "自动压缩开启", "上下文接近上限时，pi 会自动压缩。关掉它（compaction.enabled = false）这个标记就消失。"],
    ["gpt-6-astra • medium", "模型与思考强度", "当前模型 ID 和思考强度。Shift+Tab 切换强度。"],
  ];
  function footer() {
    const exp = h("div", { class: "panel fexp" }, h("span", { class: "mute" }, "点底栏上的任一段，看它的意思。"));
    const btns = FOOT.map(([txt, nm, why], i) => h("button", { "aria-pressed": "false", onclick: () => {
      btns.forEach((b, j) => b.setAttribute("aria-pressed", i === j)); Store.set(ID, "foot", { ...Store.get(ID, "foot", {}), [i]: 1 });
      exp.replaceChildren(h("div", null, h("span", { class: "k" }, txt), "　", h("b", null, nm)), h("p", { style: { margin: "6px 0 0" }, class: "dim" }, why));
    } }, txt));
    return h("div", null,
      h("div", { class: "footer-rep", role: "group", "aria-label": "pi 底栏" }, h("div", { class: "cwd" }, "~/pi-lab/m1"), btns.slice(0, 7), h("span", { class: "sp" }), btns[7]),
      h("div", { class: "mute", style: { fontSize: "15px", marginTop: "6px" } }, "本机真实截取：连续两次提问之后的底栏。字段含义已对照 pi 源码 footer.js 核实。"),
      exp);
  }

  // ================= §5 simulator =================
  const ACTS = [
    ["跑测试", 400, "失败时有报错，约 0.4k"],
    ["读 400 行文件", 1637, "实测 1.6k"],
    ["读 2,000 行文件", 8000, "按 400 行实测外推，约 8k"],
    ["改一处代码", 60, "实测约 60"],
    ["模型写长回复", 1500, "约 1.5k"],
    ["粘贴一份长日志", 25000, "估算 25k"],
  ];
  const SUMMARY = 3000;
  function simulator() {
    let win = W, res = RES, keep = KEEP;
    let hist = [], summary = 0, reqs = 0, cum = 0, comps = 0, series = [], log = [];
    let seed = 7;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const winSel = h("select", { id: "m1-win" }, [[128000, "128k"], [272000, "272k（你的 gpt-6-astra）"], [1000000, "1M"]].map(([v, t]) => h("option", { value: v, selected: v === W || null }, t)));
    const resIn = h("input", { type: "range", id: "m1-res", min: 4096, max: 65536, step: 4096, value: RES });
    const keepIn = h("input", { type: "range", id: "m1-keep", min: 5000, max: 60000, step: 5000, value: KEEP });
    const resV = h("span", { class: "val" }), keepV = h("span", { class: "val" }), thrV = h("span", { class: "val" });
    const bar = h("div", { class: "win", role: "img", "aria-label": "上下文窗口占用" });
    const sFx = h("div", { class: "seg fx" }), sSm = h("div", { class: "seg sm" }), sHs = h("div", { class: "seg hs" }), sRes = h("div", { class: "reserve" });
    bar.append(sFx, sSm, sHs, sRes);
    const stat = (lbl) => { const v = h("div", { class: "v" }); return [h("div", { class: "ctr" }, v, h("div", { class: "k" }, lbl)), v]; };
    const [e1, v1] = stat("请求次数"), [e2, v2] = stat("当前上下文"), [e3, v3] = stat("占窗口"), [e4, v4] = stat("累计发送");
    const chart = h("svg:svg", { class: "sim-chart", viewBox: "0 0 600 170", preserveAspectRatio: "none", role: "img", "aria-label": "每次请求的上下文大小" });
    const logEl = h("div", { class: "sim-log", "aria-live": "polite" });
    const ctxNow = () => TOTAL + summary + hist.reduce((a, b) => a + b.tok, 0);
    function compact() {
      let acc = 0, i = hist.length - 1;
      while (i >= 0 && acc < keep) { acc += hist[i].tok; i--; }
      const before = ctxNow();
      hist = hist.slice(i + 1); summary = SUMMARY; comps++;
      log.unshift(h("div", { class: "cmp" }, `自动压缩 #${comps}：${k(before)} → ${k(ctxNow())}。保留最近 ${k(acc)}，其余换成约 3k 的摘要。`));
      series.push({ v: ctxNow(), c: true });
    }
    function act(label, tok) {
      if (ctxNow() > win - res) compact();
      reqs++; const c = ctxNow(); cum += c; series.push({ v: c });
      hist.push({ label, tok });
      log.unshift(h("div", null, `请求 ${reqs}：发送 ${k(c)}。${label}，上下文 +${k(tok)}。`));
      if (log.length > 60) log.length = 60;
      Store.set(ID, "simReqs", Math.max(Store.get(ID, "simReqs", 0), reqs));
      if (comps) Store.set(ID, "simComp", true);
      paint();
    }
    function reset() { hist = []; summary = 0; reqs = 0; cum = 0; comps = 0; series = []; log = []; paint(); }
    function paint() {
      win = +winSel.value; res = +resIn.value; keep = +keepIn.value;
      resV.textContent = fmt(res); keepV.textContent = fmt(keep); thrV.textContent = fmt(win - res);
      const c = ctxNow(), hs = c - TOTAL - summary;
      sFx.style.width = (TOTAL / win) * 100 + "%"; sSm.style.width = (summary / win) * 100 + "%"; sHs.style.width = Math.min(100, (hs / win) * 100) + "%";
      sRes.style.width = (res / win) * 100 + "%";
      v1.textContent = reqs; v2.textContent = k(c); v3.textContent = ((c / win) * 100).toFixed(1) + "%"; v4.textContent = k(cum);
      v3.style.color = c / win > 0.9 ? "var(--bad)" : c / win > 0.7 ? "var(--warn)" : "";
      // chart
      chart.replaceChildren();
      const n = Math.max(series.length, 20), X = (i) => 30 + (i / (n - 1)) * 560, Y = (v) => 150 - (v / win) * 135;
      chart.append(h("svg:line", { x1: 30, x2: 590, y1: Y(win - res), y2: Y(win - res), stroke: "var(--bad)", "stroke-dasharray": "5 4", "stroke-width": 1.2 }),
        h("svg:text", { x: 34, y: Y(win - res) - 5, fill: "var(--bad)", style: { font: "600 11px var(--f-body)" } }, "压缩阈值 " + k(win - res)),
        h("svg:line", { x1: 30, x2: 590, y1: Y(win), y2: Y(win), stroke: "var(--line-2)", "stroke-width": 1 }),
        h("svg:text", { x: 590, y: Y(win) + 12, "text-anchor": "end", fill: "var(--fg-mute)", style: { font: "500 11px var(--f-body)" } }, "窗口 " + k(win)),
        h("svg:line", { x1: 30, x2: 590, y1: 150.5, y2: 150.5, stroke: "var(--line-2)" }));
      if (series.length) {
        chart.append(h("svg:polyline", { points: series.map((p, i) => X(i) + "," + Y(p.v)).join(" "), fill: "none", stroke: "var(--c-ctx)", "stroke-width": 2, "vector-effect": "non-scaling-stroke" }));
        series.forEach((p, i) => { if (p.c) chart.append(h("svg:circle", { cx: X(i), cy: Y(p.v), r: 4, fill: "var(--c-tool)" })); });
      } else chart.append(h("svg:text", { x: 300, y: 90, "text-anchor": "middle", fill: "var(--fg-mute)", style: { font: "500 13px var(--f-body)" } }, "点左边的动作，开始一次会话"));
      logEl.replaceChildren(...log);
    }
    [winSel, resIn, keepIn].forEach((el) => el.addEventListener("input", paint));
    const btns = ACTS.map(([lbl, tok, note]) => h("button", { class: "btn", onclick: () => act(lbl, tok), title: note }, h("span", null, lbl), h("span", { class: "k" }, "+" + k(tok))));
    const auto = h("button", { class: "btn primary", onclick: () => { for (let i = 0; i < 80; i++) { const r = rnd(); const a = r < 0.25 ? ACTS[0] : r < 0.5 ? ACTS[1] : r < 0.7 ? ACTS[2] : r < 0.85 ? ACTS[3] : r < 0.95 ? ACTS[4] : ACTS[5]; act(a[0], a[1]); } } }, "连续干 80 轮活");
    paint();
    return h("div", { class: "panel sim" },
      h("div", { class: "sim-top" },
        h("label", { for: "m1-win" }, "模型窗口", winSel),
        h("label", { for: "m1-res" }, h("span", null, "reserveTokens ", resV), resIn),
        h("label", { for: "m1-keep" }, h("span", null, "keepRecentTokens ", keepV), keepIn),
        h("div", { style: { fontSize: "15px", color: "var(--fg-dim)" } }, "阈值 = 窗口 − reserve = ", thrV),
        h("button", { class: "btn ghost", onclick: reset, style: { marginLeft: "auto" } }, "重来")),
      h("div", { class: "sim-grid" },
        h("div", { class: "sim-acts" }, h("div", { class: "mute", style: { fontSize: "15px" } }, "每点一次 = 一轮：先发请求，再把结果加进历史。"), btns, auto),
        h("div", { class: "sim-main" },
          bar,
          h("div", { class: "win-legend" }, h("span", null, h("i", { style: { background: "var(--c-harness)" } }), "固定成本 2.8k"), h("span", null, h("i", { style: { background: "var(--c-tool)" } }), "压缩摘要"), h("span", null, h("i", { style: { background: "var(--c-ctx)" } }), "会话历史"), h("span", null, h("i", { style: { background: "color-mix(in srgb, var(--bad) 35%, transparent)" } }), "reserve：留给回复，不许占")),
          h("div", { class: "sim-stats" }, e1, e2, e3, e4),
          chart, logEl)));
  }

  // ================= §6 calculations =================
  const CALC = [
    { q: "窗口 272,000，reserveTokens 16,384（默认）。上下文超过多少时自动压缩？", a: 255616, tol: 0, hint: "272,000 − 16,384 = 255,616。超过它，下一次请求前就压缩。" },
    { q: "窗口 200,000，reserve 默认。当前上下文 190,000。下一次请求前，差多少就会触发？若已触发填 0。", a: 0, tol: 0, hint: "阈值 = 200,000 − 16,384 = 183,616。190,000 已经超过，所以会立即压缩。" },
    { q: "1M 窗口的模型，用 modelOverrides 把它的 reserveTokens 设成 400,000。压缩阈值是多少？", a: 600000, tol: 0, hint: "1,000,000 − 400,000 = 600,000。这正是 pi 文档里的例子：大窗口也提前压缩，省钱、保质量。" },
    { q: "固定成本 2,767。压缩后保留最近 20,000，摘要约 3,000。压缩后上下文约多少？", a: 25767, tol: 300, hint: "2,767 + 3,000 + 20,000 ≈ 25,767。注意：保留部分按整条消息切，会略多于 20,000。" },
    { q: "一个会话有 50 次请求，每次平均发送 100,000 token。累计发送多少（单位：百万，填数字）？", a: 5, tol: 0.01, hint: "50 × 100,000 = 5,000,000。长会话最贵的不是单次，而是每次都重发全部历史。" },
  ];
  function calcs() {
    const saved = Store.get(ID, "calc", {});
    const rows = CALC.map((c, i) => {
      const inp = h("input", { type: "number", id: "m1-calc-" + i, step: "any", value: saved[i] ?? "" });
      const hint = h("div", { class: "hint", hidden: true });
      const mark = () => {
        const v = parseFloat(String(inp.value).replace(/,/g, ""));
        const ok = Math.abs(v - c.a) <= c.tol;
        inp.classList.toggle("right", ok); inp.classList.toggle("wrong", !ok);
        hint.hidden = false; hint.replaceChildren(h("span", { class: "verdict " + (ok ? "ok" : "no"), style: { fontWeight: 700, marginRight: "6px", color: ok ? "var(--ok)" : "var(--bad)" } }, ok ? "对。" : "再算一次。"), c.hint);
        return ok;
      };
      const btn = h("button", { class: "btn", onclick: () => { const ok = mark(); const s = { ...Store.get(ID, "calc", {}) }; s[i] = inp.value; s["ok" + i] = ok; Store.set(ID, "calc", s); } }, "核对");
      if (saved["ok" + i] !== undefined) setTimeout(mark, 0);
      const peek = h("button", { class: "btn ghost", onclick: () => { inp.value = c.a; btn.click(); } }, "看答案");
      return h("div", { class: "calc-row" }, h("div", null, h("b", { class: "mute", style: { marginRight: "8px" } }, String(i + 1)), c.q), inp, h("div", { style: { display: "flex", gap: "6px" } }, btn, peek), hint);
    });
    return h("div", { class: "panel calc" }, rows);
  }

  // ================= §7 save budget =================
  const SAVE = [
    { q: "你只需要 utils.ts 里 parseDate 这一个函数。文件 3,000 行。", opts: [{ t: "让 pi 先用 grep 定位，再用 read 的 offset/limit 只读那一段", ok: true }, { t: "让 pi 读整个文件，它会自己找" }], why: "整份 3,000 行约 12k token，而且之后每一轮都要重发。只读需要的 40 行，成本不到 1/50。" },
    { q: "构建失败，日志 5 MB。", opts: [{ t: "把日志整个粘贴进对话" }, { t: "让 pi 用 bash 跑 tail -n 80 或 grep -n error，只看关键行", ok: true }], why: "粘贴进对话的文字也会每轮重发。bash 的输出本身也有上限（2,000 行或 50 KB），但先过滤更省。" },
    { q: "今天只改本地代码，不需要联网。", opts: [{ t: "用 pi -ne 启动，或在设置里停用 pi-web-access", ok: true }, { t: "在 AGENTS.md 写「今天不要联网」" }], why: "写在 AGENTS.md 里，工具定义照样在请求里，还多了几个 token。-ne 让 1,476 token 直接消失。" },
    { q: "修完一个 bug，接下来要写一份与之无关的文档。", opts: [{ t: "继续在当前会话里说「现在写文档」" }, { t: "/new 开一个新会话", ok: true }], why: "旧话题的历史对新任务没用，却每轮都要付费，还可能干扰模型。新会话从 2.8k 起步。" },
    { q: "一个长任务做到一半，上下文到了 60%。前半段大量探索已经没用，但结论很重要。", opts: [{ t: "/compact 保留已确认的结论和接下来的步骤", ok: true }, { t: "什么也不做，等它到阈值自动压缩" }], why: "手动压缩可以带指令，告诉摘要该保留什么。自动压缩只能按默认格式总结。M4 会细讲。" },
  ];
  function saving() {
    return h("div", null, SAVE.map((s, i) => choice({ id: "s" + i, store: [ID, "save"], kicker: "场景 " + (i + 1) + " / " + SAVE.length, q: s.q, opts: s.opts, explain: s.why, shuffleSeed: 3 + i * 5 })));
  }

  // ================= §8 lab =================
  const LAB_SETUP = `mkdir -p ~/pi-lab/m1 && cd ~/pi-lab/m1
printf -- '- 运行测试用 \`python3 test_calc.py\`。\\n' > AGENTS.md`;
  const LAB_RUN = `for f in 默认 -nc -ne -nt; do
  a=$f; [ "$f" = 默认 ] && a=
  pi --mode json --no-session $a "只回答一个字：好" < /dev/null \\
    | jq -r --arg f "$f" 'select(.type=="turn_end") | "\\($f) \\(.message.usage.input + .message.usage.cacheRead)"'
done`;
  const LAB_CLEAN = "cd ~ && rm -r ~/pi-lab/m1 && rmdir --ignore-fail-on-non-empty ~/pi-lab";
  const LAB_SAMPLE = "默认 2769\n-nc 2685\n-ne 1293\n-nt 597";
  function lab() {
    const saved = Store.get(ID, "lab", {});
    const ta = h("textarea", { class: "paste", id: "m1-lab-paste", spellcheck: "false", placeholder: "默认 2769\n-nc 2685\n-ne 1293\n-nt 597" });
    ta.value = saved.raw || "";
    ta.addEventListener("input", () => { delete ta.dataset.sample; });
    const out = h("div");
    const verify = (sample) => {
      if (sample) { ta.value = LAB_SAMPLE; ta.dataset.sample = "1"; }
      const isSample = ta.dataset.sample === "1";
      const m = {};
      for (const line of ta.value.split(/\r?\n/)) { const r = line.trim().match(/^(默认|-nc|-ne|-nt)\s+(\d+)$/); if (r) m[r[1]] = +r[2]; }
      const need = ["默认", "-nc", "-ne", "-nt"].filter((x) => !(x in m));
      if (need.length) { out.replaceChildren(h("div", { class: "note warn" }, h("span", { class: "k" }, "无法读取"), "缺少这些行：" + need.join("、") + "。每行应是「标签 空格 数字」。")); return; }
      const d = m["默认"];
      const checks = [
        [d > m["-nc"] || d === m["-nc"], "关掉上下文文件后，请求不会变大"],
        [d >= m["-ne"], "关掉扩展后，请求不会变大"],
        [m["-nt"] < m["-ne"] && m["-nt"] < d, "关掉全部工具后，请求明显变小"],
      ];
      const ans = { a: d - m["-nc"], e: d - m["-ne"], t: d - m["-nt"] };
      const qs = h("div", { class: "count-q", style: { padding: "12px 0" } });
      const mk = (key, label) => { const i = h("input", { type: "number", id: "m1-lab-" + key }); qs.append(h("label", { for: "m1-lab-" + key }, label, i)); return [i, ans[key]]; };
      const fields = [mk("a", "AGENTS.md 每次请求花多少 token？"), mk("e", "扩展每次请求花多少？"), mk("t", "全部工具每次请求花多少？")];
      const fb = h("div", { class: "feedback", style: { padding: 0 }, hidden: true });
      out.replaceChildren(h("ul", { class: "check-list" }, checks.map(([ok, t]) => h("li", null, h("span", { class: ok ? "ok" : "no" }, ok ? "✓" : "✗"), t))),
        checks.every((c) => c[0]) ? h("div", null, h("p", null, "用你的四个数字做减法："), qs,
          h("button", { class: "btn primary", onclick: () => {
            const good = fields.every(([i, r]) => +i.value === r);
            fields.forEach(([i, r]) => { i.classList.toggle("right", +i.value === r); i.classList.toggle("wrong", +i.value !== r); });
            fb.hidden = false;
            if (good && !isSample) { Store.set(ID, "lab", { raw: ta.value, passed: true, ...ans }); fb.replaceChildren(h("span", { class: "verdict ok" }, "实验通过。"), `你的固定成本里，工具占 ${fmt(ans.t)} token，约 ${Math.round(ans.t / d * 100)}%。最后一步：清理实验目录。`); checkDone(); }
            else if (good) fb.replaceChildren(h("span", { class: "verdict ok" }, "算对了。"), "这是示例数据，不计入实验。请用你自己的运行再做一次。");
            else fb.replaceChildren(h("span", { class: "verdict no" }, "再算一次。"), "某一项的花费 = 默认 − 关掉这一项后的数字。");
          } }, "核对答案"), fb)
          : h("div", { class: "note warn" }, h("span", { class: "k" }, "数字不合理"), "检查是否在实验目录里运行，以及是否完整粘贴。"));
    };
    if (saved.raw) setTimeout(() => verify(false), 0);
    return h("div", { class: "lab-steps" },
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "建实验目录，放一份 AGENTS.md。"), copyBlock(LAB_SETUP))),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "同一句提示，开关不同部分，各跑一次。"),
        h("p", { class: "dim", style: { margin: "4px 0 0" } }, "每行输出「标签 上下文 token」。上下文 = input + cacheRead：连续运行时，后几次会命中缓存，只看 input 会偏小。共 4 次很小的模型调用。"), copyBlock(LAB_RUN))),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "粘贴 4 行输出，核对。"), h("div", { style: { marginTop: "8px" } }, ta),
        h("div", { style: { display: "flex", gap: "8px", marginTop: "8px" } }, h("button", { class: "btn primary", onclick: () => verify(false) }, "核对我的运行"), h("button", { class: "btn ghost", onclick: () => verify(true) }, "先用示例数据试试")), out)),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "清理。"), h("p", { class: "dim", style: { margin: "4px 0 0" } }, "删除实验目录。若 ~/pi-lab 已空，也一并删除。"), copyBlock(LAB_CLEAN))));
  }

  // ================= §9 quiz =================
  const QUIZ = [
    { q: "一次请求里，哪一部分在同一会话的每一轮都完全相同？", opts: [{ t: "系统提示和工具定义", ok: true }, { t: "会话历史" }, { t: "最近的工具结果" }], why: "固定部分每轮相同，所以它最适合被提示缓存命中。历史和工具结果每轮都在变长。" },
    { q: "你装了一个 Skill。它在每次请求里占多少？", opts: [{ t: "名字、描述和路径，几十个 token", ok: true }, { t: "SKILL.md 的全文" }, { t: "0，直到你用 /skill 调用" }], why: "实测：一个示例 Skill 让请求多了 174 token，其中约 100 是 skills 段落的固定说明。全文只在模型 read 它时才进入上下文。" },
    { q: "本机实测，pi-web-access 每次请求固定花 1,476 token。今天不需要联网，最直接的做法是：", opts: [{ t: "用 pi -ne 启动，或停用这个包", ok: true }, { t: "在 AGENTS.md 写「不要联网」" }, { t: "换一个更小的模型" }], why: "只有把工具从请求里拿掉，成本才会消失。文字指令拿不掉工具定义。" },
    { q: "底栏显示 R2.7k CH96.6%。CH 指的是：", opts: [{ t: "最近一次请求的缓存命中率", ok: true }, { t: "上下文占窗口的比例" }, { t: "累计费用中缓存的占比" }], why: "CH = 最近一次请求的 cacheRead ÷ 该次全部输入。" },
    { q: "窗口 272k，reserveTokens 默认 16,384。自动压缩在上下文超过多少时触发？", opts: [{ t: "255,616", ok: true }, { t: "272,000" }, { t: "16,384" }], why: "阈值 = 窗口 − reserveTokens。reserve 是留给模型回复的空间。" },
    { q: "压缩之后，被摘要掉的原始消息：", opts: [{ t: "仍然留在会话文件里，只是不再发送给模型", ok: true }, { t: "从会话文件里删除" }, { t: "移到一个归档文件" }], why: "压缩追加一条摘要条目，原始条目全部保留。M3、M4 会用到这一点。" },
    { q: "一个会话 50 次请求，每次平均发送 100k token。累计发送约：", opts: [{ t: "5M", ok: true }, { t: "100k" }, { t: "50k" }], why: "每次请求都重发全部历史。累计发送 = 每次大小之和。" },
    { q: "提示缓存命中之后，模型看到的上下文：", opts: [{ t: "和不命中时完全一样", ok: true }, { t: "变短了，只剩新增部分" }, { t: "变成了一份摘要" }], why: "缓存只改变计费和速度，不改变内容。" },
    { q: "底栏的 ↑ 数字在压缩后：", opts: [{ t: "不会变小，它是累计值", ok: true }, { t: "会归零" }, { t: "会减去被压缩的部分" }], why: "↑ 累计整个会话所有请求的未缓存输入。会变小的是百分比那一项。" },
    { q: "接下来的任务和当前会话无关。最好：", opts: [{ t: "/new 开新会话", ok: true }, { t: "继续在当前会话里做" }, { t: "先 /compact 再继续" }], why: "无关历史只增加成本和干扰。新会话从固定成本起步。" },
  ];
  function quiz() { return window.Course.quizBlock(ID, QUIZ, checkDone); }

  // ================= §1 review & predictions =================
  const REVIEW = [
    { q: "（复习 M0）calc.py 的内容什么时候第一次进入上下文？", opts: [{ t: "read 的工具结果追加之后，下一次请求里", ok: true }, { t: "pi 启动时" }, { t: "模型推理时直接访问磁盘" }], why: "文件内容只有经工具读取，才作为工具结果进入会话。" },
    { q: "（复习 M0）为什么每次请求都比上一次大？", opts: [{ t: "pi 把之前的全部回复和工具结果重新放进请求", ok: true }, { t: "模型的记忆在增长" }, { t: "系统提示每轮都会变长" }], why: "模型没有记忆。这正是本课的起点：重发的每个 token 都要付费。" },
  ];
  const PRE = [
    { id: "p1", q: "你还没说正事。你本机的 pi 每次请求固定占多少 token？", opts: [{ t: "约 50" }, { t: "约 500" }, { t: "约 2,800", ok: true }] },
    { id: "p2", q: "你装的联网扩展 pi-web-access，每次请求占多少？", opts: [{ t: "约 50" }, { t: "约 300" }, { t: "约 1,500", ok: true }] },
    { id: "p3", q: "你的模型窗口 272k。上下文到多少时，pi 自动压缩？", opts: [{ t: "272k，满了才压" }, { t: "约 256k", ok: true }, { t: "约 136k，一半时压" }] },
  ];
  function recap() {
    return window.Course.recapBlock(ID, {
      pre: PRE, quizMin: 8,
      next: { id: "M2", title: "第一次会话", text: "你已经知道每轮要付什么。M2 教你在真实的交互界面里驾驭 pi：引用文件、运行命令、在运行中插话和排队、中断。" },
      extra: () => [["算一算", CALC.filter((_, i) => Store.get(ID, "calc", {})["ok" + i]).length + " / " + CALC.length], ["省预算场景", SAVE.filter((s, i) => s.opts[Store.get(ID, "save", {})["s" + i]]?.ok).length + " / " + SAVE.length]],
    });
  }
  function checkDone() {
    const ok = Store.get(ID, "lab", {}).passed && Store.get(ID, "quiz", { best: 0 }).best >= 8;
    if (ok && !Store.get(ID, "done")) Store.set(ID, "done", true);
  }

  // ================= page =================
  window.Course.register(ID, (page) => {
    const rc = recap();
    page.append(h("div", { class: "bench" },
      h("header", { class: "mhead" }, h("div", { class: "crumbs" }, "第 1 单元 · 心智模型 / M1"), h("h1", { class: "mtitle" }, h("span", { class: "mid" }, "M1"), "上下文是预算")),
      section("s-hero", 0, "开场", null, bill(),
        h("div", { class: "col" },
          h("p", { class: "thesis" }, "每次请求都为全部上下文付费。", h("br"), "上下文是预算，不是仓库。"),
          h("p", { class: "lead" }, "上面这根条，是你本机的 pi 在你只说「好」时发出的请求。2,767 个 token 里，你的话只占几个。剩下的每一轮都要再付一次。"),
          h("p", null, "M0 说过：模型没有记忆，pi 每轮重发全部历史。本课把这句话变成数字。你会算出每一块花多少、历史怎样增长、何时触发压缩、怎样省。")),
        h("div", { class: "panel objectives" },
          h("ol", null,
            h("li", null, "列出一次请求的五类固定组成，说出每类由谁控制、怎样关掉。"),
            h("li", null, "说出常见动作让上下文增长多少，并能粗略估算任意文字的 token 数。"),
            h("li", null, "读懂 pi 底栏的每一个字段。"),
            h("li", null, "用公式算出自动压缩何时触发，以及压缩后大约剩多少。"),
            h("li", null, "在具体场景里选出更省预算的做法。")),
          h("div", { class: "obj-side" },
            h("div", null, h("span", { class: "k" }, "时长"), "约 60 分钟"),
            h("div", null, h("span", { class: "k" }, "前置"), "M0"),
            h("div", null, h("span", { class: "k" }, "练习"), "§8 实验 + §9 测验（≥ 8/10）"),
            h("div", null, h("span", { class: "k" }, "核对版本"), "pi 0.99.2 · gpt-6-astra"))),
        h("h3", null, "本课路线"),
        route(ID, [["s-pre", 1, "动手", "复习与预测"], ["s-fixed", 2, "动手", "固定成本"], ["s-grow", 3, "动手", "增长成本"], ["s-foot", 4, "动手", "读底栏"], ["s-sim", 5, "动手", "预算模拟器"], ["s-calc", 6, "动手", "算一算"], ["s-save", 7, "动手", "省预算"], ["s-lab", 8, "实验", "量你的固定成本"], ["s-quiz", 9, "测验", "10 题"], ["s-recap", 10, "阅读", "小结"]])),
      h("div", { class: "col" },
        section("s-pre", 1, "复习与预测", "先复习，再预测",
          todo("先答两道 M0 复习题（立即判对错）。再做三道预测（课末揭晓）。"),
          h("p", null, "间隔复习：每课开头抽查上一课。答错就回去重看对应那一节。"),
          REVIEW.map((r, i) => choice({ id: "r" + i, store: [ID, "rev"], kicker: "复习 " + (i + 1) + " / 2", q: r.q, opts: r.opts, explain: r.why, shuffleSeed: 21 + i * 7 })),
          PRE.map((p, i) => choice({ id: p.id, store: [ID, "pre"], kicker: "预测 " + (i + 1) + " / 3", q: p.q, opts: p.opts, reveal: false, shuffleSeed: 9 + i * 13 }))),
        section("s-fixed", 2, "固定成本", "每次请求的固定成本",
          todo("回到页面顶部那根条，点卡片开关各项。看总数和启动命令怎么变。"),
          h("p", null, "固定成本是每次请求都一样的部分。它在你说任何话之前就已经在请求里了。"),
          h("ul", { class: "rule" },
            h("li", null, h("b", null, "pi 基础系统提示（444）。"), "pi 自带。能用 --system-prompt 整体替换，但那样会丢掉 pi 教给模型的规则，一般不这样做。"),
            h("li", null, h("b", null, "AGENTS.md（83）。"), "你写的。越长越贵。它每轮都在，所以只写每轮都需要的事。"),
            h("li", null, h("b", null, "内置工具（696）。"), "每个工具都带说明和参数格式。用 --tools 只开需要的工具。"),
            h("li", null, h("b", null, "扩展工具（1,476）。"), "你装的扩展注册的工具。这是本机最大的一块。用 -ne 关掉全部扩展。"),
            h("li", null, h("b", null, "Skill（本机没有）。"), "每个 Skill 只放名字、描述和路径。实测一个示例 Skill +174。注意：只有开了 read 或 bash 工具时，pi 才列出 Skill，因为模型得有办法读它（pi 源码 system-prompt.js）。")),
          h("div", { class: "note" }, h("span", { class: "k" }, "测量方法"), "每个数字都是两次真实运行之差。例如 AGENTS.md = 默认 − 加 -nc 之后。各项相加正好等于 2,767，说明它们互不重叠。§8 你会用同样的方法量你自己的。")),
        section("s-grow", 3, "增长成本", "每一轮让上下文长多少",
          todo("按时间顺序读下表：每次请求比上一次多了多少，多出来的是什么。然后在估算器里试一段你常用的文字。"),
          h("p", null, "固定成本之外，每一轮都会把模型的工具调用和工具结果追加进历史。所以下一次请求总比上一次大。追加的东西不会自己消失，之后每一轮都要重发。"))),
      h("div", { class: "bench" }, growth()),
      h("div", { class: "col" },
        h("p", { style: { marginTop: "20px" } }, "规律：", h("b", null, "读文件最贵，改文件最便宜。"), "因为 read 把文件内容整段放进历史，而 edit 只放一句成功提示。pi 的 read 默认一次最多 2,000 行或 50 KB，超过就截断，并提示模型用 offset 继续。"),
        h("h3", null, "token 估算器")),
      h("div", { class: "bench" }, estimator()),
      h("div", { class: "col" },
        section("s-foot", 4, "读底栏", "读懂 pi 的底栏",
          todo("逐个点击底栏的 8 段，读懂每一段。"),
          h("p", null, "pi 界面最下面一行实时报账。会读它，你随时知道花了多少、还剩多少。"),
          footer(),
          h("div", { class: "note warn" }, h("span", { class: "k" }, "两类数字，别混"), "↑ ↓ R $ 是", h("b", null, "累计值"), "，只增不减。百分比是", h("b", null, "当前值"), "，压缩后会下降。判断「还能聊多久」看百分比；判断「花了多少」看累计值。")),
        section("s-sim", 5, "预算模拟器", "看一个长会话怎样撞上限",
          todo("先点「连续干 80 轮活」。再把窗口改成 128k，重来一次。然后拖动两个滑块，观察压缩点和压缩后的高度。"),
          h("p", null, "折线是每次请求的上下文。紫点是一次自动压缩。红虚线是阈值 = 窗口 − reserveTokens。"))),
      h("div", { class: "bench" }, simulator()),
      h("div", { class: "col" },
        h("h3", null, "你应该看到的三件事"),
        h("ul", { class: "rule" },
          h("li", null, "上下文呈锯齿形：一路上升，碰到阈值就掉下来，再上升。"),
          h("li", null, "keepRecentTokens 越大，压缩后掉得越少，下一次压缩来得越快。"),
          h("li", null, "「累计发送」增长得比「当前上下文」快得多。长会话的成本主要来自重发。")),
        h("div", { class: "note" }, h("span", { class: "k" }, "模拟器做了简化"), "真实的 pi 只在合法的切点切开（例如不会把工具调用和它的结果分开），摘要大小也因内容而异。这里摘要固定取 3k。M4 讲真实规则。"),
        section("s-calc", 6, "算一算", "用公式算",
          todo("用下面三条关系算五道题，逐题核对。算不出来就点「看答案」，答案下面有算法。"),
          h("ul", { class: "rule" },
            h("li", null, h("b", null, "压缩阈值："), h("code", null, "窗口 − reserveTokens"), "。上下文超过它，下一次请求前自动压缩。reserveTokens 默认 16,384，可以按模型单独设置（modelOverrides）。"),
            h("li", null, h("b", null, "压缩后的上下文 ≈ "), "固定成本 + 摘要 + 保留的最近消息（§5 的模拟器里那一下回落）。"),
            h("li", null, h("b", null, "累计发送 = "), "每次请求的大小相加。每次请求都重发全部历史，所以长会话的总量增长得很快。")),
          calcs()),
        section("s-save", 7, "省预算", "哪种做法更省",
          todo("先读五个办法，再用它们做五个场景题。"),
          h("ul", { class: "rule" },
            h("li", null, h("b", null, "只读需要的部分："), "大文件先用 grep 定位，再用 read 的 offset/limit 读那几十行。读进来的东西之后每轮都要重发。"),
            h("li", null, h("b", null, "先过滤再看："), "长日志让 bash 跑 tail 或 grep，只把关键行放进上下文；不要整个粘贴进对话。"),
            h("li", null, h("b", null, "关掉用不到的工具："), "-ne 关掉扩展，它们的工具定义（本机 pi-web-access 1,476 token）就不再发送。在 AGENTS.md 里写「别用」不省任何 token。"),
            h("li", null, h("b", null, "换话题就开新会话："), "/new 从固定成本重新起步；旧话题的历史对新任务没用，却每轮都要付费。"),
            h("li", null, h("b", null, "主动压缩，并告诉它留什么："), "/compact 后面可以加一句说明，例如「/compact 保留已确认的结论和文件名」。第 5 课细讲。")),
          saving()),
        section("s-lab", 8, "实验", "量出你自己的固定成本",
          todo("在终端按顺序运行第 1、2 步，把输出贴到第 3 步，最后运行第 4 步清理。"),
          h("p", null, "用和本课相同的方法，量你自己的 pi。你的扩展和配置不同，数字也会不同。这正是要测的。"),
          h("div", { class: "note" }, h("span", { class: "k" }, "实验规则"), "只在 ~/pi-lab/m1 里做；pi 带 --no-session，不留会话；不改全局配置；最后清理。"),
          lab()),
        section("s-quiz", 9, "掌握测验", "10 题，8 题过关", todo("10 题全部作答，点「交卷」。"), quiz()),
        section("s-recap", 10, "小结", "你学到了什么",
          todo("看自己的预测和成绩。觉得学会了，就在本节最后点「标记为已完成」。", true),
          h("p", { class: "lead" }, "一句话：每次请求都为全部上下文付费；固定成本由工具和指令决定，增长成本由读进来的东西决定，压缩由「窗口 − reserve」触发。"),
          rc))));
    return () => rc._cleanup && rc._cleanup();
  });
})();
