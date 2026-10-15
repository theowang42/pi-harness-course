/* M17（显示为第 18 课）· 选择与组合 */
(function () {
  "use strict";
  const { h, $, $$, Store, choice, copyBlock, section, todo, route, term } = window.Course;
  const ID = "M17";
  const REV = "d40b86cf7d6607fc349545ec67ed321023e53425";

  // ================= §0 hero: chooser =================
  // 每个选项：[文字, pi 加分, omp 加分, 配置建议]
  const QS = [
    { k: "use", q: "你主要怎样用它？", o: [["在终端里和它一起写代码", 0, 2, "交互为主：omp 的 hashline、LSP、子代理能直接省事"], ["嵌进脚本、定时任务或自己的程序", 2, 0, "嵌入为主：pi 的 print/JSON/RPC/SDK 小而稳（M13）"], ["两样都有", 1, 1, "两样都有：交互用 omp，自动化用 pi，共用 AGENTS.md"]] },
    { k: "cost", q: "每一轮的上下文成本，你在意吗？", o: [["很在意（长会话、按量付费、小窗口模型）", 2, 0, "省上下文：pi 默认请求约 1.3K，omp 约 6.4K（M15 实测）"], ["不太在意", 0, 1, ""]] },
    { k: "power", q: "你需要子代理、LSP、hashline 编辑、TTSR 规则这些能力吗？", o: [["需要，而且不想自己写", 0, 3, "omp 内置：task、xd://lsp、hashline、.omp/rules"], ["偶尔需要，可以自己写扩展", 2, 0, "pi + 自己的扩展：只加你真正用到的（M9–M12）"], ["不需要", 2, 0, ""]] },
    { k: "repo", q: "你经常打开陌生的仓库吗？", o: [["经常", 1, 0, "陌生仓库：pi 有项目信任门；用 omp 必须加 --no-extensions，并放进沙箱（M13、M15）"], ["很少，基本是自己的仓库", 0, 0, ""]] },
    { k: "diy", q: "你愿意花时间搭自己的 harness 吗？", o: [["愿意，我想清楚知道每一层在做什么", 2, 0, "自己搭：pi 是更小的底座，每一层都看得见"], ["不想，开箱即用最好", 0, 2, "开箱即用：omp 的默认已经搭好，但要逐项核对（M15 的红色条目）"]] },
  ];
  function chooser() {
    const ans = { ...Store.get(ID, "pick", {}) };
    const res = h("div", { class: "res" });
    const blocks = QS.map((x) => h("div", { class: "cq" }, h("b", null, x.q),
      h("div", { class: "cq-o" }, x.o.map((o, i) => h("button", { class: "pick", "aria-pressed": ans[x.k] === i ? "true" : "false", onclick: () => { ans[x.k] = i; Store.set(ID, "pick", { ...ans }); paint(); } }, o[0])))));
    function paint() {
      blocks.forEach((b, qi) => $$(".pick", b).forEach((btn, i) => btn.setAttribute("aria-pressed", ans[QS[qi].k] === i ? "true" : "false")));
      const n = QS.filter((x) => ans[x.k] !== undefined).length;
      if (n < QS.length) { res.replaceChildren(h("p", { class: "mute", style: { margin: 0 } }, `回答全部 ${QS.length} 题，看建议。已答 ${n} 题。`)); return; }
      let p = 0, o = 0; const notes = [];
      QS.forEach((x) => { const c = x.o[ans[x.k]]; p += c[1]; o += c[2]; if (c[3]) notes.push(c[3]); });
      const both = ans.use === 2 || Math.abs(p - o) <= 1;
      const pick = both ? "两个都用" : p > o ? "pi" : "omp";
      res.replaceChildren(
        h("div", { class: "cbig" }, pick, h("span", { class: "mute" }, `  pi ${p} 分 · omp ${o} 分`)),
        h("ul", { class: "rule" }, notes.map((t) => h("li", null, t))),
        h("p", { class: "mute", style: { margin: 0 } }, "这不是标准答案。它把你的回答对应到本课程实测过的事实上；理由比结论重要。"));
    }
    paint();
    return h("div", { class: "panel chooser" }, h("div", { class: "cq-list" }, blocks), res);
  }

  // ================= §2 overview table =================
  const ROWS = [
    ["定位", "小而可读的底座；你自己往上加", "pi 的分支；默认就带很多能力", "第 1、15 课"],
    ["默认请求（只回答 OK）", "1,286 token（不带扩展）", "6,379 token", "第 15 课"],
    ["只读任务、最小权限（本课实验）", "3 次请求，共 3,500 token", "3 次请求，共 8,411 token", "第 18 课"],
    ["陌生仓库", "项目信任门：.pi 代码要你同意才加载", "没有信任门：.omp/extensions 启动即运行", "第 6、13、15 课"],
    ["审批", "没有内置；自己写 tool_call 守卫", "always-ask / write / yolo，默认 yolo", "第 11、15 课"],
    ["改文件", "按旧文本匹配；输出要抄旧文本", "hashline：行号 + 标签；输出少好几倍", "第 16 课"],
    ["懂代码", "自己接（扩展或 MCP）", "xd://lsp、ast_grep（默认关）", "第 12、16 课"],
    ["多 agent", "自己写扩展或脚本", "task 子代理 + 模型角色", "第 17 课"],
    ["规则", "AGENTS.md、技能；拦截靠扩展", "TTSR 规则：零成本常驻，命中才掐断", "第 9、17 课"],
    ["嵌入", "print / JSON / RPC / SDK，结束信号 agent_settled", "同样四种，结束信号 prompt_result / session_settled", "第 14、15 课"],
  ];
  function overview() {
    return h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" },
      h("thead", null, h("tr", null, h("th", null, ""), h("th", null, "pi 0.99.2"), h("th", null, "omp 18.10.3"), h("th", null, "出处"))),
      h("tbody", null, ROWS.map(([a, b, c, d]) => h("tr", null, h("td", { style: { color: "var(--fg-mute)" } }, a), h("td", null, b), h("td", null, c), h("td", { class: "mute", style: { whiteSpace: "nowrap" } }, d))))));
  }

  // ================= §5 scenarios =================
  const SCEN = [
    { q: "你在一台 8K 上下文的本地小模型上跑 agent，处理简单的文件整理。", opts: [{ t: "pi，只开需要的工具", ok: true }, { t: "omp 默认配置" }], why: "omp 的默认请求就要约 6.4K，几乎占满窗口。pi 的固定成本小得多（第 2 课）。" },
    { q: "你每天在自己的大仓库里改代码，希望编辑省输出、改完能查类型错误。", opts: [{ t: "omp：hashline + xd://lsp", ok: true }, { t: "pi 默认" }], why: "这正是 omp 的厚默认最值钱的地方（第 16 课）。审批建议设成 write。" },
    { q: "一个 Python 服务要在后台调用 agent，处理用户上传的文档。", opts: [{ t: "pi 的 RPC（子进程），关进沙箱", ok: true }, { t: "omp 交互模式" }, { t: "pi 的 SDK" }], why: "非 Node 语言、要进程隔离：RPC。无人值守：沙箱、--no-session、收窄工具（第 13、14 课）。" },
    { q: "同事发来一个陌生仓库，让你「用 agent 看看有没有问题」。", opts: [{ t: "先 ls -la .pi .omp .claude 和 AGENTS.md；用只读工具；omp 要加 --no-extensions", ok: true }, { t: "直接 omp" }, { t: "直接 pi --approve" }], why: "两边的风险不同：pi 的 AGENTS.md 不受信任限制，omp 连扩展都不受限（第 13、15 课）。" },
    { q: "你要把同一套项目说明同时给 pi 和 omp 用。", opts: [{ t: "写在根目录 AGENTS.md，不建 .omp/AGENTS.md 和 .claude/CLAUDE.md", ok: true }, { t: "写在 .omp/AGENTS.md" }, { t: "写在 .pi/AGENTS.md" }], why: "两边都读 AGENTS.md；但同一层只要有 .omp/AGENTS.md 或 .claude/CLAUDE.md，omp 就不读 AGENTS.md 了（第 15 课实测）。" },
    { q: "一个 30 个文件的机械迁移，你希望并行、主会话不被撑满。", opts: [{ t: "omp 的子代理（例如 sonic），按角色用便宜模型", ok: true }, { t: "pi 一个会话里逐个改" }], why: "子代理各自一个干净上下文，只交回结果（第 17 课）。记得它们以 yolo 运行。" },
    { q: "你想让「TypeScript 里不许写 any」平时零成本、写出来立刻被拦。", opts: [{ t: "omp 的 TTSR 规则（内置的 ts-no-any 就是）", ok: true }, { t: "写进 AGENTS.md" }, { t: "pi 的 tool_call 守卫" }], why: "pi 的守卫也能拦，但要等调用写完、要你写代码；TTSR 边写边查（第 17 课）。" },
    { q: "你想看懂 agent 的每一层，并长期维护自己的配置。", opts: [{ t: "pi：底座小，每一层都是你加的", ok: true }, { t: "omp：默认全开" }], why: "厚默认省时间，但你没读过的默认也在运行。学习和长期维护，小底座更透明。" },
  ];

  // ================= §6 my workflow worksheet =================
  const WS = [
    ["task", "我最常让 agent 做的三件事", "例：整理 Vault 笔记的标签；给代码写测试；读论文做摘要"],
    ["where", "它会接触哪些目录和凭证", "例：~/0xΩ（读写）；~/.ssh（不应接触）"],
    ["tool", "我选 pi / omp / 两个都用，理由", "引用本课的实测数字或表格行"],
    ["guard", "我的边界（工具、审批、信任、沙箱）", "例：--tools read,grep；陌生目录一律 box.sh"],
    ["auto", "要自动化的部分", "例：每晚 print 模式生成日报，--no-session"],
  ];
  function worksheet() {
    const saved = { ...Store.get(ID, "ws", {}) };
    const fields = WS.map(([k, label, ph]) => {
      const ta = h("textarea", { class: "ws-in", placeholder: ph, rows: 2 });
      ta.value = saved[k] || "";
      ta.addEventListener("input", () => { saved[k] = ta.value; Store.set(ID, "ws", { ...saved }); count(); });
      return h("label", { class: "ws-f" }, h("b", null, label), ta);
    });
    const meter = h("div", { class: "mute" });
    const count = () => { meter.textContent = `已填 ${WS.filter(([k]) => (saved[k] || "").trim().length >= 4).length} / ${WS.length}。这份草稿会跟着你的进度同步，毕业项目会用到它。`; };
    count();
    return h("div", { class: "panel ws" }, fields, meter);
  }

  // ================= §8 lab =================
  const LAB_SHELL = `nix shell github:can1357/oh-my-pi/${REV}#omp`;
  const LAB_SETUP = `mkdir -p ~/pi-lab/m18 && cd ~/pi-lab/m18 && git init -q
printf 'def add(a, b):\\n    return a + b\\n' > calc.py
printf 'from calc import add\\n\\nprint(add(2, 3))\\n' > main.py
printf 'import calc\\n\\nassert calc.add(1, 1) == 2\\n' > test_calc.py
M=openai-codex/gpt-6-astra
Q="这个仓库里有几个 Python 文件？每个文件一句话说明用途。"
sum_line(){ echo "$1：请求 $(jq -s '[.[]|select(.type=="message_end" and .message.role=="assistant" and .message.stopReason!="error")]|length' ev.jsonl) 次 · 输入 $(jq -s '[.[]|select(.type=="message_end" and .message.role=="assistant" and .message.stopReason!="error")|.message.usage|(.input+.cacheRead)]|add' ev.jsonl) token · 工具 $(jq -r 'select(.type=="tool_execution_start")|.toolName' ev.jsonl | sort -u | paste -sd,) · 回答开头 $(jq -rs '[.[]|select(.type=="message_end" and .message.role=="assistant")|.message.content[]|select(.type=="text")|.text]|last|gsub("\\n";" ")|.[0:24]' ev.jsonl)"; }`;
  const LAB_RUN = `pi --mode json --no-session -nc --tools read,grep,find,ls "$Q" < /dev/null 2>/dev/null > ev.jsonl; sum_line pi
omp --mode json --no-session --no-extensions --approval-mode always-ask --tools read,grep,glob --model $M "$Q" < /dev/null 2>/dev/null > ev.jsonl; sum_line omp
rm ev.jsonl`;
  const LAB_CLEAN = `cd ~ && rm -r ~/pi-lab/m18 && rmdir --ignore-fail-on-non-empty ~/pi-lab
exit`;
  const LAB_SAMPLE = `pi：请求 3 次 · 输入 3500 token · 工具 find,read · 回答开头 仓库里共有 **3 个 Python 文件**：
omp：请求 3 次 · 输入 8411 token · 工具 glob,read · 回答开头 仓库里共有 **3 个 Python 文件**：`;
  function lab() {
    const saved = Store.get(ID, "lab", {});
    const ta = h("textarea", { class: "paste", id: "m17-lab-paste", spellcheck: "false", placeholder: "pi：请求 … 次 · 输入 … token · …\nomp：请求 … 次 · 输入 … token · …" });
    ta.value = saved.raw || "";
    ta.addEventListener("input", () => { delete ta.dataset.sample; });
    const out = h("div");
    const verify = (sample) => {
      if (sample) { ta.value = LAB_SAMPLE; ta.dataset.sample = "1"; }
      const isSample = ta.dataset.sample === "1";
      const L = ta.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      const get = (k) => (L.find((l) => l.startsWith(k)) || "").slice(k.length).trim();
      const num = (s, re) => +((s.match(re) || [])[1] || 0);
      const pi = get("pi："), omp = get("omp：");
      const pin = num(pi, /输入\s*(\d+)/), on = num(omp, /输入\s*(\d+)/);
      const checks = [
        [pin > 0 && on > 0, "两边都跑完了，并报出了输入 token"],
        [[pi, omp].every((x) => /3\s*\**\s*个/.test(x.split("回答开头")[1] || "")), "两边都答出 3 个 Python 文件"],
        [!/bash|write|edit/.test(pi.split("·")[2] || "") && !/bash|write|edit|eval|task/.test(omp.split("·")[2] || ""), "两边都只用了只读工具"],
        [on > pin, "同样的最小权限，omp 的输入仍然更多"],
      ];
      const ok = checks.every((c) => c[0]);
      const qbox = h("div");
      if (ok) qbox.append(choice({ id: "q1", store: [ID, "labq"], kicker: "问题", q: `你的结果里 omp 是 pi 的 ${(on / pin).toFixed(1)} 倍。已经把 omp 的工具收窄到 3 个了，差距主要来自哪里？`, opts: [{ t: "omp 更长的系统提示：每次请求都要发", ok: true }, { t: "omp 调用了更多次工具" }, { t: "模型不一样" }], explain: "第 15 课测过：omp 的系统提示约 2,500 token，pi 的基础提示约 450。收窄工具只砍掉了工具定义那部分。", cls: "predict",
        onAnswer: (_, right) => { if (right && !isSample) { Store.set(ID, "lab", { raw: ta.value, passed: true }); checkDone(); } } }));
      out.replaceChildren(h("ul", { class: "check-list" }, checks.map(([o, t]) => h("li", null, h("span", { class: o ? "ok" : "no" }, o ? "✓" : "✗"), t))),
        ok ? qbox : h("div", { class: "note warn" }, h("span", { class: "k" }, "没有全部通过"), "某一行输入是 0 或空：那次运行被限流或没登录，单独重跑第 3 步的那一行。数字和示例不同没关系，只看关系。"),
        ok && isSample ? h("p", { class: "mute" }, "示例数据只供试用，不计入实验。") : null);
    };
    if (saved.raw) setTimeout(() => verify(false), 0);
    const step = (title, note, code) => h("div", { class: "lab-step" }, h("div", null, h("b", null, title), note ? h("p", { class: "dim", style: { margin: "4px 0 0" } }, note) : null, copyBlock(code)));
    return h("div", { class: "lab-steps" },
      step("进入带 omp 的临时 shell。", "如果 nix 问是否允许 extra-substituters 等设置，回答 n。", LAB_SHELL),
      step("建一个三文件的小仓库，定义同一个问题和一个汇总函数。", null, LAB_SETUP),
      step("同一个只读问题，两边都用最小权限各跑一次。", "pi：只读工具、不读上下文文件。omp：只读工具、不加载扩展、审批最严。约 6 次很小的模型调用。", LAB_RUN),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "粘贴第 3 步的两行输出，核对，回答问题。"), h("div", { style: { marginTop: "8px" } }, ta),
        h("div", { style: { display: "flex", gap: "8px", marginTop: "8px" } }, h("button", { class: "btn primary", onclick: () => verify(false) }, "核对我的运行"), h("button", { class: "btn ghost", onclick: () => verify(true) }, "先用示例数据试试")), out)),
      step("清理，并退出临时 shell。", null, LAB_CLEAN));
  }

  // ================= quiz / review / recap =================
  const QUIZ = [
    { q: "本课实验里，pi 和 omp 都用最小权限回答同一个只读问题。输入 token：", opts: [{ t: "pi 约 3,500，omp 约 8,400", ok: true }, { t: "差不多" }, { t: "omp 更少" }], why: "收窄工具后，omp 的长系统提示仍然每次都发。" },
    { q: "收窄工具（--tools）能消掉 omp 和 pi 之间的全部成本差距吗？", opts: [{ t: "不能，只消掉工具定义那部分", ok: true }, { t: "能" }], why: "系统提示部分不随工具变化。" },
    { q: "同一个项目要同时给 pi 和 omp 用，说明写在：", opts: [{ t: "根目录 AGENTS.md，且同层不放 .omp/AGENTS.md、.claude/CLAUDE.md", ok: true }, { t: ".omp/AGENTS.md" }, { t: ".pi/AGENTS.md" }], why: "omp 同一层只取一个文件，优先级 .omp > .claude > AGENTS.md > CLAUDE.md。" },
    { q: "后台服务要调用 agent，服务是 Python 写的。最合适的是：", opts: [{ t: "pi --mode rpc 子进程，加沙箱和 --no-session", ok: true }, { t: "pi 的 SDK" }, { t: "omp 的交互模式" }], why: "SDK 只能在 Node/Bun 里用。" },
    { q: "打开陌生仓库，用 omp 时最关键的一个开关：", opts: [{ t: "--no-extensions", ok: true }, { t: "--approval-mode yolo" }, { t: "--no-session" }], why: "omp 没有信任门，项目扩展启动即运行（第 15 课实测）。" },
    { q: "在 8K 窗口的小模型上，哪种更合适？", opts: [{ t: "pi，只开需要的工具", ok: true }, { t: "omp 默认" }], why: "omp 默认请求约 6.4K。" },
    { q: "omp 的厚默认最值钱的场景：", opts: [{ t: "自己的大仓库里长时间交互开发", ok: true }, { t: "一次性的 print 任务" }, { t: "小窗口本地模型" }], why: "hashline、LSP、子代理在这里收益最大。" },
    { q: "两个都装时，最容易踩的坑：", opts: [{ t: "共用 PI_CODING_AGENT_DIR 等环境变量名，互相影响", ok: true }, { t: "两个不能同时安装" }], why: "第 15 课实测：给 omp 设了这个变量，pi 就找不到凭证。" },
    { q: "pi 的项目信任和 omp 的审批模式：", opts: [{ t: "管的不是同一件事：一个管项目代码加载，一个管工具调用", ok: true }, { t: "是同一个东西换了名字" }], why: "所以 omp 的审批再严，也挡不住项目扩展。" },
    { q: "选择 pi 还是 omp，最好的依据是：", opts: [{ t: "你的任务、风险和成本——并且能用实测数字说明", ok: true }, { t: "哪个功能多" }, { t: "哪个更新快" }], why: "这就是第 18 课的全部内容。" },
  ];
  const REVIEW = [
    { q: "（复习第 15 课）omp 默认的审批模式是？", opts: [{ t: "yolo", ok: true }, { t: "write" }, { t: "always-ask" }], why: "本课会把它和 pi 的信任门放在一起比。" },
    { q: "（复习第 14 课）Python 程序要双向控制 agent，用：", opts: [{ t: "RPC", ok: true }, { t: "SDK" }, { t: "print" }], why: "本课的场景题会用到。" },
  ];
  const PRE = [
    { id: "p1", q: "把 omp 的工具收窄到 read、grep、glob 三个后，同一个只读问题，它的输入 token 会和 pi 差不多吗？", opts: [{ t: "会，差不多" }, { t: "不会，仍然明显更多", ok: true }] },
    { id: "p2", q: "同一个仓库根目录同时有 AGENTS.md 和 .claude/CLAUDE.md。pi 和 omp 读到的说明一样吗？", opts: [{ t: "一样" }, { t: "不一样", ok: true }] },
    { id: "p3", q: "对你自己的 Vault 工作流，你现在更倾向哪个？（没有对错，课末看你的理由）", opts: [{ t: "pi", ok: true }, { t: "omp", ok: true }, { t: "两个都用", ok: true }] },
  ];
  function checkDone() {
    const ok = Store.get(ID, "lab", {}).passed && Store.get(ID, "quiz", { best: 0 }).best >= 8;
    if (ok && !Store.get(ID, "done")) Store.set(ID, "done", true);
  }

  window.Course.register(ID, (page) => {
    const rc = window.Course.recapBlock(ID, {
      pre: PRE,
      next: { id: "CAP", title: "毕业项目", text: "最后一步：为你自己的一个真实工作流交付一套 harness。§6 的草稿就是起点。" },
      extra: () => [["场景决策", SCEN.filter((x, i) => x.opts[Store.get(ID, "scen", {})["s" + i]]?.ok).length + " / " + SCEN.length], ["工作流草稿", WS.filter(([k]) => ((Store.get(ID, "ws", {})[k] || "").trim().length >= 4)).length + " / " + WS.length]],
    });
    page.append(h("div", { class: "bench" },
      h("header", { class: "mhead" }, h("div", { class: "crumbs" }, "第 6 单元 · oh-my-pi / M17"), h("h1", { class: "mtitle" }, h("span", { class: "mid" }, "M17"), "选择与组合")),
      section("s-hero", 0, "开场", null, chooser(),
        h("div", { class: "col" },
          h("p", { class: "thesis" }, "没有更好的 harness，", h("br"), "只有更合适的 harness。"),
          h("p", { class: "lead" }, "上面是选型器：回答五个问题，它会把你的回答对应到本课程实测过的事实上。本课不再学新功能，只做一件事——为具体的人和任务做选择，并说出理由。")),
        h("div", { class: "panel objectives" },
          h("ol", null,
            h("li", null, "用一张表说出 pi 和 omp 在成本、安全、编辑、编排、嵌入上的差别。"),
            h("li", null, "亲手测出：最小权限下两者的成本差距还剩多少，来自哪里。"),
            h("li", null, "设计两者共用的项目布局，避开已知的坑。"),
            h("li", null, "为八个具体场景做出选择并给出理由。"),
            h("li", null, "写下自己工作流的草稿，作为毕业项目的起点。")),
          h("div", { class: "obj-side" },
            h("div", null, h("span", { class: "k" }, "时长"), "约 60 分钟"),
            h("div", null, h("span", { class: "k" }, "前置"), "M13–M16"),
            h("div", null, h("span", { class: "k" }, "练习"), "§8 实验 + §9 测验（≥ 8/10）"),
            h("div", null, h("span", { class: "k" }, "核对版本"), "pi 0.99.2 · omp 18.10.3"))),
        h("h3", null, "本课路线"),
        route(ID, [["s-pre", 1, "动手", "复习与预测"], ["s-map", 2, "阅读", "全景对照"], ["s-cost", 3, "阅读", "成本差距在哪"], ["s-mix", 4, "阅读", "两个一起用"], ["s-scen", 5, "动手", "八个场景"], ["s-mine", 6, "动手", "我的工作流"], ["s-keep", 7, "阅读", "留下还是卸载"], ["s-lab", 8, "实验", "最小权限对比"], ["s-quiz", 9, "测验", "10 题"], ["s-recap", 10, "阅读", "小结"]])),
      h("div", { class: "col" },
        section("s-pre", 1, "复习与预测", "先复习，再预测",
          todo("两道复习题立即判分；三道预测课末揭晓。"),
          REVIEW.map((r, i) => choice({ id: "r" + i, store: [ID, "rev"], kicker: "复习 " + (i + 1) + " / 2", q: r.q, opts: r.opts, explain: r.why, shuffleSeed: 341 + i * 7 })),
          PRE.map((p, i) => choice({ id: p.id, store: [ID, "pre"], kicker: "预测 " + (i + 1) + " / 3", q: p.q, opts: p.opts, reveal: false, shuffleSeed: 167 + i * 13 }))),
        section("s-map", 2, "全景对照", "前 17 课，压成一张表",
          todo("逐行读。每一行都能回到出处那一课。", true),
          overview()),
        section("s-cost", 3, "成本差距在哪", "收窄工具之后还剩什么",
          todo("读两段，再在实验里自己测。", true),
          h("p", null, "第 15 课的 6,379 token 由两块组成：约 2,500 的系统提示，约 3,900 的工具定义。收窄工具只能砍掉第二块。本课实验把 omp 收窄到 read、grep、glob 三个，问一个只读问题："),
          h("div", { class: "panel", style: { padding: "14px 16px", display: "grid", gap: "8px" } },
            [["pi（-nc，4 个只读工具）", 3500, "var(--c-harness)"], ["omp（--no-extensions，3 个只读工具）", 8411, "var(--c-ctx)"]].map(([l, v, c]) => h("div", { class: "cbar" }, h("span", null, l), h("div", { class: "b", style: { width: (v / 8411) * 100 + "%", background: c } }), h("span", { class: "v" }, v.toLocaleString()))),
            h("div", { class: "mute" }, "本机实测：两边都是 3 次请求，答案相同（3 个 Python 文件）。数字是 3 次请求的输入之和。")),
          h("p", { style: { marginTop: "12px" } }, "结论：omp 的「厚」有两层。能力那一层可以关掉；提示那一层关不掉，每次请求都要付。会话越长、请求越多，这一层的总量越大——除非提供者的缓存命中（第 2 课）。")),
        section("s-mix", 4, "两个一起用", "共用什么，隔开什么",
          todo("读三条规则。", true),
          h("ul", { class: "rule" },
            h("li", null, h("b", null, "共用：项目说明。"), "写在根目录 AGENTS.md。两边都读它——前提是同一层没有 .omp/AGENTS.md 和 .claude/CLAUDE.md，否则 omp 只读那一个（第 15 课实测）。"),
            h("li", null, h("b", null, "隔开：凭证和状态。"), "pi 在 ~/.pi/agent，omp 在 ~/.omp/agent，各自登录。不要在同一个终端里为其中一个设置 PI_CODING_AGENT_DIR；要隔离 omp，用 omp --profile。"),
            h("li", null, h("b", null, "分工：按场景，而不是按喜好。"), "交互开发用 omp 的厚默认；脚本、定时任务、嵌入用 pi 的小底座。技能和扩展各放各的目录（.pi/skills、.omp/skills 或 .claude/skills），omp 不读 .pi。")),
          h("pre", { class: "script" }, h("span", { class: "lbl" }, "一个两边都能用的项目布局"), `repo/
  AGENTS.md            # 两边共用的说明
  .pi/                 # 只有 pi 读：扩展、技能、设置（需要信任）
  .omp/                # 只有 omp 读：规则、子代理、config.yml（无需信任，直接生效）
                       # 不放 .omp/AGENTS.md，否则它会盖过根目录 AGENTS.md`)),
        section("s-scen", 5, "八个场景", "每一题都要说得出理由",
          todo("八个场景，各选一种做法。"),
          SCEN.map((x, i) => choice({ id: "s" + i, store: [ID, "scen"], kicker: "场景 " + (i + 1) + " / " + SCEN.length, q: x.q, opts: x.opts, explain: x.why, shuffleSeed: 351 + i * 3 }))),
        section("s-mine", 6, "我的工作流", "毕业项目的草稿",
          todo("填五栏。每栏几句话就够；会自动保存。"),
          h("p", null, "毕业项目要你为自己的一个真实工作流交付一套 harness。先在这里想清楚：做什么、碰什么、用哪个、怎样设边界、哪部分自动化。"),
          worksheet()),
        section("s-keep", 7, "留下还是卸载", "课程结束后的电脑",
          todo("按你的选择执行，或者什么都不做。", true),
          h("p", null, "本课程的实验都在 ~/pi-lab 里做、做完就删。课程之外留在你电脑上的，只有两个工具自己的目录："),
          h("ul", { class: "rule" },
            h("li", null, h("b", null, "留下 omp："), "把它加进 NixOS 配置（需要我写 Nix 片段时告诉我）；凭证已在 ~/.omp/agent。"),
            h("li", null, h("b", null, "不留 omp："), "rm -rf ~/.omp（凭证、日志、约 90 MB 的原生组件）。nix shell 用过的包留在 Nix store 里，nix-collect-garbage 会回收。"),
            h("li", null, h("b", null, "pi："), "~/.pi/agent 是你平时就在用的目录，课程没有在里面留下实验文件。"))),
        section("s-lab", 8, "实验", "最小权限对比",
          todo("按第 1–5 步操作。全部在终端里完成。"),
          h("p", null, "同一个只读问题，两边都收窄到最小权限各跑一次，看成本差距还剩多少。"),
          h("div", { class: "note" }, h("span", { class: "k" }, "实验规则"), "omp 由 nix shell 临时提供；两边都 --no-session；只在 ~/pi-lab/m18 里做；最后清理。约 6 次很小的模型调用。"),
          lab()),
        section("s-quiz", 9, "掌握测验", "10 题，8 题过关", todo("10 题全部作答，点「交卷」。"), window.Course.quizBlock(ID, QUIZ, checkDone)),
        section("s-recap", 10, "小结", "你学到了什么",
          todo("看自己的预测和成绩。觉得学会了，就在本节最后点「标记为已完成」。", true),
          h("p", { class: "lead" }, "一句话：pi 是看得见每一层的小底座，omp 是带着电池的分支；能力可以关，提示的成本和缺少的信任门关不掉。按任务、风险和成本选择，用实测数字说理由——两个一起用时，共用 AGENTS.md，隔开凭证。"),
          rc))));
    return () => rc._cleanup && rc._cleanup();
  });
})();
