/* M0 · Harness 是什么 */
(function () {
  "use strict";
  const { h, $, $$, sleep, reduced, term, Store, choice, copyBlock, section, todo, route } = window.Course;
  const T = window.M0_TRACE;
  const ID = "M0";
  const fmt = (n) => n.toLocaleString("en-US");
  const R = (cls, txt) => h("span", { class: "r r-" + cls }, txt);

  // ===== derived trace facts =====
  const turns = T.turns;
  const toolCallsOf = (t) => t.content.filter((c) => c.type === "toolCall");
  const textOf = (t) => t.content.filter((c) => c.type === "text").map((c) => c.text).join("");
  const ctxTok = (t) => t.usage.input + t.usage.cacheRead;
  const argStr = (a) => JSON.stringify(a);

  // ================= §0 hero =================
  function hero() {
    const t0 = turns[0], call = toolCallsOf(t0)[0], res = t0.results[0];
    const stream = h("div", { class: "stream", "aria-live": "off" });
    const pipeOn = h("div", { class: "pipe" });
    const pipeOff = h("div", { class: "nohar", hidden: true },
      h("p", { style: { margin: 0 } }, "这段文字就停在这里。"),
      h("p", { style: { margin: "6px 0 0" } }, "没有程序读它，没有命令被执行。模型对你的电脑什么也做不了。"));
    const steps = [
      [R("harness", "pi 解析"), "这段文字是一次", term("toolcall"), "。", h("pre", null, `${call.name}(${argStr(call.arguments)})`), "harness"],
      [R("tool", "bash 工具执行"), "pi 在你的电脑上运行这条命令。", h("pre", { class: "err" }, res.text.trim()), "tool"],
      [R("harness", "pi 追加结果"), "结果作为一条消息进入会话。然后 pi 发出下一次", term("request"), "。", null, "harness"],
    ].map(([a, ...rest]) => {
      const role = rest.pop();
      return h("div", { class: "pipe-step", style: { color: `var(--c-${role})` } },
        h("span", { class: "ico" }, ""), h("div", { style: { color: "var(--fg)" } }, h("div", { class: "t1" }, a), h("div", { class: "dim", style: { fontSize: "16px" } }, ...rest)));
    });
    steps.forEach((s, i) => { s.querySelector(".ico").textContent = i + 1; pipeOn.append(s); });

    let run = 0;
    async function play() {
      const my = ++run;
      stream.replaceChildren(); steps.forEach((s) => s.classList.remove("on"));
      const caret = h("span", { class: "caret" });
      stream.append(caret);
      const fast = reduced();
      for (const d of t0.deltas) {
        if (typeof d !== "string") continue;
        if (my !== run) return;
        caret.before(h("span", { class: "tok" }, d));
        if (!fast) await sleep(90);
      }
      await sleep(fast ? 0 : 500);
      caret.remove();
      for (const s of steps) { if (my !== run) return; s.classList.add("on"); await sleep(fast ? 0 : 900); }
    }
    const bOn = h("button", { "aria-pressed": "true" }, "有 harness");
    const bOff = h("button", { "aria-pressed": "false" }, "没有 harness");
    const setMode = (on) => { bOn.setAttribute("aria-pressed", on); bOff.setAttribute("aria-pressed", !on); pipeOn.hidden = !on; pipeOff.hidden = on; };
    bOn.onclick = () => setMode(true); bOff.onclick = () => setMode(false);

    const box = h("div", { class: "panel hero" },
      h("div", { class: "hero-l" },
        h("div", { class: "hero-lbl" }, h("span", null, "模型输出 · 第 1 轮 · 逐个 token"), h("button", { class: "btn ghost", style: { padding: "2px 10px", fontSize: "15px" }, onclick: play }, "重放")),
        stream,
        h("p", { class: "mute", style: { fontSize: "15px", margin: "10px 0 0" } }, "每个底色块是模型流出的一小段文字（一个 toolcall_delta 事件）。共 17 段，拼成一个 JSON 对象。"),
        h("div", { class: "hero-meta" },
          h("span", null, "工具 ", h("b", null, call.name)),
          h("span", null, "停止原因 ", h("b", null, t0.stop)),
          h("span", null, "输出 ", h("b", null, t0.usage.output + " token")),
          h("span", null, "来源 ", h("b", null, "本机 pi 0.99.2 真实记录")))),
      h("div", { class: "hero-r" },
        h("div", { class: "hero-lbl" }, h("span", null, "这段文字之后发生什么"), h("div", { class: "switch", role: "group", "aria-label": "有无 harness" }, bOn, bOff)),
        pipeOn, pipeOff));
    // start when visible
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) { play(); io.disconnect(); } });
    io.observe(box);
    return box;
  }

  // ================= §2 roles =================
  const ROLES = {
    user: { name: "你", color: "user", does: ["写提示，说明目标。", "在运行中插话，或排队下一条消息。", "决定给 pi 哪些工具、哪个模型、哪个目录。", "审查结果。"], not: ["默认不逐条批准工具调用。pi 不问你。"] },
    harness: { name: "pi · harness", color: "harness", does: ["组装每次请求：系统提示、工具定义、会话历史。", "把请求发给提供者，接收流式回复。", "解析回复里的工具调用，然后执行工具。", "把每条消息记入会话文件。", "在终端里显示全过程。"], not: ["不思考。不决定下一步做什么。"] },
    model: { name: "提供者 · 模型", color: "model", does: ["读一次请求。", "生成文字：普通回答，或工具调用。", "决定调用哪个工具、用什么参数。"], not: ["不能读文件，也不能运行命令。", "不记得上一次请求。每次请求都必须带上全部历史。", "看不到请求以外的任何东西。"] },
    tool: { name: "工具", color: "tool", does: ["执行一个具体动作。read 读文件，bash 运行命令，edit 改文件，write 写文件。", "用 pi 进程的权限运行，也就是你的权限。", "把输出交回 pi。"], not: ["不判断这个动作该不该做。"] },
  };
  function roles() {
    const side = h("div", { class: "side does" });
    const show = (k) => {
      const r = ROLES[k];
      $$(".role-node", svg).forEach((n) => n.classList.toggle("sel", n.dataset.k === k));
      side.replaceChildren(h("div", { class: "r r-" + r.color, style: { fontFamily: "var(--f-body)", fontSize: "22px", fontWeight: 900 } }, r.name),
        h("h4", null, "它做什么"), h("ul", null, r.does.map((x) => h("li", null, x))),
        h("h4", null, "它不做什么"), h("ul", null, r.not.map((x) => h("li", null, x))));
    };
    const node = (k, x, y, w, hh, label, sub) => h("svg:g", { class: "role-node", "data-k": k, tabindex: "0", role: "button", "aria-label": label, onclick: () => show(k), onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); show(k); } } },
      h("svg:rect", { x, y, width: w, height: hh, rx: 8, fill: `var(--c-${ROLES[k].color}-bg)`, stroke: `var(--c-${ROLES[k].color})`, "stroke-width": 1.5 }),
      h("svg:text", { x: x + w / 2, y: y + hh / 2 - 2, "text-anchor": "middle", class: "svg-label", fill: `var(--c-${ROLES[k].color})` }, label),
      h("svg:text", { x: x + w / 2, y: y + hh / 2 + 17, "text-anchor": "middle", class: "svg-sub", fill: "var(--fg-mute)" }, sub));
    const arrow = (d, color, label, lx, ly, anchor = "middle") => [
      h("svg:path", { d, fill: "none", stroke: `var(--c-${color})`, "stroke-width": 1.6, class: "flow", "marker-end": `url(#ah-${color})` }),
      h("svg:text", { x: lx, y: ly, "text-anchor": anchor, class: "svg-sub", fill: `var(--c-${color})` }, label)];
    const marker = (c) => h("svg:marker", { id: "ah-" + c, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, h("svg:path", { d: "M0 0L10 5L0 10z", fill: `var(--c-${c})` }));
    const svg = h("svg:svg", { viewBox: "0 0 640 380", role: "img", "aria-label": "四个角色及其之间的数据流" },
      h("svg:defs", null, ["user", "harness", "model", "tool"].map(marker)),
      // machine boundary
      h("svg:rect", { x: 12, y: 12, width: 392, height: 356, rx: 12, fill: "none", stroke: "var(--line-2)", "stroke-dasharray": "4 4" }),
      h("svg:text", { x: 26, y: 34, class: "svg-sub", fill: "var(--fg-mute)" }, "你的电脑"),
      h("svg:rect", { x: 450, y: 12, width: 178, height: 356, rx: 12, fill: "none", stroke: "var(--line-2)", "stroke-dasharray": "4 4" }),
      h("svg:text", { x: 464, y: 34, class: "svg-sub", fill: "var(--fg-mute)" }, "云端"),
      arrow("M120 92 L120 148", "user", "提示", 132, 124, "start"),
      arrow("M228 168 C320 150, 400 130, 470 130", "harness", "请求", 350, 128),
      arrow("M470 196 C400 210, 320 220, 228 206", "model", "回复：文字 + 工具调用", 350, 232),
      arrow("M96 228 L96 278", "harness", "执行", 84, 258, "end"),
      arrow("M148 278 L148 228", "tool", "结果", 160, 258, "start"),
      node("user", 40, 48, 160, 44, "你", "提示 · 插话 · 审查"),
      node("harness", 40, 148, 188, 80, "pi · harness", "组装 · 执行 · 记录"),
      node("model", 470, 108, 140, 110, "模型", "经提供者访问"),
      node("tool", 40, 278, 188, 64, "工具", "read · bash · edit · write"));
    show("harness");
    return h("div", { class: "panel roles" }, h("div", { style: { padding: "16px", minWidth: 0 } }, svg,
      h("p", { class: "mute", style: { fontSize: "15px", margin: "6px 4px 0" } }, "点任一角色，看它做什么、不做什么。")), side);
  }

  // ================= §3 request anatomy =================
  function request() {
    const s = T.system;
    const toolsDef = [
      ["read", "内置", '{ path: string, offset?: number, limit?: number }'],
      ["bash", "内置", '{ command: string, timeout?: number }'],
      ["edit", "内置", '{ path: string, edits: [{ oldText: string, newText: string }] }'],
      ["write", "内置", '{ path: string, content: string }'],
      ["web_search", "扩展 pi-web-access", "…"],
      ["fetch_content", "扩展 pi-web-access", "…"],
      ["get_search_content", "扩展 pi-web-access", "…"],
    ];
    const items = [
      { g: "系统提示", nm: "基础说明", src: "pi 内置", text: s.preamble, why: "告诉模型：你在 pi 里工作，你能读文件、运行命令、改代码。" },
      { g: "系统提示", nm: "工具清单", src: "pi 生成", text: s.tools, why: "列出本次可用的工具。后三个来自你装的扩展 pi-web-access。" },
      { g: "系统提示", nm: "使用规则", src: "pi 内置", text: s.rules, why: "教模型怎样用好这些工具。例如改文件用 edit，不用 sed。" },
      { g: "系统提示", nm: "项目说明 · AGENTS.md", src: "你写的", text: s.project_context, why: "pi 在工作目录里找到 AGENTS.md，把原文放进系统提示。注意：它只是文字。" },
      { g: "系统提示", nm: "pi 文档索引", src: "pi 内置", text: `（${fmt(s.docsLen)} 个字符，此处省略）\n告诉模型：用户问 pi 本身时，去哪里读 pi 的文档。`, len: s.docsLen, why: "只在你问 pi 本身的问题时有用。它每次都在请求里。" },
      { g: "系统提示", nm: "工作目录", src: "pi 生成", text: s.cwd, why: "模型只知道这个路径。它看不到目录里有什么，除非调用工具去看。" },
      { g: "工具定义", nm: "7 个工具的参数格式", src: "内置 + 扩展", text: toolsDef.map(([n, src, p]) => `${n.padEnd(19)} ${src}\n  参数 ${p}`).join("\n\n"), len: 2600, why: "每个工具都附带名字、说明和参数格式（JSON Schema）。模型按这个格式写工具调用。此处参数为简写。" },
      { g: "消息 · 活动分支", nm: "你的提示", src: "你写的", text: T.user, why: "这是本次会话的第一条消息。之后每一轮的回复和工具结果都会追加在它后面。" },
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
    sel(3);
    return h("div", { class: "panel req" }, list, view);
  }

  // ================= §4 loop stepper =================
  const LOOP = [
    { k: "assemble", t: "组装请求", c: "harness", a: -90 },
    { k: "generate", t: "模型生成", c: "model", a: -18 },
    { k: "decide", t: "有工具调用？", c: "harness", a: 54 },
    { k: "execute", t: "执行工具", c: "tool", a: 126 },
    { k: "append", t: "追加结果", c: "harness", a: 198 },
  ];
  function loopSvg() {
    const cx = 140, cy = 150, r = 92;
    const P = (a, rr = r) => [cx + rr * Math.cos((a * Math.PI) / 180), cy + rr * Math.sin((a * Math.PI) / 180)];
    const svg = h("svg:svg", { viewBox: "0 0 280 320", role: "img", "aria-label": "agent loop 示意图" });
    svg.append(h("svg:defs", null, h("svg:marker", { id: "lp-ah", viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto" }, h("svg:path", { d: "M0 0L10 5L0 10z", fill: "var(--line-2)" }))));
    for (let i = 0; i < LOOP.length; i++) {
      const a1 = LOOP[i].a + 17, a2 = LOOP[(i + 1) % LOOP.length].a - 17;
      const [x1, y1] = P(a1), [x2, y2] = P(a2 < a1 ? a2 + 360 : a2);
      svg.append(h("svg:path", { d: `M${x1} ${y1} A${r} ${r} 0 0 1 ${x2} ${y2}`, fill: "none", stroke: "var(--line-2)", "stroke-width": 1.6, "marker-end": "url(#lp-ah)" }));
    }
    // start and exit
    const [ax, ay] = P(-90);
    svg.append(h("svg:path", { d: `M40 26 C70 26, ${ax - 30} ${ay - 34}, ${ax - 20} ${ay - 20}`, fill: "none", stroke: "var(--c-user)", "stroke-width": 1.4, "marker-end": "url(#lp-ah)" }));
    svg.append(h("svg:g", { class: "loop-node", "data-k": "start" }, h("svg:rect", { x: 2, y: 14, width: 70, height: 24, rx: 12, fill: "var(--c-user-bg)", stroke: "var(--c-user)" }), h("svg:text", { x: 37, y: 30, "text-anchor": "middle", class: "svg-sub", fill: "var(--c-user)" }, "你的提示")));
    const [dx, dy] = P(54);
    svg.append(h("svg:path", { d: `M${dx + 18} ${dy + 18} L${222} ${292}`, fill: "none", stroke: "var(--ok)", "stroke-width": 1.4, "stroke-dasharray": "3 3", "marker-end": "url(#lp-ah)" }));
    svg.append(h("svg:text", { x: dx + 30, y: dy + 32, class: "svg-sub", fill: "var(--ok)" }, "否"));
    svg.append(h("svg:text", { x: cx, y: cy + r + 16, "text-anchor": "middle", class: "svg-sub", fill: "var(--c-tool)" }, "是"));
    svg.append(h("svg:g", { class: "loop-node", "data-k": "end" }, h("svg:rect", { x: 200, y: 292, width: 76, height: 24, rx: 12, fill: "var(--ok-bg)", stroke: "var(--ok)" }), h("svg:text", { x: 238, y: 308, "text-anchor": "middle", class: "svg-sub", fill: "var(--ok)" }, "运行结束")));
    LOOP.forEach((n, i) => {
      const [x, y] = P(n.a);
      svg.append(h("svg:g", { class: "loop-node", "data-k": n.k },
        h("svg:circle", { cx: x, cy: y, r: 25, fill: "var(--panel)", stroke: `var(--c-${n.c})`, "stroke-width": 1.6 }),
        h("svg:text", { x, y: y + 4, "text-anchor": "middle", style: { font: "700 12px var(--f-body)" }, fill: `var(--c-${n.c})` }, String(i + 1)),
        h("svg:text", { x, y: y - 32, "text-anchor": "middle", style: { font: "600 12px var(--f-body)" }, fill: "var(--fg-dim)" }, n.t)));
    });
    return svg;
  }

  function buildSteps() {
    const S = [{ k: "start" }];
    turns.forEach((t, i) => {
      S.push({ k: "assemble", i }, { k: "generate", i }, { k: "decide", i });
      if (t.stop === "toolUse") S.push({ k: "execute", i }, { k: "append", i });
      else S.push({ k: "end", i });
    });
    return S;
  }
  const STEP_PREDICT = {
    "assemble:0": { q: "pi 马上发出第一次请求。下面哪一项不在这次请求里？", opts: [{ t: "系统提示，含 AGENTS.md" }, { t: "7 个工具的定义" }, { t: "calc.py 的内容", ok: true }], why: "模型还没读过 calc.py。文件内容只有经工具读取后，才作为工具结果进入上下文。" },
    "decide:0": { q: "这次回复的停止原因是 toolUse。pi 接下来做什么？", opts: [{ t: "显示回复，等你输入" }, { t: "执行 bash 工具", ok: true }, { t: "再请求模型确认一次" }], why: "toolUse 表示回复里有工具调用。pi 立即执行，不问你。" },
    "assemble:1": { q: "第 2 次请求比第 1 次多了什么？", opts: [{ t: "只多了测试的输出" }, { t: "多了模型的工具调用和工具结果", ok: true }, { t: "什么都没多。模型记得上一步" }], why: "模型不记得任何事。pi 每次都重发完整历史。input 从 2,769 涨到 3,140 token。" },
    "execute:3": { q: "edit 工具会做什么？", opts: [{ t: "模型直接改文件" }, { t: "pi 在你的磁盘上把 a - b 换成 a + b", ok: true }, { t: "提供者在服务器上改一份副本" }], why: "模型只写出了参数 oldText 和 newText。真正改磁盘的是 pi 里的 edit 工具。" },
    "decide:5": { q: "这次回复没有工具调用，停止原因是 stop。接下来？", opts: [{ t: "pi 再请求一次，问还要做什么" }, { t: "运行结束，等你的下一条消息", ok: true }, { t: "pi 自动再跑一次测试确认" }], why: "没有工具调用，也没有排队的消息，所以运行结束。" },
    "end:5": { q: "最后一次请求的 input 只有 430 token，但历史更长了。为什么？", opts: [{ t: "pi 压缩了历史" }, { t: "提供者命中提示缓存，2,944 token 记为 cacheRead", ok: true }, { t: "模型忘掉了前面的内容" }], why: "430 + 2,944 = 3,374。上下文仍在增长，只是大部分按缓存计费。" },
  };

  function stepper() {
    const STEPS = buildSteps();
    let pos = 0; // number of steps applied
    let busy = false, auto = false, autoTimer = null;
    const predictOn = () => Store.get(ID, "predictMode", false);
    const answers = () => Store.get(ID, "stepAns", {});

    const svg = loopSvg();
    const narr = h("div", { class: "st-narr" });
    const ctr = (k) => { const v = h("div", { class: "v" }, "0"); return [h("div", { class: "ctr" }, v, h("div", { class: "k" }, k)), v]; };
    const [cTurnEl, cTurn] = ctr("轮");
    const [cReqEl, cReq] = ctr("请求");
    const [cToolEl, cTool] = ctr("工具调用");
    const [cCtxEl, cCtx] = ctr("上下文 token");
    const feed = h("div", { class: "st-feed", "aria-live": "polite" });
    const stack = h("div", { class: "ctx-stack" });
    const chart = h("svg:svg", { class: "spark", viewBox: "0 0 220 86", preserveAspectRatio: "none", role: "img", "aria-label": "每次请求的上下文 token" });
    const chartNote = h("div", { class: "mute", style: { fontSize: "15px", lineHeight: 1.5 } }, "每次请求的上下文（input + cacheRead）。浅色部分是缓存命中。");
    const predBox = h("div", { class: "st-predict", hidden: true });
    const stepLbl = h("span", { class: "score-pill" });
    const scorePill = h("span", { class: "score-pill" });
    const bPrev = h("button", { class: "btn", onclick: () => back() }, "◀ 上一步");
    const bNext = h("button", { class: "btn primary", onclick: () => next() }, "下一步 ", h("span", { class: "k" }, "→"));
    const bAuto = h("button", { class: "btn", onclick: () => toggleAuto() }, "自动播放");
    const bReset = h("button", { class: "btn ghost", onclick: () => rebuild(0) }, "重来");
    const tgl = h("input", { type: "checkbox", id: "m0-predict-mode" });
    tgl.checked = predictOn();
    tgl.addEventListener("change", () => Store.set(ID, "predictMode", tgl.checked));

    function setNode(k) {
      $$(".loop-node", svg).forEach((g) => {
        const on = g.dataset.k === k;
        const c = g.querySelector("circle");
        if (c) { c.setAttribute("fill", on ? c.getAttribute("stroke") : "var(--panel)"); g.querySelectorAll("text")[0].setAttribute("fill", on ? "var(--bg)" : c.getAttribute("stroke")); }
        const r = g.querySelector("rect"); if (r) r.setAttribute("stroke-width", on ? 3 : 1);
      });
    }
    function drawChart(nReq) {
      chart.replaceChildren();
      const max = 3600, bw = 220 / 6 - 6;
      turns.forEach((t, i) => {
        const x = i * (220 / 6) + 3;
        const hIn = (t.usage.input / max) * 70, hC = (t.usage.cacheRead / max) * 70;
        const on = i < nReq;
        chart.append(h("svg:rect", { x, y: 80 - hIn - hC, width: bw, height: hC, fill: "var(--c-ctx)", opacity: on ? 0.35 : 0.08 }));
        chart.append(h("svg:rect", { x, y: 80 - hIn, width: bw, height: hIn, fill: "var(--c-ctx)", opacity: on ? 1 : 0.12 }));
        if (on) chart.append(h("svg:text", { x: x + bw / 2, y: 80 - hIn - hC - 3, "text-anchor": "middle", style: { font: "500 8px var(--f-mono)" }, fill: "var(--fg-dim)" }, (ctxTok(t) / 1000).toFixed(1) + "k"));
      });
      chart.append(h("svg:line", { x1: 0, x2: 220, y1: 80.5, y2: 80.5, stroke: "var(--line-2)" }));
    }
    const blk = (cls, label, right, hgt) => h("div", { class: "ctx-blk " + cls, style: { minHeight: hgt + "px" } }, h("span", null, label), h("span", null, right || ""));

    function entry(cls, head, meta, ...body) {
      if (feed.firstChild && !feed.firstChild.classList.contains("ent")) feed.firstChild.remove();
      const e = h("div", { class: "ent " + cls }, h("div", { class: "ent-h" }, h("span", null, head), h("span", { class: "meta" }, meta || "")), h("div", { class: "ent-b" }, ...body));
      feed.append(e); feed.scrollTop = feed.scrollHeight; return e;
    }
    const NARR = {
      start: () => [h("b", null, "你发送提示。"), " pi 把它作为第一条消息记入会话，然后开始一次", term("run", "运行"), "。"],
      assemble: (i) => [h("b", null, `第 ${i + 1} 轮开始。`), " pi 把系统提示、工具定义和全部历史拼成一次", term("request", "请求"), "，发给提供者。", i ? " 注意：上一轮的内容全部重新发送。" : ""],
      generate: (i) => [h("b", null, "模型流式输出。"), " 它输出的只有文字。", toolCallsOf(turns[i]).length ? " 这次的文字是一次工具调用。" : " 这次是给你的回答。"],
      decide: (i) => turns[i].stop === "toolUse" ? [h("b", null, "停止原因：toolUse。"), " 回复里有工具调用，所以运行继续。"] : [h("b", null, "停止原因：stop。"), " 回复里没有工具调用。"],
      execute: (i) => [h("b", null, "pi 执行工具。"), " 工具在你的电脑上运行，用你的权限。模型此刻什么也不做。", turns[i].results.some((r) => r.isError) ? " 命令退出码不为 0，结果标记为错误。错误也会交给模型。" : ""],
      append: (i) => [h("b", null, "pi 追加结果。"), " 工具结果作为一条消息进入会话。", term("turn", "这一轮"), "结束。下一轮从组装请求开始。"],
      end: () => [h("b", null, "运行结束。"), " 一共 6 轮、6 次请求、5 次工具调用。pi 等你的下一条消息。"],
    };

    async function apply(st, animate) {
      const t = turns[st.i];
      setNode(st.k === "end" ? "end" : st.k);
      narr.replaceChildren(...NARR[st.k](st.i));
      if (st.k === "start") {
        entry("sys", "系统提示", "pi 组装", h("span", { class: "dim" }, "基础说明 · 工具清单 · 规则 · AGENTS.md · 文档索引 · 工作目录"));
        entry("user", "你", "user", T.user);
        stack.append(blk("sys", "系统提示 + 工具定义", "", 64), blk("user", "你的提示", "", 20));
      } else if (st.k === "assemble") {
        cTurn.textContent = st.i + 1; cReq.textContent = st.i + 1; cCtx.textContent = fmt(ctxTok(t));
        drawChart(st.i + 1);
        $$(".ctx-blk", stack).forEach((b) => b.classList.add("sent"));
        if (animate) setTimeout(() => $$(".ctx-blk", stack).forEach((b) => b.classList.remove("sent")), 900);
        else $$(".ctx-blk", stack).forEach((b) => b.classList.remove("sent"));
        entry("sys", `请求 ${st.i + 1} → 提供者`, `input ${fmt(t.usage.input)}${t.usage.cacheRead ? " + cacheRead " + fmt(t.usage.cacheRead) : ""}`, h("span", { class: "dim" }, `发送 ${stack.children.length} 个块：系统提示、工具定义、${stack.children.length - 1} 条消息。`));
      } else if (st.k === "generate") {
        const calls = toolCallsOf(t);
        const body = h("div");
        const e = entry("asst", "模型回复 · 第 " + (st.i + 1) + " 轮", "assistant · 输出 " + t.usage.output + " token", body);
        if (animate && !reduced()) {
          const live = h("div", { class: "live" }); body.append(live);
          for (const d of t.deltas) {
            if (typeof d !== "string") { live.append(h("span", { class: "r r-tool" }, d.start + " ")); continue; }
            live.append(d); feed.scrollTop = feed.scrollHeight; await sleep(calls.length ? 55 : 35);
          }
          await sleep(200);
        }
        body.replaceChildren();
        if (textOf(t)) body.append(h("div", null, textOf(t)));
        calls.forEach((c) => body.append(h("div", { class: "tc" }, h("span", { class: "nm" }, c.name), "(" + argStr(c.arguments) + ")")));
        e.querySelector(".ent-h span").append(h("span", { class: "stop " + (t.stop === "toolUse" ? "tooluse" : "done") }, t.stop));
      } else if (st.k === "decide") {
        // narration only
      } else if (st.k === "execute") {
        t.results.forEach((r) => {
          cTool.textContent = +cTool.textContent + 1;
          entry("tool" + (r.isError ? " err" : ""), "工具结果 · " + r.toolName, r.isError ? "isError: true" : "isError: false", h("pre", null, r.text.trim()));
        });
      } else if (st.k === "append") {
        const c = toolCallsOf(t);
        stack.append(blk("asst", `回复 ${st.i + 1}`, c.map((x) => x.name).join(" "), 18));
        t.results.forEach((r) => stack.append(blk("tool", `结果 ${st.i + 1}`, r.toolName, Math.min(46, 16 + r.text.length / 30))));
      } else if (st.k === "end") {
        stack.append(blk("asst", `回复 ${st.i + 1}`, "文字", 22));
        entry("end", "运行结束", "agent_end", h("span", null, "6 轮 · 6 次请求 · 5 次工具调用 · calc.py 已修好"));
      }
    }

    function renderPred() {
      const st = STEPS[pos];
      const key = st ? st.k + ":" + st.i : null;
      const p = key && STEP_PREDICT[key];
      const done = p && key in answers();
      if (!p || (!predictOn() && !done)) { predBox.hidden = true; predBox.replaceChildren(); bNext.disabled = pos >= STEPS.length; return false; }
      predBox.hidden = false;
      predBox.replaceChildren(choice({
        id: key, store: [ID, "stepAns"], kicker: done ? "你已作答 · 可以重新作答" : "先预测，再继续", q: p.q, opts: p.opts, explain: p.why, cls: "", shuffleSeed: 11 + key.length * 7 + (+key.split(":")[1]) * 13,
        onAnswer: () => { bNext.disabled = false; renderScore(); },
      }));
      bNext.disabled = !done && pos < STEPS.length ? true : pos >= STEPS.length;
      return !done;
    }
    function renderScore() {
      const ev = Store.get(ID, "stepAnsEver", {}); const keys = Object.keys(STEP_PREDICT);
      const a = answers(); const right = keys.filter((k) => ev[k] || STEP_PREDICT[k].opts[a[k]]?.ok).length;
      scorePill.textContent = `预测 ${right} / ${keys.length}`;
      stepLbl.textContent = `步骤 ${pos} / ${STEPS.length}`;
      bPrev.disabled = pos === 0;
    }
    async function next() {
      if (busy || pos >= STEPS.length) return;
      if (bNext.disabled) return;
      busy = true;
      predBox.hidden = true;
      await apply(STEPS[pos], true);
      pos++; busy = false;
      if (pos >= STEPS.length) { Store.set(ID, "stepDone", true); stopAuto(); }
      renderScore();
      const gated = renderPred();
      if (gated) stopAuto();
      if (pos >= STEPS.length) bNext.disabled = true;
    }
    function rebuild(n) {
      stopAuto();
      feed.replaceChildren(); stack.replaceChildren(); cTurn.textContent = cReq.textContent = cTool.textContent = cCtx.textContent = "0";
      feed.append(h("div", { class: "mute", style: { fontSize: "16px", padding: "8px 2px" } }, "会话还是空的。按「下一步」，你的提示会成为第一条消息。"));
      drawChart(0); setNode(null); narr.replaceChildren("按 ", h("kbd", null, "→"), " 或「下一步」开始。这是你本机 pi 0.99.2 的一次真实运行：修好 calc.py 里的一个 bug。");
      pos = 0;
      for (; pos < n; pos++) apply(STEPS[pos], false);
      renderScore(); renderPred();
    }
    function back() { if (!busy && pos > 0) rebuild(pos - 1); }
    function stopAuto() { auto = false; clearTimeout(autoTimer); bAuto.textContent = "自动播放"; }
    function toggleAuto() {
      if (auto) return stopAuto();
      auto = true; bAuto.textContent = "暂停";
      const tick = async () => { if (!auto) return; if (bNext.disabled) return stopAuto(); await next(); if (auto && pos < STEPS.length) autoTimer = setTimeout(tick, 1100); else stopAuto(); };
      tick();
    }

    const root = h("div", { class: "panel stepper", tabindex: "0", "aria-label": "agent loop 单步器。用左右方向键控制。",
      onkeydown: (e) => { if (e.target.tagName === "INPUT") return;
        if (e.key === "ArrowRight" || (e.key === " " && e.target === root)) { e.preventDefault(); next(); }
        else if (e.key === "ArrowLeft") { e.preventDefault(); back(); } } },
      h("div", { class: "st-top" },
        h("div", { class: "st-title" }, "agent loop 单步器 · ", h("span", { class: "u" }, "“" + T.user + "”")),
        h("div", { class: "st-ctrls" }, h("label", { class: "toggle", for: "m0-predict-mode" }, tgl, "预测模式"), scorePill, stepLbl, bReset, bAuto, bPrev, bNext)),
      h("div", { class: "st-grid" },
        h("div", { class: "st-loop" }, svg, h("div", { class: "st-counters" }, cTurnEl, cReqEl, cToolEl, cCtxEl), narr),
        h("div", { style: { display: "flex", flexDirection: "column", minWidth: 0, borderRight: "0" } },
          h("div", { class: "panel-h", style: { borderRadius: 0 } }, h("span", null, "会话记录"), h("span", null, "按发生顺序")), feed, predBox),
        h("div", { class: "st-ctx" }, h("div", { class: "panel-h", style: { padding: "0 0 8px", border: 0 } }, h("span", null, "下一次请求会发送的内容")), stack, chart, chartNote)));
    rebuild(0);
    return root;
  }

  /** All six stepper predictions in one place, for review and retry. */
  function predReview() {
    const body = h("div", { style: { padding: "0 16px 8px" } });
    const det = h("details", { class: "panel", style: { marginTop: "12px" } },
      h("summary", { style: { padding: "12px 16px", cursor: "pointer", fontWeight: 600 } }, "回看单步器里的 6 道预测题"), body);
    det.addEventListener("toggle", () => {
      if (!det.open) return;
      body.replaceChildren(...Object.entries(STEP_PREDICT).map(([key, p], i) =>
        choice({ id: key, store: [ID, "stepAns"], kicker: "预测 " + (i + 1) + " / 6", q: p.q, opts: p.opts, explain: p.why, shuffleSeed: 11 + key.length * 7 + (+key.split(":")[1]) * 13 })));
    });
    return det;
  }

  // ================= §5 counting =================
  function counting() {
    const rows = [
      ["你", "user", "给 README 加上安装说明。"],
      ["模型", "model", "read(README.md) · read(package.json)　停止原因 toolUse"],
      ["工具", "tool", "read 的结果：README.md 的内容"],
      ["工具", "tool", "read 的结果：package.json 的内容"],
      ["模型", "model", "edit(README.md, …)　停止原因 toolUse"],
      ["工具", "tool", "edit 的结果：Successfully replaced 1 block(s)"],
      ["模型", "model", "“已添加安装说明。”　停止原因 stop"],
    ];
    const ans = { turns: 3, calls: 3, reqs: 3 };
    const saved = Store.get(ID, "count", {});
    const inp = (k, label) => { const i = h("input", { type: "number", min: 0, max: 20, id: "m0-count-" + k, inputmode: "numeric", value: saved[k] ?? "" }); return [h("label", { for: "m0-count-" + k }, label, i), i]; };
    const [l1, i1] = inp("turns", "几轮？");
    const [l2, i2] = inp("calls", "几次工具调用？");
    const [l3, i3] = inp("reqs", "pi 向模型发了几次请求？");
    const fb = h("div", { class: "feedback", hidden: true });
    const check = () => {
      const v = { turns: +i1.value, calls: +i2.value, reqs: +i3.value };
      [[i1, "turns"], [i2, "calls"], [i3, "reqs"]].forEach(([el, k]) => { el.classList.toggle("right", v[k] === ans[k]); el.classList.toggle("wrong", v[k] !== ans[k]); });
      const all = v.turns === 3 && v.calls === 3 && v.reqs === 3;
      Store.set(ID, "count", { ...v, ok: all });
      fb.hidden = false;
      fb.replaceChildren(h("span", { class: "verdict " + (all ? "ok" : "no") }, all ? "全对。" : "还没全对。"),
        "数模型回复：第 2、5、7 行，共 3 轮。每轮开始时发一次请求，所以也是 3 次请求。工具调用数第 2 行有 2 个，第 5 行有 1 个，共 3 个。",
        h("br"), h("b", null, "要点："), "一次回复可以包含多个工具调用。它们属于同一轮，只需一次请求。");
    };
    return h("div", { class: "panel" },
      h("div", { class: "panel-h" }, h("span", null, "另一次运行的会话记录（示例）"), h("span", null, "7 条消息")),
      h("div", { class: "mini-tr" }, rows.map(([who, c, what], i) => h("div", { class: "row" }, h("span", { class: "n" }, "#" + (i + 1)), h("span", { class: "who r-" + c }, who), h("span", { class: "what" }, what)))),
      h("div", { class: "count-q", style: { borderTop: "1px solid var(--line)" } }, l1, l2, l3),
      h("div", { style: { padding: "0 16px 16px", display: "flex", gap: "8px" } }, h("button", { class: "btn primary", onclick: check }, "核对"),
        h("button", { class: "btn ghost", onclick: () => { i1.value = ans.turns; i2.value = ans.calls; i3.value = ans.reqs; check(); } }, "直接看答案")), fb);
  }

  // ================= §6 sorter =================
  const CARDS = [
    ["决定先跑测试", "model", "这是一个选择。只有模型做选择。"],
    ["真正运行 python3 test_calc.py", "tool", "bash 工具在你的电脑上运行命令。"],
    ["把 AGENTS.md 的内容放进系统提示", "harness", "组装请求是 pi 的工作。"],
    ["写出 edit 的参数 oldText 与 newText", "model", "模型生成工具调用的全部文字，包括参数。"],
    ["把 a - b 换成 a + b 并写回磁盘", "tool", "edit 工具执行修改。模型碰不到磁盘。"],
    ["判断回复里有没有工具调用", "harness", "pi 解析回复，根据停止原因决定下一步。"],
    ["把工具结果写进会话的 JSONL 文件", "harness", "记录会话是 pi 的工作。"],
    ["决定这次运行能用哪些工具", "user", "你用 --tools、设置或扩展决定。模型只能用请求里给它的工具。"],
    ["选择用哪个模型", "user", "你用 /model 或 --model 选择。"],
    ["记住上一轮读过 calc.py", "harness", "模型不记事。是 pi 把历史重新放进每次请求。"],
  ];
  const BINS = [["user", "你", "人"], ["harness", "pi", "harness"], ["model", "模型", "经提供者"], ["tool", "工具", "在你的电脑上"]];
  function sorter() {
    const saved = Store.get(ID, "sort", {});
    const place = { ...(saved.place || {}) };
    let selected = null, checked = !!saved.checked;
    const pool = h("div", { class: "pool", "aria-label": "待分类的卡片" });
    const bins = {};
    const binEls = BINS.map(([k, name, sub]) => {
      const body = h("div", { style: { display: "flex", flexDirection: "column", gap: "8px" } });
      const el = h("div", { class: "bin", "data-k": k,
        ondragover: (e) => { e.preventDefault(); el.classList.add("over"); }, ondragleave: () => el.classList.remove("over"),
        ondrop: (e) => { e.preventDefault(); el.classList.remove("over"); const i = e.dataTransfer.getData("text/plain"); if (i !== "") put(+i, k); },
        onclick: (e) => { if (selected != null && !e.target.closest(".card")) put(selected, k); } },
        h("button", { class: "bin-h", onclick: () => selected != null && put(selected, k) }, h("span", { class: "r r-" + k }, name), h("span", { class: "sub" }, sub)), body);
      bins[k] = body; return el;
    });
    const fb = h("div", { class: "feedback", hidden: true });
    const bCheck = h("button", { class: "btn primary", onclick: () => { checked = true; save(); render(); } }, "核对");
    const bReset = h("button", { class: "btn ghost", onclick: () => { for (const k in place) delete place[k]; checked = false; save(); render(); } }, "清空重来");
    function save() { Store.set(ID, "sort", { place: { ...place }, checked, ok: CARDS.every((c, i) => place[i] === c[1]) }); }
    function put(i, k) { place[i] = k; selected = null; checked = false; save(); render(); }
    function render() {
      pool.replaceChildren(); Object.values(bins).forEach((b) => b.replaceChildren());
      CARDS.forEach(([txt, right, why], i) => {
        const where = place[i];
        const c = h("button", { class: "card", draggable: "true", "aria-pressed": selected === i ? "true" : "false",
          ondragstart: (e) => e.dataTransfer.setData("text/plain", String(i)),
          onclick: (e) => { e.stopPropagation(); selected = selected === i ? null : i; render(); } }, txt);
        if (checked && where) c.classList.add(where === right ? "right" : "wrong");
        if (where) { bins[where].append(c); if (checked && where !== right) bins[where].append(h("div", { class: "sort-expl" }, "→ 应归「" + BINS.find((b) => b[0] === right)[1] + "」。" + why)); }
        else pool.append(c);
      });
      if (!pool.children.length) pool.append(h("span", { class: "mute", style: { fontSize: "16px" } }, "全部放好了。点「核对」。"));
      binEls.forEach((b) => b.classList.toggle("target", selected != null));
      const placed = Object.keys(place).length, right = CARDS.filter((c, i) => place[i] === c[1]).length;
      bCheck.disabled = placed < CARDS.length;
      fb.hidden = !checked;
      if (checked) fb.replaceChildren(h("span", { class: "verdict " + (right === CARDS.length ? "ok" : "no") }, `${right} / ${CARDS.length}`),
        right === CARDS.length ? "全对。规律：做选择的是模型；动手的是工具；组装、解析、记录的是 pi；定边界的是你。" : "红框的卡片下面有解释。把它们拖到正确的列，再核对一次。");
    }
    render();
    return h("div", { class: "panel sorter" },
      h("div", { class: "panel-h" }, h("span", null, "点一张卡片，再点一列。也可以直接拖。"), h("span", null, "10 张")),
      pool, h("div", { class: "bins" }, binEls),
      h("div", { style: { padding: "12px 16px", borderTop: "1px solid var(--line)", display: "flex", gap: "8px" } }, bCheck,
        h("button", { class: "btn ghost", onclick: () => { CARDS.forEach((c, i) => { place[i] = c[1]; }); checked = true; save(); render(); } }, "显示答案"), bReset), fb);
  }

  // ================= §7 consequences =================
  function consequences() {
    // 1. ability = tools
    const TOOLS = ["read", "bash", "edit", "write"];
    const TASKS = [
      ["读 calc.py", ["read", "bash"]],
      ["运行测试", ["bash"]],
      ["修改 calc.py", ["edit", "write", "bash"]],
      ["新建一个文件", ["write", "bash"]],
      ["用 curl 下载网页", ["bash"]],
    ];
    const on = new Set(TOOLS);
    const tl = h("ul", { class: "tasks" });
    const paint = () => tl.replaceChildren(...TASKS.map(([t, need]) => { const ok = need.some((x) => on.has(x)); return h("li", { class: ok ? "can" : "cannot" }, h("span", { class: "mk" }, ok ? "✓" : "✗"), t, h("span", { class: "mute mono", style: { fontSize: "15px" } }, "  需要 " + need.join(" 或 "))); }));
    const box = h("div", { class: "toolbox" }, TOOLS.map((t) => { const i = h("input", { type: "checkbox", id: "m0-tool-" + t, checked: true, onchange: () => { i.checked ? on.add(t) : on.delete(t); paint(); } }); return h("label", { for: "m0-tool-" + t }, i, t); }));
    paint();
    // 2. no memory chart
    const W = 300, H = 90;
    const mem = h("svg:svg", { viewBox: `0 0 ${W} ${H + 20}`, style: { width: "100%", height: "auto", display: "block", margin: "6px 0 8px" }, role: "img", "aria-label": "6 次请求的上下文 token" });
    turns.forEach((t, i) => {
      const bw = W / 6 - 10, x = i * (W / 6) + 5, v = ctxTok(t), hh = (v / 3600) * H;
      mem.append(h("svg:rect", { x, y: H - hh, width: bw, height: hh, rx: 2, fill: "var(--c-ctx)", opacity: 0.85 }));
      mem.append(h("svg:text", { x: x + bw / 2, y: H - hh - 4, "text-anchor": "middle", style: { font: "500 10px var(--f-mono)" }, fill: "var(--fg-dim)" }, fmt(v)));
      mem.append(h("svg:text", { x: x + bw / 2, y: H + 14, "text-anchor": "middle", style: { font: "500 10px var(--f-mono)" }, fill: "var(--fg-mute)" }, "请求 " + (i + 1)));
    });
    const seams = ["input", "before_agent_start", "context", "tool_call", "tool_result", "turn_end", "agent_end"];
    return h("div", { class: "cons" },
      h("div", { class: "panel con" }, h("div", { class: "n" }, "推论 1"), h("h4", null, "能力 = 工具"),
        h("p", null, "模型能做的事，等于请求里给它的工具能做的事。关掉一个工具，看哪些任务变得不可能。"), box, tl,
        h("p", { style: { marginTop: "10px" } }, term("agentsmd"), " 和 Skill 只是文字。它们不改变这张表。注意 bash：有它，几乎什么都能做。"),
        h("div", { class: "next" }, "→ M7 指令层 · M8 Skill · M12 安全边界")),
      h("div", { class: "panel con" }, h("div", { class: "n" }, "推论 2"), h("h4", null, "模型没有记忆，所以上下文只增不减"),
        h("p", null, "每次请求都带上全部历史。本课那次运行，上下文逐次增长："), mem,
        h("p", null, "历史越长，每次请求越贵、越慢。到了模型的上限，pi 必须压缩。"),
        h("div", { class: "next" }, "→ M1 上下文是预算 · M4 压缩")),
      h("div", { class: "panel con" }, h("div", { class: "n" }, "推论 3"), h("h4", null, "pi 坐在环路的每个接缝上"),
        h("p", null, "每个箭头都经过 pi。所以 pi 可以在这些点读取、修改或拦截。pi 把这些点开放给扩展，叫作事件："),
        h("div", { class: "toolbox" }, seams.map((s) => h("code", null, s))),
        h("p", null, "例如：在 tool_call 拦下危险命令；在 context 改写发给模型的历史。"),
        h("div", { class: "next" }, "→ M10 扩展 II：事件与状态")),
      h("div", { class: "panel con" }, h("div", { class: "n" }, "推论 4"), h("h4", null, "工具用你的权限运行"),
        h("p", null, "pi 不逐条问你。bash 能做的，就是你在终端里能做的：删文件、推代码、读密钥。"),
        h("p", null, "模型可能被文件里的文字误导。所以边界必须由你来划，而且要划在模型够不着的地方。"),
        h("div", { class: "next" }, "→ M12 安全边界")));
  }

  // ================= §8 lab =================
  const LAB_SETUP = `mkdir -p ~/pi-lab/m0 && cd ~/pi-lab/m0
printf 'def add(a, b):\\n    return a - b\\n' > calc.py
printf 'from calc import add\\n\\nassert add(2, 3) == 5, f"add(2, 3) 应为 5，实际为 {add(2, 3)}"\\nprint("全部通过")\\n' > test_calc.py
printf -- '- 运行测试用 \`python3 test_calc.py\`。\\n' > AGENTS.md
python3 test_calc.py`;
  const LAB_RUN = `pi --mode json --no-session "测试为什么失败？修好它。" > run.jsonl`;
  const LAB_JQ = `jq -c 'select(.type=="turn_end") | {tools: [.message.content[] | select(.type=="toolCall") | .name], stop: .message.stopReason, input: .message.usage.input, cache: .message.usage.cacheRead}' run.jsonl`;
  const LAB_SAMPLE = turns.map((t) => JSON.stringify({ tools: toolCallsOf(t).map((c) => c.name), stop: t.stop, input: t.usage.input, cache: t.usage.cacheRead })).join("\n");

  function parseLab(txt) {
    const rows = [];
    for (const line of txt.split(/\r?\n/)) {
      const s = line.trim(); if (!s) continue;
      try { const o = JSON.parse(s); if (o && Array.isArray(o.tools) && typeof o.stop === "string") rows.push(o); else return { err: "有一行不是预期的格式：" + s.slice(0, 80) }; }
      catch (e) { return { err: "有一行不是 JSON：" + s.slice(0, 80) }; }
    }
    if (!rows.length) return { err: "没有读到任何一行。请粘贴第 3 步命令的完整输出。" };
    return { rows };
  }
  function lab() {
    const saved = Store.get(ID, "lab", {});
    const ta = h("textarea", { class: "paste", id: "m0-lab-paste", spellcheck: "false", placeholder: '{"tools":["bash"],"stop":"toolUse","input":2769,"cache":0}\n…' });
    ta.value = saved.raw || "";
    ta.addEventListener("input", () => { delete ta.dataset.sample; });
    const out = h("div");
    const verify = (isSample) => {
      if (!isSample && ta.dataset.sample === "1") isSample = true;
      const txt = isSample ? LAB_SAMPLE : ta.value;
      if (isSample) { ta.value = LAB_SAMPLE; ta.dataset.sample = "1"; }
      const p = parseLab(txt);
      if (p.err) { out.replaceChildren(h("div", { class: "note warn" }, h("span", { class: "k" }, "无法读取"), p.err)); return; }
      const R2 = p.rows, last = R2[R2.length - 1];
      const ctx = R2.map((r) => (r.input || 0) + (r.cache || 0));
      const checks = [
        [R2.length >= 2, `至少 2 轮（你的运行：${R2.length} 轮）`],
        [last.stop === "stop" && last.tools.length === 0, "最后一轮没有工具调用，停止原因为 stop"],
        [R2.slice(0, -1).every((r) => r.stop === "toolUse" && r.tools.length > 0), "其余每一轮都有工具调用，停止原因为 toolUse"],
        [ctx.every((v, i) => i === 0 || v >= ctx[i - 1]), "上下文（input + cache）逐次不减"],
      ];
      const nCalls = R2.reduce((a, r) => a + r.tools.length, 0);
      const allOk = checks.every((c) => c[0]);
      const qs = h("div", { class: "count-q", style: { padding: "12px 0" } });
      const mk = (k, label, right) => { const i = h("input", { type: "number", min: 0, id: "m0-lab-" + k }); qs.append(h("label", { for: "m0-lab-" + k }, label, i)); return [i, right]; };
      const fields = [mk("t", "你的运行有几轮？", R2.length), mk("c", "几次工具调用？", nCalls), mk("r", "几次请求？", R2.length)];
      const fb2 = h("div", { class: "feedback", style: { padding: 0 }, hidden: true });
      const max = Math.max(...ctx) || 1;
      out.replaceChildren(
        h("ul", { class: "check-list" }, checks.map(([ok, t]) => h("li", null, h("span", { class: ok ? "ok" : "no" }, ok ? "✓" : "✗"), t))),
        h("div", { class: "lab-data", "aria-label": "每次请求的上下文 token" }, ctx.map((v, i) => h("div", { class: "lab-bar", style: { height: (v / max) * 100 + "%" }, title: R2[i].tools.join(",") || "回答" }, h("span", null, fmt(v))))),
        allOk ? h("div", null, h("p", { style: { marginTop: "8px" } }, "现在用你自己的数据回答："), qs,
          h("button", { class: "btn primary", onclick: () => {
            const good = fields.every(([i, r]) => +i.value === r);
            fields.forEach(([i, r]) => { i.classList.toggle("right", +i.value === r); i.classList.toggle("wrong", +i.value !== r); });
            fb2.hidden = false;
            if (good && !isSample) { Store.set(ID, "lab", { raw: ta.value, passed: true, turns: R2.length, calls: nCalls }); fb2.replaceChildren(h("span", { class: "verdict ok" }, "实验通过。"), "你亲手验证了 agent loop：每轮一次请求，有工具调用就继续，没有就结束。"); checkDone(); }
            else if (good) fb2.replaceChildren(h("span", { class: "verdict ok" }, "答对了。"), "这是示例数据，不计入实验。请用你自己的运行再做一次。");
            else fb2.replaceChildren(h("span", { class: "verdict no" }, "再数一次。"), "轮数 = 行数。请求数 = 轮数。工具调用数 = 每行 tools 里的名字个数之和。");
          } }, "核对答案"), fb2)
          : h("div", { class: "note warn" }, h("span", { class: "k" }, "没有通过"), "检查是否完整粘贴了输出。如果 pi 中途出错，重跑第 2 步。"));
    };
    if (saved.raw) setTimeout(() => verify(false), 0);
    return h("div", { class: "lab-steps" },
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "建一个练习目录，放进同一个 bug。"), h("p", { class: "dim", style: { margin: "4px 0 0" } }, "最后一行会运行测试。你应该看到 AssertionError。"), copyBlock(LAB_SETUP))),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "用 JSON 模式运行 pi。"), h("p", { class: "dim", style: { margin: "4px 0 0" } }, h("code", null, "--mode json"), " 把每个事件写成一行 JSON。", h("code", null, "--no-session"), " 不保存会话。这会消耗一次很小的模型调用。"), copyBlock(LAB_RUN))),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "提取每一轮的摘要。"), h("p", { class: "dim", style: { margin: "4px 0 0" } }, "每个 turn_end 事件输出一行：本轮的工具调用、停止原因、input 和 cacheRead。没有 jq 就先运行 ", h("code", null, "nix shell nixpkgs#jq"), "。"), copyBlock(LAB_JQ))),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "粘贴输出，核对。"), h("div", { style: { marginTop: "8px" } }, ta),
        h("div", { style: { display: "flex", gap: "8px", marginTop: "8px" } }, h("button", { class: "btn primary", onclick: () => verify(false) }, "核对我的运行"), h("button", { class: "btn ghost", onclick: () => verify(true) }, "先用示例数据试试")),
        out)),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "清理。"), h("p", { class: "dim", style: { margin: "4px 0 0" } }, "核对通过后，删除本实验目录。因为用了 --no-session，pi 没有在 ~/.pi 里留下会话文件。"), copyBlock("rm -r ~/pi-lab/m0 && rmdir --ignore-fail-on-non-empty ~/pi-lab"))));
  }

  // ================= §9 quiz =================
  const QUIZ = [
    { q: "下面哪一句是「轮（turn）」的准确定义？", opts: [{ t: "一次模型回复，加上它引发的全部工具调用和工具结果", ok: true }, { t: "你发出一条消息到 pi 停下来的全过程" }, { t: "一次工具调用及其结果" }, { t: "一次会话" }], why: "你发消息到停下来是一次运行。一次运行包含一轮或多轮。" },
    { q: "一次模型回复里有 2 个工具调用。处理这次回复，pi 向模型发了几次请求？", opts: [{ t: "1 次", ok: true }, { t: "2 次" }, { t: "3 次" }], why: "这次回复本身来自 1 次请求。2 个工具调用属于同一轮。它们的结果会一起进入下一次请求。" },
    { q: "pi 运行 bash 命令 rm build/*。谁执行了删除？", opts: [{ t: "pi 进程，在你的电脑上，用你的权限", ok: true }, { t: "模型，在提供者的服务器上" }, { t: "提供者的沙箱" }], why: "模型只写出命令文字。执行的是 pi 里的 bash 工具。" },
    { q: "回复的停止原因是 toolUse。这意味着：", opts: [{ t: "回复里有工具调用。pi 会执行它们，然后再请求一次", ok: true }, { t: "模型在等你批准工具调用" }, { t: "运行出错，需要重试" }], why: "toolUse 是模型交给 pi 的信号：回复里有工具调用，请执行。模型写完这次回复就结束了，它不会「等」。要不要先问你，是 harness 的规则：pi 默认不问，直接执行，再发下一次请求。即使某个 harness 设置成先问你，等你批准的也是 harness，不是模型。" },
    { q: "为什么第 5 次请求的上下文比第 1 次大？", opts: [{ t: "pi 把之前所有回复和工具结果都放进了请求", ok: true }, { t: "模型的记忆在增长" }, { t: "系统提示每轮变长" }], why: "模型没有记忆。历史由 pi 每次重新发送。" },
    { q: "pi 用 --tools read 启动，只有 read 工具。AGENTS.md 写着「可以修改文件」。pi 能改文件吗？", opts: [{ t: "不能。没有能写文件的工具", ok: true }, { t: "能。AGENTS.md 授权了它" }, { t: "看模型是否足够聪明" }], why: "AGENTS.md 只是文字。能力只来自工具。" },
    { q: "calc.py 的内容什么时候第一次进入上下文？", opts: [{ t: "read 的工具结果追加之后，下一次请求里", ok: true }, { t: "pi 启动时自动读入工作目录的全部文件" }, { t: "模型推理时直接访问磁盘" }], why: "pi 只自动放入 AGENTS.md 这类上下文文件。其他文件要靠工具读取。" },
    { q: "一次运行在什么时候结束？", opts: [{ t: "某次回复没有工具调用，而且没有排队的消息", ok: true }, { t: "执行完 5 次工具调用后" }, { t: "模型说「完成」时，不论有没有工具调用" }], why: "只要回复里有工具调用，pi 就会继续。" },
    { q: "哪一项最准确地描述 harness 的职责？", opts: [{ t: "组装请求、调用模型、执行工具、记录会话", ok: true }, { t: "训练模型，让它更懂代码" }, { t: "决定任务的下一步" }], why: "决定下一步的是模型。harness 负责把这个决定变成动作，并记录下来。" },
    { q: "某次请求 input = 430、cacheRead = 2,944。模型实际看到多少 token 的上下文？", opts: [{ t: "3,374", ok: true }, { t: "430" }, { t: "2,944" }], why: "缓存只改变计费和速度，不改变模型看到的内容。" },
  ];
  function quiz() {
    const box = h("div", { class: "panel" });
    const saved = Store.get(ID, "quiz", { best: 0, attempts: 0 });
    let picks = {};
    let seed = (saved.attempts || 0) + 7;
    const head = h("div", { class: "quiz-head" });
    const list = h("div");
    const submit = h("button", { class: "btn primary", disabled: true }, "交卷");
    const paintHead = (score) => {
      const s = Store.get(ID, "quiz", { best: 0, attempts: 0 });
      head.replaceChildren(h("div", null, h("div", { style: { fontWeight: 600 } }, "10 题 · 8 题及以上过关"), h("div", { class: "mute", style: { fontSize: "15px" } }, `已作答 ${Object.keys(picks).length} / 10 · 历史最好 ${s.best} / 10 · 第 ${s.attempts + 1} 次`)),
        score != null ? h("div", { class: "quiz-score " + (score >= 8 ? "pass" : "fail") }, score + " / 10") : h("div", { style: { width: "160px" } }, h("div", { class: "meter" }, h("i", { style: { width: Object.keys(picks).length * 10 + "%" } }))));
    };
    function render() {
      list.replaceChildren(); picks = {};
      QUIZ.forEach((q, qi) => {
        const order = window.Course.shuffle(q.opts.map((_, i) => i), seed * 31 + qi);
        const fb = h("div", { class: "feedback", hidden: true });
        const btns = order.map((oi, k) => h("button", { class: "opt", "data-i": oi, "aria-pressed": "false", onclick: () => {
          picks[qi] = oi; btns.forEach((b) => b.setAttribute("aria-pressed", +b.dataset.i === oi)); submit.disabled = Object.keys(picks).length < QUIZ.length; paintHead(); } },
          h("span", { class: "l" }, "ABCD"[k]), h("span", null, q.opts[oi].t)));
        list.append(h("div", { class: "quiz-q predict", style: { margin: 0 } }, h("div", { class: "q" }, h("span", { class: "k", style: { color: "var(--fg-mute)" } }, "第 " + (qi + 1) + " 题"), q.q), h("div", { class: "opts" }, btns), fb));
        list.lastChild._grade = () => { btns.forEach((b) => { const i = +b.dataset.i; b.disabled = true; if (q.opts[i].ok) b.classList.add("right"); else if (i === picks[qi]) b.classList.add("wrong"); });
          const ok = q.opts[picks[qi]]?.ok; fb.hidden = false; fb.replaceChildren(h("span", { class: "verdict " + (ok ? "ok" : "no") }, ok ? "对。" : "不对。"), q.why); return !!ok; };
      });
      submit.disabled = true; submit.textContent = "交卷"; submit.onclick = grade;
      paintHead();
    }
    function grade() {
      let score = 0; [...list.children].forEach((c) => { if (c._grade()) score++; });
      const s = Store.get(ID, "quiz", { best: 0, attempts: 0 });
      Store.set(ID, "quiz", { best: Math.max(s.best, score), attempts: s.attempts + 1, last: score });
      paintHead(score);
      submit.disabled = false; submit.textContent = "换个顺序再做一次"; submit.onclick = () => { seed++; render(); box.scrollIntoView({ behavior: reduced() ? "auto" : "smooth" }); };
      checkDone();
      head.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "center" });
    }
    render();
    box.append(head, list, h("div", { style: { padding: "14px 18px", borderTop: "1px solid var(--line)" } }, submit));
    return box;
  }

  // ================= §1 pretest & §10 recap =================
  const PRE = [
    { id: "p1", q: "pi 在你的电脑上运行 python3 test_calc.py。是谁在执行这条命令？", opts: [{ t: "模型，在提供者的服务器上" }, { t: "pi 进程，在你的电脑上", ok: true }, { t: "提供者的云端沙箱" }] },
    { id: "p2", q: "你发了一句话，pi 修好了一个 bug，中间调用了 5 次工具。pi 一共向模型发了几次请求？", opts: [{ t: "1 次" }, { t: "2 次：开始一次，结束一次" }, { t: "6 次", ok: true }] },
    { id: "p3", q: "pi 只开了 read 工具。你在 AGENTS.md 写「可以运行测试」。它能运行测试吗？", opts: [{ t: "能" }, { t: "不能", ok: true }, { t: "取决于模型够不够聪明" }] },
  ];
  function pretest() {
    return h("div", null, PRE.map((p, i) => choice({ id: p.id, store: [ID, "pre"], kicker: "预测 " + (i + 1) + " / 3", q: p.q, opts: p.opts, reveal: false, shuffleSeed: 5 + i * 17 })));
  }
  function recap() {
    const box = h("div");
    const paint = () => {
      const pre = Store.get(ID, "pre", {});
      const sa = Store.get(ID, "stepAns", {});
      const preRight = PRE.filter((p) => p.opts[pre[p.id]]?.ok).length;
      const sev = Store.get(ID, "stepAnsEver", {});
      const stRight = Object.keys(STEP_PREDICT).filter((k) => sev[k] || STEP_PREDICT[k].opts[sa[k]]?.ok).length;
      const qz = Store.get(ID, "quiz", { best: 0 });
      const lb = Store.get(ID, "lab", {});
      box.replaceChildren(
        h("h3", null, "回看你的预测"),
        h("div", { class: "panel" }, PRE.map((p) => {
          const a = pre[p.id], ok = p.opts[a]?.ok;
          return h("div", { class: "mini-tr" }, h("div", { class: "row", style: { gridTemplateColumns: "28px minmax(0,1fr)" } },
            h("span", { class: a == null ? "mute" : ok ? "r-harness" : "r-ctx", style: { fontWeight: 700 } }, a == null ? "—" : ok ? "✓" : "✗"),
            h("span", null, h("span", { style: { fontFamily: "var(--f-body)", color: "var(--fg)" } }, p.q), h("br"),
              h("span", { class: "mute" }, a == null ? "你没有预测。" : "你的预测：" + p.opts[a].t + "。"), " ", h("span", { class: "r-harness" }, "答案：" + p.opts.find((o) => o.ok).t + "。"))));
        })),
        h("div", { class: "recap-grid" },
          h("div", { class: "panel recap-cell" }, h("div", { class: "k" }, "课前预测"), h("div", { class: "v" }, preRight + " / 3")),
          h("div", { class: "panel recap-cell" }, h("div", { class: "k" }, "单步器预测"), h("div", { class: "v" }, stRight + " / " + Object.keys(STEP_PREDICT).length)),
          h("div", { class: "panel recap-cell" }, h("div", { class: "k" }, "测验最好成绩"), h("div", { class: "v", style: { color: qz.best >= 8 ? "var(--ok)" : "var(--fg)" } }, qz.best + " / 10"))),
        h("div", { class: "panel", style: { marginTop: "12px", padding: "14px 18px" } },
          h("div", { style: { fontWeight: 600, marginBottom: "6px" } }, "本课练习情况（仅供参考，不决定是否完成）"),
          h("ul", { class: "check-list", style: { margin: 0 } },
            h("li", null, h("span", { class: lb.passed ? "ok" : "no" }, lb.passed ? "✓" : "○"), "§8 实验"),
            h("li", null, h("span", { class: qz.best >= 8 ? "ok" : "no" }, qz.best >= 8 ? "✓" : "○"), "§9 测验 8 题及以上")),
          window.Course.completeButton(ID)),
        h("div", { class: "panel next-card" },
          h("div", null, h("div", { class: "mid" }, "下一课 · M1"), h("div", { style: { font: "700 22px var(--f-body)", margin: "4px 0" } }, "上下文是预算"),
            h("div", { class: "dim", style: { fontSize: "16px" } }, "你已经看到上下文每轮增长。M1 回答：增长到哪里会出事？请求里每一块各占多少？pi 何时自动压缩？")),
          h("button", { class: "btn lg outline", onclick: () => { location.hash = "M1"; } }, "前往 M1", h("span", { class: "arr", "aria-hidden": "true" }, "→"))));
    };
    paint();
    Store.listeners.add(paint);
    box._cleanup = () => Store.listeners.delete(paint);
    return box;
  }
  function checkDone() {
    const ok = Store.get(ID, "lab", {}).passed && Store.get(ID, "quiz", { best: 0 }).best >= 8;
    if (ok && !Store.get(ID, "done")) Store.set(ID, "done", true);
  }

  // ================= page =================
  window.Course.register(ID, (page) => {
    const rc = recap();
    page.append(
      h("div", { class: "bench" },
        h("header", { class: "mhead" },
          h("div", { class: "crumbs" }, "第 1 单元 · 心智模型 / M0"),
          h("h1", { class: "mtitle" }, h("span", { class: "mid" }, "M0"), "Harness 是什么")),
        section("s-hero", 0, "开场", null, hero(),
          h("div", { class: "col" },
            h("p", { class: "thesis" }, "模型只输出文字。", h("br"), "把文字变成动作的，是 harness。"),
            h("p", { class: "lead" }, "上面那段橙色文字，是你本机的 pi 在修 bug 时，模型输出的第一段内容。它被拆成一个个 ", term("token"), " 流过来。拼起来，是一个 JSON 对象。"),
            h("p", null, "模型不知道你的电脑在哪里。它只是写下：「请运行这条命令」。读懂这句话、真的去运行、再把结果交回模型的，是 pi。pi 就是一个 ", term("harness"), "。")),
          h("div", { class: "panel objectives" },
            h("ol", null,
              h("li", null, "说出模型唯一的输出是什么。"),
              h("li", null, "画出 agent loop 的五个步骤，并说出它何时结束。"),
              h("li", null, "在一段会话记录里数出轮、请求和工具调用。"),
              h("li", null, "把一次运行中的每个动作归到你、pi、模型或工具。"),
              h("li", null, "由 loop 推出四个结论：能力、记忆、接缝、权限。")),
            h("div", { class: "obj-side" },
              h("div", null, h("span", { class: "k" }, "学完你能"), "上面 5 项"),
              h("div", null, h("span", { class: "k" }, "时长"), "约 50 分钟"),
              h("div", null, h("span", { class: "k" }, "前置"), "无"),
              h("div", null, h("span", { class: "k" }, "练习"), "§8 实验 + §9 测验（≥ 8/10）"),
              h("div", null, h("span", { class: "k" }, "核对版本"), "pi 0.99.2"))),
          h("h3", null, "本课路线"),
          h("p", { class: "dim", style: { margin: 0 } }, "从上往下做。橙色是要你动手的节，蓝色是考核。点任一格跳过去。"),
          route(ID, [["s-pre", 1, "动手", "先预测"], ["s-roles", 2, "动手", "四个角色"], ["s-req", 3, "动手", "请求解剖"], ["s-loop", 4, "动手", "单步走 loop"], ["s-count", 5, "动手", "数一数"], ["s-sort", 6, "动手", "谁做的"], ["s-cons", 7, "动手", "四个推论"], ["s-lab", 8, "实验", "本机验证"], ["s-quiz", 9, "测验", "10 题"], ["s-recap", 10, "阅读", "小结"]])),
        h("div", { class: "col" },
          section("s-pre", 1, "先预测", "先猜，再学",
            todo("三题各选一个答案。现在不判对错。"),
            h("p", null, "下面三题现在不判对错。凭直觉选。课末你会看到自己猜得怎样。猜错的地方，就是本课要改的地方。"),
            pretest()),
          section("s-roles", 2, "四个角色", "一次运行里有四个角色",
            todo("点图里的四个方框，读右边「它做什么 / 它不做什么」。"),
            h("p", null, "每个角色只做自己的事。分清它们，后面所有内容都会变简单。"))),
        roles(),
        h("div", { class: "col" },
          h("p", { style: { marginTop: "24px" } }, "注意两条虚线框。", R("model", "模型"), "在云端，", R("tool", "工具"), "在你的电脑上。两者之间只有 ", R("harness", "pi"), " 一条通道。模型要碰你的电脑，只能写一段文字，请 pi 代办。"),
          section("s-req", 3, "请求解剖", "模型到底看到了什么",
            todo("点左边每一块，看右边的原文。找到你写的那两块（天蓝色条）。"),
            h("p", null, "每轮开始，pi 组装一次", term("request"), "。下面是那次运行的第 1 次请求，取自本机真实记录。左边选一块，右边看原文。"))),
        h("div", { class: "bench" }, request()),
        h("div", { class: "col" },
          h("p", { style: { marginTop: "24px" } }, "提供者报告：这次请求的 input 是 ", h("b", null, "2,769 token"), "。其中一个字也没有 calc.py 的内容。"),
          h("div", { class: "note" }, h("span", { class: "k" }, "记住"), "模型看不到你的电脑。它只看到这个请求。请求里没有的东西，对模型来说就不存在。"),
          section("s-loop", 4, "agent loop", "单步走一遍 agent loop",
            todo("先读三个词的意思，再在下面的面板里按「下一步」（或 → 键）走一遍。", true),
            h("h3", null, "先认识三个词，从小到大"),
            h("ul", { class: "rule" },
              h("li", null, h("b", null, term("toolcall")), "：模型回复里的一段结构化文字，意思是「请运行这个工具」。一条回复里可以有好几个。"),
              h("li", null, h("b", null, term("turn")), "：一次模型回复，加上它引发的全部工具调用和结果。每轮正好一次请求。"),
              h("li", null, h("b", null, term("run")), "：从你发出消息，到某次回复不再有工具调用为止。一次运行可以有很多轮。")),
            h("p", null, "现在把整个运行放慢。你会看到同一个环转了 6 圈：组装请求 → 模型生成 → 判断有没有工具调用 → 执行工具 → 追加结果。左边看环路，中间看", term("session"), "记录，右边看下一次请求会带上什么。"),
            h("p", { class: "dim" }, "「预测模式」默认关闭。想先猜再看，可以打开：关键步骤前会先让你猜一下，不计分。"),
            h("p", { class: "dim" }, "pi 的 JSON 事件流用的正是这三层：", h("code", null, "agent_start"), " → ", h("code", null, "turn_start"), " … ", h("code", null, "tool_execution_start"), " … ", h("code", null, "turn_end"), " → ", h("code", null, "agent_end"), "。§8 实验会用到它。"))),
        h("div", { class: "bench" }, stepper(), predReview()),
        h("div", { class: "col" },
          section("s-count", 5, "数一数", "数轮、请求和工具调用",
            todo("用上面三个词的定义数一数，填三个数字，点「核对」。拿不准就直接看答案。"),
            h("p", null, "数法：", h("b", null, "轮数 = 模型回复的条数"), "（每轮正好一次请求，所以请求数也等于它）；", h("b", null, "工具调用 = 回复里每个调用各算一次"), "。这是另一次运行，注意第 2 行：一次回复里有两个工具调用。"), counting()),
          section("s-sort", 6, "谁做的", "这件事是谁做的？",
            todo("按下面这条规律，把 10 张卡片放进四列，点「核对」。也可以直接「显示答案」。"),
            h("p", null, h("b", null, "规律："), "做选择的是模型；动手的是工具；组装请求、解析回复、记录会话的是 pi；定边界、做审查的是你。（§2 的四个角色）"))),
        h("div", { class: "bench" }, sorter()),
        h("div", { class: "col" },
          section("s-cons", 7, "四个推论", "由 loop 推出的四件事",
            todo("读四张卡片。在第 1 张里取消勾选 bash，看哪些任务变成 ✗。"),
            h("p", null, "agent loop 很简单。但它直接推出了本课程后面的所有主题。"))),
        h("div", { class: "bench" }, consequences()),
        h("div", { class: "col" },
          section("s-lab", 8, "实验", "在你的电脑上验证 agent loop",
            todo("打开终端，按顺序复制运行第 1–3 步，把第 3 步的输出贴到第 4 步。"),
            h("p", null, "现在离开模拟器。你自己跑一次同样的任务，然后用 pi 的事件流证明：每轮一次请求；有工具调用就继续；没有就结束。"),
            h("div", { class: "note" }, h("span", { class: "k" }, "实验规则 · 全课通用"), "所有实验只在 ~/pi-lab/<模块> 里做。pi 一律加 --no-session，不留会话文件。不改 ~/.pi 里的全局配置。最后一步总是清理。"),
            lab()),
          section("s-quiz", 9, "掌握测验", "10 题，8 题过关",
            todo("10 题全部作答，点「交卷」。"),
            h("p", null, "题目考理解，不考记忆。交卷后每题都有解释。可以重做，选项顺序会变。"), quiz()),
          section("s-recap", 10, "小结", "你学到了什么",
            todo("看自己的预测和成绩。觉得学会了，就在本节最后点「标记为已完成」。", true),
            h("p", { class: "lead" }, "一句话：模型写文字，pi 把文字变成动作，并且每一轮都把全部历史重新交给模型。"), rc))));
    return () => rc._cleanup && rc._cleanup();
  });
})();
