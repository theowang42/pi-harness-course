/* M7 · 指令层 */
(function () {
  "use strict";
  const { h, Store, section, quizBlock, lessonHead, look, howto, endBlock } = window.Course;
  const ID = "M7";

  // Parts of the system prompt and their sizes in characters, captured with a local fake model (pi 0.99.2).
  const SECS = [
    ["base", "pi 的基础说明", 169],
    ["tools", "工具清单", 339],
    ["rules", "工具使用规则", 839],
    ["docs", "pi 文档索引", 1334],
    ["append", "追加的说明", 48],
    ["agents", "AGENTS.md", 250],
    ["cwd", "工作目录", 100],
  ];
  const PI_OWN = ["base", "tools", "rules", "docs"];

  // ================= §1 system prompt composer =================
  function composer() {
    const st = { agents: true, append: true, system: false };
    const boxes = [["agents", "项目里有 AGENTS.md"], ["append", "有 APPEND_SYSTEM.md"], ["system", "有 SYSTEM.md"]]
      .map(([k, t]) => { const i = h("input", { type: "checkbox", id: "m7-c-" + k, checked: st[k] }); i.addEventListener("change", () => { st[k] = i.checked; paint(); }); return h("label", { for: "m7-c-" + k }, i, t); });
    const stack = h("div", { class: "sp-stack" });
    function paint() {
      const rows = SECS.map(([k, nm, len]) => {
        let cls = "sp-sec", src = "pi 生成", text = nm, show = true;
        if (PI_OWN.includes(k)) {
          if (st.system) { if (k === "base") { text = "SYSTEM.md 的全文"; src = "你写的，换掉了 pi 的这四部分"; cls += " repl"; } else { cls += " gone"; src = "被 SYSTEM.md 换掉了"; } }
        } else if (k === "append") { if (st.append) { src = "APPEND_SYSTEM.md 的全文"; cls += " you"; } else show = false; }
        else if (k === "agents") { if (st.agents) { src = "各级目录的 AGENTS.md（第 6 课的规则）"; cls += " you"; } else show = false; }
        return show ? h("div", { class: cls }, h("span", { class: "nm" }, text), h("span", { class: "src" }, src), h("span", { class: "ln" }, cls.includes("gone") ? "" : cls.includes("repl") ? "你决定" : len + " 字")) : null;
      }).filter(Boolean);
      stack.replaceChildren(h("div", { class: "mute", style: { fontSize: "15px", marginBottom: "4px" } }, "系统提示，从上到下："), ...rows,
        h("div", { class: "sp-api" }, "工具定义不在系统提示里，它们是请求里单独的一部分，无论怎么设置都照样发送。"));
    }
    paint();
    return h("div", { class: "panel" },
      h("div", { class: "panel-h" }, h("span", null, "系统提示由哪几部分组成（实测）"), h("span", null, "勾选左边的条件")),
      h("div", { class: "sp-wrap" }, h("div", { class: "sp-ctrl" }, boxes), stack));
  }

  // ================= §2 AGENTS.md clinic =================
  const CLINIC = [
    ["- 运行测试：python3 -m pytest -q", "keep", "每轮都可能用到，而且模型自己猜不到。留下。"],
    ["- 你是一个世界顶级的、非常聪明的资深工程师。", "del", "空话。不会改变它的做法，却每轮都要花 token。删掉。"],
    ["- 发布流程：（以下 120 行详细步骤……）", "skill", "又长又偶尔才用：做成 Skill，需要时再读（第 9 课）。"],
    ["- 代码注释用英文，提交信息用中文。", "keep", "简短、每轮相关的约定。留下。"],
    ["- 每次都要先读完 src/ 下的全部文件再开始。", "del", "会把上下文吃光（第 2 课）。删掉，让它按需读。"],
    ["- 写周报：用这个格式……本周完成……下周计划……", "tpl", "固定格式、由你主动发起的任务：做成提示模板 /weekly（§4）。"],
    ["- 不要修改 vendor/ 目录。", "keep", "简短的边界说明，留下。但它只是文字，模型不一定遵守；真要禁止得靠第 11、13 课的办法。"],
  ];
  const CH = [["keep", "留在 AGENTS.md"], ["tpl", "改成提示模板"], ["skill", "改成 Skill"], ["del", "删掉"]];
  function clinic() {
    const saved = Store.get(ID, "clinic", {});
    const pick = { ...(saved.pick || {}) };
    let checked = !!saved.checked;
    const list = h("div"), fb = h("div", { class: "feedback", style: { padding: "12px 14px" }, hidden: true });
    function paint() {
      list.replaceChildren(...CLINIC.map(([line, ans, why], i) => h("div", { class: "row2" },
        h("span", { class: "line" }, line),
        h("span", { class: "ch" }, CH.map(([k, t]) => h("button", { "aria-pressed": pick[i] === k ? "true" : "false", class: checked ? (k === ans ? "right" : pick[i] === k ? "wrong" : "") : "", onclick: () => { pick[i] = k; checked = false; Store.set(ID, "clinic", { pick: { ...pick } }); paint(); } }, t))),
        checked ? h("div", { class: "why" }, why) : null)));
      const n = CLINIC.filter((c, i) => pick[i] === c[1]).length;
      fb.hidden = !checked;
      if (checked) fb.replaceChildren(h("span", { class: "verdict " + (n === CLINIC.length ? "ok" : "no") }, `${n} / ${CLINIC.length}`), n === CLINIC.length ? "全对。" : "看每行下面的解释。");
    }
    paint();
    return h("div", { class: "panel clinic" }, h("div", { class: "panel-h" }, h("span", null, "一份写得不好的 AGENTS.md：每一行该怎么处理？"),
      h("span", null, h("button", { class: "btn primary", onclick: () => { checked = true; Store.set(ID, "clinic", { pick: { ...pick }, checked: true }); paint(); } }, "核对"),
        h("button", { class: "btn ghost", style: { marginLeft: "6px" }, onclick: () => { CLINIC.forEach((c, i) => { pick[i] = c[1]; }); checked = true; Store.set(ID, "clinic", { pick: { ...pick }, checked: true }); paint(); } }, "显示答案"))), list, fb);
  }

  // ================= §4 template playground =================
  function splitArgs(s) {
    const out = []; let cur = "", q = null, has = false;
    for (const ch of s) {
      if (q) { if (ch === q) q = null; else cur += ch; continue; }
      if (ch === '"' || ch === "'") { q = ch; has = true; continue; }
      if (/\s/.test(ch)) { if (cur || has) { out.push(cur); cur = ""; has = false; } continue; }
      cur += ch;
    }
    if (cur || has) out.push(cur);
    return out;
  }
  function expand(tpl, args) {
    const all = args.join(" ");
    return tpl
      .replace(/\$\{@:(\d+):(\d+)\}/g, (_, n, l) => args.slice(+n - 1, +n - 1 + +l).join(" "))
      .replace(/\$\{@:(\d+)\}/g, (_, n) => args.slice(+n - 1).join(" "))
      .replace(/\$\{@:-([^}]*)\}/g, (_, d) => (args.length ? all : d))
      .replace(/\$\{(\d+):-([^}]*)\}/g, (_, n, d) => (args[+n - 1] !== undefined && args[+n - 1] !== "" ? args[+n - 1] : d))
      .replace(/\$ARGUMENTS|\$@/g, all)
      .replace(/\$(\d+)/g, (_, n) => args[+n - 1] ?? "");
  }
  function playground() {
    const body = h("textarea", { id: "m7-tpl", spellcheck: "false", "aria-label": "模板正文" });
    body.value = "请审查当前改动，重点看${1:-正确性}。其他要求：${@:2}";
    const args = h("input", { id: "m7-args", value: '"API 兼容" 写清楚原因' });
    const typed = h("div", { class: "mono", style: { fontSize: "15px" } }), argv = h("div", { class: "args" }), out = h("div", { class: "outmsg" });
    function run() {
      const a = splitArgs(args.value);
      typed.textContent = "你在编辑器里输入：/review" + (args.value ? " " + args.value : "");
      argv.replaceChildren(...(a.length ? a.map((x, i) => h("span", null, "$" + (i + 1) + " = " + (x || "（空）"))) : [h("span", { class: "mute" }, "没有参数")]));
      out.textContent = expand(body.value, a);
    }
    [body, args].forEach((x) => x.addEventListener("input", run));
    run();
    return h("div", { class: "panel tpl" },
      h("div", { class: "pane" }, h("b", null, "模板文件 review.md 的正文"), body,
        h("label", { for: "m7-args", style: { fontSize: "15px", color: "var(--fg-dim)" } }, "调用时跟在 /review 后面的参数", args)),
      h("div", { class: "pane" }, typed, argv, h("b", null, "实际发给模型的消息"), out));
  }

  const QUIZ = [
    { q: "AGENTS.md 的内容什么时候会发给模型？", opts: [{ t: "每一次请求都在系统提示里", ok: true }, { t: "只在第一次请求时" }, { t: "只在模型需要时" }], why: "所以 AGENTS.md 只写每轮都用得上的、简短的内容，长内容做成 Skill。" },
    { q: "想给 pi 加几条自己的规则，同时保留它原有的说明和规则。用哪个？", opts: [{ t: "APPEND_SYSTEM.md 或 AGENTS.md", ok: true }, { t: "SYSTEM.md" }], why: "SYSTEM.md 会把 pi 自己的说明、工具清单、使用规则整个换掉。只有要把 pi 改造成别的东西时才用它。" },
    { q: "每周五都要让 pi 写一份同样格式的周报，只是周次不同。最合适的是：", opts: [{ t: "提示模板 /weekly，周次作为参数", ok: true }, { t: "写进 AGENTS.md" }, { t: "写进 SYSTEM.md" }], why: "固定格式、你主动发起、只差参数：提示模板。平时不占上下文。" },
    { q: "模板 review.md 写着「重点看${1:-正确性}」。输入 /review 不带参数，模型收到：", opts: [{ t: "重点看正确性", ok: true }, { t: "重点看" }, { t: "重点看${1:-正确性}" }, { t: "/review" }], why: "${1:-默认值}：没给第 1 个参数时用默认值。模型看不到 /review 这个命令本身，只看到展开后的文字。" },
    { q: "AGENTS.md 里写了「不要修改 vendor/」。这能保证 vendor/ 不被修改吗？", opts: [{ t: "不能。它只是文字，模型可能不遵守", ok: true }, { t: "能，pi 会拦下来" }], why: "说明文字既不增加能力，也不构成限制。真要禁止，得在执行前拦截（第 11 课）或用沙箱（第 13 课）。" },
  ];

  window.Course.register(ID, (page) => {
    page.append(h("div", { class: "col" },
      lessonHead(ID, [
        h("p", null, "你希望 pi 记住一些事：这个项目跑测试用 pnpm 不用 npm；回答一律用中文；周报按固定格式写。办法是", h("b", null, "写说明文字"), "，让 pi 放进请求里。"),
        h("p", null, "pi 提供了几个放说明的地方：AGENTS.md、APPEND_SYSTEM.md、SYSTEM.md，以及提示模板。它们的区别在于：什么时候出现在请求里、花多少上下文、会不会挤掉 pi 自己的说明。这一课讲清楚每一种，以及怎么选。"),
      ], [
        "系统提示由哪几部分组成，你的说明落在哪里。",
        "AGENTS.md 该写什么、不该写什么。",
        "提示模板怎么写、怎么用；各种说明该放在哪里。",
      ]),

      section("s-parts", 1, "系统提示", "你的说明落在系统提示的哪里",
        h("p", null, "第 1 课说过，每次请求最前面是系统提示。它由 pi 拼起来：先是 pi 自己的说明和工具规则，然后是你写的说明，最后是工作目录。"),
        look("勾选左边的条件，看系统提示怎么变。特别注意勾上 SYSTEM.md 时，哪几部分消失了。")),
      h("div", { class: "bench" }, composer()),
      h("ul", { class: "rule", style: { marginTop: "18px" } },
        h("li", null, h("b", null, "AGENTS.md："), "最常用。每次请求都在。"),
        h("li", null, h("b", null, "APPEND_SYSTEM.md："), "也是在系统提示里追加说明，排在 AGENTS.md 前面。和 AGENTS.md 的区别：它放在 .pi/ 或全局目录里，项目里的那份需要信任才加载。"),
        h("li", null, h("b", null, "SYSTEM.md："), "换掉 pi 自己的说明、工具清单和使用规则。模型仍然有工具可用，只是没人教它怎么用好。只有要把 pi 改造成完全不同的东西（比如只做翻译）时才用。")),

      section("s-agents", 2, "AGENTS.md", "AGENTS.md 写什么",
        h("p", null, "AGENTS.md 每轮都发送（第 2 课），所以每一行都要值这个价。只写满足三个条件的内容："),
        h("ul", { class: "rule" },
          h("li", null, h("b", null, "模型猜不到："), "测试命令、项目约定、目录结构里的特殊之处。"),
          h("li", null, h("b", null, "几乎每轮都用得到："), "偶尔用的放进提示模板或 Skill。"),
          h("li", null, h("b", null, "简短："), "一行说明连同包装大约 80 token，每轮都付。")),
        h("p", null, "放在哪里："),
        h("ul", { class: "rule" },
          h("li", null, h("b", null, "~/.pi/agent/AGENTS.md："), "个人偏好，所有项目通用，例如「回答用简体中文」。"),
          h("li", null, h("b", null, "项目根目录："), "这个项目的约定。可以提交到 git，和同事共享。"),
          h("li", null, h("b", null, "子目录："), "只在从那个目录启动时才加载（第 6 课的逐级规则）。")),
        look("给这份 AGENTS.md 的每一行选一个处理方式，再点「核对」。拿不准就「显示答案」，看每行的解释。")),
      clinic(),

      section("s-tpl", 3, "提示模板", "提示模板：把常用的话变成 / 命令",
        h("p", null, "有些话你会反复说，只是每次换几个词，比如「审查改动，重点看 XX」。把它写成一个提示模板，以后输入 /review XX 就行。"),
        h("p", null, "模板就是一个 Markdown 文件，", h("b", null, "文件名就是命令名"), "。放在 ~/.pi/agent/prompts/（所有项目可用）或项目的 .pi/prompts/（需要信任）。例如 ~/.pi/agent/prompts/review.md："),
        h("pre", null, `---
description: 审查当前改动，可以指定重点
argument-hint: "[重点] [其他要求]"
---
请审查当前改动，重点看\${1:-正确性}。其他要求：\${@:2}`),
        h("p", null, "开头两行是给命令菜单看的：description 是说明，argument-hint 提示要填什么参数。正文里可以用这几种占位符："),
        howto("占位符", [
          ["$1  $2 …", "第 1、第 2 个参数。参数用空格分开；带空格的参数用引号括起来。"],
          ["${1:-默认值}", "第 1 个参数；没给就用默认值。"],
          ["$@", "全部参数。"],
          ["${@:2}", "从第 2 个起的全部参数。"],
        ]),
        look("改一改参数（比如清空，或去掉引号），看右边实际发给模型的消息怎么变。")),
      h("div", { class: "bench" }, playground()),
      h("p", { style: { marginTop: "16px" } }, "模型看不到 /review 这个命令，只看到展开后的文字。模板平时不占上下文，只有你调用时才变成一条消息。新增或修改模板后，在 pi 里 /reload。"),

      section("s-which", 4, "怎么选", "各种说明放在哪里",
        h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" },
          h("thead", null, h("tr", null, h("th", null, "内容"), h("th", null, "放在"), h("th", null, "原因"))),
          h("tbody", null,
            h("tr", null, h("td", null, "这个项目每轮都要知道的约定"), h("td", null, "项目根目录的 AGENTS.md"), h("td", null, "每轮都在，跟着项目走。")),
            h("tr", null, h("td", null, "所有项目通用的个人偏好"), h("td", null, "~/.pi/agent/AGENTS.md"), h("td", null, "写一次，到处生效。")),
            h("tr", null, h("td", null, "固定格式、由你主动发起、只差几个词"), h("td", null, "提示模板"), h("td", null, "平时不占上下文。")),
            h("tr", null, h("td", null, "很长、偶尔才用、该由模型判断何时需要"), h("td", null, "Skill（第 9 课）"), h("td", null, "平时只占一句描述，用时才读全文。")),
            h("tr", null, h("td", null, "要把 pi 改造成另一种工具"), h("td", null, "SYSTEM.md"), h("td", null, "会换掉 pi 自己的规则，一般不用。"))))),
        h("div", { class: "note warn" }, h("span", { class: "k" }, "说明只是文字"), "写「可以上网」不会多出联网工具；写「不要删文件」模型也可能删；陌生仓库里的 AGENTS.md 可能是别人写来误导你的模型的。要增加能力，用扩展加工具（第 10 课）；要真正禁止，在执行前拦截（第 11 课）或用沙箱（第 13 课）。")),

      section("s-quiz", 5, "检查", "检查一下", quizBlock(ID, QUIZ, null, null)),

      section("s-end", 6, "小结", "小结",
        endBlock(ID, [
          "AGENTS.md 和 APPEND_SYSTEM.md 每轮都在系统提示里，只写简短、每轮都用得上、模型猜不到的内容。",
          "SYSTEM.md 会换掉 pi 自己的说明和规则，一般不用。",
          "提示模板是一个 Markdown 文件，文件名就是 / 命令，调用时才展开成一条消息。",
          "说明只是文字：不增加能力，也不能真正禁止什么。",
        ], { id: "M8", text: "很长、偶尔才用的说明怎么办？Skill 平时只占一句话，需要时模型自己去读。" }))));
  });
})();
