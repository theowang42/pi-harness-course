/* M0 · Harness 是什么 */
(function () {
  "use strict";
  const { h, $$, sleep, reduced, term, section, quizBlock, lessonHead, look, howto, endBlock } = window.Course;
  const T = window.M0_TRACE;
  const ID = "M0";
  const fmt = (n) => n.toLocaleString("en-US");
  const R = (cls, txt) => h("span", { class: "r r-" + cls }, txt);

  const turns = T.turns;
  const toolCallsOf = (t) => t.content.filter((c) => c.type === "toolCall");
  const textOf = (t) => t.content.filter((c) => c.type === "text").map((c) => c.text).join("");
  const ctxTok = (t) => t.usage.input + t.usage.cacheRead;
  const argStr = (a) => JSON.stringify(Object.fromEntries(Object.entries(a).filter(([, v]) => v != null)));

  // ================= §1 roles =================
  function rolesFigure() {
    const node = (c, x, y, w, hh, label, sub) => [
      h("svg:rect", { x, y, width: w, height: hh, rx: 8, fill: `var(--c-${c}-bg)`, stroke: `var(--c-${c})`, "stroke-width": 1.5 }),
      h("svg:text", { x: x + w / 2, y: y + hh / 2 - 2, "text-anchor": "middle", class: "svg-label", fill: `var(--c-${c})` }, label),
      h("svg:text", { x: x + w / 2, y: y + hh / 2 + 17, "text-anchor": "middle", class: "svg-sub", fill: "var(--fg-mute)" }, sub)];
    const arrow = (d, c, label, lx, ly, anchor = "middle") => [
      h("svg:path", { d, fill: "none", stroke: `var(--c-${c})`, "stroke-width": 1.6, "marker-end": `url(#m0-ah-${c})` }),
      h("svg:text", { x: lx, y: ly, "text-anchor": anchor, class: "svg-sub", fill: `var(--c-${c})` }, label)];
    const marker = (c) => h("svg:marker", { id: "m0-ah-" + c, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, h("svg:path", { d: "M0 0L10 5L0 10z", fill: `var(--c-${c})` }));
    return h("div", { class: "panel fig", style: { padding: "16px" } }, h("svg:svg", { viewBox: "0 0 640 380", role: "img", "aria-label": "你、pi、工具在你的电脑上，模型在云端；它们之间只经过 pi" },
      h("svg:defs", null, ["user", "harness", "model", "tool"].map(marker)),
      h("svg:rect", { x: 12, y: 12, width: 392, height: 356, rx: 12, fill: "none", stroke: "var(--line-2)", "stroke-dasharray": "4 4" }),
      h("svg:text", { x: 26, y: 34, class: "svg-sub", fill: "var(--fg-mute)" }, "你的电脑"),
      h("svg:rect", { x: 450, y: 12, width: 178, height: 356, rx: 12, fill: "none", stroke: "var(--line-2)", "stroke-dasharray": "4 4" }),
      h("svg:text", { x: 464, y: 34, class: "svg-sub", fill: "var(--fg-mute)" }, "云端（提供者）"),
      arrow("M120 92 L120 148", "user", "你的消息", 132, 124, "start"),
      arrow("M228 168 C320 150, 400 130, 470 130", "harness", "请求", 350, 128),
      arrow("M470 196 C400 210, 320 220, 228 206", "model", "回复：文字或工具调用", 350, 232),
      arrow("M96 228 L96 278", "harness", "执行", 84, 258, "end"),
      arrow("M148 278 L148 228", "tool", "结果", 160, 258, "start"),
      node("user", 40, 48, 160, 44, "你", "提要求 · 看结果"),
      node("harness", 40, 148, 188, 80, "pi", "发请求 · 执行 · 记录"),
      node("model", 470, 108, 140, 110, "模型", "只读文字、写文字"),
      node("tool", 40, 278, 188, 64, "工具", "read · bash · edit · write")));
  }
  function rolesTable() {
    const rows = [
      ["user", "你", "提出要求；决定用哪个模型、开哪些工具；检查结果。", "pi 执行工具前默认不问你。"],
      ["harness", "pi", "把要发给模型的内容打包成请求；收到回复后，认出其中的工具调用并执行；把一切记进会话文件。", "不思考，不决定下一步做什么。"],
      ["model", "模型", "读请求，写回复。回复要么是给你的文字，要么是「请运行某个工具」。", "不能碰你的电脑；不记得上一次请求的内容。"],
      ["tool", "工具", "在你的电脑上做一件具体的事：read 读文件，bash 运行命令，edit 改文件，write 写文件。", "不判断该不该做。它用你的账户权限运行。"],
    ];
    return h("div", { class: "panel" }, h("table", { class: "roletab" },
      h("thead", null, h("tr", null, h("th", null, "角色"), h("th", null, "做什么"), h("th", null, "不做什么"))),
      h("tbody", null, rows.map(([c, n, d, nd]) => h("tr", null, h("td", { class: "r-" + c }, n), h("td", null, d), h("td", { class: "dim" }, nd))))));
  }

  // ================= §2 request anatomy =================
  function request() {
    const s = T.system;
    const toolsDef = [
      ["read", "内置", "{ path: string, offset?: number, limit?: number }"],
      ["bash", "内置", "{ command: string, timeout?: number }"],
      ["edit", "内置", "{ path: string, edits: [{ oldText: string, newText: string }] }"],
      ["write", "内置", "{ path: string, content: string }"],
      ["web_search", "扩展 pi-web-access", "…"],
      ["fetch_content", "扩展 pi-web-access", "…"],
      ["get_search_content", "扩展 pi-web-access", "…"],
    ];
    const items = [
      { g: "系统提示", nm: "基础说明", src: "pi 内置", text: s.preamble, why: "告诉模型它在 pi 里工作，能读文件、运行命令、改代码。" },
      { g: "系统提示", nm: "工具清单", src: "pi 生成", text: s.tools, why: "列出这次能用的工具。前四个是 pi 自带的，后三个来自这台电脑装的一个扩展。" },
      { g: "系统提示", nm: "使用规则", src: "pi 内置", text: s.rules, why: "教模型怎么用好这些工具，例如改文件用 edit，不要用 sed。" },
      { g: "系统提示", nm: "AGENTS.md", src: "你写的", text: s.project_context, why: "AGENTS.md 是你放在项目目录里的说明文件。pi 找到它，就把原文放进系统提示。它只是一段文字（第 8 课细讲）。" },
      { g: "系统提示", nm: "pi 文档索引", src: "pi 内置", text: `（${fmt(s.docsLen)} 个字符，此处省略）\n告诉模型：用户问 pi 本身时，去哪里读 pi 的文档。`, len: s.docsLen, why: "只在你问 pi 本身的问题时有用，但每次请求都会带上。" },
      { g: "系统提示", nm: "工作目录", src: "pi 生成", text: s.cwd, why: "模型只知道这个路径。目录里有什么，它要调用工具才能看到。" },
      { g: "工具定义", nm: "7 个工具的参数格式", src: "内置 + 扩展", text: toolsDef.map(([n, src, p]) => `${n.padEnd(19)} ${src}\n  参数 ${p}`).join("\n\n"), len: 2600, why: "每个工具的名字、说明和参数格式。模型照这个格式写工具调用。这里把参数格式简写了。" },
      { g: "消息", nm: "你的消息", src: "你写的", text: T.user, why: "会话里目前只有这一条消息。之后每一轮的回复和工具结果都会接在它后面。" },
    ];
    items.forEach((it) => { it.len = it.len || it.text.length; });
    const max = Math.max(...items.map((i) => i.len));
    const view = h("div", { class: "req-view" });
    const list = h("div", { class: "req-list", role: "listbox", "aria-label": "请求的组成部分" });
    const colorOf = (it) => (it.src === "你写的" ? "var(--c-user)" : it.g === "工具定义" ? "var(--c-tool)" : "var(--c-harness)");
    let g0 = null;
    const btns = items.map((it, i) => {
      if (it.g !== g0) { list.append(h("div", { class: "req-group" }, it.g)); g0 = it.g; }
      const b = h("button", { class: "req-item", role: "option", "aria-selected": "false", onclick: () => sel(i) },
        h("span", null, h("span", { class: "nm" }, it.nm), h("span", { class: "src" }, it.src)),
        h("span", { class: "sz" }, fmt(it.len) + " 字符"),
        h("span", { class: "bar" }, h("i", { style: { width: Math.max(3, (it.len / max) * 100) + "%", background: colorOf(it) } })));
      list.append(b); return b;
    });
    function sel(i) {
      btns.forEach((b, k) => b.setAttribute("aria-selected", k === i));
      view.replaceChildren(h("p", { class: "why" }, items[i].why), h("pre", null, items[i].text));
    }
    sel(0);
    return h("div", { class: "panel req" }, list, view);
  }

  // ================= §3 loop =================
  const LOOP = [
    { k: "assemble", t: "发请求", c: "harness", a: -90 },
    { k: "generate", t: "模型回复", c: "model", a: -18 },
    { k: "decide", t: "有工具调用？", c: "harness", a: 54 },
    { k: "execute", t: "执行工具", c: "tool", a: 126 },
    { k: "append", t: "记下结果", c: "harness", a: 198 },
  ];
  function loopSvg() {
    const cx = 140, cy = 150, r = 92;
    const P = (a, rr = r) => [cx + rr * Math.cos((a * Math.PI) / 180), cy + rr * Math.sin((a * Math.PI) / 180)];
    const svg = h("svg:svg", { viewBox: "0 0 280 320", role: "img", "aria-label": "agent loop：发请求、模型回复、判断有没有工具调用、执行工具、记下结果，然后回到发请求" });
    svg.append(h("svg:defs", null, h("svg:marker", { id: "m0-lp-ah", viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto" }, h("svg:path", { d: "M0 0L10 5L0 10z", fill: "var(--line-2)" }))));
    for (let i = 0; i < LOOP.length; i++) {
      const a1 = LOOP[i].a + 17, a2 = LOOP[(i + 1) % LOOP.length].a - 17;
      const [x1, y1] = P(a1), [x2, y2] = P(a2 < a1 ? a2 + 360 : a2);
      svg.append(h("svg:path", { d: `M${x1} ${y1} A${r} ${r} 0 0 1 ${x2} ${y2}`, fill: "none", stroke: "var(--line-2)", "stroke-width": 1.6, "marker-end": "url(#m0-lp-ah)" }));
    }
    const [ax, ay] = P(-90);
    svg.append(h("svg:path", { d: `M40 26 C70 26, ${ax - 30} ${ay - 34}, ${ax - 20} ${ay - 20}`, fill: "none", stroke: "var(--c-user)", "stroke-width": 1.4, "marker-end": "url(#m0-lp-ah)" }));
    svg.append(h("svg:g", { class: "loop-node", "data-k": "start" }, h("svg:rect", { x: 2, y: 14, width: 70, height: 24, rx: 12, fill: "var(--c-user-bg)", stroke: "var(--c-user)" }), h("svg:text", { x: 37, y: 30, "text-anchor": "middle", class: "svg-sub", fill: "var(--c-user)" }, "你的消息")));
    const [dx, dy] = P(54);
    svg.append(h("svg:path", { d: `M${dx + 18} ${dy + 18} L222 292`, fill: "none", stroke: "var(--ok)", "stroke-width": 1.4, "stroke-dasharray": "3 3", "marker-end": "url(#m0-lp-ah)" }));
    svg.append(h("svg:text", { x: dx + 30, y: dy + 32, class: "svg-sub", fill: "var(--ok)" }, "没有"));
    svg.append(h("svg:text", { x: cx, y: cy + r + 16, "text-anchor": "middle", class: "svg-sub", fill: "var(--c-tool)" }, "有"));
    svg.append(h("svg:g", { class: "loop-node", "data-k": "end" }, h("svg:rect", { x: 200, y: 292, width: 76, height: 24, rx: 12, fill: "var(--ok-bg)", stroke: "var(--ok)" }), h("svg:text", { x: 238, y: 308, "text-anchor": "middle", class: "svg-sub", fill: "var(--ok)" }, "结束")));
    LOOP.forEach((n, i) => {
      const [x, y] = P(n.a);
      svg.append(h("svg:g", { class: "loop-node", "data-k": n.k },
        h("svg:circle", { cx: x, cy: y, r: 25, fill: "var(--panel)", stroke: `var(--c-${n.c})`, "stroke-width": 1.6 }),
        h("svg:text", { x, y: y + 4, "text-anchor": "middle", style: { font: "700 12px var(--f-body)" }, fill: `var(--c-${n.c})` }, String(i + 1)),
        h("svg:text", { x, y: y - 32, "text-anchor": "middle", style: { font: "600 12px var(--f-body)" }, fill: "var(--fg-dim)" }, n.t)));
    });
    return svg;
  }

  function stepper() {
    const STEPS = [{ k: "start" }];
    turns.forEach((t, i) => {
      STEPS.push({ k: "assemble", i }, { k: "generate", i }, { k: "decide", i });
      if (t.stop === "toolUse") STEPS.push({ k: "execute", i }, { k: "append", i });
      else STEPS.push({ k: "end", i });
    });
    let pos = 0, busy = false, auto = false, autoTimer = null;

    const svg = loopSvg();
    const narr = h("div", { class: "st-narr" });
    const ctr = (k) => { const v = h("div", { class: "v" }, "0"); return [h("div", { class: "ctr" }, v, h("div", { class: "k" }, k)), v]; };
    const [cReqEl, cReq] = ctr("请求（= 轮）");
    const [cToolEl, cTool] = ctr("工具调用");
    const feed = h("div", { class: "st-feed", "aria-live": "polite" });
    const stack = h("div", { class: "ctx-stack" });
    const sizeLine = h("div", { class: "mute", style: { fontSize: "15px", lineHeight: 1.5, marginTop: "8px" } });
    const stepLbl = h("span", { class: "score-pill" });
    const bPrev = h("button", { class: "btn", onclick: () => back() }, "◀ 上一步");
    const bNext = h("button", { class: "btn primary", onclick: () => next() }, "下一步 ", h("span", { class: "k" }, "→"));
    const bAuto = h("button", { class: "btn", onclick: () => toggleAuto() }, "自动播放");
    const bReset = h("button", { class: "btn ghost", onclick: () => rebuild(0) }, "重来");

    function setNode(k) {
      $$(".loop-node", svg).forEach((g) => {
        const on = g.dataset.k === k;
        const c = g.querySelector("circle");
        if (c) { c.setAttribute("fill", on ? c.getAttribute("stroke") : "var(--panel)"); g.querySelectorAll("text")[0].setAttribute("fill", on ? "var(--bg)" : c.getAttribute("stroke")); }
        const r = g.querySelector("rect"); if (r) r.setAttribute("stroke-width", on ? 3 : 1);
      });
    }
    const blk = (cls, label, right, hgt) => h("div", { class: "ctx-blk " + cls, style: { minHeight: hgt + "px" } }, h("span", null, label), h("span", null, right || ""));
    function entry(cls, head, meta, ...body) {
      if (feed.firstChild && !feed.firstChild.classList.contains("ent")) feed.firstChild.remove();
      const e = h("div", { class: "ent " + cls }, h("div", { class: "ent-h" }, h("span", null, head), h("span", { class: "meta" }, meta || "")), h("div", { class: "ent-b" }, ...body));
      feed.append(e); feed.scrollTop = feed.scrollHeight; return e;
    }
    const NARR = {
      start: () => [h("b", null, "你发出消息。"), " pi 把它记为会话里的第一条消息。"],
      assemble: (i) => [h("b", null, `第 ${i + 1} 次请求。`), " pi 把系统提示、工具定义和到目前为止的全部消息打包发给模型。", i ? " 上一轮的内容也在里面——模型不记得，只能每次重发。" : ""],
      generate: (i) => [h("b", null, "模型回复。"), toolCallsOf(turns[i]).length ? " 这次回复是一个工具调用：一段写明「运行哪个工具、参数是什么」的文字。" : " 这次回复是写给你的文字，里面没有工具调用。"],
      decide: (i) => turns[i].stop === "toolUse" ? [h("b", null, "有工具调用，继续。"), " 回复的停止原因是 toolUse。"] : [h("b", null, "没有工具调用，结束。"), " 回复的停止原因是 stop。"],
      execute: (i) => [h("b", null, "pi 执行工具。"), " 命令在你的电脑上运行，模型此时什么也不做。", turns[i].results.some((r) => r.isError) ? " 测试失败了，这个失败输出也会原样交给模型。" : ""],
      append: () => [h("b", null, "pi 记下结果。"), " 工具结果作为一条新消息接在会话末尾。然后回到第 1 步。"],
      end: () => [h("b", null, "运行结束。"), ` 共 ${turns.length} 次请求、${turns.length - 1} 次工具调用。pi 等你的下一条消息。`],
    };
    const paintSize = (n) => { sizeLine.textContent = n ? `这次请求的大小：${fmt(ctxTok(turns[n - 1]))} token` : "还没有发过请求。"; };

    async function apply(st, animate) {
      const t = turns[st.i];
      setNode(st.k);
      narr.replaceChildren(...NARR[st.k](st.i));
      if (st.k === "start") {
        entry("user", "你", "", T.user);
        stack.append(blk("sys", "系统提示 + 工具定义", "", 64), blk("user", "你的消息", "", 20));
      } else if (st.k === "assemble") {
        cReq.textContent = st.i + 1; paintSize(st.i + 1);
        $$(".ctx-blk", stack).forEach((b) => b.classList.add("sent"));
        if (animate) setTimeout(() => $$(".ctx-blk", stack).forEach((b) => b.classList.remove("sent")), 900);
        else $$(".ctx-blk", stack).forEach((b) => b.classList.remove("sent"));
        entry("sys", `请求 ${st.i + 1} → 模型`, fmt(ctxTok(t)) + " token", h("span", { class: "dim" }, `打包了 ${stack.children.length} 块：系统提示与工具定义，加 ${stack.children.length - 1} 条消息。`));
      } else if (st.k === "generate") {
        const calls = toolCallsOf(t);
        const body = h("div");
        const e = entry("asst", "模型回复 " + (st.i + 1), "", body);
        if (animate && !reduced()) {
          const live = h("div", { class: "live" }); body.append(live);
          for (const d of t.deltas) {
            if (typeof d !== "string") continue;
            live.append(d); feed.scrollTop = feed.scrollHeight; await sleep(calls.length ? 45 : 30);
          }
          await sleep(150);
        }
        body.replaceChildren();
        if (textOf(t)) body.append(h("div", null, textOf(t)));
        calls.forEach((c) => body.append(h("div", { class: "tc" }, h("span", { class: "nm" }, c.name), "(" + argStr(c.arguments) + ")")));
        e.querySelector(".ent-h span").append(h("span", { class: "stop " + (t.stop === "toolUse" ? "tooluse" : "done") }, t.stop));
      } else if (st.k === "execute") {
        t.results.forEach((r) => {
          cTool.textContent = +cTool.textContent + 1;
          entry("tool" + (r.isError ? " err" : ""), "工具结果 · " + r.toolName, r.isError ? "出错" : "", h("pre", null, r.text.trim()));
        });
      } else if (st.k === "append") {
        stack.append(blk("asst", `回复 ${st.i + 1}`, toolCallsOf(t).map((x) => x.name).join(" "), 18));
        t.results.forEach((r) => stack.append(blk("tool", `结果 ${st.i + 1}`, r.toolName, Math.min(46, 16 + r.text.length / 30))));
      } else if (st.k === "end") {
        stack.append(blk("asst", `回复 ${st.i + 1}`, "文字", 22));
        entry("end", "运行结束", "", h("span", null, "calc.py 已修好"));
      }
    }
    function paintCtrls() { stepLbl.textContent = `${pos} / ${STEPS.length}`; bPrev.disabled = pos === 0; bNext.disabled = pos >= STEPS.length; }
    async function next() {
      if (busy || pos >= STEPS.length) return;
      busy = true;
      await apply(STEPS[pos], true);
      pos++; busy = false;
      if (pos >= STEPS.length) stopAuto();
      paintCtrls();
    }
    function rebuild(n) {
      stopAuto();
      feed.replaceChildren(h("div", { class: "mute", style: { fontSize: "16px", padding: "8px 2px" } }, "还没有消息。按「下一步」开始。"));
      stack.replaceChildren(); cReq.textContent = cTool.textContent = "0"; paintSize(0);
      setNode(null); narr.replaceChildren("按「下一步」或 → 键，一步一步看。");
      pos = 0;
      for (; pos < n; pos++) apply(STEPS[pos], false);
      paintCtrls();
    }
    function back() { if (!busy && pos > 0) rebuild(pos - 1); }
    function stopAuto() { auto = false; clearTimeout(autoTimer); bAuto.textContent = "自动播放"; }
    function toggleAuto() {
      if (auto) return stopAuto();
      auto = true; bAuto.textContent = "暂停";
      const tick = async () => { if (!auto) return; await next(); if (auto && pos < STEPS.length) autoTimer = setTimeout(tick, 1100); else stopAuto(); };
      tick();
    }
    const root = h("div", { class: "panel stepper", tabindex: "0", "aria-label": "agent loop 回放。用左右方向键控制。",
      onkeydown: (e) => {
        if (e.key === "ArrowRight") { e.preventDefault(); next(); }
        else if (e.key === "ArrowLeft") { e.preventDefault(); back(); } } },
      h("div", { class: "st-top" },
        h("div", { class: "st-title" }, "回放 · ", h("span", { class: "u" }, "“" + T.user + "”")),
        h("div", { class: "st-ctrls" }, stepLbl, bReset, bAuto, bPrev, bNext)),
      h("div", { class: "st-grid" },
        h("div", { class: "st-loop" }, svg, h("div", { class: "st-counters" }, cReqEl, cToolEl), narr),
        h("div", { style: { display: "flex", flexDirection: "column", minWidth: 0 } },
          h("div", { class: "panel-h", style: { borderRadius: 0 } }, h("span", null, "会话记录"), h("span", null, "按发生顺序")), feed),
        h("div", { class: "st-ctx" }, h("div", { class: "panel-h", style: { padding: "0 0 8px", border: 0 } }, h("span", null, "下一次请求要发送的内容")), stack, sizeLine)));
    rebuild(0);
    return root;
  }

  // ================= §4 consequences =================
  function toolsDemo() {
    const TOOLS = ["read", "bash", "edit", "write"];
    const TASKS = [["读 calc.py", ["read", "bash"]], ["运行测试", ["bash"]], ["修改 calc.py", ["edit", "write", "bash"]], ["用 curl 下载网页", ["bash"]]];
    const on = new Set(TOOLS);
    const tl = h("ul", { class: "tasks" });
    const paint = () => tl.replaceChildren(...TASKS.map(([t, need]) => { const ok = need.some((x) => on.has(x)); return h("li", { class: ok ? "can" : "cannot" }, h("span", { class: "mk" }, ok ? "✓" : "✗"), t, h("span", { class: "mute mono", style: { fontSize: "15px" } }, "  需要 " + need.join(" 或 "))); }));
    const box = h("div", { class: "toolbox" }, TOOLS.map((t) => { const i = h("input", { type: "checkbox", id: "m0-tool-" + t, checked: true, onchange: () => { i.checked ? on.add(t) : on.delete(t); paint(); } }); return h("label", { for: "m0-tool-" + t }, i, t); }));
    paint();
    return h("div", { class: "panel", style: { padding: "14px 18px" } }, box, tl);
  }

  // ================= quiz =================
  const QUIZ = [
    { q: "pi 运行了 python3 test_calc.py。这条命令是谁、在哪里执行的？", opts: [{ t: "pi 的 bash 工具，在你的电脑上，用你的权限", ok: true }, { t: "模型，在提供者的服务器上" }, { t: "提供者的云端沙箱" }], why: "模型只写出了「请运行这条命令」这段文字。真正运行它的是你电脑上的 pi。" },
    { q: "一次任务里，模型先后发起了 5 个工具调用，每次回复只调用一个工具，最后再回复一段总结。pi 一共向模型发了几次请求？", opts: [{ t: "6 次", ok: true }, { t: "1 次" }, { t: "5 次" }, { t: "2 次：开始一次，结束一次" }], why: "每个工具结果都要再发一次请求，模型才能看到它、决定下一步。5 次工具调用 + 最后的总结 = 6 次请求。如果一次回复里同时调用了好几个工具，它们算同一轮，只需一次请求。" },
    { q: "pi 只开了 read 工具。你在 AGENTS.md 里写「你可以运行测试」。它能运行测试吗？", opts: [{ t: "不能。没有能运行命令的工具", ok: true }, { t: "能。AGENTS.md 允许了" }, { t: "取决于模型够不够聪明" }], why: "AGENTS.md 只是放进请求里的一段文字。能做什么，只取决于开了哪些工具。" },
    { q: "为什么越往后，每次请求越大？", opts: [{ t: "模型不记得上一次请求，pi 每次都要把之前的全部消息重新发一遍", ok: true }, { t: "模型的记忆在增长" }, { t: "系统提示每一轮都变长" }], why: "模型每次只看到这一次请求里的内容。历史越长，请求越大，也越贵。这就是第 2 课「上下文」要讲的问题。" },
    { q: "一次运行在什么时候结束？", opts: [{ t: "模型的某次回复里没有工具调用", ok: true }, { t: "执行满 5 次工具调用" }, { t: "模型在回复里说了「完成」，哪怕后面还跟着工具调用" }], why: "只要回复里有工具调用，pi 就会执行它并再发一次请求。没有工具调用，运行才结束。" },
  ];

  // ================= page =================
  window.Course.register(ID, (page) => {
    page.append(h("div", { class: "col" },
      lessonHead(ID, [
        h("p", null, "你对 pi 说「测试为什么失败？修好它」。几秒后，它读了文件、跑了测试、改好了代码。看上去像是「AI 在操作你的电脑」。"),
        h("p", null, "其实不是。大语言模型（下文简称", term("model", "模型"), "）只会做一件事：读一段文字，再写一段文字。它碰不到你的文件，也运行不了命令。真正去读文件、跑命令、改代码的，是你电脑上运行的 pi 程序。像 pi 这样把模型接上工具、替模型动手的程序，叫 ", term("harness"), "（原意是马具：把马的力气接到车上）。"),
        h("p", null, "这一课把一次任务拆开看：谁做了什么，pi 和模型之间来回了几次。后面每一课讲的上下文、会话、配置、扩展和安全，都建立在这个来回上。"),
      ], [
        "一次任务里，你、pi、模型、工具各做什么。",
        "pi 和模型之间来回几次，什么时候停。",
        "为什么 pi 能做什么只取决于开了哪些工具，与你写的说明无关。",
      ]),

      section("s-roles", 1, "四个角色", "四个角色",
        h("p", null, "一次任务里有四个角色。看图时注意位置：", R("model", "模型"), "在提供者的服务器上（OpenAI、Anthropic 这类公司），", R("tool", "工具"), "在你的电脑上。两者之间只有 ", R("harness", "pi"), " 这一条通道。"),
        rolesFigure(), rolesTable(),
        h("p", { style: { marginTop: "20px" } }, "模型想读一个文件时，它写出来的是这样一段文字："),
        h("pre", null, 'read({"path": "calc.py"})'),
        h("p", null, "这段文字叫", term("toolcall", "工具调用"), "：写明要用哪个工具、参数是什么。pi 认出这段文字，替模型运行 read，再把文件内容交回给模型。模型对你电脑做的每一件事，都是这样「写一段文字，请 pi 代办」。")),

      section("s-req", 2, "请求", "模型每次看到的是什么",
        h("p", null, "pi 每次找模型，都要发一个", term("request", "请求"), "：把模型需要知道的一切打包成一大段文字发过去。模型只看得到这个包，包外的东西它一概不知道。"),
        h("p", null, "一个请求由三部分组成："),
        h("ul", { class: "rule" },
          h("li", null, h("b", null, term("sysprompt", "系统提示")), "：放在最前面的说明，由 pi 拼成，包括它自己的说明、可用工具的清单、你写的 AGENTS.md 等。"),
          h("li", null, h("b", null, "工具定义"), "：每个工具的名字和参数格式，模型照着它写工具调用。"),
          h("li", null, h("b", null, "消息"), "：到目前为止的对话，包括你的消息、模型的回复、工具的结果。")),
        look("下面是一次真实运行的第 1 次请求。点左边每一块，右边显示原文。注意：这里面没有任何一个文件的内容。"),
        request(),
        h("p", { style: { marginTop: "16px" } }, "这次请求大约 2,769 个 ", term("token"), "（模型计量文字的单位，粗略说一个汉字约一个 token）。其中没有 calc.py 的内容：模型还没读过它，所以不知道它写了什么。")),

      section("s-loop", 3, "agent loop", "一次任务，来回好几次",
        h("p", null, "模型一次只能做一步。读完文件，它要看到内容才能决定下一步；跑完测试，它要看到结果才知道修好没有。所以 pi 和模型之间会来回很多次，这个循环叫 agent loop："),
        h("ol", null,
          h("li", null, "pi 发请求。"),
          h("li", null, "模型回复。"),
          h("li", null, "pi 检查回复里有没有工具调用。没有，就结束。"),
          h("li", null, "有，就执行这些工具。"),
          h("li", null, "pi 把工具结果接在消息末尾，回到第 1 步。")),
        h("p", null, "这里有三个词，后面会一直用到："),
        h("ul", { class: "rule" },
          h("li", null, h("b", null, term("turn", "轮")), "：上面 1 到 5 走一遍。每轮正好发一次请求。"),
          h("li", null, h("b", null, term("run", "运行")), "：从你发出一条消息，到某次回复不再有工具调用为止。一次运行可以有很多轮。"),
          h("li", null, h("b", null, term("stop", "停止原因")), "：模型给每次回复标的结束原因。toolUse 表示「我要调用工具」，stop 表示「我说完了」。pi 就是靠它判断要不要继续。")),
        h("p", null, "下面回放一次真实运行。项目里有两个文件：calc.py 里的 add 函数把加法写成了减法；test_calc.py 检查 add(2, 3) 是否等于 5，所以测试失败。你对 pi 说：「测试为什么失败？修好它。」")),
      look("按「下一步」。注意两件事：环一共转了几圈；右栏「下一次请求要发送的内容」怎样越堆越高。")),
      h("div", { class: "bench" }, stepper()),
      h("div", { class: "col" },
        h("p", { style: { marginTop: "20px" } }, "这次运行转了 6 圈：跑测试、读 calc.py、读 test_calc.py、改代码、再跑测试，最后回复总结。每一圈 pi 都把", h("b", null, "之前的全部内容"), "重新发一遍，因为模型不记得上一次请求。"),
        h("p", null, "如果模型在一次回复里同时调用好几个工具（例如同时读两个文件），它们算同一轮，pi 一起执行，再发一次请求。"),

        section("s-cons", 4, "推论", "由这个循环推出的四件事",
          h("h3", null, "1. 能做什么，只看开了哪些工具"),
          h("p", null, "模型能做的事，就是请求里那些工具能做的事。在下面取消勾选某个工具，看哪些任务做不了了："),
          toolsDemo(),
          h("p", null, "AGENTS.md 和第 9 课的 Skill 都只是文字，不会让模型多出任何能力。bash 能运行任意命令，所以只要开着 bash，几乎什么都能做。"),
          h("h3", null, "2. 历史越长，每次请求越大"),
          h("p", null, "模型不记事，pi 每轮都重发全部历史。对话越长，请求越大、越贵、越慢；大到超过模型能接收的上限，就必须删减或压缩历史。第 2 课和第 5 课讲这件事。"),
          h("h3", null, "3. pi 站在每一步中间"),
          h("p", null, "请求由 pi 打包，回复由 pi 解析，工具由 pi 执行。所以在每一步上都可以插手：例如在执行前拦下一条危险命令，或者在发请求前改写内容。pi 把这些位置开放给扩展（第 11 课）。"),
          h("h3", null, "4. 工具用你的权限运行"),
          h("p", null, "pi 执行工具前默认不问你。bash 能做的，就是你在终端里能做的：删文件、推代码、读密钥。而模型可能被文件里的一句话误导。所以边界要由你来划（第 13 课）。")),

        section("s-pi", 5, "在 pi 里", "在 pi 里看到这些",
          h("p", null, "在任意项目目录里运行 pi，问一个需要读文件的问题。屏幕上能直接看到本课讲的东西："),
          howto("界面上的对应", [
            ["工具块", "模型的每个工具调用都显示成一块：工具名、参数，下面是结果。一块就是一次工具调用。"],
            ["Ctrl+O", "展开或收起工具的完整输出。"],
            ["Esc", "中途停下当前这次运行。"],
            ["底部状态栏", "当前目录、模型、上下文占用和累计费用。上下文占用就是下一次请求有多大。"],
            ["/session", "显示这次会话的文件位置、消息数、token 用量和费用。"],
          ])),

        section("s-quiz", 6, "检查", "检查一下",
          h("p", null, "5 道题，都是本课最重要的结论。"),
          quizBlock(ID, QUIZ, null, null)),

        section("s-end", 7, "小结", "小结",
          endBlock(ID, [
            "模型只读文字、写文字。读文件、跑命令、改代码都由 pi 在你的电脑上执行。",
            "模型想做事时，写出一个工具调用；pi 执行它，把结果交回去，再发下一次请求。",
            "每一轮发一次请求，请求里带着全部历史；回复里没有工具调用，运行就结束。",
            "能做什么只看开了哪些工具；工具用你的权限运行，pi 默认不问你。",
          ], { id: "M1", text: "每次请求都带着全部历史，那它会大到什么程度？一个请求里每一块各占多少？" }))));
  });
})();
