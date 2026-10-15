/* M5 · 配置的分层与信任 */
(function () {
  "use strict";
  const { h, section, quizBlock, lessonHead, look, howto, endBlock } = window.Course;
  const ID = "M5";

  // ================= §2 merge resolver =================
  const RES = new Set(["packages", "extensions", "skills", "prompts", "themes"]);
  function mergeSettings(u, p) {
    const val = {}, src = {};
    for (const k of new Set([...Object.keys(u || {}), ...Object.keys(p || {})])) {
      const a = u ? u[k] : undefined, b = p ? p[k] : undefined;
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
        const note = s[k] === "p" ? "  ← 项目" : s[k] === "up" ? "  ← 两边合并" : "  ← 全局";
        out.push(h("div", { class: s[k] === "u" ? "u" : "p" }, pad + JSON.stringify(k) + ": " + JSON.stringify(v[k]) + comma, h("span", { class: "d" }, note)));
      }
    });
    return out;
  }
  function resolver() {
    const uTa = h("textarea", { id: "m5-user", spellcheck: "false", "aria-label": "全局设置" }), pTa = h("textarea", { id: "m5-proj", spellcheck: "false", "aria-label": "项目设置" });
    uTa.value = JSON.stringify({ defaultModel: "gpt-6-astra", defaultThinkingLevel: "medium", compaction: { reserveTokens: 16384, keepRecentTokens: 20000 }, skills: ["~/my-skills"] }, null, 2);
    pTa.value = JSON.stringify({ defaultThinkingLevel: "high", compaction: { keepRecentTokens: 5000 }, skills: ["./skills"] }, null, 2);
    const trust = h("input", { type: "checkbox", id: "m5-trust", checked: true });
    const eff = h("div", { class: "eff" }), msg = h("div", { class: "mute", style: { fontSize: "15px" } });
    function run() {
      let u, p, ok = true;
      try { u = JSON.parse(uTa.value || "{}"); uTa.classList.remove("bad"); } catch (e) { uTa.classList.add("bad"); ok = false; }
      try { p = JSON.parse(pTa.value || "{}"); pTa.classList.remove("bad"); } catch (e) { pTa.classList.add("bad"); ok = false; }
      if (!ok) { msg.textContent = "JSON 格式有误（红框）。"; return; }
      const r = mergeSettings(u, trust.checked ? p : {});
      eff.replaceChildren(h("div", null, "{"), ...renderEff(r.value, r.src, 1), h("div", null, "}"));
      msg.textContent = trust.checked ? "项目已被信任：项目设置参与合并。" : "项目没有被信任：项目的设置整个被忽略。";
    }
    [uTa, pTa].forEach((t) => t.addEventListener("input", run)); trust.addEventListener("change", run);
    run();
    return h("div", { class: "panel merge" },
      h("div", { class: "pane" }, h("b", { class: "r-user" }, "全局 ~/.pi/agent/settings.json"), uTa),
      h("div", { class: "pane" }, h("b", { class: "r-model" }, "项目 .pi/settings.json"), pTa, h("label", { class: "toggle", for: "m5-trust" }, trust, "信任这个项目")),
      h("div", { class: "pane" }, h("b", null, "最终生效的设置"), eff, msg));
  }

  // ================= §3 context files =================
  const DIRS = ["~/.pi/agent", "/", "/home/me", "/home/me/proj", "/home/me/proj/pkg", "/home/me/proj/pkg/api"];
  const KINDS = ["AGENTS.override.md", "AGENTS.md", "CLAUDE.md"];
  function finder() {
    let cwd = 5;
    const has = { "~/.pi/agent": { "AGENTS.md": 1 }, "/home/me/proj": { "AGENTS.md": 1, "CLAUDE.md": 1 }, "/home/me/proj/pkg": { "AGENTS.override.md": 1, "AGENTS.md": 1 }, "/home/me/proj/pkg/api": {} };
    const tree = h("div", { class: "tree" }), list = h("ol"), note = h("div", { class: "mute", style: { fontSize: "15px" } });
    const pick = (d) => { const f = has[d] || {}; return KINDS.find((k) => f[k]) || null; };
    function paint() {
      tree.replaceChildren(h("div", { class: "mute", style: { fontSize: "15px" } }, "点文件名切换「有 / 没有」；点后三个目录名，把它设为启动目录。"),
        ...DIRS.map((d, i) => {
          if (i > 0 && i > cwd) return null;
          const used = pick(d);
          return h("div", { class: "drow" + (i === cwd ? " cwd" : "") },
            h("span", { class: "p", style: { cursor: i > 2 ? "pointer" : "default" }, onclick: () => { if (i > 2) { cwd = i; paint(); } } }, d + (i === cwd ? "　← 启动目录" : "")),
            h("span", { class: "fl" }, KINDS.map((k) => h("button", { "aria-pressed": (has[d] || {})[k] ? "true" : "false", class: used === k ? "used" : "", onclick: () => { (has[d] ||= {})[k] = has[d][k] ? 0 : 1; paint(); } }, k.replace(".md", "")))));
        }).filter(Boolean),
        h("div", { class: "drow", style: { opacity: 0.5 } }, h("span", { class: "p" }, DIRS.slice(cwd + 1).join("  ") || "（没有更深的目录）"), h("span", { class: "mute", style: { fontSize: "15px" } }, "启动目录以下：不读")));
      const got = [DIRS[0], ...DIRS.slice(1, cwd + 1)].map((d) => [d, pick(d)]).filter(([, f]) => f);
      list.replaceChildren(...got.map(([d, f]) => h("li", null, (d === "/" ? "" : d) + "/" + f)));
      note.textContent = got.length ? "按这个顺序放进系统提示，越往后越具体。" : "一个都没有。";
    }
    paint();
    return h("div", { class: "panel dirs" }, tree, h("div", { class: "loaded" }, h("b", null, "会加载的说明文件"), list, note));
  }

  const QUIZ = [
    { q: "全局设置的思考强度是 medium，项目设置是 high，项目已被信任。生效的是？", opts: [{ t: "high", ok: true }, { t: "medium" }], why: "项目设置覆盖全局设置。" },
    { q: "同上，但你没有信任这个项目。生效的是？", opts: [{ t: "medium", ok: true }, { t: "high" }], why: "不信任时，项目的 .pi 里的设置整个被忽略。" },
    { q: "你 clone 了一个陌生仓库，启动 pi 时选了「不信任」。仓库里的 AGENTS.md 还会进入请求吗？", opts: [{ t: "会", ok: true }, { t: "不会" }], why: "AGENTS.md 这类说明文件不受项目信任控制，总会加载（除非用 -nc 关掉）。读陌生仓库时要先看看它写了什么。" },
    { q: "项目信任能防住什么？", opts: [{ t: "不信任时，项目里的扩展代码不会运行", ok: true }, { t: "防止 bash 访问项目外的文件" }, { t: "防止模型读到项目里的文字" }], why: "信任只决定是否加载 .pi 里的东西。工具仍用你的权限运行，文件内容照样能被读到（第 13 课讲怎么防）。" },
    { q: "手动改了 settings.json，想让当前会话立刻用上：", opts: [{ t: "/reload", ok: true }, { t: "/new" }, { t: "/compact" }], why: "/reload 重新加载设置、快捷键、扩展、Skill、提示模板和说明文件，不丢当前对话。" },
  ];

  window.Course.register(ID, (page) => {
    page.append(h("div", { class: "col" },
      lessonHead(ID, [
        h("p", null, "pi 的行为由一堆配置决定：用哪个模型、开哪些工具、加载哪些说明和扩展、什么时候压缩。这些配置来自三个地方：你自己的配置目录、项目里的 .pi 目录、项目沿途各级目录里的 AGENTS.md。"),
        h("p", null, "同一个 pi，在不同目录里启动，表现可能完全不同。这一课讲每个地方管什么、冲突时谁说了算，以及打开别人的项目时，「项目信任」能保护你什么。"),
      ], [
        "三个配置来源各放什么、什么时候加载。",
        "全局设置和项目设置冲突时，最终用哪个。",
        "项目信任管什么、不管什么。",
      ]),

      section("s-layers", 1, "来源", "配置从三个地方来",
        h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" },
          h("thead", null, h("tr", null, h("th", null, "位置"), h("th", null, "是什么"), h("th", null, "什么时候加载"))),
          h("tbody", null,
            h("tr", null, h("td", { style: { whiteSpace: "nowrap" } }, h("code", null, "~/.pi/agent/")), h("td", null, "全局配置，你自己的，所有项目共用。"), h("td", null, "总是加载。")),
            h("tr", null, h("td", { style: { whiteSpace: "nowrap" } }, h("code", null, "<项目>/.pi/")), h("td", null, "项目配置，跟着项目走，可能是别人写的。"), h("td", null, h("b", null, "你信任这个项目之后"), "才加载（§4）。")),
            h("tr", null, h("td", { style: { whiteSpace: "nowrap" } }, h("code", null, "AGENTS.md")), h("td", null, "说明文件，放在全局目录、项目目录或它的上级目录里。"), h("td", null, h("b", null, "总是加载"), "，不需要信任（§3）。"))))),
        howto("全局目录 ~/.pi/agent/ 里的主要文件", [
          ["settings.json", "设置：默认模型、思考强度、工具、压缩等。"],
          ["AGENTS.md", "对所有项目都适用的说明（第 8 课）。"],
          ["models.json", "自定义模型和兼容端点（第 7 课）。"],
          ["auth.json", "/login 保存的密钥和登录凭证。不要分享。"],
          ["keybindings.json", "自定义快捷键。"],
          ["extensions/  skills/  prompts/", "全局的扩展、Skill、提示模板（第 8–12 课）。"],
        ]),
        howto("项目目录 .pi/ 里可以放的东西", [
          ["settings.json", "项目设置，覆盖全局设置（§2）。"],
          ["extensions/", "项目扩展：会在 pi 里运行的代码。最需要信任。"],
          ["skills/  prompts/", "项目的 Skill 和提示模板。"],
          ["mcp.json", "项目要连接的 MCP 服务器（第 12 课）。"],
        ])),

      section("s-merge", 2, "合并", "全局和项目冲突时，谁说了算",
        h("p", null, "全局和项目的 settings.json 会合成一份，规则只有三条："),
        h("ul", { class: "rule" },
          h("li", null, h("b", null, "同一项："), "项目的覆盖全局的。"),
          h("li", null, h("b", null, "成组的设置（例如 compaction 下的几项）："), "逐项合并，项目只覆盖它写到的那几项，其余保留全局的值。"),
          h("li", null, h("b", null, "资源列表（skills、extensions、prompts 等）："), "两边的合在一起，都加载。")),
        look("右栏是最终生效的设置，每一行标着它来自哪里。可以直接改左边两份设置试试，也可以取消「信任这个项目」看看。")),
      h("div", { class: "bench" }, resolver()),

      section("s-ctx", 3, "说明文件", "哪些 AGENTS.md 会被加载",
        h("p", null, "AGENTS.md 是写给模型看的说明（第 8 课细讲怎么写）。pi 启动时按下面的规则收集它们，拼进系统提示："),
        h("ul", { class: "rule" },
          h("li", null, "先读全局目录里的，然后从根目录开始，一级一级往下读，直到启动目录。启动目录下面的子目录不读。"),
          h("li", null, "每个目录只取一个文件，优先级是 AGENTS.override.md > AGENTS.md > CLAUDE.md。所以想让某个子目录用不同的说明，就在那里放一个 AGENTS.override.md。"),
          h("li", null, "不需要项目信任。用 ", h("code", null, "pi -nc"), " 可以一个都不加载。")),
        look("换几个启动目录，或者切换某个文件的有无，看右边的加载清单怎么变。")),
      h("div", { class: "bench" }, finder()),
      h("div", { class: "note warn", style: { marginTop: "18px" } }, h("span", { class: "k" }, "陌生仓库要小心"), "clone 一个别人的仓库，它的 AGENTS.md 会立刻进入每一次请求，不管你信不信任这个项目。读它，就像读一段别人写给你的模型的指令。"),

      section("s-trust", 4, "项目信任", "项目信任管什么、不管什么",
        h("p", null, "项目里的 .pi 可能带着扩展代码，加载它就等于运行别人的程序。所以当启动目录里有 .pi/settings.json、.pi/extensions/ 这类内容时，pi 会先问你：Trust project folder?"),
        howto("可选的回答", [
          ["Trust", "信任这个目录，并记下来，以后不再问。子目录也算信任。"],
          ["Trust parent folder", "把信任记在上一级目录，适合一个目录下有很多自己的项目。"],
          ["Trust (this session only)", "只信任这一次，不记下来。"],
          ["Do not trust", "不信任，并记下来。以后项目的 .pi 都被忽略，也不再问。"],
          ["Do not trust (this session only)", "这一次不信任，不记下来。"],
        ], "决定保存在 ~/.pi/agent/trust.json。之后想改，在项目里输入 /trust。"),
        h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" },
          h("thead", null, h("tr", null, h("th", null, "信任决定的"), h("th", null, "信任不决定的"))),
          h("tbody", null, h("tr", null,
            h("td", null, "是否加载项目 .pi 里的东西：设置、扩展、Skill、提示模板、MCP 服务器、系统提示文件。"),
            h("td", null, "AGENTS.md 等说明文件（总会加载）；工具能访问哪些文件、命令能做什么（始终用你的权限）；项目里的文字会不会误导模型。"))))),
        h("p", { style: { marginTop: "14px" } }, "所以信任只防一件事：别人的项目悄悄在你的电脑上运行代码。它不是安全边界，真正的边界在第 13 课。")),

      section("s-keys", 5, "速查", "配置速查",
        howto("命令", [
          ["/settings", "在界面里改常用设置，立即生效。"],
          ["/reload", "手动改了配置文件后，重新加载，不丢当前对话。"],
          ["/trust", "改变当前项目的信任决定。"],
          ["pi --approve / --no-approve", "这一次运行信任 / 不信任项目，不记下来。在脚本里很有用：脚本模式没法弹出询问，不加这个参数时默认不信任。"],
          ["pi -nc", "这一次不加载任何 AGENTS.md。"],
        ])),

      section("s-quiz", 6, "检查", "检查一下", quizBlock(ID, QUIZ, null, null)),

      section("s-end", 7, "小结", "小结",
        endBlock(ID, [
          "配置来自三处：全局 ~/.pi/agent/（总加载）、项目 .pi/（信任后才加载）、各级目录的 AGENTS.md（总加载）。",
          "设置冲突时项目覆盖全局，成组的设置逐项合并，资源列表合在一起。",
          "项目信任只决定是否加载 .pi 里的东西，防的是别人的扩展代码；它不限制工具，也挡不住 AGENTS.md。",
        ], { id: "M6", text: "设置里最重要的一项：用哪个模型、通过哪家提供者、思考多深。" }))));
  });
})();
