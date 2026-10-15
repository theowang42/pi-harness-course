/* M4 · 压缩 */
(function () {
  "use strict";
  const { h, section, quizBlock, lessonHead, look, howto, endBlock } = window.Course;
  const ID = "M4";
  const fmt = (n) => Math.round(n).toLocaleString("en-US");

  // A real /compact (pi 0.99.2, gpt-6-astra) with keepRecentTokens = 1500 so a small session shows the effect.
  // real ≈ each entry's share of the provider-reported context.
  const ENT = [
    ["user", "我最喜欢的颜色是蓝色。只回答：记住了", 20],
    ["assistant", "记住了", 15],
    ["user", "用 read 读 big.txt 的第 1 到 200 行", 25],
    ["assistant", "read(big.txt, 第 1–200 行)", 25],
    ["toolResult", "200 行文字", 4000],
    ["assistant", "读完", 10],
    ["user", "用 read 读 big.txt 的第 201 到 400 行", 25],
    ["assistant", "read(big.txt, 第 201–400 行)", 25],
    ["toolResult", "200 行文字", 4000],
    ["assistant", "读完", 10],
  ].map(([role, text, real]) => ({ role, text, real }));
  const FIX = 2690, SUM = 326, BEFORE = 10869, AFTER = 7086, CUT = 5;
  const CLS = { user: "user", assistant: "asst", toolResult: "tool" };
  const WHO = { user: "你", assistant: "模型", toolResult: "工具结果" };

  function beforeAfter() {
    let stage = "before";
    const strip = h("div", { class: "strip", role: "img", "aria-label": "会话各部分占用的上下文" });
    const big = h("div", { class: "bill-total" }), note = h("p", { class: "dim", style: { margin: "10px 0 0", fontSize: "16px" } });
    const KEYS = ["before", "after", "file"];
    const btns = [["before", "压缩前"], ["after", "压缩后：模型看到的"], ["file", "压缩后：文件里的"]].map(([k, t]) => h("button", { class: "btn" + (k === stage ? " primary" : ""), onclick: () => { stage = k; btns.forEach((b, i) => (b.className = "btn" + (KEYS[i] === k ? " primary" : ""))); paint(); } }, t));
    const seg = (cls, w, top, sub) => h("div", { class: "e " + cls, style: { flexBasis: (w / BEFORE) * 100 + "%" }, title: top + " · " + sub }, h("b", null, top), h("span", null, sub));
    function paint() {
      const parts = [seg("fx", FIX, fmt(FIX), "固定部分")];
      if (stage === "after") parts.push(seg("sum", SUM, "摘要", ""));
      ENT.forEach((e, i) => {
        if (stage === "after" && i < CUT) return;
        parts.push(seg(CLS[e.role], Math.max(e.real, 60), e.real >= 1000 ? fmt(e.real) : "", e.real >= 1000 ? WHO[e.role] : ""));
      });
      if (stage === "file") parts.push(seg("sum", 260, "摘要", "记录"));
      strip.replaceChildren(...parts);
      if (stage === "file") [...strip.children].forEach((c, i) => { if (i >= 1 && i <= CUT) c.classList.add("gone"); });
      big.replaceChildren(h("span", { class: "v" }, fmt(stage === "before" ? BEFORE : AFTER)), h("span", { class: "u" }, stage === "before" ? "token · 压缩前，下一次请求的大小" : "token · 压缩后，下一次请求的大小"));
      note.textContent = stage === "before" ? "三轮对话：说了喜欢的颜色、读前 200 行、读后 200 行。两段文件内容占了大头。" :
        stage === "after" ? "切点之前的部分换成了一小段摘要（斜纹），之后的原样保留。前 200 行的原文不见了，后 200 行还在。" :
        "文件只追加：原来的记录一条不少（变淡的部分），末尾多了一条摘要记录。只是模型不再看到变淡的部分。";
    }
    paint();
    return h("div", { class: "panel bill" },
      h("div", { class: "hero-lbl" }, h("span", null, "一次真实的 /compact"), h("div", { class: "stage-btns" }, btns)),
      h("div", { style: { marginTop: "12px" } }, big), h("div", { style: { marginTop: "14px" } }, strip), note,
      h("div", { class: "win-legend", style: { marginTop: "10px" } }, [["var(--c-harness)", "固定部分"], ["var(--c-user)", "你"], ["var(--c-model)", "模型"], ["var(--c-tool)", "工具结果"]].map(([c, t]) => h("span", null, h("i", { style: { background: c } }), t))));
  }

  const SUMMARY = `## Goal
Record the user’s favorite color and acknowledge it.

## Constraints & Preferences
- The user’s favorite color is blue (蓝色).

## Progress
### Done
- [x] Assistant replied exactly: “记住了”.

## Next Steps
1. Retain the user’s favorite color for future context.

## Critical Context
- 用户最喜欢的颜色是蓝色。

---

**Turn Context (split turn):**

## Original Request
用户要求用 \`read\` 读取 \`big.txt\` 第 1–200 行，读完只回答“读完”。

## Progress So Far
- 已调用 \`read(path="big.txt", offset=1, limit=200)\`。

<read-files>
big.txt
</read-files>`;
  function summaryView() {
    const pre = h("div", { class: "sumtext", style: { maxHeight: "none" } });
    SUMMARY.split(/(用户最喜欢的颜色是蓝色。|<read-files>)/).forEach((p, i) => pre.append(i % 2 ? h("mark", null, p) : p));
    return h("div", { class: "panel" }, h("div", { class: "panel-h" }, h("span", null, "上面那次压缩生成的摘要（原文，略去空段）")), pre);
  }

  const QUIZ = [
    { q: "压缩之后，被换成摘要的那些原始消息：", opts: [{ t: "仍在会话文件里，只是不再发给模型", ok: true }, { t: "被删除了" }, { t: "被移到另一个文件" }], why: "压缩只在文件末尾追加一条摘要记录，并标出从哪条开始保留。" },
    { q: "自动压缩在什么时候发生？", opts: [{ t: "上下文快装满时（超过窗口减去留给回复的空间）", ok: true }, { t: "每 20 轮一次" }, { t: "每次你发消息前" }], why: "默认留 16,384 token 给回复。上下文超过「窗口 − 16,384」，pi 就在下一次请求前压缩。" },
    { q: "压缩后，模型还能说出被压缩部分里的原文细节吗（比如某个文件的第 150 行）？", opts: [{ t: "通常不能，除非摘要里写了；要细节得让它重新读", ok: true }, { t: "能，摘要包含全部原文" }, { t: "能，模型记得之前读过的内容" }], why: "摘要只保留要点。原文细节会丢，这是压缩的代价。" },
    { q: "怎样确保压缩后某个关键结论不会丢？", opts: [{ t: "手动 /compact，在后面写明要保留什么", ok: true }, { t: "关掉自动压缩" }, { t: "把窗口调大" }], why: "附带的说明会让摘要专门写下这些内容。" },
    { q: "你发现最近三轮走错了方向，想回到三轮之前重来。用哪个？", opts: [{ t: "/tree 回到三轮之前，离开时选 Summarize", ok: true }, { t: "/compact" }, { t: "什么也不做，等自动压缩" }], why: "压缩保留的恰好是最近的消息，也就是走错的那三轮。要「离开这条路、只带走教训」，用第 4 课的分支摘要。" },
  ];

  window.Course.register(ID, (page) => {
    page.append(h("div", { class: "col" },
      lessonHead(ID, [
        h("p", null, "第 2 课说过：对话越长，请求越大，迟早会碰到模型的窗口上限。到那时，pi 不会让请求失败，而是", h("b", null, "压缩"), "：把较早的对话换成一段摘要，只保留最近的原文。"),
        h("p", null, "压缩省下了上下文，代价是丢掉细节。这一课讲压缩什么时候发生、留下什么、丢掉什么，以及你怎样控制它。"),
      ], [
        "压缩前后，模型看到的内容有什么不同；原始记录去了哪里。",
        "自动压缩什么时候发生，切在哪里。",
        "怎样用 /compact 保住关键内容；什么时候该压缩，什么时候该开新会话或回到过去。",
      ]),

      section("s-what", 1, "压缩", "压缩做了什么",
        h("p", null, "压缩分三步：pi 从最新的消息往回数，留下最近的一部分原文（默认约 20,000 token）；把更早的部分交给模型，让它写成一段摘要；之后的请求里，用这段摘要代替那些早期消息。"),
        h("p", null, "切的位置总在消息之间，一个工具调用和它的结果不会被切到两边，否则模型会看到一个不知从哪来的结果。"),
        look("这是一次真实的压缩。为了让小会话也能看到效果，这里把「保留最近的原文」调成了 1,500 token。依次点三个按钮：压缩前、压缩后模型看到的、压缩后文件里的。")),
      h("div", { class: "bench" }, beforeAfter()),
      h("p", { style: { marginTop: "18px" } }, "请求从 10,869 降到 7,086 token。前 200 行的原文换成了摘要；后 200 行离得近，原样保留。文件里的原始记录都还在，用 /tree 仍然能看到它们，只是不再发给模型。"),

      section("s-summary", 2, "摘要", "摘要里有什么",
        h("p", null, "摘要由模型按固定的英文标题来写：目标、约束和偏好、进展、关键决定、下一步、关键上下文，最后列出读过和改过的文件（让模型知道细节该去哪里重新找）。"),
        look("看两处高亮：「蓝色」被专门写进了关键上下文，因为这次 /compact 后面附了一句「一定保留用户最喜欢的颜色」；末尾列出了读过的文件。"),
        summaryView(),
        h("p", { style: { marginTop: "14px" } }, "压缩之后再问模型：「我最喜欢的颜色是什么？big.txt 第 150 行写的是什么？」（不许它调用工具）。颜色答对了，因为摘要里写了；第 150 行答不出来，因为原文已被换掉。"),
        h("div", { class: "note warn" }, h("span", { class: "k" }, "压缩会丢细节"), "摘要只留要点。需要原文时，让模型重新读文件。真正重要的结论，用 /compact 的说明点名保留。")),

      section("s-when", 3, "时机", "什么时候发生，什么时候该你出手",
        h("p", null, "pi 在三种情况下压缩："),
        h("ul", { class: "rule" },
          h("li", null, h("b", null, "自动："), "上下文超过「窗口 − 留给回复的空间（默认 16,384）」，pi 在下一次请求前压缩。状态栏的 (auto) 表示它开着。"),
          h("li", null, h("b", null, "出错时补救："), "提供者报告「上下文太长」，pi 压缩一次后重试。"),
          h("li", null, h("b", null, "手动："), "你输入 /compact，后面可以写说明。关掉自动压缩后，手动仍然可用。")),
        h("p", null, "自动压缩只按默认格式写摘要，不知道哪些东西对你重要。下面几种情况，你应该自己做决定："),
        h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" },
          h("thead", null, h("tr", null, h("th", null, "情况"), h("th", null, "做法"), h("th", null, "原因"))),
          h("tbody", null,
            h("tr", null, h("td", null, "长任务做到一半，前面大量探索没用了，但有几个结论必须记住"), h("td", null, h("code", null, "/compact 保留……")), h("td", null, "用说明点名要保留的内容。")),
            h("tr", null, h("td", null, "下一件事和现在无关"), h("td", null, h("code", null, "/new")), h("td", null, "无关的历史即使压成摘要，也要每轮付费，还会干扰模型。")),
            h("tr", null, h("td", null, "最近几轮走错了路"), h("td", null, h("code", null, "/tree"), " + Summarize"), h("td", null, "压缩保留的恰好是最近几轮。要离开错路、只带走教训，用分支摘要（第 4 课）。")),
            h("tr", null, h("td", null, "上下文还很空"), h("td", null, "什么也不做"), h("td", null, "压缩要花一次模型调用，还会丢细节。")))))),

      section("s-cfg", 4, "设置", "可以调的设置",
        h("p", null, "压缩相关的设置写在 settings.json 里（全局的在 ~/.pi/agent/，项目的在项目目录的 .pi/ 下，第 6 课讲）。// 后面是说明，真实文件里要删掉："),
        h("pre", null, `{
  "compaction": {
    "enabled": true,           // 自动压缩开关；关掉后 /compact 仍可用
    "reserveTokens": 16384,    // 留给回复的空间；超过「窗口 − 它」就压缩
    "keepRecentTokens": 20000  // 压缩时保留多少最近的原文
  }
}`),
        h("p", null, "keepRecentTokens 越大，压缩后保留的原文越多，但腾出的空间越少，下一次压缩来得越快。"),
        h("p", { class: "dim" }, "注意：pi 按「约 4 个字符 = 1 个 token」估算要保留多少，这对英文和代码比较准；中文一个字常常就是一个 token，所以中文对话里实际保留的会比设置值多好几倍。中文为主的长会话，可以把 keepRecentTokens 调小一些。")),

      section("s-quiz", 5, "检查", "检查一下", quizBlock(ID, QUIZ, null, null)),

      section("s-end", 6, "小结", "小结",
        endBlock(ID, [
          "压缩把较早的对话换成一段摘要，保留最近的原文；原始记录仍在文件里，只是不再发给模型。",
          "上下文快满时自动压缩；也可以随时 /compact，并写明要保留什么。",
          "摘要会丢细节。换话题用 /new，走错路用 /tree 加分支摘要，不要指望压缩。",
        ], { id: "M5", text: "前面用到的 settings.json 从哪里来？全局和项目设置同时存在时，谁说了算？" }))));
  });
})();
