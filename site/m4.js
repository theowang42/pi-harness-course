/* M4 · 压缩 */
(function () {
  "use strict";
  const { h, $, $$, sleep, reduced, Store, choice, copyBlock, section, todo, route, term } = window.Course;
  const ID = "M4";
  const fmt = (n) => Math.round(n).toLocaleString("en-US");

  // Real session on this machine (pi 0.99.2, gpt-6-astra), keepRecentTokens = 1500 via project .pi/settings.json.
  // est = pi's own estimate, ceil(chars / 4). real ≈ share of the provider-reported context (request deltas).
  const ENT = [
    ["188477fc", "user", "我最喜欢的颜色是蓝色。只回答：记住了", 5, 20],
    ["8490ec06", "assistant", "记住了", 1, 15],
    ["477e2ba4", "user", "用 read 读 big.txt 的第 1 到 200 行", 10, 25],
    ["14fcf133", "assistant", "read(big.txt, 第 1–200 行)", 12, 25],
    ["7c655d1f", "toolResult", "200 行文字 · 5,146 字符", 1287, 4000],
    ["77f89e39", "assistant", "读完", 1, 10],
    ["d390c720", "user", "用 read 读 big.txt 的第 201 到 400 行", 10, 25],
    ["a3569f40", "assistant", "read(big.txt, 第 201–400 行)", 12, 25],
    ["1006ef7d", "toolResult", "200 行文字 · 5,252 字符", 1313, 4000],
    ["8003c879", "assistant", "读完", 1, 10],
  ].map(([id, role, text, est, real]) => ({ id, role, text, est, real }));
  const FIX_REAL = 2690, SUM_REAL = 326, BEFORE = 10869, AFTER = 7086, REAL_KEEP = 1500, REAL_CUT = "77f89e39";
  const CLS = { user: "user", assistant: "asst", toolResult: "tool" };
  const WHO = { user: "你", assistant: "模型", toolResult: "工具结果" };

  /** pi 0.99.2 findCutPoint: walk back summing estimates; at the entry where the sum reaches the budget,
   *  take the nearest valid cut point at or after it. Tool results are never cut points. */
  function findCut(entries, keep) {
    const cuts = entries.map((e, i) => (e.role === "toolResult" ? -1 : i)).filter((i) => i >= 0);
    const acc = Array(entries.length).fill(null);
    let sum = 0, hit = -1, cut = cuts[0];
    for (let i = entries.length - 1; i >= 0; i--) {
      sum += entries[i].est; acc[i] = sum;
      if (sum >= keep) { hit = i; cut = cuts.find((c) => c >= i) ?? cuts[cuts.length - 1]; break; }
    }
    const split = hit >= 0 && entries[cut].role !== "user";
    let turnStart = -1; if (split) for (let i = cut; i >= 0; i--) if (entries[i].role === "user") { turnStart = i; break; }
    return { cut: hit >= 0 ? cut : 0, hit, acc, split, turnStart, none: hit < 0 };
  }

  // ================= §0 hero =================
  function hero() {
    const cutI = ENT.findIndex((e) => e.id === REAL_CUT);
    let stage = "before";
    const strip = h("div", { class: "strip", role: "img", "aria-label": "会话各部分的上下文占用" });
    const big = h("div", { class: "bill-total" }), note = h("p", { class: "dim", style: { margin: "10px 0 0", fontSize: "16px" } });
    const btns = [["before", "压缩前"], ["after", "压缩后：模型看到的"], ["file", "压缩后：文件里的"]].map(([k, t]) => h("button", { class: "btn" + (k === stage ? " primary" : ""), onclick: () => { stage = k; btns.forEach((b, i) => b.className = "btn" + (["before", "after", "file"][i] === k ? " primary" : "")); paint(); } }, t));
    function seg(cls, w, top, sub, gone) { return h("div", { class: "e " + cls + (gone ? " gone" : ""), style: { flexBasis: (w / BEFORE) * 100 + "%" }, title: top + " · " + sub }, h("b", null, top), h("span", null, sub)); }
    function paint() {
      const parts = [seg("fx", FIX_REAL, fmt(FIX_REAL), "固定成本")];
      if (stage === "after") parts.push(seg("sum", SUM_REAL, "摘要", "约 " + SUM_REAL));
      ENT.forEach((e, i) => {
        const summarized = i < cutI;
        if (stage === "after" && summarized) return;
        parts.push(seg(CLS[e.role], Math.max(e.real, 60), e.real >= 1000 ? fmt(e.real) : "", e.real >= 1000 ? WHO[e.role] : "", stage === "file" ? false : false));
      });
      if (stage === "file") parts.push(seg("sum", 260, "压缩", "记录"));
      strip.replaceChildren(...parts);
      if (stage === "file") [...strip.children].forEach((c, i) => { if (i >= 1 && i <= cutI) c.classList.add("gone"); });
      const v = stage === "before" ? BEFORE : AFTER;
      big.replaceChildren(h("span", { class: "v" }, fmt(v)), h("span", { class: "u" }, stage === "before" ? "token · 压缩前的上下文" : "token · 压缩后下一次请求的上下文"));
      note.textContent = stage === "before" ? "三轮对话：说颜色、读前 200 行、读后 200 行。两段工具结果占了大头。" :
        stage === "after" ? "切点之前的消息换成一段摘要（斜纹）。切点之后的原样保留。第一段 200 行原文消失了，第二段还在。" :
        "文件只追加：原始记录一条不少（变淡的部分），末尾多了一条 compaction 记录。模型不再看到变淡的部分。";
    }
    paint();
    return h("div", { class: "panel bill" },
      h("div", { class: "hero-lbl" }, h("span", null, "一次真实的 /compact · 本机 · keepRecentTokens = 1,500"), h("div", { class: "stage-btns" }, btns)),
      h("div", { style: { marginTop: "12px" } }, big), h("div", { style: { marginTop: "14px" } }, strip), note,
      h("div", { class: "win-legend", style: { marginTop: "10px" } }, [["var(--c-harness)", "固定成本"], ["var(--c-user)", "你"], ["var(--c-model)", "模型"], ["var(--c-tool)", "工具结果"]].map(([c, t]) => h("span", null, h("i", { style: { background: c } }), t)), h("span", null, "宽度按真实用量近似分配")));
  }

  // ================= §3 cut-point machine =================
  function machine() {
    let keep = REAL_KEEP, guess = null, running = false;
    const rows = h("div");
    const slider = h("input", { type: "range", id: "m4-keep", min: 0, max: 3000, step: 50, value: keep });
    const kv = h("b", { style: { fontVariantNumeric: "tabular-nums", minWidth: "4em", display: "inline-block" } });
    const out = h("div", { class: "machine-out" });
    const bRun = h("button", { class: "btn primary", onclick: () => run() }, "推演");
    function drawRows(state) {
      rows.replaceChildren(...ENT.map((e, i) => {
        const cls = ["mrow"];
        if (state) {
          if (state.walked && state.walked.includes(i)) cls.push("walk");
          if (state.hit === i) cls.push("hit");
          if (state.done) { if (i >= state.cut) cls.push("kept"); else cls.push("summ"); if (i === state.cut) cls.push("cut"); }
        }
        if (guess === i) cls.push("guess");
        return h("div", { class: cls.join(" "), onclick: () => { if (running) return; guess = i; drawRows(null); out.replaceChildren("你猜切点在第 " + (i + 1) + " 行。点「推演」验证。"); } },
          h("span", { class: "id" }, i + 1), h("span", { class: "id" }, e.id), h("span", { class: "who " + e.role }, WHO[e.role]),
          h("span", null, e.text, e.role === "toolResult" ? h("span", { class: "inv" }, "　不能做切点") : null),
          h("span", { class: "est" }, fmt(e.est)), h("span", { class: "acc" }, state && state.acc && state.acc[i] != null ? "累计 " + fmt(state.acc[i]) : ""));
      }));
    }
    async function run() {
      if (running) return; running = true; bRun.disabled = true;
      const r = findCut(ENT, keep);
      const walked = [];
      for (let i = ENT.length - 1; i >= 0; i--) {
        if (r.acc[i] == null) break;
        walked.push(i);
        drawRows({ walked, acc: r.acc, hit: r.hit === i ? i : -1 });
        if (!reduced()) await sleep(260);
      }
      drawRows({ walked, acc: r.acc, hit: r.hit, cut: r.cut, done: true });
      const msgs = [];
      if (r.none) msgs.push(h("b", null, "预算比整个历史还大："), "没有可摘要的部分，全部保留。");
      else {
        msgs.push(h("b", null, `累计在第 ${r.hit + 1} 行达到 ${fmt(keep)}。`), ` 从这一行往后找最近的合法切点：第 ${r.cut + 1} 行（${WHO[ENT[r.cut].role]}）。它和它之后的全部保留（绿色），之前的全部摘要（变淡）。`);
        if (ENT[r.hit].role === "toolResult") msgs.push(" 第 " + (r.hit + 1) + " 行是工具结果，不能切，所以切点后移。");
        if (r.split) msgs.push(h("br"), h("b", null, "这是一次「分裂的轮」："), `切点落在第 ${r.turnStart + 1} 行那条「你」的消息所开启的轮中间。pi 会生成两段摘要：之前的历史一段，这一轮的前半截一段（Turn Context）。`);
      }
      if (guess != null) msgs.push(h("br"), guess === r.cut ? h("span", { class: "verdict ok" }, "你猜对了。") : h("span", { class: "verdict no" }, `你猜的是第 ${guess + 1} 行。`));
      if (keep === REAL_KEEP) msgs.push(h("br"), h("span", { class: "mute" }, "与本机真实文件一致：firstKeptEntryId = 77f89e39。"));
      out.replaceChildren(...msgs);
      Store.set(ID, "machine", { ...Store.get(ID, "machine", {}), ["k" + keep]: 1, ...(guess === r.cut ? { guessed: 1 } : {}) });
      running = false; bRun.disabled = false;
    }
    slider.addEventListener("input", () => { keep = +slider.value; kv.textContent = fmt(keep); drawRows(null); out.replaceChildren("预算改成 " + fmt(keep) + "。先猜切点，再推演。"); });
    kv.textContent = fmt(keep); drawRows(null); out.replaceChildren("先点一行，猜切点在哪里。再点「推演」。");
    return h("div", { class: "panel machine" },
      h("div", { class: "machine-ctrl" }, h("label", { for: "m4-keep" }, "keepRecentTokens", slider, kv), bRun,
        h("span", { class: "mute", style: { fontSize: "15px" } }, "估算 = 字符数 ÷ 4（pi 源码 estimateTokens）")),
      h("div", { class: "mrow", style: { cursor: "default", fontSize: "15px", color: "var(--fg-mute)", fontWeight: 600 } }, h("span", null, "#"), h("span", null, "id"), h("span", null, "角色"), h("span", null, "内容"), h("span", { style: { textAlign: "right" } }, "估算"), h("span", { style: { textAlign: "right" } }, "从末尾累计")),
      rows, out);
  }

  // ================= §3b puzzles =================
  const PUZ = [
    { keep: 145, ents: [["user", "修一下登录 bug", 8], ["assistant", "read(auth.ts)", 10], ["toolResult", "auth.ts 全文", 900], ["assistant", "找到原因了", 30], ["user", "顺便加测试", 6], ["assistant", "write(auth.test.ts)", 120], ["toolResult", "已写入", 5], ["assistant", "测试已加", 15]] },
    { keep: 200, ents: [["user", "跑一下测试", 6], ["assistant", "bash(npm test)", 8], ["toolResult", "测试输出 1,200 行", 2400], ["assistant", "有 3 个失败", 40]] },
    { keep: 1000, ents: [["user", "解释这个仓库", 8], ["assistant", "ls 和 read(README)", 20], ["toolResult", "README 全文", 600], ["assistant", "这是一个 CLI……", 300], ["user", "入口在哪", 5], ["assistant", "read(main.ts)", 10], ["toolResult", "main.ts", 450], ["assistant", "入口在 main.ts 第 12 行", 60]] },
  ];
  function puzzles() {
    const saved = Store.get(ID, "puz", {});
    return h("div", null, PUZ.map((p, pi) => {
      const ents = p.ents.map(([role, text, est], i) => ({ id: "p" + i, role, text, est }));
      const r = findCut(ents, p.keep);
      let pick = saved[pi]?.pick ?? null;
      const list = h("div"), fb = h("div", { class: "machine-out" });
      const paint = (reveal) => {
        list.replaceChildren(...ents.map((e, i) => h("div", { class: "mrow" + (pick === i ? " guess" : "") + (reveal ? (i >= r.cut ? " kept" : " summ") + (i === r.cut ? " cut" : "") : ""), onclick: () => { pick = i; paint(false); fb.textContent = "已选第 " + (i + 1) + " 行。"; } },
          h("span", { class: "id" }, i + 1), h("span", { class: "id" }, ""), h("span", { class: "who " + e.role }, WHO[e.role]), h("span", null, e.text, e.role === "toolResult" ? h("span", { class: "inv" }, "　不能做切点") : null), h("span", { class: "est" }, fmt(e.est)), h("span", { class: "acc" }, reveal && r.acc[i] != null ? "累计 " + fmt(r.acc[i]) : ""))));
      };
      const check = () => {
        if (pick == null) { fb.textContent = "先点一行。"; return; }
        const ok = pick === r.cut; paint(true);
        fb.replaceChildren(h("span", { class: "verdict " + (ok ? "ok" : "no") }, ok ? "对。" : "不对。"), `累计在第 ${r.hit + 1} 行达到 ${fmt(p.keep)}；最近的合法切点是第 ${r.cut + 1} 行。` + (ents[r.hit].role === "toolResult" ? " 第 " + (r.hit + 1) + " 行是工具结果，切点只能后移。" : "") + (r.split ? " 切点不在「你」的消息上：这一轮被分裂，前半截单独摘要。" : ""));
        Store.set(ID, "puz", { ...Store.get(ID, "puz", {}), [pi]: { pick, ok } });
      };
      paint(false);
      if (saved[pi]) setTimeout(check, 0);
      return h("div", { class: "panel machine" },
        h("div", { class: "machine-ctrl" }, h("b", null, `题 ${pi + 1} · keepRecentTokens = ${fmt(p.keep)}`), h("span", { class: "mute", style: { fontSize: "15px" } }, "点出切点（第一条被保留的记录）"), h("button", { class: "btn", onclick: check }, "核对"), h("button", { class: "btn ghost", onclick: () => { pick = r.cut; check(); } }, "看答案")),
        list, fb);
    }));
  }

  // ================= §4 summary =================
  const SUMMARY = `## Goal
Record the user’s favorite color and acknowledge it.

## Constraints & Preferences
- The user’s favorite color is blue (蓝色).
- The user requested the exact reply: “记住了”.

## Progress
### Done
- [x] Assistant replied exactly: “记住了”.

## Key Decisions
- **Use the requested acknowledgment**: Follow the user’s exact-response constraint.

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
- 工具返回重复的示例文字及递增编号；展示内容末尾标注有 3146 个字符被截断。

<read-files>
big.txt
</read-files>`;
  function summaryView() {
    const pre = h("div", { class: "sumtext" });
    SUMMARY.split(/(用户最喜欢的颜色是蓝色。|blue \(蓝色\)|3146 个字符被截断|Turn Context \(split turn\)|<read-files>)/).forEach((p, i) => pre.append(i % 2 ? h("mark", null, p) : p));
    return h("div", { class: "panel" }, h("div", { class: "panel-h" }, h("span", null, "compaction 记录里的 summary · 本机原文（略去空段）"), h("span", null, "tokensBefore 10,869")), pre);
  }

  // ================= §6 decisions =================
  const DEC = [
    { q: "长任务做到一半，前面大量探索已无用，但已确认的接口约定必须记住。上下文 65%。", opts: [{ t: "/compact 保留已确认的接口约定和下一步", ok: true }, { t: "/new 开新会话" }, { t: "什么也不做" }], why: "带指令的手动压缩，决定摘要里留什么。等到自动压缩，摘要只按默认格式写。" },
    { q: "任务做完了，下一个任务和它无关。", opts: [{ t: "/compact" }, { t: "/new", ok: true }, { t: "/tree 回到开头" }], why: "无关的历史压缩后仍在，还要每轮付费。新会话最干净。" },
    { q: "你发现过去三轮走错了方向，想从三轮前重来，并记住为什么错。", opts: [{ t: "/compact" }, { t: "/tree 回去，选 Summarize", ok: true }, { t: "/new" }], why: "压缩只把前半段换成摘要，走错的三轮会被保留下来（它们是最近的）。分支摘要才是「离开这条路」。" },
    { q: "上下文 20%，一切顺利。", opts: [{ t: "现在先压缩一次" }, { t: "什么也不做", ok: true }], why: "压缩会丢细节，也要花一次模型调用。远离阈值时不必压缩。" },
  ];

  // ================= §8 lab =================
  const LAB_SETUP = `mkdir -p ~/pi-lab/m4/.pi && cd ~/pi-lab/m4
echo '{"compaction":{"keepRecentTokens":1500}}' > .pi/settings.json
seq 1 400 | sed 's/^/第 & 行：这是一段用来占用上下文的示例文字。/' > big.txt
pi --approve --session-dir ~/pi-lab/m4/sessions`;
  const LAB_INSIDE = [
    ["输入并回车", "我最喜欢的颜色是蓝色。只回答：记住了"],
    ["输入并回车", "用 read 读 big.txt 的第 1 到 200 行。读完只回答：读完"],
    ["输入并回车", "用 read 读 big.txt 的第 201 到 400 行。读完只回答：读完"],
    ["输入并回车（手动压缩，附带指令）", "/compact 一定保留用户最喜欢的颜色"],
    ["压缩完成后，输入并回车", "不要调用工具。我最喜欢的颜色是什么？big.txt 第 150 行写的是什么？不知道就说不知道。"],
    ["按 Ctrl+D 退出", ""],
  ];
  const LAB_JQ = `jq -r 'if .type=="compaction" then "压缩 切点=\\(.firstKeptEntryId) 压缩前=\\(.tokensBefore) 摘要含蓝色=\\(.summary|test("蓝|blue";"i"))"
elif .type=="message" and .message.role=="assistant" then "回复 \\(.id) 上下文=\\(.message.usage.input + .message.usage.cacheRead) \\(([.message.content[]|.text? // empty]|join(""))[0:20])"
elif .type=="message" then "\\(.message.role) \\(.id)"
else empty end' ~/pi-lab/m4/sessions/*.jsonl`;
  const LAB_CLEAN = "cd ~ && rm -r ~/pi-lab/m4 && rmdir --ignore-fail-on-non-empty ~/pi-lab";
  const LAB_SAMPLE = `system e1d17ca4
user 188477fc
回复 8490ec06 上下文=2694 记住了
user 477e2ba4
回复 14fcf133 上下文=2729
toolResult 7c655d1f
回复 77f89e39 上下文=6779 读完
user d390c720
回复 a3569f40 上下文=6813
toolResult 1006ef7d
回复 8003c879 上下文=10863 读完
压缩 切点=77f89e39 压缩前=10869 摘要含蓝色=true
user df5e2e69
回复 fb9ca294 上下文=7086 你最喜欢的颜色是蓝色。big.txt 第`;
  function lab() {
    const saved = Store.get(ID, "lab", {});
    const ta = h("textarea", { class: "paste", id: "m4-lab-paste", spellcheck: "false", placeholder: "system …\nuser …\n回复 … 上下文=…\n压缩 切点=… 压缩前=… 摘要含蓝色=true\n…" });
    ta.value = saved.raw || "";
    ta.addEventListener("input", () => { delete ta.dataset.sample; });
    const out = h("div");
    const verify = (sample) => {
      if (sample) { ta.value = LAB_SAMPLE; ta.dataset.sample = "1"; }
      const isSample = ta.dataset.sample === "1";
      const L = ta.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      const ci = L.findIndex((l) => l.startsWith("压缩 "));
      const cm = ci >= 0 ? L[ci].match(/切点=(\S+) 压缩前=(\d+) 摘要含蓝色=(\w+)/) : null;
      const after = ci >= 0 ? L.slice(ci + 1).find((l) => l.startsWith("回复 ")) : null;
      const afterCtx = after ? +((after.match(/上下文=(\d+)/) || [])[1] || 0) : 0;
      const cutLine = cm ? L.findIndex((l) => l.split(" ")[1] === cm[1]) : -1;
      const checks = [
        [!!cm, "会话里有一条 compaction 记录"],
        [cm && cutLine >= 0 && cutLine < ci, "切点（firstKeptEntryId）是压缩之前的某条记录"],
        [cm && afterCtx > 0 && afterCtx < +cm[2], "压缩后的第一次请求，上下文比「压缩前」小"],
        [cm && cm[3] === "true", "摘要里保住了「蓝色」"],
        [!!after && /蓝/.test(after), "压缩后，模型答出了蓝色"],
      ];
      const ok = checks.every((c) => c[0]);
      const qbox = h("div");
      if (ok) {
        const want = L.slice(0, cutLine).filter((l) => /^(user|toolResult|回复) /.test(l)).length;
        const saved2 = +((after.match(/上下文=(\d+)/) || [])[1]);
        const i1 = h("input", { type: "number", id: "m4-lab-n" }), i2 = h("input", { type: "number", id: "m4-lab-s" });
        const fb = h("div", { class: "feedback", style: { padding: "8px 0 0" }, hidden: true });
        qbox.append(h("div", { class: "count-q", style: { padding: "8px 0", gridTemplateColumns: "1fr 1fr" } },
          h("label", { for: "m4-lab-n" }, "切点之前有几条消息被摘要？（不算 system）", i1),
          h("label", { for: "m4-lab-s" }, "压缩让上下文少了多少 token？（压缩前 − 压缩后第一次请求）", i2)),
          h("button", { class: "btn primary", onclick: () => {
            const a = +i1.value === want, b = +i2.value === +cm[2] - saved2;
            i1.classList.toggle("right", a); i1.classList.toggle("wrong", !a); i2.classList.toggle("right", b); i2.classList.toggle("wrong", !b);
            fb.hidden = false;
            if (a && b && !isSample) { Store.set(ID, "lab", { raw: ta.value, passed: true }); checkDone(); fb.replaceChildren(h("span", { class: "verdict ok" }, "实验通过。"), "你亲手压缩了一次，并证明了：原文被换掉，指令保住的事实留下了。最后一步：清理。"); }
            else if (a && b) fb.replaceChildren(h("span", { class: "verdict ok" }, "答对了。"), "这是示例数据，不计入实验。请用你自己的会话再做一次。");
            else fb.replaceChildren(h("span", { class: "verdict no" }, "再算一次。"), (a ? "" : "数「压缩」那一行里的切点 id 出现之前，以 user、toolResult、回复 开头的行。") + (b ? "" : " 用「压缩前=」的数减去压缩后第一条「回复」的上下文。"));
          } }, "核对"), fb);
      }
      out.replaceChildren(h("ul", { class: "check-list" }, checks.map(([o, t]) => h("li", null, h("span", { class: o ? "ok" : "no" }, o ? "✓" : "✗"), t))),
        ok ? qbox : h("div", { class: "note warn" }, h("span", { class: "k" }, "没有全部通过"), "若「摘要含蓝色=false」：重做一次，确认 /compact 后面带了指令。若没有压缩记录：确认在 pi 里输入的是 /compact。"));
    };
    if (saved.raw) setTimeout(() => verify(false), 0);
    return h("div", { class: "lab-steps" },
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "建实验目录：一份项目设置（把 keepRecentTokens 调到 1,500，好让小会话也能看清效果），一个 400 行的文件。"),
        h("p", { class: "dim", style: { margin: "4px 0 0" } }, "项目有 .pi/settings.json，pi 会先问你是否信任这个目录。--approve 表示本次运行直接信任，不保存决定（M5 详讲）。"), copyBlock(LAB_SETUP))),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "在 pi 里按顺序操作。"),
        h("div", { class: "panel", style: { marginTop: "8px" } }, LAB_INSIDE.map(([how, what], i) => h("div", { class: "mini-tr" }, h("div", { class: "row", style: { gridTemplateColumns: "28px 250px minmax(0,1fr)" } }, h("span", { class: "n" }, String.fromCharCode(97 + i)), h("span", { style: { fontFamily: "var(--f-body)", fontSize: "15px" } }, how), h("span", { class: "what" }, what))))),
        h("p", { class: "dim", style: { margin: "8px 0 0", fontSize: "16px" } }, "第 d 步之后，底栏的百分比会变成 ?：压缩后的上下文要等下一次回复才知道。"))),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "把会话文件压成摘要。"), copyBlock(LAB_JQ))),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "粘贴输出，核对，回答两个问题。"), h("div", { style: { marginTop: "8px" } }, ta),
        h("div", { style: { display: "flex", gap: "8px", marginTop: "8px" } }, h("button", { class: "btn primary", onclick: () => verify(false) }, "核对我的会话"), h("button", { class: "btn ghost", onclick: () => verify(true) }, "先用示例数据试试")), out)),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "清理。"), copyBlock(LAB_CLEAN))));
  }

  // ================= quiz / review / recap =================
  const QUIZ = [
    { q: "自动压缩什么时候触发？", opts: [{ t: "上下文超过「窗口 − reserveTokens」时，下一次请求之前", ok: true }, { t: "每 20 轮一次" }, { t: "上下文超过 keepRecentTokens 时" }], why: "keepRecentTokens 决定保留多少，不决定何时触发。" },
    { q: "pi 判断「是否触发」用的是什么数？", opts: [{ t: "最近一次回复里提供者报告的真实用量", ok: true }, { t: "字符数 ÷ 4 的估算" }, { t: "消息条数" }], why: "触发看真实用量；找切点时才用字符数 ÷ 4 的估算。" },
    { q: "下面哪种记录永远不能做切点？", opts: [{ t: "工具结果", ok: true }, { t: "模型回复" }, { t: "你的消息" }], why: "工具结果必须和产生它的工具调用在同一边，否则模型会看到没有来源的结果。" },
    { q: "累计在一条工具结果处达到了预算。切点在哪？", opts: [{ t: "从它往后找最近的合法切点", ok: true }, { t: "就在这条工具结果上" }, { t: "往前找最近的「你」的消息" }], why: "pi 源码：cutPoints.find(c => c >= i)。所以实际保留的往往略少于预算。" },
    { q: "压缩之后，被摘要的原始记录：", opts: [{ t: "仍在文件里，只是不再发送", ok: true }, { t: "被删除" }, { t: "被写进摘要后删除" }], why: "压缩只追加一条 compaction 记录，firstKeptEntryId 标出保留从哪开始。" },
    { q: "本机实测：压缩后问「big.txt 第 150 行写的是什么」，模型：", opts: [{ t: "答不出来", ok: true }, { t: "答对了" }, { t: "重新调用 read 去读" }], why: "那段原文已换成摘要。题目禁止调用工具，所以它只能说不知道。细节会丢，这是压缩的代价。" },
    { q: "怎样让压缩一定保住某个关键事实？", opts: [{ t: "/compact 后面写上要保留的内容", ok: true }, { t: "把 reserveTokens 调大" }, { t: "关掉自动压缩" }], why: "本机实测：附带指令后，摘要的 Critical Context 里专门写下了「用户最喜欢的颜色是蓝色」。" },
    { q: "中文会话里，keepRecentTokens = 20,000 实际保留的真实 token 通常：", opts: [{ t: "明显多于 20,000", ok: true }, { t: "正好 20,000" }, { t: "少于 20,000" }], why: "估算按 4 个字符 1 个 token；中文实际约 0.65–0.8 token 每字。本机实测估算低了约 3 倍。" },
    { q: "压缩后底栏的百分比显示「?」，因为：", opts: [{ t: "新上下文的真实大小要等下一次回复才知道", ok: true }, { t: "压缩失败了" }, { t: "提供者断线" }], why: "pi 只信提供者报告的用量。压缩后还没有新的报告。" },
    { q: "你想离开一条走错的路线。用哪个？", opts: [{ t: "/tree 回去并做分支摘要", ok: true }, { t: "/compact" }], why: "压缩保留的是最近的消息，恰好就是走错的那几轮。" },
  ];
  const REVIEW = [
    { q: "（复习 M3）模型在下一次请求里看到什么？", opts: [{ t: "从当前叶子沿 parentId 走到根的路径", ok: true }, { t: "整个会话文件" }], why: "这条路径叫活动分支。本课的压缩，是在这条路径上把前半段换成摘要。" },
    { q: "（复习 M1）272k 窗口、默认 reserveTokens，自动压缩阈值是：", opts: [{ t: "255,616", ok: true }, { t: "272,000" }, { t: "20,000" }], why: "272,000 − 16,384 = 255,616。" },
  ];
  const PRE = [
    { id: "p1", q: "压缩之后，被压缩的原始消息会被删除吗？", opts: [{ t: "会" }, { t: "不会，还在文件里", ok: true }] },
    { id: "p2", q: "keepRecentTokens = 1,500 时，压缩后保留的最近消息：", opts: [{ t: "正好 1,500 token" }, { t: "可能远多于 1,500 token", ok: true }, { t: "一定少于 1,500 token" }] },
    { id: "p3", q: "压缩之后，模型还能说出被压缩部分里的原文细节吗？", opts: [{ t: "能" }, { t: "通常不能，除非摘要写进去了", ok: true }] },
  ];
  function checkDone() {
    const ok = Store.get(ID, "lab", {}).passed && Store.get(ID, "quiz", { best: 0 }).best >= 8;
    if (ok && !Store.get(ID, "done")) Store.set(ID, "done", true);
  }

  window.Course.register(ID, (page) => {
    const rc = window.Course.recapBlock(ID, {
      pre: PRE,
      next: { id: "M5", title: "配置的分层与信任", text: "你在本课用了一份项目设置和 --approve。M5 讲清楚：设置从哪些地方来、怎样合并、项目信任到底管什么。" },
      extra: () => [["切点题", Object.values(Store.get(ID, "puz", {})).filter((x) => x.ok).length + " / " + PUZ.length], ["决策题", DEC.filter((d, i) => d.opts[Store.get(ID, "dec", {})["d" + i]]?.ok).length + " / " + DEC.length]],
    });
    page.append(h("div", { class: "bench" },
      h("header", { class: "mhead" }, h("div", { class: "crumbs" }, "第 2 单元 · 驾驭 pi / M4"), h("h1", { class: "mtitle" }, h("span", { class: "mid" }, "M4"), "压缩")),
      section("s-hero", 0, "开场", null, hero(),
        h("div", { class: "col" },
          h("p", { class: "thesis" }, "压缩用一段摘要，换掉旧的历史。", h("br"), "省下的是 token，丢掉的是细节。"),
          h("p", { class: "lead" }, "上面是你本机的一次真实压缩。点三个按钮，对比压缩前、模型看到的、文件里的。M1 讲了何时触发；本课讲压缩切在哪、留下什么、丢掉什么、你能控制什么。")),
        h("div", { class: "panel objectives" },
          h("ol", null,
            h("li", null, "说出三种触发方式，以及「触发」和「切点」各用什么数。"),
            h("li", null, "用 pi 的真实算法，在一串记录里找出切点。"),
            h("li", null, "读懂 compaction 记录，说出压缩后模型看到什么。"),
            h("li", null, "用 /compact 的指令保住关键事实，并说出摘要会丢什么。"),
            h("li", null, "在压缩、新会话、分支摘要之间做出选择。")),
          h("div", { class: "obj-side" },
            h("div", null, h("span", { class: "k" }, "时长"), "约 70 分钟"),
            h("div", null, h("span", { class: "k" }, "前置"), "M1、M3"),
            h("div", null, h("span", { class: "k" }, "练习"), "§8 实验 + §9 测验（≥ 8/10）"),
            h("div", null, h("span", { class: "k" }, "核对版本"), "pi 0.99.2 · compaction.js"))),
        h("h3", null, "本课路线"),
        route(ID, [["s-pre", 1, "动手", "复习与预测"], ["s-when", 2, "阅读", "何时压缩"], ["s-cut", 3, "动手", "切点推演"], ["s-after", 4, "动手", "压缩后看到什么"], ["s-bias", 5, "阅读", "估算的偏差"], ["s-dec", 6, "动手", "何时该压"], ["s-cfg", 7, "阅读", "设置"], ["s-lab", 8, "实验", "真机压缩"], ["s-quiz", 9, "测验", "10 题"], ["s-recap", 10, "阅读", "小结"]])),
      h("div", { class: "col" },
        section("s-pre", 1, "复习与预测", "先复习，再预测",
          todo("两道复习题立即判分；三道预测课末揭晓。"),
          REVIEW.map((r, i) => choice({ id: "r" + i, store: [ID, "rev"], kicker: "复习 " + (i + 1) + " / 2", q: r.q, opts: r.opts, explain: r.why, shuffleSeed: 71 + i * 7 })),
          PRE.map((p, i) => choice({ id: p.id, store: [ID, "pre"], kicker: "预测 " + (i + 1) + " / 3", q: p.q, opts: p.opts, reveal: false, shuffleSeed: 37 + i * 13 }))),
        section("s-when", 2, "何时压缩", "三种触发方式",
          todo("读下表，记住每种方式由什么触发。", true),
          h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" },
            h("thead", null, h("tr", null, h("th", null, "方式"), h("th", null, "触发条件"), h("th", null, "reason"))),
            h("tbody", null,
              h("tr", null, h("td", null, h("b", null, "自动 · 阈值")), h("td", null, "上下文 > 窗口 − reserveTokens。在工具结果追加之后、下一次请求之前检查。"), h("td", null, h("code", null, "threshold"))),
              h("tr", null, h("td", null, h("b", null, "自动 · 溢出恢复")), h("td", null, "提供者报「上下文超长」，或回复因长度过早截断。pi 压缩一次，然后重试。"), h("td", null, h("code", null, "overflow"))),
              h("tr", null, h("td", null, h("b", null, "手动")), h("td", null, "你输入 /compact，可附带指令。关掉自动压缩后，手动照样可用。"), h("td", null, h("code", null, "manual")))))),
          h("div", { class: "note" }, h("span", { class: "k" }, "两个数，两个用途"), h("b", null, "触发"), "看提供者报告的真实用量（M1 的底栏百分比）。", h("b", null, "切点"), "看 pi 自己的估算：字符数 ÷ 4。这一差别在 §5 会变成实际后果。")),
        section("s-cut", 3, "切点推演", "压缩切在哪里",
          todo("先读三步算法，用推演机走一遍本机的真实记录；再做三道练习（每道都可以直接看答案）。"),
          h("p", null, "pi 的算法（compaction.js · findCutPoint）只有三步："),
          h("ul", { class: "rule" },
            h("li", null, "从最新的记录往回走，累加每条的估算 token。"),
            h("li", null, "累计达到 keepRecentTokens 的那一条，记下位置。"),
            h("li", null, "从这个位置往后找最近的合法切点：你的消息、模型回复都可以；", h("b", null, "工具结果不行"), "。切点及之后的保留，之前的摘要。")))),
      h("div", { class: "bench" }, machine()),
      h("div", { class: "col" },
        h("h3", null, "三道题"),
        h("p", null, "每题给出一串记录和预算。点出切点（第一条被保留的记录），再核对。")),
      h("div", { class: "bench" }, puzzles()),
      h("div", { class: "col" },
        section("s-after", 4, "压缩后看到什么", "模型看到的新历史",
          todo("读下面的真实摘要，再对照摘要下面的四条解释，看高亮的四处各是什么。", true),
          h("p", null, "压缩后，下一次请求的顺序是："),
          h("div", { class: "seen-as" }, [["var(--c-harness)", "系统提示"], ["var(--c-tool)", "压缩摘要"], ["var(--c-model)", "从切点起保留的记录"], ["var(--c-user)", "新消息"]].map(([c, t]) => h("span", { style: { background: c } }, t))),
          h("p", { style: { marginTop: "12px" } }, "摘要是一份结构化文档：目标、约束、进展、关键决定、下一步、关键上下文，最后附上读过和改过的文件。切点落在一轮中间时，还有一段 Turn Context，单独总结这一轮的前半截。"),
          summaryView(),
          h("ul", { class: "rule", style: { marginTop: "14px" } },
            h("li", null, h("b", null, "Critical Context 里的蓝色："), "因为 /compact 附带了「一定保留用户最喜欢的颜色」。"),
            h("li", null, h("b", null, "Turn Context：")," 这次切点落在第二轮中间（分裂的轮），所以多了这一段。"),
            h("li", null, h("b", null, "3146 个字符被截断："), "送去总结时，每条工具结果只取前 2,000 个字符。总结者自己也没看完原文。"),
            h("li", null, h("b", null, "<read-files>："), "pi 跨多次压缩累积记录读过和改过的文件，让模型知道去哪里重新找细节。")),
          h("div", { class: "note warn" }, h("span", { class: "k" }, "实测：保住了什么，丢了什么"), "压缩后不许调用工具，问两个问题。「最喜欢的颜色」答对了（摘要写了）。「第 150 行」答不出（原文已被换掉）。要细节，就让模型重新 read。")),
        section("s-bias", 5, "估算的偏差", "中文会话的一个坑",
          todo("看表里同一条记录的两个数字，理解它对你意味着什么。", true),
          h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" },
            h("thead", null, h("tr", null, h("th", null, "记录"), h("th", { style: { textAlign: "right" } }, "字符"), h("th", { style: { textAlign: "right" } }, "pi 估算"), h("th", { style: { textAlign: "right" } }, "提供者实际"))),
            h("tbody", null, h("tr", null, h("td", null, "第一次 read 的结果（200 行中文）"), h("td", { class: "n" }, "5,146"), h("td", { class: "n" }, "1,287"), h("td", { class: "n" }, "≈ 4,000"))))),
          h("p", { style: { marginTop: "12px" } }, "pi 用「字符 ÷ 4」估算。这对英文和代码大致准确，对中文低估约 3 倍。后果："),
          h("ul", { class: "rule" },
            h("li", null, "keepRecentTokens = 20,000 在中文会话里会保留约 80,000 个字符，真实约 5–6 万 token。"),
            h("li", null, "压缩后上下文降得比你预期的少；如果保留部分本身很大，很快又会再次压缩。"),
            h("li", null, "中文为主的长会话，可以考虑把 keepRecentTokens 调小。"))),
        section("s-dec", 6, "何时该压", "压缩、新会话、还是分支摘要",
          todo("先读四条判断规则，再用它们做四个场景题。"),
          h("ul", { class: "rule" },
            h("li", null, h("b", null, "要保留的东西很具体："), "主动 /compact，并在后面写明要保留什么（例如「保留已确认的接口约定和下一步」）。自动压缩只按默认格式写摘要。"),
            h("li", null, h("b", null, "下一件事和现在无关："), "/new。无关的历史即使压缩成摘要，也还要每轮付费。"),
            h("li", null, h("b", null, "最近几轮走错了路："), "/tree 回到出错之前，离开时选 Summarize。压缩保留的恰恰是最近的记录，走错的那几轮会被留下；分支摘要才是「离开这条路，只带走教训」。"),
            h("li", null, h("b", null, "离阈值还远："), "什么也不做。压缩会丢细节，还要花一次模型调用。")),
          DEC.map((d, i) => choice({ id: "d" + i, store: [ID, "dec"], kicker: "场景 " + (i + 1) + " / 4", q: d.q, opts: d.opts, explain: d.why, shuffleSeed: 81 + i * 5 }))),
        section("s-cfg", 7, "设置", "可以调的三个数",
          todo("读设置说明。实验里会用项目设置把 keepRecentTokens 调小。", true),
          h("pre", { class: "panel", style: { padding: "14px 16px", fontSize: "15px" } }, `{
  "compaction": {
    "enabled": true,             // 关掉后不再自动压缩；/compact 仍可用
    "reserveTokens": 16384,      // 阈值 = 窗口 − 它；也影响摘要的输出上限
    "keepRecentTokens": 20000,   // 切点算法的预算（按字符 ÷ 4 估算）
    "modelOverrides": {
      "some-provider/big-model": { "reserveTokens": 400000 }
    }
  }
}`),
          h("p", null, "放在 ~/.pi/agent/settings.json（全局）或项目的 .pi/settings.json（项目级，需信任）。modelOverrides 按模型单独设置：1M 窗口的模型把 reserveTokens 设成 400,000，就在 600k 时压缩。"),
          h("div", { class: "note" }, h("span", { class: "k" }, "扩展可以接管"), "扩展可以在 session_before_compact 事件里取消压缩，或自己写摘要（比如用更便宜的模型）。M10 讲。")),
        section("s-lab", 8, "实验", "在真实的 pi 里压缩一次",
          todo("按第 1–5 步操作。第 2 步在 pi 里完成。"),
          h("p", null, "你会复现开场那次压缩，然后从文件里证明：原文被换掉了，指令保住的事实留下了。"),
          h("div", { class: "note" }, h("span", { class: "k" }, "实验规则"), "只在 ~/pi-lab/m4 里做；项目设置只放在实验目录；--approve 不保存信任决定；最后清理。"),
          lab()),
        section("s-quiz", 9, "掌握测验", "10 题，8 题过关", todo("10 题全部作答，点「交卷」。"), window.Course.quizBlock(ID, QUIZ, checkDone)),
        section("s-recap", 10, "小结", "你学到了什么",
          todo("看自己的预测和成绩。觉得学会了，就在本节最后点「标记为已完成」。", true),
          h("p", { class: "lead" }, "一句话：触发看真实用量，切点按「字符 ÷ 4」从末尾倒推；切点前换成摘要，原文仍在文件里；要保住的事实，写进 /compact 的指令。"),
          rc))));
    return () => rc._cleanup && rc._cleanup();
  });
})();
