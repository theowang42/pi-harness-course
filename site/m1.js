/* M1 · 上下文是预算 */
(function () {
  "use strict";
  const { h, term, section, quizBlock, lessonHead, look, howto, endBlock } = window.Course;
  const ID = "M1";
  const fmt = (n) => Math.round(n).toLocaleString("en-US");
  const k = (n) => (n >= 1e6 ? (n / 1e6).toFixed(n % 1e6 ? 2 : 0) + "M" : n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(Math.round(n)));

  // Measured with pi 0.99.2 + gpt-6-astra: each value is the difference between two real runs
  // of `pi --mode json --no-session ... "只回答一个字：好"` with one part switched off.
  const FIXED = [
    { id: "prompt", nm: "你的消息", ds: "这次只说了一句「只回答一个字：好」，加上消息的包装。", tok: 68, c: "var(--c-user)", flag: null },
    { id: "base", nm: "pi 的基础系统提示", ds: "pi 自己的说明、使用规则、文档索引、工作目录。", tok: 444, c: "var(--c-harness)", flag: null },
    { id: "agents", nm: "AGENTS.md", ds: "项目目录里一行说明。", tok: 83, c: "color-mix(in srgb, var(--c-user) 60%, var(--c-harness))", flag: "-nc" },
    { id: "builtin", nm: "4 个内置工具的定义", ds: "read、bash、edit、write 的说明和参数格式。", tok: 696, c: "var(--c-tool)", flag: "-nbt" },
    { id: "ext", nm: "一个扩展的 3 个工具", ds: "这台电脑装了联网扩展 pi-web-access。", tok: 1476, c: "color-mix(in srgb, var(--c-tool) 55%, var(--c-model))", flag: "-ne" },
  ];
  const TOTAL = FIXED.reduce((a, b) => a + b.tok, 0);
  const RESERVE = 16384, KEEP = 20000, SUMMARY = 3000;

  // ================= §1 fixed cost =================
  function bill() {
    const on = Object.fromEntries(FIXED.map((f) => [f.id, true]));
    const total = h("span", { class: "v" });
    const bar = h("div", { class: "bill-bar", role: "img", "aria-label": "一次请求的固定部分由哪几块组成" });
    const segs = FIXED.map((f) => { const wide = f.tok / TOTAL > 0.12; const s = h("div", { class: "bill-seg", style: { background: f.c }, title: f.nm + " · " + fmt(f.tok) }, h("b", null, f.tok / TOTAL > 0.04 ? fmt(f.tok) : ""), wide ? h("span", null, f.nm) : null); bar.append(s); return s; });
    const cmd = h("pre");
    const items = FIXED.map((f) => h("button", { class: "bill-item" + (f.flag ? "" : " fixed"), "aria-pressed": "true", disabled: !f.flag || null, title: f.flag ? "点击开关" : "这一块去不掉",
      onclick: () => { if (!f.flag) return; on[f.id] = !on[f.id]; paint(); } },
      h("span", { class: "sw", style: { background: f.c } }), h("span", null, h("div", { class: "nm" }, f.nm), h("div", { class: "ds" }, f.ds), h("div", { class: "ds", style: { marginTop: "4px" } }, f.flag ? ["关掉它：", h("code", null, f.flag)] : "去不掉")), h("span", { class: "tk" }, fmt(f.tok))));
    function paint() {
      let sum = 0; FIXED.forEach((f) => { if (on[f.id]) sum += f.tok; });
      total.textContent = fmt(sum);
      FIXED.forEach((f, i) => { segs[i].style.flexBasis = on[f.id] ? (f.tok / TOTAL) * 100 + "%" : "0%"; segs[i].classList.toggle("off", !on[f.id]); items[i].setAttribute("aria-pressed", on[f.id]); });
      const flags = FIXED.filter((f) => f.flag && !on[f.id]).map((f) => f.flag);
      cmd.textContent = "pi" + (flags.length ? " " + flags.join(" ") : "");
    }
    paint();
    return h("div", { class: "panel bill" },
      h("div", { class: "hero-lbl" }, h("span", null, "一次请求里每次都有的部分"), h("span", null, "一台电脑上的实测")),
      h("div", { class: "bill-total", style: { marginTop: "12px" } }, total, h("span", { class: "u" }, "token")),
      bar,
      h("div", { class: "bill-legend" }, items),
      h("div", { class: "flagline" }, h("div", { class: "mute", style: { fontSize: "15px", marginBottom: "4px" } }, "对应的启动命令"), cmd));
  }

  // ================= §2 growth =================
  // M0's run: context size of each request as reported by the provider.
  const M0REQ = [
    [2769, "只有固定部分和你的消息"],
    [3140, "模型用 bash 跑测试，工具返回一段报错"],
    [3188, "模型用 read 读 calc.py，工具返回 2 行代码"],
    [3272, "模型用 read 读 test_calc.py，工具返回 4 行代码"],
    [3334, "模型用 edit 改一处，工具只回一句「已替换」"],
    [3374, "模型用 bash 重跑测试，工具返回「全部通过」"],
  ];
  function growth() {
    const max = Math.max(...M0REQ.slice(1).map((r, i) => r[0] - M0REQ[i][0]));
    return h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" },
      h("thead", null, h("tr", null, h("th", null, "请求"), h("th", { style: { textAlign: "right" } }, "大小（token）"), h("th", { style: { textAlign: "right" } }, "比上次多"), h("th", null, "上一轮新加进来的"))),
      h("tbody", null, M0REQ.map(([tok, what], i) => {
        const d = i ? tok - M0REQ[i - 1][0] : null;
        return h("tr", null,
          h("td", { style: { whiteSpace: "nowrap", fontWeight: 600 } }, "第 " + (i + 1) + " 次"),
          h("td", { class: "n" }, fmt(tok)),
          h("td", { class: "n" }, d == null ? "—" : "+" + fmt(d)),
          h("td", null, what, d != null ? h("div", { class: "bar", style: { width: (d / max) * 100 + "%" } }) : null));
      }))));
  }

  // ================= §3 long session =================
  const ACTS = [
    ["跑测试", 400], ["读 400 行文件", 1637], ["读 2,000 行文件", 8000], ["改一处代码", 60], ["模型写长回复", 1500], ["粘贴一份长日志", 25000],
  ];
  function simulator() {
    let win = 272000;
    let hist = [], summary = 0, reqs = 0, cum = 0, series = [];
    let seed = 7;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const winSel = h("select", { id: "m1-win" }, [[128000, "128k"], [272000, "272k"], [1000000, "1M"]].map(([v, t]) => h("option", { value: v, selected: v === win || null }, t)));
    const bar = h("div", { class: "win", role: "img", "aria-label": "当前上下文占模型窗口的比例" });
    const sFx = h("div", { class: "seg fx" }), sSm = h("div", { class: "seg sm" }), sHs = h("div", { class: "seg hs" }), sRes = h("div", { class: "reserve" });
    bar.append(sFx, sSm, sHs, sRes);
    const stat = (lbl) => { const v = h("div", { class: "v" }); return [h("div", { class: "ctr" }, v, h("div", { class: "k" }, lbl)), v]; };
    const [e1, v1] = stat("请求次数"), [e2, v2] = stat("当前请求大小"), [e3, v3] = stat("占窗口"), [e4, v4] = stat("累计发送");
    const chart = h("svg:svg", { class: "sim-chart", viewBox: "0 0 600 170", role: "img", "aria-label": "每次请求的大小" });
    const ctxNow = () => TOTAL + summary + hist.reduce((a, b) => a + b.tok, 0);
    function compact() {
      let acc = 0, i = hist.length - 1;
      while (i >= 0 && acc < KEEP) { acc += hist[i].tok; i--; }
      hist = hist.slice(i + 1); summary = SUMMARY;
      series.push({ v: ctxNow(), c: true });
    }
    function act(tok) {
      if (ctxNow() > win - RESERVE) compact();
      reqs++; const c = ctxNow(); cum += c; series.push({ v: c });
      hist.push({ tok });
    }
    function reset() { hist = []; summary = 0; reqs = 0; cum = 0; series = []; paint(); }
    function paint() {
      const c = ctxNow(), hs = c - TOTAL - summary;
      sFx.style.width = (TOTAL / win) * 100 + "%"; sSm.style.width = (summary / win) * 100 + "%"; sHs.style.width = Math.min(100, (hs / win) * 100) + "%";
      sRes.style.width = (RESERVE / win) * 100 + "%";
      v1.textContent = reqs; v2.textContent = k(c); v3.textContent = ((c / win) * 100).toFixed(1) + "%"; v4.textContent = k(cum);
      v3.style.color = c / win > 0.9 ? "var(--bad)" : c / win > 0.7 ? "var(--warn)" : "";
      chart.replaceChildren();
      const n = Math.max(series.length, 20), X = (i) => 30 + (i / (n - 1)) * 560, Y = (v) => 150 - (v / win) * 135;
      chart.append(h("svg:line", { x1: 30, x2: 590, y1: Y(win - RESERVE), y2: Y(win - RESERVE), stroke: "var(--bad)", "stroke-dasharray": "5 4", "stroke-width": 1.2 }),
        h("svg:text", { x: 34, y: Y(win - RESERVE) - 5, fill: "var(--bad)", style: { font: "600 11px var(--f-body)" } }, "超过这条线就自动压缩"),
        h("svg:line", { x1: 30, x2: 590, y1: 150.5, y2: 150.5, stroke: "var(--line-2)" }));
      if (series.length) {
        chart.append(h("svg:polyline", { points: series.map((p, i) => X(i) + "," + Y(p.v)).join(" "), fill: "none", stroke: "var(--c-ctx)", "stroke-width": 2, "vector-effect": "non-scaling-stroke" }));
        series.forEach((p, i) => { if (p.c) chart.append(h("svg:circle", { cx: X(i), cy: Y(p.v), r: 4, fill: "var(--c-tool)" })); });
      } else chart.append(h("svg:text", { x: 300, y: 90, "text-anchor": "middle", fill: "var(--fg-mute)", style: { font: "500 13px var(--f-body)" } }, "点左边的按钮开始"));
    }
    winSel.addEventListener("input", () => { win = +winSel.value; reset(); });
    const btns = ACTS.map(([lbl, tok]) => h("button", { class: "btn", onclick: () => { act(tok); paint(); } }, h("span", null, lbl), h("span", { class: "k" }, "+" + k(tok))));
    const auto = h("button", { class: "btn primary", onclick: () => { for (let i = 0; i < 80; i++) { const r = rnd(); const a = r < 0.25 ? ACTS[0] : r < 0.5 ? ACTS[1] : r < 0.7 ? ACTS[2] : r < 0.85 ? ACTS[3] : r < 0.95 ? ACTS[4] : ACTS[5]; act(a[1]); } paint(); } }, "连续做 80 轮");
    paint();
    return h("div", { class: "panel sim" },
      h("div", { class: "sim-top" },
        h("label", { for: "m1-win" }, "模型窗口", winSel),
        h("button", { class: "btn ghost", onclick: reset, style: { marginLeft: "auto" } }, "重来")),
      h("div", { class: "sim-grid" },
        h("div", { class: "sim-acts" }, h("div", { class: "mute", style: { fontSize: "15px" } }, "点一次 = 一轮：发一次请求，再把这一轮的内容加进历史。"), btns, auto),
        h("div", { class: "sim-main" },
          bar,
          h("div", { class: "win-legend" }, h("span", null, h("i", { style: { background: "var(--c-harness)" } }), "固定部分"), h("span", null, h("i", { style: { background: "var(--c-ctx)" } }), "对话历史"), h("span", null, h("i", { style: { background: "var(--c-tool)" } }), "压缩后的摘要"), h("span", null, h("i", { style: { background: "color-mix(in srgb, var(--bad) 35%, transparent)" } }), "留给模型回复的空间")),
          h("div", { class: "sim-stats" }, e1, e2, e3, e4),
          chart)));
  }

  // ================= quiz =================
  const QUIZ = [
    { q: "一个会话里，请求的哪一部分每一轮都一样？", opts: [{ t: "系统提示和工具定义", ok: true }, { t: "对话历史" }, { t: "最近一次工具结果" }], why: "固定部分每轮一样；历史每轮都在变长。" },
    { q: "今天只改本地代码，用不到联网扩展。怎样让它的工具定义不再占用每次请求？", opts: [{ t: "用 pi -ne 启动（不加载扩展）", ok: true }, { t: "在 AGENTS.md 里写「今天不要联网」" }, { t: "换一个窗口更大的模型" }], why: "只有把工具从请求里拿掉，这部分才会消失。写在 AGENTS.md 里的话反而又多占了几个 token。" },
    { q: "你只需要一个 3,000 行文件里的一个函数。哪种做法更省？", opts: [{ t: "让 pi 先搜索定位，再只读那几十行", ok: true }, { t: "让 pi 把整个文件读进来，它自己会找" }], why: "读进来的内容会留在历史里，之后每一轮都要重发。只读需要的部分，后面每轮都省。" },
    { q: "提供者命中了提示缓存。模型这次看到的内容和没命中时相比：", opts: [{ t: "完全一样，只是更便宜、更快", ok: true }, { t: "变少了，只剩新加的部分" }, { t: "变成了一份摘要" }], why: "缓存只影响计费和速度，不改变内容。" },
    { q: "修完一个 bug，接下来要做一件不相关的事。最好：", opts: [{ t: "/new 开一个新会话", ok: true }, { t: "接着在当前会话里做" }, { t: "先 /compact 再接着做" }], why: "旧话题的历史对新任务没用，却每轮都要付费，还可能干扰模型。新会话从固定部分重新开始。" },
  ];

  // ================= page =================
  window.Course.register(ID, (page) => {
    page.append(h("div", { class: "col" },
      lessonHead(ID, [
        h("p", null, "第 1 课说过：模型不记事，pi 每一轮都把到目前为止的全部内容重新发给它。一次请求里模型能看到的全部内容，叫", term("context", "上下文"), "。"),
        h("p", null, "上下文不是免费的。提供者按 ", term("token"), " 收费，每一轮都按整个请求的大小收一次。每个模型还有一个上限，叫", h("b", null, "上下文窗口"), "（例如 272k，即 27.2 万 token）：请求不能超过它。内容越多，响应也越慢，无关的内容还会让模型分心。"),
        h("p", null, "所以要把上下文当预算来管。这一课讲请求里有哪些部分、哪些会越变越大，以及在 pi 里怎样看用量、怎样省。"),
      ], [
        "一次请求里每次都有的部分是什么，哪些能关掉。",
        "对话中哪些动作让上下文涨得最快。",
        "在 pi 里怎样看当前用量，怎样少花上下文。",
      ]),

      section("s-fixed", 1, "固定部分", "每次都有的部分",
        h("p", null, "第 1 课看过请求的组成：系统提示、工具定义、消息。其中系统提示和工具定义在同一个会话里每轮都一样，你还没开口，它们就已经在请求里了。"),
        h("p", null, "下面是一台电脑上实测的结果：发一句「只回答一个字：好」，请求有多大。测法是关掉某一部分再跑一次，两次相减。"),
        look("最大的一块是什么？点下面的卡片关掉某一块，看总数和启动命令怎么变。")),
      bill(),
      h("p", { style: { marginTop: "18px" } }, "几点结论："),
      h("ul", { class: "rule" },
        h("li", null, h("b", null, "工具定义是大头。"), "每个工具都附带说明和参数格式。这台电脑多装了一个联网扩展，它的 3 个工具比 4 个内置工具加起来还大。用不到时，用 ", h("code", null, "-ne"), " 关掉扩展，或用 ", h("code", null, "--tools"), " 只开需要的工具。"),
        h("li", null, h("b", null, "AGENTS.md 每轮都在。"), "只写每轮都用得上的事，越长越贵。"),
        h("li", null, h("b", null, "文字拿不掉工具。"), "在 AGENTS.md 里写「不要联网」，工具定义照样发送。"),
        h("li", null, h("b", null, "Skill 只占一小段。"), "每个 Skill 在请求里只放名字和一句描述，全文要用时才读（第 9 课）。")),

      section("s-grow", 2, "增长", "越聊越大的部分",
        h("p", null, "每一轮，模型的工具调用和工具返回的结果都会接在历史末尾。之后每次请求都要带上它们，它们不会自己消失。"),
        look("这是第 1 课那次运行里每次请求的大小。看「比上次多」那一列：哪种动作加得最多？")),
      growth(),
      h("p", { style: { marginTop: "16px" } }, h("b", null, "读文件和看输出最贵，改文件最便宜。"), "read 把文件内容整段放进历史，bash 把命令输出整段放进历史，而 edit 只回一句「已替换」。同一台电脑上读一个 400 行的文件，请求就多了 1,637 token。pi 的 read 一次最多读 2,000 行或 50 KB，超过会截断，并提示模型分段继续读。"),

      section("s-long", 3, "长会话", "长会话会怎样",
        h("p", null, "历史一直涨，总会碰到窗口上限。pi 不会等到真的装满：上下文超过「窗口减去留给回复的空间（默认 16,384）」时，它会自动", h("b", null, "压缩"), "：把较早的历史换成一段摘要，只保留最近的一部分原文。压缩的细节在第 5 课。"),
        look("先点「连续做 80 轮」。看两件事：折线涨到红线后怎样掉下来；「累计发送」比「当前请求大小」大多少。再把窗口换成 128k 试一次。")),
      h("div", { class: "bench" }, simulator()),
      h("p", { style: { marginTop: "18px" } }, "折线是锯齿形：一路上涨，压缩后回落，再上涨。累计发送远大于任何一次请求，因为每次都要重发全部历史。长会话的花费主要来自这里。"),
      h("p", { class: "dim" }, "模拟器做了简化：摘要固定按 3k 算，保留最近 20k。真实的 pi 按消息边界切分，摘要大小也随内容变化。"),

      section("s-pi", 4, "在 pi 里", "在 pi 里看用量、省上下文",
        h("p", null, "pi 界面最下面的状态栏随时报告用量。一个例子："),
        h("pre", null, "↑2.9k ↓10 R2.7k CH96.6% $0.032 37.2%/272k (auto)        gpt-6-astra • medium"),
        howto("状态栏各段的意思", [
          ["37.2%/272k", "当前上下文占窗口的比例，也就是下一次请求有多大。超过 70% 变黄，超过 90% 变红。判断「还能聊多久」看这一项。"],
          ["(auto)", "自动压缩开着。"],
          ["↑ ↓", "整个会话累计发送和收到的 token。只增不减，压缩也不会让它变小。"],
          ["R  CH", ["R 是累计命中", term("cache", "提示缓存"), "的 token。CH 是最近一次请求的缓存命中率。命中的部分更便宜、更快，模型看到的内容不变。"]],
          ["$0.032 (sub)", "按模型标价算出的累计费用。(sub) 表示你用的是订阅，不会真的按这个数扣钱。"],
          ["gpt-6-astra • medium", "当前模型和思考强度（第 7 课）。"],
        ]),
        howto("省上下文的办法", [
          ["只读需要的部分", "让 pi 先搜索（grep）定位，再只读那一段。读进来的内容之后每轮都要重发。"],
          ["先过滤再看", "长日志、长输出让 pi 用 tail、grep 只取关键行，不要整个粘贴进对话。"],
          ["pi -ne  /  pi --tools read,bash", "不加载扩展，或只开需要的工具。工具定义从请求里消失，每轮都省。"],
          ["/new", "换话题就开新会话。旧历史对新任务没用，却每轮都要付费。"],
          ["/compact 保留……", "手动压缩，并说明摘要里要保留什么，例如「/compact 保留已确认的结论和改过的文件名」。"],
          ["/session", "查看这个会话的消息数、token 用量和费用。"],
        ])),

      section("s-quiz", 5, "检查", "检查一下",
        quizBlock(ID, QUIZ, null, null)),

      section("s-end", 6, "小结", "小结",
        endBlock(ID, [
          "上下文是一次请求里模型能看到的全部内容。每一轮都按整个请求的大小计费，而且不能超过模型的窗口。",
          "系统提示和工具定义每轮都在；工具定义通常是大头，用 -ne 或 --tools 去掉用不到的。",
          "读文件和命令输出让上下文涨得最快；它们留在历史里，之后每轮都要重发。",
          "状态栏的百分比是当前用量，↑↓ 和 $ 是累计值。换话题就 /new，必要时 /compact。",
        ], { id: "M2", text: "开始真正用 pi：怎样引用文件、运行命令，怎样在它干活时插话、排队、叫停。" }))));
  });
})();
