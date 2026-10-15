/* M13 · 自动化与嵌入 */
(function () {
  "use strict";
  const { h, section, quizBlock, lessonHead, look, howto, endBlock } = window.Course;
  const ID = "M13";

  // ================= §4 RPC wire replay (recorded with pi 0.99.2) =================
  const WIRE = [
    [">", '{"id":"1","type":"get_state"}', "你的程序问当前状态。命令带一个 id，回执会原样带回它。"],
    ["<", '{"type":"response","id":"1","command":"get_state","success":true,"data":{"model":{"id":"gpt-6-astra",…},…}}', "回执。用 id 配对，不要靠先后顺序。"],
    [">", '{"id":"2","type":"prompt","message":"读 a.txt，只回答它的内容。"}', "发出提示。"],
    ["<", '{"type":"response","id":"2","command":"prompt","success":true,"data":{"disposition":"started"}}', "关键：这只表示「收到了，开始运行」。模型还一个字都没写。"],
    ["<", '{"type":"agent_start"}', "从这里开始是事件。事件没有 id，它们描述正在发生的事，格式和 JSON 模式完全一样。"],
    ["<", '{"type":"turn_start"}', "第 1 轮。"],
    ["<", '{"type":"message_end","message":{"role":"assistant","stopReason":"toolUse",…}}', "模型回复完毕：要调用工具（第 1 课的 toolUse）。中间省略了逐字输出的 message_update。"],
    ["<", '{"type":"tool_execution_start","toolName":"read",…}', "pi 执行 read。"],
    ["<", '{"type":"tool_execution_end","toolName":"read",…}', ""],
    ["<", '{"type":"turn_end",…}', "第 1 轮结束。"],
    ["<", '{"type":"turn_start"}', "第 2 轮：带着工具结果再问一次模型。"],
    ["<", '{"type":"message_end","message":{"role":"assistant","stopReason":"stop",…}}', "最终回复。stopReason 是 stop。"],
    ["<", '{"type":"agent_end",…}', "运行的循环结束。但还可能有自动重试、压缩、排队的消息接着来。"],
    ["<", '{"type":"agent_settled"}', "这条才表示 pi 不会再自动继续了。要等它做完，就等这一条。"],
    [">", '{"id":"3","type":"get_last_assistant_text"}', "现在去取结果。"],
    ["<", '{"type":"response","id":"3","command":"get_last_assistant_text","success":true,"data":{"text":"hello rpc"}}', "拿到回复。之后关闭 stdin，pi 有序退出。"],
  ];
  function wire() {
    let i = 0, timer = null;
    const list = h("div", { class: "wire-list" });
    const cap = h("div", { class: "cap" });
    const pos = h("span", { class: "mute" });
    const rows = WIRE.map(([d, t], k) => h("div", { class: "wl " + (d === ">" ? "out" : "in"), onclick: () => go(k) },
      h("span", { class: "dir" }, d === ">" ? "你 → pi" : "pi → 你"), h("code", null, t)));
    list.append(...rows);
    function go(k) {
      i = Math.max(0, Math.min(WIRE.length - 1, k));
      rows.forEach((r, j) => { r.classList.toggle("on", j <= i); r.classList.toggle("cur", j === i); });
      const [d, t, why] = WIRE[i];
      const kind = d === ">" ? "命令" : /"type":"response"/.test(t) ? "回执" : "事件";
      cap.replaceChildren(h("b", null, kind), why ? h("span", null, why) : h("span", { class: "mute" }, "（工具执行结束）"));
      pos.textContent = `${i + 1} / ${WIRE.length}`;
      if (list.scrollHeight > list.clientHeight) list.scrollTop = rows[i].offsetTop - list.clientHeight / 2;
    }
    const play = h("button", { class: "btn", onclick: () => {
      if (timer) { clearInterval(timer); timer = null; play.textContent = "▶ 播放"; return; }
      if (i >= WIRE.length - 1) go(0);
      play.textContent = "❚❚ 暂停";
      timer = setInterval(() => { if (i >= WIRE.length - 1) { clearInterval(timer); timer = null; play.textContent = "▶ 播放"; return; } go(i + 1); }, 1300);
    } }, "▶ 播放");
    go(0);
    return h("div", { class: "panel" },
      h("div", { class: "evctl" }, h("button", { class: "btn ghost", onclick: () => go(i - 1) }, "← 上一条"), h("button", { class: "btn ghost", onclick: () => go(i + 1) }, "下一条 →"), play, pos),
      h("div", { class: "wire" }, list, h("div", { class: "evdet", style: { borderTop: 0, display: "block" } }, cap)));
  }

  const SDK_SRC = `import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";

// 在你的程序里创建一个会话；inMemory() 表示不写会话文件
const { session } = await createAgentSession({ sessionManager: SessionManager.inMemory(), cwd: process.cwd() });

// 订阅事件：和 JSON / RPC 模式是同一套事件
session.subscribe((event) => {
  if (event.type === "tool_execution_start") console.log("调用工具：" + event.toolName);
});

await session.prompt("读 a.txt，只回答它的内容。");   // 等这次运行完全结束
console.log("共 " + session.messages.length + " 条消息");
session.dispose();                                      // 释放资源，否则进程可能不退出`;

  const QUIZ = [
    { q: "脚本里只需要 pi 的最终回答，比如每天把 git log 交给它写一段日报。用哪种？", opts: [{ t: "print 模式：pi -p", ok: true }, { t: "RPC" }, { t: "SDK" }], why: "pi -p 往标准输出只写最后一条回复，$(pi -p …) 拿到的就是干净的答案。够用的最简单那一种就好。" },
    { q: "在 while read 循环里调用 pi -p，没加 < /dev/null。三个文件名会怎样？", opts: [{ t: "只处理了第一个：pi 把剩下的输入读走了", ok: true }, { t: "三个都正常处理" }, { t: "pi 报错退出" }], why: "pi 会读完标准输入，接在提示前面。在循环里或被别的程序调用时，都要加 < /dev/null。" },
    { q: "JSON 模式里，怎样判断这次运行成功了？", opts: [{ t: "看最后一条助手消息的 stopReason", ok: true }, { t: "看退出码是不是 0" }], why: "JSON 模式下，模型请求失败只会记在事件里，退出码可能仍是 0。print 模式才会因失败非 0 退出。" },
    { q: "RPC 里发出 prompt，收到 success:true、disposition:started。这时：", opts: [{ t: "只是被接受、开始运行；要等 agent_settled 才算做完", ok: true }, { t: "模型已经答完了" }, { t: "模型答对了" }], why: "回执只管命令本身有没有被接受。" },
    { q: "每晚自动运行、没人看着的 pi 任务，启动行里最不该省的是：", opts: [{ t: "只给需要的工具，并放进隔离环境", ok: true }, { t: "调高思考强度" }, { t: "打开更多扩展" }], why: "没人能按 Esc。失误或提示注入会直接变成动作（第 13 课）。" },
  ];

  window.Course.register(ID, (page) => {
    page.append(h("div", { class: "col" },
      lessonHead(ID, [
        h("p", null, "到目前为止，你都是在终端里和 pi 对话。pi 也能被脚本和程序调用：每天定时生成日报、在 CI 里修测试、做一个自己的界面。"),
        h("p", null, "pi 提供四种接法，从简单到完整：", h("b", null, "print"), "（问一句，拿回答案）、", h("b", null, "JSON"), "（同时拿到全过程）、", h("b", null, "RPC"), "（让 pi 一直开着，你的程序随时发命令）、", h("b", null, "SDK"), "（在 Node.js 程序里直接把 pi 当库用）。这一课讲每种怎么用、各自的坑，以及无人值守时启动行该怎么写。"),
      ], [
        "四种接法的区别，什么任务用哪种。",
        "print 和 JSON 模式在脚本里的用法和常见坑。",
        "RPC 的命令、回执、事件怎么配合；无人值守时要加哪些保护。",
      ]),

      section("s-four", 1, "四种接法", "四种接法，够用就好",
        h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" },
          h("thead", null, h("tr", null, h("th", null, ""), h("th", null, "print"), h("th", null, "JSON"), h("th", null, "RPC"), h("th", null, "SDK"))),
          h("tbody", null,
            h("tr", null, h("td", { class: "mute" }, "怎么启动"), h("td", null, h("code", null, 'pi -p "…"')), h("td", null, h("code", null, 'pi --mode json "…"')), h("td", null, h("code", null, "pi --mode rpc")), h("td", null, "在代码里 createAgentSession()")),
            h("tr", null, h("td", { class: "mute" }, "寿命"), h("td", null, "问完就退出"), h("td", null, "跑完就退出"), h("td", null, "一直开着，直到你关掉"), h("td", null, "和你的程序一起")),
            h("tr", null, h("td", { class: "mute" }, "你拿到"), h("td", null, "最后一条回复的文字"), h("td", null, "全过程的事件，每行一个"), h("td", null, "回执 + 事件"), h("td", null, "会话对象的全部方法和状态")),
            h("tr", null, h("td", { class: "mute" }, "适合"), h("td", null, "shell 脚本、简单定时任务"), h("td", null, "要看过程、工具、用量，比如 CI"), h("td", null, "其他语言写的界面或工具，要随时插话、停止"), h("td", null, "Node.js 程序，要最完整的控制")))))),

      section("s-print", 2, "print", "print 模式：一问一答",
        h("p", null, "pi -p「提示」只把最后一条回复的文字写到标准输出，错误写到标准错误。所以 $(pi -p …) 拿到的就是干净的答案。"),
        h("pre", null, `$ printf '苹果\\n香蕉\\n' | pi -p --no-session --no-tools "上面列了几种水果？只回答数字。"
2
$ echo $?
0`),
        h("ul", { class: "rule" },
          h("li", null, h("b", null, "管道输入会接在提示前面。"), "上例中「苹果、香蕉」通过管道传进去，模型就能看到。"),
          h("li", null, h("b", null, "退出码："), "正常是 0；出错（比如模型名写错、请求失败）非 0。"),
          h("li", null, h("b", null, "小心标准输入。"), "pi 会一直读标准输入，直到它关闭。被别的程序启动、或者放在循环里时，它要么一直等着，要么把循环的输入吃掉。凡是这种情况都加 ", h("code", null, "< /dev/null"), "。")),
        h("p", null, "一个看起来没问题、其实有三处错误的定时脚本："),
        h("pre", null, `git diff --name-only HEAD~1 | while read f; do
  pi -p --no-session --tools read "用一句话总结 $f 的改动" >> summary.md    # ①
done
pi --mode json --no-session "检查 summary.md 有没有错别字" > log.jsonl   # ②
[ $? -eq 0 ] && echo "检查通过"                                          # ③`),
        h("ul", { class: "rule" },
          h("li", null, h("b", null, "①"), " 循环里 pi 的标准输入就是 git diff 的输出，pi 把剩下的文件名全读走了，循环只跑一次。行尾加 < /dev/null。"),
          h("li", null, h("b", null, "②"), " 没写 --tools，用的是默认工具，包括 bash、edit、write。只是检查，就给 --tools read。"),
          h("li", null, h("b", null, "③"), " JSON 模式下请求失败退出码不一定非 0，这样判断不可靠。要看事件里的 stopReason（下一节）。"))),

      section("s-json", 3, "JSON", "JSON 模式：拿到全过程",
        h("p", null, "pi --mode json 把整个运行过程写成一行一个的事件：第一行是会话信息，之后是 agent_start、turn_start、message_end、tool_execution_start……和第 11 课的事件是同一套。RPC 和 SDK 收到的也是它们，学一次三处通用。"),
        h("ul", { class: "rule" },
          h("li", null, h("b", null, "message_update 是一小段一小段的增量。"), "要逐字显示就自己拼；要保存完整回复，用 message_end 里的那条消息。"),
          h("li", null, h("b", null, "agent_settled 才是真的结束。"), "agent_end 之后还可能有自动重试、压缩或排队的消息。"),
          h("li", null, h("b", null, "成败看 stopReason。"), "最后一条助手消息的 stopReason 是 stop 表示正常完成；error 或 aborted 表示失败或被中止。")),
        h("pre", null, `# 调用了哪些工具
pi --mode json … | jq -r 'select(.type=="tool_execution_start") | .toolName'
# 每次回复怎样结束
pi --mode json … | jq -r 'select(.type=="message_end" and .message.role=="assistant") | .message.stopReason'`),
        h("p", { class: "dim" }, "jq 是一个处理 JSON 的命令行工具，上面两行用它从事件里挑出需要的字段。")),

      section("s-rpc", 4, "RPC", "RPC：一直开着的 pi",
        h("p", null, "pi --mode rpc 启动后不退出。你的程序往它的标准输入写命令（每行一个 JSON），它往标准输出写两种东西："),
        h("ul", { class: "rule" },
          h("li", null, h("b", null, "回执"), "：带着命令的 id，告诉你这条命令有没有被接受。"),
          h("li", null, h("b", null, "事件"), "：不带 id，描述正在发生的事，和 JSON 模式一样。")),
        look("这是录下来的一次完整对话。逐条往下点（或播放），注意 prompt 的回执来得有多早，以及要等哪一条事件才算做完。")),
      h("div", { class: "bench" }, wire()),
      h("p", { style: { marginTop: "16px" } }, "pi 正在干活时再发命令，要说清楚怎么排："),
      howto("运行中发命令", [
        ['{"type":"prompt", …}', "直接再发一条普通提示会被拒绝（success:false），pi 不替你猜。"],
        ['{"type":"steer", …}', "插话：当前这轮工具跑完、下一次问模型之前送达（第 3 课的 Enter）。"],
        ['{"type":"prompt", "streamingBehavior":"followUp", …}', "排队：整个运行结束后再处理（第 3 课的 Alt+Enter）。"],
        ['{"type":"abort"}', "中止当前运行。"],
        ["关闭标准输入", "pi 有序退出。"],
      ], "几乎每个界面操作都有对应的 RPC 命令（切模型、压缩、分支……），完整列表在 pi 文档 rpc-commands.md。"),

      section("s-sdk", 5, "SDK", "SDK：在 Node.js 里直接用",
        h("p", null, "如果你的程序本身就是 Node.js（或 Bun），可以不开子进程，直接在代码里创建会话："),
        h("pre", null, SDK_SRC),
        howto("RPC 和 SDK 怎么选", [
          ["语言", "RPC：任何能读写管道的语言。SDK：只有 Node.js / Bun。"],
          ["隔离", "RPC：pi 是子进程，它崩了你的程序还在；也可以只把 pi 关进沙箱。SDK：同一个进程。"],
          ["能力", "RPC：命令列表里有的。SDK：全部 API，比如注册自己的工具、自己管理会话存储。"],
          ["默认行为", "SDK 默认不加载 codemode、tool_search 和 MCP，要自己加。"],
        ])),

      section("s-auto", 6, "无人值守", "没人看着时，启动行要写全",
        h("p", null, "自动化最常见的问题不是报错，而是悄悄出错：循环只跑了一次、失败却显示成功、会话文件越积越多、AGENTS.md 让它多做了一件事。把保护都写进启动行："),
        h("pre", null, `timeout 600 pi -p --no-session --tools read,grep,find,ls -nc "检查今天的提交有没有明显的 bug" < /dev/null > report.txt`),
        howto("每一项的作用", [
          ["timeout 600", "最多跑 10 分钟。模型卡住或反复重试时也能停下（超时退出码是 124）。"],
          ["--no-session", "不留会话文件。每晚一次，一年就是 365 个。需要记录就用 --session-dir 指定一个会清理的目录。"],
          ["--tools read,grep,find,ls", "只给需要的工具。默认工具里有 bash、edit、write。"],
          ["-nc", "不读 AGENTS.md。仓库可能被别人改过时加上（第 13 课）。"],
          ["< /dev/null", "关掉标准输入，避免一直等待或吃掉别人的输入。"],
        ], "最后，把整个任务放进隔离环境（第 13 课）。没人看着，就没人能按 Esc。")),

      section("s-quiz", 7, "检查", "检查一下", quizBlock(ID, QUIZ, null, null)),

      section("s-end", 8, "小结", "小结",
        endBlock(ID, [
          "只要答案用 print，要过程用 JSON，要随时控制用 RPC，Node.js 里要全部能力用 SDK。四者用的是同一套事件。",
          "被程序调用或放在循环里，加 < /dev/null；JSON 模式的成败看 stopReason，不看退出码。",
          "RPC 的回执只表示命令被接受，等 agent_settled 才算做完；运行中要插话用 steer，要排队用 followUp。",
          "无人值守：限时、不留会话、少给工具、不读陌生的 AGENTS.md、放进隔离环境。",
        ], { id: "M14", text: "pi 的部分到此结束。接下来是 omp（oh-my-pi）：从 pi 分出来、内置能力更多的一个版本。" }))));
  });
})();
