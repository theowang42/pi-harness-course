/* M9 · 扩展 I：工具与命令 */
(function () {
  "use strict";
  const { h, section, quizBlock, lessonHead, look, howto, endBlock } = window.Course;
  const ID = "M9";

  // Tested with pi 0.99.2: a single file, no node_modules needed.
  const SRC = `import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Type } from "typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // 一个工具：模型可以调用它
  pi.registerTool({
    name: "text_stats",
    label: "文本统计",
    description: "统计一个文本文件的行数、字符数和汉字数。用户问文件有多长、有多少字时使用。",
    parameters: Type.Object({
      path: Type.String({ description: "文件路径，相对于工作目录" }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const file = resolve(ctx.cwd, params.path);
      const text = await readFile(file, "utf8"); // 文件不存在时会出错
      const lines = text.split("\\n").filter((l) => l.length > 0).length;
      const chars = [...text.replace(/\\s/g, "")].length;
      const cjk = (text.match(/[\\u4e00-\\u9fff]/g) || []).length;
      return {
        content: [{ type: "text", text: \`\${params.path}：\${lines} 行，\${chars} 个字符，其中汉字 \${cjk} 个。\` }],
        details: { lines, chars, cjk },
      };
    },
  });

  // 一个命令：你在编辑器里输入 /stats-help
  pi.registerCommand("stats-help", {
    description: "说明 text_stats 工具怎么用",
    handler: async (_args, ctx) => {
      ctx.ui.notify("问 pi：poem.txt 有多少个汉字？它会调用 text_stats。", "info");
    },
  });
}`;
  const PARTS = [
    ["1–4", "导入。前两行是 Node 自带的读文件、拼路径功能；typebox 用来描述参数格式；ExtensionAPI 是类型名，只给编辑器做提示。这些 pi 都自带，不用安装。"],
    ["6", "入口：文件默认导出一个函数。pi 启动时调用它，把一个叫 pi 的对象交给你，你通过它注册工具和命令。"],
    ["9–10", "name 是模型调用时写的工具名；label 只在界面上显示。"],
    ["11", "description：给模型看的说明。和 Skill 的描述一样，写清做什么、什么时候用。"],
    ["12–14", "parameters：这个工具接受哪些参数。这里只有一个字符串 path。pi 把它转成标准格式放进请求，模型照着格式写参数，pi 执行前会先检查。"],
    ["15", "execute：模型调用工具时，pi 执行这个函数。params 是模型给的参数，ctx 里有工作目录、界面等。其余几个参数这里用不到。"],
    ["16–20", "真正干活：读文件、数行数和字数。用 ctx.cwd 把相对路径按 pi 的工作目录解析。"],
    ["21–24", "返回结果：content 是模型会看到的文字；details 是给界面和扩展自己用的数据，模型看不到。"],
    ["29–34", "registerCommand 注册一个 / 命令。命令由你触发，在 pi 里直接执行，不经过模型，不花 token。这里只是弹出一条提示。"],
  ];
  function codeBlock() {
    const lines = SRC.split("\n");
    return h("div", { class: "panel" }, h("div", { class: "panel-h" }, h("span", null, "text_stats.ts（实测可用的完整扩展）"), h("span", null, lines.length + " 行")),
      h("div", { class: "codeview", style: { gridTemplateColumns: "1fr" } }, h("div", { class: "src" }, lines.map((t, i) => {
        const cm = t.indexOf("//");
        const body = cm >= 0 && !t.slice(0, cm).includes('"') ? [t.slice(0, cm), h("span", { class: "cm" }, t.slice(cm))] : [t];
        return h("div", { class: "ln" }, h("span", { class: "no" }, i + 1), h("span", null, ...body));
      }))));
  }

  const QUIZ = [
    { q: "扩展和 Skill 的根本区别是：", opts: [{ t: "扩展是 pi 启动时运行的代码，能增加真正的工具和命令", ok: true }, { t: "扩展写得更长" }, { t: "扩展只能放在全局目录" }], why: "Skill 是说明书，模型可能照做也可能不照做；扩展是代码，pi 真的会执行。" },
    { q: "临时试一个扩展文件，不安装到任何地方：", opts: [{ t: "pi -e ./my-ext.ts", ok: true }, { t: "把它写进 AGENTS.md" }, { t: "复制到 ~/.pi/agent/extensions/ 后重启电脑" }], why: "-e 只对这一次运行生效。改完扩展后在 pi 里 /reload 就能重新加载。" },
    { q: "工具返回 { content: [...], details: {...} }。模型能看到哪部分？", opts: [{ t: "只有 content", ok: true }, { t: "两部分都能看到" }, { t: "只有 details" }], why: "content 进入上下文；details 留给界面显示和扩展自己的状态。" },
    { q: "想让工具告诉模型「这次失败了」，应该：", opts: [{ t: "在 execute 里抛出错误（throw）", ok: true }, { t: "返回一段写着「失败」的文字" }], why: "抛出错误时，模型收到一条标记为错误的结果。返回的文字即使写着「失败」，也会被当作正常结果。" },
    { q: "为什么只加载你信任来源的扩展？", opts: [{ t: "扩展在 pi 里运行，用你的权限，能读你的文件和登录凭证、执行任何命令", ok: true }, { t: "因为扩展会占用大量上下文" }, { t: "因为扩展会让模型变笨" }], why: "扩展没有沙箱。别人的扩展先读源码再用；项目里的扩展受项目信任保护（第 6 课）。" },
  ];

  window.Course.register(ID, (page) => {
    page.append(h("div", { class: "col" },
      lessonHead(ID, [
        h("p", null, "前几课写的 AGENTS.md、提示模板、Skill 都是文字：模型读了，可能照做，也可能不照做；而且文字不能让 pi 多出任何能力（第 1 课：能做什么只看有哪些工具）。"),
        h("p", null, h("b", null, "扩展"), "是代码。pi 启动时会运行你写的 TypeScript 文件，它可以给模型加一个新工具，也可以给你加一个新的 / 命令。这一课读懂一个完整的小扩展，知道工具结果里哪些给模型看、怎样表示失败，以及为什么只能装信得过的扩展。"),
        h("p", { class: "dim" }, "这一课需要能大致读懂 JavaScript / TypeScript。看不懂每一行也没关系，跟着注释理解每一块在做什么即可。"),
      ], [
        "扩展是什么、放在哪里、为什么不能随便装。",
        "一个工具由哪几部分组成；返回结果里模型看到什么。",
        "扩展命令和提示模板有什么不同。",
      ]),

      section("s-what", 1, "扩展是什么", "一段 pi 启动时运行的代码",
        h("p", null, "可以拿浏览器插件类比：浏览器启动时加载插件，插件往浏览器里加按钮；pi 启动时加载扩展，扩展往 pi 里加工具和命令。过程分四步：")),
      h("div", { class: "bench" }, h("div", { class: "panel journey", style: { marginTop: "8px" } },
        [["1", "找到文件", "pi 启动时，去扩展目录里找 .ts 文件；或者加载你用 -e 指定的文件。"],
         ["2", "直接运行", "pi 直接运行 TypeScript，不需要你先编译，也不需要安装依赖。"],
         ["3", "调用你的函数", "你的文件导出一个函数。pi 调用它，把一个叫 pi 的对象交给你。"],
         ["4", "注册", "你调用 pi.registerTool(…)、pi.registerCommand(…)。从此模型能看到新工具，你能用新命令。"]]
          .map(([n, t, d]) => h("div", { class: "st" }, h("div", { class: "n" }, "第 " + n + " 步"), h("div", { class: "tt" }, t), h("p", null, d))))),
      howto("放在哪里", [
        ["pi -e ./x.ts", "只对这一次运行生效。写扩展、调试时用它。"],
        ["~/.pi/agent/extensions/", "所有项目都加载。放 .ts 文件，或带 index.ts 的子目录。"],
        [".pi/extensions/", "只在当前项目加载，需要信任这个项目（第 6 课）。"],
      ], "改完扩展后，在 pi 里输入 /reload 就能重新加载，不用退出。"),
      h("div", { class: "note warn" }, h("span", { class: "k" }, "扩展能做你能做的一切"), "扩展没有沙箱。它在 pi 里运行，用的是你的权限：能读你的文件、能读 auth.json 里的登录凭证、能执行任何命令。文字最多误导模型，代码可以直接动手。所以只加载你信任的来源，别人的扩展先读源码。"),

      section("s-tool", 2, "一个例子", "读懂一个完整的扩展",
        h("p", null, "下面这个扩展给 pi 加了一个工具 text_stats（统计文件的行数和字数），和一个命令 /stats-help。先整体看一遍，再对照下面的表逐块理解。"),
        codeBlock(),
        howto("逐块说明（左列是行号）", PARTS)),

      section("s-result", 3, "结果", "工具的结果：模型看到什么",
        h("ul", { class: "rule" },
          h("li", null, h("b", null, "模型只看到 content。"), "details 不发给模型，留给界面显示，或给扩展自己记状态（下一课）。"),
          h("li", null, h("b", null, "失败就抛出错误。"), "在 execute 里 throw，模型会收到一条标记为错误的结果，内容是错误信息；pi 不会崩溃。如果你只是返回一段写着「失败」的文字，pi 会当作正常结果。"),
          h("li", null, h("b", null, "结果要短。"), "content 进入上下文后每轮都要重发（第 2 课）。输出可能很长时，先截断，再告诉模型完整内容存在哪个文件。")),
        h("p", null, "实测：问「poem.txt 有多少个汉字？」，模型调用 text_stats，拿到「4 行，24 个字符，其中汉字 20 个」，据此回答。让它统计一个不存在的文件，读文件时出错，模型收到错误结果，回答「无法统计：文件不存在」。"),
        h("p", { class: "dim" }, "进阶提示：同一条回复里的几个工具调用可能同时执行；会改文件的工具，要用 pi 提供的 withFileMutationQueue 把「读—改—写」包起来，避免互相覆盖。")),

      section("s-cmd", 4, "命令", "扩展命令和提示模板有什么不同",
        h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" },
          h("thead", null, h("tr", null, h("th", null, ""), h("th", null, "提示模板 /review"), h("th", null, "扩展命令 /stats-help"))),
          h("tbody", null,
            h("tr", null, h("td", null, "本质"), h("td", null, "一段文字"), h("td", null, "一个函数")),
            h("tr", null, h("td", null, "运行时"), h("td", null, "展开成一条消息发给模型"), h("td", null, "在 pi 里直接执行，不经过模型")),
            h("tr", null, h("td", null, "花 token"), h("td", null, "花"), h("td", null, "不花（除非它自己给模型发消息）")),
            h("tr", null, h("td", null, "能做的事"), h("td", null, "让模型去做"), h("td", null, "代码能做的都行：弹窗确认、切换模型、读写文件、替你给模型发消息")))))),

      section("s-try", 5, "试一下", "在 pi 里试试（可选）",
        h("p", null, "如果想亲手跑一遍：把上面的代码存成 text_stats.ts，在同一个目录里放一个有中文内容的 poem.txt，然后："),
        howto("步骤", [
          ["pi -e ./text_stats.ts", "加载扩展启动 pi。启动信息里会列出这个扩展。"],
          ["/stats-help", "运行扩展命令，界面上弹出一条提示。没有消耗任何 token。"],
          ["poem.txt 有多少个汉字？", "模型会调用 text_stats。工具块里能看到参数和结果。"],
          ["改代码 → /reload", "修改扩展后重新加载，不用退出 pi。"],
        ])),

      section("s-quiz", 6, "检查", "检查一下", quizBlock(ID, QUIZ, null, null)),

      section("s-end", 7, "小结", "小结",
        endBlock(ID, [
          "扩展是 pi 启动时运行的 TypeScript：导出一个函数，用 registerTool 给模型加工具，用 registerCommand 给你加命令。",
          "工具结果里，模型只看到 content；失败要抛出错误；结果要短。",
          "扩展命令在 pi 里直接执行，不经过模型；提示模板则是发给模型的文字。",
          "扩展用你的权限运行，只装信得过的。",
        ], { id: "M10", text: "扩展的另一半：在 pi 的每一步中间插手，比如执行危险命令前先拦下来问你。" }))));
  });
})();
