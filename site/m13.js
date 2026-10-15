/* M13 · 自动化与嵌入 */
(function () {
  "use strict";
  const { h, $, $$, Store, choice, copyBlock, section, todo, route, term } = window.Course;
  const ID = "M13";

  // ================= §0 hero: four integration surfaces =================
  const SURF = [
    { k: "print", name: "print", cmd: 'pi -p "…"', life: "一次：问完就退出", dir: "一问一答", get: "最后一条回复的文字", drive: "启动时给出全部提示", fail: "模型报错或中止 → 退出码非 0", fit: "shell 管道、$( ) 命令替换、简单的定时任务",
      out: `$ printf '苹果\\n香蕉\\n' | pi -p --no-session --no-tools "上面列了几种水果？只回答数字。"
2
$ echo $?
0`, arrows: [["→", "提示（参数 + 管道输入）"], ["←", "最后的文字"]] },
    { k: "json", name: "JSON", cmd: 'pi --mode json "…"', life: "一次：跑完就退出", dir: "一问，一串事件", get: "会话头 + 全部事件（JSONL）", drive: "启动时给出全部提示", fail: "失败的回复只出现在事件里，退出码可能仍是 0", fit: "要看进度、工具记录、用量；本课程从 M0 起一直在用",
      out: `{"type":"session",…}
{"type":"agent_start"}
{"type":"turn_start"}
{"type":"message_start",…}
…
{"type":"tool_execution_start","toolName":"read",…}
…
{"type":"agent_end",…}
{"type":"agent_settled"}`, arrows: [["→", "提示"], ["←", "事件、事件、事件……"]] },
    { k: "rpc", name: "RPC", cmd: "pi --mode rpc", life: "长期：直到你关闭 stdin", dir: "双向：随时发命令", get: "回执（response）+ 事件", drive: "你的程序随时发 prompt、steer、abort、set_model……", fail: "命令被拒 → success:false；运行中的失败在事件里", fit: "Python 等其他语言、IDE 插件、自己做的界面",
      out: `rpc 模型：gpt-6-astra
rpc 回执：started
rpc 工具：read
rpc 回复：hello lab
rpc 统计：用户 1 / 助手 2 / 工具 1`, arrows: [["→", "命令（带 id）"], ["←", "回执（同一个 id）"], ["←", "事件（不带 id）"]] },
    { k: "sdk", name: "SDK", cmd: "createAgentSession()", life: "和你的程序同一个进程", dir: "直接调用方法", get: "session 对象：方法、状态、事件回调", drive: "await session.prompt()、steer()、abort()……", fail: "prompt() 抛出或 reject；运行中的失败在事件里", fit: "Node.js / Bun 程序，需要最完整的控制",
      out: `sdk 工具：read
sdk 回复：hello lab
sdk 消息数：5`, arrows: [["⇄", "函数调用 + subscribe 回调（同一进程）"]] },
  ];
  function hero() {
    let cur = 0;
    const btns = SURF.map((s, i) => h("button", { class: "pick", "aria-pressed": i === cur ? "true" : "false", onclick: () => { cur = i; paint(); } }, h("b", null, s.name), h("span", { class: "mute" }, s.cmd)));
    const res = h("div", { class: "res" });
    function paint() {
      btns.forEach((b, i) => b.setAttribute("aria-pressed", i === cur));
      const s = SURF[cur];
      res.replaceChildren(
        h("div", { class: "surf-dia" }, h("div", { class: "box" }, "你的程序"),
          h("div", { class: "arr" }, s.arrows.map(([a, t]) => h("div", null, h("span", { class: "a" }, a), " ", t))),
          h("div", { class: "box pi" + (s.k === "sdk" ? " in" : "") }, s.k === "sdk" ? "pi（库）" : "pi（子进程）")),
        h("table", { class: "grow" }, h("tbody", null,
          [["寿命", s.life], ["对话方式", s.dir], ["你拿到", s.get], ["谁来驱动", s.drive], ["怎样发现失败", s.fail], ["适合", s.fit]].map(([a, b]) => h("tr", null, h("td", { style: { whiteSpace: "nowrap", color: "var(--fg-mute)" } }, a), h("td", null, b))))),
        h("div", { class: "mute", style: { fontSize: "15px" } }, "本机实测输出"),
        h("pre", { class: "script" }, s.out));
      const seen = { ...Store.get(ID, "surf", {}) }; seen[s.k] = 1; Store.set(ID, "surf", seen);
    }
    paint();
    return h("div", { class: "panel surf" }, h("div", { class: "col1" }, h("b", null, "四种接法"), h("div", { class: "list" }, btns),
      h("p", { class: "mute", style: { fontSize: "15px", margin: "8px 0 0" } }, "同一个 agent、同样的会话、工具和设置。不同的只是输入怎样进、输出怎样出。")), res);
  }

  // ================= §2 spot-the-bug script =================
  const BUG_SRC = [
    ["#!/usr/bin/env bash", 0, "普通的脚本头。"],
    ["# 每晚：让 pi 给每个改动过的文件写一句摘要", 0, "注释。"],
    ["cd ~/proj || exit 1", 0, "没问题：cd 失败就停下，不会在错误的目录里运行。"],
    ['OPTS="--no-session --tools read"', 0, "没问题：不留会话文件，只给只读工具。"],
    ["git diff --name-only HEAD~1 | while read f; do", 0, "这一行本身没问题。问题出在循环体里——想想循环的 stdin 是谁。"],
    ['  pi -p $OPTS "用一句话总结 $f 的改动" >> summary.md', 1, "错误。循环里 pi 的 stdin 就是 git diff 的管道。pi 会把剩下的文件名全部读走，接在提示前面。循环只跑一次。本机实测：三个文件名，只处理了第一个。修正：在行尾加 < /dev/null。"],
    ["done", 0, "循环结束。"],
    ['pi --mode json --no-session "检查 summary.md 有没有错别字" > log.jsonl', 2, "错误。没有 --tools，用的是默认工具：read、bash、edit、write。无人值守时，它能直接改文件、运行命令。只要检查，就给 --tools read。"],
    ['[ $? -eq 0 ] && echo "检查通过"', 3, "错误。JSON 模式里，模型请求失败或被中止，只会出现在事件里，退出码不一定非 0。要判断成败，读 log.jsonl 最后一条助手消息的 stopReason。print 模式才会因此退出非 0。"],
  ];
  function bugHunt() {
    const st = Store.get(ID, "bugs", {});
    const marked = new Set(st.marked || []);
    let checked = !!st.checked;
    const rows = BUG_SRC.map(([t], i) => h("div", { class: "ln", onclick: () => { if (checked) return show(i); marked.has(i) ? marked.delete(i) : marked.add(i); paint(); } }, h("span", { class: "no" }, i + 1), h("span", null, t)));
    const note = h("div", { class: "note2" });
    const btn = h("button", { class: "btn primary", onclick: () => { checked = true; save(); paint(); } }, "核对");
    const again = h("button", { class: "btn ghost", onclick: () => { checked = false; marked.clear(); save(); paint(); } }, "重新作答");
    const showAns = h("button", { class: "btn ghost", onclick: () => { marked.clear(); BUG_SRC.forEach(([, b], i) => { if (b) marked.add(i); }); checked = true; save(); paint(); } }, "显示答案");
    const save = () => { const prev = Store.get(ID, "bugs", {}); const right = checked && BUG_SRC.every(([, b], i) => !!b === marked.has(i)); Store.set(ID, "bugs", { marked: [...marked], checked, ever: prev.ever || right }); };
    function show(i) {
      rows.forEach((r, j) => r.classList.toggle("on", j === i));
      const [t, b, why] = BUG_SRC[i];
      note.replaceChildren(h("span", { class: "tag" }, "第 " + (i + 1) + " 行"), h("b", { style: { color: b ? "var(--bad)" : "var(--ok)" } }, b ? "有问题" : "没问题"), h("p", { style: { margin: 0 } }, why));
    }
    function paint() {
      rows.forEach((r, i) => { r.classList.toggle("mark", marked.has(i)); r.classList.toggle("hit", checked && !!BUG_SRC[i][1]); r.classList.toggle("miss", checked && marked.has(i) && !BUG_SRC[i][1]); r.classList.remove("on"); });
      if (!checked) {
        note.replaceChildren(h("span", { class: "tag" }, "找出 3 处错误"), h("p", { style: { margin: 0 } }, "点左边的行做标记（再点取消）。标好后按「核对」；也可以直接看答案。"), h("span", { class: "mute" }, "已标记 " + marked.size + " 行"), h("div", { style: { display: "flex", gap: "8px" } }, btn, showAns));
      } else {
        const found = BUG_SRC.filter(([, b], i) => b && marked.has(i)).length, wrong = BUG_SRC.filter(([, b], i) => !b && marked.has(i)).length;
        note.replaceChildren(h("span", { class: "tag" }, "结果"), h("b", { style: { fontSize: "18px" } }, `找到 ${found} / 3 处` + (wrong ? `，误标 ${wrong} 行` : "")), h("p", { style: { margin: 0 } }, "红框是真正的错误。点任意一行看解释。"), again);
      }
    }
    paint();
    return h("div", { class: "panel" }, h("div", { class: "panel-h" }, h("span", null, "nightly.sh · 一个看起来没问题的定时脚本"), h("span", null, "3 处错误")), h("div", { class: "codeview stack bughunt" }, h("div", { class: "src" }, rows), note));
  }

  // ================= §4 RPC wire replay (real, recorded on this machine) =================
  // [方向, 记录（message_update 已省略）, 说明]
  const WIRE = [
    [">", '{"id":"1","type":"get_state"}', "你的程序问状态。带上 id，回执会原样带回它。"],
    ["<", '{"type":"response","id":"1","command":"get_state","success":true,"data":{"isStreaming":false,"model":{"id":"gpt-6-astra",…},…}}', "回执。用 id 配对，不要用先后顺序：命令是异步处理的。"],
    [">", '{"id":"2","type":"prompt","message":"读 a.txt，只回答它的内容。"}', "发出提示。"],
    ["<", '{"type":"response","id":"2","command":"prompt","success":true,"data":{"disposition":"started"}}', "关键：这只表示「接受了，开始运行」。模型还一个字都没写。disposition 还可能是 queued（排队）或 handled（被扩展命令处理，不会有运行）。"],
    ["<", '{"type":"agent_start"}', "从这里开始是事件。事件没有 id——它们描述会话，不属于某条命令。格式和 JSON 模式完全相同。"],
    ["<", '{"type":"turn_start"}', "第 1 轮。"],
    ["<", '{"type":"message_start","message":{"role":"system",…}}', "系统提示作为一条消息出现（本机 0.99.2 的实际输出）。"],
    ["<", '{"type":"message_end","message":{"role":"system",…}}', ""],
    ["<", '{"type":"message_start","message":{"role":"user",…}}', "你的提示。"],
    ["<", '{"type":"message_end","message":{"role":"user",…}}', ""],
    ["<", '{"type":"message_start","message":{"role":"assistant",…}}', "模型开始回复。中间省略了若干 message_update（增量）。"],
    ["<", '{"type":"message_end","message":{"role":"assistant","stopReason":"toolUse",…}}', "message_end 里是完整、权威的消息。stopReason 是 toolUse：它要调用工具（M0）。"],
    ["<", '{"type":"tool_execution_start","toolName":"read",…}', "pi 执行 read。界面上的「正在读文件」就来自这条。"],
    ["<", '{"type":"tool_execution_end","toolName":"read",…}', ""],
    ["<", '{"type":"message_start","message":{"role":"toolResult",…}}', "工具结果作为一条消息进入上下文。"],
    ["<", '{"type":"message_end","message":{"role":"toolResult",…}}', ""],
    ["<", '{"type":"turn_end",…}', "第 1 轮结束。"],
    ["<", '{"type":"turn_start"}', "第 2 轮：带着工具结果再调用一次模型。"],
    ["<", '{"type":"message_start","message":{"role":"assistant",…}}', ""],
    ["<", '{"type":"message_end","message":{"role":"assistant","stopReason":"stop",…}}', "最终回复。stopReason 是 stop。"],
    ["<", '{"type":"turn_end",…}', ""],
    ["<", '{"type":"agent_end",…}', "一次底层运行结束。但还可能有自动重试、压缩、排队的消息接着来。"],
    ["<", '{"type":"agent_settled"}', "这条才表示：pi 不会再自动继续了。等完成，就等它。"],
    [">", '{"id":"3","type":"get_last_assistant_text"}', "现在可以取结果。"],
    ["<", '{"type":"response","id":"3","command":"get_last_assistant_text","success":true,"data":{"text":"hello rpc"}}', "完成。之后关闭 stdin，pi 有序退出。"],
  ];
  function wire() {
    let i = Math.min(Store.get(ID, "wire", 0), WIRE.length - 1), timer = null;
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
      cap.replaceChildren(h("b", null, `${kind} · ${d === ">" ? "stdin" : "stdout"}`), why ? h("span", null, why) : h("span", { class: "mute" }, "（配对的结束事件）"));
      pos.textContent = `${i + 1} / ${WIRE.length}`;
      if (i > Store.get(ID, "wire", 0)) Store.set(ID, "wire", i);
      rows[i].scrollIntoView && list.scrollHeight > list.clientHeight && (list.scrollTop = rows[i].offsetTop - list.clientHeight / 2);
    }
    const play = h("button", { class: "btn", onclick: () => {
      if (timer) { clearInterval(timer); timer = null; play.textContent = "▶ 播放"; return; }
      if (i >= WIRE.length - 1) go(0);
      play.textContent = "❚❚ 暂停";
      timer = setInterval(() => { if (i >= WIRE.length - 1) { clearInterval(timer); timer = null; play.textContent = "▶ 播放"; return; } go(i + 1); }, 1100);
    } }, "▶ 播放");
    go(i);
    return h("div", { class: "panel" },
      h("div", { class: "evctl" }, h("button", { class: "btn ghost", onclick: () => go(i - 1) }, "← 上一条"), h("button", { class: "btn ghost", onclick: () => go(i + 1) }, "下一条 →"), play, pos,
        h("span", { class: "mute", style: { marginLeft: "auto", fontSize: "15px" } }, "本机录制 · message_update 已省略")),
      h("div", { class: "wire" }, list, h("div", { class: "evdet", style: { borderTop: 0, display: "block" } }, cap)));
  }

  // ================= §3 JSON drill / §6 scenarios =================
  const EVQ = [
    { q: "你的界面要一个字一个字地显示回复。监听：", opts: [{ t: "message_update（里面的 text_delta）", ok: true }, { t: "message_end" }, { t: "turn_end" }], why: "message_update 带的是增量，不是越来越长的全文。你自己拼起来。" },
    { q: "你要保存这次回复的准确全文。用：", opts: [{ t: "message_end 里的 message", ok: true }, { t: "自己拼起来的 text_delta" }], why: "文档：先用增量显示，再用 message_end 的权威消息替换。" },
    { q: "你的脚本要确认「pi 不会再自动继续」，然后才退出。等：", opts: [{ t: "agent_settled", ok: true }, { t: "agent_end" }, { t: "最后一个 turn_end" }], why: "agent_end 之后还可能有重试、溢出恢复、压缩、排队消息。" },
  ];
  const SCEN = [
    { q: "每天早上把昨天的 git log 交给 pi，生成一段日报，写进文件。", opts: [{ t: "print 模式", ok: true }, { t: "RPC" }, { t: "SDK" }], why: "只要最后的文字，一次就结束。最简单的够用就行。" },
    { q: "CI 里让 pi 修测试。你要记录它调用了哪些工具、花了多少 token，并判断成败。", opts: [{ t: "JSON 模式", ok: true }, { t: "print 模式" }, { t: "RPC" }], why: "一次运行，但要结构化的过程：工具事件、usage、stopReason 都在事件里。print 只给文字。" },
    { q: "你用 Python 写一个桌面小工具：一个输入框，用户可以随时追加指令、中途停止。", opts: [{ t: "RPC", ok: true }, { t: "每次调用一次 print" }, { t: "SDK" }], why: "长期运行、双向控制、非 Node 语言。steer、follow_up、abort 都是 RPC 命令。SDK 只能在 Node/Bun 里用。" },
    { q: "你在写一个 Node.js 服务，要自定义工具、自己管理会话存储，还要读系统提示。", opts: [{ t: "SDK", ok: true }, { t: "RPC" }, { t: "JSON 模式" }], why: "同一进程、完整 API：customTools、sessionManager、session.systemPrompt 都能直接用。" },
  ];

  // ================= §7 unattended command builder =================
  const KNOBS = [
    ["nosess", "--no-session", "不留会话文件", "每次运行都会在 ~/.pi/agent/sessions 里留一个文件。每晚一次，一年 365 个。要留记录，就用 --session-dir 指定一个你会清理的目录。"],
    ["tools", "--tools read,grep,find,ls", "只给需要的工具", "默认有 bash、edit、write。没人看着时，失误或注入会直接变成动作（M12）。"],
    ["nc", "-nc", "不读上下文文件", "仓库是别人的，或者会被别人改？AGENTS.md 能指挥模型，而且不受信任限制（M12）。自己的仓库可以不加。"],
    ["stdin", "< /dev/null", "关掉 stdin", "被其他程序或循环调用时，stdin 可能是一个开着的管道：pi 要么一直等，要么吃掉别人的输入。"],
    ["timeout", "timeout 600", "限时", "模型卡住、重试、无限循环……都需要一个上限。超时后 timeout 退出码是 124。"],
    ["box", "../box.sh", "放进沙箱", "无人值守 = 没人能按 Esc。M12 的 box.sh 让它够不着你的 Vault 和 ~/.ssh。"],
  ];
  function builder() {
    const on = { ...Store.get(ID, "knobs", {}) };
    const cmd = h("pre", { class: "script", style: { fontSize: "15px" } });
    const risks = h("ul", { class: "rule" });
    const boxes = KNOBS.map(([k, , label]) => { const c = h("input", { type: "checkbox", checked: on[k] || null }); c.addEventListener("change", () => { on[k] = c.checked; Store.set(ID, "knobs", { ...on }); paint(); }); return h("label", { class: "knob" }, c, label); });
    function paint() {
      const pre = [on.timeout && "timeout 600", on.box && "../box.sh"].filter(Boolean).join(" ");
      const flags = ["-p", on.nosess && "--no-session", on.tools && "--tools read,grep,find,ls", on.nc && "-nc"].filter(Boolean).join(" ");
      cmd.textContent = (pre ? pre + " " : "") + "pi " + flags + ' "检查今天的提交有没有明显的 bug"' + (on.stdin ? " < /dev/null" : "") + " > report.txt";
      const miss = KNOBS.filter(([k]) => !on[k]);
      risks.replaceChildren(...(miss.length ? miss.map(([, f, , why]) => h("li", null, h("b", null, "没有 " + f + "："), why)) : [h("li", null, h("b", { style: { color: "var(--ok)" } }, "六项都有。"), "这就是本课推荐的无人值守启动行。")]));
    }
    paint();
    return h("div", { class: "panel", style: { padding: "14px 16px", display: "grid", gap: "10px" } }, h("div", { class: "knobs" }, boxes), cmd, h("div", { class: "mute", style: { fontSize: "15px" } }, "还缺的："), risks);
  }

  // ================= §5 SDK code view =================
  const SDK_SRC = `import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";
// 在本进程里创建会话；inMemory = 不写会话文件
const { session } = await createAgentSession({ sessionManager: SessionManager.inMemory(), cwd: process.cwd() });
let reply = "";
session.subscribe((event) => {
  if (event.type === "tool_execution_start") console.log("sdk 工具：" + event.toolName);
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") reply += event.assistantMessageEvent.delta;
});
await session.prompt("读 a.txt，只回答它的内容。");
console.log("sdk 回复：" + reply.trim());
console.log("sdk 消息数：" + session.messages.length);
session.dispose();`;
  const SDK_PARTS = [
    [1, 1, "导入", "包名是 @earendil-works/pi-coding-agent。实验里用一个指向本机 pi 的符号链接，不用 npm 安装任何东西。"],
    [2, 3, "创建会话", "不传参数时，它和命令行一样：读你的设置、凭证、AGENTS.md、扩展、技能。sessionManager 默认会写会话文件；inMemory() 不写。cwd 决定在哪里找项目资源、工具在哪个目录工作。"],
    [4, 8, "订阅事件", "事件和 JSON/RPC 模式完全相同。先订阅，再 prompt，否则可能错过很快结束的运行。subscribe 返回一个取消订阅的函数。"],
    [9, 9, "提示并等待", "prompt() 在运行结束（包括自动重试）后才 resolve。运行中再调用 prompt() 必须说明 steer 还是 followUp，否则 reject。"],
    [10, 11, "读状态", "session.messages 是完整的消息列表。本机是 5 条：系统、用户、助手（调用工具）、工具结果、助手（回答）——和 RPC 回放里的消息一一对应。"],
    [12, 12, "释放", "dispose() 中止进行中的工作、断开扩展、移除监听器。不调用它，进程可能不退出。"],
  ];
  function sdkView() {
    const lines = SDK_SRC.split("\n");
    const note = h("div", { class: "note2" }, h("span", { class: "mute" }, "点左边任一行，看它在做什么。共 " + SDK_PARTS.length + " 个要点。"));
    const seen = new Set(Object.keys(Store.get(ID, "sdk", {})));
    const rows = lines.map((t, i) => {
      const n = i + 1, part = SDK_PARTS.findIndex(([a, b]) => n >= a && n <= b);
      const cm = t.indexOf("//");
      const body = cm >= 0 && !t.slice(0, cm).includes('"') ? [t.slice(0, cm), h("span", { class: "cm" }, t.slice(cm))] : [t];
      return h("div", { class: "ln" + (part >= 0 ? " grp" : ""), onclick: () => show(part) }, h("span", { class: "no" }, n), h("span", null, ...body));
    });
    function show(p) {
      if (p < 0) return;
      const [a, b, title, why] = SDK_PARTS[p];
      rows.forEach((r, i) => r.classList.toggle("on", i + 1 >= a && i + 1 <= b));
      if (!seen.has(String(p))) { seen.add(String(p)); Store.set(ID, "sdk", Object.fromEntries([...seen].map((x) => [x, 1]))); }
      note.replaceChildren(h("span", { class: "tag" }, `第 ${a}${b > a ? "–" + b : ""} 行`), h("b", { style: { fontSize: "18px" } }, title), h("p", { style: { margin: 0 } }, why), h("span", { class: "mute", style: { fontSize: "15px" } }, `已看 ${seen.size} / ${SDK_PARTS.length}`));
    }
    return h("div", { class: "panel" }, h("div", { class: "panel-h" }, h("span", null, "sdk_demo.mjs · 本机实测可用"), h("span", null, "12 行")), h("div", { class: "codeview stack" }, h("div", { class: "src" }, rows), note));
  }

  // ================= §8 lab =================
  const LAB_SETUP = `mkdir -p ~/pi-lab/m13 && cd ~/pi-lab/m13
echo "hello lab" > a.txt
cat > rpc_client.py <<'EOF'
import json, subprocess
# 启动一个长期运行的 pi；stdin 发命令，stdout 收记录（每行一个 JSON）
pi = subprocess.Popen(["pi", "--mode", "rpc", "--no-session", "--tools", "read"],
                      stdin=subprocess.PIPE, stdout=subprocess.PIPE)
def send(cmd):
    pi.stdin.write((json.dumps(cmd, ensure_ascii=False) + "\\n").encode()); pi.stdin.flush()
def until(pred):                      # 一直读，直到某条记录满足条件
    while True:
        r = json.loads(pi.stdout.readline())
        if r.get("type") == "tool_execution_start": print("rpc 工具：" + r["toolName"])
        if pred(r): return r
send({"id": "1", "type": "get_state"})
r = until(lambda r: r.get("id") == "1")
print("rpc 模型：" + r["data"]["model"]["id"])
send({"id": "2", "type": "prompt", "message": "读 a.txt，只回答它的内容。"})
r = until(lambda r: r.get("id") == "2")
print("rpc 回执：" + r["data"]["disposition"])
until(lambda r: r.get("type") == "agent_settled")
send({"id": "3", "type": "get_last_assistant_text"})
print("rpc 回复：" + until(lambda r: r.get("id") == "3")["data"]["text"])
send({"id": "4", "type": "get_session_stats"})
s = until(lambda r: r.get("id") == "4")["data"]
print(f"rpc 统计：用户 {s['userMessages']} / 助手 {s['assistantMessages']} / 工具 {s['toolCalls']}")
pi.stdin.close(); pi.wait()          # 关闭 stdin = 请 pi 有序退出
EOF
cat > sdk_demo.mjs <<'EOF'
${SDK_SRC}
EOF`;
  const LAB_PRINT = `printf '苹果\\n香蕉\\n' | pi -p --no-session --no-tools "上面列了几种水果？只回答数字。" > out.txt; echo "print 退出码：$?"; echo "print 回复：$(cat out.txt)"
pi -p --no-session --model nope/nothing "你好" < /dev/null 2> err.txt; echo "坏模型退出码：$?"; echo "坏模型报错：$(head -c 60 err.txt)"
rm out.txt err.txt`;
  const LAB_RPC = "python3 rpc_client.py";
  const LAB_SDK = `mkdir -p node_modules/@earendil-works
ln -s "$(dirname "$(readlink -f "$(command -v pi)")")/../lib/node_modules/pi-monorepo" node_modules/@earendil-works/pi-coding-agent
nix shell nixpkgs#nodejs -c node sdk_demo.mjs < /dev/null`;
  const LAB_CLEAN = "cd ~ && rm -r ~/pi-lab/m13 && rmdir --ignore-fail-on-non-empty ~/pi-lab";
  const LAB_SAMPLE = `print 退出码：0
print 回复：2
坏模型退出码：1
坏模型报错：Error: Model "nope/nothing" not found. Use --list-models to
rpc 模型：gpt-6-astra
rpc 回执：started
rpc 工具：read
rpc 回复：hello lab
rpc 统计：用户 1 / 助手 2 / 工具 1
sdk 工具：read
sdk 回复：hello lab
sdk 消息数：5`;
  function lab() {
    const saved = Store.get(ID, "lab", {});
    const ta = h("textarea", { class: "paste", id: "m13-lab-paste", spellcheck: "false", placeholder: "print 退出码：…\nprint 回复：…\n坏模型退出码：…\nrpc 模型：…\n…\nsdk 消息数：…" });
    ta.value = saved.raw || "";
    ta.addEventListener("input", () => { delete ta.dataset.sample; });
    const out = h("div");
    const verify = (sample) => {
      if (sample) { ta.value = LAB_SAMPLE; ta.dataset.sample = "1"; }
      const isSample = ta.dataset.sample === "1";
      const L = ta.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      const get = (k) => (L.find((l) => l.startsWith(k)) || "").slice(k.length).trim();
      const has = (k) => L.some((l) => l.startsWith(k));
      const bad = parseInt(get("坏模型退出码："), 10);
      const stats = get("rpc 统计：").match(/用户\s*(\d+)\s*\/\s*助手\s*(\d+)\s*\/\s*工具\s*(\d+)/);
      const checks = [
        [get("print 退出码：") === "0" && /\d/.test(get("print 回复：")), "print 正常退出，并回答了一个数字"],
        [bad > 0, "坏模型让 print 以非 0 退出"],
        [has("rpc 模型：") && get("rpc 回执：") === "started", "RPC 回执：started"],
        [get("rpc 工具：") === "read" && get("rpc 回复：") === "hello lab", "RPC 里模型读了 a.txt，回复 hello lab"],
        [!!stats && stats[1] === "1" && +stats[3] >= 1, "RPC 统计：1 条用户消息，至少 1 次工具调用"],
        [get("sdk 工具：") === "read" && get("sdk 回复：") === "hello lab" && +get("sdk 消息数：") >= 4, "SDK 同样读了文件并回复"],
      ];
      const ok = checks.every((c) => c[0]);
      const qbox = h("div");
      if (ok) qbox.append(choice({ id: "q1", store: [ID, "labq"], kicker: "问题", q: "rpc_client.py 打印「rpc 回执：started」的那一刻，模型已经回答 hello lab 了吗？", opts: [{ t: "还没有。回执只表示接受；要等 agent_settled", ok: true }, { t: "已经回答了" }, { t: "说不准，取决于网速" }], explain: "所以脚本在回执之后还要 until(agent_settled)，然后才去取 get_last_assistant_text。", cls: "predict",
        onAnswer: (_, right) => { if (right && !isSample) { Store.set(ID, "lab", { raw: ta.value, passed: true }); checkDone(); } } }));
      out.replaceChildren(h("ul", { class: "check-list" }, checks.map(([o, t]) => h("li", null, h("span", { class: o ? "ok" : "no" }, o ? "✓" : "✗"), t))),
        ok ? qbox : h("div", { class: "note warn" }, h("span", { class: "k" }, "没有全部通过"), "第 4 步报 command not found：你不在 NixOS 上。把 ln -s 的目标换成 \"$(npm root -g)/@earendil-works/pi-coding-agent\"，再直接用 node 运行。模型偶尔多读几次文件，统计数字会更大，这没关系。"),
        ok && isSample ? h("p", { class: "mute" }, "示例数据只供试用，不计入实验。") : null);
    };
    if (saved.raw) setTimeout(() => verify(false), 0);
    return h("div", { class: "lab-steps" },
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "建实验目录：一个小文件，一个 Python 的 RPC 客户端，一个 Node 的 SDK 程序。"), copyBlock(LAB_SETUP))),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "print 模式：一次管道输入，一次故意用不存在的模型。"), h("p", { class: "dim", style: { margin: "4px 0 0" } }, "一次很小的模型调用（坏模型那次不会请求）。"), copyBlock(LAB_PRINT))),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "RPC：用 Python 驱动一个长期运行的 pi。"), h("p", { class: "dim", style: { margin: "4px 0 0" } }, "一次小的模型调用（读文件 + 回答）。--no-session，不留会话。"), copyBlock(LAB_RPC))),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "SDK：在 Node 进程里直接用 pi。"),
        h("p", { class: "dim", style: { margin: "4px 0 0" } }, "符号链接只在实验目录里，不装 npm 包。nix shell 临时提供 node，不装进系统。第一次可能要下载 node（只进 Nix store，可回收）。一次小的模型调用。"), copyBlock(LAB_SDK))),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "粘贴第 2–4 步的输出，核对，回答问题。"), h("div", { style: { marginTop: "8px" } }, ta),
        h("div", { style: { display: "flex", gap: "8px", marginTop: "8px" } }, h("button", { class: "btn primary", onclick: () => verify(false) }, "核对我的运行"), h("button", { class: "btn ghost", onclick: () => verify(true) }, "先用示例数据试试")), out)),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "清理。"), copyBlock(LAB_CLEAN))));
  }

  // ================= quiz / review / recap =================
  const QUIZ = [
    { q: "pi -p 往 stdout 写什么？", opts: [{ t: "最后一条助手回复的文字", ok: true }, { t: "全部事件" }, { t: "整个会话" }], why: "中间过程都不输出。要过程，用 JSON 模式。" },
    { q: "while read 循环里调用 pi -p，没加 < /dev/null。本机实测三个文件名：", opts: [{ t: "只处理了第一个，pi 把剩下的读走了", ok: true }, { t: "三个都处理了" }, { t: "pi 报错退出" }], why: "pi 的 stdin 是循环的管道；非终端的 stdin 会被读入并接在提示前面。" },
    { q: "JSON 模式里，模型请求失败了。pi 的退出码：", opts: [{ t: "不一定非 0，要看事件里的 stopReason", ok: true }, { t: "一定非 0" }], why: "文档：失败或中止的回复只出现在事件流里。print 模式才会因此退出非 0。" },
    { q: "RPC 的 prompt 收到 success:true、disposition:started。这说明：", opts: [{ t: "提示被接受，运行开始了", ok: true }, { t: "模型已经答完" }, { t: "模型答对了" }], why: "回执只管命令本身。运行中的失败出现在事件里，不会有第二个回执。" },
    { q: "要确认 pi 不会再自动继续，等哪个事件？", opts: [{ t: "agent_settled", ok: true }, { t: "agent_end" }, { t: "turn_end" }], why: "agent_end 后还可能有重试、压缩、排队消息。" },
    { q: "pi 正在运行时，又发了一条普通 prompt（没有 streamingBehavior）。本机实测：", opts: [{ t: "被拒绝：success:false，要求指定 steer 或 followUp", ok: true }, { t: "自动排队" }, { t: "打断当前运行" }], why: "pi 不替你猜。SDK 的 prompt() 同样会 reject。" },
    { q: "本机实测：pi 在跑 sleep 3 时收到 steer「顺便回答 四」。最终回复是：", opts: [{ t: "「一。四」：工具跑完、下一次模型调用之前送达", ok: true }, { t: "先「一」，再单独一条「四」" }, { t: "「四」，sleep 被中止" }], why: "steer 在当前轮的工具执行完之后、下一次调用模型之前送达（M2）。followUp「三」则在整个运行结束后才单独处理。" },
    { q: "RPC 客户端怎样让 pi 有序退出？", opts: [{ t: "关闭它的 stdin", ok: true }, { t: "kill -9" }, { t: "发送一条 exit 文字" }], why: "pi 会先释放运行时，再退出。客户端仍要处理意外退出。" },
    { q: "SDK 里 SessionManager.inMemory() 的作用：", opts: [{ t: "会话只在内存里，不写会话文件", ok: true }, { t: "把模型放进内存" }, { t: "关闭压缩" }], why: "默认是持久化的，和命令行一样写 ~/.pi/agent/sessions。" },
    { q: "命令行默认加载的 codemode、tool_search、MCP，在 SDK 会话里：", opts: [{ t: "默认不加载，要自己加到 extensionFactories", ok: true }, { t: "一样自动加载" }], why: "pi SDK 文档原文。SDK 给你完整控制，也意味着少了一些自动行为。" },
  ];
  const REVIEW = [
    { q: "（复习 M2）steer 的消息什么时候送达模型？", opts: [{ t: "当前轮的工具执行完之后，下一次调用模型之前", ok: true }, { t: "立刻打断模型" }, { t: "整个运行结束之后" }], why: "本课会在 RPC 里用命令做同样的事。" },
    { q: "（复习 M0）模型先调用一次工具、再回答。这次运行有几轮（turn）？", opts: [{ t: "2 轮", ok: true }, { t: "1 轮" }, { t: "3 轮" }], why: "每调用一次模型就是一轮。§4 的回放里能看到两个 turn_start。" },
  ];
  const PRE = [
    { id: "p1", q: "一个 Python 程序用 subprocess 启动 pi -p \"你好\"，stdin 是一个没关闭的管道。会怎样？", opts: [{ t: "pi 一直等着读 stdin，不会返回", ok: true }, { t: "正常回答" }, { t: "立即报错退出" }] },
    { id: "p2", q: "RPC 模式里，prompt 命令收到 success:true 时，模型答完了吗？", opts: [{ t: "答完了" }, { t: "还没有，只是被接受了", ok: true }] },
    { id: "p3", q: "pi 正在工作，你又发一条普通 prompt。会怎样？", opts: [{ t: "自动排在后面" }, { t: "打断当前工作" }, { t: "被拒绝，要你说明怎么排", ok: true }] },
  ];
  function checkDone() {
    const ok = Store.get(ID, "lab", {}).passed && Store.get(ID, "quiz", { best: 0 }).best >= 8;
    if (ok && !Store.get(ID, "done")) Store.set(ID, "done", true);
  }

  window.Course.register(ID, (page) => {
    const rc = window.Course.recapBlock(ID, {
      pre: PRE,
      next: { id: "M14", title: "从 pi 到 omp", text: "pi 的部分到此结束。M14 开始 omp（oh-my-pi）：同一套思想的一个分支，带着更多内置能力。你会把 M0–M13 的知识逐条迁移过去，并找出关键差异。" },
      extra: () => [["接法对比", Object.keys(Store.get(ID, "surf", {})).length + " / 4"], ["脚本找错", Store.get(ID, "bugs", {}).ever ? "全对过" : "未全对"], ["场景决策", SCEN.filter((x, i) => x.opts[Store.get(ID, "scen", {})["s" + i]]?.ok).length + " / " + SCEN.length]],
    });
    page.append(h("div", { class: "bench" },
      h("header", { class: "mhead" }, h("div", { class: "crumbs" }, "第 5 单元 · 边界与自动化 / M13"), h("h1", { class: "mtitle" }, h("span", { class: "mid" }, "M13"), "自动化与嵌入")),
      section("s-hero", 0, "开场", null, hero(),
        h("div", { class: "col" },
          h("p", { class: "thesis" }, "同一个 agent，四种接口。", h("br"), "区别只在：谁握方向盘，你能看到多少。"),
          h("p", { class: "lead" }, "上面是四种把 pi 接进程序的方法，从最简单到最完整。点每一种，看它的寿命、输入输出和失败信号。四段输出都是本课实验在本机跑出来的。")),
        h("div", { class: "panel objectives" },
          h("ol", null,
            h("li", null, "在脚本里正确使用 print 模式：管道输入、退出码、stdin 陷阱。"),
            h("li", null, "从 JSON 事件流里取出需要的东西，并正确判断成败与结束。"),
            h("li", null, "读懂 RPC 的三类记录：命令、回执、事件；用 id 配对，等 agent_settled。"),
            h("li", null, "用 Python 写一个 RPC 客户端，用 Node 写一个 SDK 程序，都能跑通。"),
            h("li", null, "为具体任务选接法，并写出一条安全的无人值守启动行。")),
          h("div", { class: "obj-side" },
            h("div", null, h("span", { class: "k" }, "时长"), "约 75 分钟"),
            h("div", null, h("span", { class: "k" }, "前置"), "M2、M10、M12"),
            h("div", null, h("span", { class: "k" }, "练习"), "§8 实验 + §9 测验（≥ 8/10）"),
            h("div", null, h("span", { class: "k" }, "核对版本"), "pi 0.99.2 · Python 3 · Node（nix shell）"))),
        h("h3", null, "本课路线"),
        route(ID, [["s-pre", 1, "动手", "复习与预测"], ["s-print", 2, "动手", "print 模式"], ["s-json", 3, "动手", "JSON 事件"], ["s-rpc", 4, "动手", "RPC 协议"], ["s-sdk", 5, "阅读", "SDK"], ["s-scen", 6, "动手", "选接法"], ["s-auto", 7, "动手", "无人值守"], ["s-lab", 8, "实验", "四种接法"], ["s-quiz", 9, "测验", "10 题"], ["s-recap", 10, "阅读", "小结"]])),
      h("div", { class: "col" },
        section("s-pre", 1, "复习与预测", "先复习，再预测",
          todo("两道复习题立即判分；三道预测课末揭晓。"),
          REVIEW.map((r, i) => choice({ id: "r" + i, store: [ID, "rev"], kicker: "复习 " + (i + 1) + " / 2", q: r.q, opts: r.opts, explain: r.why, shuffleSeed: 251 + i * 7 })),
          PRE.map((p, i) => choice({ id: p.id, store: [ID, "pre"], kicker: "预测 " + (i + 1) + " / 3", q: p.q, opts: p.opts, reveal: false, shuffleSeed: 127 + i * 13 }))),
        section("s-print", 2, "print 模式", "一问一答，用在脚本里",
          todo("读四条规则和两条补充，然后在下面的脚本里找出 3 处错误（可以直接看答案）。"),
          h("ul", { class: "rule" },
            h("li", null, h("b", null, "怎样进入："), "pi -p「提示」。stdin 或 stdout 不是终端时（被管道、被重定向），不加 -p 也会自动进入 print 模式。"),
            h("li", null, h("b", null, "输出："), "stdout 只有最后一条助手回复的文字。错误写到 stderr。所以 $(pi -p …) 拿到的就是干净的答案。"),
            h("li", null, h("b", null, "管道输入："), "非终端的 stdin 会被读完，接在提示前面。本机：printf「苹果、香蕉」| pi -p「几种水果」→ 2。"),
            h("li", null, h("b", null, "退出码："), "正常 0。启动出错（例如模型不存在）是 1；回复以 error 或 aborted 结束也非 0。")),
          h("p", null, h("b", null, "找错之前再补两条："), "① 无人值守时只给需要的工具：默认工具里有 bash、edit、write（第 6、13 课）。② JSON 模式里，模型请求失败只记在事件里，退出码不一定非 0（下一节细讲）；print 模式才会因此非 0 退出。"),
          h("div", { class: "note warn" }, h("span", { class: "k" }, "stdin 陷阱"), "pi 会读 stdin，直到它关闭。被另一个程序启动、stdin 是一个开着的管道时，pi 会一直等（本机实测：超时才退出）。在循环里，它会吃掉循环的输入。凡是被程序调用、或者在循环里，都加 < /dev/null。"),
          bugHunt()),
        section("s-json", 3, "JSON 事件", "同一次运行，看全过程",
          todo("读四条规则，回答三道题。"),
          h("p", null, "从 M0 起你一直在用它：pi --mode json。它和 RPC、SDK 发出的是同一套事件，学会一次，三处通用。"),
          h("ul", { class: "rule" },
            h("li", null, "第一行是会话头（type: session），之后每行一个事件。stdout 只有 JSONL，日志在 stderr。"),
            h("li", null, h("b", null, "message_update 是增量"), "，不是越来越长的全文。显示时自己拼接，保存时用 message_end 里的完整消息。"),
            h("li", null, h("b", null, "agent_end ≠ 全部结束。"), "之后还可能有自动重试、溢出恢复、压缩或排队的消息。agent_settled 才表示不会再自动继续。"),
            h("li", null, h("b", null, "成败看事件，不看退出码。"), "失败或中止的回复只出现在事件里（stopReason 是 error 或 aborted），退出码可能仍是 0。")),
          EVQ.map((x, i) => choice({ id: "e" + i, store: [ID, "evq"], kicker: "事件 " + (i + 1) + " / " + EVQ.length, q: x.q, opts: x.opts, explain: x.why, shuffleSeed: 261 + i * 5 })),
          h("pre", { class: "script" }, h("span", { class: "lbl" }, "常用的 jq 写法"), `# 调用了哪些工具
pi --mode json … | jq -r 'select(.type=="tool_execution_start") | .toolName'
# 每次回复怎样结束（stop / toolUse / error / aborted）
pi --mode json … | jq -r 'select(.type=="message_end" and .message.role=="assistant") | .message.stopReason'
# 一共用了多少 token
pi --mode json … | jq -s '[.[] | select(.type=="message_end" and .message.role=="assistant") | .message.usage.totalTokens] | add'`)),
        section("s-rpc", 4, "RPC 协议", "一个长期运行的 pi，随时发命令",
          todo("逐条走完 25 条记录（可以播放）。然后读排队实验。"),
          h("p", null, "pi --mode rpc 启动后不退出。你往它的 stdin 写命令，它往 stdout 写两种记录：", h("b", null, "回执"), "（response，带回命令的 id）和", h("b", null, "事件"), "（不带 id，和 JSON 模式相同）。下面是本机录下的一次完整对话。"),
          wire(),
          h("h3", null, "排队实验：pi 忙的时候再发三条"),
          h("p", null, "本机实测。先让 pi「用 bash 运行 sleep 3，然后回答 一」。在它执行 sleep 时，立刻连发三条命令："),
          h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" },
            h("thead", null, h("tr", null, h("th", null, "命令"), h("th", null, "回执"), h("th", { style: { minWidth: "180px" } }, "后来怎样"))),
            h("tbody", null,
              h("tr", null, h("td", null, h("code", null, '{"type":"prompt","message":"再回答 二"}')), h("td", null, h("b", { style: { color: "var(--bad)" } }, "success:false"), h("br"), "Agent is already processing. Specify streamingBehavior…"), h("td", null, "被拒绝，什么都没发生。")),
              h("tr", null, h("td", null, h("code", null, '{"type":"prompt","message":"最后回答 三","streamingBehavior":"followUp"}')), h("td", null, "queued"), h("td", null, "整个运行结束后，作为新的一轮处理。回复「三」。")),
              h("tr", null, h("td", null, h("code", null, '{"type":"steer","message":"顺便回答 四"}')), h("td", null, "queued"), h("td", null, "sleep 跑完、下一次调用模型之前送达。模型一次回复「一。四」。"))))),
          h("ul", { class: "rule", style: { marginTop: "12px" } },
            h("li", null, h("b", null, "坏 JSON："), "回执 command 为 parse、success:false，没有 id。pi 不会崩溃。"),
            h("li", null, h("b", null, "停止："), "abort 中止当前运行；clear_queue 先取回排队的消息（界面里按 Esc 就是这两步）。"),
            h("li", null, h("b", null, "退出："), "关闭 stdin，pi 有序退出。"),
            h("li", null, h("b", null, "分行："), "只按 \\n 分记录。Node 的 readline 还会在 U+2028/U+2029 处分行，而这两个字符可以出现在 JSON 字符串里——别用它。Python 的二进制 readline() 没问题。"),
            h("li", null, h("b", null, "其他命令："), "set_model、set_thinking_level、compact、bash、get_messages、fork、switch_session……几乎每个界面操作都有对应命令。完整列表在 pi 文档 rpc-commands.md。"))),
        section("s-sdk", 5, "SDK", "不开子进程，直接把 pi 当库用",
          todo("点完 6 个要点。", true),
          h("p", null, "SDK 只能在 Node.js 或 Bun 里用。它没有进程边界：你的代码和 pi 在同一个进程里，能直接拿到 session 的一切。"),
          sdkView(),
          h("div", { class: "panel", style: { overflowX: "auto", marginTop: "12px" } }, h("table", { class: "grow" },
            h("thead", null, h("tr", null, h("th", null, ""), h("th", null, "RPC"), h("th", null, "SDK"))),
            h("tbody", null,
              [["语言", "任何能读写管道的语言", "Node.js / Bun"], ["隔离", "子进程：pi 崩了，你的程序还在", "同一进程"], ["能力", "命令列表里有的", "全部 API：customTools、自定义 sessionManager、读 systemPrompt……"], ["默认内置扩展", "和命令行相同", "不加载 codemode、tool_search、MCP；要自己加"], ["沙箱", "可以只把 pi 子进程关进沙箱", "要沙箱就得把整个程序关进去"]].map(([a, b, c]) => h("tr", null, h("td", { style: { color: "var(--fg-mute)", whiteSpace: "nowrap" } }, a), h("td", null, b), h("td", null, c)))))),
          h("p", { class: "dim", style: { marginTop: "10px" } }, "Node 程序想要进程隔离，又不想自己写协议？用包里导出的 RpcClient：它替你启动 pi --mode rpc、配对 id、等待 agent_settled。")),
        section("s-scen", 6, "选接法", "够用的最简单那一种",
          todo("四个场景，各选一种接法。"),
          SCEN.map((x, i) => choice({ id: "s" + i, store: [ID, "scen"], kicker: "场景 " + (i + 1) + " / " + SCEN.length, q: x.q, opts: x.opts, explain: x.why, shuffleSeed: 271 + i * 3 }))),
        section("s-auto", 7, "无人值守", "没人看着时，启动行要写全",
          todo("勾选六个开关，读每一项为什么需要。"),
          h("p", null, "自动化最常见的结局不是出错，而是悄悄出错：会话文件越积越多、循环只跑了一次、失败了却显示成功、AGENTS.md 让它多做了一件事。把这些都写进启动行里。"),
          builder()),
        section("s-lab", 8, "实验", "四种接法，各跑一次",
          todo("按第 1–6 步操作。全部在终端里完成。"),
          h("p", null, "你会用 print 处理管道输入并观察退出码，用 Python 驱动 RPC，用 Node 调用 SDK。三次读的是同一个 a.txt。"),
          h("div", { class: "note" }, h("span", { class: "k" }, "实验规则"), "只在 ~/pi-lab/m13 里做；所有运行都不留会话（--no-session 或 inMemory）；不装 npm 包，node 由 nix shell 临时提供；最后清理。共 3 次很小的模型调用。"),
          lab()),
        section("s-quiz", 9, "掌握测验", "10 题，8 题过关", todo("10 题全部作答，点「交卷」。"), window.Course.quizBlock(ID, QUIZ, checkDone)),
        section("s-recap", 10, "小结", "你学到了什么",
          todo("看自己的预测和成绩。觉得学会了，就在本节最后点「标记为已完成」。", true),
          h("p", { class: "lead" }, "一句话：只要文字用 print，要过程用 JSON，要随时控制用 RPC，要全部 API 用 SDK；四者共用同一套事件——等 agent_settled 才算完，成败看 stopReason，无人值守时把 --no-session、收窄工具、< /dev/null、超时和沙箱都写进启动行。"),
          rc))));
    return () => rc._cleanup && rc._cleanup();
  });
})();
