/* M8 · Skill */
(function () {
  "use strict";
  const { h, $, $$, sleep, reduced, Store, choice, copyBlock, section, todo, route, term } = window.Course;
  const ID = "M8";
  const fmt = (n) => Math.round(n).toLocaleString("en-US");

  const SKILL_MD = `---
name: commit-msg
description: 按团队格式写 git 提交信息。用户要求写提交信息、commit message 时使用。
---

# 提交信息格式

1. 第一行：\`类型: 摘要\`。类型只用 feat、fix、docs、refactor、test 之一。
2. 摘要用中文，不超过 30 个字，结尾不加句号。
3. 空一行，然后用 1–3 个要点说明「为什么改」。`;

  // ================= §0 hero: progressive loading, real run =================
  function hero() {
    let stage = 0;
    const stages = [
      ["每次请求都有", "系统提示里只有一行目录", `<skill>
  <name>commit-msg</name>
  <description>按团队格式写 git 提交信息。用户要求写提交信息、commit message 时使用。</description>
  <location>…/.pi/skills/commit-msg/SKILL.md</location>
</skill>`, [["固定成本", 70, "var(--c-harness)"], ["目录", 6, "var(--c-tool)"]]],
      ["任务匹配时", "模型自己调用 read 读全文", `你：帮我为这个改动写一条提交信息：修复了登录时密码为空会崩溃的问题。

模型：read(".pi/skills/commit-msg/SKILL.md")
工具结果：# 提交信息格式 …（全文进入上下文）`, [["固定成本", 70, "var(--c-harness)"], ["目录", 6, "var(--c-tool)"], ["SKILL.md 全文", 12, "var(--c-model)"]]],
      ["按 Skill 做事", "回复遵守了 Skill 里的格式", `fix: 修复登录时密码为空导致的崩溃

- 避免空密码触发崩溃，保障登录流程稳定性`, [["固定成本", 70, "var(--c-harness)"], ["目录", 6, "var(--c-tool)"], ["SKILL.md 全文", 12, "var(--c-model)"], ["回复", 5, "var(--c-user)"]]],
    ];
    const els = stages.map(([tt, sub, code, ctx], i) => h("div", { class: "pl-stage" + (i === 0 ? " on" : "") },
      h("div", { class: "n" }, "第 " + (i + 1) + " 步 · " + tt), h("div", { class: "tt" }, sub), h("pre", null, code),
      h("div", { class: "mute", style: { fontSize: "15px", marginTop: "8px" } }, "上下文示意（深蓝：固定成本；紫：Skill 目录；橙：SKILL.md 全文；天蓝：回复）"), h("div", { class: "pl-ctx" }, ctx.map(([t, w, c]) => h("span", { style: { flexBasis: w + "%", background: c }, title: t }, w >= 10 ? t : "")))));
    const btn = h("button", { class: "btn primary", onclick: () => { stage = (stage + 1) % 3; els.forEach((e, i) => e.classList.toggle("on", i <= stage)); btn.textContent = stage === 2 ? "重来" : "下一步"; } }, "下一步");
    return h("div", { class: "panel" },
      h("div", { class: "panel-h" }, h("span", null, "渐进加载 · 本机真实运行（gpt-6-astra）"), btn),
      h("div", { class: "pl-stages" }, els),
      h("p", { class: "mute", style: { fontSize: "15px", padding: "0 16px 14px", margin: 0 } }, "对照：同一个会话里问「用一句话解释 git rebase」，模型没有去读这个 Skill。"));
  }

  // ================= §2 anatomy =================
  const FIELDS = [
    ["name", "必填（缺省时用目录名）。小写字母、数字、连字符，最长 64。也是 /skill:名字 的命令名。实测：写成 Bad_Name 只警告，仍加载。"],
    ["description", "必填。最长 1024。模型只看它决定要不要读全文。实测：缺少 description 的 Skill 不加载。"],
    ["disable-model-invocation", "true：不出现在模型的目录里，只能用 /skill:名字 手动调用。"],
    ["license / compatibility / metadata", "Agent Skills 规范的可选字段：许可证、环境要求、其他元数据。"],
    ["allowed-tools", "实验性：预先批准的工具清单。"],
  ];

  // ================= §3 routing experiment =================
  const ROUTE = [
    ["三个 Skill，描述都写「帮助处理文字。」", "第 1 次：读了 commit-msg，又读了 style-guide 和 translate", "第 2 次：只读了 commit-msg"],
    ["三个 Skill，描述各自写清做什么、何时用", "第 1 次：只读了 commit-msg", "第 2 次：只读了 commit-msg"],
  ];
  function linter() {
    const ta = h("textarea", { id: "m8-desc", spellcheck: "false" });
    ta.value = "帮助处理 PDF。";
    const res = h("div", { class: "res" });
    function run() {
      const d = ta.value.trim();
      const checks = [
        [d.length > 0 && d.length <= 1024, `长度 ${d.length} / 1024`],
        [/(提取|生成|转换|写|检查|审查|翻译|部署|迁移|分析|创建|修复|格式|导出|读取|比较|总结|extract|generate|convert|write|review|translate|deploy|create|fix|format)/i.test(d), "说了具体做什么（动词 + 对象）"],
        [/(时使用|时用|当|如果|需要|要求|use when|when )/i.test(d), "说了什么时候用"],
        [!/^(帮助|协助|处理|一些|各种|helps?|assist)/i.test(d) || d.length > 25, "不是一句空泛的「帮助……」"],
      ];
      res.replaceChildren(h("b", null, "启发式检查（不是 pi 的规则）"), h("ul", { class: "check-list", style: { margin: 0 } }, checks.map(([ok, t]) => h("li", null, h("span", { class: ok ? "ok" : "no" }, ok ? "✓" : "✗"), t))),
        h("div", { class: "mute", style: { fontSize: "15px" } }, "参考写法：从 PDF 中提取文字和表格。用户要读取、转换或检查 PDF 时使用。"));
      if (checks.every((c) => c[0])) Store.set(ID, "lint", { ok: 1 });
    }
    ta.addEventListener("input", run); run();
    return h("div", { class: "panel lint" }, ta, res);
  }
  const DESC = [
    { q: "哪个描述更容易被正确加载？", opts: [{ t: "生成数据库迁移脚本并检查回滚步骤。用户要求修改表结构或写迁移时使用。", ok: true }, { t: "数据库相关的工具。" }], why: "做什么 + 何时用。模型只靠这一句决定是否去读全文。" },
    { q: "你有 30 个 Skill。每个描述约 80 字。这些描述在每次请求里大约占：", opts: [{ t: "约 2,000–3,000 token，每轮都付", ok: true }, { t: "0，模型用到时才加载" }, { t: "约 30 token" }], why: "目录每轮都在。按 M1 的系数，2,400 字中文约 1,600 token，加上每条的标签和路径会更多。所以 Skill 也不是越多越好。" },
  ];

  // ================= §4 cost comparison =================
  function costCompare() {
    const n = h("input", { type: "range", id: "m8-n", min: 1, max: 30, value: 5 }), lines = h("input", { type: "range", id: "m8-l", min: 10, max: 400, step: 10, value: 120 }), turns = h("input", { type: "range", id: "m8-t", min: 1, max: 100, value: 40 }), used = h("input", { type: "range", id: "m8-u", min: 0, max: 10, value: 2 });
    const nv = h("b"), lv = h("b"), tv = h("b"), uv = h("b"), out = h("div", { class: "out" });
    const PER_LINE = 15, DESC_TOK = 110; // ~ tokens per line of Chinese instructions; per-skill catalog entry (measured: 1 skill ≈ 174 incl. header)
    function run() {
      const N = +n.value, Ln = +lines.value, T = +turns.value, U = Math.min(+used.value, N);
      nv.textContent = N; lv.textContent = Ln; tv.textContent = T; uv.textContent = U;
      const body = Ln * PER_LINE;
      const agents = N * body * T;
      const skills = (60 + N * DESC_TOK) * T + U * body * Math.max(1, Math.round(T / 2));
      const max = Math.max(agents, skills);
      const bar = (lbl, v, c) => h("div", { class: "cbar" }, h("span", null, lbl), h("div", { class: "b", style: { width: (v / max) * 100 + "%", background: c } }), h("span", { class: "v" }, fmt(v)));
      out.replaceChildren(h("div", { class: "mute", style: { fontSize: "15px" } }, `整个会话累计发送的 token（${T} 轮）`),
        bar("全部写进 AGENTS.md", agents, "var(--c-ctx)"), bar("做成 Skill", skills, "var(--c-tool)"),
        h("div", { class: "dim", style: { fontSize: "15px" } }, `做成 Skill 约为写进 AGENTS.md 的 ${Math.round((skills / agents) * 100)}%。假设：每行说明约 ${PER_LINE} token；每个 Skill 的目录项约 ${DESC_TOK} token；被用到的 Skill 平均在会话中段被读入，之后每轮重发。`));
      Store.set(ID, "cost", { used: 1 });
    }
    [n, lines, turns, used].forEach((x) => x.addEventListener("input", run)); run();
    return h("div", { class: "panel costcmp" },
      h("div", { class: "ctl" },
        h("label", { for: "m8-n" }, h("span", null, "Skill 数量 ", nv), n),
        h("label", { for: "m8-l" }, h("span", null, "每个 Skill 正文行数 ", lv), lines),
        h("label", { for: "m8-t" }, h("span", null, "会话轮数 ", tv), turns),
        h("label", { for: "m8-u" }, h("span", null, "这次会话真正用到几个 ", uv), used)),
      out);
  }

  // ================= §8 lab =================
  const LAB_SETUP = `mkdir -p ~/pi-lab/m8/.pi/skills/commit-msg && cd ~/pi-lab/m8
cat > .pi/skills/commit-msg/SKILL.md <<'EOF'
${SKILL_MD}
EOF`;
  const LAB_RUN = `ask(){ pi --mode json --no-session --approve "$2" < /dev/null | jq -r --arg t "$1" 'select(.type=="turn_end") | .message | "\\($t) 工具=\\([.content[] | select(.type=="toolCall") | (.arguments.path // .arguments.command // "" | split("/") | .[-2:] | join("/"))] | join(",")) 回复=\\([.content[] | .text? // empty] | join("") | gsub("\\n"; " ⏎ ") | .[0:60])"'; }
ask 提交 "帮我为这个改动写一条提交信息：修复了登录时密码为空会崩溃的问题。"
ask rebase "用一句话解释什么是 git rebase。"
ask 手动 "/skill:commit-msg 新增：导出 CSV 报表"`;
  const LAB_CLEAN = "cd ~ && rm -r ~/pi-lab/m8 && rmdir --ignore-fail-on-non-empty ~/pi-lab";
  const LAB_SAMPLE = `提交 工具=commit-msg/SKILL.md 回复=
提交 工具= 回复=fix: 修复登录时密码为空导致的崩溃 ⏎  ⏎ - 避免空密码触发崩溃，保障登录流程稳定性
rebase 工具= 回复=\`git rebase\` 是将一个分支上的提交依次重新应用到另一个基点上，从而改写提交历史、使其更线性的操作。
手动 工具= 回复=feat: 新增 CSV 报表导出 ⏎  ⏎ - 方便用户离线查看和分析报表数据 ⏎ - 便于与其他数据处理工具协作`;
  function lab() {
    const saved = Store.get(ID, "lab", {});
    const ta = h("textarea", { class: "paste", id: "m8-lab-paste", spellcheck: "false", placeholder: "提交 工具=… 回复=…\n…" });
    ta.value = saved.raw || "";
    ta.addEventListener("input", () => { delete ta.dataset.sample; });
    const out = h("div");
    const verify = (sample) => {
      if (sample) { ta.value = LAB_SAMPLE; ta.dataset.sample = "1"; }
      const isSample = ta.dataset.sample === "1";
      const L = ta.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      const of = (t) => L.filter((l) => l.startsWith(t + " "));
      const tools = (l) => ((l.match(/工具=(\S*)/) || [])[1] || "");
      const reply = (ls) => { const r = ls.map((l) => (l.match(/回复=(.*)$/) || [])[1] || "").filter(Boolean); return r[r.length - 1] || ""; };
      const fmtOk = (r) => /^(feat|fix|docs|refactor|test): /.test(r);
      const checks = [
        [of("提交").some((l) => tools(l).includes("commit-msg/SKILL.md")), "写提交信息时，模型自己读了 SKILL.md"],
        [fmtOk(reply(of("提交"))), "回复遵守了格式「类型: 摘要」"],
        [of("rebase").length > 0 && of("rebase").every((l) => !tools(l).includes("SKILL.md")), "问 rebase 时，模型没有读 Skill"],
        [of("手动").length > 0 && fmtOk(reply(of("手动"))), "手动 /skill: 调用后，回复遵守了格式（正文已在消息里；模型有时仍会再读一遍，这不算错）"],
      ];
      const ok = checks.every((c) => c[0]);
      if (ok && !isSample) { Store.set(ID, "lab", { raw: ta.value, passed: true }); checkDone(); }
      out.replaceChildren(h("ul", { class: "check-list" }, checks.map(([o, t]) => h("li", null, h("span", { class: o ? "ok" : "no" }, o ? "✓" : "✗"), t))),
        ok ? h("div", { class: "note" }, h("span", { class: "k" }, isSample ? "示例数据" : "实验通过"), isSample ? "示例数据全部满足条件，但不计入实验。请用你自己的运行再做一次。" : "你亲眼看到了渐进加载：匹配时才读，不匹配不读，手动调用由 pi 直接注入正文。最后一步：清理。")
          : h("div", { class: "note warn" }, h("span", { class: "k" }, "没有全部通过"), "模型的选择有随机性。若第一条没有读 Skill，再跑一次第 2 步。若始终不读，检查是否加了 --approve（项目 Skill 需要信任）。"));
    };
    if (saved.raw) setTimeout(() => verify(false), 0);
    return h("div", { class: "lab-steps" },
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "建一个项目 Skill。"), copyBlock(LAB_SETUP))),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "问三个问题：一个匹配、一个不匹配、一个手动调用。"),
        h("p", { class: "dim", style: { margin: "4px 0 0" } }, "每一轮输出一行：本轮调用的工具（读了哪个文件）和回复开头。共 3 次很小的模型调用。"), copyBlock(LAB_RUN))),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "粘贴输出，核对。"), h("div", { style: { marginTop: "8px" } }, ta),
        h("div", { style: { display: "flex", gap: "8px", marginTop: "8px" } }, h("button", { class: "btn primary", onclick: () => verify(false) }, "核对我的运行"), h("button", { class: "btn ghost", onclick: () => verify(true) }, "先用示例数据试试")), out)),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "清理。"), copyBlock(LAB_CLEAN))));
  }

  // ================= quiz / review / recap =================
  const QUIZ = [
    { q: "一个 Skill 在模型决定使用它之前，请求里有什么？", opts: [{ t: "名字、描述、路径", ok: true }, { t: "SKILL.md 全文" }, { t: "什么都没有" }], why: "本机实测：系统提示 skills 段只列这三项。" },
    { q: "模型怎样加载一个 Skill 的全文？", opts: [{ t: "自己调用 read（或 bash）读 SKILL.md", ok: true }, { t: "pi 自动在下一轮注入" }, { t: "提供者从服务器下载" }], why: "实测：第一轮回复是 read(.pi/skills/commit-msg/SKILL.md)。" },
    { q: "只开了 grep 和 ls 工具时，Skill 会出现在系统提示里吗？", opts: [{ t: "不会，pi 只在有 read 或 bash 时列出", ok: true }, { t: "会" }], why: "pi 源码：skillFileReadTool = [\"read\", \"bash\"] 中第一个已启用的。模型得有办法读它。" },
    { q: "/skill:commit-msg 新增导出 的效果：", opts: [{ t: "SKILL.md 正文作为你的消息发出，参数附在后面", ok: true }, { t: "让模型去读 SKILL.md" }, { t: "把 Skill 加进系统提示" }], why: "实测：用户消息是 <skill name=\"commit-msg\" …>正文</skill>，然后是参数。按理不必再 read（模型有时仍会读）。" },
    { q: "disable-model-invocation: true 的 Skill：", opts: [{ t: "不在模型的目录里，只能手动 /skill: 调用", ok: true }, { t: "完全不加载" }, { t: "每轮都注入全文" }], why: "适合有副作用、必须由你决定何时执行的流程。" },
    { q: "Skill 的 name 写成 Bad_Name：", opts: [{ t: "pi 警告，但仍然加载", ok: true }, { t: "不加载" }, { t: "自动改成 bad-name" }], why: "实测：启动头 [Skill conflicts] 下给出警告，[Skills] 里仍有它。" },
    { q: "一个 Skill 缺少 description：", opts: [{ t: "不加载", ok: true }, { t: "加载，用正文第一行当描述" }], why: "实测：「description is required」，它不出现在 [Skills] 里。" },
    { q: "描述含糊时，本机实测的后果是：", opts: [{ t: "模型有时多读了无关的 Skill，浪费上下文", ok: true }, { t: "模型一定不读" }, { t: "pi 拒绝加载" }], why: "三个 Skill 都写「帮助处理文字」时，两次里有一次多读了两个无关的。" },
    { q: "SKILL.md 里写「运行 scripts/check.sh」。这个相对路径相对于：", opts: [{ t: "Skill 所在目录", ok: true }, { t: "你的工作目录" }, { t: "~/.pi/agent" }], why: "pi 告诉模型 Skill 的位置，并说明相对路径按 Skill 目录解析。" },
    { q: "Skill 能让没有联网工具的 pi 上网吗？", opts: [{ t: "不能。Skill 是说明书，不是工具", ok: true }, { t: "能，只要写清步骤" }], why: "能力 = 工具（M0）。但 Skill 可以教模型用已有的 bash 运行 curl。" },
  ];
  const REVIEW = [
    { q: "（复习 M7）一份 200 行、偶尔才用的手册，最不该放在：", opts: [{ t: "AGENTS.md", ok: true }, { t: "Skill" }], why: "AGENTS.md 每轮发送。本课的 Skill 正是它的答案。" },
    { q: "（复习 M7）提示模板展开后，模型能看到 /命令 吗？", opts: [{ t: "不能", ok: true }, { t: "能" }], why: "本课的 /skill: 也是类似的展开。" },
  ];
  const PRE = [
    { id: "p1", q: "装了一个 Skill，你问一个和它无关的问题。模型会读它的全文吗？", opts: [{ t: "会" }, { t: "通常不会", ok: true }] },
    { id: "p2", q: "Skill 的描述写得含糊，最可能的后果是：", opts: [{ t: "多读或误读，浪费上下文", ok: true }, { t: "pi 报错" }, { t: "没有任何影响" }] },
    { id: "p3", q: "用 /skill:名字 手动调用时，SKILL.md 的正文怎样进入上下文？", opts: [{ t: "模型调用 read 读入" }, { t: "pi 直接把它放进你的消息", ok: true }] },
  ];
  function checkDone() {
    const ok = Store.get(ID, "lab", {}).passed && Store.get(ID, "quiz", { best: 0 }).best >= 8;
    if (ok && !Store.get(ID, "done")) Store.set(ID, "done", true);
  }

  window.Course.register(ID, (page) => {
    const rc = window.Course.recapBlock(ID, {
      pre: PRE,
      next: { id: "M9", title: "扩展 I：工具与命令", text: "指令、模板、Skill 都只是文字。M9 跨过这条线：用 TypeScript 写扩展，给模型一个真正的新工具。" },
      extra: () => [["描述判断", DESC.filter((d, i) => d.opts[Store.get(ID, "desc", {})["d" + i]]?.ok).length + " / " + DESC.length]],
    });
    page.append(h("div", { class: "bench" },
      h("header", { class: "mhead" }, h("div", { class: "crumbs" }, "第 4 单元 · 扩展 / M8"), h("h1", { class: "mtitle" }, h("span", { class: "mid" }, "M8"), "Skill")),
      section("s-hero", 0, "开场", null, hero(),
        h("div", { class: "col" },
          h("p", { class: "thesis" }, "平时只放一行目录。", h("br"), "需要时，模型自己去读全文。"),
          h("p", { class: "lead" }, "AGENTS.md 每轮都发送，装不下长手册。Skill 解决这个问题：请求里只有它的名字和一句描述，任务匹配时模型才用工具读入全文。点「下一步」，看本机一次真实运行的三个阶段。")),
        h("div", { class: "panel objectives" },
          h("ol", null,
            h("li", null, "说出 Skill 的结构和三步渐进加载。"),
            h("li", null, "写出能被正确路由的描述：做什么 + 何时用。"),
            h("li", null, "比较 Skill 和 AGENTS.md 的上下文成本。"),
            h("li", null, "用 /skill: 手动调用，用 disable-model-invocation 限制自动调用。"),
            h("li", null, "读懂启动时的 Skill 诊断信息。")),
          h("div", { class: "obj-side" },
            h("div", null, h("span", { class: "k" }, "时长"), "约 55 分钟"),
            h("div", null, h("span", { class: "k" }, "前置"), "M7"),
            h("div", null, h("span", { class: "k" }, "练习"), "§8 实验 + §9 测验（≥ 8/10）"),
            h("div", null, h("span", { class: "k" }, "核对版本"), "pi 0.99.2 · Agent Skills 规范"))),
        h("h3", null, "本课路线"),
        route(ID, [["s-pre", 1, "动手", "复习与预测"], ["s-anat", 2, "阅读", "结构"], ["s-route", 3, "动手", "路由"], ["s-cost", 4, "动手", "成本"], ["s-manual", 5, "阅读", "手动调用"], ["s-where", 6, "阅读", "位置与诊断"], ["s-choose", 7, "阅读", "选哪一级"], ["s-lab", 8, "实验", "写一个 Skill"], ["s-quiz", 9, "测验", "10 题"], ["s-recap", 10, "阅读", "小结"]])),
      h("div", { class: "col" },
        section("s-pre", 1, "复习与预测", "先复习，再预测",
          todo("两道复习题立即判分；三道预测课末揭晓。"),
          REVIEW.map((r, i) => choice({ id: "r" + i, store: [ID, "rev"], kicker: "复习 " + (i + 1) + " / 2", q: r.q, opts: r.opts, explain: r.why, shuffleSeed: 151 + i * 7 })),
          PRE.map((p, i) => choice({ id: p.id, store: [ID, "pre"], kicker: "预测 " + (i + 1) + " / 3", q: p.q, opts: p.opts, reveal: false, shuffleSeed: 77 + i * 13 }))),
        section("s-anat", 2, "结构", "一个目录，一份 SKILL.md",
          todo("读结构和字段表。实验里你会写一个。", true),
          h("pre", { class: "panel", style: { padding: "14px 16px", fontSize: "15px" } }, `commit-msg/              ← 目录名，建议与 name 相同
├── SKILL.md             ← 必需：frontmatter + 说明
├── scripts/check.sh     ← 可选：脚本
└── references/types.md  ← 可选：参考资料，按需再读`),
          h("pre", { class: "panel", style: { padding: "14px 16px", fontSize: "15px", whiteSpace: "pre-wrap" } }, SKILL_MD),
          h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" }, h("tbody", null, FIELDS.map(([k, d]) => h("tr", null, h("td", { style: { whiteSpace: "nowrap" } }, h("code", null, k)), h("td", null, d)))))),
          h("p", { class: "mute", style: { fontSize: "15px", marginTop: "8px" } }, "第三层加载：SKILL.md 里可以写「先读 references/types.md」。模型读完 SKILL.md 后再按需读附件。pi 告诉模型 Skill 的位置，相对路径按 Skill 目录解析。")),
        section("s-route", 3, "路由", "描述决定一切",
          todo("看对照实验结果。可以在检查器里改写一个描述试试（右侧有参考写法）。最后读两条要点，做两道判断题。"),
          h("p", null, "模型只看到描述，就要决定读不读全文。本机做了一组对照（同一个提交信息请求，各跑两次）："),
          h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" },
            h("thead", null, h("tr", null, h("th", null, "条件"), h("th", null, "结果"), h("th", null, ""))),
            h("tbody", null, ROUTE.map(([a, b, c]) => h("tr", null, h("td", null, a), h("td", null, b), h("td", null, c)))))),
          h("p", { class: "dim", style: { fontSize: "16px", marginTop: "8px" } }, "另一个观察：只有一个 Skill 时，即使描述含糊，模型也去读了。描述的作用在 Skill 多起来时才显现——它是唯一的区分依据。"))),
      h("div", { class: "bench" }, linter()),
      h("div", { class: "col" },
        h("p", null, h("b", null, "两条要点："), "① 好描述 = 做什么 + 什么时候用。② 目录（每个 Skill 的名字、描述和路径）每次请求都发送：中文约 0.65 token/字（第 2 课），Skill 越多，这笔固定成本越大。"),
        DESC.map((d, i) => choice({ id: "d" + i, store: [ID, "desc"], kicker: "判断 " + (i + 1) + " / 2", q: d.q, opts: d.opts, explain: d.why, shuffleSeed: 161 + i * 3 })),
        section("s-cost", 4, "成本", "Skill 与 AGENTS.md 算一笔账",
          todo("拖动四个滑块，看两种做法的累计成本。", true),
          h("p", null, "Skill 的目录每轮都在；全文只在用到后才进入上下文（之后随历史重发）。AGENTS.md 每轮发送全部内容。"))),
      h("div", { class: "bench" }, costCompare()),
      h("div", { class: "col" },
        section("s-manual", 5, "手动调用", "/skill:名字",
          todo("读实测的展开结果。", true),
          h("p", null, "在编辑器输入 /skill:release-notes 1.2.0，模型收到的消息（本机用假模型抓取）："),
          h("pre", { class: "panel", style: { padding: "14px 16px", fontSize: "15px", whiteSpace: "pre-wrap" } }, `<skill name="release-notes" location="…/.pi/skills/release-notes/SKILL.md">
References are relative to …/.pi/skills/release-notes.

按版本号列出新增、修复、破坏性变更三节。
</skill>

1.2.0`),
          h("ul", { class: "rule" },
            h("li", null, "正文直接进入消息，模型不必再 read。本机两次实测：一次没读，一次仍多读了一遍。模型的行为有随机性，多读只是浪费一点上下文。"),
            h("li", null, "这个 Skill 标了 disable-model-invocation: true：它不在模型的目录里，只能这样手动调用。"),
            h("li", null, "设置 enableSkillCommands = false 会把 /skill: 命令从菜单里隐藏，但手动输入仍然有效。"))),
        section("s-where", 6, "位置与诊断", "放在哪里，出错怎么看",
          todo("记住四个位置，读懂一段真实的诊断输出。", true),
          h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" }, h("tbody", null,
            [["~/.pi/agent/skills/", "全局，所有项目可用"], [".pi/skills/", "项目，需要信任"], ["~/.agents/skills/", "Agent Skills 规范的全局位置"], [".agents/skills/", "项目，从工作目录向上找到仓库根"]].map(([a, b]) => h("tr", null, h("td", null, h("code", null, a)), h("td", null, b)))))),
          h("p", null, "目录下凡是含 SKILL.md 的子目录都会被发现（递归）。同名 Skill：先发现的生效，另一个给出警告。启动时按 Ctrl+O 可展开完整的资源清单。本机故意放了两个有问题的 Skill："),
          h("pre", { class: "panel", style: { padding: "14px 16px", fontSize: "15px", whiteSpace: "pre-wrap" } }, `[Skills]
  Bad_Name, commit-msg, release-notes, style-guide, translate
[Skill conflicts]
  …/.pi/skills/bad/SKILL.md
    name contains invalid characters (must be lowercase a-z, 0-9, hyphens only)
  …/.pi/skills/nodesc/SKILL.md
    description is required`),
          h("p", { class: "dim", style: { fontSize: "16px" } }, "Bad_Name 仍在 [Skills] 里；nodesc 不在。改完 Skill 后用 /reload。")),
        section("s-choose", 7, "选哪一级", "能力阶梯的前三级",
          todo("记住这张表。下一课进入第四级。", true),
          h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" },
            h("thead", null, h("tr", null, h("th", null, "需求"), h("th", null, "用"))),
            h("tbody", null,
              h("tr", null, h("td", null, "每轮都要知道的简短约定"), h("td", null, "AGENTS.md")),
              h("tr", null, h("td", null, "你手动触发的固定提示，只差参数"), h("td", null, "提示模板")),
              h("tr", null, h("td", null, "较长的专门知识，模型按需取用，可带脚本和参考资料"), h("td", null, "Skill")),
              h("tr", null, h("td", null, "新的动作、拦截、自动化，需要代码"), h("td", null, "扩展（M9）"))))),
          h("div", { class: "note" }, h("span", { class: "k" }, "跨工具通用"), "pi 实现的是 Agent Skills 开放规范。同一个 Skill 目录也能给其他支持该规范的工具用；放在 ~/.agents/skills/ 最通用。")),
        section("s-lab", 8, "实验", "写一个 Skill，看它被按需加载",
          todo("按第 1–4 步操作。全部在终端里完成。"),
          h("p", null, "你会写开场那个提交信息 Skill，然后问三个问题，从事件流里确认：匹配时才读、不匹配不读、手动调用直接注入。"),
          h("div", { class: "note" }, h("span", { class: "k" }, "实验规则"), "只在 ~/pi-lab/m8 里做；--no-session 不留会话；--approve 不写 trust.json；最后清理。"),
          lab()),
        section("s-quiz", 9, "掌握测验", "10 题，8 题过关", todo("10 题全部作答，点「交卷」。"), window.Course.quizBlock(ID, QUIZ, checkDone)),
        section("s-recap", 10, "小结", "你学到了什么",
          todo("看自己的预测和成绩。觉得学会了，就在本节最后点「标记为已完成」。", true),
          h("p", { class: "lead" }, "一句话：Skill 平时只占名字和描述，任务匹配时模型用 read 读入全文；描述写清「做什么 + 何时用」；/skill: 手动注入；它仍然只是文字。"),
          rc))));
    return () => rc._cleanup && rc._cleanup();
  });
})();
