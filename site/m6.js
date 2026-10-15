/* M6 · 模型与提供者 */
(function () {
  "use strict";
  const { h, $, $$, Store, choice, copyBlock, section, todo, route, term } = window.Course;
  const ID = "M6";
  const fmt = (n) => Math.round(n).toLocaleString("en-US");

  // The exact request pi 0.99.2 sent to a local fake OpenAI-compatible server on this machine
  // (system text and tool descriptions shortened for display).
  const REQ = {"model":"parrot","messages":[{"role":"system","content":"You are an expert coding assistant operating inside pi, a coding agent harness. You help users by reading files, executing commands, editing code, and writing new files.\n\n<tools>\n- read: Read file contents\n- bash: Execute bash commands (ls, grep, find, etc.)\n- edit: Make precise file edits with exact text replacement, including multiple disjoint edits in one call\n- write: Create or overwrite files\n\nIn addition to the …（共 2784 字符）"},{"role":"user","content":[{"type":"text","text":"你好"}]}],"stream":true,"stream_options":{"include_usage":true},"store":false,"max_completion_tokens":1000,"tools":[{"type":"function","function":{"name":"read","description":"Read the contents of a file. Supports text files and images (jpg, png, gif, webp, bmp). Im…","parameters":{"type":"object","required":["path"],"properties":{"path":{"type":"string","description":"Path to the file to read (relative or absolute)"},"offset":{"type":"number","description":"Line number to start reading from (1-indexed)"},"limit":{"type":"number","description":"Maximum number of lines to read"}}}}},{"type":"function","function":{"name":"bash","description":"Execute a bash command in the current working directory. Returns stdout and stderr. Output…","parameters":{"type":"object","required":["command"],"properties":{"command":{"type":"string","description":"Shell command to execute"},"timeout":{"type":"number","description":"Timeout in seconds (optional, no default timeout)"}}}}},{"type":"function","function":{"name":"edit","description":"Edit a single file using exact text replacement. Every edits[].oldText must match a unique…","parameters":{"type":"object","required":["path","edits"],"properties":{"path":{"type":"string","description":"Path to the file to edit (relative or absolute)"},"edits":{"type":"array","items":{"type":"object","required":["oldText","newText"],"properties":{"oldText":{"type":"string","description":"Exact text for one targeted replacement. It must be unique in the original file and must not overlap with any other edits[].oldText in the same call."},"newText":{"type":"string","description":"Replacement text for this targeted edit."}}},"description":"One or more targeted replacements. Each edit is matched against the original file, not incrementally. Do not include overlapping or nested edits. If two changes touch the same block or nearby lines, merge them into one edit instead."}}}}},{"type":"function","function":{"name":"write","description":"Write content to a file. Creates the file if it doesn't exist, overwrites if it does. Auto…","parameters":{"type":"object","required":["path","content"],"properties":{"path":{"type":"string","description":"Path to the file to write (relative or absolute)"},"content":{"type":"string","description":"Content to write to the file"}}}}}]};

  const KEYDOC = {
    "model": "models.json 里这个模型的 id。提供者靠它决定用哪个模型。",
    "messages": "活动分支上的全部消息（M3）。第一条是 pi 拼好的系统提示，之后是你的消息、模型回复、工具结果。",
    "messages.role": "system / user / assistant / tool。pi 内部的记录在这里被翻译成提供者的格式。",
    "messages.content": "消息正文。系统提示有 2,784 个字符：基础说明、工具清单、规则、文档索引、工作目录（M1 的固定成本）。",
    "tools": "工具定义（M0 推论 1：能力 = 工具）。每个都带名字、说明和 JSON Schema 参数格式。模型按这个格式写工具调用。",
    "tools.type": "OpenAI 接口要求写 function。换成 Anthropic 接口时，pi 会改用那边的格式。",
    "tools.function": "工具本体：name、description、parameters。",
    "tools.function.name": "工具名。模型的工具调用里会原样写回这个名字。",
    "tools.function.description": "给模型看的说明。写得越清楚，模型越会用。",
    "tools.function.parameters": "JSON Schema。required 列出必填参数。",
    "stream": "流式返回。M0 开场里那些一段一段的 token，就是这样来的。",
    "stream_options": "include_usage = true：要求提供者在最后报告用量。底栏和 /session 的数字全靠它。",
    "max_completion_tokens": "回复的长度上限。来自 models.json 里的 maxTokens（这里是 1000）。",
    "store": "要求提供者不保存这次请求。",
  };
  function jsonTree(v, path, onKey) {
    const p = (t, c) => h("span", { class: c }, t);
    if (Array.isArray(v)) {
      return h("span", null, p("[", "pun"), h("div", { class: "blk" }, v.map((x, i) => h("div", null, jsonTree(x, path, onKey), i < v.length - 1 ? p(",", "pun") : null))), p("]", "pun"));
    }
    if (v && typeof v === "object") {
      const ks = Object.keys(v);
      return h("span", null, p("{", "pun"), h("div", { class: "blk" }, ks.map((k, i) => {
        const kp = path ? path + "." + k : k;
        return h("div", null, h("span", { class: "k", onclick: () => onKey(kp, k) }, JSON.stringify(k)), p(": ", "pun"), jsonTree(v[k], kp, onKey), i < ks.length - 1 ? p(",", "pun") : null);
      })), p("}", "pun"));
    }
    if (typeof v === "string") return h("span", { class: "s" }, JSON.stringify(v));
    return h("span", { class: "num" }, JSON.stringify(v));
  }

  // ================= §0 hero =================
  function hero() {
    const side = h("div", { class: "side" }, h("b", null, "这是 pi 真正发出去的东西"), h("p", { class: "dim" }, "本机实测：pi 连到一个本地假模型，假模型把收到的请求原样存了下来。点左边任一个蓝色的键，看它是什么。"));
    const seen = new Set(Object.keys(Store.get(ID, "keys", {})));
    const onKey = (path, k) => {
      const doc = KEYDOC[path] || KEYDOC[k];
      side.replaceChildren(h("code", { style: { fontSize: "16px" } }, path), h("p", { style: { marginTop: "8px" } }, doc || "这一层的结构，点它下面的键看具体含义。"));
      if (doc && !seen.has(path)) { seen.add(path); Store.set(ID, "keys", Object.fromEntries([...seen].map((x) => [x, 1]))); }
    };
    return h("div", { class: "panel" },
      h("div", { class: "journey" },
        [["1", "pi 内部", "会话树上的活动分支、系统提示各段、工具清单。"], ["2", "适配器 api", "按 models.json 里的 api 翻译成对方的格式：这里是 openai-completions。"], ["3", "提供者", "baseUrl 指向的服务：云端 API、订阅、本地服务器。"], ["4", "流式回复", "文字和工具调用一段段流回，最后附上 usage。"]]
          .map(([n, t, d]) => h("div", { class: "st" }, h("div", { class: "n" }, "第 " + n + " 步"), h("div", { class: "tt" }, t), h("p", null, d)))),
      h("div", { class: "reqgrid" }, h("div", { class: "jtree" }, jsonTree(REQ, "", onKey)), side));
  }

  // ================= §2 concepts =================
  const CONN = [
    ["订阅（ChatGPT、Claude、Copilot……）", "/login 选择提供者，浏览器登录", "你现在用的 openai-codex 就是这种"],
    ["API key", "/login 粘贴，或设置环境变量（如 ANTHROPIC_API_KEY）", "CI 里用环境变量，不写盘"],
    ["本地 GGUF 模型", "llama.cpp 路由器 + /llama", "pi 内置支持"],
    ["兼容端点（Ollama、LM Studio、vLLM、代理）", "models.json", "本课实验就是这种"],
    ["自定义协议或认证", "写或装一个提供者扩展", "M9 起讲扩展"],
  ];
  const ORDER = ["命令行 --api-key", "auth.json（/login 保存的）", "models.json 里的 apiKey", "环境变量 / 云凭证"];
  function orderDrill() {
    const saved = Store.get(ID, "order", {});
    let picked = saved.ok ? [...ORDER] : [];
    const pool = h("div", { class: "pool" }), slots = h("div", { style: { display: "grid", gap: "6px", padding: "14px" } }), fb = h("div", { class: "feedback", style: { padding: "0 14px 14px" } });
    const shuffled = window.Course.shuffle(ORDER, 5);
    function paint() {
      pool.replaceChildren(...shuffled.filter((x) => !picked.includes(x)).map((x) => h("button", { class: "card", onclick: () => { picked.push(x); paint(); } }, x)));
      if (!pool.children.length) pool.append(h("span", { class: "mute", style: { fontSize: "15px" } }, "全部排好了。"));
      slots.replaceChildren(...ORDER.map((_, i) => h("div", { class: "drow" }, h("span", null, h("b", null, "第 " + (i + 1) + " 优先　"), picked[i] || h("span", { class: "mute" }, "（点上面的卡片）")))));
      fb.replaceChildren();
      if (picked.length === ORDER.length) {
        const ok = picked.every((x, i) => x === ORDER[i]);
        Store.set(ID, "order", { ok });
        fb.append(h("span", { class: "verdict " + (ok ? "ok" : "no") }, ok ? "对。" : "不对。"), ok ? "pi 从上往下找，用第一个找到的凭证。" : "正确顺序：--api-key → auth.json → models.json → 环境变量。", " ", h("button", { class: "btn ghost", onclick: () => { picked = []; paint(); } }, "重排"));
      }
    }
    paint();
    return h("div", { class: "panel" }, h("div", { class: "panel-h" }, h("span", null, "同时配置了多处凭证时，pi 用哪一个？从高到低排序"), h("span", null, "点卡片依次放入")), pool, slots, fb);
  }

  // ================= §3 select =================
  const PICK = [
    { q: "这次运行想用 gpt-5.6-sol，思考强度 high，不改默认设置。", opts: [{ t: "pi --model gpt-5.6-sol:high", ok: true }, { t: "在 settings.json 改 defaultModel" }, { t: "pi --provider gpt-5.6-sol" }], why: "--model 接受 provider/id、模糊匹配，可带 :强度 后缀。只影响这一次运行。" },
    { q: "会话中途想换模型，并且以后新会话都用它。", opts: [{ t: "/model 选中后按 Ctrl+S", ok: true }, { t: "/model 选中后按 Enter" }, { t: "/reload" }], why: "Enter 只换当前会话；Ctrl+S 同时存为默认。" },
    { q: "你常在两个模型之间来回切换。", opts: [{ t: "/scoped-models 选好两个，之后按 Ctrl+P 循环", ok: true }, { t: "每次都 /model 搜索" }], why: "Ctrl+P 只在你圈定的模型里循环。也可以用设置 enabledModels。" },
    { q: "想知道本机能用哪些 gpt 模型及其窗口大小。", opts: [{ t: "pi --list-models gpt", ok: true }, { t: "pi --model gpt" }, { t: "/session" }], why: "列出有可用凭证的模型：provider、id、窗口、输出上限、是否支持思考和图片。" },
  ];

  // ================= §4 thinking =================
  const THINK = [["off", 36, 11991], ["low", 40, 11633], ["medium", 45, 12586], ["high", 39, 12606], ["xhigh", 75, 16251]];
  function thinkChart() {
    const maxR = Math.max(...THINK.map((t) => t[1]));
    return h("div", { class: "panel" }, h("div", { class: "panel-h" }, h("span", null, "同一道题，五档强度 · 本机 gpt-6-astra"), h("span", null, "五次都答对：75")),
      h("div", { class: "thinkchart" },
        h("div", { class: "thinkrow", style: { color: "var(--fg-mute)", fontSize: "15px" } }, h("span", null, "强度"), h("span", null, "思考 token"), h("span", { class: "n" }, "耗时"), h("span", { class: "n" }, "答案")),
        THINK.map(([t, r, ms]) => h("div", { class: "thinkrow" }, h("b", null, t), h("div", { class: "bar", style: { width: (r / maxR) * 100 + "%" } }, h("span", null, r)), h("span", { class: "n" }, (ms / 1000).toFixed(1) + " 秒"), h("span", { class: "n" }, "75 ✓")))),
      h("p", { class: "mute", style: { fontSize: "15px", padding: "0 16px 14px", margin: 0 } }, "题目：1 到 1000 之间有多少个整数的各位数字之和等于 13。耗时含网络往返。off 档仍有 36 个思考 token：提供者对这个模型仍做了少量推理。"));
  }

  // ================= §5 models.json builder =================
  function builder() {
    const f = { prov: "ollama", url: "http://localhost:11434/v1", api: "openai-completions", key: "ollama", id: "qwen2.5-coder:7b", name: "", ctx: "32768", max: "4096", img: false };
    const out = h("pre"), warn = h("div", { class: "warn" });
    const inp = (k, label, ph) => { const i = h("input", { id: "m6-" + k, value: f[k], placeholder: ph || "" }); i.addEventListener("input", () => { f[k] = i.value; paint(); }); return [h("label", { for: "m6-" + k }, label, i), i]; };
    const [lp, ip] = inp("prov", "提供者名字（自己起）"), [lu, iu] = inp("url", "baseUrl"), [lk, ik] = inp("key", "apiKey（字面值 / $ENV / !命令）"), [li, ii] = inp("id", "模型 id（对方认的名字）"), [ln, inn] = inp("name", "显示名（可选）"), [lc, ic] = inp("ctx", "contextWindow"), [lm, im] = inp("max", "maxTokens");
    const api = h("select", { id: "m6-api" }, ["openai-completions", "openai-responses", "anthropic-messages", "google-generative-ai"].map((a) => h("option", { value: a }, a)));
    api.addEventListener("change", () => { f.api = api.value; paint(); });
    const img = h("input", { type: "checkbox", id: "m6-img" }); img.addEventListener("change", () => { f.img = img.checked; paint(); });
    function paint() {
      const m = { id: f.id };
      if (f.name) m.name = f.name;
      if (f.img) m.input = ["text", "image"];
      if (+f.ctx) m.contextWindow = +f.ctx;
      if (+f.max) m.maxTokens = +f.max;
      out.textContent = JSON.stringify({ providers: { [f.prov || "?"]: { baseUrl: f.url, api: f.api, apiKey: f.key, models: [m] } } }, null, 2);
      const w = [];
      iu.classList.toggle("bad", !/^https?:\/\//.test(f.url)); if (!/^https?:\/\//.test(f.url)) w.push("baseUrl 要以 http:// 或 https:// 开头。");
      if (f.api.startsWith("openai") && !/\/v1\/?$/.test(f.url)) w.push("OpenAI 兼容端点通常以 /v1 结尾。");
      if (/^(sk-|ghp_|AIza)/.test(f.key)) w.push("看起来你填了真实密钥。models.json 是明文文件：改用 $ENV_NAME 或 !命令。");
      if (f.key.startsWith("!")) w.push("! 开头的命令会在每次请求时执行，pi 不缓存结果。只写你信任的命令。");
      if (!f.id) w.push("模型 id 不能为空。");
      warn.replaceChildren(...w.map((x) => h("div", null, "· " + x)));
      Store.set(ID, "builder", { used: 1 });
    }
    paint();
    return h("div", { class: "panel mjform" },
      h("div", { class: "f" }, lp, lu, h("label", { for: "m6-api" }, "api（对方说哪种协议）", api), lk, li, ln, lc, lm, h("label", { class: "toggle", for: "m6-img" }, img, "支持图片输入")),
      h("div", null, h("div", { class: "panel-h" }, h("span", null, "~/.pi/agent/models.json"), h("span", null, "实时生成")), out, warn));
  }

  // ================= §8 lab =================
  const LAB_FILES = `mkdir -p ~/pi-lab/m6/agent && cd ~/pi-lab/m6
cat > fake_model.py <<'EOF'
import json, http.server

REPLY = "你好，我是假模型。我没有调用任何工具。"

class H(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        body = self.rfile.read(int(self.headers["Content-Length"]))
        with open("request.json", "wb") as f:
            f.write(body)
        req = json.loads(body)
        print(f"收到请求：{len(req.get('messages', []))} 条消息，{len(req.get('tools', []))} 个工具定义", flush=True)
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.end_headers()
        def send(obj):
            self.wfile.write(b"data: " + json.dumps(obj, ensure_ascii=False).encode() + b"\\n\\n")
        base = {"id": "fake-1", "object": "chat.completion.chunk", "model": "fake"}
        for ch in REPLY:
            send({**base, "choices": [{"index": 0, "delta": {"content": ch}}]})
        send({**base, "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],
              "usage": {"prompt_tokens": 1000, "completion_tokens": len(REPLY), "total_tokens": 1000 + len(REPLY)}})
        self.wfile.write(b"data: [DONE]\\n\\n")

    def log_message(self, *a):
        pass

print("假模型已启动：http://127.0.0.1:8765/v1 （Ctrl+C 停止）", flush=True)
http.server.HTTPServer(("127.0.0.1", 8765), H).serve_forever()
EOF
cat > agent/models.json <<'EOF'
{
  "providers": {
    "fake": {
      "baseUrl": "http://127.0.0.1:8765/v1",
      "api": "openai-completions",
      "apiKey": "dummy",
      "models": [{ "id": "parrot", "name": "本地假模型", "contextWindow": 8000, "maxTokens": 1000 }]
    }
  }
}
EOF`;
  const LAB_SERVER = "cd ~/pi-lab/m6 && python3 fake_model.py";
  const LAB_PI = "cd ~/pi-lab/m6 && PI_CODING_AGENT_DIR=~/pi-lab/m6/agent pi --no-session --model fake/parrot";
  const LAB_JQ = "jq -c '{model, roles: [.messages[].role], tools: [.tools[].function.name], stream, max_completion_tokens, system_chars: (.messages[0].content | length)}' ~/pi-lab/m6/request.json";
  const LAB_CLEAN = "cd ~ && rm -r ~/pi-lab/m6 && rmdir --ignore-fail-on-non-empty ~/pi-lab";
  const LAB_SAMPLE = '{"model":"parrot","roles":["system","user"],"tools":["read","bash","edit","write"],"stream":true,"max_completion_tokens":1000,"system_chars":2784}';
  function lab() {
    const saved = Store.get(ID, "lab", {});
    const ta = h("textarea", { class: "paste", id: "m6-lab-paste", spellcheck: "false", placeholder: LAB_SAMPLE, style: { minHeight: "80px" } });
    ta.value = saved.raw || "";
    ta.addEventListener("input", () => { delete ta.dataset.sample; });
    const out = h("div");
    const verify = (sample) => {
      if (sample) { ta.value = LAB_SAMPLE; ta.dataset.sample = "1"; }
      const isSample = ta.dataset.sample === "1";
      let o; try { o = JSON.parse(ta.value.trim()); } catch (e) { out.replaceChildren(h("div", { class: "note warn" }, h("span", { class: "k" }, "无法读取"), "请粘贴第 5 步输出的那一行 JSON。")); return; }
      const checks = [
        [o.model === "parrot", "请求里的 model 是 parrot（来自 models.json 的 id）"],
        [Array.isArray(o.roles) && o.roles[0] === "system" && o.roles.includes("user"), "第一条消息是 system，之后有你的 user 消息"],
        [Array.isArray(o.tools) && ["read", "bash", "edit", "write"].every((t) => o.tools.includes(t)), "工具定义里有 read、bash、edit、write"],
        [o.stream === true, "请求要求流式返回"],
        [o.max_completion_tokens === 1000, "回复上限 1000（来自 models.json 的 maxTokens）"],
      ];
      const ok = checks.every((c) => c[0]);
      const qbox = h("div");
      if (ok) {
        const i1 = h("input", { type: "number", id: "m6-lab-t" });
        const fb = h("div", { class: "feedback", style: { padding: "8px 0 0" }, hidden: true });
        const q2 = choice({ id: "q2", store: [ID, "labq"], kicker: "问题 2", q: "pi 底栏在你说「你好」之后显示 ↑1.0k。这个 1.0k 是谁算的？", opts: [{ t: "假模型在 usage 里报告的 prompt_tokens", ok: true }, { t: "pi 自己数的字符" }, { t: "OpenAI 的计费服务器" }], explain: "pi 完全相信提供者报告的用量。假模型说 1000，底栏就显示 1.0k，百分比就是 1,019 / 8,000 = 12.7%。", cls: "predict" });
        qbox.append(h("label", { for: "m6-lab-t", style: { display: "flex", gap: "10px", alignItems: "center", marginTop: "8px" } }, "问题 1：请求里有几个工具定义？", i1),
          h("button", { class: "btn primary", style: { marginTop: "8px" }, onclick: () => {
            const a = +i1.value === o.tools.length;
            i1.classList.toggle("right", a); i1.classList.toggle("wrong", !a);
            const b = Store.get(ID, "labq", {}).q2 !== undefined && Store.get(ID, "labq", {}).q2 === 0;
            fb.hidden = false;
            if (a && b && !isSample) { Store.set(ID, "lab", { raw: ta.value, passed: true }); checkDone(); fb.replaceChildren(h("span", { class: "verdict ok" }, "实验通过。"), "你接入了一个自建端点，并亲眼看到了 pi 发出的完整请求。最后：在第一个终端按 Ctrl+C 停掉假模型，再清理。"); }
            else if (a && b) fb.replaceChildren(h("span", { class: "verdict ok" }, "答对了。"), "这是示例数据，不计入实验。请用你自己的 request.json 再做一次。");
            else fb.replaceChildren(h("span", { class: "verdict no" }, "还没全对。"), (a ? "" : "数一数 tools 数组的长度。") + (b ? "" : " 先在问题 2 里选对答案。"));
          } }, "核对"), q2, fb);
      }
      out.replaceChildren(h("ul", { class: "check-list" }, checks.map(([o2, t]) => h("li", null, h("span", { class: o2 ? "ok" : "no" }, o2 ? "✓" : "✗"), t))), ok ? qbox : h("div", { class: "note warn" }, h("span", { class: "k" }, "没有全部通过"), "确认 pi 是用第 3 步的命令启动的，并且发出过一条消息。"));
    };
    if (saved.raw) setTimeout(() => verify(false), 0);
    return h("div", { class: "lab-steps" },
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "建实验目录：一个 30 行的假模型，一份 models.json。"),
        h("p", { class: "dim", style: { margin: "4px 0 0" } }, "整段复制到终端运行。models.json 放在实验目录自己的 agent 目录里，不碰你的 ~/.pi/agent。"), copyBlock(LAB_FILES))),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "终端 A：启动假模型。保持它运行。"), copyBlock(LAB_SERVER))),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "终端 B：用这个 agent 目录启动 pi。"),
        h("p", { class: "dim", style: { margin: "4px 0 0" } }, "PI_CODING_AGENT_DIR 让 pi 把 ~/pi-lab/m6/agent 当作全局目录。所以这次看不到你的扩展、也看不到你的订阅。"), copyBlock(LAB_PI))),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "在 pi 里：输入「你好」回车。看底栏。再输入 /model 回车，看列表。按 Esc，再按 Ctrl+D 退出。"),
        h("p", { class: "dim", style: { margin: "4px 0 0" } }, "终端 A 会打印「收到请求：2 条消息，4 个工具定义」。实验目录里多了 request.json：这就是 pi 发出的原始请求。"))),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "终端 B：把请求压成一行。"), copyBlock(LAB_JQ))),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "粘贴输出，核对，回答两个问题。"), h("div", { style: { marginTop: "8px" } }, ta),
        h("div", { style: { display: "flex", gap: "8px", marginTop: "8px" } }, h("button", { class: "btn primary", onclick: () => verify(false) }, "核对我的请求"), h("button", { class: "btn ghost", onclick: () => verify(true) }, "先用示例数据试试")), out)),
      h("div", { class: "lab-step" }, h("div", null, h("b", null, "终端 A 按 Ctrl+C 停掉假模型。然后清理。"), h("p", { class: "dim", style: { margin: "4px 0 0" } }, "pi 在实验的 agent 目录里写了 auth.json 等几个文件，随目录一起删除。"), copyBlock(LAB_CLEAN))));
  }

  // ================= quiz / review / recap =================
  const QUIZ = [
    { q: "provider 和 model 的关系：", opts: [{ t: "provider 是访问渠道，model 是生成回复的模型；同一模型可经不同 provider 访问", ok: true }, { t: "两者是同一个东西" }, { t: "model 决定用哪个 provider" }], why: "例如同一个开源模型，可以经 OpenRouter，也可以经本地 Ollama。" },
    { q: "同时有 auth.json 里的密钥和环境变量里的密钥。pi 用：", opts: [{ t: "auth.json 里的", ok: true }, { t: "环境变量里的" }, { t: "两个轮流用" }], why: "顺序：--api-key → auth.json → models.json → 环境变量 / 云凭证。" },
    { q: "/model 里看不到你在 models.json 里加的模型，最可能的原因：", opts: [{ t: "pi 解析不到它的凭证（apiKey 为空或环境变量没设）", ok: true }, { t: "必须重启电脑" }, { t: "models.json 只能写一个模型" }], why: "/model 只列有可用凭证的模型。本地服务也要填一个占位 apiKey。" },
    { q: "models.json 里 apiKey 写成 \"$OPENROUTER_KEY\" 的意思：", opts: [{ t: "从环境变量 OPENROUTER_KEY 读取", ok: true }, { t: "字面值就是这串字符" }, { t: "执行一个叫 OPENROUTER_KEY 的命令" }], why: "$NAME / ${NAME} 读环境变量；! 开头才是执行命令。" },
    { q: "请求里的 max_completion_tokens 来自哪里？", opts: [{ t: "models.json 里模型的 maxTokens", ok: true }, { t: "reserveTokens" }, { t: "提供者自动决定" }], why: "本实验：maxTokens 1000 → max_completion_tokens 1000。" },
    { q: "pi 底栏的 token 数和百分比，依据的是：", opts: [{ t: "提供者在回复里报告的 usage", ok: true }, { t: "pi 本地按字符估算" }, { t: "账单页面" }], why: "本机实测：假模型谎报 1000 个输入 token，底栏就显示 1.0k、12.7%。" },
    { q: "本机实测，同一道题从 off 到 xhigh：", opts: [{ t: "都答对了，xhigh 的思考 token 约翻倍、慢了约 4 秒", ok: true }, { t: "只有 xhigh 答对" }, { t: "各档完全一样" }], why: "简单任务不需要高强度。把高强度留给真正难的问题。" },
    { q: "思考强度设成模型不支持的档位，会：", opts: [{ t: "被限制到模型支持的范围内", ok: true }, { t: "报错退出" }, { t: "自动换一个模型" }], why: "--thinking 会按模型能力截取；/thinking 只列出支持的档位。" },
    { q: "会话中途用 /model 换了模型。之后 pi -c 继续这个会话时：", opts: [{ t: "恢复成中途换的那个模型", ok: true }, { t: "回到默认模型" }, { t: "要求重新选择" }], why: "换模型是一条 model_change 记录，挂在会话树上（M3）。" },
    { q: "只想自己用 Ollama 跑本地模型，最小的改动是：", opts: [{ t: "在 models.json 加一个 openai-completions 的提供者", ok: true }, { t: "写一个提供者扩展" }, { t: "改 SYSTEM.md" }], why: "Ollama 说 OpenAI 兼容协议。只有协议或认证特殊时，才需要扩展。" },
  ];
  const REVIEW = [
    { q: "（复习 M5）项目没被信任时，项目里的 AGENTS.md：", opts: [{ t: "照样加载", ok: true }, { t: "被忽略" }], why: "上下文文件与信任无关。" },
    { q: "（复习 M1）请求里的工具定义会花 token 吗？", opts: [{ t: "会，每次请求都花", ok: true }, { t: "只有调用时才花" }], why: "本课你会亲眼看到它们就在请求体里。" },
  ];
  const PRE = [
    { id: "p1", q: "pi 发给提供者的请求里，系统提示是怎样传过去的？", opts: [{ t: "作为 messages 里的第一条消息", ok: true }, { t: "放在 HTTP 头里" }, { t: "不传，提供者自己知道" }] },
    { id: "p2", q: "思考强度从 low 提到 xhigh，简单题的答对率会明显提高吗？", opts: [{ t: "会" }, { t: "不一定，但一定更慢更贵", ok: true }] },
    { id: "p3", q: "pi 能连一个你自己写的、只有 30 行的假模型服务器吗？", opts: [{ t: "能，只要它说 OpenAI 兼容协议", ok: true }, { t: "不能，只能连官方提供者" }] },
  ];
  function checkDone() {
    const ok = Store.get(ID, "lab", {}).passed && Store.get(ID, "quiz", { best: 0 }).best >= 8;
    if (ok && !Store.get(ID, "done")) Store.set(ID, "done", true);
  }

  window.Course.register(ID, (page) => {
    const rc = window.Course.recapBlock(ID, {
      pre: PRE,
      next: { id: "M7", title: "指令层", text: "你已经看到系统提示就在请求的第一条消息里。M7 教你往里写东西：AGENTS.md、SYSTEM.md、APPEND_SYSTEM.md 和提示模板。" },
      extra: () => [["选择题", PICK.filter((p, i) => p.opts[Store.get(ID, "pick", {})["k" + i]]?.ok).length + " / " + PICK.length], ["凭证顺序", Store.get(ID, "order", {}).ok ? "✓" : "—"]],
    });
    page.append(h("div", { class: "bench" },
      h("header", { class: "mhead" }, h("div", { class: "crumbs" }, "第 3 单元 · 配置 / M6"), h("h1", { class: "mtitle" }, h("span", { class: "mid" }, "M6"), "模型与提供者")),
      section("s-hero", 0, "开场", null, hero(),
        h("div", { class: "col" },
          h("p", { class: "thesis" }, "pi 把你的会话翻译成一次 HTTP 请求。", h("br"), "提供者回什么，pi 就信什么。"),
          h("p", { class: "lead" }, "上面是本机实录的一次真实请求。M0 到 M5 讲的每样东西都在里面：系统提示是第一条消息，工具定义是 tools 数组，会话历史是 messages。本课讲这次请求发给谁、用什么凭证、选哪个模型、思考多深，以及怎样接入你自己的端点。")),
        h("div", { class: "panel objectives" },
          h("ol", null,
            h("li", null, "分清提供者、模型、协议、凭证，说出 pi 选用凭证的顺序。"),
            h("li", null, "用 /model、Ctrl+P、--model、--list-models 选择和切换模型。"),
            h("li", null, "按任务选思考强度，并说出提高强度的代价。"),
            h("li", null, "用 models.json 接入一个兼容端点。"),
            h("li", null, "读懂 pi 发出的原始请求，说出底栏数字的来源。")),
          h("div", { class: "obj-side" },
            h("div", null, h("span", { class: "k" }, "时长"), "约 60 分钟"),
            h("div", null, h("span", { class: "k" }, "前置"), "M5"),
            h("div", null, h("span", { class: "k" }, "练习"), "§8 实验 + §9 测验（≥ 8/10）"),
            h("div", null, h("span", { class: "k" }, "核对版本"), "pi 0.99.2 · openai-completions"))),
        h("h3", null, "本课路线"),
        route(ID, [["s-pre", 1, "动手", "复习与预测"], ["s-concept", 2, "动手", "四个概念"], ["s-pick", 3, "动手", "选择模型"], ["s-think", 4, "阅读", "思考强度"], ["s-mj", 5, "动手", "models.json"], ["s-num", 6, "阅读", "数字从哪来"], ["s-local", 7, "阅读", "本地模型"], ["s-lab", 8, "实验", "接一个假模型"], ["s-quiz", 9, "测验", "10 题"], ["s-recap", 10, "阅读", "小结"]])),
      h("div", { class: "col" },
        section("s-pre", 1, "复习与预测", "先复习，再预测",
          todo("两道复习题立即判分；三道预测课末揭晓。"),
          REVIEW.map((r, i) => choice({ id: "r" + i, store: [ID, "rev"], kicker: "复习 " + (i + 1) + " / 2", q: r.q, opts: r.opts, explain: r.why, shuffleSeed: 111 + i * 7 })),
          PRE.map((p, i) => choice({ id: p.id, store: [ID, "pre"], kicker: "预测 " + (i + 1) + " / 3", q: p.q, opts: p.opts, reveal: false, shuffleSeed: 57 + i * 13 }))),
        section("s-concept", 2, "四个概念", "提供者、模型、协议、凭证",
          todo("读四个定义、接入方式表和凭证的优先顺序。", true),
          h("ul", { class: "rule" },
            h("li", null, h("b", null, "模型："), "生成回复的那个东西，例如 gpt-6-astra。"),
            h("li", null, h("b", null, "提供者："), "访问它的渠道或账号，例如 openai-codex（你的 ChatGPT 订阅）。"),
            h("li", null, h("b", null, "协议（api）："), "请求长什么样：openai-completions、openai-responses、anthropic-messages、google-generative-ai……pi 按它翻译。"),
            h("li", null, h("b", null, "凭证："), "证明你有权使用：OAuth 登录、API key。存在 ~/.pi/agent/auth.json。")),
          h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" },
            h("thead", null, h("tr", null, h("th", null, "你手里有"), h("th", null, "怎样接入"), h("th", null, "备注"))),
            h("tbody", null, CONN.map(([a, b, c]) => h("tr", null, h("td", null, a), h("td", null, b), h("td", { class: "mute" }, c)))))),
          h("div", { class: "panel", style: { marginTop: "16px", padding: "14px 18px" } },
            h("b", null, "同时配置了多处凭证时，pi 从上往下找，用第一个找到的："),
            h("ol", { style: { margin: "8px 0 0" } }, ORDER.map((x) => h("li", null, x))),
            h("p", { class: "mute", style: { margin: "8px 0 0" } }, "所以命令行临时给的 --api-key 永远最先；/login 登录过的账号排在 models.json 和环境变量前面。")),
          h("div", { class: "note warn" }, h("span", { class: "k" }, "auth.json 是钥匙"), "里面是密钥和登录令牌。不要提交到 git，不要导出分享。信任一个项目后，项目扩展运行在 pi 进程里，理论上能读到它（M12）。")),
        section("s-pick", 3, "选择模型", "在会话内外切换模型",
          todo("读命令表，然后做四个场景题。"),
          h("div", { class: "panel", style: { overflowX: "auto" } }, h("table", { class: "grow" }, h("tbody", null,
            [["/model 或 Ctrl+L", "搜索并切换。Enter：只换当前会话；Ctrl+S：同时存为默认。"], ["/thinking 或 Shift+Tab", "切换思考强度。/thinking 里按 Ctrl+S 存为默认。"], ["Ctrl+P / Shift+Ctrl+P", "在常用模型间循环。"], ["/scoped-models", "圈定 Ctrl+P 循环的模型。"], ["pi --model provider/id:强度", "只影响本次运行。支持模糊匹配。"], ["pi --list-models [关键词]", "列出有凭证可用的模型。"]].map(([a, b]) => h("tr", null, h("td", { style: { whiteSpace: "nowrap" } }, h("code", null, a)), h("td", null, b)))))),
          h("p", { class: "mute", style: { fontSize: "15px", marginTop: "8px" } }, "本机 pi --list-models 的结果：openai-codex 下有 gpt-5.6-luna、gpt-5.6-sol、gpt-5.6-terra、gpt-6-astra，都是 272K 窗口、128K 输出上限，都支持思考和图片。"),
          PICK.map((p, i) => choice({ id: "k" + i, store: [ID, "pick"], kicker: "场景 " + (i + 1) + " / 4", q: p.q, opts: p.opts, explain: p.why, shuffleSeed: 121 + i * 3 }))),
        section("s-think", 4, "思考强度", "想得越深越好吗",
          todo("看实测图，读选择建议。", true),
          h("p", null, "七档：off、minimal、low、medium、high、xhigh、max。实际可选的档位取决于模型；超出的会被限制到模型支持的范围。编辑器边框的颜色显示当前强度。"),
          thinkChart(),
          h("ul", { class: "rule", style: { marginTop: "14px" } },
            h("li", null, h("b", null, "日常改代码、问答："), "medium（你的默认）。"),
            h("li", null, h("b", null, "设计、排查难缠的 bug、多步规划："), "high 或 xhigh。"),
            h("li", null, h("b", null, "机械性的批量操作："), "low。更快、更省。"),
            h("li", null, h("b", null, "按模型单独设置："), "settings.json 的 modelThinkingLevels，键是 provider/modelId。"))),
        section("s-mj", 5, "models.json", "接入一个兼容端点",
          todo("在左边改字段，看右边生成的 models.json。故意填一个 sk- 开头的密钥，看警告。"),
          h("p", null, "端点说的是 pi 已支持的协议时（Ollama、LM Studio、vLLM、各种代理），写进 ~/.pi/agent/models.json 就行，不需要写代码。打开 /model 时 pi 会重新读这个文件。"))),
      h("div", { class: "bench" }, builder()),
      h("div", { class: "col" },
        h("ul", { class: "rule", style: { marginTop: "16px" } },
          h("li", null, h("b", null, "apiKey 三种写法："), "字面值；$NAME 或 ${NAME} 读环境变量；! 开头执行命令（每次请求都执行，不缓存）。"),
          h("li", null, h("b", null, "models 数组："), "同名 id 会新增或替换这个提供者上的模型。"),
          h("li", null, h("b", null, "modelOverrides："), "只改内置模型的元数据（例如窗口、图片限制），不替换整个模型列表。")),
        section("s-num", 6, "数字从哪来", "底栏的数字是提供者说的",
          todo("读下面三条。实验里你会亲眼验证第一条。", true),
          h("ul", { class: "rule" },
            h("li", null, h("b", null, "token 数和百分比："), "来自回复末尾的 usage（请求里 stream_options.include_usage 要的就是它）。pi 不自己数。"),
            h("li", null, h("b", null, "费用 $："), "用 token 数乘以模型目录里的价格算出。订阅显示 (sub)：只反映用量，不实际扣款。"),
            h("li", null, h("b", null, "窗口大小："), "来自模型目录，或你在 models.json 里写的 contextWindow。写错了，百分比和自动压缩都会算错。")),
          h("div", { class: "note" }, h("span", { class: "k" }, "本机实测"), "假模型在 usage 里谎报 1,000 个输入 token。pi 底栏显示 ↑1.0k、12.7%/8.0k。它完全相信提供者。")),
        section("s-local", 7, "本地模型", "不联网也能用",
          todo("了解两条路。本课实验用的是第二条的原理。", true),
          h("ul", { class: "rule" },
            h("li", null, h("b", null, "llama.cpp 路由器："), "pi 内置集成。路由器发现 GGUF 文件、按需加载；/llama 管理它，/model 选择已加载的模型。"),
            h("li", null, h("b", null, "Ollama、LM Studio、vLLM："), "它们说 OpenAI 兼容协议，写进 models.json。apiKey 填任意占位值。")),
          h("p", { class: "dim" }, "本地模型通常窗口小、工具调用能力弱。上下文预算（M1）和工具数量（M5）对它们更重要。")),
        section("s-lab", 8, "实验", "接一个你自己写的假模型",
          todo("需要两个终端。按第 1–7 步操作。"),
          h("p", null, "你会运行一个 30 行的 Python 假模型，用 models.json 把它接进 pi，然后打开它收到的原始请求，验证本课讲的每一点。这个实验不消耗任何模型额度。"),
          h("div", { class: "note" }, h("span", { class: "k" }, "实验规则"), "全部文件在 ~/pi-lab/m6 里；用 PI_CODING_AGENT_DIR 指向实验自己的 agent 目录，不改你的真实配置；最后清理。"),
          lab()),
        section("s-quiz", 9, "掌握测验", "10 题，8 题过关", todo("10 题全部作答，点「交卷」。"), window.Course.quizBlock(ID, QUIZ, checkDone)),
        section("s-recap", 10, "小结", "你学到了什么",
          todo("看自己的预测和成绩。觉得学会了，就在本节最后点「标记为已完成」。", true),
          h("p", { class: "lead" }, "一句话：pi 按协议把会话翻译成一次请求，经提供者用你的凭证发给模型；强度按任务选；兼容端点写进 models.json；底栏的数字是提供者报告的。"),
          rc))));
    return () => rc._cleanup && rc._cleanup();
  });
})();
