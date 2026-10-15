/* M9 · 扩展 I：工具与命令 */
(function () {
  "use strict";
  const { h, $, $$, Store, choice, copyBlock, section, todo, route, term } = window.Course;
  const ID = "M9";

  // The exact extension tested on this machine (pi 0.99.2): imports resolve without node_modules.
  const SRC = `import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Type } from "typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // 1. 一个工具：模型可以调用它。
  pi.registerTool({
    name: "text_stats",
    label: "文本统计",
    description: "统计一个文本文件的行数、字符数和汉字数。用户问文件有多长、有多少字时使用。",
    parameters: Type.Object({
      path: Type.String({ description: "文件路径，相对于工作目录" }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const file = resolve(ctx.cwd, params.path);
      const text = await readFile(file, "utf8"); // 文件不存在时会抛错：pi 把它变成一个错误结果
      const lines = text.split("\\n").filter((l) => l.length > 0).length;
      const chars = [...text.replace(/\\s/g, "")].length;
      const cjk = (text.match(/[\\u4e00-\\u9fff]/g) || []).length;
      return {
        content: [{ type: "text", text: \`\${params.path}：\${lines} 行，\${chars} 个字符，其中汉字 \${cjk} 个。\` }],
        details: { lines, chars, cjk },
      };
    },
  });

  // 2. 一个命令：你在编辑器里输入 /stats-help。
  pi.registerCommand("stats-help", {
    description: "说明 text_stats 工具怎么用",
    handler: async (_args, ctx) => {
      ctx.ui.notify("问 pi：poem.txt 有多少个汉字？它会调用 text_stats。", "info");
    },
  });
}`;
  // [first line, last line, title, explanation]  (1-based, inclusive)
  const PARTS = [
    [1, 2, "Node 内置模块", "扩展就是普通的 TypeScript，运行在 pi 进程里。可以用 Node 的全部能力：读写文件、启动进程、发网络请求——用的都是你的权限。"],
    [3, 4, "两个导入", "typebox 用来写参数格式；ExtensionAPI 是类型。本机实测：一个放在任意目录、没有 node_modules 的单文件扩展，这两个导入都能直接解析（pi 用 jiti 加载，不需要先编译）。"],
    [6, 6, "默认导出的工厂函数", "pi 加载扩展时调用它，并传入 pi（ExtensionAPI）。在这里注册工具、命令、事件处理器。不要在这里启动定时器或进程：有些场合只加载扩展而不开会话。"],
    [8, 10, "name 与 label", "name 是模型调用时写的名字，也是 --tools 里的名字。label 只给界面显示。"],
    [11, 11, "description", "给模型看的说明。和 Skill 的描述一样：写清做什么、何时用（M8）。它原样出现在请求的 tools 数组里。"],
    [12, 14, "parameters", "用 TypeBox 写参数格式，pi 把它转成 JSON Schema 发给提供者。模型按这个格式写工具调用；pi 在执行前先校验。"],
    [15, 15, "execute 的五个参数", "toolCallId；params（已校验的参数）；signal（用户按 Esc 时会中止）；onUpdate（推送中间进度）；ctx（工作目录、界面、会话等）。"],
    [16, 16, "用 ctx.cwd 解析路径", "相对路径按 pi 的工作目录解析，而不是扩展文件所在的目录。"],
    [17, 17, "抛错 = 错误结果", "文件不存在时 readFile 抛错。pi 接住它，生成一条 isError: true 的工具结果交给模型。本机实测：模型据此回答「无法统计：missing.txt 不存在」。注意：只是返回一段写着「错误」的文字，并不会标记为错误。"],
    [21, 24, "返回值：content 与 details", "content 是给模型看的（进入上下文，M1 的增长成本）。details 不发给模型：留给界面渲染，或用来在会话里重建状态（M10）。输出很大时，要先截断，并告诉模型去哪里看全文。"],
    [28, 34, "registerCommand", "注册一个 / 命令。命令由你触发，在 pi 进程里执行，不经过模型，也不花 token。ctx.ui 提供 notify、confirm、select 等界面能力。"],
  ];
  function codeView() {
    const lines = SRC.split("\n");
    const note = h("div", { class: "note2" }, h("span", { class: "mute" }, "点左边任一行，看它是什么。共 " + PARTS.length + " 个要点。"));
    const seen = new Set(Object.keys(Store.get(ID, "parts", {})));
    const rows = lines.map((t, i) => {
      const n = i + 1, part = PARTS.findIndex(([a, b]) => n >= a && n <= b);
      const cm = t.indexOf("//");
      const body = cm >= 0 && !t.slice(0, cm).includes('"') ? [t.slice(0, cm), h("span", { class: "cm" }, t.slice(cm))] : [t];
      return h("div", { class: "ln" + (part >= 0 ? " grp" : ""), "data-p": part, onclick: () => show(part) }, h("span", { class: "no" }, n), h("span", null, ...body));
    });
    function show(p) {
      if (p < 0) return;
      const [a, b, title, why] = PARTS[p];
      rows.forEach((r, i) => r.classList.toggle("on", i + 1 >= a && i + 1 <= b));
      note.replaceChildren(h("span", { class: "tag" }, `第 ${a}${b > a ? "–" + b : ""} 行`), h("b", { style: { fontSize: "18px" } }, title), h("p", { style: { margin: 0 } }, why), h("span", { class: "mute", style: { fontSize: "15px" } }, `已看 ${seen.size + (seen.has(String(p)) ? 0 : 1)} / ${PARTS.length}`));
      if (!seen.has(String(p))) { seen.add(String(p)); Store.set(ID, "parts", Object.fromEntries([...seen].map((x) => [x, 1]))); }
    }
    return h("div", { class: "panel" }, h("div", { class: "panel-h" }, h("span", null, "text_stats.ts · 本机实测可用的完整扩展"), h("span", null, "35 行")), h("div", { class: "codeview" }, h("div", { class: "src" }, rows), note));
  }

  // ================= §3 result judge =================
  const JUDGE = [
    { q: "execute 里写 return { content: [{ type: \"text\", text: \"错误：找不到文件\" }], details: {} }。pi 把这次结果标成：", opts: [{ t: "isError: false（只是一段文字）", ok: true }, { t: "isError: true" }], why: "pi 文档：返回对象不会被标记为错误。要表示失败，就 throw。" },
    { q: "execute 里 throw new Error(\"磁盘已满\")。模型收到：", opts: [{ t: "一条 isError: true 的工具结果，内容是错误信息", ok: true }, { t: "什么都收不到，pi 崩溃" }, { t: "pi 自动重试三次" }], why: "本机实测：ENOENT 错误原文进入了结果，isError 为 true。" },
    { q: "details: { lines: 4 } 里的数据，模型能看到吗？", opts: [{ t: "看不到。details 给界面和状态用", ok: true }, { t: "能，和 content 一起发送" }], why: "只有 content 进入上下文。" },
    { q: "你的工具可能返回一万行日志。应该：", opts: [{ t: "截断后再返回，并告诉模型完整输出存在哪个文件", ok: true }, { t: "原样返回，模型会自己忽略多余部分" }], why: "每一行都进上下文并每轮重发（M1）。pi 导出了 truncateHead 等工具函数和 DEFAULT_MAX_LINES 等常量。" },
    { q: "模型在一次回复里同时调用了你的工具两次。它们：", opts: [{ t: "可能并行执行，彼此不能假设先后", ok: true }, { t: "一定按顺序执行" }], why: "pi 文档：同一条回复里的工具调用可能并行。改文件的工具要用 withFileMutationQueue 包住读-改-写。" },
  ];

  // ================= §4 schema playground =================
  function schemaLab() {
    const fields = [{ name: "path", type: "string", desc: "文件路径", opt: false }, { name: "max_lines", type: "number", desc: "最多统计多少行", opt: true }];
    const box = h("div", { class: "fields" }), tsPre = h("pre"), jsPre = h("pre");
    const TB = { string: "Type.String", number: "Type.Number", integer: "Type.Integer", boolean: "Type.Boolean", "string[]": "Type.Array" };
    function paint() {
      box.replaceChildren(...fields.map((f, i) => {
        const nm = h("input", { value: f.name, "aria-label": "参数名" }); nm.addEventListener("input", () => { f.name = nm.value; out(); });
        const ty = h("select", { "aria-label": "类型" }, Object.keys(TB).map((t) => h("option", { value: t, selected: f.type === t || null }, t))); ty.addEventListener("change", () => { f.type = ty.value; out(); });
        const del = h("button", { class: "btn ghost", style: { padding: "2px 6px" }, onclick: () => { fields.splice(i, 1); paint(); }, "aria-label": "删除" }, "×");
        const ds = h("input", { value: f.desc, "aria-label": "说明", placeholder: "说明（给模型看）" }); ds.addEventListener("input", () => { f.desc = ds.value; out(); });
        const op = h("input", { type: "checkbox", checked: f.opt || null }); op.addEventListener("change", () => { f.opt = op.checked; out(); });
        return h("div", { class: "fld" }, nm, ty, del, h("div", { class: "opt" }, ds, h("label", null, op, "可选")));
      }), h("button", { class: "btn", onclick: () => { fields.push({ name: "arg" + (fields.length + 1), type: "string", desc: "", opt: false }); paint(); } }, "＋ 加一个参数"));
      out();
    }
    function out() {
      const ts = fields.map((f) => {
        const d = f.desc ? `{ description: ${JSON.stringify(f.desc)} }` : "";
        let t = f.type === "string[]" ? `Type.Array(Type.String()${d ? ", " + d : ""})` : `${TB[f.type]}(${d})`;
        if (f.opt) t = `Type.Optional(${t})`;
        return `  ${f.name || "?"}: ${t},`;
      });
      tsPre.textContent = "parameters: Type.Object({\n" + ts.join("\n") + "\n}),";
      const props = {}, req = [];
      fields.forEach((f) => { const s = f.type === "string[]" ? { type: "array", items: { type: "string" } } : { type: f.type }; if (f.desc) s.description = f.desc; props[f.name || "?"] = s; if (!f.opt) req.push(f.name || "?"); });
      const js = { type: "object", properties: props }; if (req.length) js.required = req;
      jsPre.textContent = "// 发给提供者的 JSON Schema\n" + JSON.stringify(js, null, 2);
      Store.set(ID, "schema", { used: 1 });
    }
    paint();
    return h("div", { class: "panel schema" }, box, tsPre, jsPre);
  }

  // ================= §8 lab =================
  const LAB_SETUP = `mkdir -p ~/pi-lab/m9 && cd ~/pi-lab/m9
printf '春眠不觉晓，\\n处处闻啼鸟。\\n夜来风雨声，\\n花落知多少。\\n' > poem.txt
cat > text_stats.ts <<'EOF'
${SRC}
EOF`;
  const LAB_RUN = `ask(){ pi --mode json --no-session -e ./text_stats.ts --tools read,text_stats "$1" < /dev/null | jq -r 'if .type=="tool_execution_end" then "工具 \\(.toolName) 错误=\\(.isError) 结果=\\(.result.content[0].text | .[0:40])" elif .type=="turn_end" then "回复 \\([.message.content[] | .text? // empty] | join("") | .[0:40])" else empty end'; }
ask "poem.txt 有多少个汉字？"
ask "用 text_stats 统计 missing.txt。"`;
  const LAB_TUI = "pi --no-session -e ./text_stats.ts";
  const LAB_EDIT = `sed -i 's/    label: "文本统计",/    label: "文本统计",\\n    promptSnippet: "统计文本文件的行数、字符数和汉字数。",/' text_stats.ts
grep -n promptSnippet text_stats.ts
pi --mode json --no-session -e ./text_stats.ts --tools read,text_stats "只回答：好" < /dev/null | jq -r 'select(.type=="message_end" and .message.role=="system") | "清单里有 text_stats：\\(.message.sections.tools | test("text_stats"))"'`;
  const LAB_CLEAN = "cd ~ && rm -r ~/pi-lab/m9 && rmdir --ignore-fail-on-non-empty ~/pi-lab";
  const LAB_SAMPLE = `工具 text_stats 错误=false 结果=poem.txt：4 行，24 个字符，其中汉字 20 个。
回复
回复 \`poem.txt\` 有 20 个汉字。
工具 text_stats 错误=true 结果=ENOENT: no such file or directory, open
回复
回复 无法统计：\`missing.txt\` 不存在（ENOENT）。
清单里有 text_stats：true`;
  function lab() {
    const saved = Store.get(ID, "lab", {});
    const ta = h("textarea", { class: "paste", id: "m9-lab-paste", spellcheck: "false", placeholder: "工具 text_stats 错误=false 结果=…\n…\n清单里有 text_stats：true" });
    ta.value = saved.raw || "";
    ta.addEventListener("input", () => { delete ta.dataset.sample; });
    const out = h("div");
    const verify = (sample) => {
      if (sample) { ta.value = LAB_SAMPLE; ta.dataset.sample = "1"; }
      const isSample = ta.dataset.sample === "1";
      const L = ta.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      const tl = L.filter((l) => l.startsWith("工具 text_stats"));
      const checks = [
        [tl.some((l) => /错误=false/.test(l) && /汉字 20 个/.test(l)), "模型调用了 text_stats，拿到「汉字 20 个」"],
        [tl.some((l) => /错误=true/.test(l)), "文件不存在时，结果被标记为错误（错误=true）"],
        [L.filter((l) => l.startsWith("回复 ") && l.length > 3).length >= 2, "两个问题都得到了回复"],
        [L.some((l) => /清单里有 text_stats：true/.test(l)), "加上 promptSnippet 后，工具出现在系统提示的清单里"],
      ];
      const ok = checks.every((c) => c[0]);
      if (ok && !isSample) { Store.set(ID, "lab", { raw: ta.value, passed: true }); checkDone(); }
      out.replaceChildren(h("ul", { class: "check-list" }, checks.map(([o, t]) => h("li", null, h("span", { class: o ? "ok" : "no" }, o ? "✓" : "✗"), t))),
        ok ? h("div", { class: "note" }, h("span", { class: "k" }, isSample ? "示例数据" : "实验通过"), isSample ? "示例数据全部满足条件，但不计入实验。请用你自己的运行再做一次。" : "你写出了第一个扩展：一个真正的新工具，一个命令，还改过它一次。最后一步：清理。")
          : h("div", { class: "note warn" }, h("span", { class: "k" }, "没有全部通过"), "缺最后一行：确认运行了第 4 步的三行命令。第一项不对：确认 poem.txt 是第 1 步生成的。"));
    };
    if (saved.raw) setTimeout(() => verify(false), 0);
    return h("div", { class: "lab-steps" },
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "建实验目录：一首诗，一个扩展。"), h("p", { class: "dim", style: { margin: "4px 0 0" } }, "扩展就是上面那 35 行。整段复制运行。"), copyBlock(LAB_SETUP))),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "用 -e 加载扩展，问两个问题：一个正常，一个会出错。"),
        h("p", { class: "dim", style: { margin: "4px 0 0" } }, "--tools read,text_stats 只开两个工具，模型没有 bash，只能用你的工具数字。共 2 次很小的模型调用。"), copyBlock(LAB_RUN))),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "（可选）在交互界面里看：输入 /stats-help 回车，看弹出的提示；再问「poem.txt 有多少个汉字？」，看工具卡片。Ctrl+D 退出。"), copyBlock(LAB_TUI))),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "改扩展：加一行 promptSnippet，验证它进入了系统提示的工具清单。"),
        h("p", { class: "dim", style: { margin: "4px 0 0" } }, "第一行用 sed 在 label 后面插入一行；第二行显示插入的位置；第三行检查清单。一次很小的模型调用。"), copyBlock(LAB_EDIT))),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "把第 2 步和第 4 步的输出一起粘贴，核对。"), h("div", { style: { marginTop: "8px" } }, ta),
        h("div", { style: { display: "flex", gap: "8px", marginTop: "8px" } }, h("button", { class: "btn primary", onclick: () => verify(false) }, "核对我的运行"), h("button", { class: "btn ghost", onclick: () => verify(true) }, "先用示例数据试试")), out)),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "清理。"), copyBlock(LAB_CLEAN))));
  }

  // ================= quiz / review / recap =================
  const QUIZ = [
    { q: "扩展和 Skill 的根本区别：", opts: [{ t: "扩展是在 pi 进程里运行的代码，能增加真正的能力", ok: true }, { t: "扩展更长" }, { t: "扩展只能写在全局目录" }], why: "Skill 是说明书；扩展能注册工具、命令、事件处理器。" },
    { q: "扩展的入口是：", opts: [{ t: "默认导出的函数，pi 调用时传入 ExtensionAPI", ok: true }, { t: "一个 main() 函数" }, { t: "package.json 的 scripts" }], why: "export default function (pi: ExtensionAPI) { … }" },
    { q: "临时试一个扩展文件，不装到任何地方：", opts: [{ t: "pi -e ./my-ext.ts", ok: true }, { t: "pi install ./my-ext.ts" }, { t: "复制到 ~/.pi/agent/extensions 后重启电脑" }], why: "-e 只对本次运行生效。长期使用放进 ~/.pi/agent/extensions/ 或项目的 .pi/extensions/。" },
    { q: "工具的 description 和 parameters 最终去了哪里？", opts: [{ t: "请求的 tools 数组，作为 JSON Schema", ok: true }, { t: "系统提示的规则段" }, { t: "只在 pi 本地使用" }], why: "本机用假模型抓到：{\"name\":\"text_stats\",\"description\":…,\"parameters\":{\"type\":\"object\",…}}。" },
    { q: "扩展工具默认会出现在系统提示的文字版工具清单里吗？", opts: [{ t: "不会，除非写了 promptSnippet", ok: true }, { t: "会" }], why: "本机实测：加 promptSnippet 前 false，加后 true。promptGuidelines 则往规则段追加条目。" },
    { q: "要让工具报告「失败」，应该：", opts: [{ t: "在 execute 里 throw", ok: true }, { t: "返回一段写着「失败」的文字" }, { t: "返回 null" }], why: "返回对象不会被标记为错误。" },
    { q: "execute 第五个参数 ctx.cwd 是：", opts: [{ t: "pi 的工作目录", ok: true }, { t: "扩展文件所在的目录" }, { t: "~/.pi/agent" }], why: "所以 text_stats 的 path 按你启动 pi 的目录解析。" },
    { q: "/stats-help 这种扩展命令运行时：", opts: [{ t: "在 pi 进程里执行，不经过模型，不花 token", ok: true }, { t: "把文字发给模型" }, { t: "必须有工具调用" }], why: "提示模板发给模型；扩展命令执行代码。" },
    { q: "项目的 .pi/extensions/ 里的扩展：", opts: [{ t: "只在信任项目后加载", ok: true }, { t: "总是加载" }, { t: "永远不会加载" }], why: "扩展是代码，能用你的权限做任何事。这是项目信任要保护的头号对象（M5）。" },
    { q: "扩展里想在会话开始时启动一个文件监视器。放在哪里？", opts: [{ t: "session_start 事件的处理器里，并在 session_shutdown 里关闭", ok: true }, { t: "工厂函数的顶层" }], why: "有些场合只加载扩展而不开会话。M10 讲事件。" },
  ];
  const REVIEW = [
    { q: "（复习 M8）Skill 能让 pi 获得新工具吗？", opts: [{ t: "不能", ok: true }, { t: "能" }], why: "Skill 是文字。本课第一次真正增加工具。" },
    { q: "（复习 M0）模型怎样使用一个工具？", opts: [{ t: "在回复里写出工具调用，由 pi 执行", ok: true }, { t: "模型直接运行工具的代码" }], why: "你写的 execute 由 pi 执行，模型只看到 content。" },
  ];
  const PRE = [
    { id: "p1", q: "一个 30 多行的 TypeScript 文件，能给 pi 增加一个新工具吗？", opts: [{ t: "能", ok: true }, { t: "不能，要改 pi 源码" }] },
    { id: "p2", q: "扩展里 throw 一个错误，会：", opts: [{ t: "让 pi 崩溃" }, { t: "变成一条错误的工具结果交给模型", ok: true }] },
    { id: "p3", q: "工具返回的 details 字段，模型能看到吗？", opts: [{ t: "能" }, { t: "不能", ok: true }] },
  ];
  function checkDone() {
    const ok = Store.get(ID, "lab", {}).passed && Store.get(ID, "quiz", { best: 0 }).best >= 8;
    if (ok && !Store.get(ID, "done")) Store.set(ID, "done", true);
  }

  window.Course.register(ID, (page) => {
    const rc = window.Course.recapBlock(ID, {
      pre: PRE,
      next: { id: "M10", title: "扩展 II：事件与状态", text: "你已经会加工具。M10 讲扩展的另一半：在 agent loop 的每个接缝上插手——拦截危险命令、改写上下文、让状态跟着会话树走。" },
      extra: () => [["代码要点", Object.keys(Store.get(ID, "parts", {})).length + " / " + PARTS.length], ["结果判断", JUDGE.filter((j, i) => j.opts[Store.get(ID, "judge", {})["j" + i]]?.ok).length + " / " + JUDGE.length]],
    });
    page.append(h("div", { class: "bench" },
      h("header", { class: "mhead" }, h("div", { class: "crumbs" }, "第 4 单元 · 扩展 / M9"), h("h1", { class: "mtitle" }, h("span", { class: "mid" }, "M9"), "扩展 I：工具与命令")),
      section("s-hero", 0, "开场", null, codeView(),
        h("div", { class: "col" },
          h("p", { class: "thesis" }, "从这里开始，你写的是代码。", h("br"), "代码能给模型真正的新能力。"),
          h("p", { class: "lead" }, "M7、M8 写的都是文字。本课跨过能力阶梯的那条线：上面 35 行 TypeScript 给 pi 增加了一个工具和一个命令，本机实测可用。逐行点开，读懂每一部分。")),
        h("div", { class: "panel objectives" },
          h("ol", null,
            h("li", null, "说出扩展的形态、加载方式和运行权限。"),
            h("li", null, "写出一个工具：名字、描述、参数格式、execute。"),
            h("li", null, "正确返回结果：content 与 details 的区别，用 throw 表示失败，大输出要截断。"),
            h("li", null, "写出一个命令，并说出它和提示模板的区别。"),
            h("li", null, "用 promptSnippet / promptGuidelines 控制工具在系统提示里的呈现。")),
          h("div", { class: "obj-side" },
            h("div", null, h("span", { class: "k" }, "时长"), "约 75 分钟"),
            h("div", null, h("span", { class: "k" }, "前置"), "M8；会读 TypeScript"),
            h("div", null, h("span", { class: "k" }, "练习"), "§8 实验 + §9 测验（≥ 8/10）"),
            h("div", null, h("span", { class: "k" }, "核对版本"), "pi 0.99.2 · extensions/types.d.ts"))),
        h("h3", null, "本课路线"),
        route(ID, [["s-pre", 1, "动手", "复习与预测"], ["s-what", 2, "阅读", "扩展是什么"], ["s-result", 3, "动手", "工具的结果"], ["s-schema", 4, "动手", "参数格式"], ["s-cmd", 5, "阅读", "命令"], ["s-prompt", 6, "阅读", "在提示里露面"], ["s-safe", 7, "阅读", "权限与生命周期"], ["s-lab", 8, "实验", "写一个扩展"], ["s-quiz", 9, "测验", "10 题"], ["s-recap", 10, "阅读", "小结"]])),
      h("div", { class: "col" },
        section("s-pre", 1, "复习与预测", "先复习，再预测",
          todo("两道复习题立即判分；三道预测课末揭晓。"),
          REVIEW.map((r, i) => choice({ id: "r" + i, store: [ID, "rev"], kicker: "复习 " + (i + 1) + " / 2", q: r.q, opts: r.opts, explain: r.why, shuffleSeed: 171 + i * 7 })),
          PRE.map((p, i) => choice({ id: p.id, store: [ID, "pre"], kicker: "预测 " + (i + 1) + " / 3", q: p.q, opts: p.opts, reveal: false, shuffleSeed: 87 + i * 13 }))),
        section("s-what", 2, "扩展是什么", "一段 pi 启动时执行的代码",
          todo("先看扩展从加载到生效的四步，再读三个要点，最后看它可以放在哪里。", true),
          h("p", null, "M7、M8 写的 AGENTS.md 和 Skill 都是文字：模型读了，可能照做，也可能不照做。扩展不一样，它是代码，pi 启动时真的会执行它。所以它能给 pi 加上原本没有的东西，比如一个新工具、一个新命令。"),
          h("p", null, "可以拿浏览器插件来类比：浏览器启动时加载插件，插件往浏览器里加按钮。pi 启动时加载扩展，扩展往 pi 里加工具和命令。"))),
      h("div", { class: "bench" }, h("div", { class: "panel journey", style: { marginTop: "8px" } },
        [["1", "找到文件", "pi 启动时，去扩展目录里找 .ts 文件；或者加载你用 -e 指定的那个文件。"],
         ["2", "直接运行", "pi 直接运行 TypeScript，不需要你先编译，也不需要 npm install。"],
         ["3", "调用你的函数", "你的文件导出一个函数。pi 调用它，并把一个叫 pi 的对象交给你。"],
         ["4", "注册能力", "你在函数里调用 pi.registerTool(…)、pi.registerCommand(…)。从这一刻起，模型能看到新工具，你能用新命令。"]]
          .map(([n, t, d]) => h("div", { class: "st" }, h("div", { class: "n" }, "第 " + n + " 步"), h("div", { class: "tt" }, t), h("p", null, d))))),
      h("div", { class: "col" },
          h("h3", null, "三个要点"),
          h("ul", { class: "rule" },
            h("li", null, h("b", null, "形态：一个文件，默认导出一个函数。"), "函数收到的参数 pi 是 pi 交给你的「遥控器」，它的类型名叫 ExtensionAPI，上面有 registerTool、registerCommand 等方法。本课只用这两个；其余的（比如监听事件的 on）在 M10 讲。"),
            h("li", null, h("b", null, "不用编译，也不用装依赖。"), "pi 内部用一个叫 jiti 的工具直接运行 .ts 文件。本机实测：一个单独的 .ts 文件，旁边没有 node_modules（npm 装依赖的那个文件夹），也能导入 typebox（写参数格式的库，§4 讲）和 pi 自己的类型，因为这两样 pi 自带。只有想用别的第三方库时，才需要在旁边放 package.json 并安装，或者做成包（M11）。"),
            h("li", null, h("b", null, "权限：它能做你能做的一切。"), "扩展没有沙箱，它和 pi 在同一个进程里，用的是你的权限：能读你的文件、能读 auth.json（里面存着你的登录凭证）、能执行任何命令。文字最多误导模型，代码可以直接动手。所以只加载你信任的来源。")),
          h("h3", null, "放在哪里"),
          h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" },
            h("thead", null, h("tr", null, h("th", null, "方式"), h("th", null, "对谁生效"), h("th", null, "什么时候用"))),
            h("tbody", null,
            [["pi -e ./x.ts", "只这一次运行", "写扩展、调试的时候。本课实验就用它。可以写多个 -e。"],
             ["~/.pi/agent/extensions/", "你的所有项目", "调好了，想每次启动都带上。放 .ts / .js 文件，或者带 index.ts 的子文件夹。"],
             [".pi/extensions/", "只有当前项目", "跟这个项目绑定的扩展。第一次加载时 pi 会问你是否信任（M5）。"],
             ["settings.json 的 extensions", "看你写在哪层设置", "想从别的位置加载时，在设置里写上路径（M5 的资源列表，两层合并）。"]]
              .map(([a, b, c]) => h("tr", null, h("td", { style: { whiteSpace: "nowrap" } }, h("code", null, a)), h("td", { style: { whiteSpace: "nowrap" } }, b), h("td", null, c)))))),
          h("div", { class: "note" }, h("span", { class: "k" }, "初学建议"), "这一课只用 ", h("code", null, "pi -e"), "。改完扩展后，在 pi 里输入 ", h("code", null, "/reload"), " 就能重新加载，不必退出。别的位置等扩展写稳了再用。")),
      h("div", { class: "col" },
        section("s-result", 3, "工具的结果", "模型看到什么，不看到什么",
          todo("先读五条规则，再做五道判断题。"),
          h("ul", { class: "rule" },
            h("li", null, h("b", null, "成功：返回一个对象。"), "execute 返回 { content: [...], details: {...} }。即使 content 里写着「错误」，pi 也把它当作正常结果（isError: false）。"),
            h("li", null, h("b", null, "失败：抛出异常。"), "在 execute 里 throw new Error(\"…\")，模型收到一条 isError: true 的工具结果，内容就是错误信息。pi 不会崩溃，也不会自动重试。"),
            h("li", null, h("b", null, "模型只看 content。"), "details 留给界面显示和扩展自己的状态，不进上下文。"),
            h("li", null, h("b", null, "结果要短。"), "content 进入上下文后每轮重发（第 2 课）。输出很长时先截断，并告诉模型完整内容存在哪个文件；pi 导出了 truncateHead 等工具函数和 DEFAULT_MAX_LINES 等常量。"),
            h("li", null, h("b", null, "可能并行。"), "同一条回复里的多个工具调用可能同时执行，不能假设先后。改文件的工具要用 withFileMutationQueue 把「读—改—写」包起来。")),
          JUDGE.map((j, i) => choice({ id: "j" + i, store: [ID, "judge"], kicker: "判断 " + (i + 1) + " / " + JUDGE.length, q: j.q, opts: j.opts, explain: j.why, shuffleSeed: 181 + i * 3 }))),
        section("s-schema", 4, "参数格式", "TypeBox 写，JSON Schema 发",
          todo("改参数名、类型、说明、是否可选，看两边的代码怎样变化。", true),
          h("p", null, "parameters 用 TypeBox 写。pi 把它转成 JSON Schema 放进请求（M6 抓到过）。模型按 Schema 写参数；pi 执行前先校验，不合格的调用不会进入 execute。"))),
      h("div", { class: "bench" }, schemaLab()),
      h("div", { class: "col" },
        h("p", { class: "mute", style: { fontSize: "15px", marginTop: "8px" } }, "参数说明（description）写给模型看，和工具的 description 一样重要。可选参数用 Type.Optional 包起来；它不进 required。"),
        section("s-cmd", 5, "命令", "给你用的，不是给模型用的",
          todo("读对比表。", true),
          h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" },
            h("thead", null, h("tr", null, h("th", null, ""), h("th", null, "提示模板 /review"), h("th", null, "扩展命令 /stats-help"))),
            h("tbody", null,
              h("tr", null, h("td", null, "本质"), h("td", null, "一段文字"), h("td", null, "一个函数")),
              h("tr", null, h("td", null, "运行时"), h("td", null, "展开成消息发给模型"), h("td", null, "在 pi 进程里执行")),
              h("tr", null, h("td", null, "花 token"), h("td", null, "是"), h("td", null, "否（除非它自己发消息）")),
              h("tr", null, h("td", null, "能做的事"), h("td", null, "让模型做事"), h("td", null, "任何代码能做的事：弹窗确认、切模型、发消息、读写文件"))))),
          h("p", null, "命令的 handler 收到参数字符串和 ctx。ctx.ui 提供 notify、confirm、select 等界面能力；命令还可以用 pi.sendUserMessage() 替你给模型发消息。同类的注册接口还有 registerShortcut（快捷键）和 registerFlag（命令行参数）。")),
        section("s-prompt", 6, "在提示里露面", "promptSnippet 与 promptGuidelines",
          todo("读本机实测的发现。实验第 4 步会亲手验证。", true),
          h("p", null, "扩展工具一定会进入请求的 tools 数组。但系统提示里那份文字版工具清单，默认", h("b", null, "不列"), "扩展工具。本机实测：text_stats 加载后，清单里只有 read。"),
          h("ul", { class: "rule" },
            h("li", null, h("code", null, "promptSnippet"), "：一行文字。写了，工具就出现在清单里。你装的联网扩展就写了它，所以 web_search 在清单里。"),
            h("li", null, h("code", null, "promptGuidelines"), "：若干条规则。工具启用时，追加到系统提示的规则段。")),
          h("p", { class: "dim" }, "要不要写？工具的 description 已经在 tools 数组里，多数时候够用。当模型总是忘了用你的工具，再加 promptSnippet 或 promptGuidelines 提醒它。注意它们每轮都花 token（M1）。")),
        section("s-safe", 7, "权限与生命周期", "写扩展前要知道的三件事",
          todo("记住这三条。", true),
          h("ul", { class: "rule" },
            h("li", null, h("b", null, "它能做你能做的一切："), "包括读 ~/.pi/agent/auth.json。别人的扩展先读源码再装。项目扩展受信任保护（M5）。"),
            h("li", null, h("b", null, "工厂函数里只注册："), "不要启动进程、定时器、文件监视。有些场合只加载扩展、不开会话。长期资源在 session_start 里启动，在 session_shutdown 里关闭（M10）。"),
            h("li", null, h("b", null, "改文件的工具要排队："), "同一回复里的工具调用可能并行。读-改-写一个文件时，用 pi 导出的 withFileMutationQueue 包住。"))),
        section("s-lab", 8, "实验", "写、跑、改一个扩展",
          todo("按第 1–6 步操作。第 3 步可选。"),
          h("p", null, "你会运行开场那 35 行扩展，确认它在正常和出错两种情况下的行为，再改一行，让它出现在系统提示里。"),
          h("div", { class: "note" }, h("span", { class: "k" }, "实验规则"), "只在 ~/pi-lab/m9 里做；扩展用 -e 临时加载，不装进 ~/.pi；--no-session 不留会话；最后清理。"),
          lab()),
        section("s-quiz", 9, "掌握测验", "10 题，8 题过关", todo("10 题全部作答，点「交卷」。"), window.Course.quizBlock(ID, QUIZ, checkDone)),
        section("s-recap", 10, "小结", "你学到了什么",
          todo("看自己的预测和成绩。觉得学会了，就在本节最后点「标记为已完成」。", true),
          h("p", { class: "lead" }, "一句话：扩展是 pi 进程里的 TypeScript；registerTool 给模型新能力（content 给模型、details 给界面、throw 表示失败），registerCommand 给你新命令；它用你的权限运行。"),
          rc))));
    return () => rc._cleanup && rc._cleanup();
  });
})();
