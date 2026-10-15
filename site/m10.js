/* M10 · 扩展 II：事件与状态 */
(function () {
  "use strict";
  const { h, $, $$, sleep, reduced, Store, choice, copyBlock, section, todo, route, term } = window.Course;
  const ID = "M10";

  // Real event order recorded on this machine by tracer.ts (pi 0.99.2): one prompt, one read tool call.
  const TRACE = "session_start|input|before_agent_start|agent_start|turn_start|message_start system|message_end system|message_start user|message_end user|context|before_provider_request|message_start assistant|message_end assistant|tool_execution_start read|tool_call read|tool_result read|tool_execution_end read|message_start toolResult|message_end toolResult|turn_end assistant|turn_start|context|before_provider_request|message_start assistant|message_end assistant|turn_end assistant|agent_end|agent_settled|session_shutdown".split("|");
  // name: [lane, can-change?, what it can do, typical use]
  const EV = {
    session_start: ["sess", false, "会话开始或切换时通知。", "启动长期资源（文件监视、子进程）；从会话分支重建扩展状态。"],
    input: ["agent", true, "收到你的输入、还没进入会话之前。可返回 continue、transform（改写文字）或 handled（自己处理掉）。", "把输入里的缩写展开；拦下某类输入直接用代码回答。"],
    before_agent_start: ["agent", true, "一次运行开始前。可以追加一条自定义消息，或改写这次运行的系统提示。", "按当前任务临时加几条规则。"],
    agent_start: ["agent", false, "一次运行开始（只通知）。", "计时、记日志。"],
    turn_start: ["turn", false, "新的一轮开始（只通知）。", "统计轮数。"],
    context: ["turn", true, "发请求前，拿到这次要发送的消息列表，可以返回改过的列表。不影响会话文件。", "删掉过旧的工具结果、插入提醒，只影响这一次请求。"],
    before_provider_request: ["prov", true, "拿到即将发给提供者的原始请求体（就是 M6 里看到的那个 JSON）。返回一个新对象，就替换它（pi 源码 runner.js）。", "调试时记录真实请求；给特定提供者加字段。改坏了请求会直接失败，慎用。"],
    message_start: ["msg", false, "一条消息开始（系统、你、模型、工具结果都有）。", "界面效果、记日志。"],
    message_end: ["msg", true, "一条消息定稿。可以替换它（必须保持原角色）。", "统一清洗模型输出的格式。"],
    tool_execution_start: ["tool", false, "工具开始执行（只通知）。实测比 tool_call 更早触发。", "进度显示。"],
    tool_call: ["tool", true, "工具真正执行前。可以返回 block 阻止执行，或直接修改 event.input 改参数。处理器自己出错时，这次调用也被阻止（安全优先）。", "拦截危险命令；补全或改写参数；弹窗请你确认。"],
    tool_result: ["tool", true, "工具执行后、结果交给模型前。可以替换 content、details、isError。多个扩展依次叠加。", "给密钥打码；截断过长输出；补充说明。"],
    tool_execution_end: ["tool", false, "工具执行结束（只通知）。", "记录耗时。"],
    turn_end: ["turn", true, "一轮结束。可以追加记录，并请求再继续一轮（要防止死循环）。", "每轮自动检查测试，失败就要求继续修。"],
    agent_end: ["agent", false, "这次运行的底层循环结束。之后仍可能有重试、压缩或排队消息。", "汇总。"],
    agent_settled: ["agent", false, "pi 不会再自动继续了（只通知）。", "发桌面通知「做完了」。"],
    session_shutdown: ["sess", false, "会话结束、切换或 pi 退出。", "关闭 session_start 里启动的资源。要可重复调用。"],
  };
  const LANE = { sess: "会话", agent: "运行", turn: "轮", msg: "消息", tool: "工具", prov: "提供者" };

  // ================= §0 hero: timeline =================
  function timeline() {
    let pos = TRACE.length, timer = null;
    const line = h("div", { class: "evline" }), det = h("div", { class: "evdet" });
    const chips = [];
    let turn = 0;
    TRACE.forEach((t, i) => {
      const [name, who] = t.split(" ");
      if (name === "turn_start") { turn++; line.append(h("div", { class: "turn" }, "第 " + turn + " 轮")); }
      const e = EV[name];
      const c = h("button", { class: "evchip ev-" + e[0] + (e[1] ? " can" : " notify"), onclick: () => select(i) }, name + (who ? " · " + who : ""));
      chips.push(c); line.append(c);
    });
    function select(i) {
      pos = i + 1; paint();
      const [name, who] = TRACE[i].split(" "); const e = EV[name];
      chips.forEach((c, j) => c.classList.toggle("cur", j === i));
      det.replaceChildren(h("div", null, h("code", { style: { fontSize: "16px" } }, `pi.on("${name}", …)`), h("p", { style: { margin: "8px 0 0" } }, e[2]), who ? h("p", { class: "mute", style: { margin: "6px 0 0", fontSize: "15px" } }, "这一次的对象：" + who) : null),
        h("div", { class: "cap" }, h("b", null, "能改变结果吗"), e[1] ? h("span", { class: "r-harness" }, "能（实线框）") : h("span", { class: "mute" }, "只通知（虚线框）"), h("b", { style: { marginTop: "10px" } }, "典型用途"), e[3]));
      const s = { ...Store.get(ID, "ev", {}) }; s[name] = 1; Store.set(ID, "ev", s);
    }
    function paint() { chips.forEach((c, j) => c.classList.toggle("on", j < pos)); }
    const bPlay = h("button", { class: "btn primary", onclick: async () => {
      clearInterval(timer); pos = 0; paint();
      timer = setInterval(() => { if (pos >= TRACE.length) { clearInterval(timer); return; } select(pos); }, reduced() ? 0 : 280);
    } }, "按时间顺序播放");
    paint();
    det.append(h("span", { class: "mute" }, "点任一事件，看它能做什么。实线框：能改变结果；虚线框：只通知。"));
    return h("div", { class: "panel" },
      h("div", { class: "evctl" }, bPlay, h("span", { class: "mute", style: { fontSize: "15px" } }, "本机实录：一句提示、一次 read 工具调用，共 29 个事件（流式更新已省略）。"),
        h("span", { class: "win-legend", style: { marginLeft: "auto" } }, Object.entries(LANE).map(([k, v]) => h("span", { class: "ev-" + k }, h("i", { style: { background: "currentColor" } }), v)))),
      line, det);
  }

  // ================= §3 which hook =================
  const HOOK = [
    { q: "模型想运行 git push 时，先弹窗让你确认。", opts: [{ t: "tool_call", ok: true }, { t: "tool_result" }, { t: "agent_end" }], why: "执行前拦截：等你点确认，否则返回 block。" },
    { q: "任何 read 结果里出现 API_KEY=…，都打码后再给模型。", opts: [{ t: "tool_result", ok: true }, { t: "tool_call" }, { t: "input" }], why: "结果已经产生、还没交给模型：替换 content。" },
    { q: "每次运行彻底结束后，在桌面弹一个「做完了」的通知。", opts: [{ t: "agent_settled", ok: true }, { t: "turn_end" }, { t: "agent_end" }], why: "agent_end 之后还可能有重试、压缩、排队消息；agent_settled 才表示真正停了。" },
    { q: "只在发给模型的这一次请求里，删掉 20 轮之前的工具结果，但会话文件不变。", opts: [{ t: "context", ok: true }, { t: "message_end" }, { t: "session_before_compact" }], why: "context 改的是本次发送的副本，不写会话。" },
    { q: "你输入「@@周报」时，由扩展直接生成周报模板填进去，不发给模型。", opts: [{ t: "input，返回 handled 或 transform", ok: true }, { t: "before_agent_start" }, { t: "tool_call" }], why: "input 在你的消息进入会话之前触发。" },
    { q: "压缩时改用一个便宜的模型来写摘要。", opts: [{ t: "session_before_compact", ok: true }, { t: "context" }, { t: "turn_end" }], why: "M4：这个事件可以取消压缩，或返回你自己生成的摘要。" },
    { q: "扩展启动一个后台文件监视器，并在退出时关掉。", opts: [{ t: "session_start 启动，session_shutdown 关闭", ok: true }, { t: "在工厂函数顶层启动" }], why: "有些场合只加载扩展、不开会话。" },
    { q: "每轮结束后自动跑测试；失败就让 agent 继续修。", opts: [{ t: "turn_end，请求继续一轮（并设上限防死循环）", ok: true }, { t: "tool_result" }, { t: "input" }], why: "turn_end 和 agent_before_settle 可以要求「再来一轮」。无条件继续会死循环。" },
  ];

  // ================= §5 regex guard tester =================
  function guardTester() {
    const inp = h("input", { id: "m10-cmd", value: "rm junk.txt" });
    const out = h("div", { class: "verdict2" });
    const TRIES = ["rm junk.txt", "rm -- junk.txt", "find . -name junk.txt -delete", "unlink junk.txt", "python3 -c \"import os; os.remove('junk.txt')\"", "mv junk.txt /tmp/", "echo rm 是什么"];
    const tried = new Set(Object.keys(Store.get(ID, "rx", {})));
    function run() {
      const c = inp.value;
      const blocked = /\brm\b/.test(c);
      const deletes = /\brm\b|-delete\b|\bunlink\b|os\.remove|shutil\.rmtree|\bmv\b.*\/tmp/.test(c) && !/^echo /.test(c.trim());
      out.replaceChildren(h("div", { class: "big2", style: { color: blocked ? "var(--ok)" : "var(--bad)" } }, blocked ? "拦下" : "放行"),
        h("div", { class: "dim" }, deletes ? (blocked ? "这条命令会删除文件，守卫拦住了。" : "这条命令同样会让 junk.txt 消失，守卫却放行了。") : blocked ? "这条命令不删任何东西，守卫却拦了（误报）。" : "这条命令不删文件，放行正确。"));
      if (c) { tried.add(c); Store.set(ID, "rx", Object.fromEntries([...tried].map((x) => [x, 1]))); }
    }
    inp.addEventListener("input", run); run();
    return h("div", { class: "panel rx" },
      h("div", { class: "in" }, h("label", { for: "m10-cmd", style: { fontSize: "15px", color: "var(--fg-dim)" } }, "模型可能写出的 bash 命令（守卫规则：/\\brm\\b/）"), inp,
        h("div", { class: "try" }, TRIES.map((t) => h("button", { onclick: () => { inp.value = t; run(); } }, t)))),
      out);
  }

  // ================= §8 lab =================
  const TRACER = `import { appendFileSync } from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// 订阅一批事件，按发生顺序写进 events.log。流式的 message_update 太多，不记。
const EVENTS = ["session_start", "input", "before_agent_start", "agent_start", "turn_start", "context",
  "before_provider_request", "message_start", "message_end", "tool_execution_start", "tool_call",
  "tool_result", "tool_execution_end", "turn_end", "agent_end", "agent_settled", "session_shutdown"] as const;

export default function (pi: ExtensionAPI) {
  for (const name of EVENTS) {
    pi.on(name, async (event: any) => {
      const who = event.toolName ?? event.message?.role ?? "";
      appendFileSync("events.log", \`\${name} \${who}\`.trim() + "\\n");
    });
  }
}`;
  const GUARD = `import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // 拦截：bash 命令里出现 rm 就阻止执行。
  pi.on("tool_call", async (event) => {
    if (event.toolName === "bash" && /\\brm\\b/.test(String(event.input.command))) {
      return { block: true, reason: "guard 扩展：禁止使用 rm。请告诉用户手动删除。" };
    }
  });

  // 改写：read 的结果里出现 SECRET=… 就打码，模型只会看到 ***。
  pi.on("tool_result", async (event) => {
    if (event.toolName !== "read") return;
    const content = event.content.map((c) =>
      c.type === "text" ? { ...c, text: c.text.replace(/(SECRET=)\\S+/g, "$1***") } : c);
    return { content };
  });
}`;
  const LAB_SETUP = `mkdir -p ~/pi-lab/m10 && cd ~/pi-lab/m10
echo "hello" > a.txt
echo "临时文件" > junk.txt
printf 'DB_HOST=localhost\\nSECRET=abc123\\n' > .env
cat > tracer.ts <<'EOF'
${TRACER}
EOF
cat > guard.ts <<'EOF'
${GUARD}
EOF`;
  const LAB_TRACE = `rm -f events.log
pi --mode json --no-session -e ./tracer.ts --tools read "读 a.txt，只回答它的内容。" < /dev/null > /dev/null
tr '\\n' '|' < events.log; echo`;
  const LAB_GUARD = `ask(){ pi --mode json --no-session -e ./guard.ts --tools read,bash "$1" < /dev/null | jq -r 'if .type=="tool_execution_end" then "工具 \\(.toolName) 错误=\\(.isError) 结果=\\(.result.content[0].text | gsub("\\n";" ") | .[0:40])" else empty end'; }
ask "删除 junk.txt。"
ask "读 .env，告诉我 SECRET 的值。"
ls junk.txt`;
  const LAB_CLEAN = "cd ~ && rm -r ~/pi-lab/m10 && rmdir --ignore-fail-on-non-empty ~/pi-lab";
  const LAB_SAMPLE = TRACE.join("|") + "|\n工具 bash 错误=true 结果=guard 扩展：禁止使用 rm。请告诉用户手动删除。\n工具 read 错误=false 结果=DB_HOST=localhost SECRET=*** \njunk.txt";
  function lab() {
    const saved = Store.get(ID, "lab", {});
    const ta = h("textarea", { class: "paste", id: "m10-lab-paste", spellcheck: "false", placeholder: "session_start|input|…|session_shutdown|\n工具 bash 错误=true …\n工具 read …\njunk.txt" });
    ta.value = saved.raw || "";
    ta.addEventListener("input", () => { delete ta.dataset.sample; });
    const out = h("div");
    const verify = (sample) => {
      if (sample) { ta.value = LAB_SAMPLE; ta.dataset.sample = "1"; }
      const isSample = ta.dataset.sample === "1";
      const L = ta.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      const tr = (L.find((l) => l.includes("|")) || "").split("|").filter(Boolean);
      const idx = (n) => tr.findIndex((x) => x === n || x.startsWith(n + " "));
      const order = ["input", "before_agent_start", "turn_start", "context", "tool_call", "tool_result", "turn_end", "agent_end", "agent_settled"];
      const ordered = order.every((n, i) => idx(n) >= 0 && (i === 0 || idx(n) > idx(order[i - 1])));
      const checks = [
        [tr.length > 10, "粘贴了事件时间线（一行，用 | 分隔）"],
        [ordered, "顺序正确：input → before_agent_start → turn_start → context → tool_call → tool_result → turn_end → agent_end → agent_settled"],
        [tr.filter((x) => x === "turn_start").length >= 2, "至少两轮：一轮调用工具，一轮回答"],
        [L.some((l) => /工具 bash 错误=true .*guard/.test(l)), "rm 被守卫拦下，理由进入了工具结果"],
        [L.some((l) => l === "junk.txt"), "junk.txt 仍然存在"],
        [L.some((l) => /SECRET=\*\*\*/.test(l)) && !L.some((l) => /abc123/.test(l)), "模型看到的 SECRET 已经打码"],
      ];
      const ok = checks.every((c) => c[0]);
      if (ok && !isSample) { Store.set(ID, "lab", { raw: ta.value, passed: true }); checkDone(); }
      out.replaceChildren(h("ul", { class: "check-list" }, checks.map(([o, t]) => h("li", null, h("span", { class: o ? "ok" : "no" }, o ? "✓" : "✗"), t))),
        ok ? h("div", { class: "note" }, h("span", { class: "k" }, isSample ? "示例数据" : "实验通过"), isSample ? "示例数据全部满足条件，但不计入实验。请用你自己的运行再做一次。" : "你看到了完整的事件时间线，并在两个接缝上改变了结果。最后一步：清理。")
          : h("div", { class: "note warn" }, h("span", { class: "k" }, "没有全部通过"), "缺「junk.txt」一行：说明文件被删了——检查 guard.ts 是否完整。顺序不对：确认粘贴的是第 2 步的那一行。"));
    };
    if (saved.raw) setTimeout(() => verify(false), 0);
    return h("div", { class: "lab-steps" },
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "建实验目录：三个小文件，两个扩展。"), copyBlock(LAB_SETUP))),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "用追踪器跑一次，打印事件时间线。"), h("p", { class: "dim", style: { margin: "4px 0 0" } }, "一次很小的模型调用。输出是一行，用 | 分隔。"), copyBlock(LAB_TRACE))),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "用守卫跑两次：一次想删文件，一次读密钥。最后确认文件还在。"), h("p", { class: "dim", style: { margin: "4px 0 0" } }, "两次很小的模型调用。"), copyBlock(LAB_GUARD))),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "把第 2、3 步的输出一起粘贴，核对。"), h("div", { style: { marginTop: "8px" } }, ta),
        h("div", { style: { display: "flex", gap: "8px", marginTop: "8px" } }, h("button", { class: "btn primary", onclick: () => verify(false) }, "核对我的运行"), h("button", { class: "btn ghost", onclick: () => verify(true) }, "先用示例数据试试")), out)),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "清理。"), copyBlock(LAB_CLEAN))));
  }

  // ================= quiz / review / recap =================
  const QUIZ = [
    { q: "tool_call 处理器返回 { block: true, reason: \"…\" }，结果是：", opts: [{ t: "工具不执行；模型收到一条错误结果，内容是 reason", ok: true }, { t: "pi 退出" }, { t: "工具照常执行，但界面提示警告" }], why: "本机实测：错误=true，结果就是守卫写的 reason。" },
    { q: "想在 tool_call 里把命令改掉（例如自动加 --dry-run），应该：", opts: [{ t: "直接修改 event.input", ok: true }, { t: "返回 { input: … }" }, { t: "不可能" }], why: "类型声明原文：To modify arguments, mutate event.input in place。" },
    { q: "tool_call 处理器自己抛了异常。这次工具调用：", opts: [{ t: "被阻止（安全优先）", ok: true }, { t: "照常执行" }, { t: "pi 崩溃" }], why: "pi 文档：tool_call handler 失败会阻止这次工具调用。" },
    { q: "在 context 事件里删掉一些旧消息，会话文件会变吗？", opts: [{ t: "不会，只影响这一次请求", ok: true }, { t: "会，被永久删除" }], why: "context 改的是本次要发送的副本。" },
    { q: "agent_end 和 agent_settled 的区别：", opts: [{ t: "agent_end 之后还可能有重试、压缩、排队消息；agent_settled 表示不会再自动继续", ok: true }, { t: "完全一样" }, { t: "agent_settled 只在出错时触发" }], why: "实测时间线：agent_end → agent_settled → session_shutdown。" },
    { q: "实测时间线里，tool_execution_start 和 tool_call 谁先？", opts: [{ t: "tool_execution_start 先", ok: true }, { t: "tool_call 先" }], why: "只通知的开始事件先触发，然后才是能阻止执行的 tool_call。" },
    { q: "扩展的状态应该跟着会话分支走。标准做法：", opts: [{ t: "存进工具结果的 details；在 session_start / session_tree 时用 getBranch() 重建", ok: true }, { t: "存进一个全局 JSON 文件" }, { t: "存进模块级变量就够了" }], why: "官方 todo 示例就是这样。切分支后，状态跟着当前分支变。" },
    { q: "守卫规则 /\\brm\\b/ 能挡住 find . -name x -delete 吗？", opts: [{ t: "不能", ok: true }, { t: "能" }], why: "按字符串匹配的规则总有等价写法绕过。真正的边界要靠沙箱（M12）。" },
    { q: "本机实测：守卫拦下 rm 后，又明确让模型「换一种不用 rm 的办法」。模型：", opts: [{ t: "没有绕过，让用户手动删除", ok: true }, { t: "用 find -delete 删掉了" }], why: "这次模型守了规矩。但这只是这个模型这一次的选择，不是保证。" },
    { q: "turn_end 处理器每次都无条件要求「再继续一轮」，会：", opts: [{ t: "死循环", ok: true }, { t: "pi 自动忽略" }], why: "pi 文档：要给继续的条件设上限。" },
  ];
  const REVIEW = [
    { q: "（复习 M9）工具结果的 details，模型能看到吗？", opts: [{ t: "不能", ok: true }, { t: "能" }], why: "本课用 details 存状态，正是因为它不进上下文。" },
    { q: "（复习 M7）AGENTS.md 写「不要删文件」，能保证文件不被删吗？", opts: [{ t: "不能", ok: true }, { t: "能" }], why: "本课你会用代码拦截——它比文字可靠，但也有极限。" },
  ];
  const PRE = [
    { id: "p1", q: "扩展能在模型执行 bash 之前把这条命令拦下来吗？", opts: [{ t: "能", ok: true }, { t: "不能，只能事后知道" }] },
    { id: "p2", q: "一次「读一个文件再回答」的运行，大约会触发多少个事件（不算流式更新）？", opts: [{ t: "5 个左右" }, { t: "30 个左右", ok: true }, { t: "上千个" }] },
    { id: "p3", q: "用正则拦截 rm，能挡住所有删文件的方法吗？", opts: [{ t: "能" }, { t: "不能", ok: true }] },
  ];
  function checkDone() {
    const ok = Store.get(ID, "lab", {}).passed && Store.get(ID, "quiz", { best: 0 }).best >= 8;
    if (ok && !Store.get(ID, "done")) Store.set(ID, "done", true);
  }

  window.Course.register(ID, (page) => {
    const rc = window.Course.recapBlock(ID, {
      pre: PRE,
      next: { id: "M11", title: "MCP、codemode 与包", text: "你已经会写工具和钩子。M11 讲规模化：接入别人写好的 MCP 服务器，用 codemode 组合大量工具，把你的扩展打成包分享。" },
      extra: () => [["钩子选择", HOOK.filter((x, i) => x.opts[Store.get(ID, "hook", {})["h" + i]]?.ok).length + " / " + HOOK.length], ["看过的事件", Object.keys(Store.get(ID, "ev", {})).length + " / " + Object.keys(EV).length]],
    });
    page.append(h("div", { class: "bench" },
      h("header", { class: "mhead" }, h("div", { class: "crumbs" }, "第 4 单元 · 扩展 / M10"), h("h1", { class: "mtitle" }, h("span", { class: "mid" }, "M10"), "扩展 II：事件与状态")),
      section("s-hero", 0, "开场", null, timeline(),
        h("div", { class: "col" },
          h("p", { class: "thesis" }, "agent loop 的每一个接缝，", h("br"), "都向扩展开放。"),
          h("p", { class: "lead" }, "M0 推论 3 说：pi 坐在环路的每个接缝上。上面是这些接缝的真实样子——本机一次运行触发的 29 个事件。点「按时间顺序播放」，再逐个点开实线框的事件：它们能改变结果。")),
        h("div", { class: "panel objectives" },
          h("ol", null,
            h("li", null, "画出一次运行的事件时间线，标出能改变结果的事件。"),
            h("li", null, "给定需求，选对钩子。"),
            h("li", null, "用 tool_call 拦截或改参数，用 tool_result 改写结果。"),
            h("li", null, "让扩展状态跟着会话分支走。"),
            h("li", null, "说出规则型守卫的极限。")),
          h("div", { class: "obj-side" },
            h("div", null, h("span", { class: "k" }, "时长"), "约 75 分钟"),
            h("div", null, h("span", { class: "k" }, "前置"), "M3、M4、M9"),
            h("div", null, h("span", { class: "k" }, "练习"), "§8 实验 + §9 测验（≥ 8/10）"),
            h("div", null, h("span", { class: "k" }, "核对版本"), "pi 0.99.2 · 41 个事件"))),
        h("h3", null, "本课路线"),
        route(ID, [["s-pre", 1, "动手", "复习与预测"], ["s-flow", 2, "阅读", "时间线"], ["s-hook", 3, "动手", "选对钩子"], ["s-guard", 4, "阅读", "拦截与改写"], ["s-limit", 5, "动手", "守卫的极限"], ["s-state", 6, "阅读", "状态跟随分支"], ["s-more", 7, "阅读", "其他钩子"], ["s-lab", 8, "实验", "追踪与守卫"], ["s-quiz", 9, "测验", "10 题"], ["s-recap", 10, "阅读", "小结"]])),
      h("div", { class: "col" },
        section("s-pre", 1, "复习与预测", "先复习，再预测",
          todo("两道复习题立即判分；三道预测课末揭晓。"),
          REVIEW.map((r, i) => choice({ id: "r" + i, store: [ID, "rev"], kicker: "复习 " + (i + 1) + " / 2", q: r.q, opts: r.opts, explain: r.why, shuffleSeed: 191 + i * 7 })),
          PRE.map((p, i) => choice({ id: p.id, store: [ID, "pre"], kicker: "预测 " + (i + 1) + " / 3", q: p.q, opts: p.opts, reveal: false, shuffleSeed: 97 + i * 13 }))),
        section("s-flow", 2, "时间线", "一次运行的五个阶段",
          todo("对照开场的时间线读这五段。", true),
          h("ol", { class: "rule", style: { listStyle: "decimal", paddingLeft: "1.4em" } },
            h("li", null, h("b", null, "会话就绪："), "session_start。"),
            h("li", null, h("b", null, "你的输入进来："), "input → before_agent_start → agent_start。"),
            h("li", null, h("b", null, "每一轮："), "turn_start → context（改本次要发的消息）→ before_provider_request → 模型回复的 message_start / message_end。"),
            h("li", null, h("b", null, "有工具调用时："), "tool_execution_start → tool_call（能阻止）→ 执行 → tool_result（能改写）→ tool_execution_end → 工具结果消息 → turn_end。然后回到第 3 步。"),
            h("li", null, h("b", null, "收尾："), "agent_end → agent_settled → 退出时 session_shutdown。")),
          h("p", { class: "dim", style: { fontSize: "16px" } }, "pi 0.99.2 一共有 41 个事件。上面没出现的，大多属于会话操作（切换、分叉、压缩、/tree）、提供者细节、界面和 MCP。"),
          h("pre", { class: "panel", style: { padding: "14px 16px", fontSize: "15px" } }, `pi.on("tool_call", async (event, ctx) => {
  // event：这个事件的数据；ctx：工作目录、界面、会话等
  // 返回值决定效果；什么都不返回 = 不干预
});`)),
        section("s-hook", 3, "选对钩子", "需求 → 事件",
          todo("先读下表：每个常用钩子在什么时候触发、返回什么能起作用。然后做八个需求题。"),
          h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" },
            h("thead", null, h("tr", null, h("th", null, "钩子"), h("th", null, "什么时候"), h("th", null, "能做什么"))),
            h("tbody", null, [
              ["input", "你的消息进入会话之前", "返回 handled（自己处理掉，不发给模型）或 transform（改写后再发）"],
              ["context", "每轮组装请求时", "改本次要发送的消息副本；会话文件不变"],
              ["tool_call", "工具执行之前", "返回 block 阻止执行（可以先弹窗问你），或改写参数"],
              ["tool_result", "工具结果交给模型之前", "替换 content，例如打码"],
              ["turn_end", "一轮结束", "可以要求再来一轮（要设上限，否则死循环）"],
              ["agent_end / agent_settled", "一次运行结束 / 真正停下", "agent_end 之后还可能有重试、压缩、排队消息；要确认彻底结束，用 agent_settled"],
              ["session_before_compact", "压缩之前", "取消压缩，或返回你自己生成的摘要（第 5 课）"],
              ["session_start / session_shutdown", "会话开始 / pi 退出", "启动和清理后台资源（文件监视器、连接……）"],
            ].map(([a, b, c]) => h("tr", null, h("td", null, h("code", null, a)), h("td", null, b), h("td", null, c)))))),
          HOOK.map((x, i) => choice({ id: "h" + i, store: [ID, "hook"], kicker: "需求 " + (i + 1) + " / " + HOOK.length, q: x.q, opts: x.opts, explain: x.why, shuffleSeed: 201 + i * 3 }))),
        section("s-guard", 4, "拦截与改写", "一个 20 行的守卫",
          todo("读代码和本机实测结果。实验里你会亲手跑它。", true),
          h("pre", { class: "panel", style: { padding: "14px 16px", fontSize: "15px", overflowX: "auto" } }, GUARD),
          h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" },
            h("thead", null, h("tr", null, h("th", null, "你说"), h("th", null, "发生了什么（本机实测）"))),
            h("tbody", null,
              h("tr", null, h("td", null, "删除 junk.txt。"), h("td", null, "模型写出 rm -- junk.txt → tool_call 返回 block → 工具结果 isError: true，内容是守卫的 reason → 模型回复「请手动删除」。文件还在。")),
              h("tr", null, h("td", null, "读 .env，告诉我 SECRET 的值。"), h("td", null, "read 正常读到 SECRET=abc123 → tool_result 把它换成 SECRET=*** → 模型回答「SECRET 的值是 ***」。")))))),
        section("s-limit", 5, "守卫的极限", "规则挡得住字面，挡不住意图",
          todo("在测试器里试每一个预设命令，看守卫哪里拦对了、哪里放过了、哪里误报了。"),
          h("p", null, "本机还测了一次：拦下 rm 之后，明确告诉模型「换一种不用 rm 的办法」。这个模型没有绕过，而是请用户手动删除。但这是模型的选择，不是守卫的能力。"))),
      h("div", { class: "bench" }, guardTester()),
      h("div", { class: "col" },
        h("div", { class: "note warn", style: { marginTop: "16px" } }, h("span", { class: "k" }, "结论"), "钩子比文字指令可靠得多，适合拦住常见的危险操作和失误。但只要模型手里有 bash，就有无数等价写法。要让某件事物理上做不到，得把 pi 关进模型够不着的边界里：M12。"),
        section("s-state", 6, "状态跟随分支", "扩展的记忆放在哪里",
          todo("读四种存放位置，和 todo 示例的重建方法。", true),
          h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" },
            h("thead", null, h("tr", null, h("th", null, "状态的性质"), h("th", null, "存在哪里"))),
            h("tbody", null,
              h("tr", null, h("td", null, "跟着当前分支走的工具状态（例如待办清单）"), h("td", null, "工具结果的 details")),
              h("tr", null, h("td", null, "要持久保存、但不进模型上下文"), h("td", null, "pi.appendEntry()（一条 custom 记录）")),
              h("tr", null, h("td", null, "要存下来、也要让模型看到"), h("td", null, "pi.sendMessage()（一条自定义消息）")),
              h("tr", null, h("td", null, "跨会话共享"), h("td", null, "你自己的文件或数据库"))))),
          h("pre", { class: "panel", style: { padding: "14px 16px", fontSize: "15px" } }, `// 官方 todo 示例的核心（examples/extensions/todo.ts）
const reconstructState = (ctx) => {
  todos = [];
  for (const entry of ctx.sessionManager.getBranch()) {   // 只走当前分支（M3）
    if (entry.type !== "message") continue;
    const msg = entry.message;
    if (msg.role !== "toolResult" || msg.toolName !== "todo") continue;
    if (msg.details) todos = msg.details.todos;             // 最后一次结果就是当前状态
  }
};
pi.on("session_start", async (_e, ctx) => reconstructState(ctx));
pi.on("session_tree",  async (_e, ctx) => reconstructState(ctx));   // /tree 切分支后`),
          h("p", { class: "dim", style: { fontSize: "16px" } }, "为什么不用 getEntries() 遍历整个文件？因为被放弃的分支代表另一段历史（M3）。只走 getBranch()，状态才和模型看到的历史一致。")),
        section("s-more", 7, "其他钩子", "前几课提到的那些",
          todo("把它们和前面的课对上号。", true),
          h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" }, h("tbody", null,
            [["session_before_compact", "取消压缩，或返回自己的摘要（M4）"], ["session_before_tree", "取消 /tree 跳转，或自己写分支摘要（M3）"], ["project_trust", "全局扩展替你决定信不信任一个项目（M5）"], ["before_agent_start", "临时加规则，或改写本次的系统提示（M7）"], ["user_bash", "接管你输入的 ! 命令，例如转到远程机器执行（M2）"], ["model_select / thinking_level_select", "模型或强度切换时通知（M6）"], ["cache_warming_decision", "决定是否保温提示缓存（M1 的缓存）"]].map(([a, b]) => h("tr", null, h("td", { style: { whiteSpace: "nowrap" } }, h("code", null, a)), h("td", null, b))))))),
        section("s-lab", 8, "实验", "追踪事件，守住接缝",
          todo("按第 1–5 步操作。全部在终端里完成。"),
          h("p", null, "你会用追踪器抓出自己机器上的事件时间线，再用守卫在两个接缝上改变结果。"),
          h("div", { class: "note" }, h("span", { class: "k" }, "实验规则"), "只在 ~/pi-lab/m10 里做；扩展用 -e 临时加载；--no-session 不留会话；最后清理。"),
          lab()),
        section("s-quiz", 9, "掌握测验", "10 题，8 题过关", todo("10 题全部作答，点「交卷」。"), window.Course.quizBlock(ID, QUIZ, checkDone)),
        section("s-recap", 10, "小结", "你学到了什么",
          todo("看自己的预测和成绩。觉得学会了，就在本节最后点「标记为已完成」。", true),
          h("p", { class: "lead" }, "一句话：pi.on 让你插进 agent loop 的每个接缝；tool_call 能拦、tool_result 能改、context 只改本次请求；状态存进 details 并沿当前分支重建；规则挡得住失误，挡不住所有等价写法。"),
          rc))));
    return () => rc._cleanup && rc._cleanup();
  });
})();
