/* Pi Harness course — shared runtime: course data, progress store, glossary, widgets, router. */
(function () {
  "use strict";

  // ---------- tiny DOM helper ----------
  function h(tag, attrs, ...kids) {
    const el = document.createElementNS(tag.startsWith("svg:") ? "http://www.w3.org/2000/svg" : "http://www.w3.org/1999/xhtml", tag.replace(/^svg:/, ""));
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") el.setAttribute("class", v);
      else if (k === "html") el.innerHTML = v;
      else if (k === "text") el.textContent = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function shuffle(a, seed) {
    // mulberry32: small seeds still give well-spread orders (the old LCG kept short lists nearly unshuffled)
    const r = a.slice(); let s = (seed || 1) >>> 0;
    const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
    return r;
  }

  // ---------- course data ----------
  const UNITS = [
    { id: "UP", name: "序章" },
    { id: "U0", name: "心智模型" },
    { id: "U1", name: "驾驭 pi" },
    { id: "U2", name: "配置" },
    { id: "U3", name: "扩展" },
    { id: "U4", name: "边界与自动化" },
    { id: "U5", name: "oh-my-pi" },
    { id: "U6", name: "毕业" },
  ];
  const MODULES = [
    { id: "INTRO", unit: "UP", title: "认识 pi", pre: [], goal: "知道 pi 是什么、怎么装，以及这门课的路线。" },
    { id: "M0", unit: "U0", title: "Harness 是什么", pre: [], goal: "画出 agent loop；区分模型、harness、工具、会话。" },
    { id: "M1", unit: "U0", title: "上下文是预算", pre: ["M0"], goal: "列出一次请求的全部组成；估算占用；算出何时触发压缩。" },
    { id: "M2", unit: "U1", title: "第一次会话", pre: ["M0"], goal: "用 @ 引文件；分清 ! 和 !!；在运行中插话或排队；中断。" },
    { id: "M3", unit: "U1", title: "会话是一棵树", pre: ["M1", "M2"], goal: "用 /tree、/fork、/clone 管理多条思路；从 JSONL 还原模型实际看到的历史。" },
    { id: "M4", unit: "U1", title: "压缩", pre: ["M1", "M3"], goal: "预测切点位置；解释 firstKeptEntryId；判断何时手动压缩。" },
    { id: "M5", unit: "U2", title: "配置的分层与信任", pre: ["M1"], goal: "预测任一目录下的生效设置；说清项目信任管什么、不管什么。" },
    { id: "M6", unit: "U2", title: "模型与提供者", pre: ["M5"], goal: "接入提供者或兼容端点；按任务选模型和思考强度。" },
    { id: "M7", unit: "U3", title: "指令层", pre: ["M5"], goal: "写有效的 AGENTS.md；分清 SYSTEM.md 与 APPEND_SYSTEM.md；写带参数的提示模板。" },
    { id: "M8", unit: "U3", title: "Skill", pre: ["M7"], goal: "写一个能被正确路由的 Skill；解释渐进加载为什么省上下文。" },
    { id: "M9", unit: "U3", title: "扩展 I：工具与命令", pre: ["M8"], goal: "用 TypeScript 写扩展；注册命令和工具；正确返回结果。" },
    { id: "M10", unit: "U3", title: "扩展 II：事件与状态", pre: ["M3", "M4", "M9"], goal: "选对事件钩子；拦截工具调用；让状态跟随分支。" },
    { id: "M11", unit: "U3", title: "MCP、codemode 与包", pre: ["M10"], goal: "接入 MCP；理解工具暴露方式；打包并安装自己的扩展。" },
    { id: "M12", unit: "U4", title: "安全边界", pre: ["M5", "M10"], goal: "对一个场景做威胁分析；说清每一层防线挡住什么。" },
    { id: "M13", unit: "U4", title: "自动化与嵌入", pre: ["M2", "M10"], goal: "用 print、JSON、RPC、SDK 把 pi 嵌进脚本和程序。" },
    { id: "M14", unit: "U5", title: "从 pi 到 omp", pre: ["M4", "M6", "M11", "M12", "M13"], goal: "把 pi 的知识迁移到 omp；指出关键差异。" },
    { id: "M15", unit: "U5", title: "omp 的工具面", pre: ["M14"], goal: "解释 hashline 编辑；用好 LSP、ast_grep、eval 和内部 URL。" },
    { id: "M16", unit: "U5", title: "omp 的编排", pre: ["M15"], goal: "定义子代理并按角色路由模型；写 TTSR 规则。" },
    { id: "M17", unit: "U5", title: "选择与组合", pre: ["M16"], goal: "针对给定场景选 pi 或 omp，并给出理由。" },
    { id: "CAP", unit: "U6", title: "配好你自己的 pi", pre: ["M17"], goal: "把课程里学的落到日常用的 pi 上。" },
  ];
  const MOD = Object.fromEntries(MODULES.map((m) => [m.id, m]));

  // ---------- glossary (one term, one word) ----------
  const TERMS = {
    harness: ["harness", "把模型接到工具、上下文和会话上的程序。pi 和 omp 都是 harness。"],
    model: ["模型 · model", "根据输入生成文字的神经网络。它只输出文字。"],
    provider: ["提供者 · provider", "让你访问模型的服务或账号。例如 OpenAI Codex、Anthropic、本地 llama.cpp。"],
    tool: ["工具 · tool", "harness 提供给模型的一个动作，例如 read、bash。模型只能请求它，由 harness 执行。"],
    toolcall: ["工具调用 · tool call", "模型回复里的一段结构化文字。它写明要调用哪个工具、用什么参数。"],
    toolresult: ["工具结果 · tool result", "harness 执行工具后得到的输出。它作为一条消息追加到会话里。"],
    turn: ["轮 · turn", "一次模型回复，加上这次回复引发的全部工具调用和工具结果。"],
    run: ["运行 · run", "从你发送一条消息开始，到 agent 不再自动继续为止。一次运行包含一轮或多轮。"],
    request: ["请求 · request", "harness 发给提供者的一次调用。每轮开始时发送一次。"],
    context: ["上下文 · context", "一次请求里模型能看到的全部内容。模型看不到请求以外的任何东西。"],
    sysprompt: ["系统提示 · system prompt", "每次请求最前面的说明文字。pi 用基础说明、工具清单、规则、AGENTS.md 等拼成。"],
    session: ["会话 · session", "pi 对一次对话的完整记录。默认存成 ~/.pi/agent/sessions/ 下的 JSONL 文件。"],
    stop: ["停止原因 · stopReason", "模型结束本次回复的原因。toolUse：要调用工具。stop：回复完成。"],
    agentsmd: ["AGENTS.md", "放在目录里的说明文件。pi 把它的内容放进系统提示。它只是文字，不增加能力。"],
    token: ["token", "模型处理文字的单位。上下文大小和费用都按 token 计算。"],
    cache: ["提示缓存 · prompt cache", "提供者缓存了相同的请求开头。命中的部分记为 cacheRead，更便宜也更快。"],
  };
  function term(key, label) {
    return h("span", { class: "t", tabindex: "0", "data-t": key }, label || TERMS[key][0].split(" · ")[0]);
  }
  function initTips() {
    const tip = h("div", { class: "tip", hidden: true });
    document.body.append(tip);
    const show = (el) => {
      const d = TERMS[el.dataset.t]; if (!d) return;
      tip.replaceChildren(h("b", null, d[0]), d[1]);
      tip.hidden = false;
      const r = el.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
      let x = Math.min(window.innerWidth - tw - 12, Math.max(12, r.left + r.width / 2 - tw / 2));
      let y = r.top - th - 10; if (y < 8) y = r.bottom + 10;
      tip.style.left = x + "px"; tip.style.top = y + "px";
    };
    const hide = () => { tip.hidden = true; };
    document.addEventListener("mouseover", (e) => { const t = e.target.closest?.(".t[data-t]"); t ? show(t) : hide(); });
    document.addEventListener("focusin", (e) => { const t = e.target.closest?.(".t[data-t]"); t ? show(t) : hide(); });
    document.addEventListener("scroll", hide, true);
  }

  // ---------- progress store: db (cloud, per viewer) with a local mirror ----------
  const LKEY = "pi-harness-course-v1";
  // Keys whose numbers only grow; everything else that is not an object/boolean prefers the newer side.
  const MAX_KEYS = new Set(["best", "attempts", "simReqs"]);
  const isObj = (x) => x && typeof x === "object" && !Array.isArray(x);
  /** Merge two progress trees so nothing learned on either device is lost. `bNewer` decides plain-value conflicts. */
  function merge(a, b, bNewer, key) {
    if (a === undefined) return b;
    if (b === undefined) return a;
    if (isObj(a) && isObj(b)) {
      const out = {};
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out[k] = merge(a[k], b[k], bNewer, k);
      return out;
    }
    if (key === "complete") return bNewer ? b : a; // 手动完成：以最新的操作为准，允许取消
    if (typeof a === "boolean" && typeof b === "boolean") return a || b;
    if (typeof a === "number" && typeof b === "number" && MAX_KEYS.has(key)) return Math.max(a, b);
    return bNewer ? b : a;
  }
  const Store = {
    state: { v: 1, updatedAt: 0, mods: {} },
    ref: null, mode: "local", ready: false, listeners: new Set(), timer: null, saving: false, dirty: false, lastSync: 0,
    mod(id) { return (this.state.mods[id] ||= {}); },
    get(id, key, dflt) { const m = this.state.mods[id]; return m && key in m ? m[key] : dflt; },
    set(id, key, val) { if (key === "done") return; this.mod(id)[key] = val; this.touch(); }, // 不再自动判定完成
    touch() {
      this.state.updatedAt = Date.now();
      try { localStorage.setItem(LKEY, JSON.stringify(this.state)); } catch (e) {}
      this.dirty = true; clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), 1200);
      this.listeners.forEach((f) => f());
    },
    async flush() {
      // Never write before the cloud copy has been read and merged; that would overwrite another device's progress.
      if (!this.ref || !this.ready || this.saving || !this.dirty) return;
      this.saving = true; this.dirty = false;
      try { await this.ref.set(JSON.parse(JSON.stringify(this.state))); this.lastSync = Date.now(); renderSync(); }
      catch (e) { if (e && e.code === "invalid_argument") { this.ref = null; this.mode = "local"; renderSync(); } else this.dirty = true; }
      this.saving = false;
      if (this.dirty) { clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), 1500); }
    },
    /** Read the cloud copy and merge it into the local state. */
    async pull() {
      if (!this.ref) return;
      try {
        const snap = await this.ref.get();
        const remote = snap.exists ? snap.data() : null;
        if (remote && remote.v === 1) {
          const remoteNewer = (remote.updatedAt || 0) > (this.state.updatedAt || 0);
          const merged = merge(this.state, JSON.parse(JSON.stringify(remote)), remoteNewer);
          merged.updatedAt = Math.max(remote.updatedAt || 0, this.state.updatedAt || 0);
          const changed = JSON.stringify(merged.mods) !== JSON.stringify(this.state.mods);
          const remoteMissing = JSON.stringify(merged.mods) !== JSON.stringify(remote.mods);
          this.state = merged;
          try { localStorage.setItem(LKEY, JSON.stringify(this.state)); } catch (e) {}
          if (changed) { this.listeners.forEach((f) => f()); if (Router.cur) Router.go(Router.cur, true); }
          if (remoteMissing) this.dirty = true;
        } else if (Object.keys(this.state.mods).length) this.dirty = true;
        this.lastSync = Date.now();
      } catch (e) { /* keep local; retry on next focus */ }
      this.ready = true;
      renderSync();
      this.flush();
    },
    async init() {
      try { const raw = localStorage.getItem(LKEY); if (raw) { const s = JSON.parse(raw); if (s && s.v === 1) this.state = s; } } catch (e) {}
      try {
        if (!window.claude || !window.claude.use) return renderSync();
        const [db, user] = await Promise.all([window.claude.use("db"), window.claude.use("user")]);
        if (!db || !user) return renderSync();
        const uid = await user.id();
        if (!uid) return renderSync();
        this.ref = db.doc("data/users/" + uid + "/progress");
        this.mode = "cloud";
        await this.pull();
        document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") this.pull(); });
      } catch (e) { this.mode = "local"; renderSync(); }
    },
  };
  function renderSync() {
    const el = $("#sync"); if (!el) return;
    el.className = "sync" + (Store.mode === "cloud" ? " on" : "");
    const t = Store.lastSync ? new Date(Store.lastSync).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : "";
    el.replaceChildren(h("span", { class: "dot" }), Store.mode === "cloud" ? (Store.ready ? "进度已同步到云端" + (t ? " · " + t : "") : "正在读取云端进度…") : "进度只存在本浏览器（未登录或云端不可用）");
  }

  // ---------- module status ----------
  const BUILT = {};
  function status(id) {
    if (!BUILT[id]) return "soon";
    const m = Store.state.mods[id];
    // 完成由用户手动标记；旧版自动判定的 done 只作初始值保留
    if (m && ("complete" in m ? m.complete : m.done)) return "done";
    return "built";
  }

  // ---------- rail ----------
  const railOpen = new Set(); let railUnit = null;
  function renderRail() {
    const units = $("#units"); units.replaceChildren();
    const curUnit = MOD[Router.cur]?.unit;
    if (curUnit && curUnit !== railUnit) { railUnit = curUnit; railOpen.add(curUnit); }
    for (const u of UNITS) {
      const mods = MODULES.filter((x) => x.unit === u.id);
      const open = railOpen.has(u.id);
      const body = h("div", { class: "unit-b", id: "ub-" + u.id, hidden: !open });
      units.append(h("button", { class: "unit-h", type: "button", "aria-expanded": String(open), "aria-controls": "ub-" + u.id,
        onclick: () => { railOpen.has(u.id) ? railOpen.delete(u.id) : railOpen.add(u.id); renderRail(); } },
        h("span", null, unitLabel(u)),
        h("span", { class: "uc" }, mods.filter((m) => status(m.id) === "done").length + "/" + mods.length),
        h("span", { class: "chev", "aria-hidden": "true" })), body);
      for (const m of mods) {
        const st = status(m.id);
        body.append(h("button", {
          class: "mod-link", "aria-current": Router.cur === m.id ? "page" : null,
          onclick: () => { location.hash = m.id; },
          title: st === "soon" ? "制作中" : "",
        }, h("span", { class: "mid" }, lessonName(m.id)), h("span", null, m.title), h("span", { class: "st " + (st === "soon" ? "" : st) })));
      }
    }
    const done = MODULES.filter((m) => status(m.id) === "done").length;
    $("#rp-num").textContent = done + " / " + MODULES.length;
    const ring = $("#rp-ring"); const c = 2 * Math.PI * 15;
    ring.setAttribute("stroke-dasharray", `${(done / MODULES.length) * c} ${c}`);
  }

  // ---------- overlays: glossary ----------
  function overlay(title, body) {
    const close = () => { o.remove(); document.removeEventListener("keydown", onKey); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    const o = h("div", { class: "overlay", onclick: (e) => { if (e.target === o) close(); } },
      h("div", { class: "overlay-box", role: "dialog", "aria-label": title },
        h("div", { class: "overlay-h" }, h("h3", null, title), h("button", { class: "btn ghost", onclick: close }, "关闭 ", h("span", { class: "k" }, "Esc"))),
        body));
    document.addEventListener("keydown", onKey);
    document.body.append(o);
    return { close };
  }

  function openGlossary() {
    overlay("术语表", h("div", null,
      h("p", { class: "dim", style: { padding: "14px 20px 0", margin: 0 } }, "全课每个概念只用一个词。正文里带虚线的词，悬停可看定义。"),
      h("div", { class: "gloss" }, Object.values(TERMS).map(([n, d]) => {
        const [zh, en] = n.split(" · ");
        return h("div", null, h("b", null, zh), en ? h("span", { class: "en" }, en) : null, h("div", { class: "dim" }, d));
      }))));
  }

  // ---------- widgets ----------
  const LETTERS = "ABCDEF";
  function section(id, n, tag, title, ...kids) {
    return h("section", { class: "sec", id, "data-toc": tag }, h("div", { class: "sec-tag" }, h("span", { class: "n" }, "§" + n), tag), title ? h("h2", null, title) : null, ...kids);
  }

  // ---------- shared module blocks: quiz ----------
  /** Mastery quiz: all questions on one page, graded together, retry reshuffles. */
  function quizBlock(modId, QUIZ, onGraded, pass = 8) {
    const box = h("div", { class: "panel" });
    let picks = {};
    let seed = (Store.get(modId, "check", { attempts: 0 }).attempts || 0) + 7;
    const head = h("div", { class: "quiz-head" });
    const list = h("div");
    const submit = h("button", { class: "btn primary", disabled: true }, "交卷");
    const N = QUIZ.length;
    const paintHead = (score) => {
      const s = Store.get(modId, "check", { best: 0, attempts: 0 });
      head.replaceChildren(h("div", null, h("div", { style: { fontWeight: 600 } }, pass == null ? `${N} 题 · 全部选完再交卷，每题都有解释` : `${N} 题 · ${pass} 题及以上过关`), h("div", { class: "mute", style: { fontSize: "15px" } }, `已作答 ${Object.keys(picks).length} / ${N} · 历史最好 ${s.best} / ${N} · 第 ${s.attempts + 1} 次`)),
        score != null ? h("div", { class: "quiz-score " + (score >= (pass == null ? N : pass) ? "pass" : "fail") }, score + " / " + N) : h("div", { style: { width: "160px" } }, h("div", { class: "meter" }, h("i", { style: { width: (Object.keys(picks).length / N) * 100 + "%" } }))));
    };
    function render() {
      list.replaceChildren(); picks = {};
      QUIZ.forEach((q, qi) => {
        const order = shuffle(q.opts.map((_, i) => i), seed * 31 + qi);
        const fb = h("div", { class: "feedback", hidden: true });
        const btns = order.map((oi, k) => h("button", { class: "opt", "data-i": oi, "aria-pressed": "false", onclick: () => {
          picks[qi] = oi; btns.forEach((b) => b.setAttribute("aria-pressed", +b.dataset.i === oi)); submit.disabled = Object.keys(picks).length < N; paintHead(); } },
          h("span", { class: "l" }, LETTERS[k]), h("span", null, q.opts[oi].t)));
        const row = h("div", { class: "quiz-q predict", style: { margin: 0 } }, h("div", { class: "q" }, h("span", { class: "k", style: { color: "var(--fg-mute)" } }, "第 " + (qi + 1) + " 题"), q.q), h("div", { class: "opts" }, btns), fb);
        row._grade = () => { btns.forEach((b) => { const i = +b.dataset.i; b.disabled = true; if (q.opts[i].ok) b.classList.add("right"); else if (i === picks[qi]) b.classList.add("wrong"); });
          const ok = q.opts[picks[qi]]?.ok; fb.hidden = false; fb.replaceChildren(h("span", { class: "verdict " + (ok ? "ok" : "no") }, ok ? "对。" : "不对。"), q.why); return !!ok; };
        list.append(row);
      });
      submit.disabled = true; submit.textContent = "交卷"; submit.onclick = grade;
      paintHead();
    }
    function grade() {
      let score = 0; [...list.children].forEach((c) => { if (c._grade()) score++; });
      const s = Store.get(modId, "check", { best: 0, attempts: 0 });
      Store.set(modId, "check", { best: Math.max(s.best, score), attempts: s.attempts + 1, last: score });
      paintHead(score);
      submit.disabled = false; submit.textContent = "换个顺序再做一次"; submit.onclick = () => { seed++; render(); box.scrollIntoView({ behavior: reduced() ? "auto" : "smooth" }); };
      onGraded && onGraded(score);
      head.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "center" });
    }
    render();
    box.append(head, list, h("div", { style: { padding: "14px 18px", borderTop: "1px solid var(--line)" } }, submit));
    return box;
  }

  // ---------- 手动完成按钮 ----------
  function completeButton(modId) {
    const done = status(modId) === "done";
    const row = h("div", { class: "complete-row" },
      done ? h("span", { class: "r-harness", style: { fontWeight: 600 } }, "✓ 你已把本课标记为已完成。") : h("span", { class: "mute" }, "读完、练够了，就自己标记。"),
      h("button", { class: done ? "btn lg ghost" : "btn lg primary", onclick: () => { Store.set(modId, "complete", !done); renderRail(); if (row.isConnected) row.replaceWith(completeButton(modId)); } }, done ? "取消完成" : "标记为已完成"));
    return row;
  }

  // ---------- lesson blocks (v2): header, look-here line, how-to table, check, end ----------
  /** Lesson header. intro: what problem the lesson solves, in plain words. learn: what you will know after it. */
  function lessonHead(id, intro, learn) {
    const m = MOD[id], u = UNITS.find((x) => x.id === m.unit);
    return h("header", { class: "mhead" },
      h("div", { class: "crumbs" }, unitLabel(u)),
      h("h1", { class: "mtitle" }, h("span", { class: "mid" }, lessonName(id)), m.title),
      h("div", { class: "intro" }, intro),
      learn && learn.length ? h("div", { class: "learn" }, h("div", { class: "k" }, "读完这一课，你会知道"), h("ul", null, learn.map((x) => h("li", null, x)))) : null);
  }
  /** One line placed right above a demo: what to look at in it. */
  function look(...kids) { return h("p", { class: "look" }, h("span", { class: "k" }, "看什么"), ...kids); }
  /** How to do it in pi. rows: [[keys or command, what it does], ...]. */
  function howto(title, rows, ...foot) {
    return h("div", { class: "panel howto" },
      h("div", { class: "panel-h" }, h("span", null, title)),
      h("table", null, h("tbody", null, rows.map(([k, d]) => h("tr", null, h("td", { class: "hk" }, k), h("td", null, d))))),
      foot.length ? h("div", { class: "howto-foot" }, ...foot) : null);
  }
  /** Lesson end: takeaways, the complete button, the next lesson. */
  function endBlock(id, points, next) {
    const nm = next && MOD[next.id];
    return h("div", null,
      h("div", { class: "panel takeaway" }, h("ol", null, points.map((p) => h("li", null, p)))),
      h("div", { class: "panel end-done", style: { marginTop: "12px", padding: "6px 18px 14px" } }, completeButton(id)),
      nm ? h("div", { class: "panel next-card" },
        h("div", null, h("div", { class: "mid" }, nm.id === "CAP" ? "最后一页 · 毕业" : "下一课 · " + lessonName(nm.id)), h("div", { style: { font: "700 22px var(--f-body)", margin: "4px 0" } }, nm.title),
          next.text ? h("div", { class: "dim", style: { fontSize: "16px" } }, next.text) : null),
        h("button", { class: "btn lg outline", onclick: () => { location.hash = nm.id; } }, nm.id === "CAP" ? "前往毕业" : "前往" + lessonName(nm.id), h("span", { class: "arr", "aria-hidden": "true" }, "→"))) : null);
  }

  // ---------- section TOC + seen tracking ----------
  let io = null;
  function buildToc(modId) {
    $(".toc")?.remove(); io?.disconnect();
    const secs = $$(".sec[data-toc]"); if (!secs.length) return;
    const seen = Store.get(modId, "seen", {});
    const links = secs.map((s) => h("a", { href: "#" + modId, "data-for": s.id, class: seen[s.id] ? "done" : "", onclick: (e) => { e.preventDefault(); s.scrollIntoView({ behavior: reduced() ? "auto" : "smooth" }); } },
      h("span", { class: "lb" }, s.dataset.toc), h("span", { class: "d" })));
    $(".main").append(h("nav", { class: "toc", "aria-label": "本课目录" }, h("div", { class: "toc-h" }, "本课目录"), links));
    io = new IntersectionObserver((ents) => {
      for (const e of ents) if (e.isIntersecting) {
        links.forEach((l) => l.classList.toggle("cur", l.dataset.for === e.target.id));
        const s = Store.get(modId, "seen", {});
        if (!s[e.target.id]) { Store.set(modId, "seen", { ...s, [e.target.id]: 1 }); links.find((l) => l.dataset.for === e.target.id)?.classList.add("done"); renderRail(); }
      }
    }, { rootMargin: "-40% 0px -55% 0px" });
    secs.forEach((s) => io.observe(s));
  }

  // ---------- router ----------
  const Router = {
    cur: null, cleanup: null,
    go(id, keepScroll) {
      if (!MOD[id]) id = "INTRO";
      this.cleanup && this.cleanup(); this.cleanup = null;
      this.cur = id;
      const page = $("#page"); page.replaceChildren();
      const m = MOD[id];
      if (BUILT[id]) { this.cleanup = BUILT[id](page, m) || null; }
      else {
        page.append(h("div", { class: "col mhead" },
          h("div", { class: "crumbs" }, UNITS.find((u) => u.id === m.unit).name + " / " + lessonName(m.id)),
          h("h1", { class: "mtitle" }, h("span", { class: "mid" }, lessonName(m.id)), m.title),
          h("div", { class: "panel soon" }, h("div", { class: "k" }, "制作中"),
            h("p", { class: "lead", style: { marginTop: "8px" } }, "学完你能：" + m.goal),
            h("p", { class: "dim" }, m.pre.length ? "前置模块：" + m.pre.join("、") + "。" : ""))));
      }
      renderRail(); buildToc(id);
      if (!keepScroll) window.scrollTo(0, 0);
      document.title = m.id === "M0" ? "Pi Harness 课程" : "Pi Harness 课程";
    },
  };

  // ---------- labels: 内部 ID M0–M17 显示为「第 1–18 课」 ----------
  const LBL_RE = /(^|[^A-Za-z0-9_$\-])M(1[0-7]|[0-9])(?![0-9A-Za-z])/g;
  const relabel = (s) => s.replace(LBL_RE, (_, p, n) => p + "第 " + (+n + 1) + " 课");
  const lessonName = (id) => (id === "CAP" ? "★" : id === "INTRO" ? "序章" : relabel(id));
  const unitLabel = (u) => (u.id === "UP" ? u.name : "第 " + (+u.id.slice(1) + 1) + " 单元 · " + u.name);
  function relabelNode(n) {
    if (n.nodeType === 3) { const t = relabel(n.data); if (t !== n.data) n.data = t; return; }
    if (n.nodeType !== 1 || /^(TEXTAREA|INPUT|SCRIPT|STYLE)$/.test(n.tagName)) return;
    const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT); let x;
    while ((x = w.nextNode())) { if (!x.parentElement || !/^(TEXTAREA|SCRIPT|STYLE)$/.test(x.parentElement.tagName)) relabelNode(x); }
  }
  function watchLabels() {
    relabelNode(document.body);
    new MutationObserver((ms) => ms.forEach((m) => { if (m.type === "characterData") relabelNode(m.target); else m.addedNodes.forEach(relabelNode); }))
      .observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  // ---------- boot ----------
  function boot() {
    watchLabels();
    initTips();
    $("#btn-gloss").addEventListener("click", openGlossary);
    const themeBtn = $("#btn-theme");
    const SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
    const MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
    const paintTheme = () => { const light = document.documentElement.dataset.theme === "light"; const t = light ? "切换到深色" : "切换到浅色";
      themeBtn.innerHTML = light ? MOON : SUN; themeBtn.setAttribute("aria-label", t); themeBtn.title = t; };
    themeBtn.addEventListener("click", () => {
      const t = document.documentElement.dataset.theme === "light" ? "dark" : "light";
      document.documentElement.dataset.theme = t;
      try { localStorage.setItem("pi-course-theme", t); } catch (e) { /* storage blocked: theme lasts this visit */ }
      paintTheme();
    });
    paintTheme();
    Store.listeners.add(renderRail);
    window.addEventListener("hashchange", () => Router.go(location.hash.slice(1)));
    Router.go(location.hash.slice(1) || "INTRO");
    renderSync();
    Store.init();
  }

  window.Course = { h, $, $$, sleep, reduced, shuffle, MODULES, MOD, UNITS, TERMS, term, Store, section, quizBlock, register: (id, fn) => { BUILT[id] = fn; }, boot, completeButton, renderRail, lessonHead, look, howto, endBlock };
})();
