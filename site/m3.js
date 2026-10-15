/* M3 · 会话是一棵树 */
(function () {
  "use strict";
  const { h, $, $$, Store, choice, copyBlock, section, todo, route, term } = window.Course;
  const ID = "M3";

  // Real session recorded on this machine (pi 0.99.2): two prompts, then /tree back to the 2nd prompt,
  // "Summarize", edited and resent. Header line omitted; it has no id/parentId.
  const REAL = [
    ["3adab6ae", null, "model_change", "", "openai-codex/gpt-6-astra"],
    ["5ae1afd1", "3adab6ae", "thinking_level_change", "", "medium"],
    ["50cb5afd", "5ae1afd1", "message", "system", "系统提示与工具"],
    ["3e37bca2", "50cb5afd", "message", "user", "给我的猫起一个名字，只回答名字。"],
    ["33b24c0c", "3e37bca2", "message", "assistant", "糯米"],
    ["17611449", "33b24c0c", "message", "user", "再给它想一句口号，只回答口号。"],
    ["d9d6c4bf", "17611449", "message", "assistant", "糯米出场，萌翻全场！"],
    ["461f4978", "33b24c0c", "branch_summary", "", "离开的分支：用户得到口号「糯米出场，萌翻全场！」……"],
    ["d4f7f290", "461f4978", "message", "user", "再给它想一句英文口号，只回答口号。"],
    ["aa1c135f", "d4f7f290", "message", "assistant", "Nuomi is here, let the cuteness appear!"],
  ];
  const KIND = (type, role) => (type === "branch_summary" ? "sum" : type !== "message" ? "meta" : role === "user" ? "user" : role === "assistant" ? "asst" : "sys");
  const COLOR = { user: "var(--c-user)", asst: "var(--c-model)", sum: "var(--c-tool)", sys: "var(--c-harness)", meta: "var(--fg-mute)" };
  const SHORT = { user: "你", asst: "模型", sum: "分支摘要", sys: "系统", meta: "设置" };

  /** Lay out a tree left-to-right: x = depth, y = row (DFS order, children in append order). */
  function layout(nodes) {
    const kids = {}; nodes.forEach((n) => { (kids[n.parent ?? "_"] ||= []).push(n.id); });
    const pos = {}; let row = 0;
    const walk = (id, d) => { const ch = kids[id] || []; pos[id] = { d, r: row }; ch.forEach((c, i) => { if (i > 0) row++; walk(c, d + 1); }); };
    (kids._ || []).forEach((r, i) => { if (i > 0) row++; walk(r, 0); });
    return { pos, rows: row + 1, kids };
  }
  const pathTo = (byId, leaf) => { const p = []; let c = leaf; while (c) { p.unshift(c); c = byId[c]?.parent; } return p; };

  function treeSvg(nodes, { active = [], sel, onPick, compact } = {}) {
    // Top-down: y = depth, x = branch column. Drawn at natural size so labels stay legible.
    const { pos, rows } = layout(nodes);
    const NW = compact ? 150 : 170, NH = 40, W = NW + 18, H = 54;
    const maxD = Math.max(...Object.values(pos).map((p) => p.d));
    const vw = rows * W + 12, vh = (maxD + 1) * H + 12;
    const svg = h("svg:svg", { class: "tsvg", viewBox: `0 0 ${vw} ${vh}`, style: { width: vw + "px", minWidth: 0, maxWidth: "100%" }, role: "img", "aria-label": "会话树" });
    const act = new Set(active);
    const X = (id) => 6 + pos[id].r * W, Y = (id) => 6 + pos[id].d * H;
    nodes.forEach((n) => { if (n.parent && pos[n.parent]) {
      const x1 = X(n.parent) + NW / 2, y1 = Y(n.parent) + NH, x2 = X(n.id) + NW / 2, y2 = Y(n.id);
      svg.append(h("svg:path", { d: `M${x1} ${y1} C${x1} ${y1 + 10}, ${x2} ${y2 - 10}, ${x2} ${y2}`, class: "tedge" + (act.has(n.id) && act.has(n.parent) ? " act" : "") }));
    } });
    nodes.forEach((n) => {
      const k = n.kind, on = act.has(n.id);
      const max = compact ? 10 : 11;
      const label = n.text.length > max ? n.text.slice(0, max) + "…" : n.text;
      svg.append(h("svg:g", { class: "tnode" + (sel === n.id ? " sel" : ""), "data-id": n.id, tabindex: "0", role: "button", "aria-label": SHORT[k] + "：" + n.text,
        onclick: () => onPick && onPick(n.id), onkeydown: (e) => { if (e.key === "Enter" && onPick) onPick(n.id); } },
        h("svg:rect", { x: X(n.id), y: Y(n.id), width: NW, height: NH, rx: 6, fill: on ? "var(--panel)" : "var(--sunk)", stroke: COLOR[k], "stroke-width": on ? 1.8 : 1, "stroke-dasharray": on ? null : "3 3", opacity: on ? 1 : 0.75 }),
        h("svg:text", { x: X(n.id) + 8, y: Y(n.id) + 15, fill: COLOR[k], style: { font: "700 11px var(--f-body)" } }, SHORT[k] + (n.short ? " · " + n.short : "")),
        h("svg:text", { x: X(n.id) + 8, y: Y(n.id) + 31, fill: "var(--fg)", style: { font: "500 12px var(--f-body)" } }, label)));
    });
    return svg;
  }

  // ================= §0 hero: real tree + real file =================
  function hero() {
    const nodes = REAL.map(([id, parent, type, role, text]) => ({ id, parent, kind: KIND(type, role), text, short: id.slice(0, 4) }));
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    const leaves = ["aa1c135f", "d9d6c4bf"];
    let leaf = leaves[0], sel = null;
    const left = h("div", { class: "l" }), lines = h("div", { class: "jsonl" }), ctx = h("div", { class: "ctxlist" });
    const bLeaf = leaves.map((l, i) => h("button", { class: "btn" + (i === 0 ? " primary" : ""), onclick: () => { leaf = l; bLeaf.forEach((b, j) => b.className = "btn" + (j === i ? " primary" : "")); paint(); } }, i === 0 ? "叶子在英文分支" : "叶子在中文分支"));
    function paint() {
      const path = pathTo(byId, leaf);
      left.replaceChildren(treeSvg(nodes, { active: path, sel, onPick: (id) => { sel = id; paint(); } }));
      lines.replaceChildren(...REAL.map(([id, parent, type, role, text], i) => h("div", { class: "ln" + (path.includes(id) ? " act" : "") + (sel === id ? " on" : ""), onclick: () => { sel = id; paint(); } },
        h("span", { class: "no" }, i + 2), h("span", { class: "id" }, id), h("span", { class: "pid" }, parent || "null"), h("span", { class: "tx" }, (role || type) + " · " + text))));
      ctx.replaceChildren(...path.map((id) => byId[id]).filter((n) => n.kind !== "meta").map((n) => h("div", { class: n.kind }, SHORT[n.kind] + "：" + n.text)));
    }
    paint();
    return h("div", { class: "panel" },
      h("div", { class: "panel-h" }, h("span", null, "同一个会话文件 · 两条路线 · 本机真实记录"), h("span", { style: { display: "flex", gap: "8px" } }, bLeaf)),
      h("div", { class: "treebox" }, left,
        h("div", { class: "r" }, h("div", { class: "mute", style: { fontSize: "15px", marginBottom: "6px" } }, "文件里的行（行号 · id · parentId · 内容）。蓝色 id = 活动分支。"), lines,
          h("div", { class: "mute", style: { fontSize: "15px", margin: "12px 0 6px" } }, "下一次请求会发送给模型的消息："), ctx)));
  }

  // ================= §2 file anatomy =================
  const ANAT = [
    ['{"type":"session","version":3,"id":"01a1364e-…","timestamp":"2026-10-13T17:27:51Z","cwd":"~/pi-lab/m3"}', "表头", "第 1 行总是表头：格式版本、会话 ID、创建时间、工作目录。它不是树的一部分，没有 id/parentId。从 /fork 或 /clone 来的会话，表头还有 parentSession，指向原文件。"],
    ['{"type":"model_change","id":"3adab6ae","parentId":null,"provider":"openai-codex","modelId":"gpt-6-astra"}', "模型变更", "记录用哪个模型。parentId 为 null：它是树根。中途 /model 换模型，会再追加一条。"],
    ['{"type":"thinking_level_change","id":"5ae1afd1","parentId":"3adab6ae","thinkingLevel":"medium"}', "思考强度变更", "Shift+Tab 或 /thinking 改强度时追加。它也在树上，所以不同分支可以有不同的强度。"],
    ['{"type":"message","id":"50cb5afd","parentId":"5ae1afd1","message":{"role":"system","sections":{…}}}', "系统消息", "pi 组装的系统提示和工具清单（M1 量过它的大小）。工具或提示变化时会再追加一条。"],
    ['{"type":"message","id":"3e37bca2","parentId":"50cb5afd","message":{"role":"user","content":[…]}}', "你的消息", "每条消息一行。parentId 指向它的上一条。"],
    ['{"type":"message","id":"33b24c0c","parentId":"3e37bca2","message":{"role":"assistant","stopReason":"stop","usage":{…}}}', "模型回复", "带着用量和停止原因（M0）。工具调用、工具结果也各占一行。"],
    ['{"type":"branch_summary","id":"461f4978","parentId":"33b24c0c","fromId":"d9d6c4bf","summary":"…"}', "分支摘要", "你在 /tree 里离开一条路线并选择「Summarize」时追加。它挂在你回到的那一点下面，fromId 指向你离开的位置。"],
  ];
  function anatomy() {
    const exp = h("div", { class: "panel fexp" }, h("span", { class: "mute" }, "点一行，看它是什么。"));
    const rows = ANAT.map(([code, nm, why], i) => h("button", { class: "cmd-row", style: { gridTemplateColumns: "96px minmax(0,1fr)" }, onclick: () => { rows.forEach((r, j) => r.classList.toggle("sel", i === j)); exp.replaceChildren(h("b", null, nm), h("p", { class: "dim", style: { margin: "4px 0 0" } }, why)); } },
      h("span", { class: "g", style: { fontWeight: 600, color: "var(--fg)" } }, nm), h("code", { style: { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: 400, color: "var(--fg-dim)" } }, code)));
    return h("div", null, h("div", { class: "panel", style: { overflow: "hidden" } }, rows), exp);
  }

  // ================= §3 trace the path =================
  function tracer() {
    const nodes = REAL.map(([id, parent, type, role, text]) => ({ id, parent, type, role, text }));
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    const answer = pathTo(byId, "aa1c135f").reverse(); // leaf → root
    let picked = [...(Store.get(ID, "trace", {}).picked || [])];
    const tbl = h("div", { class: "jsonl" }), status = h("div", { class: "feedback", style: { padding: "10px 0 0" } });
    function paint() {
      tbl.replaceChildren(...nodes.map((n, i) => h("div", { class: "ln" + (picked.includes(n.id) ? " act on" : ""), onclick: () => pick(n.id) },
        h("span", { class: "no" }, picked.includes(n.id) ? picked.indexOf(n.id) + 1 : ""), h("span", { class: "id" }, n.id), h("span", { class: "pid" }, n.parent || "null"), h("span", { class: "tx" }, (n.role || n.type) + " · " + n.text))));
      const done = picked.length === answer.length && picked.every((x, i) => x === answer[i]);
      status.replaceChildren(done ? h("span", null, h("span", { class: "verdict ok" }, "走通了。"), "你沿着 parentId 从叶子走到了根，一共 " + answer.length + " 条。中文分支的两条（17611449、d9d6c4bf）不在路上，模型看不到它们；它看到的是那条分支摘要。")
        : h("span", { class: "mute" }, `已选 ${picked.length} 条。下一条应是「${picked.length ? picked[picked.length - 1] : "叶子"}」的 parentId 所指的那一行。`));
      if (done) Store.set(ID, "trace", { picked, ok: true });
    }
    function pick(id) {
      const want = answer[picked.length];
      if (id === want) { picked.push(id); paint(); }
      else { status.replaceChildren(h("span", { class: "verdict no" }, "不是这一行。"), picked.length ? `找 id 等于 ${byId[picked[picked.length - 1]].parent} 的那一行。` : "先从叶子开始：最后写入的 aa1c135f。"); }
    }
    paint();
    return h("div", { class: "panel", style: { padding: "14px" } },
      h("div", { style: { display: "flex", justifyContent: "space-between", gap: "8px", marginBottom: "8px", flexWrap: "wrap" } }, h("b", null, "从叶子 aa1c135f 出发，依次点出到根的每一条"), h("div", { style: { display: "flex", gap: "8px" } }, h("button", { class: "btn ghost", onclick: () => { picked = [...answer]; paint(); } }, "显示答案"), h("button", { class: "btn ghost", onclick: () => { picked = []; Store.set(ID, "trace", {}); paint(); } }, "重来"))),
      tbl, status);
  }

  // ================= §4 /tree playground =================
  const REPLIES = ["好的，换个角度：", "这是另一个版本：", "按你的新要求：", "试试这个："];
  function playground() {
    let nodes, leaf, sel, editor, appended, seq, lastNote, summarize;
    const left = h("div", { class: "l" }), ctx = h("div", { class: "ctxlist" });
    const inp = h("input", { type: "text", id: "m3-pg-editor", placeholder: "编辑器（选中一条「你」的消息后，它的文字会出现在这里）" });
    const sumChk = h("input", { type: "checkbox", id: "m3-pg-sum" });
    const status = h("div", { class: "pg-status" });
    const tasks = () => Store.get(ID, "pg", {});
    const mark = (k) => { if (!tasks()[k]) Store.set(ID, "pg", { ...tasks(), [k]: 1 }); };
    const tasksEl = h("div", { class: "qsim-tasks", style: { padding: "0 16px 14px" } });
    const TASKS = [["t1", "开出第三条分支：回到「再给它想一句…」那一步，改写后发送"], ["t2", "离开一条分支时带上摘要"], ["t3", "不勾摘要，切到另一条分支，不发消息，直接「退出并 pi -c」，看你落在哪里"]];
    function reset() {
      nodes = REAL.filter((r) => r[2] === "message" || r[2] === "branch_summary").map(([id, parent, type, role, text]) => ({ id, parent, kind: KIND(type, role), text }));
      nodes[0].parent = null;
      leaf = "aa1c135f"; sel = null; editor = ""; inp.value = ""; seq = 1; appended = nodes.map((n) => n.id); lastNote = "你在叶子 aa1c135f。点树上的任一条，再点「在这里继续」。";
      paint();
    }
    const byId = () => Object.fromEntries(nodes.map((n) => [n.id, n]));
    const newId = () => "n" + (seq++).toString().padStart(3, "0") + "x" + Math.floor(Math.random() * 90 + 10);
    function goHere() {
      if (!sel) { lastNote = "先在树上点选一条。"; return paint(); }
      const B = byId(), n = B[sel];
      const oldPath = pathTo(B, leaf);
      let target = sel;
      if (n.kind === "user") { target = n.parent; editor = n.text; inp.value = n.text; }
      else { editor = ""; inp.value = ""; }
      const leaving = !pathTo(B, target).includes(leaf) && leaf !== target;
      if (leaving && sumChk.checked) {
        const s = { id: newId(), parent: target, kind: "sum", text: "离开的分支：" + (B[oldPath[oldPath.length - 1]]?.text || "").slice(0, 12) + "……" };
        nodes.push(s); appended.push(s.id); target = s.id; mark("t2");
      }
      leaf = target; sel = null;
      lastNote = n.kind === "user" ? "已回到这条消息之前。它的文字放回了编辑器：改写后发送，就开出一条新分支。" : "已移到这一点。编辑器为空：写新消息发送，就从这里接着走。";
      if (leaving) lastNote += sumChk.checked ? " 你离开的路线被总结成一条分支摘要，挂在这里。" : " 你没有要摘要：模型将完全看不到离开的那条路线。";
      paint();
    }
    function send() {
      const text = inp.value.trim(); if (!text) { lastNote = "编辑器是空的。"; return paint(); }
      const B = byId();
      const siblings = nodes.filter((x) => x.parent === leaf && x.kind === "user").length;
      const u = { id: newId(), parent: leaf, kind: "user", text }, a = { id: newId(), parent: u.id, kind: "asst", text: REPLIES[seq % REPLIES.length] + "（模型回复）" };
      nodes.push(u, a); appended.push(u.id, a.id); leaf = a.id; inp.value = ""; editor = "";
      const grand = B[u.parent];
      const branchPoint = nodes.filter((x) => x.parent === u.parent).length >= 2 || (grand && grand.kind === "sum" && nodes.filter((x) => x.parent === grand.parent).length >= 2);
      const userBranches = nodes.filter((x) => x.kind === "user" && /再给它想一句/.test(x.text)).length;
      if (userBranches >= 3) mark("t1");
      lastNote = siblings ? "新分支已追加到文件末尾。旧分支一条都没丢。" : "新消息追加到了文件末尾。";
      paint();
    }
    function quitResume() {
      const last = appended[appended.length - 1];
      if (leaf !== last) { mark("t3"); lastNote = `退出时你停在 ${leaf}，但「切换位置」不写入文件。pi -c 重新打开时，回到了文件里最后写入的 ${last}。这是本机实测的行为。`; }
      else lastNote = byId()[leaf]?.kind === "sum" ? "你刚才选了摘要：摘要是一条新记录，写在文件末尾，所以 pi -c 正好回到这里。不勾摘要再切一次试试。" : "你停在最后写入的条目上，pi -c 正好回到这里。先切到另一条分支再试一次。";
      leaf = last; sel = null; paint();
    }
    function paint() {
      const B = byId(), path = pathTo(B, leaf);
      left.replaceChildren(treeSvg(nodes.map((n) => ({ ...n, short: n.id === leaf ? "叶子" : "" })), { active: path, sel, compact: true, onPick: (id) => { sel = id; lastNote = "已选中：" + SHORT[B[id].kind] + "「" + B[id].text.slice(0, 16) + "」。点「在这里继续」。"; paint(); } }));
      ctx.replaceChildren(...path.map((id) => B[id]).map((n) => h("div", { class: n.kind }, SHORT[n.kind] + "：" + n.text)));
      status.textContent = lastNote;
      const t = tasks(); tasksEl.replaceChildren(...TASKS.map(([k, txt]) => h("div", null, h("span", { class: t[k] ? "ok" : "no" }, t[k] ? "✓ " : "○ "), txt)));
    }
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
    reset();
    return h("div", { class: "panel" },
      h("div", { class: "panel-h" }, h("span", null, "/tree 操场 · 从本机那棵树开始"), h("button", { class: "btn ghost", onclick: reset }, "重来")),
      h("div", { class: "treebox" }, left, h("div", { class: "r" }, h("div", { class: "mute", style: { fontSize: "15px", marginBottom: "6px" } }, "活动分支 = 下一次请求发送的内容"), ctx)),
      status,
      h("div", { class: "pg-ctrls" },
        h("button", { class: "btn", onclick: goHere }, "在这里继续"),
        h("label", { class: "toggle", for: "m3-pg-sum" }, sumChk, "离开时做分支摘要"),
        h("button", { class: "btn", onclick: quitResume }, "退出并 pi -c")),
      h("div", { class: "pg-ctrls", style: { borderTop: 0, paddingTop: 0 } }, inp, h("button", { class: "btn primary", onclick: send }, "发送")),
      tasksEl);
  }

  // ================= §5 three ways =================
  function mini(kind) {
    // tiny before/after diagrams: same-file branch vs new file
    const svg = h("svg:svg", { viewBox: "0 0 220 90", role: "img", "aria-label": kind });
    const box = (x, y, w, hh, lbl) => [h("svg:rect", { x, y, width: w, height: hh, rx: 6, fill: "none", stroke: "var(--line-2)", "stroke-dasharray": "4 3" }), h("svg:text", { x: x + 6, y: y + 12, fill: "var(--fg-mute)", style: { font: "500 10px var(--f-body)" } }, lbl)];
    const dot = (x, y, c) => h("svg:circle", { cx: x, cy: y, r: 5, fill: c });
    const ln = (x1, y1, x2, y2, c) => h("svg:line", { x1, y1, x2, y2, stroke: c || "var(--line-2)", "stroke-width": 2 });
    if (kind === "tree") svg.append(...box(4, 4, 212, 82, "同一个文件"), ln(24, 40, 60, 40), ln(60, 40, 96, 40), ln(96, 40, 132, 28), ln(96, 40, 132, 60, "var(--c-harness)"), ln(132, 60, 168, 60, "var(--c-harness)"), dot(24, 40, "var(--fg-mute)"), dot(60, 40, "var(--fg-mute)"), dot(96, 40, "var(--fg-mute)"), dot(132, 28, "var(--fg-mute)"), dot(132, 60, "var(--c-harness)"), dot(168, 60, "var(--c-harness)"));
    else svg.append(...box(4, 4, 104, 82, "原文件"), ...box(114, 4, 102, 82, "新文件"), ln(20, 44, 50, 44), ln(50, 44, 80, 44), dot(20, 44, "var(--fg-mute)"), dot(50, 44, "var(--fg-mute)"), dot(80, 44, "var(--fg-mute)"),
      ln(130, 44, 160, 44, "var(--c-harness)"), dot(130, 44, "var(--c-harness)"), dot(160, 44, "var(--c-harness)"), kind === "clone" ? [ln(160, 44, 190, 44, "var(--c-harness)"), dot(190, 44, "var(--c-harness)")] : null);
    return svg;
  }
  const WAYS = [
    { q: "你想比较两种实现方案。它们属于同一个任务，以后还要来回对照。", opts: [{ t: "/tree：同一文件里开分支", ok: true }, { t: "/fork：分出新会话" }, { t: "/clone：复制整个会话" }], why: "相关的备选方案放在同一棵树里，/tree 随时来回切换。" },
    { q: "聊着聊着冒出一个独立的新任务，但它需要前面三轮的背景。", opts: [{ t: "/tree" }, { t: "/fork：从第四条消息分出新会话", ok: true }, { t: "/new" }], why: "/fork 把那条消息之前的路径复制成新文件，新任务从此独立。" },
    { q: "当前进展很好。你想留一份原样的备份，然后在副本上大胆试验。", opts: [{ t: "/clone", ok: true }, { t: "/fork" }, { t: "/compact" }], why: "/clone 把整条活动分支复制成新会话，原会话不受影响。" },
    { q: "你走进了死胡同。想回到三轮之前重来，并让模型知道「那条路不通」。", opts: [{ t: "/tree 回去，选 Summarize", ok: true }, { t: "/tree 回去，选 No summary" }, { t: "/new 重新开始" }], why: "分支摘要把失败的经验带到新路线上，又不必重发整段失败的历史。" },
  ];

  // ================= §8 lab =================
  const LAB_SETUP = `mkdir -p ~/pi-lab/m3 && cd ~/pi-lab/m3
pi --session-dir ~/pi-lab/m3/sessions`;
  const LAB_INSIDE = [
    ["输入并回车", "给我的猫起一个名字，只回答名字。"],
    ["输入并回车", "再给它想一句口号，只回答口号。"],
    ["输入 /tree 回车；按 ↑ 选中第二条「你」的消息，回车", "/tree"],
    ["在「Summarize branch?」里选 Summarize，回车", ""],
    ["编辑器里出现原来的话。按 Ctrl+U 清空，输入并回车", "再给它想一句英文口号，只回答口号。"],
    ["按 Ctrl+D 退出 pi", ""],
  ];
  const LAB_JQ = `jq -r 'select(.type!="session") | [.id, (.parentId // "-"), .type, (.message.role // "-"), ((([.message.content[]? | .text? // empty] | join("")) // "") | .[0:16] | gsub("\\t|\\n"; " "))] | @tsv' ~/pi-lab/m3/sessions/*.jsonl`;
  const LAB_CLEAN = "cd ~ && rm -r ~/pi-lab/m3 && rmdir --ignore-fail-on-non-empty ~/pi-lab";
  const LAB_SAMPLE = REAL.map(([id, p, type, role, text]) => [id, p || "-", type, role || "-", type === "message" && role !== "system" ? text.slice(0, 16) : ""].join("\t")).join("\n");
  function lab() {
    const saved = Store.get(ID, "lab", {});
    const ta = h("textarea", { class: "paste", id: "m3-lab-paste", spellcheck: "false", placeholder: "3adab6ae\t-\tmodel_change\t-\t\n…" });
    ta.value = saved.raw || "";
    ta.addEventListener("input", () => { delete ta.dataset.sample; });
    const out = h("div");
    const verify = (sample) => {
      if (sample) { ta.value = LAB_SAMPLE; ta.dataset.sample = "1"; }
      const isSample = ta.dataset.sample === "1";
      const rows = ta.value.split(/\r?\n/).map((l) => l.split("\t")).filter((c) => c.length >= 3 && /^[0-9a-f-]{6,}$/i.test(c[0].trim()));
      if (rows.length < 5) { out.replaceChildren(h("div", { class: "note warn" }, h("span", { class: "k" }, "无法读取"), "至少要有 5 行，每行用 Tab 分隔。直接复制终端输出即可。")); return; }
      const N = rows.map(([id, p, type, role, text]) => ({ id: id.trim(), parent: p && p.trim() !== "-" ? p.trim() : null, type: (type || "").trim(), role: (role || "").trim(), text: (text || "").trim() }));
      const B = Object.fromEntries(N.map((n) => [n.id, n]));
      const kids = {}; N.forEach((n) => { if (n.parent) (kids[n.parent] ||= []).push(n.id); });
      const branchPts = Object.entries(kids).filter(([, c]) => c.length >= 2);
      const leaf = N[N.length - 1].id;
      const path = pathTo(B, leaf);
      const offUsers = N.filter((n) => n.role === "user" && !path.includes(n.id));
      const checks = [
        [N.every((n) => !n.parent || B[n.parent]), "每条记录的 parentId 都能在文件里找到"],
        [branchPts.length >= 1, "至少有一个分叉点（一条记录有两个子记录）"],
        [N.some((n) => n.type === "branch_summary"), "有一条 branch_summary"],
        [N.filter((n) => n.role === "assistant").length >= 3, "两条路线上都有模型回复"],
      ];
      const ok = checks.every((c) => c[0]);
      const qbox = h("div");
      if (ok) {
        const inp = h("input", { type: "number", id: "m3-lab-len", style: { font: "700 18px var(--f-mono)", width: "120px", background: "var(--sunk)", color: "var(--fg)", border: "1px solid var(--line-2)", borderRadius: "6px", padding: "4px 8px" } });
        const fb = h("div", { class: "feedback", style: { padding: "8px 0 0" }, hidden: true });
        const choices = h("div", { class: "opts", style: { padding: "8px 0" } }, N.filter((n) => n.role === "user").map((n) => h("button", { class: "opt", "aria-pressed": "false", onclick: (e) => { const b = e.currentTarget; b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") === "true" ? "false" : "true"); }, "data-id": n.id }, h("span", { class: "l" }, ""), h("span", null, n.text || n.id))));
        qbox.append(h("p", null, "最后一行 ", h("code", null, leaf), " 是叶子。用你自己的数据回答："),
          h("label", { for: "m3-lab-len", style: { display: "flex", gap: "10px", alignItems: "center" } }, "从叶子走到根，一共几条记录（含叶子和根）？", inp),
          h("p", { style: { margin: "12px 0 0" } }, "哪些「你」的消息不在活动分支上？（可多选）"), choices,
          h("button", { class: "btn primary", onclick: () => {
            const lenOk = +inp.value === path.length;
            const picked = $$("button[aria-pressed=true]", choices).map((b) => b.dataset.id).sort();
            const want = offUsers.map((n) => n.id).sort();
            const selOk = picked.length === want.length && picked.every((x, i) => x === want[i]);
            inp.style.borderColor = lenOk ? "var(--ok)" : "var(--bad)";
            fb.hidden = false;
            if (lenOk && selOk && !isSample) { Store.set(ID, "lab", { raw: ta.value, passed: true }); checkDone(); fb.replaceChildren(h("span", { class: "verdict ok" }, "实验通过。"), "你从真实文件里还原了模型看到的历史。最后一步：清理。"); }
            else if (lenOk && selOk) fb.replaceChildren(h("span", { class: "verdict ok" }, "答对了。"), "这是示例数据，不计入实验。请用你自己的会话再做一次。");
            else fb.replaceChildren(h("span", { class: "verdict no" }, "再看一次。"), (lenOk ? "" : "长度不对：从最后一行出发，沿 parentId 一直走到 parentId 为 - 的那一行，数经过的行。") + (selOk ? "" : " 选择不对：不在这条路上的「你」的消息，就是被你放弃的那条路线上的。"));
          } }, "核对"), fb);
      }
      out.replaceChildren(h("ul", { class: "check-list" }, checks.map(([o, t]) => h("li", null, h("span", { class: o ? "ok" : "no" }, o ? "✓" : "✗"), t))),
        ok ? qbox : h("div", { class: "note warn" }, h("span", { class: "k" }, "结构不完整"), "确认你在 /tree 里选了第二条「你」的消息，并在改写后发送了它。"));
    };
    if (saved.raw) setTimeout(() => verify(false), 0);
    return h("div", { class: "lab-steps" },
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "建实验目录，启动 pi。"), copyBlock(LAB_SETUP))),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "在 pi 里按顺序操作。"),
        h("div", { class: "panel", style: { marginTop: "8px" } }, LAB_INSIDE.map(([how, what], i) => h("div", { class: "mini-tr" }, h("div", { class: "row", style: { gridTemplateColumns: "28px 300px minmax(0,1fr)" } }, h("span", { class: "n" }, String.fromCharCode(97 + i)), h("span", { style: { fontFamily: "var(--f-body)", fontSize: "15px" } }, how), h("span", { class: "what" }, what))))),
        h("p", { class: "dim", style: { margin: "8px 0 0", fontSize: "16px" } }, "第 d 步会多一次模型调用：pi 用模型写分支摘要。"))),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "把会话文件列成表：id、parentId、类型、角色、开头文字。"), copyBlock(LAB_JQ))),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "粘贴输出，核对，回答两个问题。"), h("div", { style: { marginTop: "8px" } }, ta),
        h("div", { style: { display: "flex", gap: "8px", marginTop: "8px" } }, h("button", { class: "btn primary", onclick: () => verify(false) }, "核对我的会话"), h("button", { class: "btn ghost", onclick: () => verify(true) }, "先用示例数据试试")), out)),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "清理。"), copyBlock(LAB_CLEAN))));
  }

  // ================= quiz / review / recap =================
  const QUIZ = [
    { q: "会话文件里，两条记录的关系由什么决定？", opts: [{ t: "子记录的 parentId 等于父记录的 id", ok: true }, { t: "它们在文件里的先后行号" }, { t: "时间戳" }], why: "行号只说明写入顺序。新分支的记录写在文件末尾，但挂在很早的父记录下面。" },
    { q: "模型在下一次请求里看到哪些消息？", opts: [{ t: "从当前叶子沿 parentId 走到根的那条路径", ok: true }, { t: "文件里的全部消息" }, { t: "最近写入的 20 条" }], why: "这条路径叫活动分支。其他分支留在文件里，但不发送。" },
    { q: "在 /tree 里选中一条「你」的消息并回车，pi 会：", opts: [{ t: "回到它之前，把它的文字放回编辑器", ok: true }, { t: "删掉它之后的所有消息" }, { t: "立刻重新发送它" }], why: "改写后发送，就从同一个父记录长出一个新分支。旧分支保留。" },
    { q: "在 /tree 里选中一条模型回复并回车，pi 会：", opts: [{ t: "移到这条回复之后，编辑器为空", ok: true }, { t: "重新生成这条回复" }, { t: "把回复文字放进编辑器" }], why: "接着写新消息，就从这条回复下面长出分支。" },
    { q: "/tree、/fork、/clone 中，哪个不产生新文件？", opts: [{ t: "/tree", ok: true }, { t: "/fork" }, { t: "/clone" }], why: "/tree 在同一个文件里分支。/fork 和 /clone 都写一个新会话文件，表头带 parentSession。" },
    { q: "分支摘要（branch_summary）挂在哪里？", opts: [{ t: "你回到的那一点下面，成为新路线的开头", ok: true }, { t: "你离开的那条分支末尾" }, { t: "文件开头" }], why: "它把离开的路线浓缩后带进新路线，让模型知道试过什么。" },
    { q: "你在 /tree 里切到旧分支，没发任何消息就退出。下次 pi -c：", opts: [{ t: "回到文件里最后写入的那条记录", ok: true }, { t: "回到你最后切到的位置" }, { t: "打开一个新会话" }], why: "本机实测：切换位置不写入文件。想保留位置，就在那里发一条消息。" },
    { q: "删除一个会话最直接的方法：", opts: [{ t: "在 /resume 里选中它按 Ctrl+D，或删除它的 .jsonl 文件", ok: true }, { t: "在会话里按 Ctrl+D" }, { t: "运行 /new" }], why: "会话就是一个 JSONL 文件。pi 有 trash 命令时会移到回收站。" },
    { q: "分支摘要要花钱吗？", opts: [{ t: "要。pi 调用模型写摘要", ok: true }, { t: "不要，是本地生成的" }, { t: "只有自定义提示时才要" }], why: "本机实测：选 Summarize 后底栏 ↓ 增加了约 100 token。" },
    { q: "/tree 里按哪个组合键给节点加标签，方便以后找回？", opts: [{ t: "Shift+L", ok: true }, { t: "Ctrl+L" }, { t: "Ctrl+X" }], why: "标签是一条 label 记录，也写进文件。Ctrl+L 在 /tree 里是「只看有标签的」过滤器。" },
  ];
  const REVIEW = [
    { q: "（复习 M2）运行中按 Alt+Enter 的消息什么时候进入？", opts: [{ t: "agent 完成当前任务之后", ok: true }, { t: "当前这轮结束后" }, { t: "立刻" }], why: "Alt+Enter 是排队（follow-up）；Enter 是插话（steering）。" },
    { q: "（复习 M2）只跑了几条 ! 命令就退出，会话文件：", opts: [{ t: "不会写入磁盘", ok: true }, { t: "会写入" }], why: "会话文件在第一次模型回复后才写入。" },
  ];
  const PRE = [
    { id: "p1", q: "你在 pi 里回到三轮之前，改写一条消息重新发送。原来那三轮：", opts: [{ t: "被删除" }, { t: "还在同一个文件里", ok: true }, { t: "被移到另一个文件" }] },
    { id: "p2", q: "会话文件里，新分支的记录写在哪里？", opts: [{ t: "插在分叉点后面" }, { t: "写在文件末尾", ok: true }, { t: "写进一个新文件" }] },
    { id: "p3", q: "模型会看到你放弃的那条分支吗？", opts: [{ t: "会，整个文件都发送" }, { t: "不会，除非你让 pi 做分支摘要", ok: true }] },
  ];
  function checkDone() {
    const ok = Store.get(ID, "lab", {}).passed && Store.get(ID, "quiz", { best: 0 }).best >= 8;
    if (ok && !Store.get(ID, "done")) Store.set(ID, "done", true);
  }

  window.Course.register(ID, (page) => {
    const rc = window.Course.recapBlock(ID, {
      pre: PRE,
      next: { id: "M4", title: "压缩", text: "你已经会读树。M4 讲另一种「不发送旧消息」的机制：压缩。它在同一条路线上，把前半段换成摘要。" },
      extra: () => [["走树", Store.get(ID, "trace", {}).ok ? "✓" : "—"], ["操场任务", Object.keys(Store.get(ID, "pg", {})).length + " / 3"]],
    });
    page.append(h("div", { class: "bench" },
      h("header", { class: "mhead" }, h("div", { class: "crumbs" }, "第 2 单元 · 驾驭 pi / M3"), h("h1", { class: "mtitle" }, h("span", { class: "mid" }, "M3"), "会话是一棵树")),
      section("s-hero", 0, "开场", null, hero(),
        h("div", { class: "col" },
          h("p", { class: "thesis" }, "回到过去重来，不会抹掉原来的路。", h("br"), "模型只沿着一条路往回看。"),
          h("p", { class: "lead" }, "上面是你本机的一个真实会话：问了猫的名字和口号，然后回到第二个问题，改问英文口号。两条路线都在同一个文件里。切换上方的按钮，看「活动分支」怎样决定模型看到什么。")),
        h("div", { class: "panel objectives" },
          h("ol", null,
            h("li", null, "读懂会话文件：表头、记录类型、id 与 parentId。"),
            h("li", null, "从任意叶子沿 parentId 还原活动分支，说出模型会看到什么。"),
            h("li", null, "用 /tree 开分支，并判断何时需要分支摘要。"),
            h("li", null, "分清 /tree、/fork、/clone 的结果，并按场景选用。"),
            h("li", null, "说出「当前位置不单独存盘」的后果。")),
          h("div", { class: "obj-side" },
            h("div", null, h("span", { class: "k" }, "时长"), "约 60 分钟"),
            h("div", null, h("span", { class: "k" }, "前置"), "M1、M2"),
            h("div", null, h("span", { class: "k" }, "练习"), "§8 实验 + §9 测验（≥ 8/10）"),
            h("div", null, h("span", { class: "k" }, "核对版本"), "pi 0.99.2 · 会话格式 v3"))),
        h("h3", null, "本课路线"),
        route(ID, [["s-pre", 1, "动手", "复习与预测"], ["s-file", 2, "动手", "文件逐行"], ["s-trace", 3, "动手", "走一遍树"], ["s-pg", 4, "动手", "/tree 操场"], ["s-ways", 5, "动手", "三种分法"], ["s-sum", 6, "阅读", "分支摘要"], ["s-nav", 7, "阅读", "导航技巧"], ["s-lab", 8, "实验", "真机开分支"], ["s-quiz", 9, "测验", "10 题"], ["s-recap", 10, "阅读", "小结"]])),
      h("div", { class: "col" },
        section("s-pre", 1, "复习与预测", "先复习，再预测",
          todo("两道 M2 复习题立即判分；三道预测课末揭晓。"),
          REVIEW.map((r, i) => choice({ id: "r" + i, store: [ID, "rev"], kicker: "复习 " + (i + 1) + " / 2", q: r.q, opts: r.opts, explain: r.why, shuffleSeed: 51 + i * 7 })),
          PRE.map((p, i) => choice({ id: p.id, store: [ID, "pre"], kicker: "预测 " + (i + 1) + " / 3", q: p.q, opts: p.opts, reveal: false, shuffleSeed: 27 + i * 13 }))),
        section("s-file", 2, "文件逐行", "会话文件里有什么",
          todo("逐行点击，读每种记录的说明。"),
          h("p", null, "会话是一个 JSONL 文件：一行一个 JSON 对象。默认位置是 ~/.pi/agent/sessions/--<目录>--/<时间>_<会话ID>.jsonl。"),
          h("p", null, "文件只追加，不修改旧行。除第一行外，每一行都有 id 和 parentId。正是 parentId 把这些行连成一棵树。"),
          anatomy()),
        section("s-trace", 3, "走一遍树", "活动分支 = 从叶子走回根",
          todo("按上面的规则，从叶子 aa1c135f 开始，顺着 parentId 依次点出到根的每一行。点错会提示下一步找哪一行；也可以直接显示答案。"),
          h("p", null, "pi 每次组装请求都做同一件事：从当前位置（叶子）出发，沿 parentId 一步步走到根，收集路上的消息。这条路叫", term("context", "活动分支"), "。"),
          tracer(),
          h("div", { class: "note" }, h("span", { class: "k" }, "行号不是顺序"), "第 9 行（branch_summary）的父记录在第 6 行；第 7、8 行属于另一条路线。看结构只看 parentId。")),
        section("s-pg", 4, "/tree 操场", "自己开分支",
          todo("读三条规则。下面的操场是可选的：想动手就试三个任务，不试也行——结论写在操场下面。", true),
          h("p", null, "在 pi 里输入 /tree（或在编辑器为空时连按两次 Esc）打开会话树。选中一条记录回车："),
          h("ul", { class: "rule" },
            h("li", null, h("b", null, "选「你」的消息："), "回到它之前，它的文字放回编辑器。改写后发送，就长出新分支。"),
            h("li", null, h("b", null, "选其他记录："), "移到它之后，编辑器为空。"),
            h("li", null, h("b", null, "离开一条分支时："), "pi 问 Summarize branch?：不要摘要、要摘要、带自定义要求的摘要。")))),
      h("div", { class: "bench" }, h("details", { class: "panel opt-sim" }, h("summary", null, "可选：在操场里自己开分支（规则与真实的 /tree 一致）"), playground())),
      h("div", { class: "col" },
        h("div", { class: "note" }, h("span", { class: "k" }, "操场里的三个结论"),
          "① 回到某条「你」的消息、改写后发送，就在同一个文件里长出新分支，旧分支原样保留。",
          h("br"), "② 离开一条分支时选「要摘要」，pi 会把那条路的要点写成一条分支摘要，挂在新位置上。",
          h("br"), "③ 只在 /tree 里移动、不发消息就退出，这次移动不会被记住：下次 pi -c 回到的是最后写入的那条记录。"),
        section("s-ways", 5, "三种分法", "/tree、/fork、/clone",
          todo("看三张对比图，然后做四个场景题。"),
          h("p", null, "三个命令都能「从过去某一点另起炉灶」。区别在结果放在哪里。另外记住一点：离开一条分支时可以生成「分支摘要」，把那条路的经验（比如「此路不通」）带到新路线上，又不用重发整段历史——§6 细讲。")),
        h("div", { class: "cmp3" },
          h("div", { class: "panel" }, h("h4", null, "/tree"), h("div", { class: "res" }, "同一个文件里开分支"), mini("tree"), h("ul", null, h("li", null, "随时来回切换"), h("li", null, "可带分支摘要"), h("li", null, "适合同一任务的备选方案"))),
          h("div", { class: "panel" }, h("h4", null, "/fork"), h("div", { class: "res" }, "选一条「你」的消息，之前的路径复制成新文件"), mini("fork"), h("ul", null, h("li", null, "被选的消息放回编辑器"), h("li", null, "表头记 parentSession"), h("li", null, "适合分出独立的新任务"))),
          h("div", { class: "panel" }, h("h4", null, "/clone"), h("div", { class: "res" }, "整条活动分支复制成新文件"), mini("clone"), h("ul", null, h("li", null, "原会话不受影响"), h("li", null, "表头记 parentSession"), h("li", null, "适合留备份后大胆试验")))),
        h("p", { class: "mute", style: { fontSize: "15px", marginTop: "10px" } }, "本机实测：/fork 和 /clone 都新建了一个 .jsonl，第一行的 parentSession 指向原文件。启动时用 pi --fork <文件或ID> 可以直接从已有会话分出新会话。"),
        WAYS.map((w, i) => choice({ id: "w" + i, store: [ID, "ways"], kicker: "场景 " + (i + 1) + " / 4", q: w.q, opts: w.opts, explain: w.why, shuffleSeed: 61 + i * 5 })),
        section("s-sum", 6, "分支摘要", "带走经验，不带走历史",
          todo("读下面的真实摘要，想一想它对新路线有什么用。", true),
          h("p", null, "选择 Summarize 时，pi 让模型把离开的那段路线总结成固定格式：目标、约束、进展、关键决定、下一步，并附上读过和改过的文件。下面是本机那次的真实摘要（节选）："),
          h("pre", { class: "panel", style: { padding: "14px 16px", whiteSpace: "pre-wrap", fontSize: "15px", lineHeight: 1.6 } }, "The user explored a different conversation branch before returning here.\nSummary of that exploration:\n\n## Goal\nNot specified in the provided conversation.\n\n## Progress\n### Done\n- [x] Assistant provided the phrase: “糯米出场，萌翻全场！”\n\n## Next Steps\n1. Clarify the intended task and whether the phrase needs revision."),
          h("ul", { class: "rule" },
            h("li", null, h("b", null, "No summary："), "不花钱。模型完全不知道那条路线。适合「刚才那条完全无关」。"),
            h("li", null, h("b", null, "Summarize："), "花一次模型调用（本机约 100 token 输出）。适合「那条路不通，要记住为什么」。"),
            h("li", null, h("b", null, "Summarize with custom prompt："), "你告诉它重点保留什么。适合长而复杂的探索。")),
          h("div", { class: "note" }, h("span", { class: "k" }, "相关设置"), "branchSummary.skipPrompt = true 时，pi 不再询问，默认不做摘要。")),
        section("s-nav", 7, "导航技巧", "在大树里找路",
          todo("记住这几个键。实验里会用到 ↑ 和回车。", true),
          h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" }, h("tbody", null,
            [["↑ ↓ / ← →", "逐条 / 翻页移动"], ["Ctrl+← / Ctrl+→", "跳到上一个 / 下一个分叉段"], ["输入文字", "搜索"], ["Shift+L", "给选中的节点加标签（写入一条 label 记录）"], ["Ctrl+U", "只看「你」的消息"], ["Ctrl+T", "隐藏工具结果"], ["Ctrl+L", "只看有标签的节点"], ["Ctrl+A / Ctrl+D", "显示全部 / 恢复默认"], ["Ctrl+X", "复制选中的消息"], ["空编辑器连按两次 Esc", "直接打开 /tree（doubleEscapeAction 默认 tree）"]].map(([k, d]) => h("tr", null, h("td", { style: { whiteSpace: "nowrap" } }, h("kbd", null, k)), h("td", null, d)))))),
          h("div", { class: "note warn" }, h("span", { class: "k" }, "当前位置不单独存盘"), "本机实测：在 /tree 里切到旧分支、不发消息就退出，下次 pi -c 回到的是文件里最后写入的那条记录。想停在某条分支上，就在那里发一条消息，或给它加标签以便找回。")),
        section("s-lab", 8, "实验", "在真实的 pi 里开一次分支",
          todo("按第 1–5 步操作。第 2 步在 pi 里完成。"),
          h("p", null, "你会重做开场的那棵树，然后从自己的会话文件里还原活动分支。"),
          h("div", { class: "note" }, h("span", { class: "k" }, "实验规则"), "只在 ~/pi-lab/m3 里做；会话存进实验目录；最后清理。"),
          lab()),
        section("s-quiz", 9, "掌握测验", "10 题，8 题过关", todo("10 题全部作答，点「交卷」。"), window.Course.quizBlock(ID, QUIZ, checkDone)),
        section("s-recap", 10, "小结", "你学到了什么",
          todo("看自己的预测和成绩。觉得学会了，就在本节最后点「标记为已完成」。", true),
          h("p", { class: "lead" }, "一句话：会话文件只追加，parentId 把记录连成树；模型只看从叶子走回根的那条路；/tree 在同一文件分支，/fork 和 /clone 写新文件。"),
          rc))));
    return () => rc._cleanup && rc._cleanup();
  });
})();
