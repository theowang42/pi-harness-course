/* M11 · MCP、codemode 与包 */
(function () {
  "use strict";
  const { h, $, $$, Store, choice, copyBlock, section, todo, route, term } = window.Course;
  const ID = "M11";
  const fmt = (n) => Math.round(n).toLocaleString("en-US");

  const MCP_PY = `import json, sys

ANIMALS = "鼠牛虎兔龙蛇马羊猴鸡狗猪"
TOOLS = [{
    "name": "zodiac",
    "description": "查询某个公历年份对应的生肖（按农历年粗略计算）。",
    "inputSchema": {"type": "object", "properties": {"year": {"type": "integer", "description": "公历年份，例如 2026"}}, "required": ["year"]},
}]

def reply(id, result):
    sys.stdout.write(json.dumps({"jsonrpc": "2.0", "id": id, "result": result}, ensure_ascii=False) + "\\n")
    sys.stdout.flush()

for line in sys.stdin:                      # MCP 的 stdio 传输：每行一条 JSON-RPC 消息
    msg = json.loads(line)
    method, id = msg.get("method"), msg.get("id")
    if method == "initialize":
        reply(id, {"protocolVersion": msg["params"]["protocolVersion"], "capabilities": {"tools": {}},
                   "serverInfo": {"name": "zodiac", "version": "1.0"}, "instructions": "提供生肖查询。"})
    elif method == "tools/list":
        reply(id, {"tools": TOOLS})
    elif method == "tools/call":
        year = msg["params"]["arguments"]["year"]
        reply(id, {"content": [{"type": "text", "text": f"{year} 年是{ANIMALS[(year - 4) % 12]}年。"}]})
    elif id is not None:                    # 其他请求（例如 ping）：回一个空结果
        reply(id, {})`;

  // ================= §0 hero: codemode vs direct, real runs =================
  const RUNS = {
    codemode: { reqs: [5818, 5921, 6037, 6163], decl: "read, bash, edit, write, 3 个联网工具, codemode", scripts: [
      ['text(await describeNamespace("mcp__zodiac"));\ntext(await searchTools("生肖 年份", {namespace:"mcp__zodiac"}));', "第 1 轮：这个服务器有什么？"],
      ['text(await describeTool("mcp__zodiac__zodiac"));', "第 2 轮：这个工具的参数是什么？"],
      ['text(await Promise.allSettled([tools.mcp__zodiac__zodiac({year:2026}), tools.mcp__zodiac__zodiac({year:1990})]));', "第 3 轮：并行调用两次"],
    ] },
    direct: { reqs: [2747, 2855], decl: "read, bash, edit, write, 3 个联网工具, mcp__zodiac__zodiac", scripts: [
      ["mcp__zodiac__zodiac({year: 2026})\nmcp__zodiac__zodiac({year: 1990})", "第 1 轮：一条回复里直接调用两次"],
    ] },
  };
  function hero() {
    const max = 6200;
    const col = (k, title, sub) => {
      const r = RUNS[k];
      return h("div", { class: "side2" }, h("h4", null, title), h("div", { class: "sub" }, sub),
        h("div", { class: "mute", style: { fontSize: "15px" } }, "声明给模型的工具：" + r.decl),
        h("div", { class: "reqbars" }, r.reqs.map((v, i) => h("div", { class: "reqbar" }, h("span", null, "请求 " + (i + 1)), h("div", { class: "b", style: { width: (v / max) * 100 + "%" } }), h("span", { class: "v" }, fmt(v))))),
        r.scripts.map(([code, lbl]) => h("div", { class: "script" }, h("span", { class: "lbl" }, lbl), code)),
        h("div", { style: { marginTop: "10px", fontWeight: 700 } }, "答案：2026 和 1990 都是马年。"));
    };
    return h("div", { class: "panel" },
      h("div", { class: "panel-h" }, h("span", null, "同一个 MCP 服务器、同一个问题、两种暴露方式 · 本机实测"), h("span", null, "条形 = 每次请求的上下文 token")),
      h("div", { class: "expo" }, col("codemode", "codemode（pi 的默认）", "MCP 工具不直接声明；模型写脚本去找、去调"), col("direct", "direct", "MCP 工具像内置工具一样直接声明")));
  }

  // ================= §2 rpc flow =================
  function rpcFlow() {
    const rows = [
      ['{"method":"initialize", …}', "→", '{"result":{"capabilities":{"tools":{}}, "instructions":"提供生肖查询。"}}'],
      ['{"method":"tools/list"}', "→", '{"result":{"tools":[{"name":"zodiac", "inputSchema":…}]}}'],
      ['{"method":"tools/call", "params":{"name":"zodiac", "arguments":{"year":2026}}}', "→", '{"result":{"content":[{"type":"text","text":"2026 年是马年。"}]}}'],
    ];
    return h("div", { class: "panel" }, h("div", { class: "rpc" }, h("div", { class: "hd" }, "pi 写到服务器的 stdin"), h("div"), h("div", { class: "hd" }, "服务器写到 stdout"),
      ...rows.flatMap(([a, m, b]) => [h("div", { class: "l" }, a), h("div", { class: "m" }, "每行一条"), h("div", { class: "r" }, b)])));
  }

  const EXPO = [
    { q: "你只接了一个小服务器，它有 2 个常用工具。", opts: [{ t: "direct", ok: true }, { t: "codemode（默认）" }, { t: "hidden" }], why: "本机实测：direct 第一次请求 2,747 token、2 次请求；codemode 5,818 token、4 次请求。工具少时 direct 更省。" },
    { q: "你接了 6 个服务器，合计 120 个工具，每次只用其中几个。", opts: [{ t: "codemode（默认）", ok: true }, { t: "全部 direct" }], why: "120 个工具全部声明，每轮都付费（M1）。codemode 的固定成本约 3,000 token，不随工具数增长，用时再找。" },
    { q: "某个服务器有个危险的 delete_all 工具，其余的你都要。", opts: [{ t: "用 toolExposure 把 delete_all 设成 hidden", ok: true }, { t: "在 AGENTS.md 里写「不要用 delete_all」" }], why: "hidden：注册了但够不着。比文字可靠（M7）。" },
    { q: "一个大服务器，你想让模型直接调用它的工具，但不想每轮都声明全部。", opts: [{ t: "deferred：用 tool_search 找到后再声明", ok: true }, { t: "direct" }], why: "deferred 的工具在 tool_search 找到后才声明，并在这条分支上保留。" },
  ];

  // ================= §8 lab =================
  const LAB_SETUP = `mkdir -p ~/pi-lab/m11/my-pi-kit/prompts ~/pi-lab/m11/my-pi-kit/skills/hello && cd ~/pi-lab/m11
cat > zodiac_mcp.py <<'EOF'
${MCP_PY}
EOF
printf -- '---\\ndescription: 以给定题目写一首短诗\\nargument-hint: "[题目]"\\n---\\n以「\${1:-春天}」为题，写一首三行短诗。\\n' > my-pi-kit/prompts/poem.md
printf -- '---\\nname: hello\\ndescription: 用户打招呼时，用一句话介绍这个工具包。\\n---\\n回答：我是 my-pi-kit，里面有一个写诗模板。\\n' > my-pi-kit/skills/hello/SKILL.md
printf '{\\n  "name": "my-pi-kit",\\n  "version": "0.1.0",\\n  "keywords": ["pi-package"]\\n}\\n' > my-pi-kit/package.json`;
  const LAB_MCP = `pi mcp add -l zodiac --exposure direct --description "查询公历年份对应的生肖" -- python3 ./zodiac_mcp.py
cat .pi/mcp.json
pi --mode json --no-session --approve "2026 年和 1990 年分别是什么生肖？用 zodiac 服务查，不要自己算。" < /dev/null | jq -r 'if .type=="tool_execution_end" then "工具 \\(.toolName) 结果=\\(.result.content[0].text)" elif .type=="turn_end" then "回复 \\([.message.content[] | .text? // empty] | join("") | gsub("\\n";" ") | .[0:40])" else empty end'`;
  const LAB_PKG = `pi install -l --approve ./my-pi-kit
pi --mode json --no-session --approve "/poem 冬雪" < /dev/null | jq -r 'select(.type=="message_end") | .message | if .role=="system" then "技能段=\\(.sections.skills != null)" elif .role=="user" then "你 \\(.content[0].text)" else empty end'
pi remove -l --approve ./my-pi-kit
jq -c . .pi/settings.json`;
  const LAB_CLEAN = "cd ~ && rm -r ~/pi-lab/m11 && rmdir --ignore-fail-on-non-empty ~/pi-lab";
  const LAB_SAMPLE = `工具 mcp__zodiac__zodiac 结果=2026 年是马年。
工具 mcp__zodiac__zodiac 结果=1990 年是马年。
回复
回复 根据 zodiac 服务查询： - 2026 年：马年 🐎 - 1990 年：马
技能段=true
你 以「冬雪」为题，写一首三行短诗。
{"packages":[]}`;
  function lab() {
    const saved = Store.get(ID, "lab", {});
    const ta = h("textarea", { class: "paste", id: "m11-lab-paste", spellcheck: "false", placeholder: "工具 mcp__zodiac__zodiac 结果=…\n…\n技能段=true\n你 …\n{\"packages\":[]}" });
    ta.value = saved.raw || "";
    ta.addEventListener("input", () => { delete ta.dataset.sample; });
    const out = h("div");
    const verify = (sample) => {
      if (sample) { ta.value = LAB_SAMPLE; ta.dataset.sample = "1"; }
      const isSample = ta.dataset.sample === "1";
      const L = ta.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      const checks = [
        [L.some((l) => /^工具 mcp__zodiac__zodiac 结果=2026 年是马年/.test(l)) && L.some((l) => /^工具 mcp__zodiac__zodiac 结果=1990 年是马年/.test(l)), "模型直接调用了 mcp__zodiac__zodiac，两次都拿到了结果"],
        [L.some((l) => /^回复 .*马/.test(l)), "回复里给出了答案"],
        [L.some((l) => l === "技能段=true"), "装上包后，包里的 Skill 进入了系统提示"],
        [L.some((l) => /^你 以「冬雪」为题/.test(l)), "包里的提示模板 /poem 正确展开"],
        [L.some((l) => l.replace(/\s/g, "") === '{"packages":[]}'), "卸载后，项目设置里的包声明清空了"],
      ];
      const ok = checks.every((c) => c[0]);
      if (ok && !isSample) { Store.set(ID, "lab", { raw: ta.value, passed: true }); checkDone(); }
      out.replaceChildren(h("ul", { class: "check-list" }, checks.map(([o, t]) => h("li", null, h("span", { class: o ? "ok" : "no" }, o ? "✓" : "✗"), t))),
        ok ? h("div", { class: "note" }, h("span", { class: "k" }, isSample ? "示例数据" : "实验通过"), isSample ? "示例数据全部满足条件，但不计入实验。请用你自己的运行再做一次。" : "你接入了一个自己写的 MCP 服务器，并把三种资源打成包装上又卸下。最后一步：清理。")
          : h("div", { class: "note warn" }, h("span", { class: "k" }, "没有全部通过"), "MCP 一项不对：确认 python3 可用、第 2 步在 ~/pi-lab/m11 里运行。包一项不对：确认第 3 步的命令都带了 --approve。"));
    };
    if (saved.raw) setTimeout(() => verify(false), 0);
    return h("div", { class: "lab-steps" },
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "建实验目录：一个 MCP 服务器，一个本地包（一个模板、一个 Skill）。"), copyBlock(LAB_SETUP))),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "把 MCP 服务器加进项目（direct 方式），问一个需要它的问题。"),
        h("p", { class: "dim", style: { margin: "4px 0 0" } }, "pi mcp add -l 写入项目的 .pi/mcp.json。项目未被信任，所以运行时要加 --approve（只对本次生效，不写 trust.json）。一次很小的模型调用。"), copyBlock(LAB_MCP))),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "装上本地包，用它的模板，再卸载。"),
        h("p", { class: "dim", style: { margin: "4px 0 0" } }, "项目里已经有 .pi/mcp.json（受保护的资源），所以改项目的包配置也要 --approve。本地包原地加载，卸载只删声明，不删目录。一次很小的模型调用。"), copyBlock(LAB_PKG))),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "把第 2、3 步的 jq 输出粘贴进来，核对。"), h("p", { class: "dim", style: { margin: "4px 0 0" } }, "只需要以「工具」「回复」「技能段」「你」开头的行，和最后的 {\"packages\":[]}。其他行（cat 的输出、安装提示）可以一起贴，不影响核对。"), h("div", { style: { marginTop: "8px" } }, ta),
        h("div", { style: { display: "flex", gap: "8px", marginTop: "8px" } }, h("button", { class: "btn primary", onclick: () => verify(false) }, "核对我的运行"), h("button", { class: "btn ghost", onclick: () => verify(true) }, "先用示例数据试试")), out)),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "清理。"), copyBlock(LAB_CLEAN))));
  }

  // ================= quiz / review / recap =================
  const QUIZ = [
    { q: "MCP 服务器通过 stdio 和 pi 通信时，交换的是：", opts: [{ t: "每行一条 JSON-RPC 消息", ok: true }, { t: "HTTP 请求" }, { t: "pi 的扩展 API 调用" }], why: "本课那 40 行 Python 就是这样：读一行、回一行。" },
    { q: "MCP 工具在 pi 里的名字格式是：", opts: [{ t: "mcp__服务器__工具", ok: true }, { t: "服务器.工具" }, { t: "工具名原样" }], why: "实测：mcp__zodiac__zodiac。" },
    { q: "pi 默认（codemode 暴露）时，MCP 工具会直接声明给模型吗？", opts: [{ t: "不会。模型通过 codemode 脚本去找、去调", ok: true }, { t: "会" }], why: "实测：系统提示里只有一段 mcp_servers 说明，声明的是 codemode 工具。" },
    { q: "本机实测，一个小服务器用 codemode 比用 direct：", opts: [{ t: "第一次请求大一倍，多了两轮探索", ok: true }, { t: "更省" }, { t: "完全一样" }], why: "5,818 vs 2,747 token；4 次请求 vs 2 次。" },
    { q: "codemode 适合什么情况？", opts: [{ t: "工具很多、每次只用少数几个，或需要组合、过滤大量结果", ok: true }, { t: "只有一两个工具" }, { t: "所有情况" }], why: "它的固定成本不随工具数增长；脚本还能并行调用、只把需要的结果交给模型。" },
    { q: "项目的 .pi/mcp.json 在项目未被信任时：", opts: [{ t: "被忽略；pi mcp list 也会提示它被忽略", ok: true }, { t: "照常连接" }], why: "实测提示：…mcp.json is ignored because the project is not trusted。" },
    { q: "pi install ./my-pi-kit（不加 -l）会写到哪里？", opts: [{ t: "~/.pi/agent/settings.json 的 packages", ok: true }, { t: "项目的 .pi/settings.json" }, { t: "把包复制进 ~/.pi" }], why: "默认是个人级；-l 才写项目级。本地包原地加载，不复制。" },
    { q: "扩展需要第三方 npm 依赖时，pi 自带的包（如 @earendil-works/pi-coding-agent、typebox）应该：", opts: [{ t: "写进 peerDependencies，范围 \"*\"，不打包", ok: true }, { t: "写进 dependencies 一起打包" }], why: "打包一份副本会绕过 pi 的模块映射，造成重复实例。pi 会对这种配置报警告。" },
    { q: "实测：项目里已有 .pi/mcp.json 时，pi install -l 不加 --approve：", opts: [{ t: "被拒绝：Project is not trusted", ok: true }, { t: "照常安装" }], why: "修改受保护项目的配置也需要信任。" },
    { q: "装一个陌生人的包之前，最重要的一步：", opts: [{ t: "读它的源码：扩展是用你的权限运行的代码", ok: true }, { t: "看下载量" }, { t: "什么都不用做" }], why: "包能带扩展（代码）和 Skill（能指挥模型运行程序）。用版本号锁定，升级前再看一遍。" },
  ];
  const REVIEW = [
    { q: "（复习 M10）tool_call 返回 block 后，模型收到什么？", opts: [{ t: "一条错误的工具结果，内容是 reason", ok: true }, { t: "什么都收不到" }], why: "MCP 工具同样经过 tool_call / tool_result，守卫对它们一样有效。" },
    { q: "（复习 M1）工具定义会占用每次请求的上下文吗？", opts: [{ t: "会", ok: true }, { t: "不会" }], why: "这就是本课 codemode 和 direct 的取舍所在。" },
  ];
  const PRE = [
    { id: "p1", q: "写一个能被 pi 使用的 MCP 服务器，大约要多少行代码？", opts: [{ t: "几十行", ok: true }, { t: "几千行" }] },
    { id: "p2", q: "接一个只有一个工具的 MCP 服务器，pi 默认会把这个工具直接声明给模型吗？", opts: [{ t: "会" }, { t: "不会", ok: true }] },
    { id: "p3", q: "把扩展、Skill、模板打成「包」，需要什么？", opts: [{ t: "一个带 package.json 的普通目录", ok: true }, { t: "必须发布到 npm" }] },
  ];
  function checkDone() {
    const ok = Store.get(ID, "lab", {}).passed && Store.get(ID, "quiz", { best: 0 }).best >= 8;
    if (ok && !Store.get(ID, "done")) Store.set(ID, "done", true);
  }

  window.Course.register(ID, (page) => {
    const rc = window.Course.recapBlock(ID, {
      pre: PRE,
      next: { id: "M12", title: "安全边界", text: "扩展、MCP、包都在用你的权限运行，守卫挡不住所有等价写法。M12 回答：怎样把 pi 关进一个它够不着外面的边界里。" },
      extra: () => [["暴露方式", EXPO.filter((x, i) => x.opts[Store.get(ID, "expo", {})["e" + i]]?.ok).length + " / " + EXPO.length]],
    });
    page.append(h("div", { class: "bench" },
      h("header", { class: "mhead" }, h("div", { class: "crumbs" }, "第 4 单元 · 扩展 / M11"), h("h1", { class: "mtitle" }, h("span", { class: "mid" }, "M11"), "MCP、codemode 与包")),
      section("s-hero", 0, "开场", null, hero(),
        h("div", { class: "col" },
          h("p", { class: "thesis" }, "工具多了，声明它们本身就很贵。", h("br"), "pi 默认让模型按需去找。"),
          h("p", { class: "lead" }, "本课讲能力阶梯的最后一级：用别人写好的工具（MCP），以及把你的工具打包分享。上面是本机实测的一个关键取舍——同一个服务器，两种暴露方式，代价相差一倍。")),
        h("div", { class: "panel objectives" },
          h("ol", null,
            h("li", null, "说出 MCP 是什么，以及一个 MCP 服务器最少要实现什么。"),
            h("li", null, "用 pi mcp add / list / remove 和 mcp.json 管理服务器。"),
            h("li", null, "在 codemode、deferred、direct、hidden 之间做选择，并说出代价。"),
            h("li", null, "读懂 codemode 脚本在做什么。"),
            h("li", null, "把扩展、Skill、模板打成包，装进项目再卸下。")),
          h("div", { class: "obj-side" },
            h("div", null, h("span", { class: "k" }, "时长"), "约 70 分钟"),
            h("div", null, h("span", { class: "k" }, "前置"), "M10"),
            h("div", null, h("span", { class: "k" }, "练习"), "§8 实验 + §9 测验（≥ 8/10）"),
            h("div", null, h("span", { class: "k" }, "核对版本"), "pi 0.99.2 · MCP stdio"))),
        h("h3", null, "本课路线"),
        route(ID, [["s-pre", 1, "动手", "复习与预测"], ["s-mcp", 2, "阅读", "MCP 是什么"], ["s-cfg", 3, "阅读", "配置与命令"], ["s-expo", 4, "动手", "暴露方式"], ["s-code", 5, "阅读", "codemode"], ["s-pkg", 6, "阅读", "包"], ["s-review", 7, "阅读", "装别人的东西"], ["s-lab", 8, "实验", "MCP 与包"], ["s-quiz", 9, "测验", "10 题"], ["s-recap", 10, "阅读", "小结"]])),
      h("div", { class: "col" },
        section("s-pre", 1, "复习与预测", "先复习，再预测",
          todo("两道复习题立即判分；三道预测课末揭晓。"),
          REVIEW.map((r, i) => choice({ id: "r" + i, store: [ID, "rev"], kicker: "复习 " + (i + 1) + " / 2", q: r.q, opts: r.opts, explain: r.why, shuffleSeed: 211 + i * 7 })),
          PRE.map((p, i) => choice({ id: p.id, store: [ID, "pre"], kicker: "预测 " + (i + 1) + " / 3", q: p.q, opts: p.opts, reveal: false, shuffleSeed: 107 + i * 13 }))),
        section("s-mcp", 2, "MCP 是什么", "一个通用的工具插座",
          todo("读三次消息往来，再读下面这个完整的服务器。", true),
          h("p", null, "Model Context Protocol 是一个开放协议：任何程序只要按它说话，就能把工具提供给任何支持它的 agent（pi、Claude Code、Cursor……）。你写一次，到处能用。"),
          h("p", null, "最少需要三步对话："),
          rpcFlow(),
          h("pre", { class: "panel", style: { padding: "14px 16px", fontSize: "15px", overflowX: "auto", marginTop: "14px" } }, MCP_PY),
          h("p", { class: "mute", style: { fontSize: "15px" } }, "本机实测可用。真实的服务器通常用官方 SDK（Python、TypeScript 等）来写，但底层就是这几条消息。除了 stdio，MCP 也可以走 HTTP（streamable HTTP），适合远程服务和需要 OAuth 登录的服务。")),
        section("s-cfg", 3, "配置与命令", "把服务器接进 pi",
          todo("读命令表和配置规则。", true),
          h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" }, h("tbody", null,
            [["pi mcp add 名字 -- 命令 参数…", "加一个 stdio 服务器（默认写 ~/.pi/agent/mcp.json；-l 写项目的 .pi/mcp.json）"], ["pi mcp add 名字 --url https://…", "加一个 HTTP 服务器"], ["--exposure / --description", "暴露方式；一句话说明（进系统提示）"], ["pi mcp list", "连接每个服务器，列出状态、工具和错误"], ["pi mcp login / logout", "OAuth 登录与登出"], ["/mcp", "会话里查看、重连、改暴露、启停"]].map(([a, b]) => h("tr", null, h("td", { style: { whiteSpace: "nowrap" } }, h("code", null, a)), h("td", null, b)))))),
          h("ul", { class: "rule", style: { marginTop: "12px" } },
            h("li", null, h("b", null, "格式和其他客户端相同："), "Claude Desktop、Claude Code、Cursor 的 mcpServers 条目可以直接拷过来。"),
            h("li", null, h("b", null, "command 不是 shell 字符串："), "一个可执行文件 + args 数组。"),
            h("li", null, h("b", null, "密钥不写死："), "env 和 headers 里用 ${TOKEN} 读环境变量。"),
            h("li", null, h("b", null, "项目级要信任："), "本机实测：项目未被信任时，pi mcp list 直接说项目的 mcp.json 被忽略。个人的、带凭证的服务器放全局文件。"))),
        section("s-expo", 4, "暴露方式", "模型怎样够到 MCP 工具",
          todo("读四种方式，然后做四个场景题。"),
          h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" },
            h("thead", null, h("tr", null, h("th", null, "exposure"), h("th", null, "模型怎样够到"), h("th", null, "适合"))),
            h("tbody", null,
              h("tr", null, h("td", null, h("code", null, "codemode"), "（默认）"), h("td", null, "不声明；在 codemode 脚本里用 searchTools / describeTool 找，用 tools.名字() 调"), h("td", null, "工具多、要组合或过滤结果")),
              h("tr", null, h("td", null, h("code", null, "deferred")), h("td", null, "不声明；tool_search 找到后声明到这条分支上"), h("td", null, "大服务器，但想直接调用")),
              h("tr", null, h("td", null, h("code", null, "direct")), h("td", null, "像内置工具一样直接声明"), h("td", null, "工具少、常用")),
              h("tr", null, h("td", null, h("code", null, "hidden")), h("td", null, "注册了，但够不着"), h("td", null, "屏蔽某个服务器或某个危险工具"))))),
          h("p", { class: "dim", style: { fontSize: "16px", marginTop: "8px" } }, "toolExposure 可以按工具单独覆盖，例如整个服务器 hidden、只放出两个工具。"),
          EXPO.map((x, i) => choice({ id: "e" + i, store: [ID, "expo"], kicker: "场景 " + (i + 1) + " / " + EXPO.length, q: x.q, opts: x.opts, explain: x.why, shuffleSeed: 221 + i * 3 }))),
        section("s-code", 5, "codemode", "让模型写脚本调用工具",
          todo("对照开场左栏的三段真实脚本，读懂 codemode 的规则。", true),
          h("ul", { class: "rule" },
            h("li", null, h("b", null, "是什么："), "一个工具。模型交给它一段 JavaScript，它在隔离的 QuickJS 沙箱里运行。脚本只能通过 tools.名字() 调用其他工具。"),
            h("li", null, h("b", null, "只有输出进上下文："), "脚本用 text() 或 return 交出结果。中间的大量数据可以在脚本里过滤掉，不进上下文（M1）。"),
            h("li", null, h("b", null, "能并行："), "实测第三段脚本用 Promise.allSettled 同时调了两次 MCP 工具。"),
            h("li", null, h("b", null, "怎样找工具："), "searchTools(查询)、describeTool(名字)、describeNamespace(服务器)、ALL_TOOLS。"),
            h("li", null, h("b", null, "怎样开启："), "接上 codemode 暴露的 MCP 服务器时自动开启。没有 MCP 时也可以用：defaultTools 里加 \"+codemode\"。")),
          h("div", { class: "note" }, h("span", { class: "k" }, "代价"), "codemode 工具自己的说明约 3,000 token（设置 codemode.inlineBudget），每轮都在。实测里它还让模型多花了两轮去探索。")),
        section("s-pkg", 6, "包", "把能力打包带走",
          todo("读结构、来源和本机实测的规则。实验里你会装一个、卸一个。", true),
          h("pre", { class: "panel", style: { padding: "14px 16px", fontSize: "15px" } }, `my-pi-kit/
├── package.json          ← keywords 里写 "pi-package" 可进 pi.dev 包库
├── extensions/*.ts       ← 自动发现
├── skills/*/SKILL.md     ← 自动发现
├── prompts/*.md          ← 自动发现
└── themes/*.json         ← 自动发现`),
          h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" }, h("tbody", null,
            [["pi install npm:@scope/pkg@1.2.0", "从 npm 装，版本锁定"], ["pi install git:github.com/u/repo@v1", "从 git 装，锁定标签或提交"], ["pi install ./my-pi-kit", "本地目录，原地加载，不复制"], ["-l", "写项目的 .pi/settings.json，而不是全局"], ["pi list / pi remove / pi update --extensions", "列出 / 卸载 / 更新"], ["pi -e npm:@scope/pkg", "只试用一次，不写任何设置"]].map(([a, b]) => h("tr", null, h("td", { style: { whiteSpace: "nowrap" } }, h("code", null, a)), h("td", null, b)))))),
          h("ul", { class: "rule", style: { marginTop: "12px" } },
            h("li", null, h("b", null, "本机实测 1："), "空项目里 pi install -l 直接成功；项目里已有 .pi/mcp.json 时，必须加 --approve。"),
            h("li", null, h("b", null, "本机实测 2："), "pi remove -l 总是要求信任（--approve）。"),
            h("li", null, h("b", null, "本机实测 3："), "声明写成相对 .pi 目录的路径（../my-pi-kit）；卸载只删声明，包目录保留。"),
            h("li", null, h("b", null, "依赖："), "pi 自带 @earendil-works/pi-ai、pi-agent-core、pi-coding-agent、pi-tui、typebox。它们写进 peerDependencies（\"*\"），不要打包；其他依赖写进 dependencies。"),
            h("li", null, h("b", null, "挑选资源："), "settings 里的对象写法可以只加载包里的部分扩展、Skill、模板；pi config 可以交互式开关。"))),
        section("s-review", 7, "装别人的东西", "三条纪律",
          todo("记住这三条。", true),
          h("ul", { class: "rule" },
            h("li", null, h("b", null, "先读源码："), "扩展是用你权限运行的代码；Skill 能指挥模型运行程序；MCP 服务器是你启动的进程。"),
            h("li", null, h("b", null, "锁定版本："), "npm 写版本号，git 写标签或提交。升级前再读一遍改动。"),
            h("li", null, h("b", null, "项目级更要小心："), "别人仓库里的 .pi/settings.json 可以声明包、MCP、扩展。信任一个项目之前，先看它的 .pi 目录（M5）。"))),
        section("s-lab", 8, "实验", "接一个 MCP，装一个包",
          todo("按第 1–5 步操作。全部在终端里完成。"),
          h("p", null, "你会把本课那 40 行 MCP 服务器接进项目，用它回答问题；再把一个模板和一个 Skill 打成包，装上、使用、卸下。"),
          h("div", { class: "note" }, h("span", { class: "k" }, "实验规则"), "只在 ~/pi-lab/m11 里做；只写项目级配置；--approve 不写 trust.json；最后清理。需要 python3。"),
          lab()),
        section("s-quiz", 9, "掌握测验", "10 题，8 题过关", todo("10 题全部作答，点「交卷」。"), window.Course.quizBlock(ID, QUIZ, checkDone)),
        section("s-recap", 10, "小结", "你学到了什么",
          todo("看自己的预测和成绩。觉得学会了，就在本节最后点「标记为已完成」。", true),
          h("p", { class: "lead" }, "一句话：MCP 是 stdio 或 HTTP 上的 JSON-RPC 工具插座；pi 默认用 codemode 按需找工具，工具少时改用 direct 更省；包是带 package.json 的目录，-l 装进项目，装之前先读源码。"),
          rc))));
    return () => rc._cleanup && rc._cleanup();
  });
})();
