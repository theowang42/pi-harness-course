/* M2 · 第一次会话 */
(function () {
  "use strict";
  const { h, $, $$, reduced, term, Store, choice, copyBlock, section, todo, route } = window.Course;
  const ID = "M2";

  // ================= §0 hero: the real TUI, annotated =================
  // Captured from this machine (tmux, pi 0.99.2) while a task was running with one steering and one follow-up queued.
  const TUI = [
    ["hdr", " ▀▀█  v0.99.2", "dimt"],
    ["hdr", " █▀ █ escape interrupt · ctrl+c/ctrl+d clear/exit · / commands · ! bash · ctrl+o more", "dimt"],
    ["res", " [Context]  AGENTS.md      [Extensions]  pi-web-access", "dimt"],
    ["rule"],
    ["msg", " 用 bash 工具依次运行 sleep 4 三次，每次单独一个工具调用。全部做完后只说：完成。", "user"],
    ["tool", " $ sleep 4", "tool"],
    ["tool", " Elapsed 3.0s", "dimt"],
    ["queue", " Steering: 第三次改成运行 echo 已改", "q"],
    ["queue", " Follow-up: 最后再说一句：再见", "q"],
    ["queue", " ↳ Alt+Up to edit all queued messages", "dimt"],
    ["rule"],
    ["edit", " ▏", ""],
    ["rule"],
    ["foot", " ~/pi-lab/m2", "dimt"],
    ["foot", " ↑2.7k ↓24 $0.028 (sub) 1.0%/272k (auto)                          gpt-6-astra • medium", "dimt"],
  ];
  const ZONES = {
    hdr: ["启动头", "版本号和最常用的按键。按 Ctrl+O 可展开完整的启动帮助和已加载资源。"],
    res: ["已加载的资源", "pi 启动时找到的上下文文件、扩展、Skill、提示模板。这里显示什么，请求里就带什么（M1）。"],
    msg: ["你的消息", "你发出的提示。整个会话记录按时间往下排。"],
    tool: ["工具调用与输出", "pi 正在执行的工具。默认折叠长输出，按 Ctrl+O 展开或收起。"],
    queue: ["排队区", "运行中你发的消息在这里等待。Steering 是插话（Enter），Follow-up 是排队（Alt+Enter）。按 Alt+Up 把它们全部取回编辑器。"],
    edit: ["编辑器", "在这里写提示。Enter 发送，Shift+Enter 换行，Ctrl+G 用外部编辑器写长文。输入 / 打开命令菜单，输入 @ 搜索文件，输入 ! 运行命令。编辑器边框的颜色表示思考强度。"],
    foot: ["底栏", "当前目录、用量和费用、上下文占用、模型与思考强度。M1 逐段讲过。"],
  };
  function hero() {
    const exp = h("div", { class: "panel tui-exp" }, h("span", { class: "mute" }, "鼠标移到界面上的任一区域，看它是什么。"));
    let seen = new Set(Object.keys(Store.get(ID, "zones", {})));
    const show = (z) => {
      $$(".tui .hot", box).forEach((r) => r.classList.toggle("on", r.dataset.z === z));
      exp.replaceChildren(h("b", null, ZONES[z][0]), h("p", { class: "dim", style: { margin: "4px 0 0" } }, ZONES[z][1]));
      if (!seen.has(z)) { seen.add(z); Store.set(ID, "zones", Object.fromEntries([...seen].map((x) => [x, 1]))); }
    };
    let last = null;
    const rows = TUI.map(([z, txt, cls]) => {
      if (z === "rule") return h("div", { class: "rule" });
      const first = z !== last; last = z;
      return h("div", { class: "row hot " + (cls || ""), "data-z": z, tabindex: first ? "0" : null, onmouseenter: () => show(z), onfocus: () => show(z), onclick: () => show(z) },
        txt, first ? h("span", { class: "tag" }, ZONES[z][0]) : null);
    });
    const box = h("div", { class: "tui", role: "img", "aria-label": "pi 交互界面示意" }, h("div", { style: { height: "8px" } }), rows, h("div", { style: { height: "8px" } }));
    return h("div", null, box, h("div", { class: "mute", style: { fontSize: "15px", marginTop: "6px" } }, "据本机真实界面重排：一个任务正在运行，排队区里有一条插话和一条后续。"), exp);
  }

  // ================= §2 launch =================
  const LAUNCH = [
    ["pi", "在当前目录开一个新会话。"],
    ['pi "说明这个仓库的结构"', "带着第一条提示启动，进入交互界面。"],
    ["pi @README.md 总结它", "启动时把文件内容附到第一条提示里。"],
    ["pi -c", "继续当前目录最近的一个会话（--continue）。"],
    ["pi -r", "打开会话选择器，挑一个继续（--resume）。"],
    ["pi --no-session", "临时会话，退出即丢弃，不写磁盘。本课程的实验大多用它。"],
    ["pi --session-dir <目录>", "把会话文件存到指定目录。本课实验用它，结束时连目录一起删。"],
    ['pi -p "…"', "只跑一次，把最终回答打印到终端后退出（print 模式，M13 详讲）。"],
  ];

  // ================= §3 key drill =================
  // [action, combo, reserved-by-browser]
  const KEYS = [
    ["发送消息", "Enter"],
    ["换行，不发送", "Shift+Enter"],
    ["运行中排队一条后续消息", "Alt+Enter"],
    ["把排队的消息取回编辑器", "Alt+ArrowUp"],
    ["中断当前任务", "Escape"],
    ["展开或收起工具输出", "Ctrl+O"],
    ["用外部编辑器写长提示", "Ctrl+G"],
    ["复制模型最后一条回复", "Ctrl+X"],
    ["切换思考强度", "Shift+Tab"],
    ["清空编辑器（连按两次退出 pi）", "Ctrl+C"],
    ["编辑器为空时退出 pi", "Ctrl+D"],
    ["展开或收起思考块", "Ctrl+T", true],
    ["打开模型选择器", "Ctrl+L", true],
    ["循环切换常用模型", "Ctrl+P", true],
  ];
  const pretty = (c) => c.replace("ArrowUp", "↑").replace("Escape", "Esc");
  function normKey(e) {
    const mods = [];
    if (e.ctrlKey) mods.push("Ctrl"); if (e.altKey) mods.push("Alt"); if (e.shiftKey) mods.push("Shift");
    let key = e.key;
    if (["Control", "Alt", "Shift", "Meta"].includes(key)) return null;
    if (key.length === 1) key = key.toUpperCase();
    if (key === "Tab" && e.shiftKey) return "Shift+Tab";
    return [...mods, key].join("+");
  }
  function keyDrill() {
    const done = { ...Store.get(ID, "keys", {}) };
    let cur = KEYS.findIndex((k, i) => !done[i]); if (cur < 0) cur = 0;
    const list = h("div", { class: "list" });
    const target = h("div", { class: "target" }), sub = h("div", { class: "mute", style: { fontSize: "15px" } });
    const pressed = h("div", { class: "pressed" });
    const catcher = h("div", { class: "catch", tabindex: "0", "aria-label": "按键练习区。聚焦后按下组合键。" }, "点这里，然后按键");
    const alt = h("div", { style: { display: "grid", gap: "6px" } });
    const fb = h("div", { class: "dim", style: { fontSize: "15px", minHeight: "1.6em" } });
    function paintList() {
      list.replaceChildren(...KEYS.map(([a, c], i) => h("div", { class: "item" + (i === cur ? " cur" : "") + (done[i] ? " done" : ""), onclick: () => { cur = i; paint(); } },
        h("span", { class: "st" }, done[i] ? "✓" : "·"), h("span", null, a), h("kbd", null, pretty(c)))));
    }
    function ok() { done[cur] = 1; Store.set(ID, "keys", { ...done }); catcher.className = "catch good"; fb.replaceChildren(h("b", { style: { color: "var(--ok)" } }, "对。"), " ", h("kbd", null, pretty(KEYS[cur][1]))); setTimeout(() => { const n = KEYS.findIndex((k, i) => !done[i]); if (n >= 0) { cur = n; } paint(); }, 650); }
    function paint() {
      const [a, c, reserved] = KEYS[cur];
      target.replaceChildren(a, h("div", { class: "how" }, "按 ", h("kbd", null, pretty(c)))); pressed.textContent = ""; fb.textContent = ""; catcher.className = "catch";
      sub.textContent = `第 ${cur + 1} / ${KEYS.length} 项 · 已完成 ${Object.keys(done).length}`;
      alt.replaceChildren();
      if (reserved) {
        catcher.hidden = true;
        alt.append(h("div", { class: "mute", style: { fontSize: "15px" } }, "浏览器自己占用了这个组合键，网页里按不出来。在 pi 里按它就行。"),
          h("button", { class: "btn", onclick: () => ok() }, "记住了"));
      } else catcher.hidden = false;
      paintList();
    }
    catcher.addEventListener("keydown", (e) => {
      const n = normKey(e); if (!n) return;
      e.preventDefault(); e.stopPropagation();
      pressed.textContent = pretty(n);
      if (n === KEYS[cur][1]) ok();
      else { catcher.className = "catch bad"; const hit = KEYS.find((k) => k[1] === n); fb.replaceChildren(h("b", { style: { color: "var(--bad)" } }, "不对。"), hit ? " 你按的是「" + hit[0] + "」。" : " pi 默认没有给这个组合键分配动作。"); }
    });
    paint();
    return h("div", { class: "panel keys" }, list, h("div", { class: "keypad" }, h("div", { class: "mute", style: { fontSize: "15px" } }, "在 pi 里，你要："), target, sub, catcher, pressed, alt, fb));
  }

  // ================= §4 queue simulator =================
  const STEER = "第三次改成运行 echo 已改";
  const FOLLOW = "最后再说一句：再见";
  function queueSim() {
    const T = { request: 7, generate: 9, sleep: 22, echo: 5, final: 9 };
    let st, timer = null;
    const nowEl = h("div", { class: "qsim-now" }), prog = h("i"), qEl = h("div", { class: "qsim-queue", "aria-live": "polite" });
    const feed = h("div", { class: "qsim-feed", "aria-live": "polite" });
    const tasksEl = h("div", { class: "qsim-tasks" });
    const TASKS = [
      ["t1", "让插话改掉第三次命令"],
      ["t2", "让排队消息在「完成。」之后才进入"],
      ["t3", "插话太晚：第三次已在执行时才插话"],
      ["t4", "带着排队消息按 Esc，看消息回到编辑器"],
    ];
    const tasks = () => Store.get(ID, "qsim", {});
    const mark = (k) => { if (!tasks()[k]) Store.set(ID, "qsim", { ...tasks(), [k]: 1 }); paintTasks(); };
    function paintTasks() { const t = tasks(); tasksEl.replaceChildren(...TASKS.map(([k, txt]) => h("div", null, h("span", { class: t[k] ? "ok" : "no" }, t[k] ? "✓ " : "○ "), txt))); }
    const ent = (cls, head, meta, body) => { feed.append(h("div", { class: "ent " + cls }, h("div", { class: "ent-h" }, h("span", null, head), h("span", { class: "meta" }, meta || "")), body ? h("div", { class: "ent-b" }, body) : null)); feed.scrollTop = feed.scrollHeight; };
    const bStart = h("button", { class: "btn primary", onclick: () => start() }, "Enter · 发送任务");
    const bSteer = h("button", { class: "btn", onclick: () => steer() }, h("span", null, "插话"), h("kbd", null, "Enter"));
    const bFollow = h("button", { class: "btn", onclick: () => follow() }, h("span", null, "排队"), h("kbd", null, "Alt+Enter"));
    const bUp = h("button", { class: "btn", onclick: () => dequeue() }, h("span", null, "取回"), h("kbd", null, "Alt+↑"));
    const bEsc = h("button", { class: "btn", onclick: () => abort() }, h("span", null, "中断"), h("kbd", null, "Esc"));
    const speed = h("select", { id: "m2-speed", style: { font: "inherit", background: "var(--raised)", color: "var(--fg)", border: "1px solid var(--line-2)", borderRadius: "6px" } }, h("option", { value: "100" }, "正常速度"), h("option", { value: "200" }, "慢速"), h("option", { value: "40" }, "快速"));

    function fresh() { st = { n: 0, running: false, turn: 0, phase: "idle", t: 0, plan: ["sleep 4", "sleep 4", "sleep 4"], steerQ: [], followQ: [], editor: [], late: false, changed: false, finalSaid: false }; }
    function start() {
      clearInterval(timer); fresh(); feed.replaceChildren();
      ent("user", "你", "user", "用 bash 依次运行 sleep 4 三次，每次单独调用。做完只说：完成。");
      st.running = true; enter("request"); timer = setInterval(tick, +speed.value); paint();
    }
    function enter(phase) { st.phase = phase; st.t = 0; }
    function dur() { return st.phase === "execute" ? T[st.plan[st.turn].startsWith("echo") ? "echo" : "sleep"] : T[st.phase] || 8; }
    function tick() {
      if (!st.running) return;
      st.t++;
      if (st.t >= dur()) advance();
      paint();
    }
    function advance() {
      const k = st.turn;
      if (st.phase === "request") return enter("generate");
      if (st.phase === "generate") {
        st.n++;
        if (k < st.plan.length) { ent("asst", "模型 · 第 " + st.n + " 轮", "toolUse", h("div", { class: "tc" }, h("span", { class: "nm" }, "bash"), `({"command":"${st.plan[k]}"})`)); return enter("execute"); }
        const txt = st.followTurn ? "再见。" : st.steerTurn ? "收到。第三次已经运行完了，来不及改。完成。" : st.late ? "完成。（插话到达时，第三次已经在运行。）" : "完成。";
        ent("asst", "模型 · 第 " + st.n + " 轮", "stop", txt);
        if (!st.followTurn && !st.steerTurn) st.finalSaid = true;
        st.steerTurn = false; st.followTurn = false;
        return boundary(true);
      }
      if (st.phase === "execute") {
        ent("tool", "工具结果 · bash", "", h("pre", null, st.plan[k].startsWith("echo") ? "已改" : "(no output)"));
        st.turn++;
        return boundary(false);
      }
    }
    function boundary(afterFinal) {
      // Steering enters after the current turn, one message per turn (steeringMode: one-at-a-time).
      if (st.steerQ.length) {
        const m = st.steerQ.shift();
        ent("user", "你 · 插话", "steering → 下一次请求前进入", m);
        if (st.turn <= 2) { st.plan[2] = "echo 已改"; st.changed = true; }
        else { st.late = true; if (afterFinal) st.steerTurn = true; }
        if (afterFinal) st.turn = 99;
        return enter("request");
      }
      if (!afterFinal) return enter("request");
      // The agent would stop here. A follow-up starts the next turn.
      if (st.followQ.length) {
        const m = st.followQ.shift();
        ent("user", "你 · 排队", "follow-up → 任务结束后进入", m);
        if (st.finalSaid) mark("t2");
        st.followTurn = true; st.turn = 99;
        return enter("request");
      }
      st.running = false; clearInterval(timer);
      ent("end", "运行结束", "agent_settled", "pi 等你的下一条消息。");
      if (st.changed) mark("t1");
      if (st.late) mark("t3");
    }
    function steer() { if (!st.running) return; st.steerQ.push(STEER); paint(); }
    function follow() { if (!st.running) return; st.followQ.push(FOLLOW); paint(); }
    function dequeue() { st.editor.push(...st.steerQ, ...st.followQ); st.steerQ = []; st.followQ = []; paint(); }
    function abort() {
      if (!st.running) return;
      const had = st.steerQ.length + st.followQ.length;
      st.editor.push(...st.steerQ, ...st.followQ); st.steerQ = []; st.followQ = [];
      st.running = false; clearInterval(timer);
      ent("end err", "已中断", "stopReason: aborted", had ? `排队中的 ${had} 条消息回到了编辑器。` : "没有排队的消息。");
      if (had) mark("t4");
      paint();
    }
    function paint() {
      const k = st.turn, ph = st.phase;
      const lbl = !st.running ? (st.phase === "idle" ? "空闲" : "已停止") :
        ph === "request" ? "发送第 " + (st.n + 1) + " 次请求" : ph === "generate" ? "模型生成中" : "执行 bash：" + st.plan[k];
      nowEl.replaceChildren(lbl, h("span", { class: "sub" }, st.running ? (ph === "execute" ? "此时插话：要等这条命令结束才进入。" : ph === "generate" ? "此时插话：要等本轮回复和它的工具都结束。" : "此时插话：请求已发出，下一轮才进入。") : "点「发送任务」开始。运行中可随时按右边四个键。"));
      prog.style.width = st.running ? Math.min(100, (st.t / dur()) * 100) + "%" : "0%";
      qEl.replaceChildren(
        ...st.steerQ.map((m) => h("div", { class: "s" }, "Steering: " + m)),
        ...st.followQ.map((m) => h("div", { class: "f" }, "Follow-up: " + m)),
        st.steerQ.length + st.followQ.length ? h("div", { class: "h" }, "↳ Alt+Up to edit all queued messages") : h("div", { class: "h" }, "（排队区为空）"),
        st.editor.length ? h("div", { style: { marginTop: "6px", color: "#e8ebf1" } }, "编辑器：" + st.editor.join(" / ")) : null);
      [bSteer, bFollow, bEsc].forEach((b) => (b.disabled = !st.running));
      bUp.disabled = !(st.steerQ.length + st.followQ.length);
      bStart.disabled = st.running;
    }
    fresh(); paintTasks(); paint();
    feed.append(h("div", { class: "mute", style: { fontSize: "16px" } }, "会话记录会出现在这里。"));
    return h("div", { class: "panel" },
      h("div", { class: "panel-h" }, h("span", null, "排队模拟器 · 照本机实测的行为建模"), h("label", { for: "m2-speed" }, speed)),
      h("div", { class: "qsim-grid" },
        h("div", { class: "qsim-left" }, bStart, nowEl, h("div", { class: "qsim-prog" }, prog),
          h("div", { class: "mute", style: { fontSize: "15px" } }, "排队区（与 pi 界面一致）"), qEl,
          h("div", { class: "qsim-btns" }, bSteer, bFollow, bUp, bEsc),
          h("div", { class: "mute", style: { fontSize: "15px", marginTop: "4px" } }, "完成这四个任务："), tasksEl),
        feed));
  }

  // ================= §5 ! and !! =================
  const BANG = [
    { q: "你想让模型根据 git status 的结果决定下一步。", opts: [{ t: "!git status", ok: true }, { t: "!!git status" }], why: "! 的输出进入上下文。下一条提示发出时，模型能看到它。" },
    { q: "你只想自己看一眼磁盘还剩多少空间，与任务无关。", opts: [{ t: "!df -h" }, { t: "!!df -h", ok: true }], why: "!! 只给你看，不进上下文，不花 token。" },
    { q: "测试输出有 3,000 行。你只想自己扫一眼，再用一句话告诉模型结论。", opts: [{ t: "!npm test" }, { t: "!!npm test", ok: true }], why: "3,000 行进上下文会每轮重发（M1）。自己看，再用一句话转述，更省。" },
    { q: "你要模型修 lint 报错。报错有 15 行。", opts: [{ t: "!npm run lint", ok: true }, { t: "!!npm run lint" }], why: "模型需要报错原文才能修。15 行很便宜。" },
  ];

  // ================= §6 slash palette =================
  const SLASH = [
    ["/settings", "模型与设置", "打开设置面板。改常用偏好。"],
    ["/model", "模型与设置", "选择模型。也可直接写 /model provider/id。快捷键 Ctrl+L。"],
    ["/thinking", "模型与设置", "设置思考强度：off、minimal、low、medium、high、xhigh、max。快捷键 Shift+Tab 循环。"],
    ["/scoped-models", "模型与设置", "设定 Ctrl+P 循环切换的那几个模型。"],
    ["/login", "模型与设置", "登录提供者：订阅或 API key。"],
    ["/logout", "模型与设置", "删除提供者的登录信息。"],
    ["/new", "会话", "开新会话。旧会话保留在磁盘上。"],
    ["/resume", "会话", "切换到另一个保存的会话。"],
    ["/name", "会话", "给当前会话起名。会话选择器里显示这个名字。"],
    ["/session", "会话", "显示会话文件、ID、消息数、token 和费用。"],
    ["/tree", "会话", "在会话树里移动，开分支（M3）。"],
    ["/fork", "会话", "从之前某条消息分出一个新会话（M3）。"],
    ["/clone", "会话", "把当前分支复制成新会话（M3）。"],
    ["/compact", "会话", "手动压缩上下文，可附带指令（M4）。"],
    ["/import", "会话", "导入一个 JSONL 会话并继续。"],
    ["/copy", "导出", "复制模型最后一条回复。快捷键 Ctrl+X。"],
    ["/export", "导出", "把会话导出成 HTML 或 JSONL。导出前先检查内容：可能含密钥。"],
    ["/share", "导出", "上传会话并得到查看链接。先检查内容再分享。"],
    ["/bug", "导出", "准备一份给 pi 开发者的私有错误报告。"],
    ["/trust", "运行时", "为当前项目保存信任决定（M5）。"],
    ["/reload", "运行时", "重新加载快捷键、扩展、Skill、模板、主题和上下文文件。改完配置后用。"],
    ["/hotkeys", "运行时", "列出当前生效的全部快捷键。"],
    ["/changelog", "运行时", "查看更新日志。"],
    ["/quit", "运行时", "退出 pi。"],
  ];
  function palette() {
    const inp = h("input", { class: "inp", id: "m2-pal", value: "/", spellcheck: "false", "aria-label": "输入命令筛选" });
    const res = h("div", { class: "res", role: "listbox" }), det = h("div", { class: "det" });
    let sel = 0, rows = [];
    const show = (c) => det.replaceChildren(h("code", { style: { fontSize: "18px", background: "none", border: 0, padding: 0, color: "var(--c-harness)" } }, c[0]), h("div", { class: "mute", style: { fontSize: "15px", margin: "4px 0 10px" } }, c[1]), h("p", null, c[2]));
    function run() {
      const q = inp.value.replace(/^\//, "").toLowerCase();
      rows = SLASH.filter((c) => !q || c[0].slice(1).includes(q) || c[2].includes(q));
      sel = Math.min(sel, Math.max(0, rows.length - 1));
      res.replaceChildren(...rows.map((c, i) => h("button", { class: "cmd-row" + (i === sel ? " sel" : ""), onclick: () => { sel = i; run(); } }, h("code", null, c[0]), h("span", { class: "g" }, c[2].split("。")[0] + "。"))));
      rows[sel] ? show(rows[sel]) : det.replaceChildren(h("span", { class: "mute" }, "没有匹配的内置命令。扩展、模板、Skill 还会加入更多命令。"));
    }
    inp.addEventListener("input", () => { sel = 0; run(); });
    inp.addEventListener("keydown", (e) => { if (e.key === "ArrowDown") { sel = Math.min(rows.length - 1, sel + 1); run(); e.preventDefault(); } if (e.key === "ArrowUp") { sel = Math.max(0, sel - 1); run(); e.preventDefault(); } });
    run();
    return h("div", { class: "panel palette" }, h("div", null, inp, res), det);
  }

  // ================= §8 lab =================
  const LAB_SETUP = `mkdir -p ~/pi-lab/m2 && cd ~/pi-lab/m2
printf '# 练习\\n这是 M2 的练习目录。\\n' > notes.md
pi --session-dir ~/pi-lab/m2/sessions`;
  const LAB_INSIDE = [
    ["输入并回车", "!ls"],
    ["输入并回车", "!!du -sh ."],
    ["输入并回车（开始一个约 45 秒的任务）", "用 bash 工具依次运行 sleep 15 三次，每次单独一个工具调用。全部做完后只说：完成。"],
    ["任务还在跑时（看到 $ sleep 15 就行），输入后按 Alt+Enter", "最后再说一句：再见"],
    ["再输入下面这句，按 Enter", "第三次改成运行 echo 已改"],
    ["等全部结束后，输入并回车", "/name m2-练习"],
    ["按 Ctrl+D 退出 pi（编辑器需为空）", ""],
  ];
  const LAB_JQ = `jq -r 'if .type=="session_info" then "名字 \\(.name)"
elif .type!="message" then empty
elif .message.role=="bashExecution" then "命令 \\(.message.command) 不给模型=\\(.message.excludeFromContext)"
elif .message.role=="user" then "你 \\([.message.content[]? | .text? // empty] | join("") | .[0:20])"
elif .message.role=="assistant" then "模型 工具=\\([.message.content[] | select(.type=="toolCall") | .name] | join(",")) 停止=\\(.message.stopReason)"
elif .message.role=="toolResult" then "结果 \\(.message.toolName)"
else empty end' ~/pi-lab/m2/sessions/*.jsonl`;
  const LAB_CLEAN = "cd ~ && rm -r ~/pi-lab/m2 && rmdir --ignore-fail-on-non-empty ~/pi-lab";
  const LAB_SAMPLE = `命令 ls 不给模型=false
命令 du -sh . 不给模型=true
你 用 bash 工具依次运行 sleep
模型 工具=bash 停止=toolUse
结果 bash
你 第三次改成运行 echo 已改
模型 工具=bash 停止=toolUse
结果 bash
模型 工具=bash 停止=toolUse
结果 bash
模型 工具= 停止=stop
你 最后再说一句：再见
模型 工具= 停止=stop
名字 m2-练习`;
  function lab() {
    const saved = Store.get(ID, "lab", {});
    const ta = h("textarea", { class: "paste", id: "m2-lab-paste", spellcheck: "false", placeholder: "命令 ls 不给模型=false\n…" });
    ta.value = saved.raw || "";
    ta.addEventListener("input", () => { delete ta.dataset.sample; });
    const out = h("div");
    const verify = (sample) => {
      if (sample) { ta.value = LAB_SAMPLE; ta.dataset.sample = "1"; }
      const isSample = ta.dataset.sample === "1";
      const L = ta.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      const idx = (re, from = 0) => L.findIndex((l, i) => i >= from && re.test(l));
      const steerI = idx(/^你 .*第三次/), followI = idx(/^你 .*再见/);
      const firstStop = idx(/^模型 工具= 停止=stop/);
      const checks = [
        [L.some((l) => /^命令 ls 不给模型=false/.test(l)), "!ls 的输出进入了上下文（不给模型=false）"],
        [L.some((l) => /^命令 du .* 不给模型=true/.test(l)), "!!du 的输出没有进入上下文（不给模型=true）"],
        [steerI > 0 && idx(/^结果 bash/) >= 0 && idx(/^结果 bash/) < steerI && firstStop > steerI, "插话出现在某个工具结果之后、任务结束之前"],
        [followI > 0 && firstStop >= 0 && followI > firstStop, "排队消息出现在第一次「停止=stop」之后"],
        [L.some((l) => /^名字 m2-练习/.test(l)), "会话名字是 m2-练习"],
      ];
      const allOk = checks.every((c) => c[0]);
      if (allOk && !isSample) { Store.set(ID, "lab", { raw: ta.value, passed: true }); checkDone(); }
      out.replaceChildren(h("ul", { class: "check-list" }, checks.map(([ok, t]) => h("li", null, h("span", { class: ok ? "ok" : "no" }, ok ? "✓" : "✗"), t))),
        allOk ? h("div", { class: "note" }, h("span", { class: "k" }, isSample ? "示例数据" : "实验通过"), isSample ? "示例数据全部满足条件，但不计入实验。请用你自己的会话再做一次。" : "你亲手完成了运行中插话、排队、两种命令和命名。最后一步：清理。")
          : h("div", { class: "note warn" }, h("span", { class: "k" }, "没有全部通过"), "看哪一项是 ✗。插话那一项不过，通常是任务已经结束才按的 Enter——那它就成了一条普通消息。重做一次即可，时间很充裕。"));
    };
    if (saved.raw) setTimeout(() => verify(false), 0);
    return h("div", { class: "lab-steps" },
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "建实验目录，启动 pi。"), h("p", { class: "dim", style: { margin: "4px 0 0" } }, "--session-dir 让会话文件存进实验目录，删目录时一起删掉。"), copyBlock(LAB_SETUP))),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "在 pi 里按顺序操作。"),
        h("div", { class: "panel", style: { marginTop: "8px" } }, LAB_INSIDE.map(([how, what], i) => h("div", { class: "mini-tr" }, h("div", { class: "row", style: { gridTemplateColumns: "28px 230px minmax(0,1fr)" } }, h("span", { class: "n" }, String.fromCharCode(97 + i)), h("span", { style: { fontFamily: "var(--f-body)", fontSize: "15px" } }, how), h("span", { class: "what" }, what))))),
        h("p", { class: "dim", style: { margin: "8px 0 0", fontSize: "16px" } }, "不用赶：整个任务约 45 秒，d、e 两步在任务结束前做完就行。只要插话在「完成。」之前进入，就算通过。"))),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "把会话文件压成摘要。"), copyBlock(LAB_JQ))),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "粘贴摘要，核对。"), h("div", { style: { marginTop: "8px" } }, ta),
        h("div", { style: { display: "flex", gap: "8px", marginTop: "8px" } }, h("button", { class: "btn primary", onclick: () => verify(false) }, "核对我的会话"), h("button", { class: "btn ghost", onclick: () => verify(true) }, "先用示例数据试试")), out)),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "清理。"), h("p", { class: "dim", style: { margin: "4px 0 0" } }, "删除实验目录和其中的会话文件。"), copyBlock(LAB_CLEAN))));
  }

  // ================= quiz / review / recap =================
  const QUIZ = [
    { q: "pi 正在执行第一个工具。你输入一条消息按 Enter。它什么时候进入会话？", opts: [{ t: "当前这轮的工具都执行完之后，下一次请求之前", ok: true }, { t: "立即打断工具，马上进入" }, { t: "整个任务结束之后" }], why: "Enter 是插话（steering）。它在当前轮结束后进入，并影响下一次回复。" },
    { q: "Alt+Enter 发出的消息什么时候进入？", opts: [{ t: "pi 完成当前任务之后", ok: true }, { t: "当前这轮结束后" }, { t: "马上进入" }], why: "Alt+Enter 是排队（follow-up）。它等 agent 本来要停下时才进入，然后开始新的一轮。" },
    { q: "运行中你排了两条消息，又改了主意。怎样把它们拿回来修改？", opts: [{ t: "按 Alt+Up", ok: true }, { t: "按 Ctrl+C" }, { t: "无法取回" }], why: "Alt+Up 把所有排队消息放回编辑器。按 Esc 中断时，排队消息也会回到编辑器。" },
    { q: "输入 !ls 并回车，会发生什么？", opts: [{ t: "运行 ls；输出记入会话，下一条提示发出时模型能看到", ok: true }, { t: "运行 ls，并立刻请求模型分析" }, { t: "让模型调用 bash 工具运行 ls" }], why: "本机实测：! 不触发模型请求。输出作为一条 bashExecution 消息进入上下文。" },
    { q: "!! 和 ! 的区别是：", opts: [{ t: "!! 的输出不进入上下文", ok: true }, { t: "!! 用 sudo 运行" }, { t: "!! 运行两次" }], why: "会话文件里两条都有记录；!! 那条标着 excludeFromContext: true。" },
    { q: "你想继续这个目录里上一次的会话。用：", opts: [{ t: "pi -c", ok: true }, { t: "pi --no-session" }, { t: "pi -p" }], why: "-c 继续当前目录最近的会话。-r 打开选择器挑一个。" },
    { q: "刚启动 pi，还没有任何模型回复就退出了。会话文件：", opts: [{ t: "不会写入磁盘", ok: true }, { t: "写入一个空文件" }, { t: "写入，等下次 -c 继续" }], why: "本机实测：会话文件在第一次模型回复后才写入。" },
    { q: "长输出被折叠了，你想看完整的工具输出。按：", opts: [{ t: "Ctrl+O", ok: true }, { t: "Ctrl+T" }, { t: "Ctrl+X" }], why: "Ctrl+O 展开或收起工具输出；Ctrl+T 管思考块；Ctrl+X 复制最后的回复。" },
    { q: "你改了 AGENTS.md，想让当前会话立刻用上新内容。用：", opts: [{ t: "/reload", ok: true }, { t: "/new" }, { t: "/compact" }], why: "/reload 重新加载上下文文件和资源，不丢当前会话。" },
    { q: "导出或分享会话之前，必须先：", opts: [{ t: "检查内容，因为可能包含文件内容和密钥", ok: true }, { t: "先压缩会话" }, { t: "什么都不用做" }], why: "会话记录了提示、工具参数、命令输出和文件内容。" },
  ];
  const REVIEW = [
    { q: "（复习 M1）本机实测，联网扩展每次请求固定花多少 token？", opts: [{ t: "约 1,500", ok: true }, { t: "约 50" }, { t: "只在联网时才花" }], why: "工具定义每次请求都在，不论用不用。" },
    { q: "（复习 M1）底栏的百分比在压缩后会：", opts: [{ t: "下降", ok: true }, { t: "不变" }, { t: "归零后重新累计" }], why: "百分比是当前上下文。↑ ↓ R $ 才是只增不减的累计值。" },
  ];
  const PRE = [
    { id: "p1", q: "pi 正在跑工具。你按 Enter 发出一句话。这句话会：", opts: [{ t: "立刻打断工具" }, { t: "等这轮工具跑完后进入", ok: true }, { t: "等整个任务做完后进入" }] },
    { id: "p2", q: "在 pi 里输入 !ls 回车。模型会马上回答吗？", opts: [{ t: "会，它会分析输出" }, { t: "不会，只是运行命令并记录", ok: true }] },
    { id: "p3", q: "!!ls 的输出，模型以后看得到吗？", opts: [{ t: "看得到" }, { t: "看不到", ok: true }] },
  ];
  function checkDone() {
    const ok = Store.get(ID, "lab", {}).passed && Store.get(ID, "quiz", { best: 0 }).best >= 8;
    if (ok && !Store.get(ID, "done")) Store.set(ID, "done", true);
  }

  // ================= page =================
  window.Course.register(ID, (page) => {
    const rc = window.Course.recapBlock(ID, {
      pre: PRE,
      next: { id: "M3", title: "会话是一棵树", text: "你已经会驾驭一次会话。M3 讲会话文件的真实结构：每条消息都挂在父消息下面，回到过去重来不会抹掉原来的路线。" },
      extra: () => [["按键练习", Object.keys(Store.get(ID, "keys", {})).length + " / " + KEYS.length], ["排队任务", Object.keys(Store.get(ID, "qsim", {})).length + " / 4"]],
    });
    page.append(h("div", { class: "bench" },
      h("header", { class: "mhead" }, h("div", { class: "crumbs" }, "第 2 单元 · 驾驭 pi / M2"), h("h1", { class: "mtitle" }, h("span", { class: "mid" }, "M2"), "第一次会话")),
      section("s-hero", 0, "开场", null, hero(),
        h("div", { class: "col" },
          h("p", { class: "thesis" }, "agent 在跑的时候，你仍然握着操纵杆。", h("br"), "插话、排队、中断，各有各的时机。"),
          h("p", { class: "lead" }, "M0 和 M1 讲了 pi 的内部。本课回到驾驶座：界面每一块是什么，键怎么按，运行中怎样改方向，命令怎样跑，会话怎样接着用。")),
        h("div", { class: "panel objectives" },
          h("ol", null,
            h("li", null, "说出 pi 界面的七个区域和各自的用途。"),
            h("li", null, "用正确的方式启动、继续和恢复会话，并知道会话文件何时写入。"),
            h("li", null, "认得 14 个常用组合键，知道各自做什么。"),
            h("li", null, "预测插话（Enter）和排队（Alt+Enter）何时进入，并会取回和中断。"),
            h("li", null, "按场景选 ! 或 !!，并说出两者对上下文的不同影响。")),
          h("div", { class: "obj-side" },
            h("div", null, h("span", { class: "k" }, "时长"), "约 60 分钟"),
            h("div", null, h("span", { class: "k" }, "前置"), "M0"),
            h("div", null, h("span", { class: "k" }, "练习"), "§8 实验 + §9 测验（≥ 8/10）"),
            h("div", null, h("span", { class: "k" }, "核对版本"), "pi 0.99.2 · kitty / tmux"))),
        h("h3", null, "本课路线"),
        route(ID, [["s-pre", 1, "动手", "复习与预测"], ["s-launch", 2, "阅读", "启动与继续"], ["s-keys", 3, "动手", "按键练习"], ["s-queue", 4, "动手", "插话与排队"], ["s-bang", 5, "动手", "! 与 !!"], ["s-slash", 6, "动手", "命令菜单"], ["s-files", 7, "阅读", "引用文件与图片"], ["s-lab", 8, "实验", "真机驾驶"], ["s-quiz", 9, "测验", "10 题"], ["s-recap", 10, "阅读", "小结"]])),
      h("div", { class: "col" },
        section("s-pre", 1, "复习与预测", "先复习，再预测",
          todo("两道 M1 复习题立即判分；三道预测课末揭晓。"),
          REVIEW.map((r, i) => choice({ id: "r" + i, store: [ID, "rev"], kicker: "复习 " + (i + 1) + " / 2", q: r.q, opts: r.opts, explain: r.why, shuffleSeed: 31 + i * 7 })),
          PRE.map((p, i) => choice({ id: p.id, store: [ID, "pre"], kicker: "预测 " + (i + 1) + " / 3", q: p.q, opts: p.opts, reveal: false, shuffleSeed: 17 + i * 13 }))),
        section("s-launch", 2, "启动与继续", "从哪里启动，就在哪里工作",
          todo("读下表。记住三条规则。", true),
          h("p", null, "pi 把启动时所在的目录当作工作目录。它决定三件事：去哪里找 AGENTS.md 和项目配置；工具默认在哪里读写；会话归到哪一组。"),
          h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" }, h("tbody", null, LAUNCH.map(([c, d]) => h("tr", null, h("td", { style: { whiteSpace: "nowrap" } }, h("code", null, c)), h("td", null, d)))))),
          h("h3", null, "三条规则"),
          h("ul", { class: "rule" },
            h("li", null, h("b", null, "先 cd，再 pi。"), "在错误的目录启动，模型会读错文件、用错说明。"),
            h("li", null, h("b", null, "会话默认存在 ~/.pi/agent/sessions/，按目录分组。"), "-c 只找当前目录的会话。换了目录就找不到。"),
            h("li", null, h("b", null, "会话文件在第一次模型回复后才写入。"), "本机实测：只跑了 ! 命令就退出，磁盘上没有会话文件。"))),
        section("s-keys", 3, "按键练习", "把手放到键盘上",
          todo("读左边的 14 个常用键。想练手感，就点右边的练习区照着按；不练也不影响完成本课。", true),
          h("p", null, "这些键在 pi 里最常用，每一个都写在左边了。右边的练习区会依次提示你按哪个；按对一个，自动跳到下一个。"))),
      h("div", { class: "bench" }, keyDrill()),
      h("div", { class: "col" },
        h("div", { class: "note" }, h("span", { class: "k" }, "终端要支持组合键"), "Alt+Enter、Shift+Enter 依赖终端把修饰键报给 pi。你用的 kitty 支持。在 tmux 里需要在 ~/.tmux.conf 加 set -g extended-keys on，否则 pi 会在启动时警告。按 /hotkeys 可看当前生效的全部按键。"),
        section("s-queue", 4, "插话与排队", "运行中改方向",
          todo("读懂四个操作各是什么意思，再看一条真实时间线。下面的模拟器是可选的。", true),
          h("p", null, "agent 跑起来以后，你还能发消息。按哪个键，决定消息什么时候进入。"),
          h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" },
            h("thead", null, h("tr", null, h("th", null, "按键"), h("th", null, "意思"), h("th", null, "消息什么时候进入"), h("th", null, "什么时候用"))),
            h("tbody", null,
              h("tr", null, h("td", null, h("kbd", null, "Enter")), h("td", null, "插话：边做边纠正"), h("td", null, "当前这一步（模型回复和它调用的工具）做完后、下一次请求模型之前。"), h("td", null, "发现它走错方向，或想补一个限制：「别改那个文件」。")),
              h("tr", null, h("td", null, h("kbd", null, "Alt+Enter")), h("td", null, "排队：做完再说"), h("td", null, "整个任务做完、本来要停下的时候。"), h("td", null, "当前任务没问题，只是想让它做完后接着做另一件事。")),
              h("tr", null, h("td", null, h("kbd", null, "Alt+↑")), h("td", null, "取回：反悔"), h("td", null, "不进入。还没送出去的插话和排队消息回到编辑器。"), h("td", null, "刚发的话写错了，或者不想发了。")),
              h("tr", null, h("td", null, h("kbd", null, "Esc")), h("td", null, "中断：别做了"), h("td", null, "立刻停止当前这一轮；排队消息回到编辑器。"), h("td", null, "它在做明显错误或危险的事，等不到下一步。"))))),
          h("div", { class: "note" }, h("span", { class: "k" }, "一句话区分"), "插话（Enter）是边做边纠正；排队（Alt+Enter）是做完再说；取回（Alt+↑）是反悔；中断（Esc）是别做了。"))),
      h("div", { class: "col" },
        h("h3", null, "真实时间线：插话和排队各在哪一刻进入"),
        h("p", null, "本机实测：让 pi 依次运行三次 sleep 4。第一次运行时，按 Enter 插话「第三次改成运行 echo 已改」，再按 Alt+Enter 排队「最后再说一句：再见」。会话文件里的顺序是："),
        h("div", { class: "panel" }, [
          ["你", "user", "用 bash 依次运行 sleep 4 三次……做完只说：完成。"], ["模型", "model", "bash(sleep 4)"], ["工具", "tool", "(no output)"],
          ["你 · 插话", "user", "第三次改成运行 echo 已改"], ["模型", "model", "bash(sleep 4)"], ["工具", "tool", "(no output)"],
          ["模型", "model", "bash(echo 已改)"], ["工具", "tool", "已改"], ["模型", "model", "完成。　stop"],
          ["你 · 排队", "user", "最后再说一句：再见"], ["模型", "model", "再见。　stop"]].map(([w, c, t], i) => h("div", { class: "mini-tr" }, h("div", { class: "row" }, h("span", { class: "n" }, "#" + (i + 1)), h("span", { class: "who r-" + c }, w), h("span", { class: "what" }, t))))),
        h("p", { style: { marginTop: "12px" } }, "插话在第一个工具结果之后进入（#4），模型立即改了计划（#7）。排队消息等到「完成。」之后才进入（#10）。"),
        h("div", { class: "note warn" }, h("span", { class: "k" }, "一次只进一条"), "设置 steeringMode 默认是 one-at-a-time：排了多条插话时，每轮只送进一条。follow-up 同理。可在设置里改成 all。"),
        h("details", { class: "panel opt-sim" }, h("summary", null, "可选：自己动手模拟这个过程（不影响本课完成）"), h("div", { style: { padding: "0 0 4px" } }, queueSim())),
        section("s-bang", 5, "! 与 !!", "你自己运行命令",
          todo("读下面的实测结论，然后做四个场景题。"),
          h("p", null, "在编辑器里以 ! 开头，pi 直接在你的 shell 里运行这条命令。这不是模型的工具调用，也不触发模型请求。"),
          h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" },
            h("thead", null, h("tr", null, h("th", null, ""), h("th", null, "!命令"), h("th", null, "!!命令"))),
            h("tbody", null,
              h("tr", null, h("td", null, "运行命令"), h("td", null, "是"), h("td", null, "是")),
              h("tr", null, h("td", null, "触发模型请求"), h("td", null, "否"), h("td", null, "否")),
              h("tr", null, h("td", null, "记入会话文件"), h("td", null, "是"), h("td", null, "是，标记 excludeFromContext")),
              h("tr", null, h("td", null, "模型以后看得到"), h("td", null, h("b", null, "是")), h("td", null, h("b", null, "否")))))),
          h("p", { class: "mute", style: { fontSize: "15px", marginTop: "8px" } }, "本机实测：先 !echo 第一条命令，再 !!echo 第二条命令，然后问模型看到了哪些输出。它只列出了第一条。"),
          BANG.map((b, i) => choice({ id: "b" + i, store: [ID, "bang"], kicker: "场景 " + (i + 1) + " / 4", q: b.q, opts: b.opts, explain: b.why, shuffleSeed: 41 + i * 3 }))),
        section("s-slash", 6, "命令菜单", "/ 打开的命令菜单",
          todo("在下面输入框里试着输入 se、co、re，用 ↑↓ 选择，读每条说明。"),
          h("p", null, "在编辑器输入 /，pi 列出当前可用的命令。下面是 0.99.2 的全部内置命令。扩展、提示模板、Skill 会加入更多。"))),
      h("div", { class: "bench" }, palette()),
      h("div", { class: "col" },
        section("s-files", 7, "引用文件与图片", "把东西放进提示",
          todo("读四种方式。实验里会用到 @。", true),
          h("ul", { class: "rule" },
            h("li", null, h("b", null, "@ 引用文件。"), "输入 @ 后搜索文件名，选中后文件内容附进提示。它直接进上下文，不经过 read 工具。M1 的规则照样适用：大文件很贵。"),
            h("li", null, h("b", null, "Tab 补全路径。"), "写路径时按 Tab 自动补全。"),
            h("li", null, h("b", null, "粘贴图片。"), "Ctrl+V 粘贴剪贴板里的图片，或拖进支持的终端。图片默认缩到 2000×2000 以内再发送。"),
            h("li", null, h("b", null, "Ctrl+G 外部编辑器。"), "长提示在 $VISUAL / $EDITOR 里写，保存关闭后回到 pi。")),
          h("div", { class: "note" }, h("span", { class: "k" }, "@ 与让模型去读"), "@ 由你决定放什么，马上进入；让模型 read，由模型决定读什么、读多少。你知道答案在哪个文件时用 @；你不知道时让模型去找。")),
        section("s-lab", 8, "实验", "真机驾驶一次",
          todo("按第 1–5 步操作。第 2 步在 pi 里完成；第 3 步回到终端运行。"),
          h("p", null, "你会在真实的 pi 里完成：两种命令、一次插话、一次排队、给会话命名。然后从会话文件里证明它们发生的顺序。"),
          h("div", { class: "note" }, h("span", { class: "k" }, "实验规则"), "只在 ~/pi-lab/m2 里做；会话存进实验目录；不改全局配置；最后清理。"),
          lab()),
        section("s-quiz", 9, "掌握测验", "10 题，8 题过关", todo("10 题全部作答，点「交卷」。"), window.Course.quizBlock(ID, QUIZ, checkDone)),
        section("s-recap", 10, "小结", "你学到了什么",
          todo("看自己的预测和成绩。觉得学会了，就在本节最后点「标记为已完成」。", true),
          h("p", { class: "lead" }, "一句话：先 cd 再启动；Enter 插话、Alt+Enter 排队、Esc 中断；! 给模型看，!! 只给你看。"),
          rc))));
    return () => rc._cleanup && rc._cleanup();
  });
})();
