/* M2 · 第一次会话 */
(function () {
  "use strict";
  const { h, $$, Store, section, quizBlock, lessonHead, look, howto, endBlock } = window.Course;
  const ID = "M2";

  // ================= §2 the screen, annotated =================
  // Re-laid from a real pi screen while a task was running with one steering and one follow-up queued.
  const TUI = [
    ["hdr", " ▀▀█  v0.99.2", "dimt"],
    ["hdr", " █▀ █ escape interrupt · ctrl+c/ctrl+d clear/exit · / commands · ! bash · ctrl+o more", "dimt"],
    ["res", " [Context]  AGENTS.md      [Extensions]  pi-web-access", "dimt"],
    ["rule"],
    ["msg", " 用 bash 工具依次运行 sleep 4 三次，每次单独一个工具调用。全部做完后只说：完成。", "user"],
    ["tool", " $ sleep 4", "tool"],
    ["tool", " Elapsed 3.0s", "dimt"],
    ["queue", " Steering: 第三次改成运行 echo 已改", "q"],
    ["queue", " Follow-up: 最后再说一句：再见", "q"],
    ["queue", " ↳ Alt+Up to edit all queued messages", "dimt"],
    ["rule"],
    ["edit", " ▏", ""],
    ["rule"],
    ["foot", " ~/pi-lab/m2", "dimt"],
    ["foot", " ↑2.7k ↓24 $0.028 (sub) 1.0%/272k (auto)                          gpt-6-astra • medium", "dimt"],
  ];
  const ZONES = {
    hdr: ["启动头", "版本号和最常用的按键。"],
    res: ["已加载的资源", "pi 启动时找到的说明文件（AGENTS.md）、扩展、Skill 等。这里列出的东西都会进入每次请求（第 2 课）。"],
    msg: ["你的消息", "对话按时间从上往下排。"],
    tool: ["工具调用和输出", "pi 正在执行的工具。长输出默认折叠，Ctrl+O 展开。"],
    queue: ["排队区", "它干活时你发出的消息在这里等着进入。Steering 是插话，Follow-up 是排队（见 §4）。"],
    edit: ["编辑器", "在这里写消息。输入 / 打开命令菜单，输入 @ 搜索文件，以 ! 开头运行命令。边框颜色表示思考强度。"],
    foot: ["状态栏", "当前目录、累计用量和费用、上下文占用、模型（第 2 课讲过）。"],
  };
  function screen() {
    const exp = h("div", { class: "panel tui-exp" }, h("span", { class: "mute" }, "鼠标移到界面上的任一区域，看它是什么。"));
    const show = (z) => {
      $$(".tui .hot", box).forEach((r) => r.classList.toggle("on", r.dataset.z === z));
      exp.replaceChildren(h("b", null, ZONES[z][0]), h("p", { class: "dim", style: { margin: "4px 0 0" } }, ZONES[z][1]));
    };
    let last = null;
    const rows = TUI.map(([z, txt, cls]) => {
      if (z === "rule") return h("div", { class: "rule" });
      const first = z !== last; last = z;
      return h("div", { class: "row hot " + (cls || ""), "data-z": z, tabindex: first ? "0" : null, onmouseenter: () => show(z), onfocus: () => show(z), onclick: () => show(z) },
        txt, first ? h("span", { class: "tag" }, ZONES[z][0]) : null);
    });
    const box = h("div", { class: "tui", role: "img", "aria-label": "pi 交互界面示意" }, h("div", { style: { height: "8px" } }), rows, h("div", { style: { height: "8px" } }));
    return h("div", null, box, exp);
  }

  const timeline = () => h("div", { class: "panel" }, [
    ["你", "user", "用 bash 依次运行 sleep 4 三次……做完只说：完成。"], ["模型", "model", "bash(sleep 4)"], ["工具", "tool", "（无输出）"],
    ["你 · 插话", "user", "第三次改成运行 echo 已改"], ["模型", "model", "bash(sleep 4)"], ["工具", "tool", "（无输出）"],
    ["模型", "model", "bash(echo 已改)"], ["工具", "tool", "已改"], ["模型", "model", "完成。"],
    ["你 · 排队", "user", "最后再说一句：再见"], ["模型", "model", "再见。"]].map(([w, c, t], i) => h("div", { class: "mini-tr" }, h("div", { class: "row" }, h("span", { class: "n" }, "#" + (i + 1)), h("span", { class: "who r-" + c }, w), h("span", { class: "what" }, t)))));

  const QUIZ = [
    { q: "pi 正在执行一个工具。你输入一句话按 Enter。这句话什么时候进入对话？", opts: [{ t: "当前这一轮的工具执行完之后，下一次请求之前", ok: true }, { t: "立刻打断工具，马上进入" }, { t: "整个任务做完之后" }], why: "Enter 是插话。它等当前一轮做完再进入，影响模型的下一步。" },
    { q: "用 Alt+Enter 发出的消息什么时候进入？", opts: [{ t: "pi 做完整个任务、本来要停下的时候", ok: true }, { t: "当前这一轮结束后" }, { t: "马上进入" }], why: "Alt+Enter 是排队：不打扰当前任务，做完后再处理它。" },
    { q: "在编辑器里输入 !git status 回车，会发生什么？", opts: [{ t: "pi 运行这条命令，输出记进对话；你下次发消息时模型能看到", ok: true }, { t: "模型调用 bash 工具运行它，并马上分析结果" }, { t: "只在终端显示，模型永远看不到" }], why: "! 是你自己运行命令，不会触发模型回复。输出留在对话里，随下一条消息一起发给模型。" },
    { q: "!! 和 ! 的区别是：", opts: [{ t: "!! 的输出只给你看，不会发给模型", ok: true }, { t: "!! 用管理员权限运行" }, { t: "!! 会运行两次" }], why: "输出很长、或与任务无关时用 !!，不占上下文。" },
    { q: "想接着这个目录里上一次的对话。用：", opts: [{ t: "pi -c", ok: true }, { t: "pi --no-session" }, { t: "pi -p" }], why: "-c 继续当前目录最近的会话；-r 打开列表自己挑。" },
  ];

  window.Course.register(ID, (page) => {
    page.append(h("div", { class: "col" },
      lessonHead(ID, [
        h("p", null, "前两课讲 pi 内部怎么运转。这一课开始真正使用它：从哪里启动、屏幕上各部分是什么、怎样把文件和命令输出交给它，以及它干活时你怎样插话、排队或叫停。"),
        h("p", null, "这些都是日常每天要用的操作。读完这一课，你就能顺手地用 pi 完成一个普通任务。"),
      ], [
        "在哪里启动 pi，怎样接着上次的对话。",
        "@ 引用文件、! 和 !! 运行命令，各自对上下文有什么影响。",
        "它干活时，Enter、Alt+Enter、Esc 分别有什么效果。",
      ]),

      section("s-launch", 1, "启动", "在哪里启动，就在哪里工作",
        h("p", null, "pi 把启动时所在的目录当作工作目录。它决定三件事：去哪里找 AGENTS.md 和项目配置；工具默认在哪里读写文件；对话记录归到哪个目录名下。所以", h("b", null, "先 cd 到项目目录，再运行 pi"), "。"),
        howto("启动方式", [
          ["pi", "在当前目录开始一个新会话。"],
          ['pi "说明这个仓库的结构"', "带着第一条消息启动。"],
          ["pi -c", "继续当前目录最近一次的会话（--continue）。"],
          ["pi -r", "打开会话列表，挑一个继续（--resume）。"],
          ["pi --no-session", "临时会话，退出后不保存。"],
        ]),
        h("p", null, "每个会话都会自动保存在 ~/.pi/agent/sessions/ 下，按工作目录分组。所以 pi -c 只找得到", h("b", null, "当前目录"), "的会话。会话的更多用法在第 4 课。")),

      section("s-screen", 2, "界面", "屏幕上各部分是什么",
        h("p", null, "下面是 pi 运行时的界面，按真实画面重排。当时它正在执行一个任务，排队区里还有两条等着进入的消息。"),
        look("把鼠标移到各行上，看下面的说明。重点认清三块：中间的对话记录、下方的编辑器、最底下的状态栏。")),
      h("div", { class: "bench" }, screen()),

      section("s-input", 3, "交材料", "把文件和命令输出交给它",
        h("h3", null, "@ 引用文件"),
        h("p", null, "在编辑器里输入 @，再输入文件名的一部分，从列表里选中。发送时，文件内容直接附在你的消息里。"),
        h("p", null, "另一种方式是让模型自己去读（它会调用 read 工具）。区别在于谁来决定读什么：", h("b", null, "你知道答案在哪个文件，就用 @；不知道，就让模型去找。"), "无论哪种方式，读进来的内容都留在上下文里，大文件很贵（第 2 课）。"),
        h("h3", null, "! 和 !! 运行命令"),
        h("p", null, "以 ! 开头的一行，pi 会直接在你的终端里运行，不经过模型，也不会触发模型回复。两者只差一点："),
        h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" },
          h("thead", null, h("tr", null, h("th", null, ""), h("th", null, "!git status"), h("th", null, "!!git status"))),
          h("tbody", null,
            h("tr", null, h("td", null, "运行命令，你看到输出"), h("td", null, "是"), h("td", null, "是")),
            h("tr", null, h("td", null, "输出发给模型"), h("td", null, h("b", null, "是"), "（随你下一条消息一起发送）"), h("td", null, h("b", null, "否")))))),
        h("p", { style: { marginTop: "14px" } }, "想让模型根据结果决定下一步（例如把报错交给它修），用 !；只是自己看一眼，或者输出很长，用 !!，不占上下文。"),
        h("h3", null, "其他方式"),
        h("ul", { class: "rule" },
          h("li", null, h("b", null, "粘贴图片："), "Ctrl+V，或把图片拖进终端。"),
          h("li", null, h("b", null, "写长消息："), "Shift+Enter 换行；或按 Ctrl+G，在你常用的文本编辑器里写，保存关闭后回到 pi。"))),

      section("s-steer", 4, "运行中", "它干活时，你还能做什么",
        h("p", null, "pi 开始干活以后，你仍然可以输入。按不同的键，消息进入的时机不同："),
        h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" },
          h("thead", null, h("tr", null, h("th", null, "按键"), h("th", { style: { whiteSpace: "nowrap" } }, "作用"), h("th", null, "什么时候生效"), h("th", null, "适合"))),
          h("tbody", null,
            h("tr", null, h("td", null, h("kbd", null, "Enter")), h("td", { style: { whiteSpace: "nowrap" } }, "插话"), h("td", null, "当前一轮（模型回复和它调用的工具）做完后，下一次请求之前。"), h("td", null, "发现方向不对，或想补一句「别改那个文件」。")),
            h("tr", null, h("td", null, h("kbd", null, "Alt+Enter")), h("td", { style: { whiteSpace: "nowrap" } }, "排队"), h("td", null, "整个任务做完、本来要停下的时候。"), h("td", null, "当前任务没问题，想让它做完后接着做另一件事。")),
            h("tr", null, h("td", null, h("kbd", null, "Alt+↑")), h("td", { style: { whiteSpace: "nowrap" } }, "取回"), h("td", null, "还没进入的插话和排队消息退回编辑器。"), h("td", null, "刚发的话写错了，或不想发了。")),
            h("tr", null, h("td", null, h("kbd", null, "Esc")), h("td", { style: { whiteSpace: "nowrap" } }, "中断"), h("td", null, "立刻停下；排队中的消息退回编辑器。"), h("td", null, "它在做明显错误或危险的事。"))))),
        h("p", { style: { marginTop: "16px" } }, "插话不会打断正在运行的命令。它要等当前这一轮做完，所以说得太晚可能来不及。"),
        look("一次真实记录：让 pi 依次运行三次 sleep 4。第一次运行时按 Enter 插话「第三次改成运行 echo 已改」，再按 Alt+Enter 排队「最后再说一句：再见」。看这两条消息分别出现在哪里。"),
        timeline(),
        h("p", { style: { marginTop: "12px" } }, "插话在第一个工具结果之后进入（#4），模型随即改了计划（#7）。排队的消息一直等到「完成。」之后才进入（#10）。"),
        h("p", { class: "dim" }, "如果你连续插了好几句话，pi 默认每轮只送进一句（设置项 steeringMode，排队消息对应 followUpMode；改成 all 则一次全送进去）。")),

      section("s-keys", 5, "速查", "常用按键和命令",
        howto("按键", [
          ["Enter / Shift+Enter", "发送 / 换行。"],
          ["Alt+Enter", "运行中排队一条消息。"],
          ["Alt+↑", "把排队的消息取回编辑器。"],
          ["Esc", "中断当前任务。"],
          ["Ctrl+O", "展开或收起工具输出。"],
          ["Ctrl+T", "展开或收起模型的思考过程。"],
          ["Shift+Tab", "切换思考强度（第 7 课）。"],
          ["Ctrl+L / Ctrl+P", "打开模型列表 / 在常用模型间切换。"],
          ["Ctrl+G", "在外部编辑器里写长消息。"],
          ["Ctrl+X", "复制模型最后一条回复。"],
          ["Ctrl+C 两次 / Ctrl+D", "退出 pi（Ctrl+C 第一次是清空编辑器）。"],
        ]),
        howto("命令（在编辑器里输入 / 可以看到全部）", [
          ["/model", "选择模型。"],
          ["/new", "开始新会话。旧会话仍保存在磁盘上。"],
          ["/resume", "切换到另一个保存过的会话。"],
          ["/name", "给当前会话起名，方便以后在列表里找到。"],
          ["/session", "当前会话的文件位置、消息数、用量和费用。"],
          ["/reload", "改了 AGENTS.md 或配置后，重新加载，不丢当前对话。"],
          ["/export", "把会话导出成 HTML 或 JSONL。导出或分享前先检查内容，里面可能有文件内容和密钥。"],
          ["/hotkeys", "列出当前生效的全部按键。"],
        ], "Alt+Enter、Shift+Enter 需要终端把组合键传给 pi。如果按了没反应，看 pi 文档的终端设置（terminal-setup）。")),

      section("s-quiz", 6, "检查", "检查一下", quizBlock(ID, QUIZ, null, null)),

      section("s-end", 7, "小结", "小结",
        endBlock(ID, [
          "先 cd 到项目目录再启动 pi；pi -c 接着当前目录上次的会话。",
          "@ 把文件内容附进消息；! 运行命令并把输出交给模型，!! 只给你看。",
          "干活时：Enter 插话（这一轮做完后生效），Alt+Enter 排队（任务做完后生效），Esc 叫停。",
        ], { id: "M3", text: "回到前面某一步换个做法，原来的记录还在吗？会话其实是一棵树。" }))));
  });
})();
