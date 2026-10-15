/* M14 · 从 pi 到 omp */
(function () {
  "use strict";
  const { h, Store, section, quizBlock, lessonHead, look, howto, endBlock } = window.Course;
  const ID = "M14";

  function sizeBars() {
    const rows = [["pi（不带扩展）", 1286, "var(--c-harness)"], ["pi（带一个联网扩展）", 2762, "var(--c-harness)"], ["omp（默认）", 6379, "var(--c-ctx)"]];
    const max = 6379;
    return h("div", { class: "panel", style: { padding: "14px 16px", display: "grid", gap: "8px" } },
      h("div", { class: "mute", style: { fontSize: "15px" } }, "同一个目录、同一个模型，同一句「只回答 OK」，第一次请求的大小（token）"),
      rows.map(([l, v, c]) => h("div", { class: "cbar" }, h("span", null, l), h("div", { class: "b", style: { width: (v / max) * 100 + "%", background: c } }), h("span", { class: "v" }, v.toLocaleString()))),
      h("div", { class: "mute", style: { fontSize: "15px" } }, "omp 的 6,379 里，系统提示约 2,500，11 个默认工具的定义约 3,900。"));
  }

  const FILES = [["omp", ".omp/AGENTS.md"], ["claude", ".claude/CLAUDE.md"], ["agents", "AGENTS.md"], ["claudemd", "CLAUDE.md"]];
  function ctxSim() {
    const on = { omp: true, claude: true, agents: true, claudemd: true, ...Store.get(ID, "ctxsim", {}) };
    const out = h("div", { class: "ctxout" });
    const boxes = FILES.map(([k, name]) => { const c = h("input", { type: "checkbox", checked: on[k] || null }); c.addEventListener("change", () => { on[k] = c.checked; Store.set(ID, "ctxsim", { ...on }); paint(); }); return h("label", { class: "knob mono" }, c, name); });
    function paint() {
      const piPick = on.agents ? "AGENTS.md" : on.claudemd ? "CLAUDE.md" : null;
      const ompPick = (FILES.find(([k]) => on[k]) || [])[1] || null;
      const card = (who, pick, rule) => h("div", { class: "side2" }, h("h4", null, who), h("div", { class: "sub" }, rule),
        FILES.map(([k, name]) => h("div", { class: "fline" + (!on[k] ? " gone" : name === pick ? " pick" : " skip") }, h("span", { class: "mk" }, !on[k] ? "·" : name === pick ? "✓" : "✗"), name)),
        h("p", { style: { margin: "10px 0 0", fontWeight: 700 } }, pick ? "读进系统提示：" + pick : "一个都不读"));
      out.replaceChildren(h("div", { class: "expo" }, card("pi", piPick, "同一目录：AGENTS.md 优先于 CLAUDE.md；不看 .claude/、.omp/"), card("omp", ompPick, "同一层只取一个：.omp/AGENTS.md > .claude/CLAUDE.md > AGENTS.md > CLAUDE.md")));
    }
    paint();
    return h("div", { class: "panel" }, h("div", { class: "panel-h" }, h("span", null, "目录里有哪些文件？勾选看两边各读哪一个")), h("div", { class: "knobs", style: { padding: "12px 16px", borderBottom: "1px solid var(--line)" } }, boxes), out);
  }

  const QUIZ = [
    { q: "omp 和 pi 是什么关系？", opts: [{ t: "omp 是 pi 的一个分支：同一套骨架，内置了更多功能", ok: true }, { t: "两个毫不相干的项目" }, { t: "omp 是 pi 的一个扩展" }], why: "前 14 课的概念（循环、上下文、会话树、压缩、扩展、自动化）在 omp 里全部适用。" },
    { q: "omp 默认会在运行 bash 之前问你吗？", opts: [{ t: "不会。默认审批模式是 yolo，什么都不问", ok: true }, { t: "会" }], why: "omp 内置了审批，但要自己打开：--approval-mode write 或在 config.yml 里设置。" },
    { q: "同一目录里有 .omp/AGENTS.md、.claude/CLAUDE.md 和 AGENTS.md。omp 读哪个？", opts: [{ t: "只读 .omp/AGENTS.md", ok: true }, { t: "三个都读" }, { t: "只读 AGENTS.md" }], why: "同一层只取一个，按 .omp > .claude > AGENTS.md > CLAUDE.md 的顺序。pi 只认 AGENTS.md / CLAUDE.md，所以同一个仓库两边看到的说明可能完全不同。" },
    { q: "陌生仓库里有 .omp/extensions/x.ts。运行 omp 时会怎样？", opts: [{ t: "启动时就运行，没有任何确认", ok: true }, { t: "先问你是否信任" }, { t: "审批模式会拦住它" }], why: "omp 没有 pi 那样的项目信任。审批只管模型发起的工具调用，管不到扩展代码。用 --no-extensions。" },
    { q: "在 pi 写的扩展工具，放进 omp 后模型怎样调用？", opts: [{ t: "先读 xd://工具名 看说明，再把参数写进去", ok: true }, { t: "和 pi 里完全一样" }, { t: "不能用" }], why: "omp 默认把扩展工具挂成「设备」以节省上下文。在 --tools 里点名，它就变回普通工具。" },
  ];

  window.Course.register(ID, (page) => {
    page.append(h("div", { class: "col" },
      lessonHead(ID, [
        h("p", null, "oh-my-pi（命令名 ", h("b", null, "omp"), "）是 pi 的一个分支，由另一位作者维护。它定期并入 pi 的更新，再加上大量自己的功能：更多内置工具、审批、按任务分配模型、子代理、规则系统……pi 让你自己搭，omp 先给你搭好。"),
        h("p", null, "前 14 课学的概念在 omp 里全部适用。但有几处差异会让你在 pi 里养成的直觉出错，其中两处和安全有关。这一课讲 omp 是什么、东西放在哪里，以及最需要注意的差异。"),
      ], [
        "omp 和 pi 的关系，「默认功能多」的代价。",
        "omp 的配置、凭证放在哪里。",
        "最要紧的差异：读哪个说明文件、审批与信任、扩展怎么迁移。",
      ]),

      section("s-what", 1, "omp 是什么", "同一副骨架，更多的默认功能",
        h("ul", { class: "rule" },
          h("li", null, h("b", null, "相同的骨架："), "agent loop、上下文、会话树、压缩、扩展、print / JSON / RPC / SDK，都和 pi 一样。命令也大多相同：omp -p、omp --mode json……"),
          h("li", null, h("b", null, "更多的默认功能："), "默认就有 11 个工具（pi 是 4 个），包括子代理、运行代码、网页搜索、待办清单；还有代码分析、审批、模型角色、规则系统等（后三课讲）。")),
        h("p", null, "默认功能多不是坏事，省了你自己写扩展的工夫。但第 2 课说过，工具定义每轮都要发送："),
        look("比较三次请求的大小。")),
      sizeBars(),
      h("p", { style: { marginTop: "16px" } }, "omp 的第一次请求是 pi 的 5 倍。这笔钱每一轮都要付。另一个代价是：很多能力你没看过，却默认开着。"),

      section("s-conf", 2, "配置", "东西放在哪里",
        h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" },
          h("thead", null, h("tr", null, h("th", null, ""), h("th", null, "pi"), h("th", null, "omp"))),
          h("tbody", null, [
            ["全局设置", "~/.pi/agent/settings.json", "~/.omp/agent/config.yml（YAML 格式）"],
            ["项目设置", ".pi/settings.json（要信任）", ".omp/config.yml（直接生效）"],
            ["登录凭证", "~/.pi/agent/auth.json", "~/.omp/agent/agent.db（数据库）"],
            ["自定义模型", "~/.pi/agent/models.json", "~/.omp/agent/models.yml"],
            ["会话", "~/.pi/agent/sessions/", "~/.omp/agent/sessions/"],
          ].map(([a, b, c]) => h("tr", null, h("td", { style: { color: "var(--fg-mute)", whiteSpace: "nowrap" } }, a), h("td", null, h("code", null, b)), h("td", null, h("code", null, c))))))),
        howto("常用命令", [
          ["omp login 提供者", "登录。凭证和 pi 分开存，两边要各登录一次。"],
          ["omp config get 设置名", "查看某个设置的当前值。"],
          ["omp config set 设置名 值", "修改，写进全局 config.yml。"],
          ["omp config list", "列出所有设置。"],
        ]),
        h("div", { class: "note warn" }, h("span", { class: "k" }, "两个坑"), h("b", null, "列表整体替换："), "项目设置里写一个列表，会整个替换全局的那个，不会合并（和 pi 不同）。", h("br"), h("b", null, "共用环境变量："), "omp 沿用了 pi 的一些环境变量名，比如 PI_CODING_AGENT_DIR。给 omp 设了它，同一个终端里的 pi 也会去那里找凭证，结果找不到。要让 omp 用独立的配置，用 omp --profile 名字。")),

      section("s-ctx", 3, "说明文件", "omp 读哪个说明文件",
        h("p", null, "omp 想让你从别的工具（比如 Claude Code）过来时不用迁移，所以它也读那些工具的约定位置。但规则和 pi 不同：同一层只读一个，按 .omp/AGENTS.md > .claude/CLAUDE.md > AGENTS.md > CLAUDE.md 的顺序。"),
        look("勾选目录里有哪些文件，看 pi 和 omp 各读哪一个。")),
      ctxSim(),
      h("ul", { class: "rule", style: { marginTop: "14px" } },
        h("li", null, h("b", null, "同一个仓库，两边看到的说明可能完全不同。"), "四个文件都在时，pi 读 AGENTS.md，omp 只读 .omp/AGENTS.md。"),
        h("li", null, h("b", null, "Skill 也一样："), "omp 会读项目里的 .claude/skills/、.omp/skills/，但不读 .pi/skills/。"),
        h("li", null, h("b", null, "用户级的外来目录默认不读："), "你给 Claude Code 写的 ~/.claude/CLAUDE.md，要在 config.yml 里写 enabledProviders: [claude] 才会读。")),

      section("s-appr", 4, "审批与信任", "多了一道审批，少了一道信任",
        h("p", null, "omp 把每个工具分成三级：read（只读）、write（改文件）、exec（运行命令、执行代码、开子代理）。", h("b", null, "审批模式"), "决定哪一级要先问你："),
        howto("tools.approvalMode", [
          ["yolo（默认）", "什么都不问，和 pi 一样。"],
          ["write", "读和改文件自动放行；运行命令要问你。"],
          ["always-ask", "只有读自动放行，其余都要问你。"],
        ], "设置：omp --approval-mode write …，或 omp config set tools.approvalMode write。print 模式没有界面可以问，需要审批的调用会直接失败，不会悄悄放行。"),
        h("p", null, "但 omp ", h("b", null, "没有 pi 的项目信任"), "。实验：在仓库的 .omp/extensions/ 里放一个启动时就写文件的扩展。omp 一启动，连模型都还没调用，文件就被写了。同一个扩展放进 .pi/，pi 在不信任时不会加载。"),
        h("div", { class: "note warn" }, h("span", { class: "k" }, "结论"), "审批管的是模型发起的工具调用；扩展是代码，在审批之前就已经运行了。所以在 omp 里打开陌生仓库，要先看 ls -la .omp .claude，用 omp --no-extensions，或者放进隔离环境（第 13 课）。")),

      section("s-ext", 5, "扩展", "pi 的扩展搬进 omp",
        h("p", null, "omp 保留了 pi 的扩展写法，第 10、11 课写的扩展通常可以直接 omp -e 加载。不同的是工具的呈现方式：为了不让请求越来越大，omp 默认把扩展工具挂成一个", h("b", null, "设备"), "，不在请求里列出完整定义。模型用它要两步："),
        h("pre", null, `① read  { path: "xd://text_stats" }                        ← 先读说明和参数格式
② write { path: "xd://text_stats", content: "{\\"path\\":\\"a.txt\\"}" }   ← 再把参数写进去`),
        h("ul", { class: "rule" },
          h("li", null, h("b", null, "好处："), "工具再多，请求也不会膨胀（和第 12 课的 codemode 同一个思路）。"),
          h("li", null, h("b", null, "代价："), "第一次用要多一次调用；模型有时想不到去用它。"),
          h("li", null, h("b", null, "变回普通工具："), "在 --tools 里点名，例如 omp --tools read,bash,text_stats；或设置 tools.xdev: false 让所有工具都直接声明（请求会变大）。"))),

      section("s-quiz", 6, "检查", "检查一下", quizBlock(ID, QUIZ, null, null)),

      section("s-end", 7, "小结", "小结",
        endBlock(ID, [
          "omp 是 pi 的分支：概念全通用，默认功能多得多，每轮的固定开销也大得多。",
          "配置在 ~/.omp/agent/config.yml（YAML），凭证和 pi 分开；要独立配置用 --profile。",
          "说明文件按 .omp > .claude > AGENTS.md > CLAUDE.md 只读一个，和 pi 看到的可能不同。",
          "omp 有审批（默认关着），没有项目信任：陌生仓库的 .omp/extensions 一启动就运行。",
        ], { id: "M15", text: "omp 多出来的那些工具：为什么它改文件更稳，以及代码分析、执行代码这些能力怎么用。" }))));
  });
})();
