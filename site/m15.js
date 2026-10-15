/* M15 · omp 的工具面 */
(function () {
  "use strict";
  const { h, section, quizBlock, lessonHead, look, howto, endBlock } = window.Course;
  const ID = "M15";

  const SRC = ['def greet(name):', '    print("Hello, " + name)', '', '', 'def bye(name):', '    print("Bye, " + name)', '', 'greet("world")'];
  const TASKS = [
    { t: "改一行", d: "把第 2 行换成 f-string", hl: 'PUT 2.=2:\n+    print(f"Hi, {name}")', op: { kind: "rep", a: 2, b: 2, body: ['    print(f"Hi, {name}")'] },
      pi: { oldText: '    print("Hello, " + name)', newText: '    print(f"Hi, {name}")' } },
    { t: "换掉整个函数", d: "5* 表示从第 5 行开始的整个函数", hl: 'PUT 5*:\n+def bye(name):\n+    print(f"Bye, {name}!")', op: { kind: "rep", a: 5, b: 6, body: ['def bye(name):', '    print(f"Bye, {name}!")'] },
      pi: { oldText: 'def bye(name):\n    print("Bye, " + name)', newText: 'def bye(name):\n    print(f"Bye, {name}!")' } },
    { t: "末尾加一行", d: ">$ 表示文件末尾", hl: 'PUT >$:\n+bye("world")', op: { kind: "ins", a: -1, body: ['bye("world")'] },
      pi: { oldText: 'greet("world")', newText: 'greet("world")\nbye("world")' } },
    { t: "删除一个函数", d: "CUT 也能用 5*", hl: 'CUT 5*', op: { kind: "cut", a: 5, b: 6 },
      pi: { oldText: '\n\ndef bye(name):\n    print("Bye, " + name)\n', newText: '' } },
  ];
  function applyOp(lines, op) {
    const L = lines.slice();
    if (op.kind === "rep") L.splice(op.a - 1, op.b - op.a + 1, ...op.body);
    else if (op.kind === "ins") op.a === -1 ? L.push(...op.body) : L.splice(op.a, 0, ...op.body);
    else if (op.kind === "cut") L.splice(op.a - 1, op.b - op.a + 1);
    return L;
  }
  function workbench() {
    let cur = 0;
    const btns = TASKS.map((x, i) => h("button", { class: "btn" + (i === 0 ? " primary" : ""), onclick: () => { cur = i; paint(); } }, x.t));
    const res = h("div", { style: { display: "grid", gap: "12px", padding: "14px 16px" } });
    const fileView = (lines, tag, mark) => h("pre", { class: "hlfile" }, h("span", { class: "hdr" }, `[greet.py#${tag}]`), "\n",
      lines.map((l, i) => h("span", { class: "ln2" + (mark && mark(i + 1) ? " mk" : "") }, h("span", { class: "no" }, i + 1 + ":"), l + "\n")));
    function paint() {
      btns.forEach((b, i) => (b.className = "btn" + (i === cur ? " primary" : "")));
      const x = TASKS[cur], op = x.op;
      const patch = `[greet.py#2F01]\n${x.hl}`;
      const piJson = JSON.stringify({ path: "greet.py", edits: [x.pi] }, null, 1);
      const inRange = (n) => (op.kind === "ins" ? false : n >= op.a && n <= op.b);
      res.replaceChildren(
        h("div", { class: "mute", style: { fontSize: "15px" } }, x.d),
        h("div", { class: "wb" },
          h("div", null, h("div", { class: "sub" }, "模型读到的文件"), fileView(SRC, "2F01", inRange)),
          h("div", null, h("div", { class: "sub" }, "改完以后"), fileView(applyOp(SRC, op), "····", null))),
        h("div", { class: "expo cmp2" },
          h("div", { class: "side2" }, h("div", { class: "sub" }, `omp 的 hashline · 模型要写 ${patch.length} 个字符`), h("pre", { class: "script" }, patch)),
          h("div", { class: "side2" }, h("div", { class: "sub" }, `pi 的 edit · 模型要写 ${JSON.stringify({ path: "greet.py", edits: [x.pi] }).length} 个字符`), h("pre", { class: "script" }, piJson))));
    }
    paint();
    return h("div", { class: "panel" }, h("div", { class: "panel-h", style: { flexWrap: "wrap", gap: "8px" } }, h("span", null, "同一个文件，四种改法"), h("span", { style: { display: "flex", gap: "6px", flexWrap: "wrap" } }, btns)), res);
  }

  function sizeBars() {
    const rows = [["pi 的 edit", 560, "var(--c-harness)"], ["omp 的 hashline", 77, "var(--c-ctx)"]];
    return h("div", { class: "panel", style: { padding: "14px 16px", display: "grid", gap: "8px" } },
      h("div", { class: "mute", style: { fontSize: "15px" } }, "实测：把 28 行文件里一个 20 行的函数体换成 return \"done\"。同一个模型，结果都正确。下面是整次运行模型输出的 token："),
      rows.map(([l, tok, c]) => h("div", { class: "cbar" }, h("span", null, l), h("div", { class: "b", style: { width: (tok / 560) * 100 + "%", background: c } }), h("span", { class: "v" }, tok + " token"))));
  }

  function staleTable() {
    const rows = [
      ["有人在文件顶部插了一行（目标行内容没变，只是往下移了）", ["成功，并警告", "提示：文件在你读过之后变了，已按未变的行重新对齐，请确认改动符合预期。"], ["成功，不提示", "旧文本还在，照常替换。"]],
      ["有人改了目标行本身（Hello 改成 Hey）", ["拒绝，文件不动", "提示：文件在读和改之间变了，请重新读。"], ["拒绝，文件不动", "找不到要替换的旧文本。"]],
    ];
    return h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" },
      h("thead", null, h("tr", null, h("th", null, "模型读完之后、修改之前"), h("th", null, "omp（hashline）"), h("th", null, "pi（edit）"))),
      h("tbody", null, rows.map(([a, o, p]) => h("tr", null, h("td", null, a),
        h("td", null, h("b", null, o[0]), h("div", { class: "mute", style: { fontSize: "15px" } }, o[1])),
        h("td", null, h("b", null, p[0]), h("div", { class: "mute", style: { fontSize: "15px" } }, p[1])))))));
  }

  const QUIZ = [
    { q: "omp 读文件时，开头的 [greet.py#2F01] 里的 2F01 是什么？", opts: [{ t: "根据整份文件内容算出的标签，内容一变它就变", ok: true }, { t: "文件的行数" }, { t: "会话编号" }], why: "改文件时要带上它，omp 据此判断模型看到的是不是最新的文件。" },
    { q: "hashline 的「PUT 2.=4:」表示：", opts: [{ t: "把第 2 到第 4 行换成下面以 + 开头的内容", ok: true }, { t: "在第 2 行后插入 4 行" }, { t: "删除第 2 和第 4 行" }], why: "只写位置和新内容，不用抄旧文本。" },
    { q: "为什么 hashline 改大段代码时省得多？", opts: [{ t: "pi 的 edit 要把旧文本逐字抄一遍，hashline 只写行号", ok: true }, { t: "hashline 会压缩文件" }, { t: "hashline 不需要模型输出" }], why: "实测把 20 行换成一行：pi 输出 560 token，omp 约 80。输出 token 比输入更慢也更贵。" },
    { q: "模型读完文件后，有人改了它要改的那一行。omp 会：", opts: [{ t: "拒绝修改，提示重新读", ok: true }, { t: "照改，覆盖别人的改动" }, { t: "改到错误的行" }], why: "两种机制都不会覆盖别人的改动。只是行号偏移（目标行本身没变）时，omp 会自动对齐并警告。" },
    { q: "想知道一个函数在整个仓库里被哪些地方调用，最准的是：", opts: [{ t: "lsp 的 references", ok: true }, { t: "grep 函数名" }, { t: "eval" }], why: "语言服务器懂作用域和导入，同名的局部变量、字符串里的同名文字不会被算进来。grep 只是按文字匹配。" },
  ];

  window.Course.register(ID, (page) => {
    page.append(h("div", { class: "col" },
      lessonHead(ID, [
        h("p", null, "上一课说 omp 默认有 11 个工具。这一课看其中最常用的几样：改文件的新方式 hashline，以及几样「懂代码」的工具：语言服务器（LSP）、常驻运行时（eval）、按语法树搜索改写（ast_grep）。"),
        h("p", null, "重点是 hashline：它让模型改文件时少写很多字，还能发现「文件在它读过之后被改过」。"),
      ], [
        "pi 的 edit 和 omp 的 hashline 改文件有什么不同，省在哪里。",
        "文件在读和改之间被别人改过时，两者各怎么办。",
        "LSP、eval、ast_grep 适合什么任务，用之前要满足什么条件。",
      ]),

      section("s-read", 1, "hashline", "改文件：抄旧文本，还是指行号",
        h("p", null, "回顾 pi 的 edit（第 1 课的回放里出现过）：模型要写出「旧文本」和「新文本」，pi 在文件里找到旧文本，换成新文本。改一行没问题；换掉一整个 20 行的函数，模型就得把这 20 行一字不差地再抄一遍。"),
        h("p", null, "omp 换了个办法。它读文件时给每行标上行号，并在开头给整份文件算一个", h("b", null, "标签"), "（由内容算出的 4 位编号，内容改一个字就会变）："),
        h("pre", null, `[greet.py#2F01]
1:def greet(name):
2:    print("Hello, " + name)
3:
4:
5:def bye(name):
6:    print("Bye, " + name)
7:
8:greet("world")`),
        h("p", null, "改的时候，模型只需要说「哪几行，换成什么」，并带上标签证明自己看的是这一版文件。这种写法叫 ", h("b", null, "hashline"), "。"),
        look("点上方的四种改法，对比 omp 和 pi 各要模型写出什么、写多少字。")),
      h("div", { class: "bench" }, workbench()),
      howto("hashline 的常用写法", [
        ["PUT 2.=4:", "把第 2–4 行换成下面以 + 开头的行。"],
        ["PUT 5*:", "替换从第 5 行开始的整个代码块（函数、类、if 块……）。"],
        ["PUT <N: / PUT >N:", "在第 N 行之前 / 之后插入。"],
        ["PUT >$:", "追加到文件末尾。"],
        ["CUT 2.=4 / CUT 5*", "删除。"],
      ], "每段都以 [文件名#标签] 开头。新建文件或整个重写，还是用 write。"),
      sizeBars(),

      section("s-stale", 2, "文件变了", "读过之后文件被改了怎么办",
        h("p", null, "模型读完文件到动手修改之间，文件可能被你、被另一个 agent、被格式化工具改过。用第 14 课的 RPC 可以精确制造这个时间差，结果是："),
        staleTable(),
        h("p", { style: { marginTop: "12px" } }, "两种方式都不会覆盖别人的改动。区别在第一行：pi 只要旧文本还在就照改，不会告诉你文件变过；omp 发现标签对不上，会把旧行号对齐到新文件，", h("b", null, "成功后明确警告"), "，你和模型都知道刚才看到的已经不是现在的文件了。"),
        h("p", { class: "dim" }, "omp 还会记录模型看过哪些行：没读过的行不能直接改，要先读。")),

      section("s-tools", 3, "其他工具", "懂代码的几样工具",
        howto("什么任务用什么", [
          ["找函数在哪被调用、跳转定义、看类型错误、安全改名", "LSP（语言服务器）：编辑器背后那个懂代码的程序。比 grep 准，不会把同名的局部变量和字符串算进来。"],
          ["统计一个 3 万行日志里每种错误出现几次", "eval：常驻的 Python 或 JavaScript 运行时。在里面计算，只把结果交给模型；变量在下一次调用时还在。"],
          ["把所有 console.log(x) 改成 logger.debug(x)，但不碰字符串里的", "ast_grep / ast_edit：按语法树搜索和改写，不会被注释和字符串干扰。"],
          ["普通的文字搜索", "grep：最快，结果是文字匹配。"],
        ]),
        h("p", null, "用之前要知道："),
        h("ul", { class: "rule" },
          h("li", null, h("b", null, "LSP 要有语言服务器。"), "你的电脑上要装好对应的服务器（比如 Python 的 pyright），而且", h("b", null, "启动目录"), "里要有项目标记文件（pyproject.toml、package.json、Cargo.toml 等），omp 只在当前目录找。它默认挂成 xd://lsp 设备（第 15 课讲过的两步调用）。改完文件后默认不会自动跑检查，最可靠的是让模型主动调用 lsp。"),
          h("li", null, h("b", null, "eval 属于 exec 级。"), "它能运行任意代码，审批时和 bash 同级。"),
          h("li", null, h("b", null, "ast_grep 默认关闭。"), "要在设置里打开 astGrep.enabled。"))),

      section("s-url", 4, "内部地址", "内部地址",
        h("p", null, "omp 的 read、write、grep 还认识一组特殊地址，用来访问不是普通文件的东西："),
        howto("常见的几种", [
          ["xd://名字", "工具设备：read 看说明，write 传参数（第 15 课）。"],
          ["artifact://编号", "被截断的长输出全文。bash 输出太长时，上下文里只放摘要和这个地址，需要时再读。"],
          ["skill://名字", "Skill 的正文。"],
          ["agent://编号", "子代理的输出和进度（下一课）。"],
          ["omp://", "omp 自己的文档。"],
          ["pr://编号", "GitHub 的 PR（需要 gh 命令），pr://编号/diff 看改动。"],
        ])),

      section("s-quiz", 5, "检查", "检查一下", quizBlock(ID, QUIZ, null, null)),

      section("s-end", 6, "小结", "小结",
        endBlock(ID, [
          "hashline 用「行号 + 文件标签」代替「逐字抄旧文本」，改大段代码时输出省好几倍。",
          "文件读过之后被改了：omp 能对齐的就对齐并警告，对不齐就拒绝；不会覆盖别人的改动。",
          "LSP 找引用和类型错误、eval 在运行时里计算、ast_grep 按语法树改写；LSP 需要语言服务器和项目标记文件，ast_grep 默认关闭。",
        ], { id: "M16", text: "一个 agent 不够时：子代理分工、按任务给不同的模型、在输出过程中拦截违规。" }))));
  });
})();
