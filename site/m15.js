/* M15 · omp 的工具面 */
(function () {
  "use strict";
  const { h, $, $$, Store, choice, copyBlock, section, todo, route, term } = window.Course;
  const ID = "M15";
  const REV = "d40b86cf7d6607fc349545ec67ed321023e53425";

  // ================= §0 hero: hashline workbench =================
  const SRC = ['def greet(name):', '    print("Hello, " + name)', '', '', 'def bye(name):', '    print("Bye, " + name)', '', 'greet("world")'];
  // kind: rep(range a..b with body) | ins(after line a, a=0 → head, a=-1 → tail) | cut(a..b)
  const TASKS = [
    { t: "改问候语", d: "把第 2 行换成 f-string。", hl: 'PUT 2.=2:\n+    print(f"Hi, {name}")', op: { kind: "rep", a: 2, b: 2, body: ['    print(f"Hi, {name}")'] },
      pi: { oldText: '    print("Hello, " + name)', newText: '    print(f"Hi, {name}")' } },
    { t: "替换整个 bye 函数", d: "用块锚点：从 def 那一行开始，到语法树里这个函数结束。", hl: 'PUT 5*:\n+def bye(name):\n+    print(f"Bye, {name}!")', op: { kind: "rep", a: 5, b: 6, body: ['def bye(name):', '    print(f"Bye, {name}!")'], note: "5* 解析成第 5–6 行（tree-sitter 找到的函数块）。" },
      pi: { oldText: 'def bye(name):\n    print("Bye, " + name)', newText: 'def bye(name):\n    print(f"Bye, {name}!")' } },
    { t: "在文件末尾加一行", d: "不需要任何锚点文本。", hl: 'PUT >$:\n+bye("world")', op: { kind: "ins", a: -1, body: ['bye("world")'] },
      pi: { oldText: 'greet("world")', newText: 'greet("world")\nbye("world")' } },
    { t: "删除 bye 函数", d: "CUT 也能用块锚点。", hl: 'CUT 5*', op: { kind: "cut", a: 5, b: 6 },
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
    const btns = TASKS.map((x, i) => h("button", { class: "pick", "aria-pressed": i === cur ? "true" : "false", onclick: () => { cur = i; paint(); } }, h("b", null, x.t), h("span", { class: "mute" }, x.d)));
    const res = h("div", { class: "res" });
    const fileView = (lines, tag, mark) => h("pre", { class: "hlfile" }, h("span", { class: "hdr" }, `[greet.py#${tag}]`), "\n",
      lines.map((l, i) => h("span", { class: "ln2" + (mark && mark(i + 1) ? " mk" : "") }, h("span", { class: "no" }, i + 1 + ":"), l + "\n")));
    function paint() {
      btns.forEach((b, i) => b.setAttribute("aria-pressed", i === cur));
      const x = TASKS[cur], op = x.op;
      const patch = `*** Begin Patch\n[greet.py#2F01]\n${x.hl}\n*** End Patch`;
      const piJson = JSON.stringify({ path: "greet.py", edits: [x.pi] });
      const inRange = (n) => (op.kind === "ins" ? false : n >= op.a && n <= op.b);
      const after = applyOp(SRC, op);
      res.replaceChildren(
        h("div", { class: "wb" },
          h("div", null, h("div", { class: "sub" }, "模型读到的（omp 的 read 输出）"), fileView(SRC, "2F01", inRange)),
          h("div", null, h("div", { class: "sub" }, "改完以后"), fileView(after, "····", null), op.note ? h("div", { class: "mute", style: { fontSize: "15px" } }, op.note) : null)),
        h("div", { class: "expo cmp2" },
          h("div", { class: "side2" }, h("div", { class: "sub" }, `omp：hashline · ${x.hl.length} 字符`), h("pre", { class: "script" }, patch)),
          h("div", { class: "side2" }, h("div", { class: "sub" }, `pi：edit · ${piJson.length} 字符`), h("pre", { class: "script" }, piJson))),
        h("p", { style: { margin: 0 } }, "omp 只写「哪几行」和「新内容」；pi 要把旧文本逐字抄一遍，好让程序找到它。改动越大，差距越大。"));
      const seen = { ...Store.get(ID, "wb", {}) }; seen[cur] = 1; Store.set(ID, "wb", seen);
    }
    paint();
    return h("div", { class: "panel surf" }, h("div", { class: "col1" }, h("b", null, "同一个文件，四种改法"), h("div", { class: "list" }, btns),
      h("p", { class: "mute", style: { fontSize: "15px", margin: "8px 0 0" } }, "#2F01 是本机 omp read 给这个文件算出的真实标签。")), res);
  }

  // ================= §3 measured bars =================
  function sizeBars() {
    const rows = [["pi · edit", 560, 1190, "var(--c-harness)"], ["omp · hashline", 77, 97, "var(--c-ctx)"]];
    return h("div", { class: "panel", style: { padding: "14px 16px", display: "grid", gap: "8px" } },
      h("div", { class: "mute", style: { fontSize: "15px" } }, "本机实测：把 28 行文件里一个 20 行的函数体换成 return \"done\"。同一模型，各跑 2–3 次，结果都正确。"),
      rows.map(([l, tok, ch, c]) => h("div", { class: "cbar" }, h("span", null, l), h("div", { class: "b", style: { width: (tok / 560) * 100 + "%", background: c } }), h("span", { class: "v" }, tok + " token"))),
      h("div", { class: "mute", style: { fontSize: "15px" } }, "输出 token（整次运行）。工具参数：pi 1,190 字符，omp 97 字符。omp 的几次运行在 77–112 之间，pi 三次都是 560。"));
  }

  // ================= §4 stale table =================
  function staleTable() {
    const rows = [
      ["有人在文件顶部插了一行（目标行内容没变，只是下移）", ["成功，并警告", "Recovered by remapping stale line anchors to unchanged current lines… Verify the diff matches your intent."], ["成功，无提示", "Successfully replaced 1 block(s) in greet.py."]],
      ["有人改了目标行本身（Hello → Hey）", ["拒绝，文件不动", "Edit rejected for greet.py: file changed between read and edit. Section is bound to #2F01, but the current file hashes to #0746…"], ["拒绝，文件不动", "Could not find the exact text in greet.py…"]],
    ];
    return h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" },
      h("thead", null, h("tr", null, h("th", null, "读完之后、改之前"), h("th", null, "omp（旧标签 #2F01）"), h("th", null, "pi（旧文本）"))),
      h("tbody", null, rows.map(([a, o, p]) => h("tr", null, h("td", null, a),
        h("td", null, h("b", null, o[0]), h("div", { class: "mute", style: { fontSize: "15px", fontFamily: "var(--f-mono)" } }, o[1])),
        h("td", null, h("b", null, p[0]), h("div", { class: "mute", style: { fontSize: "15px", fontFamily: "var(--f-mono)" } }, p[1])))))));
  }

  // ================= §6 internal URLs =================
  const URLS = [
    ["xd://名字", "工具设备：read 读说明，write 传参数（M14）"],
    ["skill://名字", "技能正文；后面加 /路径 读技能里的文件"],
    ["agent://ID", "子代理的输出和进度（M16）"],
    ["artifact://ID", "被截断的长输出全文（例如 bash 输出太长时）"],
    ["local://名字.md", "本会话里共享的草稿文件"],
    ["proc://ID", "后台进程：看状态、写 stdin、结束它"],
    ["omp://", "omp 自己的文档（本机 134 个文件）"],
    ["issue://N、pr://N", "GitHub 议题和 PR（需要 gh）；pr://N/diff 看改动"],
    ["mcp://URI、ssh://主机/路径", "MCP 资源；远程机器上的文件"],
  ];
  const DRILL = [
    { q: "你想知道一个函数在整个仓库里被谁调用。", opts: [{ t: "xd://lsp 的 references", ok: true }, { t: "grep 函数名" }, { t: "eval" }], why: "语言服务器懂作用域和导入：同名的局部变量、字符串里的名字不会被算进来。grep 是文本匹配。" },
    { q: "你想把所有 console.log(x) 改写成 logger.debug(x)，但不碰字符串里的 console.log。", opts: [{ t: "ast_grep 找、ast_edit 改", ok: true }, { t: "sed" }, { t: "hashline 一处处改" }], why: "按语法树匹配，$X 只匹配一个完整的表达式节点。注意 ast_grep 默认关闭（astGrep.enabled）。" },
    { q: "你要读一个 3 万行的日志，统计每种错误出现几次。", opts: [{ t: "eval：用 Python 读文件、计数，只把结果交给模型", ok: true }, { t: "read 整个文件" }, { t: "grep 每种错误各搜一次" }], why: "计算在运行时里做，上下文里只放结果（和 M11 codemode 同一思路）。eval 的变量在后续调用里还在。" },
    { q: "bash 的输出被截断了，末尾写着 [raw output: artifact://7]。", opts: [{ t: "read artifact://7，或者加行号范围只读需要的部分", ok: true }, { t: "把命令再跑一遍" }], why: "长输出被存起来了，上下文里只放摘要。需要时再按范围取回。" },
  ];

  // ================= §8 lab =================
  const LAB_SHELL = `nix shell github:can1357/oh-my-pi/${REV}#omp`;
  const LAB_SETUP = `mkdir -p ~/pi-lab/m15 && cd ~/pi-lab/m15 && git init -q
printf '[project]\\nname = "demo"\\nversion = "0"\\n' > pyproject.toml
printf 'def greet(name):\\n    print("Hello, " + name)\\n\\n\\ndef bye(name):\\n    print("Bye, " + name)\\n\\ngreet("world")\\n' > greet.py
python3 - <<'EOF'
rows = ['def report(rows: list[dict]) -> str:', '    """把一组记录排版成表格。"""', '    out = []']
rows += [f'    out.append("第 {i} 行：" + str(rows[{i - 1}]))  # 逐行输出' for i in range(1, 21)]
rows += ['    return "\\\\n".join(out)', '', '', 'def total(xs: list[int]) -> int:', '    return sum(xs) + "元"', '']
open("report.py", "w").write("\\n".join(rows))
EOF
cp report.py report.orig
M=openai-codex/gpt-6-astra`;
  const LAB_TAG = `a=$(omp read greet.py | head -1); echo "# 尾注释" >> greet.py; b=$(omp read greet.py | head -1)
echo "标签：$a → $b"
sed -i '$d' greet.py`;
  const LAB_SIZE = `P='把 report.py 里 report 函数的整个函数体换成一行：return "done"。保留函数签名，别的不要动。改完就结束，不用解释。'
stat_line(){ echo "$1 编辑：输出 $(jq -s '[.[]|select(.type=="message_end" and .message.role=="assistant")|.message.usage.output]|add' ev.jsonl) token · 参数 $(jq -r 'select(.type=="tool_execution_start" and .toolName=="edit")|.args|tostring' ev.jsonl | wc -m) 字符 · $(grep -q 'out.append' report.py && echo 没改对 || echo 改对了)"; cp report.orig report.py; }
pi --mode json --no-session --tools read,edit "$P" < /dev/null 2>/dev/null > ev.jsonl; stat_line pi
omp --mode json --no-session --model $M --tools read,edit "$P" < /dev/null 2>/dev/null > ev.jsonl; stat_line omp
rm ev.jsonl`;
  const LAB_STALE = `cat > stale.py <<'EOF'
import json, subprocess
ORIG = 'def greet(name):\\n    print("Hello, " + name)\\n\\n\\ndef bye(name):\\n    print("Bye, " + name)\\n\\ngreet("world")\\n'
def scenario(label, sed_expr):
    open("greet.py", "w").write(ORIG)
    omp = subprocess.Popen(["omp", "--mode", "rpc", "--no-session", "--model", "openai-codex/gpt-6-astra", "--tools", "read,edit"],
                           stdin=subprocess.PIPE, stdout=subprocess.PIPE)
    def run(msg, rid):                       # 发一条提示，读到它的 prompt_result 为止
        omp.stdin.write((json.dumps({"id": rid, "type": "prompt", "message": msg}, ensure_ascii=False) + "\\n").encode()); omp.stdin.flush()
        last = None
        while True:
            r = json.loads(omp.stdout.readline())
            if r.get("type") == "tool_execution_end" and r["toolName"] == "edit": last = r
            if r.get("type") == "prompt_result" and r.get("id") == rid: return last
    run("读 greet.py。读完只回答 OK。", "1")
    subprocess.run(["sed", "-i", sed_expr, "greet.py"])          # 模拟别人在这之间改了文件
    r = run('不要重新读文件。直接用 edit，用你之前看到的标签和行号，把 print("Hello, " + name) 那一行改成 print(f"Hi, {name}")。如果报错，原样告诉我，不要重试。', "2")
    text = r["result"]["content"][0]["text"] if r else "（模型没有调用 edit）"
    key = [l for l in text.splitlines() if "Recovered" in l or "rejected" in l]
    print(f"{label}：{'错误' if r and r.get('isError') else '成功'} · {(key or [text.splitlines()[0]])[0]}")
    omp.stdin.close(); omp.wait()
scenario("插入一行后", "1i # 头注释")
scenario("目标行被改后", "s/Hello/Hey/")
EOF
python3 stale.py`;
  const LAB_LSP = `nix shell nixpkgs#pyright -c omp --mode json --no-session --model $M "用 lsp 工具对 report.py 做 diagnostics，原样告诉我它报了什么。不要修改文件。" < /dev/null 2>/dev/null > ev.jsonl
echo "LSP：$(jq -r 'select(.type=="tool_execution_end") | .result.content[0].text' ev.jsonl | grep -o '\\[Pyright\\].*' | head -1)"
omp --mode json --no-session --model $M "用 eval 工具（python）分两次调用：第一次只定义 x = 2**100，第二次打印 len(str(x))。只回答那个数字。" < /dev/null 2>/dev/null > ev.jsonl
echo "eval：调用 $(jq -r 'select(.type=="tool_execution_start") | .toolName' ev.jsonl | grep -c eval) 次 · 回答 $(jq -r 'select(.type=="message_end" and .message.role=="assistant") | .message.content[] | select(.type=="text") | .text' ev.jsonl | tail -1)"
rm ev.jsonl`;
  const LAB_CLEAN = `cd ~ && rm -r ~/pi-lab/m15 && rmdir --ignore-fail-on-non-empty ~/pi-lab
exit`;
  const LAB_SAMPLE = `标签：[greet.py#2F01] → [greet.py#F63F]
pi 编辑：输出 560 token · 参数 1190 字符 · 改对了
omp 编辑：输出 77 token · 参数 97 字符 · 改对了
插入一行后：成功 · Recovered by remapping stale line anchors to unchanged current lines (file changed since the tagged read). Verify the diff matches your intent.
目标行被改后：错误 · Edit rejected for greet.py: file changed between read and edit.
LSP：[Pyright] Operator "+" not supported for types "int" and "Literal['元']" (reportOperatorIssue)
eval：调用 2 次 · 回答 31`;
  function lab() {
    const saved = Store.get(ID, "lab", {});
    const ta = h("textarea", { class: "paste", id: "m15-lab-paste", spellcheck: "false", placeholder: "标签：…\npi 编辑：…\nomp 编辑：…\n插入一行后：…\n…" });
    ta.value = saved.raw || "";
    ta.addEventListener("input", () => { delete ta.dataset.sample; });
    const out = h("div");
    const verify = (sample) => {
      if (sample) { ta.value = LAB_SAMPLE; ta.dataset.sample = "1"; }
      const isSample = ta.dataset.sample === "1";
      const L = ta.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      const get = (k) => (L.find((l) => l.startsWith(k)) || "").slice(k.length).trim();
      const tags = get("标签：").match(/#([0-9A-F]{4})/g) || [];
      const tok = (k) => +((get(k).match(/输出\s*(\d+)/) || [])[1] || 0);
      const checks = [
        [tags.length === 2 && tags[0] !== tags[1], "改一个字节，标签就变"],
        [/改对了/.test(get("pi 编辑：")) && /改对了/.test(get("omp 编辑：")), "两边都改对了"],
        [tok("pi 编辑：") > 0 && tok("omp 编辑：") > 0 && tok("pi 编辑：") >= 2 * tok("omp 编辑："), "pi 的输出至少是 omp 的 2 倍"],
        [/成功/.test(get("插入一行后：")) && /Recovered/i.test(get("插入一行后：")), "行号偏移：omp 自动对齐并警告"],
        [/错误/.test(get("目标行被改后：")) && /rejected/i.test(get("目标行被改后：")), "目标行被改：omp 拒绝"],
        [/Pyright/.test(get("LSP：")) && /\d/.test(get("eval：")) && get("eval：").includes("31"), "LSP 报出类型错误；eval 跨调用保留了变量"],
      ];
      const ok = checks.every((c) => c[0]);
      const qbox = h("div");
      if (ok) qbox.append(choice({ id: "q1", store: [ID, "labq"], kicker: "问题", q: "「插入一行后」那次，pi 也会改对（M15 §4 的对照）。那么 omp 的标签多给了你什么？", opts: [{ t: "它告诉你「文件在你读过之后变了」，并说明它是怎样对齐的", ok: true }, { t: "什么都没多给" }, { t: "它让编辑更快" }], explain: "pi 默默成功；omp 成功并警告。你和模型都知道：刚才看到的不是现在的文件。", cls: "predict",
        onAnswer: (_, right) => { if (right && !isSample) { Store.set(ID, "lab", { raw: ta.value, passed: true }); checkDone(); } } }));
      out.replaceChildren(h("ul", { class: "check-list" }, checks.map(([o, t]) => h("li", null, h("span", { class: o ? "ok" : "no" }, o ? "✓" : "✗"), t))),
        ok ? qbox : h("div", { class: "note warn" }, h("span", { class: "k" }, "没有全部通过"), "「模型没有调用 edit」：模型拒绝了用旧标签，重跑第 5 步即可。LSP 一行是空的：确认 pyproject.toml 在当前目录（LSP 只在 cwd 找根标记）。数字和示例不同没关系，只看关系。"),
        ok && isSample ? h("p", { class: "mute" }, "示例数据只供试用，不计入实验。") : null);
    };
    if (saved.raw) setTimeout(() => verify(false), 0);
    const step = (title, note, code) => h("div", { class: "lab-step" }, h("div", null, h("b", null, title), note ? h("p", { class: "dim", style: { margin: "4px 0 0" } }, note) : null, copyBlock(code)));
    return h("div", { class: "lab-steps" },
      step("进入带 omp 的临时 shell（M14 已登录过）。", "如果 nix 问是否允许 extra-substituters 等设置，回答 n。", LAB_SHELL),
      step("建实验目录：一个小文件 greet.py，一个 28 行的 report.py，一个让 LSP 认出项目的 pyproject.toml。", null, LAB_SETUP),
      step("标签：同一个文件改一个字节前后各读一次。", "不调用模型：omp read 显示 read 工具会返回什么。", LAB_TAG),
      step("同一个改动，pi 和 omp 各做一次，比输出。", "2 次小的模型调用。", LAB_SIZE),
      step("过期标签：用 RPC 让 omp 先读，然后在它不知道的时候改文件，再让它按旧标签改。", "2 个场景，共 4 次很小的模型调用。脚本就是 M13 学过的 RPC 客户端。", LAB_STALE),
      step("LSP 和 eval。", "nix shell 临时提供 pyright，不装进系统。2 次小的模型调用。", LAB_LSP),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "粘贴第 3–6 步的输出，核对，回答问题。"), h("div", { style: { marginTop: "8px" } }, ta),
        h("div", { style: { display: "flex", gap: "8px", marginTop: "8px" } }, h("button", { class: "btn primary", onclick: () => verify(false) }, "核对我的运行"), h("button", { class: "btn ghost", onclick: () => verify(true) }, "先用示例数据试试")), out)),
      step("清理，并退出临时 shell。", null, LAB_CLEAN));
  }

  // ================= quiz / review / recap =================
  const QUIZ = [
    { q: "[report.py#0458] 里的 0458 是什么？", opts: [{ t: "整份文件内容算出的 4 位十六进制标签", ok: true }, { t: "文件的行数" }, { t: "会话 ID" }], why: "内容一变标签就变；同样的内容在不同路径下标签相同（本机实测）。" },
    { q: "hashline 的 PUT 2.=4: 表示：", opts: [{ t: "把原文件第 2–4 行换成下面的 + 行", ok: true }, { t: "在第 2 行后插入 4 行" }, { t: "删除第 2 和第 4 行" }], why: "行号都指读到时的原始快照，不是本次调用里前面几处改完后的行号。" },
    { q: "PUT 5*: 里的 * 表示：", opts: [{ t: "从第 5 行开始的整个语法块（tree-sitter 解析）", ok: true }, { t: "第 5 行到文件末尾" }, { t: "所有第 5 行" }], why: "锚在块的开头那行（def、class、if……），不能锚在结尾或空行。" },
    { q: "本机实测，把 20 行函数体换成一行，整次运行的输出：", opts: [{ t: "pi 560 token，omp 约 80–110", ok: true }, { t: "差不多" }, { t: "omp 更多" }], why: "pi 的 edit 要逐字抄出旧文本。输出 token 比输入慢、也更贵。" },
    { q: "读完文件后有人在顶部插了一行，模型用旧标签改第 2 行。omp：", opts: [{ t: "对齐到新的第 3 行，成功，并警告", ok: true }, { t: "改到错误的第 2 行" }, { t: "拒绝" }], why: "目标行内容没变，快照链能证明唯一安全的结果。pi 在这种情况下也成功，但不提示。" },
    { q: "如果被改的正是目标行本身：", opts: [{ t: "omp 拒绝，提示重新读；pi 也因找不到旧文本而失败", ok: true }, { t: "omp 照改" }], why: "两种机制都不会覆盖别人的改动。" },
    { q: "omp 的 LSP 要工作，需要：", opts: [{ t: "PATH 上有语言服务器，且当前目录里有它的根标记文件", ok: true }, { t: "什么都不需要" }, { t: "在 config.yml 里写服务器地址" }], why: "本机用 nix shell 临时提供 pyright，cwd 里有 pyproject.toml。根标记只在 cwd 找，不向上找。" },
    { q: "omp 默认会在每次 edit 之后自动跑诊断吗？", opts: [{ t: "不会：lsp.diagnosticsOnEdit 默认 false（write 默认会）", ok: true }, { t: "会" }], why: "开启后也只短暂等待；服务器冷启动赶不上时，诊断会稍后送达。最可靠的是让模型主动调 xd://lsp。" },
    { q: "eval 工具的特点：", opts: [{ t: "Python/JS 运行时常驻，变量跨调用保留；属于 exec 等级", ok: true }, { t: "每次都是全新进程" }, { t: "只读，不能写文件" }], why: "本机实测：第一次定义 x，第二次还能用。bash.patterns 的 deny 管不到 eval 里起的 shell，要单独设 tools.approval.eval。" },
    { q: "ast_grep 在 omp 18.10.3 里默认：", opts: [{ t: "关闭，要设 astGrep.enabled: true", ok: true }, { t: "开启" }], why: "开启后也是可发现工具，挂在 xd:// 下。" },
  ];
  const REVIEW = [
    { q: "（复习 M1）模型写出的工具调用参数，算哪种 token？", opts: [{ t: "输出 token", ok: true }, { t: "输入 token" }, { t: "不计费" }], why: "本课会量出：编辑方式不同，输出差好几倍。" },
    { q: "（复习 M14）omp 的扩展工具和 lsp 默认以什么形式出现？", opts: [{ t: "xd:// 设备：先 read 说明，再 write 参数", ok: true }, { t: "顶层工具" }], why: "本课的 lsp 实验里你会看到这两步。" },
  ];
  const PRE = [
    { id: "p1", q: "把一个 20 行函数体换成一行。pi 的整次输出大约是 omp 的几倍？", opts: [{ t: "差不多" }, { t: "约 2 倍" }, { t: "约 5–7 倍", ok: true }] },
    { id: "p2", q: "omp 读完文件后，有人在顶部插了一行。模型按旧行号改第 2 行，结果：", opts: [{ t: "改错了行" }, { t: "被拒绝" }, { t: "自动对齐到正确的行，并警告", ok: true }] },
    { id: "p3", q: "omp 用 edit 改完 Python 文件，默认会自动把类型错误告诉模型吗？", opts: [{ t: "会" }, { t: "不会", ok: true }] },
  ];
  function checkDone() {
    const ok = Store.get(ID, "lab", {}).passed && Store.get(ID, "quiz", { best: 0 }).best >= 8;
    if (ok && !Store.get(ID, "done")) Store.set(ID, "done", true);
  }

  window.Course.register(ID, (page) => {
    const rc = window.Course.recapBlock(ID, {
      pre: PRE,
      next: { id: "M16", title: "omp 的编排", text: "工具是一个 agent 的手。M16 讲 omp 怎样让多个 agent 分工：子代理和模型角色、流式规则（TTSR）、advisor。" },
      extra: () => [["改法对照", Object.keys(Store.get(ID, "wb", {})).length + " / " + TASKS.length], ["选工具", DRILL.filter((x, i) => x.opts[Store.get(ID, "drill", {})["d" + i]]?.ok).length + " / " + DRILL.length]],
    });
    page.append(h("div", { class: "bench" },
      h("header", { class: "mhead" }, h("div", { class: "crumbs" }, "第 6 单元 · oh-my-pi / M15"), h("h1", { class: "mtitle" }, h("span", { class: "mid" }, "M15"), "omp 的工具面")),
      section("s-hero", 0, "开场", null, workbench(),
        h("div", { class: "col" },
          h("p", { class: "thesis" }, "不抄旧文本，只说行号。", h("br"), "再用一个标签，确认你看的还是那份文件。"),
          h("p", { class: "lead" }, "上面是 hashline 工作台：选一种改法，看 omp 和 pi 各要模型写出什么。本课先拆开 hashline，再看 omp 的另外几件工具：LSP、eval、ast_grep 和内部 URL。")),
        h("div", { class: "panel objectives" },
          h("ol", null,
            h("li", null, "读懂 hashline 的 read 输出和标签，写出四种基本编辑。"),
            h("li", null, "用实测数据说明 hashline 省在哪里，以及它和 pi 的 edit 各自怎样应对过期内容。"),
            h("li", null, "让 omp 的 LSP 工作起来，说出它的前提和默认设置。"),
            h("li", null, "为任务在 grep、LSP、ast_grep、eval 之间选对工具。"),
            h("li", null, "认出常用的内部 URL。")),
          h("div", { class: "obj-side" },
            h("div", null, h("span", { class: "k" }, "时长"), "约 75 分钟"),
            h("div", null, h("span", { class: "k" }, "前置"), "M13、M14"),
            h("div", null, h("span", { class: "k" }, "练习"), "§8 实验 + §9 测验（≥ 8/10）"),
            h("div", null, h("span", { class: "k" }, "核对版本"), "omp 18.10.3 · pyright 1.1.411"))),
        h("h3", null, "本课路线"),
        route(ID, [["s-pre", 1, "动手", "复习与预测"], ["s-read", 2, "阅读", "hashline：读"], ["s-write", 3, "阅读", "hashline：写"], ["s-stale", 4, "阅读", "过期与恢复"], ["s-lsp", 5, "阅读", "LSP"], ["s-more", 6, "阅读", "eval、ast_grep、URL"], ["s-drill", 7, "动手", "选工具"], ["s-lab", 8, "实验", "五个测量"], ["s-quiz", 9, "测验", "10 题"], ["s-recap", 10, "阅读", "小结"]])),
      h("div", { class: "col" },
        section("s-pre", 1, "复习与预测", "先复习，再预测",
          todo("两道复习题立即判分；三道预测课末揭晓。"),
          REVIEW.map((r, i) => choice({ id: "r" + i, store: [ID, "rev"], kicker: "复习 " + (i + 1) + " / 2", q: r.q, opts: r.opts, explain: r.why, shuffleSeed: 301 + i * 7 })),
          PRE.map((p, i) => choice({ id: p.id, store: [ID, "pre"], kicker: "预测 " + (i + 1) + " / 3", q: p.q, opts: p.opts, reveal: false, shuffleSeed: 147 + i * 13 }))),
        section("s-read", 2, "hashline：读", "每一行都有编号，整份文件有一个标签",
          todo("读懂 read 的输出格式。", true),
          h("pre", { class: "script" }, h("span", { class: "lbl" }, "本机：omp read greet.py（这条命令显示 read 工具会返回什么，不调用模型）"), `[greet.py#2F01]
1:def greet(name):
2:    print("Hello, " + name)
3:
4:
5:def bye(name):
6:    print("Bye, " + name)
7:
8:greet("world")`),
          h("ul", { class: "rule" },
            h("li", null, h("b", null, "标签 #2F01："), "由整份文件的内容算出的 4 位十六进制数。改一个字节就变（本机：末尾加一行注释，#2F01 → #F63F）。同样的内容换个文件名，标签不变。"),
            h("li", null, h("b", null, "行号："), "编辑时用它来指位置，不用抄原文。"),
            h("li", null, h("b", null, "看过才能改："), "omp 记录模型看过哪些行（edit.enforceSeenLines 默认开）。没读过的行不能直接改，要先读。"),
            h("li", null, h("b", null, "选择器："), "read greet.py:5-6 只读几行（前后自动带一点上下文）；:raw 读原文，不带编号和标签。"))),
        section("s-write", 3, "hashline：写", "哪几行，换成什么",
          todo("回到开场的工作台，四种改法都点一遍。", true),
          h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" },
            h("thead", null, h("tr", null, h("th", null, "写法"), h("th", null, "作用"))),
            h("tbody", null, [
              ["PUT N.=M:", "把原文件第 N–M 行换成下面的 + 行"],
              ["PUT N*:", "替换从第 N 行开始的整个语法块（函数、类、if……）"],
              ["PUT <N: / PUT >N:", "在第 N 行之前 / 之后插入"],
              ["PUT >$:", "追加到文件末尾"],
              ["CUT N.=M / CUT N*", "删除（并放进剪贴板，可以 @名字 命名）"],
              ["PUT <N @名字", "把剪贴板内容粘贴到某处（可以跨文件：移动函数）"],
              ["REM / MV 目标", "删除文件 / 改完后改名"],
            ].map(([a, b]) => h("tr", null, h("td", null, h("code", null, a)), h("td", null, b)))))),
          h("p", { style: { marginTop: "12px" } }, "每段以 [路径#标签] 开头，标签必须抄自最近一次 read、grep 或 edit 的结果。新建或整个覆盖文件用 write。"),
          sizeBars(),
          h("p", { class: "dim", style: { marginTop: "10px" } }, "omp 也支持其他编辑格式（replace、apply_patch……），按模型自动选择；少数模型家族默认退回 replace。本机的 gpt-6-astra 用的是 hashline。")),
        section("s-stale", 4, "过期与恢复", "你读到的，还是现在的文件吗",
          todo("读两行对照。实验里你会亲手复现。", true),
          h("p", null, "模型读完文件到动手修改之间，文件可能被你、被另一个 agent、被格式化工具改过。用 RPC 可以精确地制造这个时间差（本机实测）："),
          staleTable(),
          h("p", { style: { marginTop: "12px" } }, "两种机制都不会覆盖别人的改动。区别在第一行：pi 按文本匹配，旧文本还在就照改，不会告诉你文件变过；omp 发现标签对不上，用会话里记录的快照把旧行号对齐到新文件，", h("b", null, "成功后明确警告"), "。对不齐（目标行本身变了）就拒绝，并告诉模型当前标签，让它重新读。")),
        section("s-lsp", 5, "LSP", "让懂语言的程序来回答",
          todo("读前提和默认设置。", true),
          h("p", null, "语言服务器（LSP）是编辑器背后那个「懂代码」的程序：类型检查、跳转定义、找引用、安全重命名。omp 把它挂成 xd://lsp 设备。本机实测，模型的调用是："),
          h("pre", { class: "script" }, `read  { path: "xd://lsp" }
write { path: "xd://lsp", content: "{\\"action\\":\\"diagnostics\\",\\"file\\":\\"report.py\\"}" }
→ 1 error(s):
  28:12 [error] [Pyright] Operator "+" not supported for types "int" and "Literal['元']"`),
          h("ul", { class: "rule" },
            h("li", null, h("b", null, "前提："), "PATH 上有对应的服务器（pyright、rust-analyzer、typescript-language-server……），而且", h("b", null, "当前目录"), "里有它的根标记（pyproject.toml、Cargo.toml、tsconfig.json……）。只看 cwd，不向上找。"),
            h("li", null, h("b", null, "动作："), "diagnostics、definition、references、hover、symbols 只读；rename、rename_file、code_actions 会改文件，按 write 等级审批。"),
            h("li", null, h("b", null, "写后诊断："), "lsp.diagnosticsOnWrite 默认开（write 之后），lsp.diagnosticsOnEdit 默认关（edit 之后）。开启后 omp 只短暂等待；服务器还没准备好时，诊断会在稍后送达。本机冷启动的 pyright 就没赶上——所以最可靠的是让模型主动调 lsp。"),
            h("li", null, h("b", null, "--no-lsp"), "整体关闭 LSP。"))),
        section("s-more", 6, "eval、ast_grep、URL", "另外三件工具",
          todo("读三段。", true),
          h("p", null, h("b", null, "eval："), "一个常驻的 Python 或 JavaScript 运行时。一次调用是一个「单元格」，变量留到下一次（本机：第一次定义 x = 2**100，第二次打印位数 31）。适合在运行时里算，只把结果放进上下文。它属于 exec 等级；bash.patterns 的拒绝规则管不到 eval 里起的 shell，要限制就设 tools.approval.eval。"),
          h("p", null, h("b", null, "ast_grep / ast_edit："), "按语法树搜索和改写。模式里 $X 匹配一个完整节点，$$$ 匹配任意多个。它不会被字符串和注释里的同名文本干扰。ast_grep 默认关闭（astGrep.enabled），ast_edit 默认挂在 xd:// 下，改动要先预览再确认。"),
          h("p", null, h("b", null, "内部 URL："), "omp 的 read、write、grep 认识一组特殊地址："),
          h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" }, h("tbody", null, URLS.map(([a, b]) => h("tr", null, h("td", { style: { whiteSpace: "nowrap" } }, h("code", null, a)), h("td", null, b))))))),
        section("s-drill", 7, "选工具", "同一个目标，换一件工具",
          todo("四个场景，各选一件工具。"),
          DRILL.map((x, i) => choice({ id: "d" + i, store: [ID, "drill"], kicker: "场景 " + (i + 1) + " / " + DRILL.length, q: x.q, opts: x.opts, explain: x.why, shuffleSeed: 311 + i * 3 }))),
        section("s-lab", 8, "实验", "五个测量",
          todo("按第 1–8 步操作。全部在终端里完成。"),
          h("p", null, "你会亲手看到标签怎样变化、hashline 省下多少输出、过期标签的两种结局，再让 LSP 和 eval 各工作一次。"),
          h("div", { class: "note" }, h("span", { class: "k" }, "实验规则"), "omp 和 pyright 都由 nix shell 临时提供；所有运行 --no-session；只在 ~/pi-lab/m15 里做；最后清理。共 8 次小的模型调用。"),
          lab()),
        section("s-quiz", 9, "掌握测验", "10 题，8 题过关", todo("10 题全部作答，点「交卷」。"), window.Course.quizBlock(ID, QUIZ, checkDone)),
        section("s-recap", 10, "小结", "你学到了什么",
          todo("看自己的预测和成绩。觉得学会了，就在本节最后点「标记为已完成」。", true),
          h("p", { class: "lead" }, "一句话：hashline 用「行号 + 内容标签」代替「逐字抄旧文本」，输出省好几倍，文件变过时会对齐并警告、对不齐就拒绝；LSP、eval、ast_grep 把「懂代码」和「算东西」交给专门的程序，前提是你知道它们默认开没开、靠什么启动。"),
          rc))));
    return () => rc._cleanup && rc._cleanup();
  });
})();
