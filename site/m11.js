/* M11 · MCP、codemode 与包 */
(function () {
  "use strict";
  const { h, section, quizBlock, lessonHead, look, howto, endBlock } = window.Course;
  const ID = "M11";
  const fmt = (n) => Math.round(n).toLocaleString("en-US");

  // Same MCP server, same question, two exposure modes (pi 0.99.2). Bars = context size of each request.
  const RUNS = {
    codemode: { reqs: [5818, 5921, 6037, 6163], decl: "read、bash、edit、write、3 个联网工具、codemode", steps: [
      ['text(await describeNamespace("mcp__zodiac"));\ntext(await searchTools("生肖 年份", {namespace:"mcp__zodiac"}));', "第 1 轮：这个服务器有什么工具？"],
      ['text(await describeTool("mcp__zodiac__zodiac"));', "第 2 轮：这个工具要什么参数？"],
      ['text(await Promise.allSettled([tools.mcp__zodiac__zodiac({year:2026}), tools.mcp__zodiac__zodiac({year:1990})]));', "第 3 轮：同时查两个年份"],
    ] },
    direct: { reqs: [2747, 2855], decl: "read、bash、edit、write、3 个联网工具、mcp__zodiac__zodiac", steps: [
      ["mcp__zodiac__zodiac({year: 2026})\nmcp__zodiac__zodiac({year: 1990})", "第 1 轮：在一条回复里直接调用两次"],
    ] },
  };
  function compare() {
    const max = 6200;
    const col = (k, title, sub) => {
      const r = RUNS[k];
      return h("div", { class: "side2" }, h("h4", null, title), h("div", { class: "sub" }, sub),
        h("div", { class: "mute", style: { fontSize: "15px" } }, "请求里声明的工具：" + r.decl),
        h("div", { class: "reqbars" }, r.reqs.map((v, i) => h("div", { class: "reqbar" }, h("span", null, "请求 " + (i + 1)), h("div", { class: "b", style: { width: (v / max) * 100 + "%" } }), h("span", { class: "v" }, fmt(v))))),
        r.steps.map(([code, lbl]) => h("div", { class: "script" }, h("span", { class: "lbl" }, lbl), code)),
        h("div", { style: { marginTop: "10px", fontWeight: 700 } }, "答案：2026 和 1990 都是马年。"));
    };
    return h("div", { class: "panel" },
      h("div", { class: "panel-h" }, h("span", null, "同一个 MCP 服务器、同一个问题、两种方式"), h("span", null, "条形 = 每次请求的大小（token）")),
      h("div", { class: "expo" }, col("codemode", "codemode（pi 的默认）", "MCP 工具不直接声明，模型写脚本去找、去调"), col("direct", "direct", "MCP 工具像内置工具一样直接声明")));
  }

  const QUIZ = [
    { q: "MCP 是什么？", opts: [{ t: "一个开放协议：任何程序按它的格式说话，就能把工具提供给支持它的 agent", ok: true }, { t: "pi 专用的扩展格式" }, { t: "一种模型" }], why: "写一次 MCP 服务器，pi、Claude Code、Cursor 等都能用。" },
    { q: "只接了一个小服务器，它就两个常用工具。哪种暴露方式更省？", opts: [{ t: "direct", ok: true }, { t: "codemode（默认）" }], why: "实测：direct 第一次请求 2,747 token、共 2 次请求；codemode 5,818 token、共 4 次请求。工具少时直接声明更省。" },
    { q: "接了 6 个服务器，合计 120 个工具，每次只用其中几个。哪种更合适？", opts: [{ t: "codemode（默认）", ok: true }, { t: "全部 direct" }], why: "120 个工具全部声明，每轮都要付费。codemode 的固定开销不随工具数量增长，用到时再找。" },
    { q: "某个服务器有个危险的 delete_all 工具，其余的你都要。怎么办？", opts: [{ t: "用 toolExposure 把 delete_all 设成 hidden", ok: true }, { t: "在 AGENTS.md 里写「不要用 delete_all」" }], why: "hidden：注册了但模型够不着。比写一句话可靠。" },
    { q: "安装一个陌生人发布的 pi 包之前，最重要的是：", opts: [{ t: "读它的源码，并锁定版本号", ok: true }, { t: "看下载量" }, { t: "什么都不用做" }], why: "包可以带扩展（用你的权限运行的代码）和 Skill（能指挥模型运行程序）。" },
  ];

  window.Course.register(ID, (page) => {
    page.append(h("div", { class: "col" },
      lessonHead(ID, [
        h("p", null, "自己写扩展能加工具，但很多工具别人已经写好了：读写 GitHub、查数据库、搜文档、操作浏览器……它们大多以 ", h("b", null, "MCP 服务器"), "的形式提供。pi 可以直接连上它们。"),
        h("p", null, "接得多了会遇到新问题：每个工具的定义都要占每次请求的上下文（第 2 课），一百个工具就是一大笔固定开销。pi 的默认做法叫 codemode：不把工具一个个声明出来，让模型需要时再去找。最后，你自己做的扩展、Skill、模板，可以打成", h("b", null, "包"), "分享给别人。"),
      ], [
        "MCP 是什么，怎样把一个 MCP 服务器接进 pi。",
        "工具很多时，codemode 和 direct 各自的代价，怎么选。",
        "什么是 pi 包，怎样安装，装别人的包要注意什么。",
      ]),

      section("s-mcp", 1, "MCP", "MCP：通用的工具插座",
        h("p", null, "MCP（Model Context Protocol）是一个开放协议，就像 USB 插座：任何程序只要按它的格式说话，就能把自己的工具提供给任何支持它的 agent，包括 pi、Claude Code、Cursor。这种程序叫 MCP 服务器。"),
        h("p", null, "pi 启动一个 MCP 服务器（本机的一个程序，或远程的一个网址）后，双方的对话很简单："),
        howto("pi 和 MCP 服务器之间的三步", [
          ["initialize", "打个招呼，服务器说明自己是谁、提供什么。"],
          ["tools/list", "pi 问有哪些工具，服务器列出每个工具的名字、说明和参数格式。"],
          ["tools/call", "模型要用某个工具时，pi 把参数发过去，服务器返回结果。"],
        ], "一个能用的 MCP 服务器，用 Python 写只要 30 多行。正式的服务器通常用官方 SDK 写，底层还是这几步。"),
        h("p", null, "在 pi 里，MCP 工具的名字是 ", h("code", null, "mcp__服务器名__工具名"), "，例如 mcp__github__create_issue。它们和别的工具一样会经过第 11 课的 tool_call、tool_result，你写的守卫对它们同样有效。")),

      section("s-cfg", 2, "接入", "把服务器接进 pi",
        howto("命令", [
          ["pi mcp add 名字 -- 命令 参数…", "接入一个本机程序形式的服务器。默认写进全局的 ~/.pi/agent/mcp.json；加 -l 写进项目的 .pi/mcp.json。"],
          ["pi mcp add 名字 --url https://…", "接入一个远程服务器。"],
          ["pi mcp list", "连接每个服务器，列出状态、工具和错误。"],
          ["/mcp", "在会话里查看、登录、重连、开关服务器、改暴露方式（§3）。"],
        ]),
        h("p", null, "mcp.json 的格式和 Claude Desktop、Cursor 等通用，可以直接拷过来："),
        h("pre", null, `{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]
    },
    "docs": {
      "url": "https://example.com/mcp",
      "headers": { "Authorization": "Bearer \${DOCS_TOKEN}" },
      "description": "搜索和阅读产品文档"
    }
  }
}`),
        h("ul", { class: "rule" },
          h("li", null, h("b", null, "密钥不要写死："), "用 ${变量名} 从环境变量读。"),
          h("li", null, h("b", null, "description："), "一句话说明服务器提供什么，模型靠它判断要不要用。"),
          h("li", null, h("b", null, "项目里的 mcp.json 需要信任才生效"), "（第 6 课）。带个人凭证的服务器放全局文件。"))),

      section("s-expo", 3, "暴露方式", "工具多了怎么办：codemode 与 direct",
        h("p", null, "每个直接声明给模型的工具，都要把名字、说明、参数格式放进每次请求。工具少时无所谓，接了几个大服务器、上百个工具时，这笔固定开销就很可观了。"),
        h("p", null, "pi 默认用 ", h("b", null, "codemode"), "：MCP 工具不直接声明，只给模型一个叫 codemode 的工具。模型需要时，写一小段 JavaScript 交给它运行：先搜索有哪些工具、查看参数，再调用，最后只把需要的结果交回来。"),
        look("同一个问题「2026 年和 1990 年分别是什么生肖」，对比两种方式：请求数、每次请求的大小、模型做了几轮。")),
      h("div", { class: "bench" }, compare()),
      h("p", { style: { marginTop: "16px" } }, "只有一个小服务器时，codemode 反而更贵：它自己的说明就占了约 3,000 token，模型还多花了两轮去找工具。它的好处在工具很多时才显现：固定开销不随工具数量增长，而且脚本能一次调用多个工具、在脚本里过滤掉大量中间数据。"),
      howto("四种暴露方式（每个服务器可以单独设置）", [
        ["codemode（默认）", "不声明，模型通过 codemode 脚本找和调。适合工具多、需要组合或过滤结果。"],
        ["deferred", "不声明，模型用 tool_search 搜到后，再把那几个工具声明出来。适合大服务器、又想直接调用。"],
        ["direct", "像内置工具一样直接声明。适合工具少、常用。"],
        ["hidden", "注册了但模型够不着。用来屏蔽某个服务器或其中某个危险工具。"],
      ], "设置方法：pi mcp add 时加 --exposure direct；或在 mcp.json 里写 \"exposure\"；或在 /mcp 里改。用 toolExposure 可以对单个工具另设，例如整个服务器 direct，只把 delete_all 设成 hidden。"),

      section("s-pkg", 4, "包", "把能力打包分享",
        h("p", null, "包就是一个普通目录（或 npm 包），里面按约定放扩展、Skill、提示模板、主题，再加一个 package.json："),
        h("pre", null, `my-pi-kit/
├── package.json
├── extensions/*.ts
├── skills/*/SKILL.md
├── prompts/*.md
└── themes/*.json`),
        howto("安装和管理", [
          ["pi install npm:@scope/pkg@1.2.0", "从 npm 安装，锁定版本号。"],
          ["pi install git:github.com/u/repo@v1", "从 git 安装，锁定标签或提交。"],
          ["pi install ./my-pi-kit", "本地目录，原地加载，不复制。"],
          ["加 -l", "装进当前项目（写 .pi/settings.json），而不是全局。"],
          ["pi list / pi remove", "列出 / 卸载。"],
          ["pi -e npm:@scope/pkg", "只试用这一次，不写任何设置。"],
        ]),
        h("div", { class: "note warn" }, h("span", { class: "k" }, "装别人的东西：三条纪律"), "① 先读源码：扩展是用你的权限运行的代码，Skill 能指挥模型运行程序，MCP 服务器是你启动的程序。② 锁定版本：npm 写版本号，git 写标签或提交；升级前再看一遍改动。③ 别人仓库里的 .pi/ 可以声明包、MCP 服务器和扩展，信任那个项目之前先看看它的 .pi 目录。")),

      section("s-quiz", 5, "检查", "检查一下", quizBlock(ID, QUIZ, null, null)),

      section("s-end", 6, "小结", "小结",
        endBlock(ID, [
          "MCP 是通用的工具协议；pi mcp add 把服务器接进 pi，工具名是 mcp__服务器__工具。",
          "pi 默认用 codemode：工具不直接声明，模型写脚本去找、去调。工具少时改成 direct 更省；危险工具设成 hidden。",
          "包是带 package.json 的目录，可以装扩展、Skill、模板；装别人的包先读源码、锁版本。",
        ], { id: "M12", text: "扩展、MCP、包都用你的权限运行，守卫也挡不住所有写法。怎样给 pi 划一条真正的边界？" }))));
  });
})();
