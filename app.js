/* =========================================================
   STARPlanner · 应用逻辑
   字卡传讯式的计划伙伴（回复引擎移植自 Mochi 源码逻辑）：
   · 回复＝随机抽取 + 多段拼接（概率/条数/emoji/颜文字/拍一拍/已读）
   · 对方随机主动发消息（概率/间隔/条数/撤回）
   · 字卡库：回复/颜文字/emoji/计划提醒/鼓励/安慰 六分区 + 回复分组 + 批量加入
   · 陪伴番茄钟 · 自定义纪念日 · 周日历
   ========================================================= */
(function () {
  "use strict";

  var STORAGE_KEY = "starplanner.v1";
  var EMOJI_AVATARS = [
    "🐻", "🐱", "🐰", "🦊", "🐼", "🐨", "🐶", "🐹",
    "🦄", "🐯", "🐧", "🦉", "🌟", "🌙", "🍀", "🌸", "🔥", "🎀"
  ];
  var ANNIV_EMOJIS = ["🎂", "🎉", "💍", "❤️", "🏠", "🎓", "🐣", "🌟", "🌹", "🎊", "🎈", "💝"];

  var FREQ_COUNTS = { low: 3, medium: 5, high: 8 };
  var PLAN_LEAD_HOURS = 3;
  var POMO_RING_C = 552.92;

  var KIND_LABEL = { encourage: "鼓励", comfort: "安慰", urge: "催促", remind: "提醒", system: "小记" };
  var NOTE_TEXT = { read: "已读", poke: "拍了拍你", retract: "撤回了一条消息" };

  var LIB_TABS = [
    { key: "reply", label: "回复" },
    { key: "kaomoji", label: "颜文字" },
    { key: "emoji", label: "emoji" },
    { key: "remind", label: "计划提醒" },
    { key: "encourage", label: "鼓励" },
    { key: "comfort", label: "安慰" },
    { key: "thought", label: "想法" }
  ];

  /* ---------------- 默认字卡（预置，源自 Mochi 默认文案 + 我方语料） ---------------- */
  var DEFAULT_CARDS = {
    reply: [
      "收到～", "好呀", "好～", "嗯嗯", "知道啦", "好哒", "嗯嗯，我在听",
      "我在呢，你说。", "怎么啦，想我了吗？", "今天有好好吃饭吗？",
      "累的话就靠着我休息一会儿。", "你认真的时候特别好看。", "我会一直站在你这边。",
      "慢慢来，不着急。", "今天也要开开心心的呀～", "记得多喝点水。",
      "别太勉强自己。", "你做得已经很好了。", "想听你说说今天发生的事。",
      "我在，一直都在。", "给你一个大大的拥抱。", "困了就早点休息，别熬夜。",
      "没关系，明天又是新的一天。", "今天也是爱你的一天。", "刚刚整理了一下东西",
      "今天收拾了一下房间", "刚刚看了一会儿窗外", "今天的光线很好", "刚刚发了会儿呆",
      "今天过得很快", "刚刚吃了点东西", "今天吃了新的东西", "这个味道还不错",
      "今天的天气很好", "刚刚下了一场雨", "雨停以后空气很好", "今天的云很好看",
      "刚刚路过一个地方", "看到一个很特别的东西", "路上遇到了一只猫", "看到一朵很好看的花",
      "刚刚停下来了一会儿", "有些小事还挺治愈的", "刚刚想到你，就想跟你说说话"
    ],
    kaomoji: [
      "(｡•̀ᴗ-)✧", "₍˄·͈༝·͈˄₎◞", "٩(◕‿◕)۶", "(*´▽`*)", "(˶‾᷄ ⁻̫ ‾᷅˵)",
      "≧◡≦", "ᕕ( ᐛ )ᕗ", "（*´▽｀*）", "(๑˃̵ᴗ˂̵)", "(つ≧▽≦)つ", "(づ｡◕‿‿◕｡)づ", "(ง •̀_•́)ง"
    ],
    emoji: ["😊", "❤️", "✨", "🌙", "🌸", "🥰", "☀️", "🍀", "💫", "🫶", "🌿", "💛"],
    remind: [
      "该喝水了", "别忘了喝水", "喝口水吧", "你今天水喝够了吗", "水杯空了很久了哦",
      "到点了，喝口水再忙", "水在桌上等你，别让它凉透", "喝口水，就当我陪你歇一会儿",
      "到饭点啦，去吃饭吧", "该吃饭了哦，别饿着", "记得吃热乎的，别随便对付一口",
      "别忙忘了吃饭，胃是自己的", "饭要按时吃，我才会放心", "好好吃饭的人，运气不会太差哦",
      "夜深了，饿不饿？想吃点夜宵吗", "饿着肚子睡觉可不好，去弄点吃的吧", "别只啃饼干，夜宵也要认真吃",
      "嗓子干了吧，喝口水", "我在呢，先喝口水", "水凉了就换，但得先喝"
    ],
    encourage: [
      "早安呀，新的一天也要元气满满哦 ☀️", "你已经比昨天的自己更棒了，继续保持！",
      "每一个小进步都算数，加油！", "慢慢来，反而比较快。", "今天也要开开心心的呀～",
      "失败也没关系，我们再来一次！", "你认真努力的样子真的很好看。",
      "继续保持，我在看着", "坚持住，习惯是一点点养出来的", "今天做到了，明天也拜托了",
      "就这样慢慢来，不急", "你已经比昨天喝得多了", "今天喝够啦，真棒",
      "今天的你很棒", "再坚持一下，就快到了"
    ],
    comfort: [
      "抱抱你，累的话就先歇一歇。", "你已经很努力了，适当休息不是偷懒。",
      "别硬撑，喝口水、深呼吸，我陪着你。", "今天的辛苦我都看见了。",
      "没关系，明天又是新的一天。", "慢慢来，不着急。", "我在，一直都在。",
      "别太勉强自己。", "你做得已经很好了。", "想哭就哭吧，我不会笑你。",
      "深呼吸，别紧张。", "有我在，天塌不下来。", "睡一觉就好了，我守着你。",
      "你已经做得很棒了，别自责。"
    ],
    thought: [
      "想他了。", "今天的云很好看。", "在想要不要喝杯热茶。", "有点困，但还想再等等你。",
      "刚刚在想我们下次一起去哪。", "想给你发消息，又怕打扰你。", "在发呆。", "今天想早点睡。",
      "想听你说话。", "在数还有多久能见到你。", "想到一件好笑的事。", "在计划今晚吃什么。",
      "想抱抱你。", "在等风，也在等你。", "刚刚路过一扇好看的窗户。", "在想你看到这条时会不会笑。"
    ]
  };

  var FOLLOWUP_POOL = ["还有哦", "对了", "说起来", "偷偷告诉你", "顺便说一句", "你知道吗"];

  /* ---------------- 模板文案（含 {plan}/{min}/{name} 占位符） ---------------- */
  var POOL = {
    urge: [
      "别偷懒啦，你的计划还在等你哦！",
      "「{plan}」还没完成，快去搞定它吧 🔔",
      "拖延只会让事情更难，现在就开始！",
      "再小的行动也比空想强，动起来～",
      "你的「{plan}」进度如何啦？我在监督你哦 😉",
      "该行动啦，完成之后记得奖励自己！",
      "不要等明天啦，就现在，迈出第一步！"
    ],
    remind: [
      "提醒一下，「{plan}」这件事别忘了呀～",
      "「{plan}」的时间快到啦，准备好了吗？",
      "记得你的「{plan}」哦，加油！"
    ],
    overdue: [
      "「{plan}」好像已经过期了，要么重新定个时间，要么就放下它吧。",
      "「{plan}」还没完成呢，别让它在列表里躺太久哦。"
    ],
    plan: [
      "计划不需要完美，开始就是成功的一半。",
      "我们可以把大目标拆成小步骤，一步一步来。",
      "好的计划配上行动，就没有做不到的事！"
    ],
    pomoStart: [
      "开始专注啦，我陪你 {min} 分钟，别分心哦 🍅",
      "专注时间到，我们 {min} 分钟后见，加油！🍅"
    ],
    pomoFocusDone: [
      "太棒了，一个番茄完成啦！起来活动一下，休息 {min} 分钟吧 🍅",
      "专注结束！你做得很好，放松 {min} 分钟再继续 🍅"
    ],
    pomoBreakDone: [
      "休息好了吗？准备开始下一个专注吧 💪",
      "能量补满啦，再来一轮专注！",
      "休息是为了走更远，我们继续吧 🍅"
    ]
  };

  var QUICK_REPLIES = [
    { label: "安慰", cat: "comfort" },
    { label: "计划提醒", cat: "remind" },
    { label: "鼓励", cat: "encourage" }
  ];

  /* ---------------- 回复设置字段定义 ---------------- */
  var REPLY_FIELDS = [
    { key: "useDefaultCards", label: "使用默认字卡（内置文案）", type: "switch" },
    { key: "rsMin", label: "回复等待 · 最短（秒）", min: 1, max: 300 },
    { key: "rsMax", label: "回复等待 · 最长（秒）", min: 1, max: 600 },
    { key: "replyMin", label: "一次回复 · 最少（条）", min: 1, max: 5 },
    { key: "replyMax", label: "一次回复 · 最多（条）", min: 1, max: 10 },
    { key: "pyEn", label: "多字卡拼接回复", type: "switch" },
    { key: "pyProb", label: "拼接触发概率（%）", min: 0, max: 100 },
    { key: "pyMin", label: "拼接段数 · 最少", min: 1, max: 10 },
    { key: "pyMax", label: "拼接段数 · 最多", min: 2, max: 20 },
    { key: "emojiProb", label: "emoji 出现概率（%）", min: 0, max: 100 },
    { key: "kaomojiProb", label: "颜文字出现概率（%）", min: 0, max: 100 },
    { key: "touchProb", label: "拍一拍概率（%）", min: 0, max: 100 },
    { key: "rnProb", label: "只读不回概率（%）", min: 0, max: 100 },
    { key: "cfProb", label: "连接词追加概率（%）", min: 0, max: 100 },
    { key: "rcEn", label: "允许撤回消息", type: "switch" },
    { key: "rcProb", label: "撤回概率（%）", min: 0, max: 100 },
    { key: "rcRefix", label: "撤回后重发概率（%）", min: 0, max: 100 },
    { key: "asEn", label: "对方主动发消息", type: "switch" },
    { key: "asProb", label: "主动消息概率（%）", min: 0, max: 100 },
    { key: "asMin", label: "主动间隔 · 最短（分）", min: 1, max: 600 },
    { key: "asMax", label: "主动间隔 · 最长（分）", min: 1, max: 600 },
    { key: "asCountMin", label: "主动条数 · 最少", min: 1, max: 5 },
    { key: "asCountMax", label: "主动条数 · 最多", min: 1, max: 10 }
  ];

  /* ---------------- 状态 ---------------- */
  function defaultState() {
    return {
      companion: { name: "星野", avatar: { type: "emoji", value: "🐻" }, slogan: "你的私人计划搭子" },
      user: { name: "我", avatar: { type: "emoji", value: "😊" } },
      plans: [],
      messages: [],
      settings: { frequency: "medium", activeStart: "08:00", activeEnd: "23:00", theme: "light", bgImage: "", glassOpacity: 55, radius: 24, customCss: "", bgBrightness: 100, glassBlur: 22, chatCss: "" },
      schedule: { date: "", items: [] },
      planReminders: {},
      anniversaries: [],
      annivGreeted: {},
      cardLib: {
        replyGroups: [],
        kaomoji: [],
        emoji: [],
        remind: [],
        encourage: [],
        comfort: [],
        thought: []
      },
      pomodoro: { focus: 25, short: 5, long: 15, longEvery: 4, today: "", todayCount: 0, total: 0 },
      pomoTimer: { phase: "focus", running: false, endAt: null, remaining: 1500, started: false, cycleCount: 0 },
      showMoments: true,
      ta: {
        cfg: {
          wake: ["07:00", "08:30"], sleep: ["23:00", "00:30"],
          events: [
            { name: "去公园", min: 60, max: 180, immediate: false, future: true, color: "" },
            { name: "看书", min: 30, max: 90, immediate: true, future: true, color: "" },
            { name: "打扫", min: 30, max: 60, immediate: true, future: true, color: "" },
            { name: "休息", min: 10, max: 30, immediate: true, future: false, color: "" },
            { name: "打游戏", min: 30, max: 120, immediate: true, future: false, color: "" },
            { name: "浇花", min: 20, max: 45, immediate: true, future: true, color: "" },
            { name: "做饭", min: 30, max: 60, immediate: true, future: true, color: "" },
            { name: "散步", min: 20, max: 50, immediate: true, future: true, color: "" },
            { name: "发呆", min: 10, max: 30, immediate: true, future: false, color: "" },
            { name: "午睡", min: 30, max: 90, immediate: true, future: true, color: "" },
            { name: "听歌", min: 15, max: 45, immediate: true, future: false, color: "" },
            { name: "洗澡", min: 20, max: 40, immediate: true, future: true, color: "" }
          ],
          round1: [10, 40, 30, 13, 5, 2],
          round2: [45, 35, 5, 5, 5, 5],
          planCheckMin: 120,
          together: { urgent: 70, important: 50, normal: 30, durMin: 30, durMax: 90, refuse: 20 },
          mood: { p10: 70, p20: 20, p50: 10 }
        },
        events: [],
        lastTick: 0,
        lastPlanCheck: 0,
        dayInit: "",
        mood: { happy: null, relax: null, miss: null, at: 0 },
        thought: { text: "", at: 0 }
      },
      reply: {
        useDefaultCards: 1,
        rsMin: 1, rsMax: 40, replyMin: 1, replyMax: 2,
        pyEn: 1, pyProb: 50, pyMin: 2, pyMax: 5,
        pyPunctEn: 1, pyPunctSpace: 1, pyPunctDou: 1, pyPunctPer: 1, pyPunctEx: 1, pyPunctQ: 1, pyPunctEl: 1, pyPunctDash: 1, pyPunctNl: 0,
        emojiProb: 5, kaomojiProb: 5, touchProb: 5, rnProb: 20, cfProb: 20,
        rcEn: 1, rcProb: 25, rcRefix: 35,
        asEn: 1, asProb: 30, asMin: 5, asMax: 10, asCountMin: 1, asCountMax: 2
      },
      seen: false
    };
  }

  var state = load();

  function load() {
    var base = defaultState();
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return base;
      return mergeDeep(base, JSON.parse(raw));
    } catch (e) {
      return base;
    }
  }

  function mergeDeep(base, extra) {
    var out = {};
    Object.keys(base).forEach(function (k) { out[k] = base[k]; });
    Object.keys(extra || {}).forEach(function (k) {
      var b = base[k];
      var e = extra[k];
      if (b && typeof b === "object" && !Array.isArray(b) && e && typeof e === "object" && !Array.isArray(e)) {
        out[k] = mergeDeep(b, e);
      } else {
        out[k] = e;
      }
    });
    return out;
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      toast("本地存储已满，头像图片可能过大");
    }
  }

  /* ---------------- 工具 ---------------- */
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function pick(arr) { return arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : ""; }
  function pickNonBlank(arr) {
    var v = "", g = 0;
    do { v = pick(arr); g++; } while (g < 20 && !(typeof v === "string" && v.trim()));
    return (typeof v === "string" && v.trim()) ? v : "";
  }
  function pickN(arr, n) {
    var copy = arr.slice(), out = [];
    while (copy.length && out.length < n) out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
    return out;
  }
  function hit(p) { return Math.random() * 100 < p; }
  function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function dateStr(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function toMin(t) { if (!t) return 0; var p = t.split(":"); return parseInt(p[0], 10) * 60 + parseInt(p[1], 10); }
  function minToStr(m) { m = Math.max(0, Math.min(1439, m)); return pad(Math.floor(m / 60)) + ":" + pad(m % 60); }
  function fmtClock(ts) { var d = new Date(ts); return pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function fmtDue(ts) {
    if (!ts) return "";
    var d = new Date(ts), now = new Date();
    var time = pad(d.getHours()) + ":" + pad(d.getMinutes());
    if (dateStr(d) === dateStr(now)) return "今天 " + time;
    var tomorrow = new Date(now.getTime() + 86400000);
    if (dateStr(d) === dateStr(tomorrow)) return "明天 " + time;
    return (d.getMonth() + 1) + "月" + d.getDate() + "日 " + time;
  }
  function fmtPomo(sec) { sec = Math.max(0, Math.round(sec)); return pad(Math.floor(sec / 60)) + ":" + pad(sec % 60); }
  function cardDateLabel(ts) {
    var d = new Date(ts), now = new Date();
    var ds = dateStr(d);
    if (ds === dateStr(now)) return "今天";
    if (ds === dateStr(new Date(now.getTime() - 86400000))) return "昨天";
    return (d.getMonth() + 1) + "月" + d.getDate() + "日 · 周" + "日一二三四五六"[d.getDay()];
  }
  function fill(text, map) { return String(text || "").replace(/\{(\w+)\}/g, function (_, k) { return map[k] != null ? map[k] : ""; }); }

  /* ---------------- 字卡池（含默认开关 + 用户自定义） ---------------- */
  function useDefault() { return state.reply.useDefaultCards === 1; }
  function catCards(cat) {
    var base = useDefault() ? (DEFAULT_CARDS[cat] || []) : [];
    var user = (state.cardLib && state.cardLib[cat]) || [];
    return base.concat(user);
  }
  function replyCards() {
    var cards = useDefault() ? DEFAULT_CARDS.reply.slice() : [];
    (state.cardLib.replyGroups || []).forEach(function (g) {
      (g.cards || []).forEach(function (c) { if (c && c.trim()) cards.push(c); });
    });
    return cards;
  }
  function getReplyPool() {
    return { text: replyCards(), kaomoji: catCards("kaomoji"), emoji: catCards("emoji") };
  }

  /* ---------------- DOM 引用 ---------------- */
  var messagesEl = $("messages");
  var planListEl = $("planList");
  var plansEmptyEl = $("plansEmpty");
  var footTipEl = $("footTip");
  var composerForm = $("composerForm");
  var messageInput = $("messageInput");
  var quickRepliesEl = $("quickReplies");
  var toastEl = $("toast");
  var annivListEl = $("annivList");
  var annivEmptyEl = $("annivEmpty");

  var editingPlanId = null;
  var editingAnnivId = null;
  var annivEmojiSel = "🎂";
  var weekOffset = 0;
  var lastReplySig = "";
  var activeLibTab = "reply";
  var userEmojiSel = "😊";
  var taView = "day";
  var taWeekOffset = 0;
  var taMonthOffset = 0;
  var taDayOffset = 0;

  /* ---------------- 主题 ---------------- */
  function applyTheme() {
    document.documentElement.setAttribute("data-theme", state.settings.theme);
    $("themeBtn").textContent = state.settings.theme === "dark" ? "☀" : "☾";
    applyGlass();
  }

  function applyBackground() {
    var bg = $("bgLayer");
    if (!bg) return;
    if (state.settings.bgImage) bg.style.backgroundImage = "url(" + state.settings.bgImage + ")";
    else bg.style.backgroundImage = "";
    var b = Math.max(20, Math.min(200, Number(state.settings.bgBrightness) || 100));
    bg.style.filter = "brightness(" + (b / 100) + ")";
  }

  function applyGlass() {
    var root = document.documentElement;
    var a = Math.max(0.05, Math.min(1, (Number(state.settings.glassOpacity) || 55) / 100));
    var dark = state.settings.theme === "dark";
    root.style.setProperty("--glass", dark ? "rgba(48,45,39," + a + ")" : "rgba(255,255,255," + a + ")");
    root.style.setProperty("--glass-strong", dark ? "rgba(56,53,47," + Math.min(1, a + 0.18) + ")" : "rgba(255,255,255," + Math.min(1, a + 0.18) + ")");
    var bl = Math.max(0, Math.min(40, Number(state.settings.glassBlur) || 22));
    root.style.setProperty("--glass-blur", bl + "px");
  }

  function applyChatCss() {
    var styleEl = $("chatCssStyle");
    if (styleEl) styleEl.textContent = state.settings.chatCss || "";
  }

  function applyRadius() {
    var root = document.documentElement;
    var r = Math.max(0, Math.min(40, Number(state.settings.radius) || 24));
    root.style.setProperty("--radius-lg", r + "px");
    root.style.setProperty("--radius-sm", Math.round(r / 2) + "px");
  }

  function applyCustomCss() {
    var styleEl = $("customCssStyle");
    if (styleEl) styleEl.textContent = state.settings.customCss || "";
  }

  /* ---------------- 头像渲染 ---------------- */
  function renderAvatar(container, avatar) {
    container.innerHTML = "";
    if (avatar && avatar.type === "image" && avatar.value) {
      var img = document.createElement("img");
      img.src = avatar.value; img.alt = "头像";
      container.appendChild(img);
    } else {
      container.textContent = (avatar && avatar.value) || "🐻";
    }
  }
  function updateCompanionUI() {
    var c = state.companion;
    $("companionName").textContent = c.name;
    $("companionSlogan").textContent = c.slogan;
    $("headerName").textContent = c.name;
    renderAvatar($("companionAvatarInner"), c.avatar);
    renderAvatar($("headerAvatar"), c.avatar);
  }

  /* ---------------- 消息渲染 ---------------- */
  function addMessage(role, text, kind, opts) {
    opts = opts || {};
    var msg = { id: uid(), role: role, text: text || "", time: Date.now(), kind: kind || "" };
    state.messages.push(msg);
    if (state.messages.length > 500) state.messages = state.messages.slice(-500);
    var prev = state.messages[state.messages.length - 2];
    if (!prev || dateStr(new Date(prev.time)) !== dateStr(new Date(msg.time))) {
      messagesEl.appendChild(el("div", "card-date", cardDateLabel(msg.time)));
    }
    var node = renderMessage(msg);
    msg._el = node;
    messagesEl.appendChild(node);
    revealLatest();
    save();
    if (!opts.silent) bumpUnread();
    return msg;
  }

  function renderMessage(msg) {
    if (msg.kind === "read" || msg.kind === "poke" || msg.kind === "retract") {
      var noteText = msg.kind === "read" ? NOTE_TEXT.read : (state.companion.name + " " + NOTE_TEXT[msg.kind]);
      return el("div", "card-note", noteText);
    }
    var card = el("div", "card from-" + msg.role + (msg.kind && KIND_LABEL[msg.kind] ? " kind-" + msg.kind : ""));
    var head = el("div", "card-head");
    var sender = el("div", "card-sender");
    var avatar = el("div", "card-avatar");
    renderAvatar(avatar, msg.role === "companion" ? state.companion.avatar : state.user.avatar);
    sender.appendChild(avatar);
    sender.appendChild(el("span", "card-name", msg.role === "companion" ? state.companion.name : state.user.name));
    head.appendChild(sender);
    var meta = el("div", "card-meta");
    if (msg.kind && KIND_LABEL[msg.kind]) meta.appendChild(el("span", "card-tag", KIND_LABEL[msg.kind]));
    meta.appendChild(el("span", "card-time", fmtClock(msg.time)));
    head.appendChild(meta);
    card.appendChild(head);
    card.appendChild(el("div", "card-body", msg.text));
    return card;
  }

  function renderAllMessages() {
    messagesEl.innerHTML = "";
    var lastDay = "";
    state.messages.forEach(function (m) {
      var day = dateStr(new Date(m.time));
      if (day !== lastDay) { messagesEl.appendChild(el("div", "card-date", cardDateLabel(m.time))); lastDay = day; }
      messagesEl.appendChild(renderMessage(m));
    });
  }

  function revealLatest() {
    requestAnimationFrame(function () { messagesEl.scrollTop = messagesEl.scrollHeight; });
  }

  function showTyping() {
    removeTyping();
    var wrap = el("div", "card from-companion typing-card");
    var head = el("div", "card-head");
    var sender = el("div", "card-sender");
    var avatar = el("div", "card-avatar");
    renderAvatar(avatar, state.companion.avatar);
    sender.appendChild(avatar);
    sender.appendChild(el("span", "card-name", state.companion.name));
    head.appendChild(sender);
    wrap.appendChild(head);
    var body = el("div", "card-body");
    body.innerHTML = '<div class="typing"><span></span><span></span><span></span></div>';
    wrap.appendChild(body);
    messagesEl.appendChild(wrap);
    revealLatest();
    return wrap;
  }
  function removeTyping() {
    var t = messagesEl.querySelector(".typing-card");
    if (t) t.remove();
  }

  function retractMessage(msg) {
    if (!msg || msg.retracted) return;
    msg.retracted = true;
    msg.text = "";
    msg.kind = "retract";
    if (msg._el && msg._el.parentNode) {
      var note = el("div", "card-note", state.companion.name + " " + NOTE_TEXT.retract);
      msg._el.parentNode.replaceChild(note, msg._el);
      msg._el = note;
    }
    save();
  }

  /* ---------------- 通知 ---------------- */
  function notifySupported() { return "Notification" in window; }
  function canNotify() { return notifySupported() && Notification.permission === "granted"; }
  function pushNotification(title, body) {
    if (!canNotify() || !document.hidden) return;
    try {
      var n = new Notification(title, { body: body, icon: "data:image/svg+xml," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌟</text></svg>") });
      setTimeout(function () { n.close(); }, 6000);
    } catch (e) {}
  }
  function updateNotifyBtn() {
    var btn = $("notifyBtn");
    if (!notifySupported()) { btn.textContent = "🔕"; btn.title = "当前浏览器不支持桌面通知"; btn.classList.remove("active"); return; }
    if (Notification.permission === "granted") { btn.textContent = "🔔"; btn.classList.add("active"); btn.title = "桌面通知已开启"; }
    else if (Notification.permission === "denied") { btn.textContent = "🔕"; btn.classList.remove("active"); btn.title = "通知已被拒绝，请在浏览器设置中开启"; }
    else { btn.textContent = "🔔"; btn.classList.remove("active"); btn.title = "开启桌面通知"; }
  }
  function requestNotify() {
    if (!notifySupported()) { toast("当前浏览器不支持桌面通知"); return; }
    if (Notification.permission === "granted") { toast("桌面通知已开启 ✅"); return; }
    if (Notification.permission === "denied") { toast("通知已被拒绝，请在浏览器设置里允许本站通知"); return; }
    Notification.requestPermission().then(function (p) {
      updateNotifyBtn();
      if (p === "granted") toast("桌面通知已开启 ✅"); else toast("未开启通知，你可以稍后再试");
    });
  }

  /* ---------------- 未读提示 ---------------- */
  var unread = 0;
  function bumpUnread() {
    if (!document.hidden) return;
    unread++;
    document.title = "(" + unread + ") 新字卡 · STARPlanner";
  }
  window.addEventListener("focus", function () { unread = 0; document.title = "STARPlanner · 字卡传讯"; });
  document.addEventListener("visibilitychange", function () { if (!document.hidden) { unread = 0; document.title = "STARPlanner · 字卡传讯"; } });

  /* ---------------- 计划渲染 ---------------- */
  function activePlans() { return state.plans.filter(function (p) { return !p.done; }); }
  function dueInfo(plan) {
    if (!plan.due) return null;
    var diff = new Date(plan.due).getTime() - Date.now();
    if (diff < 0) return { label: "已逾期 " + fmtDue(plan.due), cls: "overdue" };
    if (diff < 86400000) return { label: "⏰ " + fmtDue(plan.due), cls: "soon" };
    return { label: "🕐 " + fmtDue(plan.due), cls: "" };
  }
  function renderPlans() {
    planListEl.innerHTML = "";
    plansEmptyEl.hidden = state.plans.length > 0;
    state.plans.forEach(function (plan) { planListEl.appendChild(buildPlanItem(plan)); });
    renderFootTip();
    renderWeek();
  }
  function buildPlanItem(plan) {
    var item = el("div", "plan-item" + (plan.done ? " done" : ""));
    item.dataset.id = plan.id;
    var check = el("button", "plan-check", plan.done ? "✓" : "");
    check.title = plan.done ? "标记为未完成" : "标记为完成";
    check.addEventListener("click", function (e) { e.stopPropagation(); togglePlan(plan.id); });
    var body = el("div", "plan-body");
    body.appendChild(el("div", "plan-title", plan.title));
    var due = dueInfo(plan);
    if (due) body.appendChild(el("div", "plan-due " + due.cls, due.label));
    body.addEventListener("click", function () { openPlanModal(plan); });
    var del = el("button", "plan-delete", "🗑");
    del.title = "删除计划";
    del.addEventListener("click", function (e) { e.stopPropagation(); deletePlan(plan.id); });
    var dot = el("span", "priority-dot " + (plan.priority || "medium"));
    item.appendChild(check); item.appendChild(body); item.appendChild(dot); item.appendChild(del);
    return item;
  }
  function renderFootTip() {
    var items = state.schedule.items || [];
    footTipEl.textContent = items.length
      ? "今日会在 " + items.map(function (it) { return minToStr(it.timeMin); }).join(" · ") + " 来找你"
      : "今日提醒将在随机时刻送达";
  }

  /* ---------------- 计划操作 ---------------- */
  function addPlan(data) {
    var plan = { id: uid(), title: data.title, due: data.due || null, priority: data.priority || "medium", createdAt: Date.now(), done: false };
    state.plans.unshift(plan);
    renderPlans();
    save();
    addMessage("companion", pick(POOL.plan) + " 我记下「" + plan.title + "」啦，加油！", "remind");
  }
  function updatePlan(id, data) {
    var plan = state.plans.find(function (p) { return p.id === id; });
    if (!plan) return;
    var changed = plan.due !== data.due || plan.priority !== data.priority;
    plan.title = data.title;
    plan.due = data.due || null;
    plan.priority = data.priority || "medium";
    if (changed && plan.due) delete state.planReminders[plan.id];
    renderPlans();
    save();
  }
  function togglePlan(id) {
    var plan = state.plans.find(function (p) { return p.id === id; });
    if (!plan) return;
    plan.done = !plan.done;
    renderPlans();
    save();
    if (plan.done) addMessage("companion", pick(POOL.plan) + " 🎉 完成啦！", "encourage");
  }
  function deletePlan(id) {
    state.plans = state.plans.filter(function (p) { return p.id !== id; });
    delete state.planReminders[id];
    renderPlans();
    save();
  }

  /* ---------------- 计划弹窗 ---------------- */
  var prioritySel = "medium";
  function openPlanModal(plan) {
    editingPlanId = plan ? plan.id : null;
    $("planModalTitle").textContent = plan ? "编辑计划" : "新建计划";
    $("planTitle").value = plan ? plan.title : "";
    $("planDue").value = plan && plan.due ? toLocalInput(new Date(plan.due)) : "";
    prioritySel = plan ? (plan.priority || "medium") : "medium";
    renderPriorityPick();
    $("planOverlay").hidden = false;
    setTimeout(function () { $("planTitle").focus(); }, 60);
  }
  function toLocalInput(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }
  function renderPriorityPick() {
    document.querySelectorAll("#priorityPick .priority").forEach(function (b) { b.classList.toggle("active", b.dataset.priority === prioritySel); });
  }
  function closePlanModal() { $("planOverlay").hidden = true; editingPlanId = null; }

  /* ---------------- 伙伴设置弹窗 ---------------- */
  var emojiSel = state.companion.avatar.value;
  var freqSel = state.settings.frequency;
  function openSettings() {
    $("companionNameInput").value = state.companion.name;
    emojiSel = state.companion.avatar.type === "emoji" ? state.companion.avatar.value : "";
    $("userNameInput").value = state.user.name;
    userEmojiSel = state.user.avatar.type === "emoji" ? state.user.avatar.value : "😊";
    freqSel = state.settings.frequency;
    $("activeStart").value = state.settings.activeStart;
    $("activeEnd").value = state.settings.activeEnd;
    renderEmojiGrid();
    renderUserEmojiGrid();
    renderFreqPick();
    $("glassOpacityRange").value = state.settings.glassOpacity;
    $("glassOpacityVal").textContent = state.settings.glassOpacity + "%";
    $("glassBlurRange").value = state.settings.glassBlur;
    $("glassBlurVal").textContent = state.settings.glassBlur + "px";
    $("radiusRange").value = state.settings.radius;
    $("radiusVal").textContent = state.settings.radius + "px";
    $("bgBrightnessRange").value = state.settings.bgBrightness;
    $("bgBrightnessVal").textContent = state.settings.bgBrightness + "%";
    $("customCssTa").value = state.settings.customCss;
    $("chatCssTa").value = state.settings.chatCss;
    $("settingsOverlay").hidden = false;
  }
  function renderEmojiGrid() {
    var grid = $("emojiGrid");
    grid.innerHTML = "";
    EMOJI_AVATARS.forEach(function (e) {
      var b = el("button", "emoji-opt" + (e === emojiSel ? " active" : ""), e);
      b.type = "button";
      b.addEventListener("click", function () { emojiSel = e; renderEmojiGrid(); });
      grid.appendChild(b);
    });
  }
  function renderUserEmojiGrid() {
    var grid = $("userEmojiGrid");
    grid.innerHTML = "";
    EMOJI_AVATARS.forEach(function (e) {
      var b = el("button", "emoji-opt" + (e === userEmojiSel ? " active" : ""), e);
      b.type = "button";
      b.addEventListener("click", function () { userEmojiSel = e; renderUserEmojiGrid(); });
      grid.appendChild(b);
    });
  }
  function renderFreqPick() {
    document.querySelectorAll("#freqPick .priority").forEach(function (b) { b.classList.toggle("active", b.dataset.freq === freqSel); });
  }
  function saveSettings() {
    var name = $("companionNameInput").value.trim();
    if (name) state.companion.name = name;
    if (emojiSel) state.companion.avatar = { type: "emoji", value: emojiSel };
    var uname = $("userNameInput").value.trim();
    if (uname) state.user.name = uname;
    if (userEmojiSel) state.user.avatar = { type: "emoji", value: userEmojiSel };
    state.settings.frequency = freqSel;
    var s = $("activeStart").value, e = $("activeEnd").value;
    if (s) state.settings.activeStart = s;
    if (e) state.settings.activeEnd = e;
    if (toMin(state.settings.activeStart) >= toMin(state.settings.activeEnd)) { toast("活跃时段开始需早于结束"); return; }
    updateCompanionUI();
    generateDailySchedule(dateStr(new Date()));
    renderFootTip();
    save();
    $("settingsOverlay").hidden = true;
    toast("设置已保存 ✅");
  }

  /* ---------------- 回复设置弹窗 ---------------- */
  function openReplySettings() { renderReplySettings(); $("replySettingsOverlay").hidden = false; }
  function renderReplySettings() {
    var box = $("replySettingsFields");
    box.innerHTML = "";
    REPLY_FIELDS.forEach(function (f) {
      var row = el("div", "rset-row");
      row.appendChild(el("label", "rset-label", f.label));
      if (f.type === "switch") {
        var cb = el("input", "rset-check");
        cb.type = "checkbox";
        cb.checked = state.reply[f.key] === 1;
        cb.dataset.key = f.key;
        row.appendChild(cb);
      } else {
        var inp = el("input", "rset-num");
        inp.type = "number";
        inp.min = f.min; inp.max = f.max;
        inp.value = state.reply[f.key];
        inp.dataset.key = f.key;
        row.appendChild(inp);
      }
      box.appendChild(row);
    });
  }
  function saveReplySettings() {
    var inputs = $("replySettingsFields").querySelectorAll("input");
    inputs.forEach(function (inp) {
      var k = inp.dataset.key;
      if (!k) return;
      if (inp.type === "checkbox") state.reply[k] = inp.checked ? 1 : 0;
      else {
        var v = parseInt(inp.value, 10);
        var f = REPLY_FIELDS.filter(function (x) { return x.key === k; })[0];
        if (isNaN(v)) v = state.reply[k];
        else if (f) v = Math.max(f.min, Math.min(f.max, v));
        state.reply[k] = v;
      }
    });
    if (state.reply.rsMax < state.reply.rsMin) state.reply.rsMax = state.reply.rsMin;
    if (state.reply.replyMax < state.reply.replyMin) state.reply.replyMax = state.reply.replyMin;
    if (state.reply.pyMax < state.reply.pyMin) state.reply.pyMax = state.reply.pyMin;
    if (state.reply.asMax < state.reply.asMin) state.reply.asMax = state.reply.asMin;
    if (state.reply.asCountMax < state.reply.asCountMin) state.reply.asCountMax = state.reply.asCountMin;
    save();
    scheduleAutoSend();
    $("replySettingsOverlay").hidden = true;
    toast("回复设置已保存 ✅");
  }

  /* ---------------- 字卡库 ---------------- */
  function openCards() {
    activeLibTab = "reply";
    renderLibTabs();
    renderLibBody();
    $("cardsOverlay").hidden = false;
  }
  function renderLibTabs() {
    var tabs = $("libTabs");
    tabs.innerHTML = "";
    LIB_TABS.forEach(function (t) {
      var b = el("button", "lib-tab" + (t.key === activeLibTab ? " active" : ""), t.label);
      b.type = "button";
      b.addEventListener("click", function () { activeLibTab = t.key; renderLibTabs(); renderLibBody(); });
      tabs.appendChild(b);
    });
  }
  function renderLibBody() {
    var box = $("libBody");
    box.innerHTML = "";
    box.appendChild(activeLibTab === "reply" ? buildReplyEditor() : buildFlatEditor(activeLibTab));
  }
  function libBatchArea(placeholder, hintText, onAdd) {
    var wrap = el("div", "lib-editor");
    var ta = el("textarea", "lib-batch");
    ta.placeholder = placeholder;
    wrap.appendChild(el("div", "hint lib-hint", hintText));
    wrap.appendChild(ta);
    var btn = el("button", "btn primary lib-batch-btn", "批量加入");
    btn.type = "button";
    btn.addEventListener("click", function () { onAdd(ta.value || ""); });
    wrap.appendChild(btn);
    return wrap;
  }
  function buildReplyEditor() {
    var wrap = el("div", "lib-editor");
    wrap.appendChild(libBatchArea(
      "【组名】\n一行一张字卡\n\n例如：\n【晚安】\n晚安，做个好梦\n早点休息哦",
      "「【】」内写组名，下面每一行是一张字卡，自动归入该组；没有组名的行归入「未分组」。",
      batchAddReply
    ));
    var groups = el("div", "lib-groups");
    groups.appendChild(buildGroupBlock("默认（内置）", DEFAULT_CARDS.reply, null, null, true));
    (state.cardLib.replyGroups || []).forEach(function (g, gi) {
      groups.appendChild(buildGroupBlock(g.name, g.cards, gi, null, false));
    });
    wrap.appendChild(groups);
    return wrap;
  }
  function buildGroupBlock(name, cards, gi, ci, locked) {
    var block = el("div", "lib-group");
    var head = el("div", "lib-group-head");
    head.appendChild(el("span", "lib-group-name", name + "（" + cards.length + "）"));
    if (!locked) {
      var del = el("button", "lib-group-del", "删除分组");
      del.type = "button";
      del.addEventListener("click", function () { state.cardLib.replyGroups.splice(gi, 1); save(); renderLibBody(); });
      head.appendChild(del);
    }
    block.appendChild(head);
    var list = el("div", "lib-cards");
    cards.forEach(function (c, i) {
      list.appendChild(buildLibCard(c, locked, null, null, gi, i));
    });
    block.appendChild(list);
    return block;
  }
  function buildFlatEditor(cat) {
    var wrap = el("div", "lib-editor");
    wrap.appendChild(libBatchArea("一行一张字卡，批量加入", "每一行是一张字卡，自动切分加入。", function (v) { batchAddFlat(cat, v); }));
    var defHead = el("div", "lib-group-head");
    defHead.appendChild(el("span", "lib-group-name", "默认（内置）· " + DEFAULT_CARDS[cat].length + " 张"));
    wrap.appendChild(defHead);
    var defList = el("div", "lib-cards");
    DEFAULT_CARDS[cat].forEach(function (c) { defList.appendChild(buildLibCard(c, true, null, null)); });
    wrap.appendChild(defList);
    var userHead = el("div", "lib-group-head");
    userHead.appendChild(el("span", "lib-group-name", "自定义 · " + (state.cardLib[cat] || []).length + " 张"));
    wrap.appendChild(userHead);
    var userList = el("div", "lib-cards");
    (state.cardLib[cat] || []).forEach(function (c, i) { userList.appendChild(buildLibCard(c, false, cat, i)); });
    wrap.appendChild(userList);
    return wrap;
  }
  function buildLibCard(text, locked, cat, ci, gi, i) {
    var item = el("div", "lib-card" + (locked ? " locked" : ""));
    item.appendChild(el("span", "lib-card-text", text));
    if (!locked) {
      var d = el("button", "lib-card-del", "🗑");
      d.type = "button";
      d.addEventListener("click", function () {
        if (gi != null) { state.cardLib.replyGroups[gi].cards.splice(i, 1); }
        else { state.cardLib[cat].splice(ci, 1); }
        save();
        renderLibBody();
      });
      item.appendChild(d);
    }
    return item;
  }
  function findOrCreateGroup(name) {
    var groups = state.cardLib.replyGroups;
    var g = groups.find(function (x) { return x.name === name; });
    if (!g) { g = { name: name, cards: [] }; groups.push(g); }
    return g;
  }
  function batchAddReply(text) {
    var lines = String(text || "").split("\n");
    var cur = null, added = 0;
    lines.forEach(function (line) {
      var m = line.match(/【(.+?)】/);
      if (m) { cur = m[1].trim(); return; }
      var t = line.trim();
      if (!t) return;
      if (!cur) cur = "未分组";
      findOrCreateGroup(cur).cards.push(t);
      added++;
    });
    if (!added) { toast("未识别到字卡内容"); return; }
    save();
    renderLibBody();
    toast("已加入 " + added + " 张字卡 ✅");
  }
  function batchAddFlat(cat, text) {
    var lines = String(text || "").split("\n");
    var added = 0;
    lines.forEach(function (line) {
      var t = line.trim();
      if (t) { state.cardLib[cat].push(t); added++; }
    });
    if (!added) { toast("未识别到字卡内容"); return; }
    save();
    renderLibBody();
    toast("已加入 " + added + " 张字卡 ✅");
  }

  /* ---------------- 头像上传 ---------------- */
  function resizeImage(file, maxSize) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var w = img.width, h = img.height;
          var scale = Math.min(1, maxSize / Math.max(w, h));
          var cw = Math.round(w * scale), ch = Math.round(h * scale);
          var canvas = document.createElement("canvas");
          canvas.width = cw; canvas.height = ch;
          var ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, cw, ch);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /* ---------------- 每日随机提醒调度 ---------------- */
  function generateDailySchedule(dayStr) {
    var s = state.settings;
    var count = FREQ_COUNTS[s.frequency] || 5;
    var startMin = toMin(s.activeStart);
    var endMin = toMin(s.activeEnd);
    var span = Math.max(120, endMin - startMin);
    var items = [];
    var tries = count * 40;
    for (var i = 0; i < tries && items.length < count; i++) {
      var t = startMin + Math.floor(Math.random() * span);
      var clash = items.some(function (it) { return Math.abs(it.timeMin - t) < 30; });
      if (clash) continue;
      items.push({ timeMin: t, kind: pick(["encourage", "encourage", "comfort", "urge"]), sent: false });
    }
    items.sort(function (a, b) { return a.timeMin - b.timeMin; });
    state.schedule = { date: dayStr, items: items };
  }
  function fireScheduled(item) {
    item.sent = true;
    var c = state.companion.name;
    var text, kind = item.kind;
    if (kind === "urge") {
      var active = activePlans();
      if (active.length && Math.random() < 0.7) { text = fill(pick(POOL.urge), { plan: pick(active).title, name: c }); }
      else { text = pickNonBlank(catCards("encourage")) || pick(DEFAULT_CARDS.encourage); kind = "encourage"; }
    } else if (kind === "comfort") {
      text = pickNonBlank(catCards("comfort")) || pick(DEFAULT_CARDS.comfort);
    } else {
      text = pickNonBlank(catCards("encourage")) || pick(DEFAULT_CARDS.encourage);
    }
    addMessage("companion", text, kind);
    pushNotification(c + " 发来字卡", text);
  }
  function checkPlanReminders(now) {
    var today = dateStr(now);
    state.plans.forEach(function (plan) {
      if (plan.done || !plan.due || state.planReminders[plan.id] === today) return;
      var due = new Date(plan.due).getTime();
      var lead = due - PLAN_LEAD_HOURS * 3600000;
      if (now.getTime() >= lead) {
        state.planReminders[plan.id] = today;
        var text = now.getTime() >= due ? fill(pick(POOL.overdue), { plan: plan.title }) : fill(pick(POOL.remind), { plan: plan.title });
        addMessage("companion", text, "remind");
        pushNotification(state.companion.name + " 提醒你", text);
      }
    });
  }
  function tick() {
    var now = new Date();
    var today = dateStr(now);
    if (state.schedule.date !== today) { generateDailySchedule(today); renderFootTip(); }
    var curMin = now.getHours() * 60 + now.getMinutes();
    var pending = state.schedule.items.filter(function (it) { return !it.sent && it.timeMin <= curMin; });
    if (pending.length) { fireScheduled(pending[0]); save(); }
    checkPlanReminders(now);
    checkAnniversaries(now);
  }

  /* ---------------- 回复引擎（移植自 Mochi chat.js） ---------------- */
  function pyJoinCards(segs) {
    if (!Array.isArray(segs) || !segs.length) return "";
    if (segs.length === 1) return String(segs[0] == null ? "" : segs[0]);
    var r = state.reply;
    var pool = [];
    if (r.pyPunctEn === 1) {
      if (r.pyPunctSpace === 1) pool.push(" ");
      if (r.pyPunctDou === 1) pool.push("，");
      if (r.pyPunctPer === 1) pool.push("。");
      if (r.pyPunctEx === 1) pool.push("！");
      if (r.pyPunctQ === 1) pool.push("？");
      if (r.pyPunctEl === 1) pool.push("......");
      if (r.pyPunctDash === 1) pool.push("——");
      if (r.pyPunctNl === 1) pool.push("\n");
    }
    if (!pool.length) pool = [" "];
    var out = String(segs[0] == null ? "" : segs[0]);
    for (var i = 1; i < segs.length; i++) out += pool[Math.floor(Math.random() * pool.length)] + String(segs[i] == null ? "" : segs[i]);
    return out;
  }
  function genReplyText() {
    var r = state.reply;
    var pool = getReplyPool();
    var reply = "", type = "text";
    if (pool.emoji.length && hit(r.emojiProb)) {
      reply = pickNonBlank(pool.emoji); type = "emoji";
    } else {
      reply = pickNonBlank(pool.text) || pick(DEFAULT_CARDS.reply);
      if (r.pyEn === 1 && pool.kaomoji.length && hit(r.kaomojiProb)) reply += "\n" + pickNonBlank(pool.kaomoji);
    }
    return { text: reply, type: type };
  }
  function genOneReply() {
    var r = state.reply;
    var pool = getReplyPool();
    var t, type = "text", multi = false;
    if (r.pyEn === 1 && hit(r.pyProb) && pool.text.length) {
      var nb = pool.text.filter(function (s) { return typeof s === "string" && s.trim(); });
      var n = randInt(Math.max(1, Number(r.pyMin) || 2), Math.max(2, Number(r.pyMax) || 5));
      var segs = pickN(nb.length ? nb : pool.text, n);
      if (segs.length >= 2) multi = true;
      t = pyJoinCards(segs);
    } else {
      var rr = genReplyText();
      t = rr.text; type = rr.type;
    }
    if (type !== "text") return { text: t, type: type };
    if (typeof t === "string" && t.trim() && hit(r.cfProb)) {
      var w = pick(FOLLOWUP_POOL);
      if (w) { t += "，" + w + "。"; multi = true; }
    }
    if (typeof t !== "string" || !t.trim()) t = pick(DEFAULT_CARDS.reply);
    if (t === lastReplySig) { var alt = pick(DEFAULT_CARDS.reply); if (alt && alt !== t) t = alt; }
    lastReplySig = t;
    return { text: t, type: "text", multi: multi };
  }
  function scheduleReply() {
    var r = state.reply;
    if (hit(r.rnProb)) { setTimeout(function () { addMessage("companion", "", "read"); }, randInt(1000, 4000)); return; }
    var delay = (Math.max(1, Number(r.rsMin) || 1) + Math.random() * Math.max(1, Number(r.rsMax) - Number(r.rsMin))) * 1000;
    showTyping();
    setTimeout(function () {
      removeTyping();
      if (hit(r.touchProb)) { addMessage("companion", "", "poke"); return; }
      deliverTurn();
    }, delay);
  }
  function deliverTurn() {
    var r = state.reply;
    var rpMin = Math.max(1, Number(r.replyMin) || 1);
    var rpMax = Math.max(rpMin, Number(r.replyMax) || 2);
    var count = (r.pyEn === 1) ? randInt(rpMin, rpMax) : 1;
    for (var i = 0; i < count; i++) {
      (function (i) {
        setTimeout(function () { if (i < count - 1) showTyping(); replyOnce(i > 0); }, i * randInt(1200, 2800));
      })(i);
    }
  }
  function replyOnce(silent) {
    removeTyping();
    var rep = genOneReply();
    var msg = addMessage("companion", rep.text, rep.type === "emoji" ? "" : "", { silent: silent });
    if (!silent) pushNotification(state.companion.name + " 回复你", rep.text);
    maybeRetract(msg);
  }
  function maybeRetract(msg) {
    var r = state.reply;
    if (!msg || msg.kind === "read" || msg.kind === "poke") return;
    if (r.rcEn !== 1 || !hit(r.rcProb)) return;
    setTimeout(function () {
      retractMessage(msg);
      if (hit(r.rcRefix)) {
        showTyping();
        setTimeout(function () { removeTyping(); addMessage("companion", pick(getReplyPool().text) || "…"); }, 600);
      }
    }, randInt(1000, 3000));
  }

  /* ---------------- 主动发消息（移植自 Mochi chat.js） ---------------- */
  var autoTimer = null;
  function scheduleAutoSend() {
    clearTimeout(autoTimer);
    var r = state.reply;
    if (r.asEn !== 1) { autoTimer = setTimeout(scheduleAutoSend, 30000); return; }
    var asMin = Math.min(600, Math.max(1, Number(r.asMin) || 5)) * 60;
    var asMax = Math.min(600, Math.max(1, Number(r.asMax) || 10)) * 60;
    if (asMax < asMin) asMax = asMin;
    var delay = (asMin + Math.random() * Math.max(1, asMax - asMin)) * 1000;
    autoTimer = setTimeout(function () { tryAutoSend(); scheduleAutoSend(); }, delay);
  }
  function tryAutoSend() {
    var r = state.reply;
    if (r.asEn !== 1) return;
    var prob = r.asProb > 0 ? r.asProb : 30;
    if (!hit(prob)) return;
    if (hit(r.touchProb)) { addMessage("companion", "", "poke"); return; }
    var count = randInt(Math.max(1, Number(r.asCountMin) || 1), Math.max(1, Number(r.asCountMax) || 2));
    for (var i = 0; i < count; i++) {
      (function (i) {
        setTimeout(function () {
          if (i < count - 1) showTyping();
          removeTyping();
          var am = autoMsg();
          var msg = addMessage("companion", am.text, am.type === "emoji" ? "" : "", { silent: i > 0 });
          if (i === 0) pushNotification(state.companion.name + " 发来消息", am.text);
          maybeRetract(msg);
        }, i * randInt(900, 2600));
      })(i);
    }
  }
  function autoMsg() {
    var pool = getReplyPool();
    var bands = [
      [pool.kaomoji.length ? 15 : 0, function () { return { text: pick(pool.kaomoji), type: "text" }; }],
      [pool.emoji.length ? 15 : 0, function () { return { text: pick(pool.emoji), type: "emoji" }; }],
      [45, function () { return { text: pick(pool.text) || "在吗？", type: "text" }; }]
    ];
    var roll = Math.random() * bands.reduce(function (a, b) { return a + b[0]; }, 0);
    for (var i = 0; i < bands.length; i++) { roll -= bands[i][0]; if (roll < 0) return bands[i][1](); }
    return { text: pick(pool.text) || "在吗？", type: "text" };
  }

  /* ---------------- 纪念日 ---------------- */
  function daysUntilMonthDay(month, day, now) {
    var start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var target = new Date(now.getFullYear(), month - 1, day);
    if (target < start) target = new Date(now.getFullYear() + 1, month - 1, day);
    return Math.round((target - start) / 86400000);
  }
  function annivInfo(a) {
    var now = new Date();
    var isToday = (a.month === now.getMonth() + 1) && (a.day === now.getDate());
    var days = daysUntilMonthDay(a.month, a.day, now);
    var years = a.startYear ? (now.getFullYear() - a.startYear) : null;
    var label;
    if (isToday) label = (years && years > 0) ? "第 " + years + " 年 · 就是今天 🎉" : "就是今天 🎉";
    else if (days === 1) label = "就是明天";
    else label = "还有 " + days + " 天";
    return { isToday: isToday, days: days, years: years, label: label };
  }
  function renderAnniversaries() {
    annivListEl.innerHTML = "";
    annivEmptyEl.hidden = state.anniversaries.length > 0;
    var items = state.anniversaries.slice().map(function (a) { return { a: a, info: annivInfo(a) }; })
      .sort(function (x, y) { return (x.info.days - y.info.days) || (x.a.title || "").localeCompare(y.a.title || ""); });
    items.forEach(function (x) { annivListEl.appendChild(buildAnnivItem(x.a, x.info)); });
    renderWeek();
  }
  function buildAnnivItem(a, info) {
    var item = el("div", "anniv-item" + (info.isToday ? " today" : ""));
    item.appendChild(el("span", "anniv-emoji", a.emoji || "🎂"));
    var body = el("div", "anniv-body");
    body.appendChild(el("div", "anniv-title", a.title));
    body.appendChild(el("div", "anniv-count", info.label));
    item.appendChild(body);
    item.addEventListener("click", function () { openAnnivModal(a); });
    return item;
  }
  function openAnnivModal(a) {
    editingAnnivId = a ? a.id : null;
    $("annivModalTitle").textContent = a ? "编辑纪念日" : "添加纪念日";
    $("annivTitle").value = a ? a.title : "";
    $("annivDate").value = a ? annivDateValue(a.month, a.day, a.startYear) : "";
    annivEmojiSel = a ? (a.emoji || "🎂") : "🎂";
    $("annivDelete").hidden = !a;
    renderAnnivEmojiGrid();
    $("annivOverlay").hidden = false;
    setTimeout(function () { $("annivTitle").focus(); }, 60);
  }
  function annivDateValue(month, day, startYear) { return (startYear || new Date().getFullYear()) + "-" + pad(month) + "-" + pad(day); }
  function renderAnnivEmojiGrid() {
    var grid = $("annivEmojiGrid");
    grid.innerHTML = "";
    ANNIV_EMOJIS.forEach(function (e) {
      var b = el("button", "emoji-opt" + (e === annivEmojiSel ? " active" : ""), e);
      b.type = "button";
      b.addEventListener("click", function () { annivEmojiSel = e; renderAnnivEmojiGrid(); });
      grid.appendChild(b);
    });
  }
  function saveAnniv() {
    var title = $("annivTitle").value.trim();
    if (!title) { toast("请填写纪念日名称"); return; }
    var val = $("annivDate").value;
    if (!val) { toast("请选择日期"); return; }
    var parts = val.split("-");
    var month = parseInt(parts[1], 10), day = parseInt(parts[2], 10), year = parseInt(parts[0], 10);
    if (editingAnnivId) {
      var a = state.anniversaries.find(function (x) { return x.id === editingAnnivId; });
      if (a) { a.title = title; a.month = month; a.day = day; a.startYear = year; a.emoji = annivEmojiSel; }
    } else {
      state.anniversaries.push({ id: uid(), title: title, month: month, day: day, startYear: year, emoji: annivEmojiSel });
    }
    renderAnniversaries();
    save();
    $("annivOverlay").hidden = true;
    toast("纪念日已保存 ✅");
  }
  function deleteAnniv() {
    if (!editingAnnivId) return;
    state.anniversaries = state.anniversaries.filter(function (x) { return x.id !== editingAnnivId; });
    delete state.annivGreeted[editingAnnivId];
    renderAnniversaries();
    save();
    $("annivOverlay").hidden = true;
    toast("纪念日已删除");
  }
  function checkAnniversaries(now) {
    var today = dateStr(now);
    state.anniversaries.forEach(function (a) {
      if (state.annivGreeted[a.id] === today) return;
      if (a.month === now.getMonth() + 1 && a.day === now.getDate()) {
        state.annivGreeted[a.id] = today;
        var years = a.startYear ? (now.getFullYear() - a.startYear) : null;
        var text = "今天是「" + a.title + "」" + (years && years > 0 ? "第 " + years + " 周年" : "纪念日") + "，记得给自己一份仪式感 🎉";
        addMessage("companion", text, "remind");
        pushNotification(state.companion.name + " 提醒你", text);
        renderAnniversaries();
      }
    });
  }

  /* ---------------- 周日历 ---------------- */
  function weekMonday() {
    var now = new Date();
    now.setHours(0, 0, 0, 0);
    var day = (now.getDay() + 6) % 7;
    var mon = new Date(now);
    mon.setDate(now.getDate() - day + weekOffset * 7);
    return mon;
  }
  function renderWeek() {
    var mon = weekMonday();
    var sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    var label = mon.getFullYear() + "年" + (mon.getMonth() + 1) + "月" + mon.getDate() + "日 — " + (sun.getMonth() + 1) + "月" + sun.getDate() + "日";
    if (weekOffset === 0) label = "本周 · " + label;
    $("weekLabel").textContent = label;
    var grid = $("weekGrid");
    grid.innerHTML = "";
    var todayStr = dateStr(new Date());
    for (var i = 0; i < 7; i++) {
      var d = new Date(mon); d.setDate(mon.getDate() + i);
      var cell = el("div", "week-cell" + (dateStr(d) === todayStr ? " today" : ""));
      var head = el("div", "week-cell-head");
      head.appendChild(el("span", "week-dow", "日一二三四五六"[d.getDay()]));
      head.appendChild(el("span", "week-date", (d.getMonth() + 1) + "/" + d.getDate()));
      cell.appendChild(head);
      state.plans.forEach(function (p) {
        if (p.due && dateStr(new Date(p.due)) === dateStr(d)) cell.appendChild(el("div", "week-tag plan" + (p.done ? " done" : ""), (p.done ? "✓ " : "") + p.title));
      });
      state.anniversaries.forEach(function (a) {
        if (a.month === d.getMonth() + 1 && a.day === d.getDate()) cell.appendChild(el("div", "week-tag anniv", (a.emoji || "🎂") + " " + a.title));
      });
      grid.appendChild(cell);
    }
  }

  /* ---------------- 陪伴番茄钟 ---------------- */
  function pomoDuration() {
    var p = state.pomodoro;
    if (state.pomoTimer.phase === "focus") return p.focus * 60;
    if (state.pomoTimer.phase === "long") return p.long * 60;
    return p.short * 60;
  }
  function remainingSec() {
    var pt = state.pomoTimer;
    if (!pt.running) return Math.max(0, Math.round(pt.remaining || 0));
    return Math.max(0, Math.round((pt.endAt - Date.now()) / 1000));
  }
  function renderPomo() {
    var pt = state.pomoTimer;
    var total = pomoDuration();
    var rem = remainingSec();
    var frac = total > 0 ? (rem / total) : 0;
    $("pomoProgress").style.strokeDashoffset = String(POMO_RING_C * (1 - frac));
    $("pomoTime").textContent = fmtPomo(rem);
    $("pomoPhase").textContent = pt.phase === "focus" ? "专注中" : pt.phase === "short" ? "短休息" : "长休息";
    $("pomoToggle").textContent = pt.running ? "暂停" : (pt.started ? "继续" : "开始");
    $("pomoStats").textContent = "今日 " + state.pomodoro.todayCount + " 个 · 累计 " + state.pomodoro.total + " 个";
  }
  var audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) { try { var AC = window.AudioContext || window.webkitAudioContext; if (AC) audioCtx = new AC(); } catch (e) {} }
    if (audioCtx && audioCtx.state === "suspended") { try { audioCtx.resume(); } catch (e) {} }
  }
  function chime() {
    try {
      if (!audioCtx) return;
      var now = audioCtx.currentTime;
      [523.25, 659.25, 783.99].forEach(function (f, i) {
        var o = audioCtx.createOscillator(); var g = audioCtx.createGain();
        o.type = "sine"; o.frequency.value = f;
        var t = now + i * 0.13;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
        o.connect(g); g.connect(audioCtx.destination); o.start(t); o.stop(t + 0.4);
      });
    } catch (e) {}
  }
  function togglePomo() {
    ensureAudio();
    var pt = state.pomoTimer;
    if (pt.running) { pt.remaining = remainingSec(); pt.running = false; pt.endAt = null; }
    else {
      if (!pt.started) {
        pt.remaining = pomoDuration(); pt.started = true;
        if (pt.phase === "focus") addMessage("companion", fill(pick(POOL.pomoStart), { min: state.pomodoro.focus, name: state.companion.name }), "system");
      }
      pt.running = true; pt.endAt = Date.now() + pt.remaining * 1000;
    }
    save(); renderPomo();
  }
  function resetPomo() {
    var pt = state.pomoTimer;
    pt.running = false; pt.endAt = null; pt.phase = "focus"; pt.remaining = state.pomodoro.focus * 60; pt.started = false; pt.cycleCount = 0;
    save(); renderPomo();
  }
  function skipPomo() {
    var pt = state.pomoTimer;
    if (pt.phase === "focus") { if (pt.cycleCount >= state.pomodoro.longEvery) { pt.phase = "long"; pt.cycleCount = 0; } else { pt.phase = "short"; } }
    else { pt.phase = "focus"; }
    pt.remaining = pomoDuration(); pt.started = false; pt.running = false; pt.endAt = null;
    save(); renderPomo();
  }
  function completePomoPhase() {
    var pt = state.pomoTimer, p = state.pomodoro;
    var wasFocus = pt.phase === "focus";
    if (wasFocus) {
      p.total++;
      if (p.today !== dateStr(new Date())) { p.today = dateStr(new Date()); p.todayCount = 0; }
      p.todayCount++; pt.cycleCount++;
      var rest = (pt.cycleCount >= p.longEvery) ? p.long : p.short;
      addMessage("companion", fill(pick(POOL.pomoFocusDone), { min: rest, name: state.companion.name }), "encourage");
      pushNotification(state.companion.name + " · 番茄完成", "休息一下");
      chime();
      if (pt.cycleCount >= p.longEvery) { pt.phase = "long"; pt.cycleCount = 0; } else { pt.phase = "short"; }
      pt.remaining = pomoDuration(); pt.started = false; pt.running = true; pt.endAt = Date.now() + pt.remaining * 1000;
      addMessage("companion", "休息 " + rest + " 分钟吧，起来活动一下 ☕", "system");
    } else {
      pt.phase = "focus"; pt.remaining = p.focus * 60; pt.started = false; pt.running = false; pt.endAt = null;
      addMessage("companion", fill(pick(POOL.pomoBreakDone), { name: state.companion.name }), "encourage");
      pushNotification(state.companion.name + " · 休息结束", "准备开始下一个专注吧");
      chime();
    }
    save(); renderPomo();
  }
  function tickPomo() {
    var pt = state.pomoTimer, p = state.pomodoro;
    var today = dateStr(new Date());
    if (p.today !== today) { p.today = today; p.todayCount = 0; }
    if (pt.running && pt.endAt && Date.now() >= pt.endAt) completePomoPhase();
    renderPomo();
  }
  function syncPomoInputs() {
    $("pomoFocus").value = state.pomodoro.focus;
    $("pomoShort").value = state.pomodoro.short;
    $("pomoLong").value = state.pomodoro.long;
    $("pomoEvery").value = state.pomodoro.longEvery;
  }
  function bindPomoSettings() {
    var cfg = [["pomoFocus", "focus", 1, 120], ["pomoShort", "short", 1, 60], ["pomoLong", "long", 1, 60], ["pomoEvery", "longEvery", 1, 12]];
    cfg.forEach(function (c) {
      $(c[0]).addEventListener("change", function () {
        var v = parseInt(this.value, 10);
        if (isNaN(v)) { this.value = state.pomodoro[c[1]]; return; }
        v = Math.max(c[2], Math.min(c[3], v));
        this.value = v;
        state.pomodoro[c[1]] = v;
        if (c[1] !== "longEvery") { var pt = state.pomoTimer; if (!pt.running && !pt.started) pt.remaining = pomoDuration(); }
        save(); renderPomo();
      });
    });
  }

  /* ---------------- 快捷回复（分区触发） ---------------- */
  function renderQuickReplies() {
    quickRepliesEl.innerHTML = "";
    QUICK_REPLIES.forEach(function (q) {
      var b = el("button", "quick-reply", q.label);
      b.type = "button";
      b.addEventListener("click", function () { sendCategoryCard(q.cat); });
      quickRepliesEl.appendChild(b);
    });
  }
  function sendCategoryCard(cat) {
    if (cat === "remind") {
      var active = activePlans();
      if (active.length) {
        addMessage("companion", fill(pick(POOL.remind), { plan: pick(active).title }), "remind");
      } else {
        addMessage("companion", pickNonBlank(catCards("remind")) || "该喝水啦", "remind");
      }
    } else if (cat === "encourage") {
      addMessage("companion", pickNonBlank(catCards("encourage")) || "加油", "encourage");
    } else {
      addMessage("companion", pickNonBlank(catCards("comfort")) || "抱抱你", "comfort");
    }
  }

  /* ---------------- 发送消息（走回复引擎） ---------------- */
  function sendMessage(text) {
    text = (text || "").trim();
    if (!text) return;
    messageInput.value = "";
    addMessage("user", text, "", { silent: true });
    scheduleReply();
  }

  /* ---------------- Toast ---------------- */
  var toastTimer = null;
  function toast(text) {
    toastEl.textContent = text;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 2600);
  }

  /* ---------------- 事件绑定 ---------------- */
  function bindEvents() {
    composerForm.addEventListener("submit", function (e) { e.preventDefault(); sendMessage(messageInput.value); });

    $("addPlanBtn").addEventListener("click", function () { openPlanModal(null); });
    $("planSave").addEventListener("click", function () {
      var title = $("planTitle").value.trim();
      if (!title) { toast("请填写计划内容"); return; }
      var due = $("planDue").value ? new Date($("planDue").value).getTime() : null;
      if (editingPlanId) updatePlan(editingPlanId, { title: title, due: due, priority: prioritySel });
      else addPlan({ title: title, due: due, priority: prioritySel });
      closePlanModal();
    });
    document.querySelectorAll("#priorityPick .priority").forEach(function (b) {
      b.addEventListener("click", function () { prioritySel = b.dataset.priority; renderPriorityPick(); });
    });

    $("openSettings").addEventListener("click", openSettings);
    $("companionAvatar").addEventListener("click", openSettings);
    $("settingsSave").addEventListener("click", saveSettings);
    document.querySelectorAll("#freqPick .priority").forEach(function (b) {
      b.addEventListener("click", function () { freqSel = b.dataset.freq; renderFreqPick(); });
    });

    $("avatarUploadBtn").addEventListener("click", function () { $("avatarUpload").click(); });
    $("avatarUpload").addEventListener("change", function () {
      var file = this.files && this.files[0];
      if (!file) return;
      if (!/^image\//.test(file.type)) { toast("请选择图片文件"); return; }
      resizeImage(file, 320).then(function (dataUrl) {
        state.companion.avatar = { type: "image", value: dataUrl };
        emojiSel = ""; renderEmojiGrid();
        toast("头像已更新，保存后生效");
      }).catch(function () { toast("图片读取失败，请重试"); });
      this.value = "";
    });
    $("avatarResetBtn").addEventListener("click", function () {
      state.companion.avatar = { type: "emoji", value: "🐻" };
      emojiSel = "🐻"; renderEmojiGrid();
      toast("已恢复默认头像，保存后生效");
    });

    $("userAvatarUploadBtn").addEventListener("click", function () { $("userAvatarUpload").click(); });
    $("userAvatarUpload").addEventListener("change", function () {
      var file = this.files && this.files[0];
      if (!file) return;
      if (!/^image\//.test(file.type)) { toast("请选择图片文件"); return; }
      resizeImage(file, 320).then(function (dataUrl) {
        state.user.avatar = { type: "image", value: dataUrl };
        userEmojiSel = ""; renderUserEmojiGrid();
        toast("头像已更新，保存后生效");
      }).catch(function () { toast("图片读取失败，请重试"); });
      this.value = "";
    });
    $("userAvatarResetBtn").addEventListener("click", function () {
      state.user.avatar = { type: "emoji", value: "😊" };
      userEmojiSel = "😊"; renderUserEmojiGrid();
      toast("已恢复默认头像，保存后生效");
    });
    $("bgUploadBtn").addEventListener("click", function () { $("bgUpload").click(); });
    $("bgUpload").addEventListener("change", function () {
      var file = this.files && this.files[0];
      if (!file) return;
      if (!/^image\//.test(file.type)) { toast("请选择图片文件"); return; }
      resizeImage(file, 1280).then(function (dataUrl) {
        state.settings.bgImage = dataUrl;
        applyBackground();
        toast("背景已更新，保存后生效");
      }).catch(function () { toast("图片读取失败，请重试"); });
      this.value = "";
    });
    $("bgResetBtn").addEventListener("click", function () {
      state.settings.bgImage = "";
      applyBackground();
      toast("已恢复默认背景，保存后生效");
    });

    $("glassOpacityRange").addEventListener("input", function () {
      state.settings.glassOpacity = Number(this.value);
      $("glassOpacityVal").textContent = this.value + "%";
      applyGlass();
    });
    $("glassBlurRange").addEventListener("input", function () {
      state.settings.glassBlur = Number(this.value);
      $("glassBlurVal").textContent = this.value + "px";
      applyGlass();
    });
    $("radiusRange").addEventListener("input", function () {
      state.settings.radius = Number(this.value);
      $("radiusVal").textContent = this.value + "px";
      applyRadius();
    });
    $("bgBrightnessRange").addEventListener("input", function () {
      state.settings.bgBrightness = Number(this.value);
      $("bgBrightnessVal").textContent = this.value + "%";
      applyBackground();
    });
    $("customCssTa").addEventListener("input", function () {
      state.settings.customCss = this.value;
      applyCustomCss();
    });
    $("chatCssTa").addEventListener("input", function () {
      state.settings.chatCss = this.value;
      applyChatCss();
    });

    $("notifyBtn").addEventListener("click", requestNotify);
    $("themeBtn").addEventListener("click", function () {
      state.settings.theme = state.settings.theme === "dark" ? "light" : "dark";
      applyTheme(); save();
    });

    $("addAnnivBtn").addEventListener("click", function () { openAnnivModal(null); });
    $("annivSave").addEventListener("click", saveAnniv);
    $("annivDelete").addEventListener("click", deleteAnniv);

    $("openReplySettings").addEventListener("click", openReplySettings);
    $("replySettingsSave").addEventListener("click", saveReplySettings);

    $("openCards").addEventListener("click", openCards);

    $("weekPrev").addEventListener("click", function () { weekOffset--; renderWeek(); });
    $("weekNext").addEventListener("click", function () { weekOffset++; renderWeek(); });

    $("pomoToggle").addEventListener("click", togglePomo);
    $("pomoReset").addEventListener("click", resetPomo);
    $("pomoSkip").addEventListener("click", skipPomo);
    bindPomoSettings();

    $("sidebarOpen").addEventListener("click", function () { $("sidebar").classList.add("open"); });
    $("sidebarClose").addEventListener("click", function () { $("sidebar").classList.remove("open"); });

    $("openWeek").addEventListener("click", function () { renderWeek(); $("weekOverlay").hidden = false; });
    $("openPomo").addEventListener("click", function () { syncPomoInputs(); renderPomo(); $("pomodoroOverlay").hidden = false; });

    $("momentsToggle").addEventListener("click", function () { toggleMoments(); });
    $("momentsHide").addEventListener("click", function () { toggleMoments(false); });
    $("taSettingsBtn").addEventListener("click", openTASettings);
    $("taSettingsSave").addEventListener("click", saveTASettings);
    $("taMaxBtn").addEventListener("click", openTAMax);
    $("togetherBtn").addEventListener("click", openTogether);
    $("togetherSave").addEventListener("click", saveTogether);

    document.querySelectorAll(".ta-tab").forEach(function (b) {
      b.addEventListener("click", function () { taView = b.dataset.view; renderTimeline(); });
    });
    $("taPrev").addEventListener("click", function () { if (taView === "day") taDayOffset--; else if (taView === "week") taWeekOffset--; else taMonthOffset--; renderTimeline(); });
    $("taNext").addEventListener("click", function () { if (taView === "day") taDayOffset++; else if (taView === "week") taWeekOffset++; else taMonthOffset++; renderTimeline(); });

    document.querySelectorAll("[data-close]").forEach(function (b) {
      b.addEventListener("click", function () { var id = b.getAttribute("data-close"); $(id).hidden = true; });
    });
    document.querySelectorAll(".overlay").forEach(function (o) {
      o.addEventListener("click", function (e) { if (e.target === o) o.hidden = true; });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") document.querySelectorAll(".overlay").forEach(function (o) { o.hidden = true; });
    });
  }

  /* ---------------- 初始化 ---------------- */
  function init() {
    bindEvents();
    applyTheme();
    applyBackground();
    applyRadius();
    applyCustomCss();
    applyChatCss();
    updateCompanionUI();
    updateNotifyBtn();
    renderQuickReplies();
    renderPlans();
    renderAnniversaries();
    renderAllMessages();

    if (!state.pomoTimer.started && !state.pomoTimer.running) state.pomoTimer.remaining = pomoDuration();
    syncPomoInputs();
    renderPomo();

    if (!state.seen) {
      state.seen = true;
      var c = state.companion.name;
      addMessage("companion", "你好呀，我是" + c + " 👋 以后我就是你的计划搭子啦。", "encourage", { silent: true });
      addMessage("companion", "每天我都会在不定的时候，把字卡投递给你，也会自己主动来找你说话～", "encourage", { silent: true });
      addMessage("companion", "左侧可以添加计划、置顶纪念日，还能打开周日历、番茄钟和字卡库，我们一起慢慢来。", "system", { silent: true });
      save();
    }

    var today = dateStr(new Date());
    if (state.schedule.date !== today) { generateDailySchedule(today); save(); }
    renderFootTip();

    setInterval(tick, 25000);
    tick();
    setInterval(tickPomo, 500);
    tickPomo();

    var appEl = $("app");
    if (appEl) appEl.classList.toggle("with-moments", !!state.showMoments);
    initTA();
    scheduleAutoSend();
  }

  /* ---------------- TA 的时刻 ---------------- */
  function taNow() { var d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
  function taRange(a, b) {
    var am = toMin(a), bm = toMin(b);
    if (bm < am) bm = 1439;
    return [am, bm];
  }
  var TA_COLORS = ["#cdd8c4", "#d9cfe6", "#c9d9e0", "#e6d7c9", "#d5e0c8", "#e2d6e2", "#cfe0da", "#e8e0cf", "#d4d9c8", "#dccfe0", "#cfe4d8", "#e2d5cd"];
  function weightedIndex(probs) {
    var total = 0;
    (probs || []).forEach(function (x) { total += (Number(x) || 0); });
    if (total <= 0) return 0;
    var r = Math.random() * total;
    for (var i = 0; i < probs.length; i++) { r -= (Number(probs[i]) || 0); if (r < 0) return i; }
    return probs.length - 1;
  }
  function immediatePool() { return state.ta.cfg.events.filter(function (e) { return e.immediate; }); }
  function futurePool() { return state.ta.cfg.events.filter(function (e) { return e.future; }); }
  function ensureEventColors() {
    var changed = false;
    state.ta.cfg.events.forEach(function (e) { if (!e.color) { e.color = pick(TA_COLORS); changed = true; } });
    if (changed) save();
  }
  function addEventNoConflict(evt, start, end, type) {
    type = type || "act";
    var conflict = state.ta.events.some(function (e) { return end > e.start && start < e.end; });
    if (conflict) return null;
    var ev = { id: uid(), name: evt.name, color: evt.color, start: start, end: end, type: type };
    state.ta.events.push(ev);
    return ev;
  }
  function fillGapIfNeeded() {
    var now = Date.now();
    var windowEnd = now + 30 * 60000;
    var has = state.ta.events.some(function (e) { return e.end > now && e.start < windowEnd; });
    if (has) return;
    var pool = immediatePool();
    if (!pool.length) return;
    var evt = pick(pool);
    var dur = randInt(evt.min, evt.max);
    var start = now + randInt(0, 25) * 60000;
    addEventNoConflict(evt, start, start + dur * 60000);
  }
  function ensureWakeSleep() {
    state.ta.events = state.ta.events.filter(function (e) { return e.type !== "wake" && e.type !== "sleep"; });
    var c = state.ta.cfg;
    var now = new Date();
    var dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    var wakeMin = randInt(toMin(c.wake[0]), toMin(c.wake[1]));
    var sl = taRange(c.sleep[0], c.sleep[1]);
    var sleepMin = randInt(sl[0], sl[1]);
    state.ta.events.push({ id: uid(), name: "起床", color: "#cfe4d8", start: dayStart + wakeMin * 60000, end: dayStart + wakeMin * 60000 + 15 * 60000, type: "wake" });
    state.ta.events.push({ id: uid(), name: "入睡", color: "#d9cfe6", start: dayStart + sleepMin * 60000, end: dayStart + sleepMin * 60000 + 15 * 60000, type: "sleep" });
  }
  function backfillToday(now) {
    var c = state.ta.cfg;
    var dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    var wakeMin = toMin(c.wake[0]);
    var slotMs = dayStart + wakeMin * 60000;
    var leads = [30, 60, 180, 720, 1440, 4320];
    while (slotMs < now) {
      var n = weightedIndex(c.round1);
      for (var i = 0; i < n; i++) {
        var idx = weightedIndex(c.round2);
        var lead = leads[idx];
        var start = slotMs + lead * 60000;
        if (start < now) {
          var pool = idx <= 1 ? immediatePool() : futurePool();
          if (pool.length) {
            var evt = pick(pool);
            var dur = randInt(evt.min, evt.max);
            addEventNoConflict(evt, start, start + dur * 60000);
          }
        }
      }
      slotMs += 30 * 60000;
    }
  }
  function dayInitIfNeeded() {
    var now = new Date();
    var today = dateStr(now);
    if (state.ta.dayInit !== today) {
      state.ta.events = state.ta.events.filter(function (e) { return e.type !== "wake" && e.type !== "sleep" && e.end > Date.now() - 86400000; });
      ensureWakeSleep();
      backfillToday(now);
      state.ta.dayInit = today;
      save();
    }
  }
  function taScheduleTick() {
    var now = Date.now();
    var c = state.ta.cfg;
    var n = weightedIndex(c.round1);
    var leads = [30, 60, 180, 720, 1440, 4320];
    for (var i = 0; i < n; i++) {
      var idx = weightedIndex(c.round2);
      var pool = idx <= 1 ? immediatePool() : futurePool();
      if (!pool.length) continue;
      var evt = pick(pool);
      var dur = randInt(evt.min, evt.max);
      var start = now + leads[idx] * 60000;
      addEventNoConflict(evt, start, start + dur * 60000);
    }
    fillGapIfNeeded();
    state.ta.events = state.ta.events.filter(function (e) { return e.end > now - 86400000; });
    state.ta.lastTick = now;
    save();
  }
  function scheduleTogether(plan, start, end) {
    state.ta.events = state.ta.events.filter(function (e) { return e.type === "together" || !(start < e.end && end > e.start); });
    state.ta.events.push({ id: uid(), name: "陪" + state.user.name + "一起完成计划-" + plan.title, start: start, end: end, type: "together", planId: plan.id, color: "#9f86c0" });
    save();
    renderMoments();
  }
  function taPlanCheck() {
    var c = state.ta.cfg;
    var now = Date.now();
    state.plans.forEach(function (plan) {
      if (plan.done) return;
      var prio = plan.priority === "high" ? "urgent" : plan.priority === "low" ? "normal" : "important";
      var prob = Number(c.together[prio]) || 30;
      if (!hit(prob)) return;
      if (hit(c.together.refuse)) return;
      var dur = randInt(c.together.durMin, c.together.durMax);
      var start = now + randInt(5, 120) * 60000;
      scheduleTogether(plan, start, start + dur * 60000);
    });
    state.ta.lastPlanCheck = now;
    save();
  }
  function taStatusText() {
    var now = Date.now();
    var ev = state.ta.events.find(function (e) { return now >= e.start && now < e.end; });
    return ev ? state.companion.name + " 正在「" + ev.name + "」中…" : state.companion.name + " 当前没有安排";
  }
  function renderMoments() {
    $("momentsStatus").textContent = taStatusText();
    var m = state.ta.mood;
    [["happy", "幸福"], ["relax", "轻松"], ["miss", "思念"]].forEach(function (p) {
      var fill = $("mood-" + p[0]);
      if (fill) fill.style.width = (m[p[0]] == null ? 0 : m[p[0]]) + "%";
      var num = $("mood-" + p[0] + "-num");
      if (num) num.textContent = m[p[0]] == null ? "–" : String(m[p[0]]);
    });
    $("momentsThought").textContent = state.ta.thought.text || "（还没有想法）";
    renderTimeline();
  }
  function renderTimeline() {
    var nav = $("taViewNav");
    if (nav) nav.hidden = false;
    document.querySelectorAll(".ta-tab").forEach(function (b) { b.classList.toggle("active", b.dataset.view === taView); });
    if (taView === "day") { renderDayView(); renderTADayLabel(); }
    else if (taView === "week") renderWeekView();
    else renderMonthView();
  }
  function renderTADayLabel() {
    var d = new Date();
    d.setDate(d.getDate() + taDayOffset);
    var prefix = dateStr(d) === dateStr(new Date()) ? "今天" : (dateStr(d) === dateStr(new Date(new Date().getTime() + 86400000)) ? "明天" : (dateStr(d) === dateStr(new Date(new Date().getTime() - 86400000)) ? "昨天" : ""));
    $("taViewLabel").textContent = (prefix ? prefix + " " : "") + (d.getMonth() + 1) + "月" + d.getDate() + "日";
  }
  function renderDayView(box) {
    box = box || $("momentsTimeline");
    box.innerHTML = "";
    var PX = 2;
    var H = 1440 * PX;
    var base = new Date();
    base.setDate(base.getDate() + taDayOffset);
    var dayStart = new Date(base.getFullYear(), base.getMonth(), base.getDate()).getTime();
    var dayEnd = dayStart + 86400000;
    var canvas = el("div", "tl-canvas");
    canvas.style.height = H + "px";
    var ruler = el("div", "tl-ruler");
    for (var h = 0; h <= 24; h++) {
      var tick = el("div", "tl-tick", h === 24 ? "24:00" : pad(h) + ":00");
      tick.style.top = (h * 60 * PX) + "px";
      ruler.appendChild(tick);
    }
    var area = el("div", "tl-area");
    var m = (taDayOffset === 0) ? taNow() : -1;
    state.ta.events.filter(function (e) { return e.start < dayEnd && e.end > dayStart; }).forEach(function (e) {
      var s = Math.max(0, Math.round((e.start - dayStart) / 60000));
      var en = Math.min(1440, Math.round((e.end - dayStart) / 60000));
      if (en <= s) return;
      var bar = el("div", "tl-bar" + (e.type === "together" ? " together" : "") + (m >= s && m < en ? " now" : ""));
      bar.style.top = (s * PX) + "px";
      bar.style.height = Math.max(14, (en - s) * PX) + "px";
      if (e.color) bar.style.background = e.color;
      bar.appendChild(el("span", "tl-name", e.name));
      bar.appendChild(el("span", "tl-time", minToStr(s) + "–" + minToStr(en)));
      area.appendChild(bar);
    });
    canvas.appendChild(ruler);
    canvas.appendChild(area);
    box.appendChild(canvas);
  }
  function renderWeekView(box) {
    box = box || $("momentsTimeline");
    box.innerHTML = "";
    var now = new Date();
    now.setHours(0, 0, 0, 0);
    var mon = new Date(now);
    mon.setDate(now.getDate() - ((now.getDay() + 6) % 7) + taWeekOffset * 7);
    var sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    $("taViewLabel").textContent = (mon.getMonth() + 1) + "月" + mon.getDate() + "日 – " + (sun.getMonth() + 1) + "月" + sun.getDate() + "日";
    var grid = el("div", "tw-grid");
    for (var i = 0; i < 7; i++) {
      var d = new Date(mon); d.setDate(mon.getDate() + i);
      var col = el("div", "tw-col" + (dateStr(d) === dateStr(new Date()) ? " today" : ""));
      var head = el("div", "tw-head");
      head.appendChild(el("span", "tw-dow", "日一二三四五六"[d.getDay()]));
      head.appendChild(el("span", "tw-date", (d.getMonth() + 1) + "/" + d.getDate()));
      col.appendChild(head);
      var dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      var dayEnd = dayStart + 86400000;
      state.ta.events.filter(function (e) { return e.start < dayEnd && e.end > dayStart; }).forEach(function (e) {
        var chip = el("div", "tw-chip");
        if (e.color) chip.style.background = e.color;
        chip.appendChild(el("span", "tw-chip-name", e.name));
        col.appendChild(chip);
      });
      grid.appendChild(col);
    }
    box.appendChild(grid);
  }
  function renderMonthView(box) {
    box = box || $("momentsTimeline");
    box.innerHTML = "";
    var now = new Date();
    var first = new Date(now.getFullYear(), now.getMonth() + taMonthOffset, 1);
    $("taViewLabel").textContent = first.getFullYear() + "年" + (first.getMonth() + 1) + "月";
    var startDow = (first.getDay() + 6) % 7;
    var daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    var grid = el("div", "tm-grid");
    ["一", "二", "三", "四", "五", "六", "日"].forEach(function (w) { grid.appendChild(el("div", "tm-dow", w)); });
    for (var i = 0; i < startDow; i++) grid.appendChild(el("div", "tm-cell blank"));
    for (var d = 1; d <= daysInMonth; d++) {
      var date = new Date(first.getFullYear(), first.getMonth(), d);
      var cell = el("div", "tm-cell" + (dateStr(date) === dateStr(new Date()) ? " today" : ""));
      cell.appendChild(el("span", "tm-date", String(d)));
      var dayStart = date.getTime();
      var dayEnd = dayStart + 86400000;
      var evs = state.ta.events.filter(function (e) { return e.start < dayEnd && e.end > dayStart; });
      if (evs.length) cell.appendChild(el("span", "tm-count", evs.length + ""));
      grid.appendChild(cell);
    }
    box.appendChild(grid);
  }
  function taTick() {
    var now = Date.now();
    var t = state.ta;
    dayInitIfNeeded();
    if (t.mood.happy == null) { t.mood.happy = randInt(30, 80); t.mood.relax = randInt(30, 80); t.mood.miss = randInt(30, 80); t.mood.at = now; }
    if (now - (t.mood.at || 0) >= 30 * 60000) {
      var p = t.cfg.mood;
      var p10 = Number(p.p10), p20 = Number(p.p20);
      ["happy", "relax", "miss"].forEach(function (k) {
        var r = Math.random() * 100;
        var mag = r < p10 ? randInt(1, 10) : (r < p10 + p20 ? randInt(1, 20) : randInt(1, 50));
        if (Math.random() < 0.5) mag = -mag;
        t.mood[k] = Math.max(0, Math.min(100, (t.mood[k] || 50) + mag));
      });
      t.mood.at = now;
    }
    var th = t.thought;
    if (!th.at || now - th.at >= 2 * 3600000) { th.text = pickNonBlank(catCards("thought")) || pick(DEFAULT_CARDS.thought); th.at = now; }
    if (!t.lastTick || now - t.lastTick >= 30 * 60000) { taScheduleTick(); t.lastTick = now; }
    if (!t.lastPlanCheck || now - t.lastPlanCheck >= (Number(t.cfg.planCheckMin) || 120) * 60000) { taPlanCheck(); t.lastPlanCheck = now; }
    save();
    renderMoments();
  }
  function initTA() {
    ensureEventColors();
    taTick();
    setInterval(taTick, 30000);
  }
  function toggleMoments(show) {
    if (show === undefined) show = !state.showMoments;
    state.showMoments = show;
    var app = $("app");
    if (app) app.classList.toggle("with-moments", show);
    save();
  }
  function openTAMax() {
    var body = $("taMaxBody");
    if (taView === "day") renderDayView(body);
    else if (taView === "week") renderWeekView(body);
    else renderMonthView(body);
    $("taMaxOverlay").hidden = false;
  }
  function openTogether() {
    var sel = $("togetherPlan");
    sel.innerHTML = "";
    var plans = state.plans.filter(function (p) { return !p.done; });
    if (!plans.length) { toast("还没有未完成的计划，先添加一个吧"); return; }
    plans.forEach(function (p) {
      var o = el("option", "", p.title);
      o.value = p.id;
      sel.appendChild(o);
    });
    var now = new Date();
    $("togetherStart").value = pad(now.getHours()) + ":" + pad(now.getMinutes());
    var end = new Date(now.getTime() + 60 * 60000);
    $("togetherEnd").value = pad(end.getHours()) + ":" + pad(end.getMinutes());
    $("togetherOverlay").hidden = false;
  }
  function saveTogether() {
    var planId = $("togetherPlan").value;
    var plan = state.plans.find(function (p) { return p.id === planId; });
    if (!plan) { toast("请选择计划"); return; }
    var s = $("togetherStart").value, e = $("togetherEnd").value;
    if (!s || !e) { toast("请选择时间"); return; }
    var sm = toMin(s), em = toMin(e);
    if (em <= sm) { toast("结束时间需晚于开始时间"); return; }
    if (hit(state.ta.cfg.together.refuse)) {
      $("togetherOverlay").hidden = true;
      toast(state.companion.name + " 拒绝了这次安排");
      addMessage("companion", "今天不太想安排这个，改天陪你完成「" + plan.title + "」好不好？", "comfort");
      return;
    }
    var dayStart = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime();
    scheduleTogether(plan, dayStart + sm * 60000, dayStart + em * 60000);
    $("togetherOverlay").hidden = true;
    toast("已安排：一起完成「" + plan.title + "」");
    addMessage("companion", "好呀，" + minToStr(sm) + " 到 " + minToStr(em) + "，陪你一起完成「" + plan.title + "」～", "system");
  }
  function openTASettings() { renderTASettings(); $("taSettingsOverlay").hidden = false; }
  function renderTASettings() {
    var box = $("taSettingsBody");
    box.innerHTML = "";
    var c = state.ta.cfg;
    var numField = function (k, label, val, max) {
      var lab = el("label", "field ta-field");
      lab.appendChild(el("span", "", label));
      var inp = el("input", "");
      inp.type = "number"; inp.value = val; inp.dataset.k = k; inp.min = 0; inp.max = max || 100;
      lab.appendChild(inp);
      return lab;
    };
    var timeField = function (k, label, val) {
      var lab = el("label", "field ta-field");
      lab.appendChild(el("span", "", label));
      var inp = el("input", "");
      inp.type = "time"; inp.value = val; inp.dataset.k = k;
      lab.appendChild(inp);
      return lab;
    };
    var g1 = el("div", "ta-grid");
    g1.appendChild(timeField("wake0", "起床 · 最早", c.wake[0]));
    g1.appendChild(timeField("wake1", "起床 · 最晚", c.wake[1]));
    g1.appendChild(timeField("sleep0", "睡觉 · 最早", c.sleep[0]));
    g1.appendChild(timeField("sleep1", "睡觉 · 最晚", c.sleep[1]));
    g1.appendChild(numField("planCheckMin", "计划检查间隔（分钟）", c.planCheckMin, 600));
    box.appendChild(g1);

    var g2 = el("div", "ta-grid");
    g2.appendChild(numField("turgent", "紧急计划触发概率（%）", c.together.urgent, 100));
    g2.appendChild(numField("timportant", "重要计划触发概率（%）", c.together.important, 100));
    g2.appendChild(numField("tnormal", "普通计划触发概率（%）", c.together.normal, 100));
    g2.appendChild(numField("tdurmin", "一起完成 · 最短（分）", c.together.durMin, 300));
    g2.appendChild(numField("tdurmax", "一起完成 · 最长（分）", c.together.durMax, 300));
    g2.appendChild(numField("trefuse", "TA 拒绝概率（%）", c.together.refuse, 100));
    box.appendChild(g2);

    var g3 = el("div", "ta-grid");
    g3.appendChild(numField("m10", "心情波动 ±10 概率（%）", c.mood.p10, 100));
    g3.appendChild(numField("m20", "心情波动 ±20 概率（%）", c.mood.p20, 100));
    g3.appendChild(numField("m50", "心情波动 ±50 概率（%）", c.mood.p50, 100));
    box.appendChild(g3);

    var g4 = el("div", "ta-grid");
    ["安排 0 件", "安排 1 件", "安排 2 件", "安排 3 件", "安排 4 件", "安排 5 件"].forEach(function (label, i) {
      g4.appendChild(numField("r1" + i, "第一轮 · " + label + "（%）", c.round1[i], 100));
    });
    box.appendChild(g4);

    var g5 = el("div", "ta-grid");
    ["30 分钟后", "1 小时后", "3 小时后", "12 小时后", "24 小时后", "3 天内"].forEach(function (label, i) {
      g5.appendChild(numField("r2" + i, "第二轮 · " + label + "（%）", c.round2[i], 100));
    });
    box.appendChild(g5);

    var evf = el("div", "field");
    evf.appendChild(el("span", "", "事件池（即时 / 未来 / 双属性，颜色可视化自选，默认淡色）"));
    var evList = el("div", "ta-events");
    (c.events || []).forEach(function (e, i) { evList.appendChild(buildEventRow(e, i)); });
    var addBtn = el("button", "btn ghost", "＋ 添加事件");
    addBtn.type = "button";
    addBtn.addEventListener("click", function () {
      c.events.push({ name: "新事件", min: 30, max: 60, immediate: true, future: true, color: pick(TA_COLORS) });
      renderTASettings();
    });
    evf.appendChild(evList);
    evf.appendChild(addBtn);
    box.appendChild(evf);
  }
  function buildEventRow(e, i) {
    var row = el("div", "ta-event-row");
    var name = el("input", "ta-ev-name"); name.type = "text"; name.value = e.name; name.dataset.i = i;
    var mn = el("input", "ta-ev-min"); mn.type = "number"; mn.value = e.min; mn.min = 1; mn.dataset.i = i;
    var mx = el("input", "ta-ev-max"); mx.type = "number"; mx.value = e.max; mx.min = 1; mx.dataset.i = i;
    var attr = el("select", "ta-ev-attr");
    ["双", "即", "未"].forEach(function (a) {
      var o = el("option", "", a);
      if ((a === "双" && e.immediate && e.future) || (a === "即" && e.immediate && !e.future) || (a === "未" && !e.immediate && e.future)) o.selected = true;
      attr.appendChild(o);
    });
    attr.dataset.i = i;
    var color = el("input", "ta-ev-color"); color.type = "color"; color.value = e.color || "#cdd8c4"; color.dataset.i = i;
    var del = el("button", "ta-ev-del", "🗑"); del.type = "button"; del.dataset.i = i;
    del.addEventListener("click", function () { state.ta.cfg.events.splice(i, 1); renderTASettings(); });
    row.appendChild(name); row.appendChild(mn); row.appendChild(el("span", "ta-ev-sep", "–")); row.appendChild(mx); row.appendChild(attr); row.appendChild(color); row.appendChild(del);
    return row;
  }
  function saveTASettings() {
    var c = state.ta.cfg;
    var inputs = $("taSettingsBody").querySelectorAll("input,textarea");
    var r1 = [0, 0, 0, 0, 0, 0], r2 = [0, 0, 0, 0, 0, 0];
    inputs.forEach(function (inp) {
      var k = inp.dataset.k;
      if (!k) return;
      var v = inp.value;
      if (k === "events") return;
      if (/^(wake|sleep)\d$/.test(k)) { c[k.slice(0, -1)][Number(k.slice(-1))] = v; return; }
      if (k === "planCheckMin") { c.planCheckMin = parseInt(v, 10) || 120; return; }
      if (k[0] === "t") {
        var tk = { turgent: "urgent", timportant: "important", tnormal: "normal", tdurmin: "durMin", tdurmax: "durMax", trefuse: "refuse" }[k];
        c.together[tk] = parseInt(v, 10) || 0;
        return;
      }
      if (k[0] === "m") { var mk = { m10: "p10", m20: "p20", m50: "p50" }[k]; c.mood[mk] = parseInt(v, 10) || 0; return; }
      if (k.indexOf("r1") === 0) { r1[Number(k.slice(2))] = parseInt(v, 10) || 0; return; }
      if (k.indexOf("r2") === 0) { r2[Number(k.slice(2))] = parseInt(v, 10) || 0; return; }
    });
    var evs = [];
    var rows = $("taSettingsBody").querySelectorAll(".ta-event-row");
    rows.forEach(function (row) {
      var nameEl = row.querySelector(".ta-ev-name");
      var mnEl = row.querySelector(".ta-ev-min");
      var mxEl = row.querySelector(".ta-ev-max");
      var attrEl = row.querySelector(".ta-ev-attr");
      var colorEl = row.querySelector(".ta-ev-color");
      if (!nameEl || !mnEl || !mxEl) return;
      var nm = nameEl.value.trim();
      var mn = parseInt(mnEl.value, 10) || 30;
      var mx = parseInt(mxEl.value, 10) || 60;
      if (mx < mn) mx = mn;
      var attr = attrEl ? attrEl.value : "双";
      var col = (colorEl && colorEl.value) ? colorEl.value : pick(TA_COLORS);
      evs.push({ name: nm, min: mn, max: mx, immediate: attr !== "未", future: attr !== "即", color: col });
    });
    if (evs.length) c.events = evs;

    if (Math.abs(r1.reduce(function (a, b) { return a + b; }, 0) - 100) > 1) { toast("第一轮六个概率之和需为 100%"); return; }
    if (Math.abs(r2.reduce(function (a, b) { return a + b; }, 0) - 100) > 1) { toast("第二轮六个概率之和需为 100%"); return; }
    if (Math.abs(Number(c.mood.p10) + Number(c.mood.p20) + Number(c.mood.p50) - 100) > 1) { toast("心情波动三个概率之和需为 100%"); return; }
    c.round1 = r1; c.round2 = r2;
    ensureEventColors();
    save();
    $("taSettingsOverlay").hidden = true;
    toast("TA 设置已保存 ✅");
  }

  /* ---------------- 诊断钩子 ---------------- */
  window.__starpDiag = {
    genOneReply: genOneReply,
    pyJoinCards: pyJoinCards,
    getReplyPool: getReplyPool,
    catCards: catCards,
    replyCards: replyCards,
    batchAddReply: batchAddReply,
    batchAddFlat: batchAddFlat,
    generateTADay: taScheduleTick,
    scheduleTogether: scheduleTogether,
    taPlanCheck: taPlanCheck,
    taStatusText: taStatusText,
    taTick: taTick,
    renderMoments: renderMoments,
    renderDayView: renderDayView,
    renderWeekView: renderWeekView,
    renderMonthView: renderMonthView,
    scheduleReply: scheduleReply,
    tryAutoSend: tryAutoSend,
    state: function () { return state; }
  };

  init();
})();
