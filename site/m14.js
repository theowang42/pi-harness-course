/* M14 · 从 pi 到 omp */
(function () {
  "use strict";
  const { h, $, $$, Store, choice, copyBlock, section, todo, route, term } = window.Course;
  const ID = "M14";
  const REV = "d40b86cf7d6607fc349545ec67ed321023e53425";

  // ================= §0 hero: side-by-side comparator =================
  // [需求, pi 写法, omp 写法, 差异, 等级: same|diff|risk]
  const CMP = [
    ["跑一次就退出", 'pi -p --no-session "…" < /dev/null', 'omp -p --no-session "…" < /dev/null', "一样。print、JSON、RPC 三种模式都在；omp 还多一个 rpc-ui。", "same"],
    ["全局配置在哪", "~/.pi/agent/settings.json   # JSON", "~/.omp/agent/config.yml     # YAML\nomp config get tools.approvalMode\nomp config set tools.approvalMode write", "格式从 JSON 换成 YAML；多了 omp config 命令。分层：环境变量 > 运行时 > --config 覆盖层 > 项目 > 全局 > 默认。", "diff"],
    ["登录凭证", "~/.pi/agent/auth.json", "omp login openai-codex\n# 存进 ~/.omp/agent/agent.db（SQLite）", "两边各登录一次，互不共享。omp 支持同一提供者多个账号轮换。", "diff"],
    ["写项目说明", "AGENTS.md（同目录有 CLAUDE.md 时，只读 AGENTS.md）", ".omp/AGENTS.md > .claude/CLAUDE.md > AGENTS.md > CLAUDE.md\n# 同一层只读排第一的那一个", "本机实测：四个文件都在时，omp 只读 .omp/AGENTS.md，pi 只读 AGENTS.md。同一个仓库，两边看到的说明可能完全不同。", "diff"],
    ["默认给模型的工具", "read bash edit write          # 4 个", "read bash edit eval glob grep task wait todo web_search write   # 11 个\n# 另有 xd:// 设备：lsp、ast_edit、debug……", "本机实测请求：同一句「只回答 OK」，pi 1,286 token，omp 6,379 token。厚默认的代价每轮都付（M1）。", "diff"],
    ["不让它随便跑命令", "# pi 没有内置审批\n# 自己写 tool_call 守卫（M10）", "omp --approval-mode write …\n# 或 config.yml：\ntools:\n  approvalMode: write   # always-ask | write | yolo\n  approval:\n    bash: deny", "omp 内置三档审批，但默认是 yolo——和 pi 一样什么都不问。无界面时需要审批的调用直接失败。", "diff"],
    ["打开陌生仓库", "# .pi 里的扩展、设置：信任后才加载\npi --no-approve …", "# 没有项目信任门\n# .omp/extensions/*.ts：启动就运行\nomp --no-extensions …", "本机实测：仓库里的 .omp/extensions/canary.ts 在 omp 启动时就执行了，连模型都还没调用。pi 不信任时不会加载。", "risk"],
    ["加载一个扩展", "pi -e ./my_tool.ts", "omp -e ./my_tool.ts\n# 工具默认挂在 xd://my_tool\nomp --tools read,my_tool …   # 变成普通工具", "pi 写法的扩展可以直接用。但 omp 把扩展工具挂成「设备」：模型先 read xd://名字 读说明，再 write 参数，多一次调用。", "diff"],
    ["选模型", "pi --model openai-codex/gpt-6-astra\n# 自定义：~/.pi/agent/models.json", "omp --model openai-codex/gpt-6-astra\nomp --smol … --slow … --plan …\n# 自定义：~/.omp/agent/models.yml\n# 角色：config.yml 里的 modelRoles", "omp 按「角色」分配模型：default、smol（快）、slow（强）、plan、commit、task……不同工作用不同模型（M16）。", "diff"],
    ["RPC 里等它做完", '等 {"type":"agent_settled"}', '等 {"type":"prompt_result",…}\n或 {"type":"session_settled"}', "事件家族相同，结束信号的名字不同。M13 的客户端不能原样搬过去。", "diff"],
    ["把状态放到别处", "PI_CODING_AGENT_DIR=…", "PI_CODING_AGENT_DIR=…   # 同一个变量名！\nomp --profile 名字      # omp 自己的隔离方式", "本机实测踩坑：为 omp 设置了 PI_CODING_AGENT_DIR，同一个终端里的 pi 也去那里找凭证，结果报「No API key found」。", "risk"],
  ];
  const TAG = { same: ["相同", "var(--ok)"], diff: ["不同", "var(--c-model)"], risk: ["要小心", "var(--bad)"] };
  function comparator() {
    let cur = 0;
    const btns = CMP.map((c, i) => h("button", { class: "pick", "aria-pressed": i === cur ? "true" : "false", onclick: () => { cur = i; paint(); } },
      h("span", null, c[0]), h("span", { class: "dot", style: { background: TAG[c[4]][1] } })));
    const res = h("div", { class: "res" });
    function paint() {
      btns.forEach((b, i) => b.setAttribute("aria-pressed", i === cur));
      const [need, p, o, why, k] = CMP[cur];
      res.replaceChildren(
        h("div", { style: { display: "flex", alignItems: "baseline", gap: "10px" } }, h("b", { style: { fontSize: "18px" } }, need), h("span", { class: "tagpill", style: { color: TAG[k][1], borderColor: TAG[k][1] } }, TAG[k][0])),
        h("div", { class: "expo cmp2" },
          h("div", { class: "side2" }, h("div", { class: "sub" }, "pi 0.99.2"), h("pre", { class: "script" }, p)),
          h("div", { class: "side2" }, h("div", { class: "sub" }, "omp 18.10.3"), h("pre", { class: "script" }, o))),
        h("p", { style: { margin: 0 } }, why));
      const seen = { ...Store.get(ID, "cmp", {}) }; seen[cur] = 1; Store.set(ID, "cmp", seen);
    }
    paint();
    return h("div", { class: "panel surf cmp" }, h("div", { class: "col1" }, h("b", null, "同一个需求"), h("div", { class: "list" }, btns),
      h("p", { class: "mute", style: { fontSize: "15px", margin: "8px 0 0" } }, "绿：相同　黄：不同　红：要小心")), res);
  }

  // ================= §2 request-size bars =================
  function sizeBars() {
    const rows = [["pi（-ne，不带扩展）", 1286, "var(--c-harness)"], ["pi（你的默认：带 pi-web-access）", 2762, "var(--c-harness)"], ["omp（默认）", 6379, "var(--c-ctx)"]];
    const max = 6379;
    return h("div", { class: "panel", style: { padding: "14px 16px", display: "grid", gap: "8px" } },
      h("div", { class: "mute", style: { fontSize: "15px" } }, "本机实测：同一个目录、同一个模型（gpt-6-astra），同一句「只回答 OK」，第一个请求的输入 token"),
      rows.map(([l, v, c]) => h("div", { class: "cbar" }, h("span", null, l), h("div", { class: "b", style: { width: (v / max) * 100 + "%", background: c } }), h("span", { class: "v" }, v.toLocaleString()))),
      h("div", { class: "mute", style: { fontSize: "15px" } }, "omp 的 6,379 里，系统提示约 2,500，11 个工具的定义约 3,900（用 omp toks 按 o200k 估算）。"));
  }

  // ================= §4 context-file simulator =================
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
      out.replaceChildren(h("div", { class: "expo" }, card("pi", piPick, "同目录：AGENTS.md 优先于 CLAUDE.md；不看 .claude/、.omp/"), card("omp", ompPick, "同一层只取一个：.omp/AGENTS.md > .claude/CLAUDE.md > AGENTS.md > CLAUDE.md")));
    }
    paint();
    return h("div", { class: "panel" }, h("div", { class: "panel-h" }, h("span", null, "目录里有哪些文件？勾选看两边各读哪一个"), h("span", null, "规则来自本机实测")), h("div", { class: "knobs", style: { padding: "12px 16px", borderBottom: "1px solid var(--line)" } }, boxes), out);
  }

  // ================= §5 approval table =================
  function approvalTable() {
    const rows = [["always-ask", "read", "write、exec"], ["write", "read、write", "exec"], ["yolo（默认）", "全部", "无"]];
    return h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" },
      h("thead", null, h("tr", null, h("th", null, "tools.approvalMode"), h("th", null, "自动放行"), h("th", null, "要问你"))),
      h("tbody", null, rows.map(([a, b, c]) => h("tr", null, h("td", null, h("code", null, a)), h("td", null, b), h("td", null, c))))));
  }

  // ================= §7 drill =================
  const DRILL = [
    { q: "你想让 omp 改代码，但每次运行命令前都要你点头。", opts: [{ t: "omp --approval-mode write", ok: true }, { t: "omp --approval-mode yolo" }, { t: "什么都不用设，omp 默认会问" }], why: "write 档自动放行读和改文件，exec（bash、eval、task……）要你批准。默认是 yolo，什么都不问。" },
    { q: "你把一个陌生仓库 clone 下来，想用 omp 只读地看看它在做什么。", opts: [{ t: "先 ls -la .omp .claude，再 omp --no-extensions --tools read,grep,glob", ok: true }, { t: "直接 omp，它会先问你是否信任" }, { t: "omp --approval-mode always-ask 就够了" }], why: "omp 没有信任门：.omp/extensions 启动即运行，审批模式管不到扩展代码。--no-extensions 关掉自动发现。" },
    { q: "你在 Claude Code 的 ~/.claude/CLAUDE.md 里写了全局偏好，想让 omp 也用。", opts: [{ t: "在 ~/.omp/agent/config.yml 加 enabledProviders: [claude]", ok: true }, { t: "什么都不做，omp 默认就读" }, { t: "把它复制成 ~/.pi/agent/AGENTS.md" }], why: "外来工具的用户级目录默认不读，要显式开启。注意：只要 ~/.omp/agent/AGENTS.md 存在，它会盖过所有外来的用户级文件。" },
    { q: "你在 M9 写的 pi 扩展想在 omp 里用，并让模型一步直接调用它。", opts: [{ t: "omp -e ./ext.ts --tools read,bash,…,你的工具名", ok: true }, { t: "必须改写成 omp 专用格式" }, { t: "不可能，omp 不兼容 pi 扩展" }], why: "pi 写法能加载。点名列出的工具保持顶层；或者 tools.xdev: false 让所有工具都顶层（请求会更大）。" },
  ];

  // ================= §8 lab =================
  const LAB_SHELL = `nix shell github:can1357/oh-my-pi/${REV}#omp
omp --version`;
  const LAB_LOGIN = "omp login openai-codex";
  const LAB_SETUP = `mkdir -p ~/pi-lab/m14/repo && cd ~/pi-lab/m14/repo && git init -q
echo "- 标记 A：来自 AGENTS.md" > AGENTS.md
echo "- 标记 B：来自 CLAUDE.md" > CLAUDE.md
mkdir -p .claude .omp && echo "- 标记 C：来自 .claude/CLAUDE.md" > .claude/CLAUDE.md
echo "- 标记 D：来自 .omp/AGENTS.md" > .omp/AGENTS.md
M=openai-codex/gpt-6-astra
ask(){ "$@" -p --no-session "你的指令里出现了哪些「标记」？只回答字母，用空格分开。" < /dev/null; }`;
  const LAB_CTX = `echo "omp 看到：$(ask omp --model $M)"
rm .omp/AGENTS.md && rmdir .omp
echo "omp 去掉 .omp 后：$(ask omp --model $M)"
echo "pi 看到：$(ask pi)"`;
  const LAB_APPR = `for m in yolo write; do
  rm -f hi.txt
  omp --mode json --no-session --model $M --approval-mode $m "用 bash 运行：echo hi > hi.txt" < /dev/null 2>/dev/null > ev.jsonl
  echo "$m：hi.txt $( [ -e hi.txt ] && echo 有 || echo 无) · $(jq -r 'select(.type=="tool_execution_end") | .result.content[0].text | split("\\n")[0]' ev.jsonl | head -1)"
done
rm -f hi.txt ev.jsonl`;
  const LAB_EXT = `mkdir -p .omp/extensions .pi/extensions
cat > .omp/extensions/canary.ts <<'EOF'
import { writeFileSync } from "node:fs";
// 加载时立刻写一个文件：证明代码已经运行
export default function () { writeFileSync("CANARY", "x\\n"); }
EOF
cp .omp/extensions/canary.ts .pi/extensions/
rm -f CANARY; omp -p --no-session --model nope/nothing "hi" < /dev/null > /dev/null 2>&1
echo "omp 项目扩展：CANARY $( [ -e CANARY ] && echo 被创建 || echo 没有)"
rm -f CANARY; pi -p --no-session --no-approve --model nope/nothing "hi" < /dev/null > /dev/null 2>&1
echo "pi 项目扩展（不信任）：CANARY $( [ -e CANARY ] && echo 被创建 || echo 没有)"
rm -rf CANARY .omp .pi`;
  const LAB_XD = `cat > ../char_count.ts <<'EOF'
import { Type } from "typebox";
// 一个按 pi 扩展 API 写的最小工具（M9 的写法）
export default function (pi) {
  pi.registerTool({
    name: "char_count", label: "数字数", description: "统计一段文字有多少个字符。",
    parameters: Type.Object({ text: Type.String({ description: "要统计的文字" }) }),
    async execute(_id, params) { return { content: [{ type: "text", text: String([...params.text].length) }], details: {} }; },
  });
}
EOF
omp --mode json --no-session --model $M -e ../char_count.ts "用 char_count 工具统计「你好世界」有几个字符，只回答数字。" < /dev/null 2>/dev/null > ev.jsonl
echo "omp 的工具调用：$(jq -r 'select(.type=="tool_execution_start") | "\\(.toolName) \\(.args.path // "")"' ev.jsonl | paste -sd '→')"
echo "omp 的回答：$(jq -r 'select(.type=="message_end" and .message.role=="assistant") | .message.content[] | select(.type=="text") | .text' ev.jsonl | tail -1)"
rm ev.jsonl`;
  const LAB_CLEAN = `cd ~ && rm -r ~/pi-lab/m14 && rmdir --ignore-fail-on-non-empty ~/pi-lab
exit`;
  const LAB_SAMPLE = `omp 看到：D
omp 去掉 .omp 后：C
pi 看到：A
yolo：hi.txt 有 · (no output)
write：hi.txt 无 · Tool "bash" requires approval but no interactive UI available.
omp 项目扩展：CANARY 被创建
pi 项目扩展（不信任）：CANARY 没有
omp 的工具调用：read xd://char_count→write xd://char_count
omp 的回答：4`;
  function lab() {
    const saved = Store.get(ID, "lab", {});
    const ta = h("textarea", { class: "paste", id: "m14-lab-paste", spellcheck: "false", placeholder: "omp 看到：…\nomp 去掉 .omp 后：…\npi 看到：…\nyolo：…\n…" });
    ta.value = saved.raw || "";
    ta.addEventListener("input", () => { delete ta.dataset.sample; });
    const out = h("div");
    const verify = (sample) => {
      if (sample) { ta.value = LAB_SAMPLE; ta.dataset.sample = "1"; }
      const isSample = ta.dataset.sample === "1";
      const L = ta.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      const get = (k) => (L.find((l) => l.startsWith(k)) || "").slice(k.length).trim();
      const only = (s, yes, no) => s.includes(yes) && !no.some((x) => s.includes(x));
      const checks = [
        [only(get("omp 看到："), "D", ["A", "B", "C"]), "omp：四个文件都在时只读 .omp/AGENTS.md（D）"],
        [only(get("omp 去掉 .omp 后："), "C", ["A", "B", "D"]), "omp：其次是 .claude/CLAUDE.md（C）"],
        [only(get("pi 看到："), "A", ["B", "C", "D"]), "pi：只读 AGENTS.md（A）"],
        [/有/.test(get("yolo：")) && /无/.test(get("write：")) && /approval/i.test(get("write：")), "yolo 直接执行；write 档在无界面时拒绝 bash"],
        [/被创建/.test(get("omp 项目扩展：")) && /没有/.test(get("pi 项目扩展（不信任）：")), "omp 自动运行项目扩展；pi 不信任就不加载"],
        [/xd:\/\/char_count/.test(get("omp 的工具调用：")) && get("omp 的回答：").includes("4"), "pi 扩展在 omp 里可用，经由 xd:// 设备调用"],
      ];
      const ok = checks.every((c) => c[0]);
      const qbox = h("div");
      if (ok) qbox.append(choice({ id: "q1", store: [ID, "labq"], kicker: "问题", q: "omp 那次用的是不存在的模型 nope/nothing，CANARY 却被创建了。这说明：", opts: [{ t: "项目扩展在选模型之前、启动阶段就运行了，而且没有任何确认", ok: true }, { t: "omp 偷偷换了一个能用的模型" }, { t: "CANARY 是 pi 创建的" }], explain: "所以陌生仓库里的 .omp/extensions 是比 AGENTS.md 更直接的风险：它不需要说服模型，它就是代码。", cls: "predict",
        onAnswer: (_, right) => { if (right && !isSample) { Store.set(ID, "lab", { raw: ta.value, passed: true }); checkDone(); } } }));
      out.replaceChildren(h("ul", { class: "check-list" }, checks.map(([o, t]) => h("li", null, h("span", { class: o ? "ok" : "no" }, o ? "✓" : "✗"), t))),
        ok ? qbox : h("div", { class: "note warn" }, h("span", { class: "k" }, "没有全部通过"), "omp 报「No API key」：第 2 步没登录成功。pi 那行是空的：检查同一个终端里有没有设置 PI_CODING_AGENT_DIR（两边共用这个变量）。模型偶尔多答一个字母，再跑一次那一行即可。"),
        ok && isSample ? h("p", { class: "mute" }, "示例数据只供试用，不计入实验。") : null);
    };
    if (saved.raw) setTimeout(() => verify(false), 0);
    const step = (title, note, code) => h("div", { class: "lab-step" }, h("div", null, h("b", null, title), note ? h("p", { class: "dim", style: { margin: "4px 0 0" } }, note) : null, copyBlock(code)));
    return h("div", { class: "lab-steps" },
      step("进入一个临时带 omp 的 shell。", "nix shell 不安装任何东西，exit 就消失。这个版本本机已经构建过，几秒就好。如果 nix 问是否允许 extra-substituters 等设置，回答 n。之后的步骤都在这个 shell 里做。应该看到 omp/18.10.3。", LAB_SHELL),
      step("登录（只做一次）。", "浏览器会打开 ChatGPT 登录页。凭证存进 ~/.omp/agent/agent.db，M15–M17 继续用。已经登录过就跳过。", LAB_LOGIN),
      step("建实验仓库：四个上下文文件，各带一个标记。", null, LAB_SETUP),
      step("上下文实验：omp 看到哪个，去掉 .omp 后看到哪个，pi 看到哪个。", "3 次很小的模型调用。", LAB_CTX),
      step("审批实验：同一个 bash 请求，yolo 和 write 各跑一次。", "2 次很小的模型调用。", LAB_APPR),
      step("信任实验：同一个金丝雀扩展，分别放进 .omp 和 .pi。", "故意用不存在的模型：不调用模型，只看启动阶段做了什么。最后一行删掉测试文件。", LAB_EXT),
      step("迁移实验：一个按 pi API 写的扩展，交给 omp。", "1 次小的模型调用。", LAB_XD),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "粘贴第 4–7 步的输出，核对，回答问题。"), h("div", { style: { marginTop: "8px" } }, ta),
        h("div", { style: { display: "flex", gap: "8px", marginTop: "8px" } }, h("button", { class: "btn primary", onclick: () => verify(false) }, "核对我的运行"), h("button", { class: "btn ghost", onclick: () => verify(true) }, "先用示例数据试试")), out)),
      step("清理，并退出临时 shell。", "~/.omp 留着（登录凭证、日志、约 90 MB 的原生组件），后面三课要用。以后不再用 omp 时：rm -rf ~/.omp。", LAB_CLEAN));
  }

  // ================= quiz / review / recap =================
  const QUIZ = [
    { q: "omp 和 pi 是什么关系？", opts: [{ t: "omp 是 pi 的一个分支：同一套骨架，跑在 Bun 上，定期并入上游，再加很多功能", ok: true }, { t: "两个完全独立的项目" }, { t: "omp 是 pi 的插件" }], why: "omp 仓库里有一份「从 pi-mono 移植」指南，记录最近一次同步点和有意保留的差异。" },
    { q: "本机实测，同一句「只回答 OK」，第一个请求的输入：", opts: [{ t: "pi 1,286，omp 6,379", ok: true }, { t: "差不多" }, { t: "omp 更小" }], why: "omp 有更长的系统提示和 11 个默认工具。每轮都要重发（M1）。" },
    { q: "omp 的 tools.approvalMode 默认是：", opts: [{ t: "yolo：什么都不问", ok: true }, { t: "always-ask" }, { t: "write" }], why: "和 pi 一样默认不问。区别是 omp 内置了可以打开的审批。" },
    { q: "omp -p --approval-mode write 让模型运行 bash，会怎样？", opts: [{ t: "调用失败，模型收到「requires approval but no interactive UI」", ok: true }, { t: "自动放行" }, { t: "omp 卡住等你输入" }], why: "无界面时，需要审批的调用直接失败，不会悄悄放行。" },
    { q: "同一目录里有 .omp/AGENTS.md、.claude/CLAUDE.md、AGENTS.md。omp 读：", opts: [{ t: "只读 .omp/AGENTS.md", ok: true }, { t: "三个都读" }, { t: "只读 AGENTS.md" }], why: "同一层只取一个，按 .omp > .claude > AGENTS.md > CLAUDE.md。pi 只认 AGENTS.md / CLAUDE.md。" },
    { q: "你给 Claude Code 写的 ~/.claude/CLAUDE.md，omp 默认：", opts: [{ t: "不读，要 enabledProviders: [claude]", ok: true }, { t: "自动读" }], why: "外来工具的用户级目录默认关闭；项目级的 .claude/ 默认打开。" },
    { q: "陌生仓库里有 .omp/extensions/x.ts。运行 omp 时：", opts: [{ t: "启动时就执行，没有任何确认", ok: true }, { t: "先问你是否信任" }, { t: "审批模式会拦住它" }], why: "omp 没有项目信任门。审批只管工具调用，管不到扩展代码本身。用 --no-extensions。" },
    { q: "pi 写法的扩展工具在 omp 里，模型怎样调用？", opts: [{ t: "先 read xd://名字 读说明，再 write JSON 参数", ok: true }, { t: "和 pi 一样直接调用" }, { t: "无法调用" }], why: "tools.xdev 默认开启。点名 --tools 或关掉 xdev 就变回顶层工具。" },
    { q: "omp 的用户配置文件是：", opts: [{ t: "~/.omp/agent/config.yml", ok: true }, { t: "~/.omp/settings.json" }, { t: "~/.pi/agent/settings.json" }], why: "YAML。项目级是 .omp/config.yml。数组设置在上层会整体替换，不会合并。" },
    { q: "同一个终端里设了 PI_CODING_AGENT_DIR 给 omp 用。pi 会：", opts: [{ t: "也用这个目录，可能找不到自己的凭证", ok: true }, { t: "不受影响" }], why: "omp 沿用了 pi 的环境变量名。要隔离 omp，优先用 --profile。" },
  ];
  const REVIEW = [
    { q: "（复习 M5）pi 在同一目录里同时看到 AGENTS.md 和 CLAUDE.md，读哪个？", opts: [{ t: "只读 AGENTS.md", ok: true }, { t: "两个都读" }, { t: "只读 CLAUDE.md" }], why: "本课会看到 omp 的规则多了两级。" },
    { q: "（复习 M12）pi 的项目信任管什么？", opts: [{ t: ".pi 里的代码和配置：扩展、设置、包", ok: true }, { t: "AGENTS.md" }, { t: "模型能调用哪些工具" }], why: "本课会看到 omp 没有这一层。" },
  ];
  const PRE = [
    { id: "p1", q: "omp 默认会在运行 bash 之前问你吗？", opts: [{ t: "会" }, { t: "不会", ok: true }] },
    { id: "p2", q: "你给 Claude Code 写的全局 ~/.claude/CLAUDE.md，omp 默认会读吗？", opts: [{ t: "会" }, { t: "不会", ok: true }] },
    { id: "p3", q: "同一句「只回答 OK」，omp 的第一个请求比 pi（不带扩展）大多少？", opts: [{ t: "差不多" }, { t: "约 2 倍" }, { t: "约 5 倍", ok: true }] },
  ];
  function checkDone() {
    const ok = Store.get(ID, "lab", {}).passed && Store.get(ID, "quiz", { best: 0 }).best >= 8;
    if (ok && !Store.get(ID, "done")) Store.set(ID, "done", true);
  }

  window.Course.register(ID, (page) => {
    const rc = window.Course.recapBlock(ID, {
      pre: PRE,
      next: { id: "M15", title: "omp 的工具面", text: "你已经知道 omp 多了 7 个默认工具和一排 xd:// 设备。M15 逐个打开它们：hashline 编辑为什么更稳，LSP、ast_grep、eval 和内部 URL 怎样用。" },
      extra: () => [["对照条目", Object.keys(Store.get(ID, "cmp", {})).length + " / " + CMP.length], ["迁移判断", DRILL.filter((x, i) => x.opts[Store.get(ID, "drill", {})["d" + i]]?.ok).length + " / " + DRILL.length]],
    });
    page.append(h("div", { class: "bench" },
      h("header", { class: "mhead" }, h("div", { class: "crumbs" }, "第 6 单元 · oh-my-pi / M14"), h("h1", { class: "mtitle" }, h("span", { class: "mid" }, "M14"), "从 pi 到 omp")),
      section("s-hero", 0, "开场", null, comparator(),
        h("div", { class: "col" },
          h("p", { class: "thesis" }, "同一副骨架，更厚的默认。", h("br"), "你学过的 80% 直接能用，剩下 20% 会咬人。"),
          h("p", { class: "lead" }, "上面是对照器：左边点一个需求，看 pi 和 omp 各怎么写。红色的条目是本课的重点——它们在 omp 里更危险，而且和你在 pi 里养成的直觉相反。每一条都在本机验证过。")),
        h("div", { class: "panel objectives" },
          h("ol", null,
            h("li", null, "说出 omp 和 pi 的关系，以及「厚默认」的代价。"),
            h("li", null, "找到 omp 的配置、凭证和状态，并用分层规则判断某个设置从哪来。"),
            h("li", null, "预测 omp 在一个目录里读哪个上下文文件、哪些技能。"),
            h("li", null, "使用 omp 的三档审批，并说出它为什么不能代替 pi 的项目信任。"),
            h("li", null, "把一个 pi 扩展搬进 omp，解释 xd:// 设备。")),
          h("div", { class: "obj-side" },
            h("div", null, h("span", { class: "k" }, "时长"), "约 75 分钟"),
            h("div", null, h("span", { class: "k" }, "前置"), "M5、M9、M12、M13"),
            h("div", null, h("span", { class: "k" }, "练习"), "§8 实验 + §9 测验（≥ 8/10）"),
            h("div", null, h("span", { class: "k" }, "核对版本"), "pi 0.99.2 · omp 18.10.3（" + REV.slice(0, 7) + "）"))),
        h("h3", null, "本课路线"),
        route(ID, [["s-pre", 1, "动手", "复习与预测"], ["s-what", 2, "阅读", "omp 是什么"], ["s-conf", 3, "阅读", "配置与状态"], ["s-ctx", 4, "动手", "上下文与发现"], ["s-appr", 5, "阅读", "审批与信任"], ["s-ext", 6, "阅读", "扩展迁移"], ["s-drill", 7, "动手", "迁移判断"], ["s-lab", 8, "实验", "四个对照实验"], ["s-quiz", 9, "测验", "10 题"], ["s-recap", 10, "阅读", "小结"]])),
      h("div", { class: "col" },
        section("s-pre", 1, "复习与预测", "先复习，再预测",
          todo("两道复习题立即判分；三道预测课末揭晓。"),
          REVIEW.map((r, i) => choice({ id: "r" + i, store: [ID, "rev"], kicker: "复习 " + (i + 1) + " / 2", q: r.q, opts: r.opts, explain: r.why, shuffleSeed: 281 + i * 7 })),
          PRE.map((p, i) => choice({ id: p.id, store: [ID, "pre"], kicker: "预测 " + (i + 1) + " / 3", q: p.q, opts: p.opts, reveal: false, shuffleSeed: 137 + i * 13 }))),
        section("s-what", 2, "omp 是什么", "pi 的一个分支，带着很多电池",
          todo("读这一节，看懂下面的柱状图。", true),
          h("p", null, "oh-my-pi（命令名 omp）是 pi 的一个分支，由另一位作者维护。它从同一个代码库（pi-mono）出发，定期把上游的改动移植过来，然后加上大量自己的功能。"),
          h("ul", { class: "rule" },
            h("li", null, h("b", null, "相同的骨架："), "agent loop、会话树、压缩、扩展 API、print/JSON/RPC/SDK——M0–M13 的概念全部适用。"),
            h("li", null, h("b", null, "不同的运行时："), "用 Bun 而不是 Node；包名是 @oh-my-pi/*；凭证存在 SQLite 里。"),
            h("li", null, h("b", null, "厚默认："), "11 个默认工具（子代理 task、代码执行 eval、网页搜索、待办……）、LSP、AST 编辑、审批、模型角色、规则系统、记忆……pi 让你自己搭，omp 先给你搭好。"),
            h("li", null, h("b", null, "移植时有意保留的差异："), "omp 的移植指南列了一张表：哪些上游写法不要搬过来（例如状态栏组件、凭证存储、工具工厂的签名）。")),
          sizeBars(),
          h("p", { class: "dim", style: { marginTop: "10px" } }, "厚默认不是坏事——它省掉了你写扩展的时间。但它有两个代价：每轮多付的上下文，以及你没看过、却默认开着的能力。本课剩下的部分都在处理这两件事。")),
        section("s-conf", 3, "配置与状态", "东西放在哪，设置从哪来",
          todo("读两张表。", true),
          h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" },
            h("thead", null, h("tr", null, h("th", null, "用途"), h("th", null, "pi"), h("th", null, "omp"))),
            h("tbody", null, [
              ["用户设置", "~/.pi/agent/settings.json", "~/.omp/agent/config.yml"],
              ["项目设置", ".pi/settings.json（要信任）", ".omp/config.yml（直接生效）"],
              ["凭证", "~/.pi/agent/auth.json", "~/.omp/agent/agent.db"],
              ["自定义模型", "~/.pi/agent/models.json", "~/.omp/agent/models.yml"],
              ["会话", "~/.pi/agent/sessions/", "~/.omp/agent/sessions/"],
              ["日志与原生组件", "—", "~/.omp/logs、~/.omp/natives（本机约 92 MB）"],
            ].map((r) => h("tr", null, r.map((c, j) => h("td", j ? null : { style: { color: "var(--fg-mute)", whiteSpace: "nowrap" } }, j ? h("code", null, c) : c))))))),
          h("p", { style: { marginTop: "12px" } }, h("b", null, "设置的分层"), "（高的赢）：环境变量 → 运行时修改 → --config 覆盖层 → 项目 .omp/config.yml → 全局 config.yml → 默认值。"),
          h("pre", { class: "script" }, h("span", { class: "lbl" }, "常用命令"), `omp config get tools.approvalMode      # 本机默认：yolo
omp config set tools.approvalMode write  # 写进全局 config.yml
omp config list                          # 所有设置和当前值
omp --config ./ci.yml …                  # 只对这一次运行生效的覆盖层`),
          h("div", { class: "note warn" }, h("span", { class: "k" }, "两个坑"), h("b", null, "数组整体替换："), "项目里写 disabledProviders: [x]，就是整张列表，不会和全局的合并。", h("br"), h("b", null, "共用环境变量："), "omp 沿用了 pi 的 PI_CODING_AGENT_DIR、PI_SMOL_MODEL 等名字。本机实测：给 omp 设了 PI_CODING_AGENT_DIR，同一终端里的 pi 就找不到凭证。要隔离 omp，用 omp --profile 名字。")),
        section("s-ctx", 4, "上下文与发现", "omp 会读哪些文件",
          todo("在模拟器里试出三种不同的结果。"),
          h("p", null, "omp 想让你「不迁移也能用」，所以它会读其他工具的约定目录。但规则和 pi 不同："),
          ctxSim(),
          h("ul", { class: "rule", style: { marginTop: "12px" } },
            h("li", null, h("b", null, "项目级外来目录默认读："), ".claude/CLAUDE.md、.claude/skills/、.gemini/……本机实测：.claude/skills 和 .omp/skills 里的技能都进了目录，", h("b", null, ".pi/skills 没有"), "——omp 不读 .pi。"),
            h("li", null, h("b", null, "用户级外来目录默认不读："), "~/.claude、~/.codex 要在 config.yml 里写 enabledProviders: [claude] 才打开。本机实测：默认请求里没有 ~/.claude/CLAUDE.md 的内容。"),
            h("li", null, h("b", null, "用户级只留一个："), "~/.omp/agent/AGENTS.md 存在时，它盖过所有外来的用户级文件。"),
            h("li", null, h("b", null, "不在 git 仓库里时："), "向上查找以主目录为边界；omp 还会拒绝直接在 ~ 里启动（自动换到临时目录），除非加 --allow-home。"))),
        section("s-appr", 5, "审批与信任", "多了一道闸，少了一道门",
          todo("读两个实验结果。", true),
          h("p", null, "omp 给每个工具标了等级：read（只读）、write（改文件）、exec（运行代码、开子代理……）。审批模式决定哪些等级要问你："),
          approvalTable(),
          h("p", { style: { marginTop: "12px" } }, h("b", null, "实验一（审批）："), "让模型运行 echo hi > hi.txt。yolo：文件被创建。write：bash 属于 exec，要审批；print 模式没有界面，调用直接失败，模型收到「Tool \"bash\" requires approval but no interactive UI available」，文件没有被创建。"),
          h("p", null, h("b", null, "实验二（信任）："), "仓库里放一个加载时就写文件的扩展。omp 启动——连模型都还没选好——文件就被写了。同一个扩展放进 .pi/，pi 在不信任时不加载。"),
          h("div", { class: "note warn" }, h("span", { class: "k" }, "结论"), "审批管的是模型发起的工具调用；扩展是代码，在审批之前就运行了。omp 没有 pi 那样的项目信任门，所以 M12 的建议在 omp 里更要紧：陌生仓库先 ls -la .omp .claude，用 --no-extensions，或者放进沙箱。"),
          h("p", { class: "dim" }, "补充：bash 有一份内置的「危险命令」清单（rm -rf /、fork 炸弹、下载即执行……），在非 yolo 模式下强制询问；yolo 下这条强制会被忽略，除非你自己写了 prompt 或 deny 策略。")),
        section("s-ext", 6, "扩展迁移", "pi 的扩展搬进 omp",
          todo("读懂 xd:// 设备的两步调用。", true),
          h("p", null, "omp 保留了 pi 的扩展 API，并把 @earendil-works/… 的导入改写到自己的包上。所以 M9、M10 写的扩展通常能直接 -e 加载。本机实测，M9 的 text_stats.ts 原样加载成功。"),
          h("p", null, "但工具的呈现方式变了。omp 默认开着 tools.xdev：除了核心工具，其余工具不在请求里列出完整定义，而是挂成一个「设备」："),
          h("pre", { class: "script" }, h("span", { class: "lbl" }, "本机实测的调用序列（统计 a.txt）"), `① read  { path: "xd://text_stats" }                 ← 先读说明和参数格式
② write { path: "xd://text_stats", content: "{\\"path\\":\\"a.txt\\"}" }   ← 再把参数写进去
回答：3 20 11`),
          h("ul", { class: "rule" },
            h("li", null, h("b", null, "好处："), "工具再多，请求也不膨胀（和 M11 的 codemode 同一个思路）。"),
            h("li", null, h("b", null, "代价："), "每个工具第一次用要多一次调用；模型可能不去用它。"),
            h("li", null, h("b", null, "变回顶层："), "--tools 里点名的工具保持顶层；或者 tools.xdev: false 让所有工具顶层（本机实测：工具数从 11 变成 15，多出 ast_edit、debug、lsp 和你的工具）。"),
            h("li", null, h("b", null, "其他差异："), "包清单优先读 package.json 里的 omp 字段，没有才读 pi 字段；ctx.ui.setFooter 等少数界面接口在 omp 里是空操作。"))),
        section("s-drill", 7, "迁移判断", "用 omp 怎么做",
          todo("四个场景，各选一种做法。"),
          DRILL.map((x, i) => choice({ id: "d" + i, store: [ID, "drill"], kicker: "场景 " + (i + 1) + " / " + DRILL.length, q: x.q, opts: x.opts, explain: x.why, shuffleSeed: 291 + i * 3 }))),
        section("s-lab", 8, "实验", "四个对照实验",
          todo("按第 1–9 步操作。全部在终端里完成。"),
          h("p", null, "同一个仓库里，让 pi 和 omp 各自回答「你看到了什么」，再分别测试审批、信任和扩展迁移。"),
          h("div", { class: "note" }, h("span", { class: "k" }, "实验规则"), "omp 通过 nix shell 临时提供，不装进系统；所有运行 --no-session；只在 ~/pi-lab/m14 里做；金丝雀只是空文件；最后清理。共 6 次很小的模型调用。登录会在 ~/.omp 留下凭证——这是使用 omp 的前提，不是实验垃圾。"),
          lab()),
        section("s-quiz", 9, "掌握测验", "10 题，8 题过关", todo("10 题全部作答，点「交卷」。"), window.Course.quizBlock(ID, QUIZ, checkDone)),
        section("s-recap", 10, "小结", "你学到了什么",
          todo("看自己的预测和成绩。觉得学会了，就在本节最后点「标记为已完成」。", true),
          h("p", { class: "lead" }, "一句话：omp 是 pi 的厚默认分支——概念全通用，但配置换成 YAML、上下文文件按 .omp > .claude > AGENTS.md > CLAUDE.md 只取一个、默认 yolo 且没有项目信任门、扩展工具挂成 xd:// 设备；每个默认都要先看清，再决定留不留。"),
          rc))));
    return () => rc._cleanup && rc._cleanup();
  });
})();
