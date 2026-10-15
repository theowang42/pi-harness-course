/* M16 · omp 的编排 */
(function () {
  "use strict";
  const { h, $, $$, Store, choice, copyBlock, section, todo, route, term } = window.Course;
  const ID = "M16";
  const REV = "d40b86cf7d6607fc349545ec67ed321023e53425";

  // ================= §0 hero: TTSR time travel =================
  const FIRST = 'print("你好")\n';                                                     // 本机实测：第一次写的内容
  const RETRY = 'import logging\n\nlogging.basicConfig(level=logging.INFO)\nlogging.info("你好")\n'; // 重试后的内容
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
      st.re = reIn.value; st.mode = modeSel.value; Store.set(ID, "sim", { re: st.re, mode: st.mode, played: (Store.get(ID, "sim", {}).played || 0) + 1 });
      let re;
      try { re = new RegExp(st.re); } catch (e) { status.textContent = "正则写错了：" + e.message; return; }
      stream.replaceChildren(); log.replaceChildren();
      const add = (t, cls) => log.append(h("li", { class: cls || "" }, t));
      add("模型开始写：write { path: \"hello.py\", content: … }");
      let attempt = 0, fired = false;
      const run = (text) => {
        const box = h("pre", { class: "tt-buf" + (attempt ? " retry" : "") }, h("span", { class: "lbl" }, attempt ? "第 2 次（重试）" : "第 1 次"), "\n");
        const live = h("span"); box.append(live); stream.append(box);
        let i = 0;
        timer = setInterval(() => {
          i++; live.textContent = text.slice(0, i);
          const hit = !fired && re.test(text.slice(0, i));
          if (hit && st.mode === "always") {
            stop(); fired = true;
            box.classList.add("cut"); box.append(h("span", { class: "scissor" }, "  ✂ 在这里被掐断"));
            add("规则命中 → 立刻中止这次回复（ttsr_triggered）", "hit");
            add("这次 write 没有执行：「Tool execution was aborted: TTSR matched rule: no-print」", "hit");
            add("被掐断的半截回复从上下文里删掉（contextMode: discard）");
            add("注入一条隐藏消息：<system-interrupt reason=\"rule_violation\" rule=\"no-print\">" + RULE_BODY + "</system-interrupt>");
            add("50 毫秒后自动继续——模型像「回到过去」一样重写");
            attempt = 1; setTimeout(() => run(RETRY), 600); return;
          }
          if (hit && st.mode === "never" && !fired) { fired = true; add("规则命中，但 interruptMode 是 never：不中断", "hit"); }
          if (i >= text.length) {
            stop();
            add(`write 执行：hello.py 写入 ${new TextEncoder().encode(text).length} 字节`, "ok");
            if (fired && st.mode === "never") add("工具结果之后，附一条提醒（<system-reminder rule=\"no-print\">）；文件里已经是 print 版本", "hit");
            if (!fired) add("规则一次也没命中：它对这次请求没有任何影响，也没花一个 token");
            if (attempt) add("同一条规则默认只触发一次（repeatMode: once）");
            status.textContent = fired && st.mode === "always" ? "最终文件里没有 print——带 print 的那一版从来没有落盘。" : fired ? "never 模式：放行，再提醒。" : "没有命中。";
          }
        }, 28);
      };
      status.textContent = "播放中……";
      run(FIRST);
    }
    const presets = [["print\\(", "always", "默认：本机的规则"], ["logging", "always", "盯 logging"], ["print\\(", "never", "只提醒不打断"], ["input\\(", "always", "盯一个不会出现的词"]];
    return h("div", { class: "panel ttsr" },
      h("div", { class: "tt-rule" },
        h("div", { class: "mute", style: { fontSize: "15px" } }, ".omp/rules/no-print.md"),
        h("pre", { class: "script" }, `---
description: Python 代码里不要用 print 输出信息
condition: "print\\\\("        `, h("b", null, "← 下面的输入框可以改"), `
scope: "tool:write(*.py), tool:edit(*.py)"
---
${RULE_BODY}`),
        h("label", { class: "tt-f" }, "condition（正则）", reIn),
        h("label", { class: "tt-f" }, "interruptMode", modeSel),
        h("div", { class: "tt-presets" }, presets.map(([r, m, t]) => h("button", { class: "btn ghost", onclick: () => { reIn.value = r; modeSel.value = m; play(); } }, t))),
        h("button", { class: "btn primary", onclick: play }, "▶ 播放")),
      h("div", { class: "tt-main" }, h("div", { class: "mute", style: { fontSize: "15px" } }, "模型正在流式写出 write 的 content 参数（本机实测的两次内容）"), stream, status, log));
  }

  // ================= §2 three rule kinds =================
  function ruleKinds() {
    const rows = [
      ["TTSR 规则", "有 condition（正则）、astCondition 或 question", "0：触发前完全不进上下文", "模型写出匹配的内容时：掐断、注入、重试"],
      ["常驻规则", "alwaysApply: true，或 RULES.md", "每轮都占：全文进系统提示", "一直在"],
      ["规则手册", "只有 description", "每轮只占名字 + 描述", "模型觉得相关时 read rule://名字"],
    ];
    return h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" },
      h("thead", null, h("tr", null, h("th", null, "种类"), h("th", null, "怎样认出"), h("th", null, "上下文成本"), h("th", null, "什么时候起作用"))),
      h("tbody", null, rows.map((r) => h("tr", null, r.map((c, j) => h("td", null, j ? c : h("b", null, c))))))));
  }

  // ================= §3 real event timeline =================
  function realTimeline() {
    const ev = [
      ["user", "写一个 hello.py：运行时输出「你好」。直接写文件，不用解释。"],
      ["ttsr", "ttsr_triggered { rules: [ no-print ] }"],
      ["asst", "assistant · stopReason: aborted · write { content: \"print(\\\"你好\\\")\\n\" }"],
      ["tool", "toolResult · Tool execution was aborted: TTSR matched rule: no-print"],
      ["hide", "（隐藏）<system-interrupt rule=\"no-print\"> …规则正文… </system-interrupt>"],
      ["asst", "assistant · stopReason: toolUse · write { content: \"import logging …\" }"],
      ["tool", "toolResult · Successfully wrote 79 bytes to hello.py"],
      ["asst", "assistant · stopReason: stop · 已写入 hello.py。"],
    ];
    return h("div", { class: "panel tl2" }, h("div", { class: "panel-h" }, h("span", null, "本机实测的事件序列（omp --mode json，message_update 已省略）"), h("span", null, "8 条")),
      h("ol", null, ev.map(([k, t]) => h("li", { class: "k-" + k }, h("code", null, t)))));
  }

  // ================= §4 bundled agents =================
  const AGENTS = [
    ["task", "通用子代理，什么都能做，可以再派子代理", "@task", "全部"],
    ["scout", "只读侦察：快速搜代码、压缩成摘要交回", "@smol", "read、find、grep、glob、web_search"],
    ["sonic", "低推理：纯机械的修改或数据收集", "@smol", "默认"],
    ["reviewer", "代码审查：质量与安全", "（默认）", "read、grep、glob、bash、lsp……"],
    ["security-reviewer", "只读安全审查，结构化输出", "（默认）", "read、grep、glob、lsp、ast_grep……"],
  ];

  // ================= §7 drill =================
  const DRILL = [
    { q: "团队约定：TypeScript 里永远不许写 any。你希望这条约定不占上下文，但一旦写出来就被拦下。", opts: [{ t: "TTSR 规则：condition 匹配 : any，scope 限 *.ts", ok: true }, { t: "写进 AGENTS.md" }, { t: "alwaysApply 规则" }], why: "TTSR 平时零成本，命中时在落盘之前掐断。omp 自带的 ts-no-any 就是这样写的。" },
    { q: "「提交信息必须用英文」——每次都要遵守，而且很短。", opts: [{ t: "RULES.md 或 alwaysApply 规则", ok: true }, { t: "TTSR 规则" }, { t: "子代理" }], why: "短、硬、每轮都相关：常驻。TTSR 适合「平时不相关、出现了才要拦」的东西。" },
    { q: "一本 40 页的部署手册，只在少数任务里有用。", opts: [{ t: "规则手册（只写 description），或做成技能", ok: true }, { t: "alwaysApply" }, { t: "放进 AGENTS.md" }], why: "目录常驻、正文按需读取（M8 同一思路）。" },
    { q: "你要在 30 个文件里做同一种机械修改，主会话的上下文已经很满。", opts: [{ t: "派子代理（例如 sonic），各自在干净的上下文里做，只交回结果", ok: true }, { t: "主会话自己一个个改" }, { t: "写一条 TTSR 规则" }], why: "子代理有自己的上下文窗口和模型；主会话只收到摘要。" },
    { q: "子代理会不会因为审批卡住？", opts: [{ t: "不会：子代理以 yolo 运行，审批边界是父会话批准 task 那一刻", ok: true }, { t: "会，每个 bash 都弹窗" }], why: "文档原文：子代理无头运行；需要 prompt 的调用直接失败。所以派子代理之前，想清楚它拿到哪些工具。" },
  ];

  // ================= §8 lab =================
  const LAB_SHELL = `nix shell github:can1357/oh-my-pi/${REV}#omp`;
  const LAB_SETUP = `mkdir -p ~/pi-lab/m16/.omp/rules ~/pi-lab/m16/.omp/agents && cd ~/pi-lab/m16 && git init -q
cat > .omp/rules/no-print.md <<'EOF'
---
description: Python 代码里不要用 print 输出信息
condition: "print\\\\("
scope: "tool:write(*.py), tool:edit(*.py)"
---
不要用 print。用 logging：先 import logging 并 logging.basicConfig(level=logging.INFO)，再用 logging.info(...) 输出。
EOF
cat > .omp/agents/linecount.md <<'EOF'
---
name: linecount
description: 统计一个文件有几行，只回答一个数字。只读。
tools: read
model: "@fast"
---
你是行数统计员。读给定的文件，只回答它有几行（一个数字），不要别的话。
EOF
printf 'modelRoles:\\n  fast: openai-codex/gpt-6-luna:low\\n' > .omp/config.yml
printf '一\\n二\\n三\\n四\\n五\\n' > a.txt
M=openai-codex/gpt-6-astra`;
  const LAB_TEST = `echo "规则列表：$(omp ttsr list | grep -o 'no-print \\[[a-z]*\\]')"
echo "print 片段：命中 $(omp ttsr test --source tool --tool write --path hello.py 'print("你好")' | grep -c '✓ no-print') 条"
echo "logging 片段：命中 $(omp ttsr test --source tool --tool write --path hello.py 'import logging' | grep -c '✓ no-print') 条"`;
  const LAB_TTSR = `omp --mode json --no-session --model $M --tools read,write "写一个 hello.py：运行时输出「你好」。直接写文件，不用解释。" < /dev/null 2>/dev/null > ev.jsonl
echo "TTSR 事件：$(jq -r 'select(.type=="ttsr_triggered") | .rules[].name' ev.jsonl | paste -sd,)"
echo "回复结局：$(jq -r 'select(.type=="message_end" and .message.role=="assistant" and .message.stopReason!="error") | .message.stopReason' ev.jsonl | paste -sd' ')"
echo "最终 hello.py：print $(grep -c 'print(' hello.py) 处 · logging $(grep -c 'logging' hello.py) 处"`;
  const LAB_SUB = `omp --mode json --no-session --model $M "用 task 工具派 linecount 子代理统计 a.txt 有几行，然后只把它的回答告诉我。" < /dev/null 2>/dev/null > ev.jsonl
f(){ grep -o "\\"$1\\":\\"[^\\"]*\\"" ev.jsonl | head -1 | cut -d'"' -f4; }
echo "子代理：$(f agent) · 角色 $(f modelRole) · 模型 $(f resolvedModel)"
echo "回答：$(jq -r 'select(.type=="message_end" and .message.role=="assistant") | .message.content[] | select(.type=="text") | .text' ev.jsonl | tail -1)"
rm ev.jsonl`;
  const LAB_CLEAN = `cd ~ && rm -r ~/pi-lab/m16 && rmdir --ignore-fail-on-non-empty ~/pi-lab
exit`;
  const LAB_SAMPLE = `规则列表：no-print [native]
print 片段：命中 1 条
logging 片段：命中 0 条
TTSR 事件：no-print
回复结局：toolUse aborted toolUse stop stop
最终 hello.py：print 0 处 · logging 3 处
子代理：linecount · 角色 fast · 模型 openai-codex/gpt-6-luna:low
回答：5`;
  function lab() {
    const saved = Store.get(ID, "lab", {});
    const ta = h("textarea", { class: "paste", id: "m16-lab-paste", spellcheck: "false", placeholder: "规则列表：…\nprint 片段：…\nlogging 片段：…\nTTSR 事件：…\n…" });
    ta.value = saved.raw || "";
    ta.addEventListener("input", () => { delete ta.dataset.sample; });
    const out = h("div");
    const verify = (sample) => {
      if (sample) { ta.value = LAB_SAMPLE; ta.dataset.sample = "1"; }
      const isSample = ta.dataset.sample === "1";
      const L = ta.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      const get = (k) => (L.find((l) => l.startsWith(k)) || "").slice(k.length).trim();
      const ends = get("回复结局：").split(/\s+/);
      const checks = [
        [/no-print/.test(get("规则列表：")), "omp 发现了项目里的规则"],
        [/命中 1/.test(get("print 片段：")) && /命中 0/.test(get("logging 片段：")), "离线测试：print 命中，logging 不命中"],
        [/no-print/.test(get("TTSR 事件：")) && ends.includes("aborted") && ends[ends.length - 1] === "stop", "真实运行：规则触发，回复被中止，重试后正常结束"],
        [/print 0 处/.test(get("最终 hello.py：")) && /logging [1-9]/.test(get("最终 hello.py：")), "最终文件里没有 print，用的是 logging"],
        [/linecount/.test(get("子代理：")) && /fast/.test(get("子代理：")) && /gpt-6-luna/.test(get("子代理：")), "子代理按角色 @fast 解析到另一个模型"],
        [/5/.test(get("回答：")), "子代理答对了：5 行"],
      ];
      const ok = checks.every((c) => c[0]);
      const qbox = h("div");
      if (ok) qbox.append(choice({ id: "q1", store: [ID, "labq"], kicker: "问题", q: "最终 hello.py 里一处 print 都没有。带 print 的那一版写进过磁盘吗？", opts: [{ t: "没有：write 还没执行就被中止了", ok: true }, { t: "写进过，后来被覆盖了" }, { t: "说不准" }], explain: "事件里那次 write 的结果是「Tool execution was aborted: TTSR matched rule」。TTSR 在参数还在流式生成时就动手，比 M10 的 tool_call 守卫更早。", cls: "predict",
        onAnswer: (_, right) => { if (right && !isSample) { Store.set(ID, "lab", { raw: ta.value, passed: true }); checkDone(); } } }));
      out.replaceChildren(h("ul", { class: "check-list" }, checks.map(([o, t]) => h("li", null, h("span", { class: o ? "ok" : "no" }, o ? "✓" : "✗"), t))),
        ok ? qbox : h("div", { class: "note warn" }, h("span", { class: "k" }, "没有全部通过"), "「TTSR 事件」是空的：模型第一次就没写 print（它看不到规则，这种情况少见），再跑一次第 4 步。「回复结局」里没有 aborted 但有很多 error：订阅限流了，omp 会自动重试，稍等再跑。子代理那行的模型是空的：再跑一次第 5 步。"),
        ok && isSample ? h("p", { class: "mute" }, "示例数据只供试用，不计入实验。") : null);
    };
    if (saved.raw) setTimeout(() => verify(false), 0);
    const step = (title, note, code) => h("div", { class: "lab-step" }, h("div", null, h("b", null, title), note ? h("p", { class: "dim", style: { margin: "4px 0 0" } }, note) : null, copyBlock(code)));
    return h("div", { class: "lab-steps" },
      step("进入带 omp 的临时 shell。", "如果 nix 问是否允许 extra-substituters 等设置，回答 n。", LAB_SHELL),
      step("建实验目录：一条 TTSR 规则、一个子代理定义、一个角色映射。", "三个文件都在项目的 .omp/ 里，删掉目录就没了。", LAB_SETUP),
      step("离线测试规则：omp ttsr 不调用模型。", null, LAB_TEST),
      step("真实运行：让模型写一个会用到 print 的文件。", "1 次小的模型调用（含一次被掐断的重试）。", LAB_TTSR),
      step("派子代理：主会话用 gpt-6-astra，子代理按角色用另一个模型。", "2–3 次小的模型调用。子代理在后台运行，结果自动送回主会话。", LAB_SUB),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "粘贴第 3–5 步的输出，核对，回答问题。"), h("div", { style: { marginTop: "8px" } }, ta),
        h("div", { style: { display: "flex", gap: "8px", marginTop: "8px" } }, h("button", { class: "btn primary", onclick: () => verify(false) }, "核对我的运行"), h("button", { class: "btn ghost", onclick: () => verify(true) }, "先用示例数据试试")), out)),
      step("清理，并退出临时 shell。", null, LAB_CLEAN));
  }

  // ================= quiz / review / recap =================
  const QUIZ = [
    { q: "TTSR 规则在没被触发时，占多少上下文？", opts: [{ t: "0：系统提示里根本没有它", ok: true }, { t: "名字和描述" }, { t: "全文" }], why: "本机实测：请求里找不到 no-print。只有命中时才注入正文。" },
    { q: "TTSR 在什么时候检查？", opts: [{ t: "模型流式输出的过程中，边写边查", ok: true }, { t: "工具执行之后" }, { t: "会话结束时" }], why: "所以它能在 write 执行之前掐断。M10 的 tool_call 守卫要等整个调用写完。" },
    { q: "interruptMode: always 的规则命中 write 的参数后：", opts: [{ t: "中止回复，write 不执行，注入规则，自动重试", ok: true }, { t: "write 照常执行，然后提醒" }, { t: "整个会话结束" }], why: "本机事件：aborted → 「Tool execution was aborted: TTSR matched rule: no-print」→ 重写。" },
    { q: "contextMode 默认是 discard，意思是：", opts: [{ t: "被掐断的半截回复从上下文里删掉，模型看不到自己写错的那一版", ok: true }, { t: "规则用完就删" }, { t: "删除整段对话" }], why: "keep 则保留半截回复，提醒接在它后面。" },
    { q: "omp ttsr test 'print(\"你好\")' --source tool --tool write --path hello.py 的作用：", opts: [{ t: "离线检查哪些规则会命中，不调用模型", ok: true }, { t: "让模型写这段代码" }], why: "写规则时先用它试正则和 scope。omp ttsr scan 能扫整个目录。" },
    { q: "omp 自带多少条内置 TTSR 规则（本机 ttsr list，不含你的）？", opts: [{ t: "27 条（Go、Rust、TypeScript 的惯用法）", ok: true }, { t: "0 条" }, { t: "几百条" }], why: "例如 ts-no-any、rs-box-leak、go-ioutil。它们的 scope 都限定在对应扩展名的 edit/write 上。ttsr.builtinRules: false 可以关掉。" },
    { q: "子代理定义里写 model: \"@fast\"，它用哪个模型？", opts: [{ t: "config.yml 里 modelRoles.fast 指向的模型", ok: true }, { t: "和主会话相同" }, { t: "随机" }], why: "本机：@fast → openai-codex/gpt-6-luna:low。改角色映射，不用改代理文件。" },
    { q: "子代理的审批：", opts: [{ t: "以 yolo 运行；父会话批准 task 调用就是授权边界", ok: true }, { t: "每个工具调用都会问你" }], why: "需要 prompt 的调用在子代理里直接失败。用 tools 字段限制它拿到的工具。" },
    { q: "advisor 是：", opts: [{ t: "另一个模型旁听每一轮，给主会话注入简短建议", ok: true }, { t: "审批工具调用的人" }, { t: "一个 TTSR 规则" }], why: "它不批准、不直接改主会话。默认只给 read、grep、glob。用 --advisor 或 advisor.enabled 开启。" },
    { q: "在提示里写 ultrathink 会：", opts: [{ t: "这一轮加一段「仔细推理」的隐藏说明，并在自动思考时提到最高档", ok: true }, { t: "永久提高思考等级" }, { t: "什么都不会" }], why: "魔法关键词必须小写、独立成词；只作用于这一轮。orchestrate、workflowz、jevify 是另外三个。" },
  ];
  const REVIEW = [
    { q: "（复习 M10）pi 的 tool_call 守卫在什么时候拿到工具参数？", opts: [{ t: "模型把整个调用写完、工具执行之前", ok: true }, { t: "模型边写边拿" }, { t: "工具执行之后" }], why: "本课的 TTSR 更早：边写边查。" },
    { q: "（复习 M8）技能目录每轮都占上下文吗？", opts: [{ t: "占：名字、描述、路径每轮都发", ok: true }, { t: "不占" }], why: "本课的三种规则，成本各不相同。" },
  ];
  const PRE = [
    { id: "p1", q: "omp 的 TTSR 规则在没有被触发时，占上下文吗？", opts: [{ t: "占，全文常驻" }, { t: "只占名字和描述" }, { t: "完全不占", ok: true }] },
    { id: "p2", q: "TTSR 规则拦截「写 print」的时机是：", opts: [{ t: "文件写完之后" }, { t: "模型还在写参数的时候", ok: true }, { t: "请求发出之前" }] },
    { id: "p3", q: "子代理用哪个模型，由谁决定？", opts: [{ t: "总是和主会话一样" }, { t: "它的定义文件（可以指向一个角色）", ok: true }] },
  ];
  function checkDone() {
    const ok = Store.get(ID, "lab", {}).passed && Store.get(ID, "quiz", { best: 0 }).best >= 8;
    if (ok && !Store.get(ID, "done")) Store.set(ID, "done", true);
  }

  window.Course.register(ID, (page) => {
    const rc = window.Course.recapBlock(ID, {
      pre: PRE,
      next: { id: "M17", title: "选择与组合", text: "pi 和 omp 你都摸过了。M17 不再学新功能：给你一组真实场景，判断该用哪一个、开哪些、关哪些，并说出理由。" },
      extra: () => [["模拟器播放", (Store.get(ID, "sim", {}).played || 0) + " 次"], ["机制选择", DRILL.filter((x, i) => x.opts[Store.get(ID, "drill", {})["d" + i]]?.ok).length + " / " + DRILL.length]],
    });
    page.append(h("div", { class: "bench" },
      h("header", { class: "mhead" }, h("div", { class: "crumbs" }, "第 6 单元 · oh-my-pi / M16"), h("h1", { class: "mtitle" }, h("span", { class: "mid" }, "M16"), "omp 的编排")),
      section("s-hero", 0, "开场", null, ttsrSim(),
        h("div", { class: "col" },
          h("p", { class: "thesis" }, "规则不必常驻。", h("br"), "等模型写出来的那一刻，再把它拉回去。"),
          h("p", { class: "lead" }, "上面是 TTSR（Time-Traveling Stream Rules，时间旅行流式规则）模拟器，内容来自本机的真实运行。先按默认播放一次；再试试「盯 logging」和「只提醒不打断」，看结局怎样变。")),
        h("div", { class: "panel objectives" },
          h("ol", null,
            h("li", null, "区分 TTSR、常驻规则和规则手册，说出各自的上下文成本。"),
            h("li", null, "写一条 TTSR 规则，先离线测试，再在真实运行里触发它。"),
            h("li", null, "定义一个子代理，并用模型角色给它指定模型。"),
            h("li", null, "说出子代理的审批边界和 advisor、魔法关键词的作用。"),
            h("li", null, "为一条约定选出合适的机制。")),
          h("div", { class: "obj-side" },
            h("div", null, h("span", { class: "k" }, "时长"), "约 80 分钟"),
            h("div", null, h("span", { class: "k" }, "前置"), "M8、M10、M15"),
            h("div", null, h("span", { class: "k" }, "练习"), "§8 实验 + §9 测验（≥ 8/10）"),
            h("div", null, h("span", { class: "k" }, "核对版本"), "omp 18.10.3"))),
        h("h3", null, "本课路线"),
        route(ID, [["s-pre", 1, "动手", "复习与预测"], ["s-kinds", 2, "阅读", "三种规则"], ["s-ttsr", 3, "阅读", "TTSR 内部"], ["s-agents", 4, "阅读", "子代理"], ["s-roles", 5, "阅读", "模型角色"], ["s-more", 6, "阅读", "advisor 与关键词"], ["s-drill", 7, "动手", "选机制"], ["s-lab", 8, "实验", "规则与子代理"], ["s-quiz", 9, "测验", "10 题"], ["s-recap", 10, "阅读", "小结"]])),
      h("div", { class: "col" },
        section("s-pre", 1, "复习与预测", "先复习，再预测",
          todo("两道复习题立即判分；三道预测课末揭晓。"),
          REVIEW.map((r, i) => choice({ id: "r" + i, store: [ID, "rev"], kicker: "复习 " + (i + 1) + " / 2", q: r.q, opts: r.opts, explain: r.why, shuffleSeed: 321 + i * 7 })),
          PRE.map((p, i) => choice({ id: p.id, store: [ID, "pre"], kicker: "预测 " + (i + 1) + " / 3", q: p.q, opts: p.opts, reveal: false, shuffleSeed: 157 + i * 13 }))),
        section("s-kinds", 2, "三种规则", "同样是 .omp/rules/*.md，成本完全不同",
          todo("读表，记住怎样从 frontmatter 认出种类。", true),
          ruleKinds(),
          h("p", { style: { marginTop: "12px" } }, "规则文件放在 .omp/rules/ 或 ~/.omp/agent/rules/；.claude、.cursor 等目录里的规则也会被发现。.omp/RULES.md（以及 ~/.omp/agent/RULES.md）是强制常驻的规则。"),
          h("p", null, "omp 自带 27 条 TTSR 规则（omp ttsr list），覆盖 Go、Rust、TypeScript 的常见坏习惯。它们只在你改对应扩展名的文件时才可能触发，平时不花一个 token。"),
          h("pre", { class: "script" }, h("span", { class: "lbl" }, "写规则时用的三个命令（都不调用模型）"), `omp ttsr list                       # 所有规则，含内置
omp ttsr test --source tool --tool write --path hello.py 'print("你好")'   # 这段会触发哪些
omp ttsr scan src/                  # 用规则扫现有代码`)),
        section("s-ttsr", 3, "TTSR 内部", "掐断、注入、重来",
          todo("对照真实事件序列读下面五点。", true),
          realTimeline(),
          h("ul", { class: "rule", style: { marginTop: "12px" } },
            h("li", null, h("b", null, "盯什么："), "scope 决定。默认盯回复正文和所有工具参数，不盯思考。tool:write(*.py) 只盯写 .py 文件的 write。edit/write 的参数会被还原成「要写进去的源码」再匹配。"),
            h("li", null, h("b", null, "怎样处理："), "interruptMode：always（默认）掐断并重试；never 放行，在工具结果后附提醒；prose-only / tool-only 只对正文或只对工具掐断。"),
            h("li", null, h("b", null, "半截回复："), "contextMode：discard（默认）删掉，keep 保留。"),
            h("li", null, h("b", null, "触发几次："), "repeatMode：once（默认）每条规则只触发一次；after-gap 隔 N 轮（repeatGap，默认 10）可再次触发。"),
            h("li", null, h("b", null, "和 M10 守卫比："), "守卫在调用写完后才拿到参数，拦下后模型收到一个错误；TTSR 边写边查，掐断后连写错的那一版都从上下文里抹掉，像没发生过一样重来。代价是一次中断后的重新生成。"))),
        section("s-agents", 4, "子代理", "另一个上下文，另一个模型",
          todo("读定义格式和五个内置代理。", true),
          h("p", null, "task 工具派出子代理。每个子代理有自己的上下文窗口、工具和模型，做完把结果交回。本机实测：子代理在后台运行（异步作业），结果自动送回主会话；主会话也可以 read agent://ID 查看进度。"),
          h("pre", { class: "script" }, h("span", { class: "lbl" }, ".omp/agents/linecount.md（项目级；用户级放 ~/.omp/agent/agents/）"), `---
name: linecount
description: 统计一个文件有几行，只回答一个数字。只读。
tools: read           # 不写就是默认工具
model: "@fast"        # 一个角色；也可以写具体模型或列表
---
你是行数统计员。读给定的文件，只回答它有几行（一个数字），不要别的话。`),
          h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" },
            h("thead", null, h("tr", null, h("th", null, "内置代理"), h("th", null, "用途"), h("th", null, "模型"), h("th", null, "工具"))),
            h("tbody", null, AGENTS.map(([a, b, c, d]) => h("tr", null, h("td", null, h("code", null, a)), h("td", null, b), h("td", null, c), h("td", null, d)))))),
          h("div", { class: "note warn" }, h("span", { class: "k" }, "审批边界"), "子代理无头运行，模式固定为 yolo。你批准 task 调用的那一刻就是授权边界；子代理里需要询问的调用会直接失败。限制子代理，靠它的 tools 字段，以及 M12 的沙箱。"),
          h("p", { class: "dim" }, "omp agents unpack 把内置代理导出成文件，方便你照着改。交互界面里按 Alt+A 打开 Agent Hub：看每个子代理的状态、模型、用量，读它的记录，直接给它发消息。")),
        section("s-roles", 5, "模型角色", "按工作分配模型",
          todo("读角色清单和本机结果。", true),
          h("p", null, "omp 不只问「用哪个模型」，而是问「这类工作用哪个模型」。角色写在 config.yml 的 modelRoles 里："),
          h("pre", { class: "script" }, `modelRoles:
  default: openai-codex/gpt-6-astra
  smol: openai-codex/gpt-6-luna:low     # 快、便宜：scout、sonic、会话标题
  slow: openai-codex/gpt-6-sol:high     # 强：难题、advisor 的默认来源
  plan: "@slow"                         # 角色可以指向角色（YAML 里要加引号）
  fast: openai-codex/gpt-6-luna:low     # 自定义角色：本课实验用`),
          h("ul", { class: "rule" },
            h("li", null, h("b", null, "内置角色："), "default、smol、slow、vision、plan、commit、tiny、memory、task、advisor，以及 image、web、judge 等专用角色。"),
            h("li", null, h("b", null, "本机实测："), "主会话 gpt-6-astra；linecount 的 @fast 解析为 openai-codex/gpt-6-luna:low，子代理的进度记录里写着 modelRole: fast。"),
            h("li", null, h("b", null, "命令行："), "--smol、--slow、--plan 临时指定；也可以用环境变量 PI_SMOL_MODEL 等。"),
            h("li", null, h("b", null, "失败回退："), "retry.fallbackChains 定义请求失败时换哪个模型——和角色列表里的「第一个可用」是两回事。"))),
        section("s-more", 6, "advisor 与关键词", "旁听者和快捷开关",
          todo("读三段。", true),
          h("p", null, h("b", null, "advisor："), "另一个模型旁听主会话的每一轮，必要时注入简短建议。它不批准动作，也不直接改主会话。开启：--advisor 或 advisor.enabled: true；模型来自 advisor 角色，没设时用 slow。WATCHDOG.yml 可以定义多个 advisor。注意它会额外花 token。"),
          h("p", null, h("b", null, "魔法关键词："), "在提示里写独立的小写单词，这一轮会多一段隐藏说明：ultrathink（仔细推理，自动思考时提到最高档）、orchestrate（拆分任务、并行派子代理）、workflowz（用 eval 里的 agent()/workpool() 编排）、jevify（用 judge() 批量分类）。写成 Ultrathink 或 orchestrate.ts 都不会触发。magicKeywords.enabled: false 全部关闭。"),
          h("p", null, h("b", null, "Agent Hub："), "交互界面里 Alt+A。子代理多了以后，用它看谁在做什么、花了多少。")),
        section("s-drill", 7, "选机制", "一条约定，放在哪里",
          todo("五个场景，各选一种机制。"),
          DRILL.map((x, i) => choice({ id: "d" + i, store: [ID, "drill"], kicker: "场景 " + (i + 1) + " / " + DRILL.length, q: x.q, opts: x.opts, explain: x.why, shuffleSeed: 331 + i * 3 }))),
        section("s-lab", 8, "实验", "一条规则，一个子代理",
          todo("按第 1–7 步操作。全部在终端里完成。"),
          h("p", null, "你会写一条 TTSR 规则，先离线测试，再看它在真实运行里把一次 write 掐断；然后派一个按角色选模型的子代理。"),
          h("div", { class: "note" }, h("span", { class: "k" }, "实验规则"), "omp 由 nix shell 临时提供；所有运行 --no-session；规则、代理和角色都只写在 ~/pi-lab/m16/.omp 里，不碰全局配置；最后清理。共 3–4 次小的模型调用。订阅偶尔限流（Codex is at capacity），omp 会自动重试。"),
          lab()),
        section("s-quiz", 9, "掌握测验", "10 题，8 题过关", todo("10 题全部作答，点「交卷」。"), window.Course.quizBlock(ID, QUIZ, checkDone)),
        section("s-recap", 10, "小结", "你学到了什么",
          todo("看自己的预测和成绩。觉得学会了，就在本节最后点「标记为已完成」。", true),
          h("p", { class: "lead" }, "一句话：TTSR 规则平时零成本，模型一写出匹配内容就掐断、注入、重来，写错的版本不落盘也不留在上下文；子代理给任务一个干净的上下文和按角色挑的模型，但它以 yolo 运行，限制靠工具清单和沙箱。"),
          rc))));
    return () => rc._cleanup && rc._cleanup();
  });
})();
