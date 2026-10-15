/* CAP · 毕业：配好你自己的 pi */
(function () {
  "use strict";
  const { h, section, lessonHead, howto, completeButton } = window.Course;
  const ID = "CAP";

  window.Course.register(ID, (page) => {
    page.append(h("div", { class: "col" },
      lessonHead(ID, [
        h("p", null, "课程讲完了。最后这一页不留作业，只把前面学的东西落到你每天用的 pi 上：按顺序配好几处地方，以后每次打开 pi，它就已经按你的习惯工作了。"),
        h("p", null, "每一步都写明做什么、为什么（对应哪一课）、怎么做。都是可选的，挑你用得上的做。"),
      ], [
        "日常用的 pi 应该配好哪几处。",
        "每一处放什么、不放什么。",
      ]),

      section("s-agents", 1, "说明", "第 1 步：全局 AGENTS.md，写你的个人偏好",
        h("p", null, "放在 ~/.pi/agent/AGENTS.md，所有项目都会加载（第 6、8 课）。只写简短、每轮都用得上的偏好，例如："),
        h("pre", null, `- 用简体中文回答，句子简短。
- 改代码前先说明打算怎么改；改完说明改了哪些文件。
- 不要自己执行 git push。`),
        h("p", { class: "dim" }, "项目自己的约定（测试命令、目录结构）写在项目根目录的 AGENTS.md，不要放在这里。")),

      section("s-model", 2, "模型", "第 2 步：默认模型和思考强度",
        howto("设置方法（第 7 课）", [
          ["/model → 选中 → Ctrl+S", "存为新会话的默认模型。"],
          ["/thinking → 选中 → Ctrl+S", "存为默认思考强度。日常 medium 就够。"],
          ["/scoped-models", "圈定两三个常用模型，之后用 Ctrl+P 轮换。"],
        ])),

      section("s-tpl", 3, "模板", "第 3 步：把常说的话做成提示模板",
        h("p", null, "在 ~/.pi/agent/prompts/ 里放几个 Markdown 文件，文件名就是命令名（第 8 课）。例如 review.md："),
        h("pre", null, `---
description: 审查当前改动，可以指定重点
argument-hint: "[重点]"
---
请审查当前的改动（git diff），重点看\${1:-正确性和边界情况}。
按「问题 / 位置 / 建议」列出，没有问题就直说。`),
        h("p", null, "放好后在 pi 里 /reload，输入 /review 或 /review 并发安全 就能用。")),

      section("s-skill", 4, "Skill", "第 4 步：把较长的固定流程做成 Skill",
        h("p", null, "如果你有一套又长、又不是每次都用的做法（发布流程、写周报的步骤、整理笔记的规则），做成 Skill，放在 ~/.pi/agent/skills/名字/SKILL.md（第 9 课）。关键是描述写清「做什么 + 什么时候用」："),
        h("pre", null, `---
name: weekly-report
description: 按固定格式写周报。用户要求写周报、总结这周的工作时使用。
---
1. 运行 git log --since="1 week ago" --oneline 看这周的提交。
2. 按「完成 / 进行中 / 下周计划」三节写，每节不超过 5 条。
3. 每条一句话，写结果，不写过程。`)),

      section("s-safe", 5, "安全", "第 5 步：安全上的几个默认习惯",
        howto("习惯（第 13 课）", [
          ["改动前先 git commit", "pi 改错了随时回退。最便宜也最有效。"],
          ["陌生仓库只读打开", "pi --tools read,grep,find,ls -nc --no-approve。可以在 shell 里设一个别名，比如 alias piro='pi --tools read,grep,find,ls -nc --no-approve'。"],
          ["进陌生仓库先看", "cat AGENTS.md；ls -la .pi .omp .claude。"],
          ["分享会话前先检查", "/export 后自己看一遍，再 /share。"],
          ["不放心就隔离", "要让它跑命令又信不过，就放进容器（第 13 课的 docker 命令）。"],
        ]),
        h("p", { class: "dim" }, "想在执行前拦下特别危险的命令，可以把第 11 课那个 20 行的守卫扩展放进 ~/.pi/agent/extensions/，规则改成你担心的命令。记住它挡得住失误，挡不住所有写法。")),

      section("s-auto", 6, "自动化", "第 6 步（可选）：一个自动跑的小任务",
        h("p", null, "找一件每天或每周重复的小事，用 print 模式交给 pi（第 14 课）。例如每天早上汇总昨天的提交："),
        h("pre", null, `cd ~/某个项目 && git log --since=yesterday --oneline \\
  | timeout 300 pi -p --no-session --tools read -nc "把这些提交整理成三句话的日报" \\
  > ~/日报-$(date +%F).md`),
        h("p", { class: "dim" }, "注意这里 pi 的输入来自管道，所以不用加 < /dev/null；如果放进循环或由别的程序调用，记得加上。想定时运行，用系统的定时任务工具（macOS 上是 launchd，Linux 上是 cron 或 systemd timer）。")),

      section("s-daily", 7, "速查", "日常速查",
        howto("最常用的操作", [
          ["@文件", "把文件内容附进消息。"],
          ["!命令 / !!命令", "运行命令，输出给模型看 / 只给你看。"],
          ["Enter / Alt+Enter / Esc", "它干活时：插话 / 排队 / 叫停。"],
          ["/tree", "回到之前某一步重来。"],
          ["/compact 保留……", "手动压缩，并说明要保留什么。"],
          ["/new", "换话题就开新会话。"],
          ["/session", "看这个会话用了多少。"],
          ["/reload", "改了配置、模板、Skill、扩展后重新加载。"],
        ])),

      section("s-done", 8, "结束", "完成",
        h("div", { class: "panel takeaway" }, h("ol", null,
          h("li", null, "模型只读写文字，pi 替它动手；每一轮都带着全部历史，能做什么只看工具。"),
          h("li", null, "上下文是预算：少读、先过滤、换话题开新会话、需要时带说明压缩。"),
          h("li", null, "说明（AGENTS.md、模板、Skill）只是文字；扩展是代码，能加工具、能拦截。"),
          h("li", null, "pi 用你的权限运行，真正的边界是隔离，再加 git 兜底。"),
          h("li", null, "按任务选 pi 或 omp，用课程里的事实说明理由。"))),
        h("div", { class: "panel end-done", style: { marginTop: "12px", padding: "6px 18px 14px" } }, completeButton(ID)))));
  });
})();
