/* M6 · 模型与提供者 */
(function () {
  "use strict";
  const { h, section, quizBlock, lessonHead, look, howto, endBlock } = window.Course;
  const ID = "M6";

  // Same question at five thinking levels (pi 0.99.2, gpt-6-astra). Time includes the network round trip.
  const THINK = [["off", 36, 11991], ["low", 40, 11633], ["medium", 45, 12586], ["high", 39, 12606], ["xhigh", 75, 16251]];
  function thinkChart() {
    const maxR = Math.max(...THINK.map((t) => t[1]));
    return h("div", { class: "panel" }, h("div", { class: "panel-h" }, h("span", null, "同一道题，五档思考强度"), h("span", null, "正确答案：75")),
      h("div", { class: "thinkchart" },
        h("div", { class: "thinkrow", style: { color: "var(--fg-mute)", fontSize: "15px" } }, h("span", null, "强度"), h("span", null, "思考用的 token"), h("span", { class: "n" }, "耗时"), h("span", { class: "n" }, "答案")),
        THINK.map(([t, r, ms]) => h("div", { class: "thinkrow" }, h("b", null, t), h("div", { class: "bar", style: { width: (r / maxR) * 100 + "%" } }, h("span", null, r)), h("span", { class: "n" }, (ms / 1000).toFixed(1) + " 秒"), h("span", { class: "n" }, "75 ✓")))),
      h("p", { class: "mute", style: { fontSize: "15px", padding: "0 16px 14px", margin: 0 } }, "题目：1 到 1000 之间，有多少个整数的各位数字之和等于 13。"));
  }

  const QUIZ = [
    { q: "「提供者」和「模型」是什么关系？", opts: [{ t: "提供者是访问渠道，模型是生成回复的那个；同一个模型可以通过不同提供者访问", ok: true }, { t: "两者是同一个东西" }, { t: "模型决定用哪个提供者" }], why: "例如同一个开源模型，可以通过 OpenRouter 访问，也可以在本地用 Ollama 跑。" },
    { q: "会话中途想换个模型，并且以后新会话都默认用它：", opts: [{ t: "/model 选中后按 Ctrl+S", ok: true }, { t: "/model 选中后按 Enter" }, { t: "/reload" }], why: "Enter 只换当前会话；Ctrl+S 同时存为新会话的默认。" },
    { q: "一个普通的改代码任务，把思考强度从 medium 调到 xhigh，通常会：", opts: [{ t: "更慢、更贵，结果不一定更好", ok: true }, { t: "明显更准" }, { t: "更快" }], why: "高强度留给真正难的问题：设计、难缠的 bug、多步规划。" },
    { q: "想在 pi 里用本机 Ollama 跑的模型，最简单的做法：", opts: [{ t: "在 ~/.pi/agent/models.json 里加一个提供者，填地址和模型名", ok: true }, { t: "写一个提供者扩展" }, { t: "改 AGENTS.md" }], why: "Ollama 使用 OpenAI 兼容的接口，pi 已经支持。只有接口或登录方式特殊时，才需要写扩展。" },
    { q: "/model 里看不到你刚在 models.json 里加的模型，最可能的原因：", opts: [{ t: "它没有可用的密钥（apiKey 没填，或引用的环境变量没设置）", ok: true }, { t: "要重启电脑" }, { t: "models.json 只能写一个模型" }], why: "/model 只列出有可用凭证的模型。本地服务不需要密钥，也要填一个占位值。" },
  ];

  window.Course.register(ID, (page) => {
    page.append(h("div", { class: "col" },
      lessonHead(ID, [
        h("p", null, "pi 本身不带模型。它要通过某家", h("b", null, "提供者"), "（OpenAI、Anthropic、OpenRouter，或你本机跑的模型服务）去调用一个模型，还要有你的账号或密钥。"),
        h("p", null, "这一课讲怎样登录、怎样选模型和切换模型、思考强度是什么、该调多高，以及怎样接入本地模型或自建的服务。"),
      ], [
        "提供者、模型、凭证分别是什么；用订阅、密钥、本地模型各怎么接入。",
        "怎样选模型、切模型；思考强度怎么选。",
        "怎样用 models.json 接入一个兼容的模型服务。",
      ]),

      section("s-concept", 1, "概念", "提供者、模型、凭证",
        h("ul", { class: "rule" },
          h("li", null, h("b", null, "模型："), "生成回复的那个东西，例如 gpt-6-astra、claude-opus-5-5。"),
          h("li", null, h("b", null, "提供者："), "访问模型的渠道，例如 openai-codex（ChatGPT 订阅）、anthropic、openrouter。同一个模型可能有好几个渠道。"),
          h("li", null, h("b", null, "凭证："), "证明你有权使用：订阅登录，或 API 密钥。/login 保存的凭证在 ~/.pi/agent/auth.json 里。")),
        howto("你手里有什么，就怎么接入", [
          ["订阅（ChatGPT、Claude 等）", "/login 选提供者，在浏览器里登录。"],
          ["API 密钥", "/login 粘贴密钥；或设置环境变量（如 ANTHROPIC_API_KEY），适合脚本和 CI，不写进文件。"],
          ["本机 GGUF 模型", "用 pi 内置的 llama.cpp 支持，/llama 管理。"],
          ["Ollama、LM Studio、vLLM 等", "写进 models.json（§4）。"],
          ["接口或登录方式特殊的服务", "写或安装一个提供者扩展（第 10 课起讲扩展）。"],
        ]),
        h("div", { class: "note warn" }, h("span", { class: "k" }, "auth.json 是钥匙"), "里面是密钥和登录令牌。不要提交到 git，也不要随会话导出分享。")),

      section("s-pick", 2, "选模型", "选模型、切模型",
        howto("常用操作", [
          ["/model  或 Ctrl+L", "搜索并切换模型。Enter 只换当前会话；Ctrl+S 同时存为默认。"],
          ["Ctrl+P", "在几个常用模型之间轮换。用 /scoped-models 圈定参与轮换的模型。"],
          ["pi --model 名字", "只在这一次运行里用这个模型。可以写成 名字:high 同时指定思考强度。"],
          ["pi --list-models 关键词", "列出你能用的模型，以及它们的窗口大小、是否支持思考和图片。"],
        ]),
        h("p", null, "会话会记住中途换过的模型。用 pi -c 接着这个会话时，用的还是你换过去的那个，不影响新会话的默认。")),

      section("s-think", 3, "思考强度", "思考强度：想得越深越好吗",
        h("p", null, "很多模型在回答之前会先「想」一段（推理），再给出回复。", h("b", null, "思考强度"), "决定它想多久：off、minimal、low、medium、high、xhigh、max。想得越多，花的 token 和时间越多。能选哪几档取决于模型；编辑器边框的颜色就是当前强度。"),
        look("同一道数学题，用五档强度各问一次。比较思考用的 token 和耗时：答案有没有变？")),
      thinkChart(),
      h("p", { style: { marginTop: "16px" } }, "五档都答对了。xhigh 想得最多、最慢，但并没有更准。这类不算难的题，用不着高强度。"),
      howto("怎么选", [
        ["low", "机械的批量操作：改名、格式化、按模板生成。更快更省。"],
        ["medium", "日常改代码、问答。一般就用它。"],
        ["high / xhigh", "设计方案、排查难缠的 bug、多步规划。"],
        ["Shift+Tab  或 /thinking", "切换强度；在 /thinking 里按 Ctrl+S 存为默认。"],
      ]),

      section("s-mj", 4, "models.json", "接入本地模型或自建服务",
        h("p", null, "Ollama、LM Studio、vLLM 这类服务都提供和 OpenAI 一样的接口。pi 已经会说这种接口，所以只要在 ~/.pi/agent/models.json 里告诉它地址和模型名，不用写代码（// 后面是给你看的说明，真实文件里要删掉）："),
        h("pre", null, `{
  "providers": {
    "ollama": {                                // 提供者名字，自己起
      "baseUrl": "http://localhost:11434/v1",  // 服务地址
      "api": "openai-completions",             // 接口类型
      "apiKey": "ollama",                      // 本地服务随便填一个占位值
      "models": [
        { "id": "qwen2.5-coder:7b", "contextWindow": 32768 }
      ]
    }
  }
}`),
        h("ul", { class: "rule" },
          h("li", null, h("b", null, "api："), "服务说哪种接口。常见的有 openai-completions、openai-responses、anthropic-messages。"),
          h("li", null, h("b", null, "apiKey："), "可以直接写值；写 $名字 表示从环境变量读；以 ! 开头表示运行一条命令取得（例如从密码管理器读）。不要把真实密钥直接写进文件。"),
          h("li", null, h("b", null, "contextWindow："), "模型的窗口大小。写错了，状态栏的百分比和自动压缩都会算错。")),
        h("p", null, "打开 /model 时 pi 会重新读取这个文件，新模型就出现在列表里。"),
        h("div", { class: "note" }, h("span", { class: "k" }, "状态栏的数字来自提供者"), "token 数和百分比，都是提供者在每次回复末尾报告的用量，pi 不自己数；费用是 token 数乘以模型标价算出来的。所以本地模型或自建服务报的数不准，状态栏也就不准。")),

      section("s-quiz", 5, "检查", "检查一下", quizBlock(ID, QUIZ, null, null)),

      section("s-end", 6, "小结", "小结",
        endBlock(ID, [
          "pi 通过提供者调用模型，用你的订阅或密钥；/login 登录，凭证存在 auth.json。",
          "/model 切换模型（Ctrl+S 存为默认），Ctrl+P 在常用模型间轮换，pi --model 只影响这一次。",
          "思考强度越高越慢越贵，不一定更准；日常用 medium，难题再调高。",
          "兼容 OpenAI 接口的本地或自建服务，写进 models.json 就能用。",
        ], { id: "M7", text: "怎样告诉模型「这个项目的规矩」：AGENTS.md、系统提示文件和提示模板。" }))));
  });
})();
