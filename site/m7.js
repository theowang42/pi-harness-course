/* M7 · 指令层 */
(function () {
  "use strict";
  const { h, $, $$, Store, choice, copyBlock, section, todo, route, term } = window.Course;
  const ID = "M7";

  // ===== measured with a local fake model (pi 0.99.2): system-prompt sections and their sizes in characters =====
  const SECS = [
    ["preamble", "基础说明", 169, "pi"],
    ["tools", "工具清单（文字版）", 339, "pi"],
    ["rules", "工具使用规则", 839, "pi"],
    ["docs", "pi 文档索引", 1334, "pi"],
    ["addendum", "追加段", 48, "you"],
    ["project_context", "上下文文件", 250, "you"],
    ["cwd", "工作目录", 100, "pi"],
  ];

  // ================= §0 hero: system prompt composer =================
  function composer() {
    const st = { agents: true, append: true, system: false, cli: false, nc: false };
    const boxes = [
      ["agents", "项目里有 AGENTS.md"], ["append", "有 .pi/APPEND_SYSTEM.md"], ["system", "有 .pi/SYSTEM.md"], ["cli", "命令行 --append-system-prompt"], ["nc", "命令行 -nc（不读上下文文件）"],
    ].map(([k, t]) => { const i = h("input", { type: "checkbox", id: "m7-c-" + k, checked: st[k] }); i.addEventListener("change", () => { st[k] = i.checked; paint(); Store.set(ID, "comp", { used: 1 }); }); return h("label", { for: "m7-c-" + k }, i, t); });
    const stack = h("div", { class: "sp-stack" });
    function paint() {
      const rows = SECS.map(([k, nm, len]) => {
        let src = "", cls = "sp-sec", show = true, text = nm;
        if (["preamble", "tools", "rules", "docs"].includes(k)) {
          if (st.system) { if (k === "preamble") { text = "SYSTEM.md 的全文"; src = "你写的，替换了 pi 的前四段（实测用的是一句 16 字的话）"; cls += " repl"; } else { cls += " gone"; src = "被 SYSTEM.md 替换掉"; } }
          else src = "pi 生成";
        } else if (k === "addendum") {
          if (st.cli) { src = "--append-system-prompt 的文字（实测：取代了 APPEND_SYSTEM.md）"; cls += " you"; }
          else if (st.append) { src = "APPEND_SYSTEM.md 的全文"; cls += " you"; }
          else show = false;
        } else if (k === "project_context") {
          if (st.agents && !st.nc) { src = "AGENTS.md 等，按 M5 的规则逐级拼接"; cls += " you"; } else show = false;
        } else src = "pi 生成";
        return show ? h("div", { class: cls }, h("span", { class: "nm" }, k), h("span", { class: "src" }, text + " · " + src), h("span", { class: "ln" }, cls.includes("gone") ? "" : cls.includes("repl") ? "16 字" : len + " 字")) : null;
      }).filter(Boolean);
      stack.replaceChildren(h("div", { class: "mute", style: { fontSize: "15px", marginBottom: "4px" } }, "系统提示（第一条消息）从上到下："), ...rows,
        h("div", { class: "sp-api" }, "另外，请求里还有一个独立的 tools 数组（工具定义）。它不在系统提示里，任何设置下都照样发送。"));
    }
    paint();
    return h("div", { class: "panel" },
      h("div", { class: "panel-h" }, h("span", null, "系统提示由哪几段组成 · 本机实测（用 M6 的假模型抓取）"), h("span", null, "勾选左边的条件")),
      h("div", { class: "sp-wrap" }, h("div", { class: "sp-ctrl" }, boxes), stack));
  }

  // ================= §2 which carrier =================
  const WHICH = [
    { q: "「运行测试用 pnpm test，不要用 npm」——每次在这个仓库干活都需要知道。", opts: [{ t: "项目根目录的 AGENTS.md", ok: true }, { t: "提示模板" }, { t: "SYSTEM.md" }], why: "每轮都需要、只属于这个项目：AGENTS.md。" },
    { q: "每周五你都要让 pi 写一份同样格式的周报，只是周次不同。", opts: [{ t: "提示模板 /weekly，周次作为参数", ok: true }, { t: "AGENTS.md" }, { t: "APPEND_SYSTEM.md" }], why: "按需使用、内容固定、只差参数：提示模板。平时不占上下文。" },
    { q: "你希望在所有项目里，pi 回答都用简体中文。", opts: [{ t: "~/.pi/agent/AGENTS.md", ok: true }, { t: "每个项目各写一份 AGENTS.md" }, { t: "~/.pi/agent/SYSTEM.md" }], why: "全局的个人偏好，放全局 AGENTS.md（或 APPEND_SYSTEM.md）。SYSTEM.md 会把 pi 的规则一起换掉。" },
    { q: "你要把 pi 改造成只做翻译的专用工具，不需要它的编码规则。", opts: [{ t: "项目的 .pi/SYSTEM.md", ok: true }, { t: "AGENTS.md" }, { t: "提示模板" }], why: "要换掉 pi 的身份和规则时，才用 SYSTEM.md。" },
    { q: "一份 200 行的数据库迁移操作手册，偶尔才用。", opts: [{ t: "做成 Skill（M8）", ok: true }, { t: "放进 AGENTS.md" }, { t: "放进 APPEND_SYSTEM.md" }], why: "放进 AGENTS.md 会每轮付费（M1）。Skill 平时只占名字和一句描述，用时才读全文。" },
  ];

  // ================= §3 AGENTS.md clinic =================
  const CLINIC = [
    ["- 运行测试：python3 -m pytest -q", "keep", "每轮都可能用到，而且模型猜不到。保留。"],
    ["- 你是一个世界顶级的、非常聪明的资深工程师。", "del", "空话。不改变行为，却每轮花 token。删掉。"],
    ["- 发布流程：（以下 120 行详细步骤……）", "skill", "长、偶尔用：做成 Skill，用时再读。"],
    ["- 代码注释用英文，提交信息用中文。", "keep", "简短、每轮相关的约定。保留。"],
    ["- 每次都要先读完 src/ 下的全部文件再开始。", "del", "会把上下文吃光（M1）。删掉；让模型按需读。"],
    ["- 写周报：用这个格式……本周完成……下周计划……", "tpl", "固定的一次性任务：做成提示模板 /weekly。"],
    ["- 不要修改 vendor/ 目录。", "keep", "简短的边界说明。保留。但它只是文字，真要禁止得靠扩展或沙箱（M10、M12）。"],
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
      if (checked) fb.replaceChildren(h("span", { class: "verdict " + (n === CLINIC.length ? "ok" : "no") }, `${n} / ${CLINIC.length}`), n === CLINIC.length ? "全对。规则：每轮都需要、简短、模型猜不到——才进 AGENTS.md。" : "看每行下面的解释。");
    }
    paint();
    return h("div", { class: "panel clinic" }, h("div", { class: "panel-h" }, h("span", null, "一份写得不好的 AGENTS.md：每一行该怎么处理？"), h("button", { class: "btn primary", onclick: () => { if (Object.keys(pick).length < CLINIC.length) return; checked = true; Store.set(ID, "clinic", { pick: { ...pick }, checked: true, ok: CLINIC.every((c, i) => pick[i] === c[1]) }); paint(); } }, "核对"),
      h("button", { class: "btn ghost", style: { marginLeft: "6px" }, onclick: () => { CLINIC.forEach((c, i) => { pick[i] = c[1]; }); checked = true; Store.set(ID, "clinic", { pick: { ...pick }, checked: true, ok: true }); paint(); } }, "显示答案")), list, fb);
  }

  // ================= §5 template playground =================
  /** Shell-like split: spaces separate, quotes group. */
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
  /** pi 0.99.2 substitutions: $1.., $@, $ARGUMENTS, ${1:-d}, ${@:-d}, ${@:N}, ${@:N:L}. */
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
  const REAL = [["", "请审查当前改动。重点：正确性。全部参数：。第二个起：。第二到第三：。"], ["并发", "请审查当前改动。重点：并发。全部参数：并发。第二个起：。第二到第三：。"], ['"API 兼容" 安全 性能 测试', "请审查当前改动。重点：API 兼容。全部参数：API 兼容 安全 性能 测试。第二个起：安全 性能 测试。第二到第三：安全 性能。"]];
  function playground() {
    const body = h("textarea", { id: "m7-tpl", spellcheck: "false" });
    body.value = "请审查当前改动。重点：${1:-正确性}。全部参数：$@。第二个起：${@:2}。第二到第三：${@:2:2}。";
    const name = h("input", { id: "m7-name", value: "review" }), args = h("input", { id: "m7-args", value: '"API 兼容" 安全 性能 测试' });
    const typed = h("div", { class: "mono", style: { fontSize: "15px" } }), argv = h("div", { class: "args" }), out = h("div", { class: "outmsg" }), real = h("div", { class: "mute", style: { fontSize: "15px" } });
    function run() {
      const a = splitArgs(args.value);
      typed.textContent = "你在编辑器输入：/" + (name.value || "?") + (args.value ? " " + args.value : "");
      argv.replaceChildren(...(a.length ? a.map((x, i) => h("span", null, "$" + (i + 1) + " = " + (x || "（空）"))) : [h("span", { class: "mute" }, "没有参数")]));
      const e = expand(body.value, a);
      out.textContent = e;
      const r = REAL.find(([q]) => q === args.value.trim());
      real.textContent = body.value.startsWith("请审查当前改动。重点：${1:-正确性}") && r ? (r[1] === e ? "✓ 与本机 pi 0.99.2 实测展开结果一致。" : "✗ 与实测不同。") : "";
      Store.set(ID, "tpl", { used: 1 });
    }
    [body, name, args].forEach((x) => x.addEventListener("input", run));
    run();
    return h("div", { class: "panel tpl" },
      h("div", { class: "pane" }, h("b", null, "模板文件：.pi/prompts/", h("span", { class: "mono" }, ""), "（文件名 = 命令名）"),
        h("label", { for: "m7-name", style: { fontSize: "15px", color: "var(--fg-dim)" } }, "文件名（不含 .md）", name),
        h("label", { for: "m7-tpl", style: { fontSize: "15px", color: "var(--fg-dim)" } }, "正文（frontmatter 之后的部分）", body),
        h("label", { for: "m7-args", style: { fontSize: "15px", color: "var(--fg-dim)" } }, "调用时跟的参数", args)),
      h("div", { class: "pane" }, typed, argv, h("b", null, "模型收到的用户消息"), out, real,
        h("div", { class: "mute", style: { fontSize: "15px" } }, "模型看不到 /" + "命令本身，只看到展开后的文字。参数按 shell 规则切分：引号里的空格不切。")));
  }

  // ================= §8 lab =================
  const LAB_SETUP = `mkdir -p ~/pi-lab/m7/.pi/prompts && cd ~/pi-lab/m7
echo '- 回答一律使用文言文。' > AGENTS.md
echo '- 回答不超过三行。' > .pi/APPEND_SYSTEM.md
printf -- '---\\ndescription: 以给定题目写一首短诗\\nargument-hint: "[题目]"\\n---\\n以「\${1:-春天}」为题，写一首三行短诗。\\n' > .pi/prompts/poem.md
cat .pi/prompts/poem.md`;
  const LAB_TUI = "pi --no-session --approve";
  const LAB_RUN = `pi --mode json --no-session --approve "/poem 秋雨" < /dev/null | jq -r 'select(.type=="message_end") | .message | if .role=="system" then "段落 " + (.sections | keys_unsorted | join(",")) elif .role=="user" then "你 " + .content[0].text elif .role=="assistant" then "模型 " + ([.content[] | .text? // empty] | join("") | gsub("\\n"; " / ")) else empty end'`;
  const LAB_CLEAN = "cd ~ && rm -r ~/pi-lab/m7 && rmdir --ignore-fail-on-non-empty ~/pi-lab";
  const LAB_SAMPLE = `段落 preamble,tools,rules,docs,addendum,project_context,cwd
你 以「秋雨」为题，写一首三行短诗。
模型 秋雨敲窗梧叶瘦， / 一灯照影故人遥， / 满阶寒梦逐溪流。`;
  function lab() {
    const saved = Store.get(ID, "lab", {});
    const ta = h("textarea", { class: "paste", id: "m7-lab-paste", spellcheck: "false", placeholder: LAB_SAMPLE, style: { minHeight: "100px" } });
    ta.value = saved.raw || "";
    ta.addEventListener("input", () => { delete ta.dataset.sample; });
    const out = h("div");
    const verify = (sample) => {
      if (sample) { ta.value = LAB_SAMPLE; ta.dataset.sample = "1"; }
      const isSample = ta.dataset.sample === "1";
      const L = ta.value.split(/\r?\n/).map((s) => s.trim());
      const sec = (L.find((l) => l.startsWith("段落 ")) || "").slice(3).split(",");
      const you = (L.find((l) => l.startsWith("你 ")) || "").slice(2);
      const mod = (L.find((l) => l.startsWith("模型 ")) || "").slice(3);
      const checks = [
        [sec.includes("addendum"), "系统提示里有 addendum 段（来自 APPEND_SYSTEM.md）"],
        [sec.includes("project_context"), "系统提示里有 project_context 段（来自 AGENTS.md）"],
        [sec.indexOf("addendum") >= 0 && sec.indexOf("addendum") < sec.indexOf("project_context"), "addendum 排在 project_context 前面"],
        [/秋雨/.test(you) && /三行短诗/.test(you) && !you.includes("/poem"), "你的消息是展开后的文字，里面没有 /poem"],
        [mod.length > 0, "模型回复了"],
      ];
      const ok = checks.every((c) => c[0]);
      const qbox = h("div");
      if (ok) {
        const lines = mod.split(" / ").filter(Boolean).length;
        const q = choice({ id: "q1", store: [ID, "labq"], kicker: "问题", q: `你的模型回了 ${lines} 行。如果想让「不超过三行」只对这个项目生效、而且即使不信任项目也生效，应该写在哪里？`, opts: [{ t: "项目的 AGENTS.md", ok: true }, { t: ".pi/APPEND_SYSTEM.md" }, { t: "~/.pi/agent/APPEND_SYSTEM.md" }], explain: "APPEND_SYSTEM.md 在 .pi 里，需要信任；AGENTS.md 不需要（M5）。全局的那份会作用到所有项目。", cls: "predict",
          onAnswer: (_, right) => { if (right && !isSample) { Store.set(ID, "lab", { raw: ta.value, passed: true }); checkDone(); } } });
        qbox.append(q);
      }
      out.replaceChildren(h("ul", { class: "check-list" }, checks.map(([o, t]) => h("li", null, h("span", { class: o ? "ok" : "no" }, o ? "✓" : "✗"), t))),
        ok ? qbox : h("div", { class: "note warn" }, h("span", { class: "k" }, "没有全部通过"), "缺 addendum：检查是否加了 --approve（APPEND_SYSTEM.md 在 .pi 里，需要信任）。"),
        ok && isSample ? h("p", { class: "mute" }, "示例数据只供试用，不计入实验。") : null);
    };
    if (saved.raw) setTimeout(() => verify(false), 0);
    return h("div", { class: "lab-steps" },
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "建实验目录：一份 AGENTS.md、一份 APPEND_SYSTEM.md、一个提示模板。"), h("p", { class: "dim", style: { margin: "4px 0 0" } }, "最后一行会打印模板内容。确认 ${1:-春天} 原样在里面。"), copyBlock(LAB_SETUP))),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "在交互界面里看模板（可选，不调用模型）：输入 /po，看命令菜单里的描述和参数提示。然后按 Ctrl+C 清空、Ctrl+D 退出。"), copyBlock(LAB_TUI))),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "用模板跑一次，提取系统提示的段落、你的消息、模型回复。"), h("p", { class: "dim", style: { margin: "4px 0 0" } }, "一次很小的模型调用。"), copyBlock(LAB_RUN))),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "粘贴三行输出，核对，回答问题。"), h("div", { style: { marginTop: "8px" } }, ta),
        h("div", { style: { display: "flex", gap: "8px", marginTop: "8px" } }, h("button", { class: "btn primary", onclick: () => verify(false) }, "核对我的运行"), h("button", { class: "btn ghost", onclick: () => verify(true) }, "先用示例数据试试")), out)),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "清理。"), copyBlock(LAB_CLEAN))));
  }

  // ================= quiz / review / recap =================
  const QUIZ = [
    { q: "AGENTS.md 的内容放在请求的哪里？", opts: [{ t: "系统提示里的 project_context 段", ok: true }, { t: "每条用户消息的开头" }, { t: "工具定义里" }], why: "本机实测：系统提示的第六段。每次请求都在。" },
    { q: "放了 .pi/SYSTEM.md 后，下面哪个仍然会发送？", opts: [{ t: "AGENTS.md 的内容和 tools 数组", ok: true }, { t: "pi 的工具使用规则" }, { t: "pi 的文档索引" }], why: "SYSTEM.md 替换基础说明、工具清单、规则、文档索引四段；追加段、上下文文件、工作目录和工具定义照旧。" },
    { q: "APPEND_SYSTEM.md 和 AGENTS.md 在系统提示里的先后：", opts: [{ t: "APPEND 在前，AGENTS.md 在后", ok: true }, { t: "AGENTS.md 在前" }, { t: "合并成一段" }], why: "实测顺序：preamble、tools、rules、docs、addendum、project_context、cwd。" },
    { q: "命令行用了 --append-system-prompt，项目里也有 .pi/APPEND_SYSTEM.md。结果：", opts: [{ t: "追加段只有命令行的文字", ok: true }, { t: "两者都在" }, { t: "只有文件的内容" }], why: "本机实测：命令行的文字取代了文件。" },
    { q: "调用 /review 并发 后，模型收到的消息里：", opts: [{ t: "只有展开后的文字，没有 /review", ok: true }, { t: "先是 /review 并发，再是展开文字" }, { t: "只有 /review 并发" }], why: "模板在进入会话前就展开了。" },
    { q: "/review \"API 兼容\" 安全，$1 是：", opts: [{ t: "API 兼容", ok: true }, { t: "\"API" }, { t: "API 兼容 安全" }], why: "参数按 shell 规则切分；引号里的空格不切。" },
    { q: "模板写了 ${1:-正确性}，调用时没给参数。展开成：", opts: [{ t: "正确性", ok: true }, { t: "空字符串" }, { t: "${1:-正确性} 原样保留" }], why: "${N:-默认值}：没有第 N 个参数时用默认值。" },
    { q: "模板文件 ~/.pi/agent/prompts/weekly.md 对应的命令是：", opts: [{ t: "/weekly", ok: true }, { t: "/prompt weekly" }, { t: "/skill:weekly" }], why: "文件名就是命令名。改完用 /reload。" },
    { q: "AGENTS.md 里写「不要修改 vendor/」。这能保证 vendor/ 不被修改吗？", opts: [{ t: "不能。它只是文字，模型可能不遵守", ok: true }, { t: "能。pi 会拦截" }], why: "能力只来自工具（M0）。硬性禁止要靠扩展拦截或沙箱（M10、M12）。" },
    { q: "一份 200 行、偶尔才用的操作手册，最不该放在：", opts: [{ t: "AGENTS.md", ok: true }, { t: "Skill" }, { t: "一个单独的文件，需要时让模型读" }], why: "AGENTS.md 每轮都发送，200 行每轮付费。" },
  ];
  const REVIEW = [
    { q: "（复习 M6）pi 发给提供者的请求里，系统提示在哪？", opts: [{ t: "messages 的第一条", ok: true }, { t: "HTTP 头" }], why: "本课拆开这第一条消息。" },
    { q: "（复习 M5）上下文文件的拼接顺序：", opts: [{ t: "全局 → 根目录 → … → 工作目录", ok: true }, { t: "工作目录 → … → 全局" }], why: "越靠后越具体。" },
  ];
  const PRE = [
    { id: "p1", q: "放了 SYSTEM.md 之后，AGENTS.md 还会生效吗？", opts: [{ t: "会", ok: true }, { t: "不会，SYSTEM.md 替换了一切" }] },
    { id: "p2", q: "用提示模板 /review，模型能看到你输入的「/review」吗？", opts: [{ t: "能" }, { t: "不能，只看到展开后的文字", ok: true }] },
    { id: "p3", q: "把一份长手册写进 AGENTS.md，代价是：", opts: [{ t: "每轮请求都要为它付费", ok: true }, { t: "只在第一次请求时付费" }] },
  ];
  function checkDone() {
    const ok = Store.get(ID, "lab", {}).passed && Store.get(ID, "quiz", { best: 0 }).best >= 8;
    if (ok && !Store.get(ID, "done")) Store.set(ID, "done", true);
  }

  window.Course.register(ID, (page) => {
    const rc = window.Course.recapBlock(ID, {
      pre: PRE,
      next: { id: "M8", title: "Skill", text: "AGENTS.md 每轮都发送，不适合长内容。M8 讲按需加载的 Skill：平时只占一句描述，需要时模型自己去读全文。" },
      extra: () => [["载体选择", WHICH.filter((w, i) => w.opts[Store.get(ID, "which", {})["w" + i]]?.ok).length + " / " + WHICH.length], ["AGENTS.md 诊所", Store.get(ID, "clinic", {}).ok ? "✓" : "—"]],
    });
    page.append(h("div", { class: "bench" },
      h("header", { class: "mhead" }, h("div", { class: "crumbs" }, "第 4 单元 · 扩展 / M7"), h("h1", { class: "mtitle" }, h("span", { class: "mid" }, "M7"), "指令层")),
      section("s-hero", 0, "开场", null, composer(),
        h("div", { class: "col" },
          h("p", { class: "thesis" }, "指令只是文字。", h("br"), "放在哪里，决定它何时出现、花多少钱。"),
          h("p", { class: "lead" }, "扩展能力的第一级、也是最弱的一级：给模型写说明。本课讲四种载体：AGENTS.md、APPEND_SYSTEM.md、SYSTEM.md、提示模板。勾选上面的条件，看系统提示怎样变化——每一种情况都在本机实测过。")),
        h("div", { class: "panel objectives" },
          h("ol", null,
            h("li", null, "说出系统提示的七段及其来源，以及每种指令文件落在哪一段。"),
            h("li", null, "按需求选对载体：AGENTS.md、APPEND_SYSTEM.md、SYSTEM.md、提示模板、Skill。"),
            h("li", null, "写出一份精简有效的 AGENTS.md。"),
            h("li", null, "写出带参数和默认值的提示模板，并预测它的展开结果。"),
            h("li", null, "说出指令的极限：它是文字，不是能力，也不是约束。")),
          h("div", { class: "obj-side" },
            h("div", null, h("span", { class: "k" }, "时长"), "约 60 分钟"),
            h("div", null, h("span", { class: "k" }, "前置"), "M5"),
            h("div", null, h("span", { class: "k" }, "练习"), "§8 实验 + §9 测验（≥ 8/10）"),
            h("div", null, h("span", { class: "k" }, "核对版本"), "pi 0.99.2"))),
        h("h3", null, "本课路线"),
        route(ID, [["s-pre", 1, "动手", "复习与预测"], ["s-which", 2, "动手", "选对载体"], ["s-agents", 3, "动手", "写好 AGENTS.md"], ["s-system", 4, "阅读", "SYSTEM.md 的代价"], ["s-tpl", 5, "动手", "提示模板"], ["s-place", 6, "阅读", "放在哪里"], ["s-limit", 7, "阅读", "指令的极限"], ["s-lab", 8, "实验", "三种指令"], ["s-quiz", 9, "测验", "10 题"], ["s-recap", 10, "阅读", "小结"]])),
      h("div", { class: "col" },
        section("s-pre", 1, "复习与预测", "先复习，再预测",
          todo("两道复习题立即判分；三道预测课末揭晓。"),
          REVIEW.map((r, i) => choice({ id: "r" + i, store: [ID, "rev"], kicker: "复习 " + (i + 1) + " / 2", q: r.q, opts: r.opts, explain: r.why, shuffleSeed: 131 + i * 7 })),
          PRE.map((p, i) => choice({ id: p.id, store: [ID, "pre"], kicker: "预测 " + (i + 1) + " / 3", q: p.q, opts: p.opts, reveal: false, shuffleSeed: 67 + i * 13 }))),
        section("s-which", 2, "选对载体", "四种载体，各有时机",
          todo("读对比表和四条判断规则，然后做五个场景题。"),
          h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" },
            h("thead", null, h("tr", null, h("th", null, "载体"), h("th", null, "进入请求的位置"), h("th", null, "何时出现"), h("th", null, "需信任"))),
            h("tbody", null,
              h("tr", null, h("td", null, h("code", null, "AGENTS.md")), h("td", null, "系统提示 · project_context"), h("td", null, "每轮"), h("td", null, "否")),
              h("tr", null, h("td", null, h("code", null, "APPEND_SYSTEM.md")), h("td", null, "系统提示 · addendum"), h("td", null, "每轮"), h("td", null, "项目级要")),
              h("tr", null, h("td", null, h("code", null, "SYSTEM.md")), h("td", null, "替换系统提示前四段"), h("td", null, "每轮"), h("td", null, "项目级要")),
              h("tr", null, h("td", null, "提示模板"), h("td", null, "展开成你的一条消息"), h("td", null, "你调用时"), h("td", null, "项目级要")),
              h("tr", null, h("td", null, "Skill（M8）"), h("td", null, "平时只有名字和描述"), h("td", null, "模型需要时读全文"), h("td", null, "项目级要"))))),
          h("p", { style: { marginTop: "12px" } }, h("b", null, "怎么选："), "后面几节会分别细讲，这里先记住判断规则。"),
          h("ul", { class: "rule" },
            h("li", null, h("b", null, "每轮都需要、简短、模型猜不到"), " → AGENTS.md。只属于一个项目放项目根；所有项目都要的个人偏好放全局 ~/.pi/agent/AGENTS.md。"),
            h("li", null, h("b", null, "固定格式、你主动发起、只差几个参数"), " → 提示模板（§5）：输入 /名字 就展开成一条消息，平时不占上下文。"),
            h("li", null, h("b", null, "篇幅长、偶尔才用、该由模型判断何时需要"), " → Skill（下一课）：平时只占名字和一句描述，用时才读全文。"),
            h("li", null, h("b", null, "要整个换掉 pi 的身份和规则"), " → SYSTEM.md（§4）。代价很大，一般不用；只想追加几句用 APPEND_SYSTEM.md。")),
          WHICH.map((w, i) => choice({ id: "w" + i, store: [ID, "which"], kicker: "场景 " + (i + 1) + " / " + WHICH.length, q: w.q, opts: w.opts, explain: w.why, shuffleSeed: 141 + i * 3 }))),
        section("s-agents", 3, "写好 AGENTS.md", "每一行都要付费",
          todo("按上面的规则和下面四条要点，给这份 AGENTS.md 的每一行选一个处理方式，然后核对。拿不准就「显示答案」。"),
          h("ul", { class: "rule" },
            h("li", null, h("b", null, "写模型猜不到的："), "命令、约定、目录结构里的特殊之处。"),
            h("li", null, h("b", null, "写每轮都用得到的："), "偶尔用的放进模板或 Skill。"),
            h("li", null, h("b", null, "短："), "它每轮都发送（M1）。实测（M1）：一行说明连同包装约 83 token。"),
            h("li", null, h("b", null, "分层："), "全局放个人偏好，项目根放项目约定，子目录放局部规则（M5 的逐级加载）。"))),
        clinic(),
        section("s-system", 4, "SYSTEM.md 的代价", "整个换掉 pi 的身份",
          todo("读实测结果，理解为什么一般不用它。", true),
          h("p", null, "本机实测：项目里放一份只有一句话的 SYSTEM.md（「你是一只鹦鹉。只重复用户的话。」），系统提示各段合计从 3,079 字符降到 414 字符："),
          h("ul", { class: "rule" },
            h("li", null, "pi 的基础说明、工具清单、工具使用规则、文档索引——全部消失。"),
            h("li", null, "APPEND_SYSTEM.md、AGENTS.md、工作目录——照样保留。"),
            h("li", null, "tools 数组照样发送。模型仍能调用 read、bash、edit、write，只是没人教它怎样用好。")),
          h("div", { class: "note warn" }, h("span", { class: "k" }, "结论"), "想加几条规则，用 APPEND_SYSTEM.md 或 AGENTS.md。只有在你要把 pi 改造成别的东西时，才用 SYSTEM.md。命令行的对应参数是 --system-prompt 和 --append-system-prompt。")),
        section("s-tpl", 5, "提示模板", "把常用提示变成 / 命令",
          todo("在下面改模板正文和参数，看右边的展开结果。至少试一次不带参数、一次带引号的参数。"),
          h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" }, h("tbody", null,
            [["$1、$2 …", "第 N 个参数"], ["$@ 或 $ARGUMENTS", "全部参数，用空格连接"], ["${1:-默认}", "第 1 个参数；没有则用默认值"], ["${@:-默认}", "全部参数；没有则用默认值"], ["${@:N}", "从第 N 个起的全部参数"], ["${@:N:L}", "从第 N 个起取 L 个"]].map(([a, b]) => h("tr", null, h("td", { style: { whiteSpace: "nowrap" } }, h("code", null, a)), h("td", null, b)))))))),
      h("div", { class: "bench", style: { marginTop: "14px" } }, playground()),
      h("div", { class: "col" },
        h("p", { class: "mute", style: { fontSize: "15px", marginTop: "10px" } }, "预填的模板和三组参数，与本机 pi 0.99.2 的实测展开结果逐字一致。"),
        section("s-place", 6, "放在哪里", "模板的位置与写法",
          todo("记住位置和三个 frontmatter 字段。", true),
          h("pre", { class: "panel", style: { padding: "14px 16px", fontSize: "15px" } }, `---
description: 审查代码，可指定重点       # 命令菜单里显示；省略则用正文第一行
argument-hint: "[重点] [其他要求...]"   # <必填> [可选]
---
请审查当前改动。重点：\${1:-正确性}。`),
          h("ul", { class: "rule" },
            h("li", null, h("b", null, "全局："), "~/.pi/agent/prompts/*.md，所有项目可用。"),
            h("li", null, h("b", null, "项目："), ".pi/prompts/*.md，需要信任。"),
            h("li", null, h("b", null, "只读直接子文件："), "子目录里的不会自动发现（设置和包可以指定）。"),
            h("li", null, h("b", null, "改完："), "在会话里 /reload。"))),
        section("s-limit", 7, "指令的极限", "文字不是能力，也不是约束",
          todo("读完这三条，记住它们。后面三课会分别解决。", true),
          h("ul", { class: "rule" },
            h("li", null, h("b", null, "不是能力："), "写「可以上网查资料」不会凭空多出联网工具（M0）。要能力，加工具：扩展（M9）。"),
            h("li", null, h("b", null, "不是约束："), "写「不要删文件」，模型仍可能删。要真正禁止，在 tool_call 事件拦截（M10），或者用沙箱（M12）。"),
            h("li", null, h("b", null, "可能来自别人："), "陌生仓库的 AGENTS.md 不经信任就加载（M5）。读它，就像读别人写给你的模型的指令。"))),
        section("s-lab", 8, "实验", "三种指令同时生效",
          todo("按第 1–5 步操作。第 2 步可选。"),
          h("p", null, "你会让 AGENTS.md 规定文体、APPEND_SYSTEM.md 规定长度、提示模板提供题目，然后从事件流里确认它们各自进入了请求的哪个位置。"),
          h("div", { class: "note" }, h("span", { class: "k" }, "实验规则"), "只在 ~/pi-lab/m7 里做；--no-session 不留会话；--approve 不写 trust.json；最后清理。"),
          lab()),
        section("s-quiz", 9, "掌握测验", "10 题，8 题过关", todo("10 题全部作答，点「交卷」。"), window.Course.quizBlock(ID, QUIZ, checkDone)),
        section("s-recap", 10, "小结", "你学到了什么",
          todo("看自己的预测和成绩。觉得学会了，就在本节最后点「标记为已完成」。", true),
          h("p", { class: "lead" }, "一句话：AGENTS.md 和 APPEND_SYSTEM.md 每轮都在系统提示里，SYSTEM.md 换掉 pi 的前四段，提示模板只在你调用时展开成一条消息；它们都只是文字。"),
          rc))));
    return () => rc._cleanup && rc._cleanup();
  });
})();
