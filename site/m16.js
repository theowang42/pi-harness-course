/* M16 · omp 的编排 */
(function () {
  "use strict";
  const { h, Store, section, quizBlock, lessonHead, look, howto, endBlock } = window.Course;
  const ID = "M16";

  // TTSR replay: content of a real run (omp 18.10.3) with a no-print rule.
  const FIRST = 'print("你好")\n';
  const RETRY = 'import logging\n\nlogging.basicConfig(level=logging.INFO)\nlogging.info("你好")\n';
  const RULE_BODY = "不要用 print。用 logging：先 import logging 并 logging.basicConfig(level=logging.INFO)，再用 logging.info(...) 输出。";
  function ttsrSim() {
    const st = { re: "print\\(", mode: "always", ...Store.get(ID, "sim", {}) };
    const reIn = h("input", { class: "mono", value: st.re, spellcheck: "false", "aria-label": "condition 正则" });
    const modeSel = h("select", { "aria-label": "interruptMode" }, ["always", "never"].map((m) => h("option", { value: m, selected: st.mode === m || null }, m)));
    const stream = h("div", { class: "tt-stream" });
    const log = h("ol", { class: "tt-log" });
    const status = h("div", { class: "tt-status mute" }, "按「播放」，看模型一边写，规则一边盯。");
    let timer = null;
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
    function play() {
      stop();
      st.re = reIn.value; st.mode = modeSel.value; Store.set(ID, "sim", { re: st.re, mode: st.mode });
      let re;
      try { re = new RegExp(st.re); } catch (e) { status.textContent = "正则写错了：" + e.message; return; }
      stream.replaceChildren(); log.replaceChildren();
      const add = (t, cls) => log.append(h("li", { class: cls || "" }, t));
      add("模型开始写：write hello.py，内容是……");
      let attempt = 0, fired = false;
      const run = (text) => {
        const box = h("pre", { class: "tt-buf" + (attempt ? " retry" : "") }, h("span", { class: "lbl" }, attempt ? "第 2 次（重写）" : "第 1 次"), "\n");
        const live = h("span"); box.append(live); stream.append(box);
        let i = 0;
        timer = setInterval(() => {
          i++; live.textContent = text.slice(0, i);
          const hit = !fired && re.test(text.slice(0, i));
          if (hit && st.mode === "always") {
            stop(); fired = true;
            box.classList.add("cut"); box.append(h("span", { class: "scissor" }, "  ✂ 在这里被掐断"));
            add("规则命中 → 立刻中止这次回复", "hit");
            add("这次 write 没有执行，文件没有被写", "hit");
            add("写了一半的回复从上下文里删掉");
            add("把规则正文作为一条隐藏消息交给模型：" + RULE_BODY);
            add("模型自动重写");
            attempt = 1; setTimeout(() => run(RETRY), 600); return;
          }
          if (hit && st.mode === "never" && !fired) { fired = true; add("规则命中，但模式是 never：不打断", "hit"); }
          if (i >= text.length) {
            stop();
            add(`write 执行：hello.py 已写入`, "ok");
            if (fired && st.mode === "never") add("工具结果后面附一条提醒；但文件里已经是 print 的版本", "hit");
            if (!fired) add("规则一次也没命中：它对这次请求没有任何影响，也没花一个 token");
            status.textContent = fired && st.mode === "always" ? "最终文件里没有 print，带 print 的那一版从来没写进磁盘。" : fired ? "never 模式：先放行，再提醒。" : "没有命中。";
          }
        }, 28);
      };
      status.textContent = "播放中……";
      run(FIRST);
    }
    const presets = [["print\\(", "always", "默认：盯 print("], ["print\\(", "never", "只提醒不打断"], ["input\\(", "always", "盯一个不会出现的词"]];
    return h("div", { class: "panel ttsr" },
      h("div", { class: "tt-rule" },
        h("div", { class: "mute", style: { fontSize: "15px" } }, ".omp/rules/no-print.md"),
        h("pre", { class: "script" }, `---
description: Python 代码里不要用 print 输出信息
condition: "print\\\\("
scope: "tool:write(*.py), tool:edit(*.py)"
---
${RULE_BODY}`),
        h("label", { class: "tt-f" }, "condition（要盯的文字，正则）", reIn),
        h("label", { class: "tt-f" }, "interruptMode（命中后怎么办）", modeSel),
        h("div", { class: "tt-presets" }, presets.map(([r, m, t]) => h("button", { class: "btn ghost", onclick: () => { reIn.value = r; modeSel.value = m; play(); } }, t))),
        h("button", { class: "btn primary", onclick: play }, "▶ 播放")),
      h("div", { class: "tt-main" }, h("div", { class: "mute", style: { fontSize: "15px" } }, "模型正在逐字写出 hello.py 的内容（真实运行的两次内容）"), stream, status, log));
  }

  const QUIZ = [
    { q: "主会话的上下文已经很满，还要在 30 个文件里做同一种机械修改。最好：", opts: [{ t: "派子代理去做，它在自己干净的上下文里完成，只交回结果", ok: true }, { t: "主会话自己一个个改" }, { t: "写一条 TTSR 规则" }], why: "子代理有自己的上下文窗口和模型，主会话只收到摘要。" },
    { q: "子代理定义里写 model: \"@fast\"，它用哪个模型？", opts: [{ t: "config.yml 里 modelRoles.fast 指向的那个模型", ok: true }, { t: "和主会话相同" }, { t: "随机挑一个" }], why: "代理文件只写角色，具体模型在一处统一配置，换模型不用改每个代理。" },
    { q: "子代理会因为审批卡住、等你点确认吗？", opts: [{ t: "不会：子代理按 yolo 运行，你批准派出它的那一刻就是授权", ok: true }, { t: "会，每个命令都弹窗" }], why: "子代理里需要询问的调用会直接失败。限制它，要靠定义里的 tools 字段和隔离环境。" },
    { q: "TTSR 规则在没被触发时，占多少上下文？", opts: [{ t: "0：请求里根本没有它", ok: true }, { t: "名字和描述" }, { t: "全文" }], why: "只有模型写出匹配内容时，规则正文才会被交给模型。" },
    { q: "和第 11 课的 tool_call 守卫相比，TTSR 的不同在于：", opts: [{ t: "它在模型还在写的时候就检查，掐断后写错的那版不落盘、也不留在上下文里", ok: true }, { t: "它在工具执行之后才检查" }, { t: "完全一样" }], why: "守卫要等调用写完才拿到参数，拦下后模型收到一个错误；TTSR 像没发生过一样重来。" },
  ];

  window.Course.register(ID, (page) => {
    page.append(h("div", { class: "col" },
      lessonHead(ID, [
        h("p", null, "一个 agent 包办一切，很快会遇到三个问题：上下文被各种杂活撑满；简单的活和难的活用同一个模型，要么太贵要么不够强；团队约定写在 AGENTS.md 里，每轮都占地方，模型还不一定遵守。"),
        h("p", null, "omp 为此提供了三样东西：", h("b", null, "子代理"), "（把一件事交给另一个有独立上下文的 agent）、", h("b", null, "模型角色"), "（按工作类型分配模型）、", h("b", null, "TTSR 规则"), "（平时不占上下文，模型一写出违规内容就当场拉回去重写）。"),
      ], [
        "子代理是什么，怎样定义，它的审批边界在哪里。",
        "模型角色怎样配置。",
        "omp 的三种规则；TTSR 怎样在模型写的过程中拦截。",
      ]),

      section("s-agents", 1, "子代理", "子代理：另一个上下文，另一个模型",
        h("p", null, "omp 的 task 工具会派出一个子代理。它有自己的上下文窗口、工具和模型，做完只把结果交回主会话。主会话不用装下它中间读过的所有文件。"),
        h("p", null, "子代理用一个 Markdown 文件定义，放在项目的 .omp/agents/ 或 ~/.omp/agent/agents/："),
        h("pre", null, `---
name: linecount
description: 统计一个文件有几行，只回答一个数字。只读。
tools: read
model: "@fast"
---
你是行数统计员。读给定的文件，只回答它有几行（一个数字），不要别的话。`),
        h("ul", { class: "rule" },
          h("li", null, h("b", null, "tools："), "它能用哪些工具。不写就是默认工具。"),
          h("li", null, h("b", null, "model："), "写具体模型，或者写 @角色名（§2）。")),
        howto("omp 自带的子代理", [
          ["task", "通用，什么都能做，还能再派子代理。"],
          ["scout", "只读侦察：快速搜代码，压缩成摘要交回。用快而便宜的模型。"],
          ["sonic", "纯机械的修改或数据收集。"],
          ["reviewer", "代码审查：质量与安全。"],
          ["security-reviewer", "只读的安全审查。"],
        ], "交互界面里按 Alt+A 打开 Agent Hub，能看到每个子代理在做什么、用了多少。"),
        h("div", { class: "note warn" }, h("span", { class: "k" }, "审批边界"), "子代理在后台运行，没有界面可以问你，所以它按 yolo 模式运行：你批准派出它的那一刻就是授权。限制它，靠定义里的 tools 字段，以及第 13 课的隔离环境。")),

      section("s-roles", 2, "模型角色", "按工作类型分配模型",
        h("p", null, "omp 不只问「用哪个模型」，而是问「这类工作用哪个模型」。在 config.yml 里写 modelRoles："),
        h("pre", null, `modelRoles:
  default: openai-codex/gpt-6-astra    # 主会话
  smol: openai-codex/gpt-6-luna:low    # 快、便宜：侦察、机械活、起会话标题
  slow: openai-codex/gpt-6-sol:high    # 强：难题
  plan: "@slow"                        # 角色可以指向另一个角色
  fast: openai-codex/gpt-6-luna:low    # 也可以自己起名`),
        h("p", null, "子代理写 model: \"@fast\"，就用 fast 指向的那个模型。想换模型时只改这一处。命令行上也可以临时指定：omp --smol 模型名、--slow 模型名。")),

      section("s-rules", 3, "规则", "omp 的三种规则",
        h("p", null, "规则文件都放在 .omp/rules/（或 ~/.omp/agent/rules/），格式是开头几行信息加正文。开头写了什么，决定它是哪一种："),
        h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" },
          h("thead", null, h("tr", null, h("th", null, "种类"), h("th", null, "开头写了"), h("th", null, "占多少上下文"), h("th", null, "什么时候起作用"))),
          h("tbody", null,
            h("tr", null, h("td", null, h("b", null, "常驻规则")), h("td", null, "alwaysApply: true，或文件名是 RULES.md"), h("td", null, "每轮都占全文"), h("td", null, "一直在，和 AGENTS.md 一样")),
            h("tr", null, h("td", null, h("b", null, "规则手册")), h("td", null, "只有 description"), h("td", null, "每轮只占名字和描述"), h("td", null, "模型觉得相关时自己去读，和 Skill 一样")),
            h("tr", null, h("td", null, h("b", null, "TTSR 规则")), h("td", null, "condition（要盯的文字）"), h("td", null, "0"), h("td", null, "模型写出匹配的内容时：掐断、交出规则、重写"))))),
        h("p", { style: { marginTop: "12px" } }, "omp 还自带 27 条 TTSR 规则，覆盖 Go、Rust、TypeScript 的常见坏习惯（比如 TypeScript 里写 any）。它们只在你改对应语言的文件时才可能触发。")),

      section("s-ttsr", 4, "TTSR", "TTSR：模型一写错就拉回去",
        h("p", null, "TTSR（Time-Traveling Stream Rules）在模型", h("b", null, "一边写一边检查"), "。一旦写出的内容匹配规则：立刻中止这次回复，工具不执行；把写了一半的回复从上下文里删掉；把规则正文交给模型，让它重写。最终效果像是「回到过去」：写错的那一版既没写进磁盘，也没留在对话里。"),
        look("这是一次真实运行的回放：规则禁止在 .py 文件里用 print。先按默认播放；再试「只提醒不打断」，看文件最后是什么样。")),
      h("div", { class: "bench" }, ttsrSim()),
      howto("规则的几个设置", [
        ["condition", "要盯的文字（正则表达式）。"],
        ["scope", "盯哪里。例如 tool:write(*.py) 只盯写 .py 文件的 write。不写就盯回复正文和所有工具参数。"],
        ["interruptMode", "always（默认）：掐断重写。never：放行，在结果后面附一条提醒。"],
        ["repeatMode", "once（默认）：每条规则只触发一次。"],
      ], "写规则时先离线测试，不花 token：omp ttsr test --source tool --tool write --path hello.py 'print(\"你好\")'。omp ttsr list 列出所有规则。"),
      h("p", null, "和第 11 课的 tool_call 守卫比：守卫要等模型把整个调用写完才检查，拦下后模型收到一条错误；TTSR 更早动手，而且把写错的版本整个抹掉。代价是一次中断后的重新生成。"),

      section("s-which", 5, "怎么选", "一条约定，放在哪里",
        howto("场景 → 机制", [
          ["「TypeScript 里永远不许写 any」：平时不相关，写出来就要拦", "TTSR 规则，scope 限定 *.ts。平时零成本。"],
          ["「提交信息必须用英文」：很短，每次都要遵守", "常驻规则（RULES.md）或 AGENTS.md。"],
          ["一本 40 页的部署手册，偶尔才用", "规则手册（只写 description）或 Skill。"],
          ["在 30 个文件里做同一种机械修改", "派子代理（比如 sonic），不占主会话的上下文。"],
        ]),
        h("p", { class: "dim" }, "另外两个功能：advisor 让另一个模型旁听每一轮、必要时插一句建议（--advisor 开启，会额外花 token）；在提示里写小写的 ultrathink，这一轮会让模型更仔细地推理。")),

      section("s-quiz", 6, "检查", "检查一下", quizBlock(ID, QUIZ, null, null)),

      section("s-end", 7, "小结", "小结",
        endBlock(ID, [
          "子代理有独立的上下文、工具和模型，只交回结果；它按 yolo 运行，限制靠 tools 字段和隔离环境。",
          "模型角色在 config.yml 的 modelRoles 里统一配置，子代理用 @角色名 引用。",
          "TTSR 规则平时不占上下文，模型一写出匹配内容就掐断、交出规则、重写，写错的版本不落盘。",
        ], { id: "M17", text: "pi 和 omp 都学过了。最后一课：给定一个场景，该用哪一个、怎么配。" }))));
  });
})();
