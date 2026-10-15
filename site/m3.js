/* M3 · 会话是一棵树 */
(function () {
  "use strict";
  const { h, section, quizBlock, lessonHead, look, howto, endBlock } = window.Course;
  const ID = "M3";

  // A real session (pi 0.99.2): two prompts, then /tree back to the 2nd prompt, "Summarize", edited and resent.
  const REAL = [
    ["3adab6ae", null, "meta", "模型 gpt-6-astra"],
    ["5ae1afd1", "3adab6ae", "meta", "思考强度 medium"],
    ["50cb5afd", "5ae1afd1", "sys", "系统提示与工具"],
    ["3e37bca2", "50cb5afd", "user", "给我的猫起一个名字，只回答名字。"],
    ["33b24c0c", "3e37bca2", "asst", "糯米"],
    ["17611449", "33b24c0c", "user", "再给它想一句口号，只回答口号。"],
    ["d9d6c4bf", "17611449", "asst", "糯米出场，萌翻全场！"],
    ["461f4978", "33b24c0c", "sum", "在另一条路线上，用户得到了口号「糯米出场，萌翻全场！」"],
    ["d4f7f290", "461f4978", "user", "再给它想一句英文口号，只回答口号。"],
    ["aa1c135f", "d4f7f290", "asst", "Nuomi is here, let the cuteness appear!"],
  ];
  const COLOR = { user: "var(--c-user)", asst: "var(--c-model)", sum: "var(--c-tool)", sys: "var(--c-harness)", meta: "var(--fg-mute)" };
  const SHORT = { user: "你", asst: "模型", sum: "分支摘要", sys: "系统", meta: "设置" };

  function layout(nodes) {
    const kids = {}; nodes.forEach((n) => { (kids[n.parent ?? "_"] ||= []).push(n.id); });
    const pos = {}; let row = 0;
    const walk = (id, d) => { const ch = kids[id] || []; pos[id] = { d, r: row }; ch.forEach((c, i) => { if (i > 0) row++; walk(c, d + 1); }); };
    (kids._ || []).forEach((r, i) => { if (i > 0) row++; walk(r, 0); });
    return { pos, rows: row + 1 };
  }
  const pathTo = (byId, leaf) => { const p = []; let c = leaf; while (c) { p.unshift(c); c = byId[c]?.parent; } return p; };

  function treeSvg(nodes, active) {
    const { pos, rows } = layout(nodes);
    const NW = 170, NH = 40, W = NW + 18, H = 54;
    const maxD = Math.max(...Object.values(pos).map((p) => p.d));
    const vw = rows * W + 12, vh = (maxD + 1) * H + 12;
    const svg = h("svg:svg", { class: "tsvg", viewBox: `0 0 ${vw} ${vh}`, style: { width: vw + "px", minWidth: vw + "px", maxWidth: "none" }, role: "img", "aria-label": "会话树：实线是活动分支" });
    const act = new Set(active);
    const X = (id) => 6 + pos[id].r * W, Y = (id) => 6 + pos[id].d * H;
    nodes.forEach((n) => { if (n.parent && pos[n.parent]) {
      const x1 = X(n.parent) + NW / 2, y1 = Y(n.parent) + NH, x2 = X(n.id) + NW / 2, y2 = Y(n.id);
      svg.append(h("svg:path", { d: `M${x1} ${y1} C${x1} ${y1 + 10}, ${x2} ${y2 - 10}, ${x2} ${y2}`, class: "tedge" + (act.has(n.id) && act.has(n.parent) ? " act" : "") }));
    } });
    nodes.forEach((n) => {
      const on = act.has(n.id), label = n.text.length > 11 ? n.text.slice(0, 11) + "…" : n.text;
      svg.append(h("svg:g", { class: "tnode" },
        h("svg:title", null, SHORT[n.kind] + "：" + n.text),
        h("svg:rect", { x: X(n.id), y: Y(n.id), width: NW, height: NH, rx: 6, fill: on ? "var(--panel)" : "var(--sunk)", stroke: COLOR[n.kind], "stroke-width": on ? 1.8 : 1, "stroke-dasharray": on ? null : "3 3", opacity: on ? 1 : 0.75 }),
        h("svg:text", { x: X(n.id) + 8, y: Y(n.id) + 15, fill: COLOR[n.kind], style: { font: "700 11px var(--f-body)" } }, SHORT[n.kind] + " · " + n.id.slice(0, 4)),
        h("svg:text", { x: X(n.id) + 8, y: Y(n.id) + 31, fill: "var(--fg)", style: { font: "500 12px var(--f-body)" } }, label)));
    });
    return svg;
  }

  function realTree() {
    const nodes = REAL.map(([id, parent, kind, text]) => ({ id, parent, kind, text }));
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    const leaves = [["aa1c135f", "当前位置：英文口号那条"], ["d9d6c4bf", "当前位置：中文口号那条"]];
    let leaf = leaves[0][0];
    const left = h("div", { class: "l" }), lines = h("div", { class: "jsonl" }), ctx = h("div", { class: "ctxlist" });
    const bLeaf = leaves.map(([l, t], i) => h("button", { class: "btn" + (i === 0 ? " primary" : ""), onclick: () => { leaf = l; bLeaf.forEach((b, j) => (b.className = "btn" + (j === i ? " primary" : ""))); paint(); } }, t));
    function paint() {
      const path = pathTo(byId, leaf);
      left.replaceChildren(treeSvg(nodes, path));
      lines.replaceChildren(...nodes.map((n, i) => h("div", { class: "ln" + (path.includes(n.id) ? " act" : "") },
        h("span", { class: "no" }, i + 1), h("span", { class: "id" }, n.id.slice(0, 4)), h("span", { class: "pid" }, n.parent ? n.parent.slice(0, 4) : "—"), h("span", { class: "tx" }, SHORT[n.kind] + " · " + n.text))));
      ctx.replaceChildren(...path.map((id) => byId[id]).filter((n) => n.kind !== "meta").map((n) => h("div", { class: n.kind }, SHORT[n.kind] + "：" + n.text)));
    }
    paint();
    return h("div", { class: "panel" },
      h("div", { class: "panel-h" }, h("span", null, "一个真实的会话文件"), h("span", { style: { display: "flex", gap: "8px", flexWrap: "wrap" } }, bLeaf)),
      h("div", { class: "treebox" }, left,
        h("div", { class: "r" },
          h("div", { class: "mute", style: { fontSize: "15px", marginBottom: "6px" } }, "文件里的记录，按写入顺序（序号 · 编号 · 上一条的编号 · 内容）。高亮的是当前分支。"), lines,
          h("div", { class: "mute", style: { fontSize: "15px", margin: "12px 0 6px" } }, "下一次请求会发给模型的消息："), ctx)));
  }

  function mini(kind) {
    const svg = h("svg:svg", { viewBox: "0 0 220 90", role: "img", "aria-label": kind === "tree" ? "同一个文件里分出两条路" : kind === "fork" ? "复制到某一点，存成新文件" : "整条复制，存成新文件" });
    const box = (x, y, w, hh, lbl) => [h("svg:rect", { x, y, width: w, height: hh, rx: 6, fill: "none", stroke: "var(--line-2)", "stroke-dasharray": "4 3" }), h("svg:text", { x: x + 6, y: y + 12, fill: "var(--fg-mute)", style: { font: "500 10px var(--f-body)" } }, lbl)];
    const dot = (x, y, c) => h("svg:circle", { cx: x, cy: y, r: 5, fill: c });
    const ln = (x1, y1, x2, y2, c) => h("svg:line", { x1, y1, x2, y2, stroke: c || "var(--line-2)", "stroke-width": 2 });
    if (kind === "tree") svg.append(...box(4, 4, 212, 82, "同一个文件"), ln(24, 40, 60, 40), ln(60, 40, 96, 40), ln(96, 40, 132, 28), ln(96, 40, 132, 60, "var(--c-harness)"), ln(132, 60, 168, 60, "var(--c-harness)"), dot(24, 40, "var(--fg-mute)"), dot(60, 40, "var(--fg-mute)"), dot(96, 40, "var(--fg-mute)"), dot(132, 28, "var(--fg-mute)"), dot(132, 60, "var(--c-harness)"), dot(168, 60, "var(--c-harness)"));
    else svg.append(...box(4, 4, 104, 82, "原会话"), ...box(114, 4, 102, 82, "新会话"), ln(20, 44, 50, 44), ln(50, 44, 80, 44), dot(20, 44, "var(--fg-mute)"), dot(50, 44, "var(--fg-mute)"), dot(80, 44, "var(--fg-mute)"),
      ln(130, 44, 160, 44, "var(--c-harness)"), dot(130, 44, "var(--c-harness)"), dot(160, 44, "var(--c-harness)"), kind === "clone" ? [ln(160, 44, 190, 44, "var(--c-harness)"), dot(190, 44, "var(--c-harness)")] : null);
    return svg;
  }

  const QUIZ = [
    { q: "你回到三步之前，改写一条消息重新发送。原来那三步：", opts: [{ t: "还在同一个会话文件里，成了另一条分支", ok: true }, { t: "被删除了" }, { t: "被移到了另一个文件" }], why: "会话文件只追加不删改。新的消息挂在同一个父节点下，长出第二条分支。" },
    { q: "下一次请求里，模型能看到哪些消息？", opts: [{ t: "从当前位置一路往回走到开头的那一条路", ok: true }, { t: "会话文件里的全部消息" }, { t: "最近写入的 20 条" }], why: "这条路叫当前分支（活动分支）。其他分支还在文件里，但不发给模型。" },
    { q: "在 /tree 里选中一条你发过的消息并回车，pi 会：", opts: [{ t: "回到这条消息之前，把它的文字放回编辑器", ok: true }, { t: "删掉它之后的所有消息" }, { t: "立刻把它重新发送一遍" }], why: "你可以改写后再发送，从同一个位置长出新分支。" },
    { q: "离开一条走不通的分支时，选「Summarize」有什么用？", opts: [{ t: "把那条路的要点写成一段摘要带到新分支上，模型就知道试过什么", ok: true }, { t: "删除那条分支，省磁盘空间" }, { t: "把那条分支的全部消息复制过来" }], why: "摘要要调用一次模型，但比重发整段历史省得多。不需要时选 No summary，模型就完全看不到那条路。" },
    { q: "/tree、/fork、/clone 中，哪个不会新建会话文件？", opts: [{ t: "/tree", ok: true }, { t: "/fork" }, { t: "/clone" }], why: "/tree 在同一个文件里分支；/fork 和 /clone 都另存成一个新会话。" },
  ];

  window.Course.register(ID, (page) => {
    page.append(h("div", { class: "col" },
      lessonHead(ID, [
        h("p", null, "和 pi 聊到一半，发现方向错了，想回到三步之前换个说法。原来那三步会被抹掉吗？"),
        h("p", null, "不会。pi 不把对话存成一条直线，而是存成一棵树：从任何一步都可以分出新的路，旧的路原样保留。这一课讲这棵树怎么长出来、模型每次只看哪一部分，以及 /tree、/fork、/clone 三个命令怎么用。"),
      ], [
        "会话为什么是一棵树，模型看到的是其中哪一条路。",
        "怎样用 /tree 回到过去重来，什么时候要带上分支摘要。",
        "/tree、/fork、/clone 的区别和各自的用途。",
      ]),

      section("s-tree", 1, "树", "会话是一棵树",
        h("p", null, "pi 把每个会话存成一个文件，每条消息占一条记录。每条记录有自己的编号，还记着", h("b", null, "它的上一条是谁"), "。平时一问一答，每条都接在前一条后面，看起来就是一条直线。"),
        h("p", null, "当你回到某一步重新发送时，新消息的「上一条」指向那个旧位置。于是同一个位置下面挂了两条记录，树就分叉了。新记录写在文件末尾，旧记录一条不动。"),
        h("p", null, "你现在所在的位置叫", h("b", null, "当前位置"), "。从它一路往回走到开头，经过的那条路叫", h("b", null, "当前分支"), "。", h("b", null, "pi 只把当前分支发给模型"), "，别的分支模型看不到。"),
        look("这是一个真实会话：先问猫的名字，再问中文口号；然后回到第二个问题，改问英文口号。点上方两个按钮切换当前位置，看右下方「发给模型的消息」怎么变。")),
      h("div", { class: "bench" }, realTree()),
      h("p", { style: { marginTop: "18px" } }, "两条路线都在同一个文件里。当前位置在英文那条时，模型看不到中文口号那两条消息，只看到一段「分支摘要」（§2 讲它从哪里来）。还要注意：文件里的先后顺序不代表树的结构，第 8 条记录接在第 5 条后面。"),

      section("s-nav", 2, "/tree", "用 /tree 回到过去",
        h("p", null, "在 pi 里输入 /tree（或在编辑器为空时连按两次 Esc），会打开整棵树。用 ↑↓ 选一条记录，按回车："),
        h("ul", { class: "rule" },
          h("li", null, h("b", null, "选你发过的一条消息："), "回到这条消息之前，它的文字放回编辑器。改写后发送，就从这里长出新分支。"),
          h("li", null, h("b", null, "选模型的一条回复："), "移到这条回复之后，编辑器是空的。接着写新消息，就从这里继续。")),
        h("p", null, "离开当前分支时，pi 会问要不要做", h("b", null, "分支摘要"), "（Summarize branch?）："),
        h("ul", { class: "rule" },
          h("li", null, h("b", null, "No summary："), "模型完全不知道那条路。适合那条路和接下来的事无关。"),
          h("li", null, h("b", null, "Summarize："), "pi 调用一次模型，把那条路的目标、进展、结论写成一段摘要，挂在新分支的开头。适合「那条路走不通，要记住为什么」。"),
          h("li", null, h("b", null, "Summarize with custom prompt："), "同上，但你可以说明摘要要保留什么。")),
        h("p", null, "摘要比把整段历史带过来省得多，又能让模型知道已经试过什么。"),
        h("div", { class: "note warn" }, h("span", { class: "k" }, "只移动、不发消息，位置不会被记住"), "在 /tree 里切到另一条分支后直接退出，下次 pi -c 回到的是文件里最后写入的那条记录，而不是你切到的位置。想停在某条分支上，就在那里发一条消息，或用 Shift+L 给它加个标签方便以后找。")),

      section("s-ways", 3, "三种分法", "/tree、/fork、/clone 怎么选",
        h("p", null, "三个命令都能「从某一点另起一条路」，区别在于新路放在哪里：")),
      h("div", { class: "cmp3" },
        h("div", { class: "panel" }, h("h4", null, "/tree"), h("div", { class: "res" }, "在同一个会话里分支"), mini("tree"), h("ul", null, h("li", null, "随时来回切换"), h("li", null, "可以带分支摘要"), h("li", null, "适合同一个任务的几种方案"))),
        h("div", { class: "panel" }, h("h4", null, "/fork"), h("div", { class: "res" }, "选一条你发过的消息，把它之前的部分复制成新会话"), mini("fork"), h("ul", null, h("li", null, "被选的消息放回编辑器"), h("li", null, "适合分出一个独立的新任务，又要用到前面的背景"))),
        h("div", { class: "panel" }, h("h4", null, "/clone"), h("div", { class: "res" }, "把当前分支整条复制成新会话"), mini("clone"), h("ul", null, h("li", null, "原会话不受影响"), h("li", null, "适合先留一份备份，再在副本上大胆试")))),
      h("p", { style: { marginTop: "14px" } }, "新会话会记下自己是从哪个会话分出来的。在终端里用 pi --fork <会话文件或编号> 也能直接从已有会话分出新会话。"),

      section("s-keys", 4, "速查", "会话操作速查",
        howto("命令", [
          ["/tree", "打开会话树，回到任意一步。编辑器为空时连按两次 Esc 也能打开。"],
          ["/fork", "从之前的一条消息分出新会话。"],
          ["/clone", "把当前分支复制成新会话。"],
          ["/resume  或  pi -r", "打开会话列表，切换到别的会话。"],
          ["/name", "给会话起名，方便在列表里找到。"],
        ]),
        howto("在 /tree 里", [
          ["↑ ↓  回车", "选择记录 / 跳到这里。"],
          ["直接输入文字", "搜索。"],
          ["Shift+L", "给选中的记录加标签。"],
          ["Ctrl+U", "只显示你发的消息（树很大时好找）。"],
          ["Ctrl+L", "只显示有标签的记录。"],
          ["Esc", "关闭，不移动。"],
        ])),

      section("s-quiz", 5, "检查", "检查一下", quizBlock(ID, QUIZ, null, null)),

      section("s-end", 6, "小结", "小结",
        endBlock(ID, [
          "会话是一棵树：每条记录记着上一条是谁；回到过去重新发送，就长出新分支，旧分支保留。",
          "模型只看到当前分支，也就是从当前位置往回走到开头的那条路。",
          "/tree 在同一个会话里分支，离开时可以带一段分支摘要；/fork 和 /clone 另存成新会话。",
        ], { id: "M4", text: "对话长到装不下时，pi 会把前面的部分换成一段摘要。它怎么切、留下什么？" }))));
  });
})();
