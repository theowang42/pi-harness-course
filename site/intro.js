/* INTRO · 序章：pi 是什么，这门课讲什么 */
(function () {
  "use strict";
  const { h, section, lessonHead, howto, endBlock } = window.Course;
  const ID = "INTRO";

  window.Course.register(ID, (page) => {
    page.append(h("div", { class: "col" },
      lessonHead(ID, [
        h("p", null, "这一页回答三个问题：pi 是什么；这门课学完能做什么、怎么安排的；怎样把 pi 装上、跑起来。"),
        h("p", { class: "dim" }, "已经在用 pi 的，可以直接跳到第 1 课。"),
      ], [
        "pi 是什么，和网页上的 AI 聊天有什么不同。",
        "这门课的路线，以及这个网站怎么用。",
        "怎样安装 pi、登录、开始第一次对话。",
      ]),

      section("s-what", 1, "pi 是什么", "pi 是什么",
        h("p", null, "pi 是一个在终端里运行的 ", h("b", null, "AI 编程助手"), "（英文常叫 coding agent）。你用平常说话的方式提要求，比如「测试为什么失败？修好它」，它会自己读文件、运行命令、修改代码，最后告诉你做了什么。"),
        h("p", null, "它和网页上的 AI 聊天最大的区别：网页里的 AI 只能看到你粘贴进去的内容，也只能回答；pi 运行在你的电脑上，能直接查看和改动你的项目。同类的工具还有 Claude Code、Codex CLI 等。"),
        h("ul", { class: "rule" },
          h("li", null, h("b", null, "开源、免费："), "MIT 许可。官网 pi.dev，源码在 github.com/earendil-works/pi。"),
          h("li", null, h("b", null, "本身不带模型："), "它要接一个 AI 服务才能工作：ChatGPT、Claude 等订阅，某家的 API 密钥，或者你自己电脑上跑的模型。pi 不收钱，模型可能要付费。"),
          h("li", null, h("b", null, "默认很精简："), "只有读文件、运行命令、改文件、写文件 4 个工具，不带子代理、计划模式这类功能。需要什么，自己用说明文件、Skill、扩展加上去。好处是每一层都看得见、改得动，这也是这门课选它来讲的原因。"),
          h("li", null, h("b", null, "omp："), "pi 的一个分支，默认功能多得多。第 6 单元专门讲，一开始不用装。"))),

      section("s-course", 2, "这门课", "这门课讲什么",
        h("p", null, "目标是让你不只会「跟它聊天」，而是明白它在背后怎么工作，并能按自己的需要配置、扩展、约束它。全课分 7 个单元："),
        h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" },
          h("thead", null, h("tr", null, h("th", null, "单元"), h("th", null, "课"), h("th", null, "学完能做什么"))),
          h("tbody", null, [
            ["1 心智模型", "1–2", "知道一次任务里 pi 和模型在做什么；为什么对话越长越贵。"],
            ["2 驾驭 pi", "3–5", "顺手地用 pi：引用文件、运行命令、中途插话；回到之前重来；压缩长对话。"],
            ["3 配置", "6–7", "知道配置放在哪里、谁说了算；选模型、接入本地模型。"],
            ["4 扩展", "8–12", "用说明文件、模板、Skill 教它规矩；用代码给它加工具、拦截危险操作；接入别人写好的工具。"],
            ["5 边界与自动化", "13–14", "给它划安全边界；在脚本和程序里调用它。"],
            ["6 oh-my-pi", "15–18", "认识 omp 多出来的功能，按场景在 pi 和 omp 之间做选择。"],
            ["7 毕业", "—", "把学到的配进你每天用的 pi。"],
          ].map(([a, b, c]) => h("tr", null, h("td", { style: { whiteSpace: "nowrap" } }, a), h("td", { style: { whiteSpace: "nowrap" } }, b), h("td", null, c)))))),
        h("p", { style: { marginTop: "14px" } }, "每一课的结构都一样：开头说明这一课解决什么问题 → 分几节讲清楚，演示前写明「看什么」→ 在 pi 里怎么做 → 5 道检查题 → 小结。"),
        h("p", null, h("b", null, "需要的基础："), "会打开终端、用 cd 进入文件夹、运行一条命令就够前三个单元了。第 4 单元的扩展部分要能大致读懂 JavaScript；读不懂代码也可以跳过那几节，不影响后面。"),
        howto("这个网站怎么用", [
          ["左侧目录", "按顺序学。每课右侧有本课小节的目录。"],
          ["虚线下划线的词", "鼠标停上去看解释。左下角「术语表」列出全部。"],
          ["检查题", "不计分，可以重做。"],
          ["每课最后", "觉得学会了，自己点「标记为已完成」。"],
          ["右上角", "切换浅色 / 深色。"],
        ], "进度存在你的浏览器里；用 Claude 账号登录打开时，还会同步到云端。")),

      section("s-install", 3, "安装", "装上 pi，开始第一次对话",
        h("p", null, h("b", null, "① 打开终端。"), "macOS 用「终端」或 iTerm；Windows 用 PowerShell；Linux 用你常用的终端。"),
        h("p", null, h("b", null, "② 安装。"), "macOS / Linux："),
        h("pre", null, "curl -fsSL https://pi.dev/install.sh | sh"),
        h("p", null, "Windows："),
        h("pre", null, 'powershell -c "irm https://pi.dev/install.ps1 | iex"'),
        h("p", { class: "dim" }, "已经装了 Node.js 22.19 以上的话，也可以用 npm install -g --ignore-scripts @earendil-works/pi-coding-agent。用安装脚本装的，以后用 pi update 升级。"),
        h("p", null, h("b", null, "③ 检查。"), "能显示版本号就装好了："),
        h("pre", null, "pi --version"),
        h("p", null, h("b", null, "④ 进入一个文件夹，启动。"), "pi 会把这个文件夹当作工作目录："),
        h("pre", null, "cd 某个文件夹\npi"),
        h("p", null, h("b", null, "⑤ 登录。"), "在 pi 里输入 /login，选一家提供者：有 ChatGPT 或 Claude 订阅就选对应的，在浏览器里登录；也可以粘贴 API 密钥。"),
        h("p", null, h("b", null, "⑥ 选模型。"), "输入 /model 挑一个。不选也行，会用默认的。"),
        h("p", null, h("b", null, "⑦ 说第一句话。"), "比如「说明这个文件夹里有哪些文件，各是做什么的」，按回车。"),
        h("p", null, "第一次对话时你会看到它一边做一边显示：读了哪个文件、运行了什么命令。按 Esc 可以随时让它停下，输入 /quit 或连按两次 Ctrl+C 退出。"),
        h("div", { class: "note warn" }, h("span", { class: "k" }, "先在不重要的文件夹里试"), "pi 运行命令、改文件之前默认不会问你，用的是你自己账户的权限。刚上手时先找一个不重要的文件夹练习；用在真实项目上之前，先用 git 提交一次，改错了能回退。为什么这样、怎样更安全，第 13 课细讲。")),

      section("s-faq", 4, "常见问题", "常见问题",
        howto("问与答", [
          ["要花钱吗？", "pi 本身免费。模型按你接的服务收费：订阅按月付，API 密钥按用量付；本地模型不花钱，但需要电脑够强。"],
          ["能用中文和它说话吗？", "能。想让它每次都用中文回答，写一句全局说明就行（第 8 课）。"],
          ["没装 git、不会编程能学吗？", "前三个单元不需要编程。git 只在提到「先提交一次以便回退」时用到，不会也能往下学。"],
          ["要装 omp 吗？", "不用。到第 15 课再决定。"],
          ["装错了 / 不想用了？", "再运行一次安装脚本，选 Uninstall。配置和登录信息在 ~/.pi/agent/，要彻底清除就删掉这个文件夹。"],
        ])),

      section("s-end", 5, "开始", "开始",
        endBlock(ID, [
          "pi 是在终端里运行的开源 AI 编程助手，能直接读写你的项目；它本身不带模型，要接一个 AI 服务。",
          "这门课从「它怎么工作」讲到配置、扩展、安全和自动化，最后比较 pi 和 omp。",
          "安装后在一个不重要的文件夹里运行 pi，/login 登录，就能开始。",
        ], { id: "M0", text: "第一课：你说一句话，pi 和模型之间到底发生了什么。" }))));
  });
})();
