/* M10 · 扩展 II：事件与状态 */
(function () {
  "use strict";
  const { h, reduced, section, quizBlock, lessonHead, look, howto, endBlock } = window.Course;
  const ID = "M10";

  // Real event order recorded by a tracer extension (pi 0.99.2): one prompt, one read tool call.
  const TRACE = "session_start|input|before_agent_start|agent_start|turn_start|message_start system|message_end system|message_start user|message_end user|context|before_provider_request|message_start assistant|message_end assistant|tool_execution_start read|tool_call read|tool_result read|tool_execution_end read|message_start toolResult|message_end toolResult|turn_end assistant|turn_start|context|before_provider_request|message_start assistant|message_end assistant|turn_end assistant|agent_end|agent_settled|session_shutdown".split("|");
  // name: [lane, can change the outcome?, what it is]
  const EV = {
    session_start: ["sess", false, "会话开始（或切换到另一个会话）。适合启动后台资源。"],
    input: ["agent", true, "你的消息进入会话之前。可以改写它，或者用代码直接处理掉、不发给模型。"],
    before_agent_start: ["agent", true, "一次运行开始前。可以临时加几条规则。"],
    agent_start: ["agent", false, "一次运行开始。"],
    turn_start: ["turn", false, "新的一轮开始。"],
    context: ["turn", true, "发请求前，拿到这次要发的消息列表，可以改。只影响这一次请求，会话文件不变。"],
    before_provider_request: ["prov", true, "拿到即将发给提供者的原始请求，可以替换。改坏了请求会直接失败，一般只用来调试。"],
    message_start: ["msg", false, "一条消息开始（你的、模型的、工具结果都有）。"],
    message_end: ["msg", true, "一条消息定稿。可以替换它的内容。"],
    tool_execution_start: ["tool", false, "工具开始执行（只是通知，比 tool_call 还早）。"],
    tool_call: ["tool", true, "工具真正执行之前。可以阻止执行，或修改参数。最常用的安全钩子。"],
    tool_result: ["tool", true, "工具执行完、结果交给模型之前。可以替换结果，比如给密钥打码。"],
    tool_execution_end: ["tool", false, "工具执行结束。"],
    turn_end: ["turn", true, "一轮结束。可以要求再来一轮（要设上限，否则会死循环）。"],
    agent_end: ["agent", false, "这次运行的循环结束。之后仍可能有重试、压缩或排队的消息。"],
    agent_settled: ["agent", false, "pi 确定不会再自动继续了。适合发「做完了」的通知。"],
    session_shutdown: ["sess", false, "会话结束或 pi 退出。关闭 session_start 里启动的资源。"],
  };
  const LANE = { sess: "会话", agent: "运行", turn: "轮", msg: "消息", tool: "工具", prov: "提供者" };

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
      det.replaceChildren(h("div", null, h("code", { style: { fontSize: "16px" } }, name), h("p", { style: { margin: "8px 0 0" } }, e[2]), who ? h("p", { class: "mute", style: { margin: "6px 0 0", fontSize: "15px" } }, "这一次涉及：" + who) : null),
        h("div", { class: "cap" }, h("b", null, "能改变结果吗"), e[1] ? h("span", { class: "r-harness" }, "能（实线框）") : h("span", { class: "mute" }, "不能，只是通知（虚线框）")));
    }
    function paint() { chips.forEach((c, j) => c.classList.toggle("on", j < pos)); }
    const bPlay = h("button", { class: "btn primary", onclick: () => {
      clearInterval(timer); pos = 0; paint();
      timer = setInterval(() => { if (pos >= TRACE.length) { clearInterval(timer); return; } select(pos); }, reduced() ? 0 : 280);
    } }, "按顺序播放");
    paint();
    det.append(h("span", { class: "mute" }, "点任一事件，看它是什么。"));
    return h("div", { class: "panel" },
      h("div", { class: "evctl" }, bPlay,
        h("span", { class: "win-legend", style: { marginLeft: "auto" } }, Object.entries(LANE).map(([k, v]) => h("span", { class: "ev-" + k }, h("i", { style: { background: "currentColor" } }), v)))),
      line, det);
  }

  function guardTester() {
    const inp = h("input", { id: "m10-cmd", value: "rm junk.txt", "aria-label": "模型可能写出的命令" });
    const out = h("div", { class: "verdict2" });
    const TRIES = ["rm junk.txt", "rm -- junk.txt", "find . -name junk.txt -delete", "unlink junk.txt", "python3 -c \"import os; os.remove('junk.txt')\"", "mv junk.txt /tmp/", "echo rm 是什么"];
    function run() {
      const c = inp.value;
      const blocked = /\brm\b/.test(c);
      const deletes = /\brm\b|-delete\b|\bunlink\b|os\.remove|shutil\.rmtree|\bmv\b.*\/tmp/.test(c) && !/^echo /.test(c.trim());
      out.replaceChildren(h("div", { class: "big2", style: { color: blocked ? "var(--ok)" : "var(--bad)" } }, blocked ? "拦下" : "放行"),
        h("div", { class: "dim" }, deletes ? (blocked ? "这条命令会删文件，守卫拦住了。" : "这条命令同样会让 junk.txt 消失，守卫却放行了。") : blocked ? "这条命令不删任何东西，守卫却拦了（误伤）。" : "这条命令不删文件，放行正确。"));
    }
    inp.addEventListener("input", run); run();
    return h("div", { class: "panel rx" },
      h("div", { class: "in" }, h("label", { for: "m10-cmd", style: { fontSize: "15px", color: "var(--fg-dim)" } }, "模型可能写出的命令（守卫规则：命令里出现单词 rm 就拦）"), inp,
        h("div", { class: "try" }, TRIES.map((t) => h("button", { onclick: () => { inp.value = t; run(); } }, t)))),
      out);
  }

  const GUARD = `import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // 拦截：bash 命令里出现 rm，就不让它执行
  pi.on("tool_call", async (event) => {
    if (event.toolName === "bash" && /\\brm\\b/.test(String(event.input.command))) {
      return { block: true, reason: "guard 扩展：禁止使用 rm。请告诉用户手动删除。" };
    }
  });

  // 改写：read 读到的内容里出现 SECRET=…，打码后再交给模型
  pi.on("tool_result", async (event) => {
    if (event.toolName !== "read") return;
    const content = event.content.map((c) =>
      c.type === "text" ? { ...c, text: c.text.replace(/(SECRET=)\\S+/g, "$1***") } : c);
    return { content };
  });
}`;

  const QUIZ = [
    { q: "想在模型运行 git push 之前弹窗让你确认，用哪个事件？", opts: [{ t: "tool_call", ok: true }, { t: "tool_result" }, { t: "agent_end" }], why: "tool_call 在工具执行之前触发。你不确认，就返回 block 阻止它。" },
    { q: "tool_call 的处理函数返回 { block: true, reason: \"…\" }，结果是：", opts: [{ t: "工具不执行；模型收到一条错误结果，内容就是 reason", ok: true }, { t: "pi 退出" }, { t: "工具照常执行，只是显示警告" }], why: "模型知道被拦了、为什么被拦，可以换个做法或请你手动处理。" },
    { q: "想让模型永远看不到 .env 里的密钥原文，用哪个事件？", opts: [{ t: "tool_result，把结果里的密钥替换成 ***", ok: true }, { t: "input" }, { t: "session_start" }], why: "结果已经产生、还没交给模型时改写它。" },
    { q: "守卫规则「命令里出现 rm 就拦」能挡住 find . -name x -delete 吗？", opts: [{ t: "不能", ok: true }, { t: "能" }], why: "按字面匹配的规则总有别的写法能绕过。它能挡住常见失误，挡不住所有办法；真正的边界靠沙箱（第 13 课）。" },
    { q: "扩展记录的状态（比如待办清单）怎样才能在 /tree 切换分支后保持正确？", opts: [{ t: "把状态存在工具结果的 details 里，切分支后沿当前分支重新读出来", ok: true }, { t: "存在一个全局变量里" }, { t: "写进 AGENTS.md" }], why: "被放弃的分支代表另一段历史。只沿当前分支重建，状态才和模型看到的一致。" },
  ];

  window.Course.register(ID, (page) => {
    page.append(h("div", { class: "col" },
      lessonHead(ID, [
        h("p", null, "上一课的扩展给 pi 加了新工具和新命令。扩展的另一半本事，是在 pi 干活的每一步中间", h("b", null, "插手"), "。"),
        h("p", null, "pi 在每一步都会发出一个", h("b", null, "事件"), "：收到你的消息、发请求之前、执行工具之前、工具出结果之后……扩展可以监听这些事件，有的只能旁观，有的还能改变结果：拦下一条危险命令、把密钥打码、在请求里加一句提醒。这一课讲常用的事件、一个拦截危险命令的例子，以及这种拦截的极限。"),
      ], [
        "什么是事件；一次运行里依次发生哪些事件。",
        "怎样用 tool_call 拦截、用 tool_result 改写。",
        "规则拦截挡不住什么；扩展的状态该存在哪里。",
      ]),

      section("s-flow", 1, "事件", "pi 的每一步都是一个事件",
        h("p", null, "扩展用 pi.on(事件名, 处理函数) 监听事件。事件发生时，pi 调用你的函数，把相关数据交给你："),
        h("pre", null, `pi.on("tool_call", async (event, ctx) => {
  // event：这个事件的数据，比如工具名和参数
  // 什么都不返回 = 不干预；返回特定的值 = 改变结果
});`),
        h("p", null, "事件分两种：", h("b", null, "通知型"), "只告诉你发生了什么；", h("b", null, "可干预型"), "看你的返回值，能阻止、改写或替换。"),
        look("这是一次真实运行（一句话、读一次文件）依次触发的事件。点「按顺序播放」看全过程，再点实线框的事件，看它们能改变什么。")),
      h("div", { class: "bench" }, timeline()),
      h("p", { style: { marginTop: "16px" } }, "大致分五段：会话开始 → 你的消息进来 → 每一轮发请求、收回复 → 有工具调用时执行工具（之后回到下一轮）→ 收尾。和第 1 课的循环一一对应。"),

      section("s-hook", 2, "常用事件", "最常用的几个",
        howto("事件 → 能做什么", [
          ["tool_call", "工具执行之前。返回 block 阻止执行（可以先弹窗问你），或修改参数。"],
          ["tool_result", "工具结果交给模型之前。替换结果，比如打码、截断。"],
          ["input", "你的消息进入会话之前。改写它，或者用代码直接处理掉，不发给模型。"],
          ["context", "每次发请求之前。改这一次要发送的消息，会话文件不变。"],
          ["turn_end", "一轮结束。可以要求「再来一轮」，比如测试没过就让它继续修（一定要设次数上限）。"],
          ["agent_settled", "pi 确定不会再继续了。发桌面通知「做完了」。"],
          ["session_start / session_shutdown", "会话开始 / 结束。启动和关闭后台资源（文件监视、网络连接）。"],
          ["session_before_compact", "压缩之前。取消压缩，或用你自己的方式写摘要（第 5 课）。"],
        ])),

      section("s-guard", 3, "例子", "一个 20 行的守卫",
        h("p", null, "下面这个扩展做两件事：bash 命令里出现 rm 就拦下；read 读到 SECRET=… 就打码。"),
        h("pre", null, GUARD),
        h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" },
          h("thead", null, h("tr", null, h("th", null, "你说"), h("th", null, "实际发生了什么"))),
          h("tbody", null,
            h("tr", null, h("td", null, "删除 junk.txt。"), h("td", null, "模型写出 rm -- junk.txt → 守卫在 tool_call 拦下 → 模型收到错误结果，内容是守卫写的理由 → 模型回复「请手动删除」。文件还在。")),
            h("tr", null, h("td", null, "读 .env，告诉我 SECRET 的值。"), h("td", null, "read 读到 SECRET=abc123 → 守卫在 tool_result 改成 SECRET=*** → 模型回答「SECRET 的值是 ***」。")))))),

      section("s-limit", 4, "极限", "规则挡得住字面，挡不住意图",
        h("p", null, "上面的守卫只认「rm」这个词。可删文件的办法不止一种。"),
        look("点下面每个预设命令，看守卫哪里拦对了、哪里放过了、哪里误伤了。")),
      h("div", { class: "bench" }, guardTester()),
      h("div", { class: "note warn", style: { marginTop: "16px" } }, h("span", { class: "k" }, "结论"), "事件拦截比写在 AGENTS.md 里的文字可靠得多，适合挡住常见的危险操作和失误。但只要模型手里有 bash，就有无数种等价写法。要让某件事真正做不到，得把 pi 放进模型够不着的边界里（第 13 课）。"),

      section("s-state", 5, "状态", "扩展的状态存在哪里",
        h("p", null, "有的扩展要记东西，比如一个待办清单工具要记住当前有哪些待办。难点在于第 4 课的会话树：你用 /tree 切到另一条分支后，清单也应该回到那条分支上的样子。"),
        h("p", null, "标准做法：每次工具调用都把最新的清单放进结果的 details 里（模型看不到它，见上一课）；会话开始或切换分支时，沿", h("b", null, "当前分支"), "找到最后一次的结果，从中读出清单。这样状态永远和模型看到的历史一致。"),
        howto("其他存法", [
          ["pi.appendEntry()", "往会话里存一条记录，不发给模型。"],
          ["pi.sendMessage()", "存一条自定义消息，模型也能看到。"],
          ["你自己的文件或数据库", "要跨会话共享的数据。"],
        ])),

      section("s-quiz", 6, "检查", "检查一下", quizBlock(ID, QUIZ, null, null)),

      section("s-end", 7, "小结", "小结",
        endBlock(ID, [
          "pi 的每一步都会发出事件；扩展用 pi.on 监听，有的只通知，有的能改变结果。",
          "tool_call 在执行前，能阻止或改参数；tool_result 在结果交给模型前，能改写结果。",
          "按字面匹配的拦截挡得住常见失误，挡不住所有等价写法；真正的边界靠沙箱。",
          "扩展状态放在工具结果的 details 里，沿当前分支重建。",
        ], { id: "M11", text: "别人写好的工具怎么接进来：MCP 服务器、codemode，以及把扩展打成包分享。" }))));
  });
})();
