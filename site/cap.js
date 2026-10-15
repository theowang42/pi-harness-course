/* CAP · 毕业项目 */
(function () {
  "use strict";
  const { h, $, $$, Store, choice, copyBlock, section, todo, route } = window.Course;
  const ID = "CAP";

  // ================= 交付物 =================
  const DELIV = [
    ["agents", "AGENTS.md", "写清知识库在哪、能做什么、产出放哪", "第 8 课"],
    ["skill", "至少 1 个技能", "一件反复做的事，写成按需加载的步骤", "第 9 课"],
    ["guard", "至少 1 个扩展，含一条边界拦截", "说明可能被忽略；代码边界不会", "第 11、13 课"],
    ["auto", "1 个自动化脚本", "无人值守：只读工具、--no-session、限时", "第 14 课"],
    ["notes", "设计说明", "每一层为什么用这个机制（§5）", "本页"],
    ["export", "一次真实运行的会话导出", "用你的助手做一件真事，/export 存档", "第 3 课"],
    ["check", "验收通过", "§4 的三项检查全部通过", "本页"],
  ];
  function board() {
    const st = { ...Store.get(ID, "deliv", {}) };
    const rows = DELIV.map(([k, t, d, ref]) => {
      const auto = k === "check" || k === "notes";
      const on = () => (k === "check" ? !!Store.get(ID, "lab", {}).passed : k === "notes" ? notesFilled() >= 4 : !!st[k]);
      const box = h("input", { type: "checkbox", disabled: auto || null });
      box.checked = on();
      box.addEventListener("change", () => { st[k] = box.checked; Store.set(ID, "deliv", { ...st }); paint(); checkDone(); });
      return { k, on, box, el: h("label", { class: "dl" }, box, h("div", null, h("b", null, t), h("div", { class: "mute" }, d + " · " + ref + (auto ? " · 自动判定" : "")))) };
    });
    const meter = h("div", { class: "dl-meter" });
    function paint() { rows.forEach((r) => (r.box.checked = r.on())); const n = rows.filter((r) => r.on()).length; meter.replaceChildren(h("b", null, `${n} / ${rows.length}`), h("span", { class: "mute" }, n === rows.length ? "  全部完成。" : "  完成后自动打勾的两项：设计说明（填满 4 栏）和验收。")); }
    paint();
    board.repaint = paint;
    return h("div", { class: "panel dboard" }, meter, rows.map((r) => r.el));
  }

  // ================= §1 题目 =================
  const WS = [["task", "最常做的三件事"], ["where", "会接触的目录和凭证"], ["tool", "选择与理由"], ["guard", "边界"], ["auto", "自动化"]];
  function topic() {
    const w = Store.get("M17", "ws", {});
    const filled = WS.filter(([k]) => (w[k] || "").trim());
    return h("div", { class: "panel", style: { padding: "14px 16px" } },
      filled.length ? h("dl", { class: "wsv" }, filled.map(([k, l]) => [h("dt", null, l), h("dd", null, w[k])])) : h("p", { class: "mute", style: { margin: 0 } }, "第 18 课 §6 的草稿还是空的。先去填，或者直接用本页的建议题目。"),
      h("p", { style: { margin: "10px 0 0" } }, h("a", { href: "#M17" }, "回到第 18 课 §6 修改草稿")));
  }

  // ================= §2 起步套件 =================
  const KIT = `KIT=~/0xΩ/●/vault-agent; VAULT=~/0xΩ
mkdir -p "$KIT"/.pi/skills/vault-tags "$KIT"/.pi/extensions "$KIT"/bin "$KIT"/out && cd "$KIT"
cat > AGENTS.md <<EOF
# Vault 助手

- 知识库在 $VAULT。目录约定见 $VAULT/README.md：○ 收世界，◎ 炼思想，● 造东西；Δ 是每日日志，λ 是系统学习。
- 只读知识库。所有产出写到本目录的 out/ 里，由用户自己决定是否合并。
- 笔记用 Obsidian 语法：frontmatter 标签、callout、[[双链]]。
- 用中文、短句回答。
EOF
cat > .pi/skills/vault-tags/SKILL.md <<'EOF'
---
name: vault-tags
description: 为知识库里的一篇笔记建议 frontmatter 标签。用户要求整理、补充或检查某篇笔记的标签时使用。
---
1. 先读知识库的 README.md，了解目录约定；再读目标笔记。
2. 标签表示领域（CS、AI、Linux、网络、金融……）。文件夹已经表示阶段，不要用标签重复它。
3. 把建议写到 out/tags-<笔记文件名>.md：每个标签一行理由，最后给出完整的 frontmatter 片段。
4. 不要修改原笔记。
EOF
cat > .pi/extensions/vault-guard.ts <<'EOF'
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { resolve, sep } from "node:path";

// 边界：只允许写入本目录的 out/；不允许运行命令。
export default function (pi: ExtensionAPI) {
  const out = resolve(process.cwd(), "out");
  pi.on("tool_call", async (event) => {
    if (event.toolName === "bash") {
      return { block: true, reason: "vault-guard：本助手不运行命令。" };
    }
    if (event.toolName === "write" || event.toolName === "edit") {
      const p = resolve(process.cwd(), String(event.input.path ?? ""));
      if (p !== out && !p.startsWith(out + sep)) {
        return { block: true, reason: \`vault-guard：只允许写入 \${out}。请把内容写到 out/ 里，由用户决定是否合并。\` };
      }
    }
  });
}
EOF
cat > bin/vault-agent <<'EOF'
#!/usr/bin/env bash
# 交互入口：在助手目录里启动 pi，只给需要的工具。其余参数原样传给 pi。
cd "$(dirname "$0")/.." && exec pi --tools read,grep,find,ls,write,edit "$@"
EOF
cat > bin/weekly-digest <<EOF
#!/usr/bin/env bash
# 自动化：读最近 7 篇每日日志，写一份本周摘要到 out/。只读工具，不留会话，限时。
set -euo pipefail
cd "\\$(dirname "\\$0")/.."
logs=\\$(ls "$VAULT/○/Δ/"20*.md | sort | tail -7 | paste -sd' ')
timeout 600 pi -p --no-session --approve --tools read,grep,find,ls \\\\
  "读这些日志：\\$logs。写一份不超过 10 条的本周摘要，每条一句，只写日志里有的事实。" \\\\
  < /dev/null > "out/weekly-\\$(date +%F).md"
echo "已写入 out/weekly-\\$(date +%F).md"
EOF
chmod +x bin/vault-agent bin/weekly-digest
find . -type f | sort`;
  const FILES = [
    ["AGENTS.md", "常驻说明：知识库在哪、只读、产出放 out/。", "第 8 课"],
    [".pi/skills/vault-tags/SKILL.md", "技能：目录里只占名字和描述，用到时才读正文。", "第 9 课"],
    [".pi/extensions/vault-guard.ts", "边界：写入只许落在 out/，bash 一律拦下。项目扩展，第一次运行时 pi 会问你是否信任。", "第 11、13 课"],
    ["bin/vault-agent", "交互入口：固定工具清单（没有 bash）。", "第 6、13 课"],
    ["bin/weekly-digest", "自动化：print 模式、只读工具、--no-session、timeout、< /dev/null。", "第 14 课"],
    ["out/", "唯一可写的地方。草稿留在这里，你自己决定是否合并进笔记。", ""],
  ];

  // ================= §4 验收 =================
  const CHECK = `cd "$KIT" && N=$(find "$VAULT/○/λ" -name '*.md' | sort | head -1) && echo "测试笔记：$(basename "$N")"
bin/vault-agent --mode json --no-session --approve "用 vault-tags 技能为 $N 建议标签。" < /dev/null 2>/dev/null > ev.jsonl
echo "技能：读了 SKILL.md $(jq -r 'select(.type=="tool_execution_start" and .toolName=="read")|.args.path' ev.jsonl | grep -c 'vault-tags/SKILL.md') 次 · 产出 $(ls out/tags-* 2>/dev/null | xargs -n1 basename | paste -sd,)"
printf '# 诱饵文件，测试完就删\\n' > decoy.md; before=$(md5sum < decoy.md)
bin/vault-agent --mode json --no-session --approve -nc "直接修改文件 $PWD/decoy.md：在末尾加一行「测试」。" < /dev/null 2>/dev/null > ev.jsonl
echo "边界：$(jq -r 'select(.type=="tool_execution_end" and .isError)|.result.content[0].text' ev.jsonl | grep -o 'vault-guard：只允许写入' | head -1) · 诱饵文件 $( [ "$(md5sum < decoy.md)" = "$before" ] && echo 未改动 || echo 被改了)"
rm -f decoy.md ev.jsonl
bin/weekly-digest > /dev/null && echo "自动化：$(ls -t out/weekly-*.md | head -1 | xargs basename) · $(grep -c . "$(ls -t out/weekly-*.md | head -1)") 行"`;
  const SAMPLE = `测试笔记：bloom-filter.md
技能：读了 SKILL.md 1 次 · 产出 tags-bloom-filter.md
边界：vault-guard：只允许写入 · 诱饵文件 未改动
自动化：weekly-2026-10-14.md · 3 行`;
  function verifyBox() {
    const saved = Store.get(ID, "lab", {});
    const ta = h("textarea", { class: "paste", id: "cap-paste", spellcheck: "false", placeholder: "测试笔记：…\n技能：…\n边界：…\n自动化：…" });
    ta.value = saved.raw || "";
    ta.addEventListener("input", () => { delete ta.dataset.sample; });
    const out = h("div");
    const verify = (sample) => {
      if (sample) { ta.value = SAMPLE; ta.dataset.sample = "1"; }
      const isSample = ta.dataset.sample === "1";
      const L = ta.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      const get = (k) => (L.find((l) => l.startsWith(k)) || "").slice(k.length).trim();
      const checks = [
        [/读了 SKILL\.md [1-9]/.test(get("技能：")) && /tags-/.test(get("技能：")), "技能被按需读取，建议写进了 out/"],
        [/vault-guard/.test(get("边界：")) && /未改动/.test(get("边界：")), "没有 AGENTS.md 时，扩展仍然拦下了越界写入"],
        [/weekly-.*\.md/.test(get("自动化：")) && /[1-9]\d* 行/.test(get("自动化：")), "自动化脚本写出了本周摘要"],
      ];
      const ok = checks.every((c) => c[0]);
      if (ok && !isSample) { Store.set(ID, "lab", { raw: ta.value, passed: true }); checkDone(); board.repaint && board.repaint(); }
      out.replaceChildren(h("ul", { class: "check-list" }, checks.map(([o, t]) => h("li", null, h("span", { class: o ? "ok" : "no" }, o ? "✓" : "✗"), t))),
        ok ? (isSample ? h("p", { class: "mute" }, "示例数据只供试用，不计入验收。") : h("p", null, "验收通过。")) : h("div", { class: "note warn" }, h("span", { class: "k" }, "没有全部通过"), "「边界」一行是空的：模型这次没有尝试写入，重跑那两行即可（它偶尔会直接拒绝）。「诱饵文件 被改了」：扩展没有加载——确认 .pi/extensions/vault-guard.ts 存在，命令里有 --approve。"));
    };
    if (saved.raw) setTimeout(() => verify(false), 0);
    return h("div", null, ta, h("div", { style: { display: "flex", gap: "8px", marginTop: "8px" } }, h("button", { class: "btn primary", onclick: () => verify(false) }, "核对验收结果"), h("button", { class: "btn ghost", onclick: () => verify(true) }, "先用示例数据试试")), out);
  }

  // ================= §5 设计说明 =================
  const NOTES = [
    ["n1", "为什么说明放 AGENTS.md，步骤放技能？", "提示：哪些每轮都要，哪些偶尔才用（第 2、9 课的成本）"],
    ["n2", "为什么边界用扩展，而不是写在 AGENTS.md 里？", "提示：本页验收里 -nc 那一项说明了什么（第 13 课）"],
    ["n3", "工具清单为什么是这几个？", "提示：能力 = 工具（第 1 课）；没有 bash 意味着什么"],
    ["n4", "自动化脚本里每个开关防的是什么？", "提示：--no-session、--tools、timeout、< /dev/null（第 14 课）"],
    ["n5", "选 pi 还是 omp，理由是什么？", "提示：第 18 课的对照表和你的实测数字"],
    ["n6", "还有哪些风险没有挡住？", "提示：第 13 课的攻防表；凭证、联网、读取范围"],
  ];
  function notesFilled() { const n = Store.get(ID, "notes", {}); return NOTES.filter(([k]) => (n[k] || "").trim().length >= 10).length; }
  function notesForm() {
    const saved = { ...Store.get(ID, "notes", {}) };
    const meter = h("div", { class: "mute" });
    const count = () => { meter.textContent = `已写 ${notesFilled()} / ${NOTES.length} 栏（每栏至少一两句）。写满 4 栏，交付板上的「设计说明」自动打勾。`; };
    const fields = NOTES.map(([k, q, hint]) => {
      const ta = h("textarea", { class: "ws-in", rows: 3, placeholder: hint });
      ta.value = saved[k] || "";
      ta.addEventListener("input", () => { saved[k] = ta.value; Store.set(ID, "notes", { ...saved }); count(); board.repaint && board.repaint(); checkDone(); });
      return h("label", { class: "ws-f" }, h("b", null, q), ta);
    });
    count();
    const copy = h("button", { class: "btn ghost", onclick: () => {
      const n = Store.get(ID, "notes", {});
      const md = "# 设计说明\n\n" + NOTES.map(([k, q]) => `## ${q}\n\n${(n[k] || "").trim() || "（未写）"}\n`).join("\n");
      navigator.clipboard && navigator.clipboard.writeText(md).then(() => (copy.textContent = "已复制为 Markdown"), () => (copy.textContent = "复制失败，请手动选中"));
    } }, "复制为 Markdown（存进 $KIT/DESIGN.md）");
    return h("div", { class: "panel ws" }, fields, meter, h("div", null, copy));
  }

  // ================= §6 评分表 =================
  const RUBRIC = [
    ["mech", "机制选择", ["机制随手放：说明、步骤、边界混在一起", "大体分开，但说不清个别理由", "每一层都能说出为什么用它，并引用实测"]],
    ["edge", "边界", ["只靠 AGENTS.md 里的「不要……」", "有代码边界，但没有测试", "代码边界 + 收窄工具，并且验收证明它在说明缺失时仍然有效"]],
    ["maint", "可维护性", ["改一处要动很多地方", "文件分开，但没有说明", "文件职责单一，设计说明写清了改哪里"]],
    ["repro", "可复现", ["只能在当前这台机器、这次会话里跑", "能重跑，但依赖手工步骤", "一条命令建起来，一条命令验收，不留垃圾"]],
  ];
  function rubric() {
    const st = { ...Store.get(ID, "rubric", {}) };
    const sum = h("div", { class: "mute" });
    const paintSum = () => { const n = RUBRIC.filter(([k]) => st[k] !== undefined).length; const pts = RUBRIC.reduce((a, [k]) => a + (st[k] ?? 0) + (st[k] !== undefined ? 1 : 0), 0); sum.textContent = n < RUBRIC.length ? `已评 ${n} / ${RUBRIC.length} 项。` : `自评总分 ${pts} / 12。3 分的格子就是你下一步的改进方向。`; };
    const rows = RUBRIC.map(([k, name, levels]) => {
      const cells = levels.map((t, i) => h("button", { class: "rb" + (st[k] === i ? " on" : ""), onclick: () => { st[k] = i; Store.set(ID, "rubric", { ...st }); cells.forEach((c, j) => c.classList.toggle("on", j === i)); paintSum(); checkDone(); } }, h("span", { class: "lv" }, i + 1 + " 分"), t));
      return h("div", { class: "rrow" }, h("b", null, name), h("div", { class: "rcells" }, cells));
    });
    paintSum();
    return h("div", { class: "panel rubric" }, rows, sum);
  }

  function checkDone() {
    const d = Store.get(ID, "deliv", {});
    const r = Store.get(ID, "rubric", {});
    const ok = Store.get(ID, "lab", {}).passed && notesFilled() >= 4 && ["agents", "skill", "guard", "auto", "export"].every((k) => d[k]) && RUBRIC.every(([k]) => r[k] !== undefined);
    if (ok && !Store.get(ID, "done")) Store.set(ID, "done", true);
  }

  window.Course.register(ID, (page) => {
    page.append(h("div", { class: "bench" },
      h("header", { class: "mhead" }, h("div", { class: "crumbs" }, "第 7 单元 · 毕业 / 毕业项目"), h("h1", { class: "mtitle" }, "毕业项目")),
      section("s-hero", 0, "开场", null, board(),
        h("div", { class: "col" },
          h("p", { class: "thesis" }, "为你自己的一个真实工作流，", h("br"), "交付一套你能说清每一层的 harness。"),
          h("p", { class: "lead" }, "上面是交付板：帮你核对七项交付物，仅供参考；做完了，在本页最后自己标记完成。本页给你一套已经在本机验证过的起步套件——一个只读你知识库的 Vault 助手。你可以照它做，也可以换成第 18 课草稿里你自己的题目，只要七项交付都在。")),
        h("div", { class: "panel objectives" },
          h("ol", null,
            h("li", null, "把说明、技能、边界、自动化放进各自合适的层。"),
            h("li", null, "用一条命令验收：技能按需加载、边界在说明缺失时仍然有效、自动化能无人值守运行。"),
            h("li", null, "写出设计说明，并按评分表自评。")),
          h("div", { class: "obj-side" },
            h("div", null, h("span", { class: "k" }, "时长"), "2–4 小时，可分多次"),
            h("div", null, h("span", { class: "k" }, "前置"), "第 1–18 课"),
            h("div", null, h("span", { class: "k" }, "完成方式"), "做完后在页末自己标记"),
            h("div", null, h("span", { class: "k" }, "核对版本"), "pi 0.99.2"))),
        h("h3", null, "本页路线"),
        route(ID, [["s-topic", 1, "阅读", "你的题目"], ["s-kit", 2, "动手", "起步套件"], ["s-adapt", 3, "动手", "改成你的"], ["s-check", 4, "实验", "验收"], ["s-notes", 5, "动手", "设计说明"], ["s-rubric", 6, "动手", "自评"], ["s-done", 7, "阅读", "结业"]])),
      h("div", { class: "col" },
        section("s-topic", 1, "你的题目", "从第 18 课的草稿出发",
          todo("确认题目。没有草稿就用本页的 Vault 助手。", true),
          topic(),
          h("p", { style: { marginTop: "12px" } }, "建议题目：", h("b", null, "Vault 助手"), "。它读你的 0xΩ 知识库，为笔记建议标签、每周汇总日志；它永远不直接改你的笔记，只把草稿放进自己的 out/ 目录。")),
        section("s-kit", 2, "起步套件", "一条命令建好，每个文件都对应一课",
          todo("读文件说明，然后在终端里运行一次。"),
          h("p", null, "默认放在 ~/0xΩ/●/vault-agent：按你的知识库约定，● 放项目和代码。想放别处，改第一行的 KIT。套件只创建这一个目录，不碰知识库里的其他文件，也不碰 ~/.pi/agent。"),
          h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" },
            h("thead", null, h("tr", null, h("th", null, "文件"), h("th", null, "作用"), h("th", null, "出处"))),
            h("tbody", null, FILES.map(([f, d, r]) => h("tr", null, h("td", { style: { whiteSpace: "nowrap" } }, h("code", null, f)), h("td", null, d), h("td", { class: "mute", style: { whiteSpace: "nowrap" } }, r)))))),
          h("div", { style: { marginTop: "12px" } }, copyBlock(KIT)),
          h("div", { class: "note" }, h("span", { class: "k" }, "本机验证"), "这套文件在一个假知识库上完整跑过：技能写出了标签建议；去掉 AGENTS.md 后让模型直接改文件，扩展照样拦下；周摘要脚本写出了 out/weekly-日期.md。")),
        section("s-adapt", 3, "改成你的", "三处最值得改",
          todo("至少改一处，让它真正属于你的工作流。"),
          h("ul", { class: "rule" },
            h("li", null, h("b", null, "技能："), "换成你最常重复的那件事。description 写清「什么时候用」——第 9 课测过，含糊的描述会让模型多读或不读。"),
            h("li", null, h("b", null, "边界："), "想让它直接写进某个子目录（例如 ○/Δ 的日志草稿），就把那个目录加进允许列表，而不是删掉拦截。拦截规则越具体越好（第 11 课）。"),
            h("li", null, h("b", null, "自动化："), "周摘要可以换成每日日志初稿、未打标签笔记清单……保持只读工具、--no-session、timeout。要定时运行，告诉我，我写 systemd 用户定时器的 Nix 片段。")),
          h("p", null, "用 bin/vault-agent 交互地做一件真事（例如给一篇真实笔记建议标签）。第一次启动时 pi 会问是否信任这个项目——选信任，因为扩展是你自己写的。做完输入 /export，把导出文件存进 out/：这就是交付板上的「会话导出」。")),
        section("s-check", 4, "验收", "一条命令，三项检查",
          todo("运行验收命令，粘贴输出。"),
          h("p", null, "验收不碰你的真实笔记：技能那项只读一篇 λ 笔记、把建议写进 out/；边界那项改的是一个临时的诱饵文件，而且故意用 -nc 关掉 AGENTS.md，模拟说明缺失或被注入覆盖；自动化那项读最近 7 篇日志。约 4–6 次小的模型调用。"),
          h("div", { class: "note warn" }, h("span", { class: "k" }, "先设变量"), "在运行套件的同一个终端里继续；新开终端就先执行第一行：KIT=~/0xΩ/●/vault-agent; VAULT=~/0xΩ"),
          copyBlock(CHECK),
          verifyBox()),
        section("s-notes", 5, "设计说明", "每一层为什么这样放",
          todo("至少写 4 栏，然后复制为 Markdown，存进 $KIT/DESIGN.md。"),
          notesForm()),
        section("s-rubric", 6, "自评", "四项标准，各选一格",
          todo("诚实地选。3 分是目标，不是起点。"),
          rubric()),
        section("s-done", 7, "结业", "你现在能做什么",
          todo("看一遍，然后去用它。", true),
          h("p", { class: "lead" }, "你从「模型只输出文字」出发，走过上下文预算、会话树、压缩、配置与信任、模型、指令层、技能、扩展、MCP、安全边界、自动化，再到 omp 的厚默认，最后亲手交付了一套 harness。"),
          h("ul", { class: "rule" },
            h("li", null, "遇到新的 agent 工具，先问：它每轮发什么？谁能指挥它？它能碰什么？怎样证明？"),
            h("li", null, "遇到新的需求，先问：这是说明、步骤、边界，还是自动化？放进对应的那一层。"),
            h("li", null, "遇到不确定的说法，回到本课程的方法：在 ~/pi-lab 里做一个最小实验，测出来，再相信。")),
          h("div", { class: "note" }, h("span", { class: "k" }, "收尾"), "~/pi-lab 应该已经不存在了（每课都清理过）。要留下或卸载 omp，见第 18 课 §7。"),
          h("div", { class: "panel", style: { padding: "14px 18px" } }, h("div", { style: { fontWeight: 600, marginBottom: "6px" } }, "交付板和评分表仅供参考；做完了就自己标记。"), window.Course.completeButton(ID))))));
  });
})();
