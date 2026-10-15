/* M17（显示为第 18 课）· 选择与组合 */
(function () {
  "use strict";
  const { h, $$, Store, section, quizBlock, lessonHead, look, howto, endBlock } = window.Course;
  const ID = "M17";

  // ================= §5 chooser =================
  // each option: [text, pi points, omp points, note]
  const QS = [
    { k: "use", q: "你主要怎样用它？", o: [["在终端里和它一起写代码", 0, 2, "交互为主：omp 的 hashline、LSP、子代理能直接省事。"], ["嵌进脚本、定时任务或自己的程序", 2, 0, "嵌入为主：pi 小而稳（第 14 课）。"], ["两样都有", 1, 1, "两样都有：交互用 omp，自动化用 pi，共用 AGENTS.md（§3）。"]] },
    { k: "cost", q: "每一轮的上下文成本，你在意吗？", o: [["很在意（长会话、按量付费、小窗口模型）", 2, 0, "省上下文：pi 默认请求约 1.3k，omp 约 6.4k。"], ["不太在意", 0, 1, ""]] },
    { k: "power", q: "你需要子代理、LSP、hashline 编辑、TTSR 规则这些能力吗？", o: [["需要，而且不想自己写", 0, 3, "omp 都内置了。"], ["偶尔需要，可以自己写扩展", 2, 0, "pi + 自己的扩展：只加真正用到的（第 10–12 课）。"], ["不需要", 2, 0, ""]] },
    { k: "repo", q: "你经常打开陌生的仓库吗？", o: [["经常", 1, 0, "陌生仓库：pi 有项目信任；用 omp 一定要加 --no-extensions，最好放进隔离环境（第 13、15 课）。"], ["很少，基本是自己的仓库", 0, 0, ""]] },
    { k: "diy", q: "你愿意花时间搭自己的配置吗？", o: [["愿意，我想清楚知道每一层在做什么", 2, 0, "自己搭：pi 是更小的底座，每一层都看得见。"], ["不想，开箱即用最好", 0, 2, "开箱即用：omp 的默认已经搭好，但要逐项看清哪些开着（第 15 课）。"]] },
  ];
  function chooser() {
    const ans = { ...Store.get(ID, "pick", {}) };
    const res = h("div", { class: "res" });
    const blocks = QS.map((x) => h("div", { class: "cq" }, h("b", null, x.q),
      h("div", { class: "cq-o" }, x.o.map((o, i) => h("button", { class: "pick", "aria-pressed": ans[x.k] === i ? "true" : "false", onclick: () => { ans[x.k] = i; Store.set(ID, "pick", { ...ans }); paint(); } }, o[0])))));
    function paint() {
      blocks.forEach((b, qi) => $$(".pick", b).forEach((btn, i) => btn.setAttribute("aria-pressed", ans[QS[qi].k] === i ? "true" : "false")));
      const n = QS.filter((x) => ans[x.k] !== undefined).length;
      if (n < QS.length) { res.replaceChildren(h("p", { class: "mute", style: { margin: 0 } }, `回答全部 ${QS.length} 题后显示建议。已答 ${n} 题。`)); return; }
      let p = 0, o = 0; const notes = [];
      QS.forEach((x) => { const c = x.o[ans[x.k]]; p += c[1]; o += c[2]; if (c[3]) notes.push(c[3]); });
      const both = ans.use === 2 || Math.abs(p - o) <= 1;
      res.replaceChildren(
        h("div", { class: "cbig" }, both ? "两个都用" : p > o ? "pi" : "omp"),
        h("ul", { class: "rule" }, notes.map((t) => h("li", null, t))),
        h("p", { class: "mute", style: { margin: 0 } }, "这只是把你的回答对应到课程里的事实上，理由比结论重要。"));
    }
    paint();
    return h("div", { class: "panel chooser" }, h("div", { class: "cq-list" }, blocks), res);
  }

  const ROWS = [
    ["定位", "小而透明的底座，你自己往上加", "pi 的分支，默认就带很多能力", "第 1、15 课"],
    ["每次请求的固定开销", "约 1.3k token（不带扩展）", "约 6.4k token", "第 2、15 课"],
    ["陌生仓库", "有项目信任：.pi 里的代码要你同意才加载", "没有项目信任：.omp/extensions 一启动就运行", "第 6、13、15 课"],
    ["审批", "没有内置，自己写拦截扩展", "always-ask / write / yolo，默认 yolo", "第 11、15 课"],
    ["改文件", "抄旧文本再替换", "hashline：行号 + 文件标签，输出少好几倍", "第 16 课"],
    ["懂代码", "自己接（扩展或 MCP）", "内置 LSP、ast_grep（后者默认关）", "第 12、16 课"],
    ["多个 agent", "自己写扩展或脚本", "子代理 + 模型角色", "第 17 课"],
    ["规则", "AGENTS.md、Skill；拦截靠扩展", "另有 TTSR：平时零成本，写错就拉回重写", "第 8、9、17 课"],
    ["嵌入程序", "print / JSON / RPC / SDK", "同样四种，细节不同", "第 14 课"],
  ];

  const QUIZ = [
    { q: "把 omp 的工具收窄到 read、grep、glob 三个后，同一个只读问题，它的输入和 pi 差不多吗？", opts: [{ t: "仍然明显更多：omp 的系统提示更长，每次请求都要发", ok: true }, { t: "差不多" }], why: "实测 pi 约 3,500、omp 约 8,400（都是 3 次请求）。收窄工具只能砍掉工具定义那部分。" },
    { q: "同一套项目说明要同时给 pi 和 omp 用，写在：", opts: [{ t: "根目录 AGENTS.md，且同一层不放 .omp/AGENTS.md 和 .claude/CLAUDE.md", ok: true }, { t: ".omp/AGENTS.md" }, { t: ".pi/AGENTS.md" }], why: "omp 同一层只读一个，有 .omp/AGENTS.md 或 .claude/CLAUDE.md 时它就不读 AGENTS.md 了。" },
    { q: "在 8k 窗口的本地小模型上做简单的文件整理，更合适的是：", opts: [{ t: "pi，只开需要的工具", ok: true }, { t: "omp 默认配置" }], why: "omp 的默认请求就要约 6.4k，几乎占满窗口。" },
    { q: "Python 写的后台服务要调用 agent 处理用户上传的文档：", opts: [{ t: "pi 的 RPC（子进程），放进隔离环境，不留会话", ok: true }, { t: "pi 的 SDK" }, { t: "omp 的交互模式" }], why: "SDK 只能在 Node.js / Bun 里用；无人值守要隔离（第 13、14 课）。" },
    { q: "两个都装时，最容易踩的坑是：", opts: [{ t: "共用 PI_CODING_AGENT_DIR 这类环境变量，互相影响", ok: true }, { t: "两个不能同时安装" }], why: "给 omp 设了这个变量，同一终端里的 pi 就找不到凭证。要隔离 omp，用 --profile。" },
  ];

  window.Course.register(ID, (page) => {
    page.append(h("div", { class: "col" },
      lessonHead(ID, [
        h("p", null, "pi 和 omp 都学过了。这一课不学新功能，只回答一个问题：", h("b", null, "给定一个人、一个任务，用哪一个，怎么配"), "。"),
        h("p", null, "先用一张表把前 17 课压在一起，再看两个一起用时要注意什么，最后过一遍常见场景。"),
      ], [
        "pi 和 omp 在成本、安全、编辑、协作、嵌入上的主要差别。",
        "两个一起用时，哪些共用、哪些分开。",
        "常见场景各该怎么选。",
      ]),

      section("s-map", 1, "对照", "前 17 课，压成一张表",
        h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" },
          h("thead", null, h("tr", null, h("th", null, ""), h("th", null, "pi"), h("th", null, "omp"), h("th", null, "出处"))),
          h("tbody", null, ROWS.map(([a, b, c, d]) => h("tr", null, h("td", { style: { color: "var(--fg-mute)" } }, a), h("td", null, b), h("td", null, c), h("td", { class: "mute", style: { whiteSpace: "nowrap" } }, d))))))),

      section("s-cost", 2, "成本", "收窄工具之后，差距还剩多少",
        h("p", null, "第 15 课测过 omp 的默认请求约 6.4k token，由两块组成：约 2.5k 的系统提示，约 3.9k 的工具定义。收窄工具只能砍掉第二块。一次实测：两边都只给只读工具，问同一个问题「这个仓库里有几个 Python 文件，各是做什么的」："),
        h("div", { class: "panel", style: { padding: "14px 16px", display: "grid", gap: "8px" } },
          [["pi（4 个只读工具，不读 AGENTS.md）", 3500, "var(--c-harness)"], ["omp（3 个只读工具，不加载扩展）", 8411, "var(--c-ctx)"]].map(([l, v, c]) => h("div", { class: "cbar" }, h("span", null, l), h("div", { class: "b", style: { width: (v / 8411) * 100 + "%", background: c } }), h("span", { class: "v" }, v.toLocaleString()))),
          h("div", { class: "mute", style: { fontSize: "15px" } }, "两边都是 3 次请求，答案相同。数字是 3 次请求的输入之和（token）。")),
        h("p", { style: { marginTop: "12px" } }, "omp 的「厚」有两层：能力那一层可以关；提示那一层关不掉，每次请求都要付。会话越长，这一层的总量越大，除非提供者的缓存命中（第 2 课）。")),

      section("s-mix", 3, "一起用", "两个一起用：共用什么，分开什么",
        h("ul", { class: "rule" },
          h("li", null, h("b", null, "共用项目说明："), "写在根目录 AGENTS.md，两边都读。前提是同一层没有 .omp/AGENTS.md 和 .claude/CLAUDE.md，否则 omp 只读那一个。"),
          h("li", null, h("b", null, "分开凭证和配置："), "pi 在 ~/.pi/agent，omp 在 ~/.omp/agent，各自登录。不要为其中一个设置 PI_CODING_AGENT_DIR；要给 omp 独立的配置，用 omp --profile。"),
          h("li", null, h("b", null, "按场景分工："), "交互开发用 omp 的默认功能；脚本、定时任务、嵌入程序用 pi 的小底座。Skill 和扩展各放各的目录，omp 不读 .pi/。")),
        h("pre", null, `repo/
  AGENTS.md     # 两边共用的说明
  .pi/          # 只有 pi 读：扩展、Skill、设置（需要信任）
  .omp/         # 只有 omp 读：规则、子代理、config.yml（不需要信任，直接生效）
                # 不要放 .omp/AGENTS.md，否则 omp 不再读根目录的 AGENTS.md`)),

      section("s-scen", 4, "场景", "常见场景怎么选",
        howto("场景 → 选择（理由）", [
          ["8k 窗口的本地小模型，做简单的文件整理", "pi，只开需要的工具。omp 的默认请求就几乎占满窗口。"],
          ["每天在自己的大仓库里改代码，想省输出、改完查类型错误", "omp：hashline + LSP。审批建议设成 write。"],
          ["Python 服务在后台调用 agent 处理上传的文档", "pi 的 RPC 子进程，放进隔离环境，--no-session，少给工具。"],
          ["同事发来一个陌生仓库，让你用 agent 看看", "先看 AGENTS.md、.pi/、.omp/、.claude/；只读工具；用 omp 时加 --no-extensions。"],
          ["30 个文件的机械迁移，希望并行、不撑满主会话", "omp 的子代理，按角色用便宜模型。记得子代理按 yolo 运行。"],
          ["「TypeScript 里不许写 any」：平时零成本，写出来就拦", "omp 的 TTSR 规则（omp 自带这一条）。"],
          ["想看懂 agent 的每一层，长期维护自己的配置", "pi：底座小，每一层都是你自己加的。"],
        ])),

      section("s-choose", 5, "选型器", "你自己的情况",
        look("回答五个问题，看建议和对应的理由。")),
      h("div", { class: "bench" }, chooser()),

      section("s-quiz", 6, "检查", "检查一下", quizBlock(ID, QUIZ, null, null)),

      section("s-end", 7, "小结", "小结",
        endBlock(ID, [
          "pi 是看得见每一层的小底座，omp 是带着很多默认功能的分支。",
          "omp 的能力可以关，但更长的系统提示和缺少的项目信任关不掉。",
          "两个一起用：共用根目录 AGENTS.md，分开凭证和配置，按场景分工。",
        ], { id: "CAP", text: "把学到的用起来：一步步配好你自己日常用的 pi。" }))));
  });
})();
