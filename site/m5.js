/* M5 · 配置的分层与信任 */
(function () {
  "use strict";
  const { h, $, $$, Store, choice, copyBlock, section, todo, route, term } = window.Course;
  const ID = "M5";

  // ================= §0 hero: config map =================
  const FILES = {
    user: [
      ["settings.json", "free", "全局设置：默认模型、思考强度、工具、压缩、包……所有项目共用。"],
      ["AGENTS.md / CLAUDE.md", "free", "全局说明。每个项目的请求里都带着它（排在最前）。"],
      ["SYSTEM.md", "free", "整个替换 pi 的系统提示。慎用：会丢掉 pi 教给模型的规则。"],
      ["APPEND_SYSTEM.md", "free", "在系统提示末尾追加文字。"],
      ["keybindings.json", "free", "自定义快捷键（M2 的那些键都能改）。"],
      ["models.json", "free", "兼容端点、自定义模型、模型参数覆盖（M6）。"],
      ["mcp.json", "free", "所有项目可用的 MCP 服务器（M11）。"],
      ["auth.json", "free", "/login 保存的 API key 和 OAuth 凭证。不要分享。"],
      ["extensions/ skills/ prompts/ themes/", "free", "全局的扩展、Skill、提示模板、主题。"],
      ["trust.json", "free", "你保存过的项目信任决定。"],
    ],
    project: [
      ["settings.json", "trust", "项目设置。覆盖全局设置；资源列表与全局合并。"],
      ["SYSTEM.md / APPEND_SYSTEM.md", "trust", "项目级的系统提示替换 / 追加。存在时优先于全局的同名文件。"],
      ["mcp.json", "trust", "项目的 MCP 服务器。"],
      ["extensions/", "trust", "项目扩展：TypeScript 代码，在 pi 进程里运行。最需要信任。"],
      ["skills/ prompts/ themes/", "trust", "项目的 Skill、提示模板、主题。"],
    ],
  };
  function configMap() {
    const det = h("div", { class: "det" }, h("span", { class: "mute" }, "点任一文件，看它管什么、需不需要信任。"));
    const all = [];
    const col = (key, title, sub) => h("div", { class: "col2" }, h("div", { class: "hd" }, title), h("div", { class: "sub" }, sub),
      FILES[key].map(([f, t, why]) => { const b = h("button", { class: "fbtn", onclick: () => { all.forEach((x) => x.classList.remove("sel")); b.classList.add("sel");
        det.replaceChildren(h("code", { style: { fontSize: "16px" } }, (key === "user" ? "~/.pi/agent/" : ".pi/") + f), h("p", { style: { margin: "8px 0" } }, why),
          h("p", { class: "dim", style: { margin: 0 } }, t === "trust" ? "项目文件：只在你信任这个目录后才加载。" : key === "user" ? "你自己的目录：总是加载，不需要信任。" : ""));
        const s = { ...Store.get(ID, "map", {}) }; s[key + f] = 1; Store.set(ID, "map", s); } },
        h("span", null, f), h("span", { class: "tag " + t }, t === "trust" ? "需信任" : "总加载")); all.push(b); return b; }));
    return h("div", { class: "panel cmap" },
      col("user", "用户级", "~/.pi/agent/"),
      col("project", "项目级", "<项目>/.pi/"),
      h("div", null, det, h("div", { class: "det", style: { borderTop: "1px solid var(--line)" } }, h("b", null, "第三类：上下文文件"),
        h("p", { class: "dim", style: { margin: "6px 0 0" } }, "工作目录及其每一级父目录里的 AGENTS.md / CLAUDE.md。它们不在 .pi 里，", h("b", null, "不需要信任"), "就会加载。§4 详讲。"))));
  }

  // ================= §3 merge resolver =================
  const RES = new Set(["packages", "extensions", "skills", "prompts", "themes"]);
  const BUILTIN = ["read", "bash", "edit", "write"];
  function applyTools(sel, list) {
    if (!Array.isArray(list)) return sel;
    const plain = list.filter((x) => !/^[+-]/.test(x));
    let out = plain.length ? [...plain] : [...sel];
    for (const x of list) { if (x.startsWith("+")) { if (!out.includes(x.slice(1))) out.push(x.slice(1)); } else if (x.startsWith("-")) out = out.filter((t) => t !== x.slice(1)); }
    return out;
  }
  /** Returns {value, src} trees: src mirrors value with "u" | "p" for leaves. */
  function mergeSettings(u, p) {
    const val = {}, src = {};
    for (const k of new Set([...Object.keys(u || {}), ...Object.keys(p || {})])) {
      const a = u ? u[k] : undefined, b = p ? p[k] : undefined;
      if (k === "defaultTools") { val[k] = applyTools(applyTools(BUILTIN, a), b); src[k] = a !== undefined && b !== undefined ? "up" : b !== undefined ? "p" : "u"; continue; }
      if (b === undefined) { val[k] = a; src[k] = "u"; continue; }
      if (a === undefined) { val[k] = b; src[k] = "p"; continue; }
      if (RES.has(k) && Array.isArray(a) && Array.isArray(b)) { val[k] = [...a, ...b]; src[k] = "up"; continue; }
      if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) { const r = mergeSettings(a, b); val[k] = r.value; src[k] = r.src; continue; }
      val[k] = b; src[k] = "p";
    }
    return { value: val, src };
  }
  function renderEff(v, s, ind = 0) {
    const pad = "  ".repeat(ind), out = [];
    const keys = Object.keys(v);
    keys.forEach((k, i) => {
      const comma = i < keys.length - 1 ? "," : "";
      if (v[k] && typeof v[k] === "object" && !Array.isArray(v[k])) {
        out.push(h("div", null, pad + JSON.stringify(k) + ": {"), ...renderEff(v[k], s[k] || {}, ind + 1), h("div", null, pad + "}" + comma));
      } else {
        const tag = s[k] === "p" ? "p" : s[k] === "up" ? "p" : "u";
        const note = s[k] === "p" ? "  ← 项目" : s[k] === "up" ? "  ← 全局 + 项目" : "  ← 全局";
        out.push(h("div", { class: tag }, pad + JSON.stringify(k) + ": " + JSON.stringify(v[k]) + comma, h("span", { class: "d" }, note)));
      }
    });
    return out;
  }
  function resolver() {
    const uTa = h("textarea", { id: "m5-user", spellcheck: "false" }), pTa = h("textarea", { id: "m5-proj", spellcheck: "false" });
    uTa.value = JSON.stringify({ defaultModel: "gpt-6-astra", defaultThinkingLevel: "medium", defaultTools: ["+grep"], compaction: { reserveTokens: 16384, keepRecentTokens: 20000 }, skills: ["~/my-skills"] }, null, 2);
    pTa.value = JSON.stringify({ defaultThinkingLevel: "high", defaultTools: ["-bash"], compaction: { keepRecentTokens: 5000 }, skills: ["./skills"] }, null, 2);
    const trust = h("input", { type: "checkbox", id: "m5-trust", checked: true });
    const eff = h("div", { class: "eff" }), tools = h("div", { class: "toolrow" }), msg = h("div", { class: "mute", style: { fontSize: "15px" } });
    function run() {
      let u, p, ok = true;
      try { u = JSON.parse(uTa.value || "{}"); uTa.classList.remove("bad"); } catch (e) { uTa.classList.add("bad"); ok = false; }
      try { p = JSON.parse(pTa.value || "{}"); pTa.classList.remove("bad"); } catch (e) { pTa.classList.add("bad"); ok = false; }
      if (!ok) { msg.textContent = "JSON 格式有误（红框）。pi 遇到坏文件会报错。"; return; }
      const r = mergeSettings(u, trust.checked ? p : {});
      eff.replaceChildren(h("div", null, "{"), ...renderEff(r.value, r.src, 1), h("div", null, "}"));
      const t = r.value.defaultTools || BUILTIN;
      tools.replaceChildren(...t.map((x) => h("span", null, x)), h("span", { class: "ext" }, "+ 扩展注册的工具"));
      msg.textContent = trust.checked ? "项目已信任：项目设置参与合并。" : "项目未信任：项目的 .pi/settings.json 被忽略。";
      Store.set(ID, "resolver", { used: 1 });
    }
    [uTa, pTa].forEach((t) => t.addEventListener("input", run)); trust.addEventListener("change", run);
    run();
    return h("div", { class: "panel merge" },
      h("div", { class: "pane" }, h("b", { class: "r-user" }, "~/.pi/agent/settings.json"), uTa),
      h("div", { class: "pane" }, h("b", { class: "r-model" }, "<项目>/.pi/settings.json"), pTa, h("label", { class: "toggle", for: "m5-trust" }, trust, "信任这个项目")),
      h("div", { class: "pane" }, h("b", null, "生效的设置"), eff, h("div", { class: "mute", style: { fontSize: "15px" } }, "启动时的内置工具："), tools, msg));
  }
  const MQ = [
    { q: "全局 defaultThinkingLevel 是 medium，项目是 high，项目已信任。生效的是？", opts: [{ t: "high", ok: true }, { t: "medium" }], why: "项目设置覆盖全局设置。本机实测：底栏变成 gpt-6-astra • high。" },
    { q: "同上，但项目没有被信任。生效的是？", opts: [{ t: "medium", ok: true }, { t: "high" }], why: "本机实测：不信任时 pi 提示「Project .pi resources and packages are ignored」，底栏仍是 medium。" },
    { q: "全局 compaction 是 {reserveTokens: 16384, keepRecentTokens: 20000}，项目只写 {keepRecentTokens: 5000}。生效的 reserveTokens 是？", opts: [{ t: "16384", ok: true }, { t: "没有了，整个对象被项目替换" }], why: "对象递归合并：项目只覆盖它写到的键。" },
    { q: "全局 defaultTools 是 [\"+grep\"]，项目是 [\"-bash\"]。启动时的内置工具？", opts: [{ t: "read、edit、write、grep", ok: true }, { t: "read、bash、edit、write" }, { t: "只有 grep" }], why: "只含 +/- 的列表是在继承的选择上做加减。先全局 +grep，再项目 -bash。" },
    { q: "项目 defaultTools 是 [\"read\", \"ls\"]（纯名字）。启动时有哪些工具？", opts: [{ t: "read、ls，加上扩展注册的工具", ok: true }, { t: "只有 read、ls" }, { t: "默认四个加 ls" }], why: "本机实测：纯名字替换全部内置工具，但联网扩展的三个工具仍在。要关扩展工具得用 -ne 或别的方法。" },
    { q: "全局 skills 是 [\"~/my-skills\"]，项目是 [\"./skills\"]。生效的？", opts: [{ t: "两个都加载", ok: true }, { t: "只有 ./skills" }], why: "资源列表（packages、extensions、skills、prompts、themes）合并，不覆盖。" },
  ];

  // ================= §4 context files =================
  const DIRS = ["~/.pi/agent", "/", "/home/nox", "/home/nox/proj", "/home/nox/proj/pkg", "/home/nox/proj/pkg/api"];
  const KINDS = ["AGENTS.override.md", "AGENTS.md", "CLAUDE.md"];
  function finder() {
    let cwd = 5;
    const has = { "~/.pi/agent": { "AGENTS.md": 1 }, "/home/nox/proj": { "AGENTS.md": 1, "CLAUDE.md": 1 }, "/home/nox/proj/pkg": { "AGENTS.override.md": 1, "AGENTS.md": 1 }, "/home/nox/proj/pkg/api": {} };
    const tree = h("div", { class: "tree" }), list = h("ol"), note = h("div", { class: "mute", style: { fontSize: "15px" } });
    function pick(d) { const f = has[d] || {}; return KINDS.find((k) => f[k]) || null; }
    function paint() {
      tree.replaceChildren(h("div", { class: "mute", style: { fontSize: "15px" } }, "点文件名切换「有 / 没有」。点目录名把它设为工作目录。"),
        ...DIRS.map((d, i) => {
          if (i > 0 && i > cwd) return null;
          const used = pick(d);
          return h("div", { class: "drow" + (i === cwd ? " cwd" : "") },
            h("span", { class: "p", style: { cursor: i > 2 ? "pointer" : "default" }, onclick: () => { if (i > 2) { cwd = i; paint(); } } }, d + (i === cwd ? "　← 工作目录" : "")),
            h("span", { class: "fl" }, KINDS.map((k) => h("button", { "aria-pressed": (has[d] || {})[k] ? "true" : "false", class: used === k ? "used" : "", onclick: () => { (has[d] ||= {})[k] = (has[d][k] ? 0 : 1); paint(); } }, k.replace(".md", "")))));
        }).filter(Boolean),
        h("div", { class: "drow", style: { opacity: 0.5 } }, h("span", { class: "p" }, DIRS.slice(cwd + 1).join("  ") || "（没有更深的目录）"), h("span", { class: "mute", style: { fontSize: "15px" } }, "工作目录以下：不读")));
      const order = [DIRS[0], ...DIRS.slice(1, cwd + 1)];
      const got = order.map((d) => [d, pick(d)]).filter(([, f]) => f);
      list.replaceChildren(...got.map(([d, f]) => h("li", null, (d === "/" ? "" : d) + "/" + f)));
      note.textContent = got.length ? "按这个顺序拼进系统提示。越靠后越具体。" : "一个都没有。";
      Store.set(ID, "finder", { used: 1 });
    }
    paint();
    return h("div", { class: "panel dirs" }, tree, h("div", { class: "loaded" }, h("b", null, "会加载的上下文文件"), list, note,
      h("div", { class: "mute", style: { fontSize: "15px", marginTop: "8px" } }, "规则（本机实测）：全局目录排最前；然后从根到工作目录逐级；每个目录只取一个文件，优先级 override > AGENTS > CLAUDE；与信任无关；-nc 全部关掉。")));
  }

  // ================= §5 trust =================
  const TOPTS = [
    ["Trust", "保存「信任这个目录」到 ~/.pi/agent/trust.json。以后在这里启动不再询问。子目录也算信任（最近的决定生效）。"],
    ["Trust parent folder", "把决定保存在上一级目录。适合一个父目录下有很多项目，一次信任全部。"],
    ["Trust (this session only)", "只对这次运行生效，什么都不写。和命令行 --approve 效果相同。"],
    ["Do not trust", "保存「不信任」。以后在这里启动，项目的 .pi 资源都被忽略，也不再询问。"],
    ["Do not trust (this session only)", "本次忽略，不保存。和 --no-approve 效果相同。"],
  ];
  function trustPrompt() {
    const exp = h("div", { class: "panel fexp" }, h("span", { class: "mute" }, "点一个选项，看它会做什么。"));
    const btns = TOPTS.map(([t, why], i) => h("button", { onclick: () => { btns.forEach((b, j) => b.classList.toggle("sel", i === j)); exp.replaceChildren(h("b", null, t), h("p", { class: "dim", style: { margin: "4px 0 0" } }, why)); Store.set(ID, "trustOpt", { ...Store.get(ID, "trustOpt", {}), [i]: 1 }); } }, (i === 0 ? "→ " : "  ") + t + (i === 1 ? " (~/proj)" : "")));
    return h("div", null, h("div", { class: "trustbox" },
      h("div", { class: "t" }, " Trust project folder?"), h("div", { class: "dimt" }, " ~/proj/pkg"),
      h("div", { style: { margin: "4px 0 8px" } }, " This allows pi to load .pi settings and resources, install missing project packages, and execute project extensions."),
      btns, h("div", { class: "dimt", style: { marginTop: "8px" } }, " ↑↓ navigate  enter select  escape/ctrl+c cancel")),
      h("div", { class: "mute", style: { fontSize: "15px", marginTop: "6px" } }, "本机真实界面（路径已缩短）。目录里出现 .pi/settings.json 时弹出。"), exp);
  }

  // ================= §8 lab =================
  const LAB_SETUP = `mkdir -p ~/pi-lab/m5/a/b/c/.pi && cd ~/pi-lab/m5
echo '- 来自 a 的说明' > a/CLAUDE.md
echo '- 来自 b 的说明' > a/b/AGENTS.md
echo '- 只在 b 生效的替代说明' > a/b/AGENTS.override.md
echo '- 来自 c 的说明' > a/b/c/AGENTS.md
echo '{"defaultThinkingLevel":"high","defaultTools":["-bash","+grep"]}' > a/b/c/.pi/settings.json
cd a/b/c`;
  const LAB_RUN = `for f in --no-approve --approve; do
  pi --mode json --no-session $f "只回答：好" < /dev/null \\
    | jq -r --arg f "$f" 'select(.type=="message_end" and .message.role=="system") | "\\($f) 工具=\\(.message.toolsAdded | map(.name) | join(",")) 文件=\\([.message.sections.project_context | scan("path=\\"([^\\"]+)\\"") | .[0] | split("/") | .[-2:] | join("/")] | join(" "))"'
done`;
  const LAB_CLEAN = "cd ~ && rm -r ~/pi-lab/m5 && rmdir --ignore-fail-on-non-empty ~/pi-lab";
  const LAB_SAMPLE = `--no-approve 工具=read,bash,edit,write,web_search,fetch_content,get_search_content 文件=a/CLAUDE.md b/AGENTS.override.md c/AGENTS.md
--approve 工具=read,edit,write,grep,web_search,fetch_content,get_search_content 文件=a/CLAUDE.md b/AGENTS.override.md c/AGENTS.md`;
  function lab() {
    const saved = Store.get(ID, "lab", {});
    const ta = h("textarea", { class: "paste", id: "m5-lab-paste", spellcheck: "false", placeholder: "--no-approve 工具=… 文件=…\n--approve 工具=… 文件=…" });
    ta.value = saved.raw || "";
    ta.addEventListener("input", () => { delete ta.dataset.sample; });
    const out = h("div");
    const verify = (sample) => {
      if (sample) { ta.value = LAB_SAMPLE; ta.dataset.sample = "1"; }
      const isSample = ta.dataset.sample === "1";
      const parse = (flag) => { const l = ta.value.split(/\r?\n/).find((x) => x.trim().startsWith(flag + " ")); if (!l) return null; const m = l.match(/工具=(\S*) 文件=(.*)$/); return m ? { tools: m[1].split(",").filter(Boolean), files: m[2].trim().split(/\s+/).filter(Boolean) } : null; };
      const na = parse("--no-approve"), ap = parse("--approve");
      const checks = [
        [!!na && !!ap, "两行都在：--no-approve 和 --approve"],
        [na && na.tools.includes("bash") && !na.tools.includes("grep"), "不信任时：工具仍是默认的（有 bash，没有 grep）"],
        [ap && !ap.tools.includes("bash") && ap.tools.includes("grep"), "信任后：项目设置生效（去掉 bash，加上 grep）"],
        [na && ap && na.files.join() === ap.files.join() && na.files.length === 3, "两次加载的上下文文件完全相同，各 3 个"],
        [ap && ap.files[1] === "b/AGENTS.override.md", "b 目录用的是 AGENTS.override.md，而不是 AGENTS.md"],
      ];
      const ok = checks.every((c) => c[0]);
      if (ok && !isSample) { Store.set(ID, "lab", { raw: ta.value, passed: true }); checkDone(); }
      out.replaceChildren(h("ul", { class: "check-list" }, checks.map(([o, t]) => h("li", null, h("span", { class: o ? "ok" : "no" }, o ? "✓" : "✗"), t))),
        ok ? h("div", { class: "note" }, h("span", { class: "k" }, isSample ? "示例数据" : "实验通过"), isSample ? "示例数据全部满足条件，但不计入实验。请用你自己的运行再做一次。" : "你证明了两件事：信任只决定 .pi 里的东西；上下文文件不管信不信任都会加载。最后一步：清理。")
          : h("div", { class: "note warn" }, h("span", { class: "k" }, "没有全部通过"), "确认第 2 步是在 a/b/c 目录里运行的（第 1 步最后一行会 cd 进去）。"));
    };
    if (saved.raw) setTimeout(() => verify(false), 0);
    return h("div", { class: "lab-steps" },
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "建三层目录：每层一份说明，最里层一份项目设置。"), copyBlock(LAB_SETUP))),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "同一个目录，不信任和信任各跑一次。"),
        h("p", { class: "dim", style: { margin: "4px 0 0" } }, "--no-approve 和 --approve 都只影响这一次运行，不写 trust.json。每次输出：请求里的工具清单，和被加载的上下文文件。共 2 次很小的模型调用。"), copyBlock(LAB_RUN))),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "粘贴两行输出，核对。"), h("div", { style: { marginTop: "8px" } }, ta),
        h("div", { style: { display: "flex", gap: "8px", marginTop: "8px" } }, h("button", { class: "btn primary", onclick: () => verify(false) }, "核对我的运行"), h("button", { class: "btn ghost", onclick: () => verify(true) }, "先用示例数据试试")), out)),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "清理。"), copyBlock(LAB_CLEAN))));
  }

  // ================= quiz / review / recap =================
  const QUIZ = [
    { q: "全局设置放在哪里？", opts: [{ t: "~/.pi/agent/settings.json", ok: true }, { t: "~/.config/pi/settings.json" }, { t: "项目根目录的 settings.json" }], why: "agent 目录默认是 ~/.pi/agent，可用 PI_CODING_AGENT_DIR 改。" },
    { q: "全局和项目都设置了 defaultModel。生效的是：", opts: [{ t: "项目的（如果项目已信任）", ok: true }, { t: "全局的" }, { t: "两个都用" }], why: "项目覆盖全局；但项目设置只在信任后才读。" },
    { q: "项目没有被信任。下面哪个仍然会加载？", opts: [{ t: "项目里的 AGENTS.md", ok: true }, { t: "项目的 .pi/settings.json" }, { t: "项目的 .pi/extensions/" }], why: "上下文文件不受项目信任限制。所以陌生仓库里的 AGENTS.md 照样会影响模型。" },
    { q: "目录 b 里同时有 AGENTS.md 和 CLAUDE.md。加载哪个？", opts: [{ t: "只加载 AGENTS.md", ok: true }, { t: "两个都加载" }, { t: "只加载 CLAUDE.md" }], why: "本机实测：每个目录只取一个，优先级 AGENTS.override.md > AGENTS.md > CLAUDE.md。" },
    { q: "上下文文件的拼接顺序：", opts: [{ t: "全局 → 根目录 → … → 工作目录", ok: true }, { t: "工作目录 → … → 根目录 → 全局" }, { t: "按文件名排序" }], why: "越靠后越具体。工作目录以下的子目录不读。" },
    { q: "项目信任能阻止什么？", opts: [{ t: "不信任时，项目的扩展代码不会被执行", ok: true }, { t: "阻止 bash 工具访问项目外的文件" }, { t: "阻止模型读到项目里的文字" }], why: "信任只决定是否加载 .pi 里的资源。工具仍用你的权限运行；文件内容照样能被读到。" },
    { q: "在 CI 脚本里用 pi --mode json，项目有 .pi/settings.json。不加任何参数时：", opts: [{ t: "项目资源被跳过（除非 defaultProjectTrust 是 always）", ok: true }, { t: "卡在信任提示上" }, { t: "自动信任" }], why: "非交互模式无法弹提示。要明确时用 --approve 或 --no-approve。" },
    { q: "「Trust (this session only)」会：", opts: [{ t: "只对本次运行生效，不写任何文件", ok: true }, { t: "写入 trust.json，有效期一天" }, { t: "信任所有子目录" }], why: "本机实测：选它之后 ~/.pi/agent/trust.json 没有出现。" },
    { q: "defaultTools 写 [\"-bash\", \"+grep\"] 的效果：", opts: [{ t: "在继承的工具里去掉 bash、加上 grep", ok: true }, { t: "只保留 grep" }, { t: "报错，必须写完整列表" }], why: "只含 +/- 的列表做加减；含纯名字的列表替换。" },
    { q: "改了 settings.json，想在当前会话里生效：", opts: [{ t: "/reload", ok: true }, { t: "/new" }, { t: "/compact" }], why: "/reload 重新加载设置、快捷键、扩展、Skill、模板、主题和上下文文件。" },
  ];
  const REVIEW = [
    { q: "（复习 M4）压缩后，被摘要掉的原始记录：", opts: [{ t: "仍在会话文件里", ok: true }, { t: "被删除" }], why: "压缩只追加一条 compaction 记录。" },
    { q: "（复习 M4）你在 M4 实验里用了 --approve。它的作用是：", opts: [{ t: "本次运行信任项目，让项目设置生效", ok: true }, { t: "自动批准每一次工具调用" }], why: "pi 本来就不逐条批准工具调用。--approve 只关于项目信任。本课讲清楚。" },
  ];
  const PRE = [
    { id: "p1", q: "你 clone 了一个陌生仓库，在里面启动 pi，并选择「不信任」。仓库里的 AGENTS.md 会进入请求吗？", opts: [{ t: "会", ok: true }, { t: "不会" }] },
    { id: "p2", q: "全局 compaction 设了两个值，项目只改其中一个。另一个：", opts: [{ t: "保留全局的值", ok: true }, { t: "变回默认值" }] },
    { id: "p3", q: "项目信任会限制 bash 能访问哪些目录吗？", opts: [{ t: "会" }, { t: "不会", ok: true }] },
  ];
  function checkDone() {
    const ok = Store.get(ID, "lab", {}).passed && Store.get(ID, "quiz", { best: 0 }).best >= 8;
    if (ok && !Store.get(ID, "done")) Store.set(ID, "done", true);
  }

  window.Course.register(ID, (page) => {
    const rc = window.Course.recapBlock(ID, {
      pre: PRE,
      next: { id: "M6", title: "模型与提供者", text: "你已经知道设置从哪里来。M6 讲设置里最重要的一项：用哪个模型、经哪个提供者、思考多深，以及怎样接入自己的端点。" },
      extra: () => [["合并预测", MQ.filter((m, i) => m.opts[Store.get(ID, "mq", {})["m" + i]]?.ok).length + " / " + MQ.length]],
    });
    page.append(h("div", { class: "bench" },
      h("header", { class: "mhead" }, h("div", { class: "crumbs" }, "第 3 单元 · 配置 / M5"), h("h1", { class: "mtitle" }, h("span", { class: "mid" }, "M5"), "配置的分层与信任")),
      section("s-hero", 0, "开场", null, configMap(),
        h("div", { class: "col" },
          h("p", { class: "thesis" }, "配置有两层，再加一串上下文文件。", h("br"), "信任只管 .pi 里的东西。"),
          h("p", { class: "lead" }, "pi 每次启动，从三类地方收集配置：你自己的目录、项目的 .pi 目录、沿途每一级目录里的 AGENTS.md。本课让你能准确预测：在任意目录启动时，什么生效、什么被忽略、为什么。")),
        h("div", { class: "panel objectives" },
          h("ol", null,
            h("li", null, "说出用户级和项目级各有哪些文件、各管什么。"),
            h("li", null, "预测设置的合并结果：覆盖、递归合并、列表合并、工具加减。"),
            h("li", null, "预测任一工作目录会加载哪些上下文文件、按什么顺序。"),
            h("li", null, "说出项目信任管什么、不管什么，以及五个选项的区别。"),
            h("li", null, "用 --approve、--no-approve、/trust、/reload 控制生效。")),
          h("div", { class: "obj-side" },
            h("div", null, h("span", { class: "k" }, "时长"), "约 60 分钟"),
            h("div", null, h("span", { class: "k" }, "前置"), "M1"),
            h("div", null, h("span", { class: "k" }, "练习"), "§8 实验 + §9 测验（≥ 8/10）"),
            h("div", null, h("span", { class: "k" }, "核对版本"), "pi 0.99.2"))),
        h("h3", null, "本课路线"),
        route(ID, [["s-pre", 1, "动手", "复习与预测"], ["s-layers", 2, "阅读", "两层文件"], ["s-merge", 3, "动手", "合并解析器"], ["s-ctx", 4, "动手", "上下文文件"], ["s-trust", 5, "动手", "项目信任"], ["s-tools", 6, "阅读", "工具开关"], ["s-apply", 7, "阅读", "让改动生效"], ["s-lab", 8, "实验", "信任前后"], ["s-quiz", 9, "测验", "10 题"], ["s-recap", 10, "阅读", "小结"]])),
      h("div", { class: "col" },
        section("s-pre", 1, "复习与预测", "先复习，再预测",
          todo("两道复习题立即判分；三道预测课末揭晓。"),
          REVIEW.map((r, i) => choice({ id: "r" + i, store: [ID, "rev"], kicker: "复习 " + (i + 1) + " / 2", q: r.q, opts: r.opts, explain: r.why, shuffleSeed: 91 + i * 7 })),
          PRE.map((p, i) => choice({ id: p.id, store: [ID, "pre"], kicker: "预测 " + (i + 1) + " / 3", q: p.q, opts: p.opts, reveal: false, shuffleSeed: 47 + i * 13 }))),
        section("s-layers", 2, "两层文件", "用户级与项目级",
          todo("回到开场的配置地图，逐个点文件读说明。", true),
          h("ul", { class: "rule" },
            h("li", null, h("b", null, "用户级 ~/.pi/agent/："), "你自己的。所有项目共用，总是加载。"),
            h("li", null, h("b", null, "项目级 <项目>/.pi/："), "跟着项目走，可能来自别人。只在你信任这个目录后加载。"),
            h("li", null, h("b", null, "一个例外："), "sessionDir 这一项在信任之前就被读取，因为 pi 要先知道去哪里找会话。")),
          h("div", { class: "note" }, h("span", { class: "k" }, "你本机的全局设置"), "~/.pi/agent/settings.json 里只有 5 项：defaultProvider、defaultModel、defaultThinkingLevel、theme，以及 pi 自动写入的 lastChangelogVersion。其余全部用默认值。")),
        section("s-merge", 3, "合并解析器", "两份设置怎样合成一份",
          todo("先读五条规则；可以在下面的编辑器里改两份 JSON 看结果；然后用规则做六道练习题。"),
          h("ul", { class: "rule" },
            h("li", null, h("b", null, "同名的值："), "项目覆盖全局。"),
            h("li", null, h("b", null, "对象："), "递归合并，项目只覆盖它写到的键。"),
            h("li", null, h("b", null, "资源列表"), "（packages、extensions、skills、prompts、themes）：合并，两边的都加载。"),
            h("li", null, h("b", null, "defaultTools："), "只含 +名 / −名 时在继承的选择上加减；含纯名字时整体替换", h("b", null, "内置"), "工具——扩展带来的工具不受影响。"),
            h("li", null, h("b", null, "前提："), "项目的 .pi 只有在你信任这个项目之后才生效。没被信任时，项目设置整个被忽略，只用全局设置（§5 细讲）。")))),
      h("div", { class: "bench" }, resolver()),
      h("div", { class: "col" },
        MQ.map((m, i) => choice({ id: "m" + i, store: [ID, "mq"], kicker: "练习 " + (i + 1) + " / " + MQ.length, q: m.q, opts: m.opts, explain: m.why, shuffleSeed: 101 + i * 3 })),
        section("s-ctx", 4, "上下文文件", "哪些 AGENTS.md 会被加载",
          todo("在下面的目录模拟器里：切换文件、换工作目录，看右边的加载清单。"),
          h("p", null, "上下文文件不在 .pi 里，规则也不同。下面的规则全部在本机实测过（用一个 a/b/c 三层目录）。"))),
      h("div", { class: "bench" }, finder()),
      h("div", { class: "col" },
        h("div", { class: "note warn" }, h("span", { class: "k" }, "最容易忽略的一点"), "上下文文件不需要信任就会加载。clone 一个陌生仓库，它的 AGENTS.md 立刻进入每一次请求。读它，就像读一段别人写给你的模型的指令。M12 讲怎样防。"),
        h("div", { class: "note" }, h("span", { class: "k" }, "AGENTS.override.md 的用途"), "某个子目录需要和上级不同的说明时，放一个 override，它只替换本目录的 AGENTS.md / CLAUDE.md，不影响其他目录。"),
        section("s-trust", 5, "项目信任", "信任管什么，不管什么",
          todo("点信任提示的五个选项，读每个的效果。"),
          h("p", null, "工作目录（或其父目录的 .agents/skills）里出现受保护的资源时，pi 先问你信不信任："),
          trustPrompt(),
          h("h3", null, "pi 怎样决定"),
          h("ol", { class: "rule", style: { listStyle: "decimal", paddingLeft: "1.4em" } },
            h("li", null, "命令行有 --approve 或 --no-approve：用它。"),
            h("li", null, "否则，你的全局扩展可以处理 project_trust 事件来决定（M10）。"),
            h("li", null, "否则，看 trust.json 里离当前目录最近的那个已保存决定。"),
            h("li", null, "否则，看设置 defaultProjectTrust：默认 ask（弹提示）；可设 always 或 never。")),
          h("div", { class: "panel", style: { overflowX: "auto", marginTop: "12px" } }, h("table", { class: "grow" },
            h("thead", null, h("tr", null, h("th", null, "信任决定"), h("th", null, "管"), h("th", null, "不管"))),
            h("tbody", null, h("tr", null,
              h("td", null, "是否加载 .pi 里的资源"),
              h("td", null, "项目设置、MCP、扩展、Skill、提示模板、主题、系统提示文件、项目包"),
              h("td", null, "AGENTS.md 等上下文文件；工具能访问哪些文件；命令能做什么；仓库里的文字能否误导模型")))))),
        section("s-tools", 6, "工具开关", "决定模型手里有什么",
          todo("读下表。M0 说过：能力 = 工具。这里就是开关。", true),
          h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" }, h("tbody", null,
            [["defaultTools（设置）", "启动时启用的内置工具。默认 read、bash、edit、write。可用 +名 / −名。"], ["--tools a,b,c", "本次运行的完整白名单（含扩展工具）。不接受 +/−。"], ["-nbt", "关掉全部内置工具，保留扩展工具。"], ["-nt", "关掉全部工具：内置的、扩展的都关。"], ["-xt a,b", "最后再排除这几个。"], ["-ne", "不加载扩展（扩展的工具也就没了）。"]].map(([a, b]) => h("tr", null, h("td", { style: { whiteSpace: "nowrap" } }, h("code", null, a)), h("td", null, b)))))),
          h("p", { class: "mute", style: { fontSize: "15px", marginTop: "8px" } }, "可选的内置工具：read、bash、edit、write、grep、find、ls（Windows 上还有 powershell）。codemode 和 tool_search 由内置扩展提供，默认不启用（M11）。")),
        section("s-apply", 7, "让改动生效", "改完配置之后",
          todo("记住这四个命令。", true),
          h("ul", { class: "rule" },
            h("li", null, h("code", null, "/settings"), "：在界面里改常用项，立即生效。"),
            h("li", null, h("code", null, "/reload"), "：手动改了文件后，重新加载设置、快捷键、扩展、Skill、模板、主题、上下文文件。"),
            h("li", null, h("code", null, "/trust"), "：为当前项目保存一个信任决定。"),
            h("li", null, h("code", null, "pi config"), "：在终端里查看和开关各个包提供的资源。"))),
        section("s-lab", 8, "实验", "同一个目录，信任前后",
          todo("按第 1–4 步操作。全部在终端里完成。"),
          h("p", null, "你会建一个三层目录，然后在最里层分别以「不信任」和「信任」各跑一次，比较工具清单和上下文文件。"),
          h("div", { class: "note" }, h("span", { class: "k" }, "实验规则"), "只在 ~/pi-lab/m5 里做；--no-session 不留会话；--approve / --no-approve 不写 trust.json；最后清理。"),
          lab()),
        section("s-quiz", 9, "掌握测验", "10 题，8 题过关", todo("10 题全部作答，点「交卷」。"), window.Course.quizBlock(ID, QUIZ, checkDone)),
        section("s-recap", 10, "小结", "你学到了什么",
          todo("看自己的预测和成绩。觉得学会了，就在本节最后点「标记为已完成」。", true),
          h("p", { class: "lead" }, "一句话：项目覆盖全局、对象递归合并、资源列表相加；上下文文件从全局到工作目录逐级加载、每目录一个、与信任无关；信任只决定 .pi 里的东西。"),
          rc))));
    return () => rc._cleanup && rc._cleanup();
  });
})();
