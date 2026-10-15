/* M8 · Skill */
(function () {
  "use strict";
  const { h, section, quizBlock, lessonHead, look, howto, endBlock } = window.Course;
  const ID = "M8";

  const SKILL_MD = `---
name: commit-msg
description: 按团队格式写 git 提交信息。用户要求写提交信息、commit message 时使用。
---

# 提交信息格式

1. 第一行：\`类型: 摘要\`。类型只用 feat、fix、docs、refactor、test 之一。
2. 摘要用中文，不超过 30 个字，结尾不加句号。
3. 空一行，然后用 1–3 个要点说明「为什么改」。`;

  // ================= §2 progressive loading, a real run =================
  function stages() {
    let stage = 0;
    const ST = [
      ["平时", "每次请求的系统提示里，只有这几行", `<skill>
  <name>commit-msg</name>
  <description>按团队格式写 git 提交信息。用户要求写提交信息、commit message 时使用。</description>
  <location>…/.pi/skills/commit-msg/SKILL.md</location>
</skill>`, [["固定部分", 70, "var(--c-harness)"], ["目录", 6, "var(--c-tool)"]]],
      ["任务对上了", "模型自己调用 read，把全文读进来", `你：帮我为这个改动写一条提交信息：修复了登录时密码为空会崩溃的问题。

模型：read(".pi/skills/commit-msg/SKILL.md")
工具结果：# 提交信息格式 …（全文进入上下文）`, [["固定部分", 70, "var(--c-harness)"], ["目录", 6, "var(--c-tool)"], ["Skill 全文", 12, "var(--c-model)"]]],
      ["照着做", "回复遵守了 Skill 里的格式", `fix: 修复登录时密码为空导致的崩溃

- 避免空密码触发崩溃，保障登录流程稳定性`, [["固定部分", 70, "var(--c-harness)"], ["目录", 6, "var(--c-tool)"], ["Skill 全文", 12, "var(--c-model)"], ["回复", 5, "var(--c-user)"]]],
    ];
    const els = ST.map(([tt, sub, code, ctx], i) => h("div", { class: "pl-stage" + (i === 0 ? " on" : "") },
      h("div", { class: "n" }, "第 " + (i + 1) + " 步 · " + tt), h("div", { class: "tt" }, sub), h("pre", null, code),
      h("div", { class: "mute", style: { fontSize: "15px", marginTop: "8px" } }, "上下文占用示意：深蓝是固定部分，紫色是 Skill 目录，橙色是 Skill 全文，青色是回复"), h("div", { class: "pl-ctx" }, ctx.map(([t, w, c]) => h("span", { style: { flexBasis: w + "%", background: c }, title: t }, w >= 10 ? t : "")))));
    const btn = h("button", { class: "btn primary", onclick: () => { stage = (stage + 1) % 3; els.forEach((e, i) => e.classList.toggle("on", i <= stage)); btn.textContent = stage === 2 ? "重来" : "下一步"; } }, "下一步");
    return h("div", { class: "panel" },
      h("div", { class: "panel-h" }, h("span", null, "一次真实运行"), btn),
      h("div", { class: "pl-stages" }, els),
      h("p", { class: "mute", style: { fontSize: "15px", padding: "0 16px 14px", margin: 0 } }, "对照：同一个会话里问「用一句话解释 git rebase」，模型没有去读这个 Skill。"));
  }

  const QUIZ = [
    { q: "装了一个 Skill。在模型决定用它之前，每次请求里有它的什么？", opts: [{ t: "名字、一句描述和文件位置", ok: true }, { t: "SKILL.md 的全文" }, { t: "什么都没有" }], why: "全文要等任务对上了，模型自己用 read 去读。" },
    { q: "哪个描述更可能让模型在该用的时候用上这个 Skill？", opts: [{ t: "生成数据库迁移脚本并检查回滚步骤。用户要修改表结构或写迁移时使用。", ok: true }, { t: "数据库相关的工具。" }], why: "模型只凭这一句决定读不读全文。写清「做什么」和「什么时候用」。" },
    { q: "你确定这次要用 commit-msg 这个 Skill，不想让模型自己判断。怎么做？", opts: [{ t: "输入 /skill:commit-msg，后面跟上要求", ok: true }, { t: "把它写进 AGENTS.md" }, { t: "重启 pi" }], why: "/skill:名字 直接把 Skill 正文放进你的消息，不靠模型判断。" },
    { q: "一个会删除测试数据库的流程，你不希望模型自己决定什么时候执行。Skill 里应该：", opts: [{ t: "加上 disable-model-invocation: true，只允许你用 /skill: 手动调用", ok: true }, { t: "在描述里写「请谨慎使用」" }, { t: "什么都不用做" }], why: "这样它不会出现在模型的目录里，只能由你手动触发。" },
    { q: "Skill 能让没有联网工具的 pi 上网吗？", opts: [{ t: "不能。Skill 是说明书，不是工具", ok: true }, { t: "能，只要步骤写清楚" }], why: "能力只来自工具（第 1 课）。但 Skill 可以教模型用已有的 bash 去运行 curl。" },
  ];

  window.Course.register(ID, (page) => {
    page.append(h("div", { class: "col" },
      lessonHead(ID, [
        h("p", null, "上一课说过，AGENTS.md 每轮都发送，只适合写简短的约定。那一份 120 行的发布流程、一套代码审查清单，这种又长又偶尔才用的说明放哪里？"),
        h("p", null, h("b", null, "Skill"), "（技能）就是为它设计的：它是一份放在固定位置的说明书。平时请求里只有它的名字和一句描述；当任务对上了，模型自己去把全文读进来。这一课讲 Skill 怎么写、怎么被用上，以及描述该怎么写。"),
      ], [
        "Skill 是什么，它的全文什么时候才进入上下文。",
        "怎样写一个 Skill，描述该怎么写模型才会用对。",
        "怎样手动调用，以及 Skill 该放在哪里。",
      ]),

      section("s-anat", 1, "结构", "一个 Skill 长什么样",
        h("p", null, "一个 Skill 就是一个目录，里面必须有一个 SKILL.md，还可以放脚本和参考资料："),
        h("pre", null, `commit-msg/
├── SKILL.md             ← 必需：开头几行信息 + 说明
├── scripts/check.sh     ← 可选：要模型运行的脚本
└── references/types.md  ← 可选：更详细的资料，需要时再读`),
        h("p", null, "SKILL.md 的例子："),
        h("pre", null, SKILL_MD),
        h("ul", { class: "rule" },
          h("li", null, h("b", null, "name："), "Skill 的名字，只用小写字母、数字和连字符。也是手动调用时的命令名。"),
          h("li", null, h("b", null, "description："), "最重要的一行。模型只看它来决定要不要读全文。没有 description 的 Skill 不会加载。"),
          h("li", null, h("b", null, "正文："), "写给模型的具体做法。提到附带的文件时用相对路径（相对于 Skill 目录），pi 会告诉模型 Skill 在哪里。"))),

      section("s-load", 2, "按需加载", "全文什么时候才读进来",
        h("p", null, "pi 启动时找到所有 Skill，只把每个的名字、描述和位置放进系统提示，像一本书的目录。模型读请求时看到这份目录，觉得某个 Skill 和当前任务相关，就自己调用 read 把它的 SKILL.md 读进来，然后照着做。"),
        look("点「下一步」，看一次真实运行的三步：平时请求里只有什么；任务对上后发生了什么；最后的回复是否照着 Skill 写。注意下方上下文占用的变化。")),
      h("div", { class: "bench" }, stages()),
      h("p", { style: { marginTop: "16px" } }, "这样，长说明只在用到时才占上下文。但要注意两点："),
      h("ul", { class: "rule" },
        h("li", null, h("b", null, "目录每轮都在。"), "每个 Skill 的名字和描述都要占位置，装几十个 Skill 也是一笔固定开销。"),
        h("li", null, h("b", null, "模型可能没想到用它。"), "要不要读全文由模型判断，它有时会漏掉。确定要用时，就手动调用（§4）。")),

      section("s-desc", 3, "描述", "描述决定它会不会被用上",
        h("p", null, "模型只看描述来决定读不读全文。一组对照实验：三个 Skill，同一个「写提交信息」的请求，各跑两次："),
        h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" },
          h("thead", null, h("tr", null, h("th", null, "三个 Skill 的描述"), h("th", null, "第 1 次"), h("th", null, "第 2 次"))),
          h("tbody", null,
            h("tr", null, h("td", null, "都写「帮助处理文字。」"), h("td", null, "读了 commit-msg，又多读了两个无关的"), h("td", null, "只读了 commit-msg")),
            h("tr", null, h("td", null, "各自写清做什么、什么时候用"), h("td", null, "只读了 commit-msg"), h("td", null, "只读了 commit-msg"))))),
        h("p", { style: { marginTop: "14px" } }, "描述含糊时，模型分不清该读哪个，就会多读，白白占用上下文。好的描述 = ", h("b", null, "做什么 + 什么时候用"), "："),
        h("ul", { class: "rule" },
          h("li", null, "差：「帮助处理 PDF。」"),
          h("li", null, "好：「从 PDF 中提取文字和表格。用户要读取、转换或检查 PDF 时使用。」"))),

      section("s-use", 4, "使用", "手动调用、放在哪里",
        h("p", null, "输入 /skill:名字，后面可以跟上要求，例如 /skill:commit-msg 新增导出 CSV 报表。pi 会把 Skill 的正文直接放进你的消息里，不需要模型判断，也不需要它再去读。"),
        h("p", null, "如果某个 Skill 有副作用（比如会删数据），你不希望模型自己决定何时使用，就在开头加一行 ", h("code", null, "disable-model-invocation: true"), "。它不会出现在模型的目录里，只能由你手动调用。"),
        howto("Skill 放在哪里", [
          ["~/.pi/agent/skills/", "全局，所有项目都能用。"],
          [".pi/skills/", "当前项目，需要信任（第 6 课）。"],
          ["~/.agents/skills/  或项目里的 .agents/skills/", "Agent Skills 开放规范的通用位置。别的支持这套规范的工具也能用同一个 Skill。"],
        ], "放进去以后，新开 pi 或在会话里 /reload。启动时 pi 会列出加载到的 Skill；有问题的（比如缺描述）会显示警告。"),
        h("div", { class: "note warn" }, h("span", { class: "k" }, "Skill 也只是文字"), "它不会让 pi 多出任何工具，也不能真正禁止什么。陌生项目里的 Skill 可能让模型运行脚本、改文件，信任项目前先看看它写了什么。")),

      section("s-which", 5, "怎么选", "说明放哪里：三种文字",
        h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" },
          h("thead", null, h("tr", null, h("th", null, "需求"), h("th", null, "用"))),
          h("tbody", null,
            h("tr", null, h("td", null, "每轮都要知道的简短约定"), h("td", null, "AGENTS.md")),
            h("tr", null, h("td", null, "你手动触发的固定提示，只差几个词"), h("td", null, "提示模板")),
            h("tr", null, h("td", null, "较长的专门做法，模型按需取用，可以带脚本和资料"), h("td", null, "Skill")),
            h("tr", null, h("td", null, "新的动作、拦截危险操作、自动化，需要写代码"), h("td", null, "扩展（下一课）")))))),

      section("s-quiz", 6, "检查", "检查一下", quizBlock(ID, QUIZ, null, null)),

      section("s-end", 7, "小结", "小结",
        endBlock(ID, [
          "Skill 是一个带 SKILL.md 的目录。平时请求里只有它的名字和描述，任务对上了模型才读全文。",
          "描述要写清「做什么 + 什么时候用」，否则模型会漏用或多读。",
          "确定要用时输入 /skill:名字；有副作用的 Skill 加 disable-model-invocation: true，只允许手动调用。",
        ], { id: "M9", text: "前面的说明、模板、Skill 都只是文字。下一课写代码：给 pi 加一个真正的新工具和新命令。" }))));
  });
})();
