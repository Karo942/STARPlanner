/* =========================================================
   STARPlanner · 应用逻辑
   一个像聊天一样陪你完成计划的伙伴：
   · 每日不定时鼓励与催促
   · 自定义伙伴头像/昵称
   · 陪伴番茄钟
   · 自定义纪念日（置顶显示）
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
  var PLAN_LEAD_HOURS = 3; // 截止前提前提醒的小时数
  var POMO_RING_C = 552.92; // 2 * PI * 88

  /* ---------------- 消息文案池 ---------------- */
  var POOL = {
    encourage: [
      "早安呀，新的一天也要元气满满哦 ☀️",
      "你已经比昨天的自己更棒了，继续保持！",
      "累的时候就休息一下，我一直都在。",
      "别给自己太大压力，你已经做得很好了。",
      "每一个小进步都算数，加油！",
      "记得喝口水，照顾好自己 💧",
      "今天也要开开心心的呀～",
      "你认真努力的样子真的很好看。",
      "慢慢来，反而比较快。",
      "失败也没关系，我们再来一次！",
      "今天也谢谢你没有放弃自己 🌿",
      "抬头看看窗外，给眼睛放个小假吧。"
    ],
    urge: [
      "别偷懒啦，你的计划还在等你哦！",
      "「{plan}」还没完成，快去搞定它吧 🔔",
      "拖延只会让事情更难，现在就开始！",
      "再小的行动也比空想强，动起来～",
      "你的「{plan}」进度如何啦？我在监督你哦 😉",
      "该行动啦，完成之后记得奖励自己！",
      "不要等明天啦，就现在，迈出第一步！",
      "「{plan}」又想起我了吗？去完成它吧！"
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
    greet: [
      "早上好呀，今天想先完成哪件事？",
      "早～今天也要照顾好自己的心情。",
      "下午好，休息得怎么样？",
      "晚上好，今天辛苦了，记得早点休息。"
    ],
    thanks: [
      "嘿嘿，不客气，我会一直陪着你的 💛",
      "能帮到你我也很开心！",
      "你开心就好，我们一起加油～"
    ],
    tired: [
      "抱抱你 🫂 累的话就先歇一歇，没关系的。",
      "你已经很努力了，适当休息不是偷懒。",
      "别硬撑，喝口水、深呼吸，我陪着你。",
      "今天的辛苦我都看见了，你真的很了不起。"
    ],
    done: [
      "太棒了！「{plan}」完成啦，给你一个大大的赞 🎉",
      "说到做到，你超厉害！奖励自己一下吧。",
      "又完成一件事，离目标更近一步了！"
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
    ],
    fallback: [
      "嗯嗯，我在听～",
      "好呀，我会记住的。",
      "你说的对，做自己就好。",
      "我会一直支持你的决定。",
      "明白了，需要我帮你记下这个计划吗？"
    ]
  };

  var QUICK_REPLIES = ["早安", "我有点累", "夸夸我", "帮我催一下计划", "今天完成了一件大事"];

  /* ---------------- 状态 ---------------- */
  function defaultState() {
    return {
      companion: { name: "星野", avatar: { type: "emoji", value: "🐻" }, slogan: "你的私人计划搭子" },
      user: { name: "我", avatar: { type: "emoji", value: "😊" } },
      plans: [],
      messages: [],
      settings: { frequency: "medium", activeStart: "08:00", activeEnd: "23:00", theme: "light" },
      schedule: { date: "", items: [] },
      planReminders: {}, // planId -> 'YYYY-MM-DD'
      anniversaries: [], // { id, title, month, day, startYear, emoji }
      annivGreeted: {}, // annivId -> 'YYYY-MM-DD'
      pomodoro: { focus: 25, short: 5, long: 15, longEvery: 4, today: "", todayCount: 0, total: 0 },
      pomoTimer: { phase: "focus", running: false, endAt: null, remaining: 1500, started: false, cycleCount: 0 },
      seen: false
    };
  }

  var state = load();

  function load() {
    var base = defaultState();
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return base;
      var parsed = JSON.parse(raw);
      return mergeDeep(base, parsed);
    } catch (e) {
      return base;
    }
  }

  function mergeDeep(base, extra) {
    var out = {};
    Object.keys(base).forEach(function (k) {
      out[k] = base[k];
    });
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
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function dateStr(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function toMin(t) {
    if (!t) return 0;
    var p = t.split(":");
    return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
  }
  function minToStr(m) {
    m = Math.max(0, Math.min(1439, m));
    return pad(Math.floor(m / 60)) + ":" + pad(m % 60);
  }
  function fmtClock(ts) {
    var d = new Date(ts);
    return pad(d.getHours()) + ":" + pad(d.getMinutes());
  }
  function fmtDue(ts) {
    if (!ts) return "";
    var d = new Date(ts);
    var now = new Date();
    var sameDay = dateStr(d) === dateStr(now);
    var time = pad(d.getHours()) + ":" + pad(d.getMinutes());
    if (sameDay) return "今天 " + time;
    var tomorrow = new Date(now.getTime() + 86400000);
    if (dateStr(d) === dateStr(tomorrow)) return "明天 " + time;
    return (d.getMonth() + 1) + "月" + d.getDate() + "日 " + time;
  }
  function fmtPomo(sec) {
    sec = Math.max(0, Math.round(sec));
    return pad(Math.floor(sec / 60)) + ":" + pad(sec % 60);
  }
  function fill(text, map) {
    return text.replace(/\{(\w+)\}/g, function (_, k) { return map[k] != null ? map[k] : ""; });
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

  /* ---------------- 主题 ---------------- */
  function applyTheme() {
    document.documentElement.setAttribute("data-theme", state.settings.theme);
    $("themeBtn").textContent = state.settings.theme === "dark" ? "☀️" : "🌙";
  }

  /* ---------------- 头像渲染 ---------------- */
  function renderAvatar(container, avatar) {
    container.innerHTML = "";
    if (avatar && avatar.type === "image" && avatar.value) {
      var img = document.createElement("img");
      img.src = avatar.value;
      img.alt = "头像";
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
  function addMessage(role, text, kind) {
    var msg = { id: uid(), role: role, text: text, time: Date.now(), kind: kind || "" };
    state.messages.push(msg);
    if (state.messages.length > 500) {
      state.messages = state.messages.slice(-500);
    }
    renderMessage(msg);
    scrollBottom();
    save();
    return msg;
  }

  function renderMessage(msg) {
    var wrap = el("div", "msg " + msg.role);
    var avatar = el("div", "msg-avatar " + (msg.role === "companion" ? "companion" : ""));
    renderAvatar(avatar, msg.role === "companion" ? state.companion.avatar : state.user.avatar);

    var body = el("div", "msg-body");
    var bubble = el("div", "bubble" + (msg.kind ? " kind-" + msg.kind : ""));
    bubble.textContent = msg.text;
    var time = el("div", "msg-time", fmtClock(msg.time));
    body.appendChild(bubble);
    body.appendChild(time);
    wrap.appendChild(avatar);
    wrap.appendChild(body);
    messagesEl.appendChild(wrap);
  }

  function renderAllMessages() {
    messagesEl.innerHTML = "";
    state.messages.forEach(renderMessage);
    scrollBottom(false);
  }

  function scrollBottom() {
    requestAnimationFrame(function () {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    });
  }

  function showTyping() {
    var wrap = el("div", "msg companion typing-msg");
    var avatar = el("div", "msg-avatar companion");
    renderAvatar(avatar, state.companion.avatar);
    var body = el("div", "msg-body");
    var bubble = el("div", "bubble");
    bubble.innerHTML = '<div class="typing"><span></span><span></span><span></span></div>';
    body.appendChild(bubble);
    wrap.appendChild(avatar);
    wrap.appendChild(body);
    messagesEl.appendChild(wrap);
    scrollBottom();
    return wrap;
  }

  function removeTyping() {
    var t = messagesEl.querySelector(".typing-msg");
    if (t) t.remove();
  }

  /* ---------------- 通知 ---------------- */
  function notifySupported() {
    return "Notification" in window;
  }
  function canNotify() {
    return notifySupported() && Notification.permission === "granted";
  }
  function pushNotification(title, body) {
    if (!canNotify() || !document.hidden) return;
    try {
      var n = new Notification(title, {
        body: body,
        icon: "data:image/svg+xml," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌟</text></svg>")
      });
      setTimeout(function () { n.close(); }, 6000);
    } catch (e) { /* 忽略 */ }
  }

  function updateNotifyBtn() {
    var btn = $("notifyBtn");
    if (!notifySupported()) {
      btn.textContent = "🔕";
      btn.title = "当前浏览器不支持桌面通知";
      btn.classList.remove("active");
      return;
    }
    if (Notification.permission === "granted") {
      btn.textContent = "🔔";
      btn.classList.add("active");
      btn.title = "桌面通知已开启";
    } else if (Notification.permission === "denied") {
      btn.textContent = "🔕";
      btn.classList.remove("active");
      btn.title = "通知已被拒绝，请在浏览器设置中开启";
    } else {
      btn.textContent = "🔔";
      btn.classList.remove("active");
      btn.title = "开启桌面通知";
    }
  }

  function requestNotify() {
    if (!notifySupported()) { toast("当前浏览器不支持桌面通知"); return; }
    if (Notification.permission === "granted") { toast("桌面通知已开启 ✅"); return; }
    if (Notification.permission === "denied") {
      toast("通知已被拒绝，请在浏览器设置里允许本站通知");
      return;
    }
    Notification.requestPermission().then(function (p) {
      updateNotifyBtn();
      if (p === "granted") toast("桌面通知已开启 ✅");
      else toast("未开启通知，你可以稍后再试");
    });
  }

  /* ---------------- 未读提示 ---------------- */
  var unread = 0;
  function bumpUnread() {
    if (!document.hidden) return;
    unread++;
    document.title = "(" + unread + ") 新消息 · STARPlanner";
  }
  window.addEventListener("focus", function () {
    unread = 0;
    document.title = "STARPlanner · 陪你完成计划";
  });
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) {
      unread = 0;
      document.title = "STARPlanner · 陪你完成计划";
    }
  });

  /* ---------------- 计划列表渲染 ---------------- */
  function activePlans() {
    return state.plans.filter(function (p) { return !p.done; });
  }

  function dueInfo(plan) {
    if (!plan.due) return null;
    var diff = new Date(plan.due).getTime() - Date.now();
    if (diff < 0) return { label: "已逾期 " + fmtDue(plan.due), cls: "overdue" };
    if (diff < 86400000) return { label: "⏰ " + fmtDue(plan.due), cls: "soon" };
    return { label: "🕐 " + fmtDue(plan.due), cls: "" };
  }

  function renderPlans() {
    planListEl.innerHTML = "";
    var has = state.plans.length > 0;
    plansEmptyEl.hidden = has;
    state.plans.forEach(function (plan) {
      planListEl.appendChild(buildPlanItem(plan));
    });
    renderFootTip();
  }

  function buildPlanItem(plan) {
    var item = el("div", "plan-item" + (plan.done ? " done" : ""));
    item.dataset.id = plan.id;

    var check = el("button", "plan-check", plan.done ? "✓" : "");
    check.title = plan.done ? "标记为未完成" : "标记为完成";
    check.setAttribute("aria-label", "切换完成状态");
    check.addEventListener("click", function (e) {
      e.stopPropagation();
      togglePlan(plan.id);
    });

    var body = el("div", "plan-body");
    var title = el("div", "plan-title", plan.title);
    body.appendChild(title);
    var due = dueInfo(plan);
    if (due) {
      body.appendChild(el("div", "plan-due " + due.cls, due.label));
    }

    body.addEventListener("click", function () {
      openPlanModal(plan);
    });

    var del = el("button", "plan-delete", "🗑");
    del.title = "删除计划";
    del.addEventListener("click", function (e) {
      e.stopPropagation();
      deletePlan(plan.id);
    });

    var dot = el("span", "priority-dot " + (plan.priority || "medium"));

    item.appendChild(check);
    item.appendChild(body);
    item.appendChild(dot);
    item.appendChild(del);
    return item;
  }

  function renderFootTip() {
    var items = state.schedule.items || [];
    if (!items.length) {
      footTipEl.textContent = "今日提醒将在随机时刻送达";
      return;
    }
    var times = items.map(function (it) { return minToStr(it.timeMin); }).join(" · ");
    footTipEl.textContent = "今日会在 " + times + " 来找你";
  }

  /* ---------------- 计划操作 ---------------- */
  function addPlan(data) {
    var plan = {
      id: uid(),
      title: data.title,
      due: data.due || null,
      priority: data.priority || "medium",
      createdAt: Date.now(),
      done: false
    };
    state.plans.unshift(plan);
    renderPlans();
    save();

    addMessage("companion", pick(POOL.plan) + " 我记下「" + plan.title + "」啦，加油！", "remind");
    bumpUnread();
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
    if (plan.done) {
      var t = fill(pick(POOL.done), { plan: plan.title });
      addMessage("companion", t, "encourage");
      bumpUnread();
    }
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
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
      "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  function renderPriorityPick() {
    var btns = document.querySelectorAll("#priorityPick .priority");
    btns.forEach(function (b) {
      b.classList.toggle("active", b.dataset.priority === prioritySel);
    });
  }

  function closePlanModal() {
    $("planOverlay").hidden = true;
    editingPlanId = null;
  }

  /* ---------------- 设置弹窗 ---------------- */
  var emojiSel = state.companion.avatar.value;
  var freqSel = state.settings.frequency;

  function openSettings() {
    $("companionNameInput").value = state.companion.name;
    emojiSel = state.companion.avatar.type === "emoji" ? state.companion.avatar.value : "";
    freqSel = state.settings.frequency;
    $("activeStart").value = state.settings.activeStart;
    $("activeEnd").value = state.settings.activeEnd;
    renderEmojiGrid();
    renderFreqPick();
    $("settingsOverlay").hidden = false;
  }

  function renderEmojiGrid() {
    var grid = $("emojiGrid");
    grid.innerHTML = "";
    EMOJI_AVATARS.forEach(function (e) {
      var b = el("button", "emoji-opt" + (e === emojiSel ? " active" : ""), e);
      b.type = "button";
      b.addEventListener("click", function () {
        emojiSel = e;
        renderEmojiGrid();
      });
      grid.appendChild(b);
    });
  }

  function renderFreqPick() {
    var btns = document.querySelectorAll("#freqPick .priority");
    btns.forEach(function (b) {
      b.classList.toggle("active", b.dataset.freq === freqSel);
    });
  }

  function saveSettings() {
    var name = $("companionNameInput").value.trim();
    if (name) state.companion.name = name;
    if (emojiSel) state.companion.avatar = { type: "emoji", value: emojiSel };
    state.settings.frequency = freqSel;
    var s = $("activeStart").value, e = $("activeEnd").value;
    if (s) state.settings.activeStart = s;
    if (e) state.settings.activeEnd = e;
    if (toMin(state.settings.activeStart) >= toMin(state.settings.activeEnd)) {
      toast("活跃时段开始需早于结束");
      return;
    }
    updateCompanionUI();
    generateDailySchedule(dateStr(new Date()));
    renderFootTip();
    save();
    $("settingsOverlay").hidden = true;
    toast("设置已保存 ✅");
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
      items.push({ timeMin: t, kind: Math.random() < 0.55 ? "encourage" : "urge", sent: false });
    }
    items.sort(function (a, b) { return a.timeMin - b.timeMin; });
    state.schedule = { date: dayStr, items: items };
  }

  function fireScheduled(item) {
    item.sent = true;
    var c = state.companion.name;
    var text;
    var kind = item.kind;
    if (kind === "urge") {
      var active = activePlans();
      if (active.length && Math.random() < 0.7) {
        var p = pick(active);
        text = fill(pick(POOL.urge), { plan: p.title, name: c });
        kind = "urge";
      } else {
        text = fill(pick(POOL.encourage), { name: c });
        kind = "encourage";
      }
    } else {
      text = fill(pick(POOL.encourage), { name: c });
    }
    addMessage("companion", text, kind);
    bumpUnread();
    pushNotification(c + " 发来消息", text);
  }

  function checkPlanReminders(now) {
    var today = dateStr(now);
    state.plans.forEach(function (plan) {
      if (plan.done || !plan.due) return;
      if (state.planReminders[plan.id] === today) return;
      var due = new Date(plan.due).getTime();
      var lead = due - PLAN_LEAD_HOURS * 3600000;
      if (now.getTime() >= lead) {
        state.planReminders[plan.id] = today;
        var text;
        if (now.getTime() >= due) {
          text = fill(pick(POOL.overdue), { plan: plan.title });
        } else {
          text = fill(pick(POOL.remind), { plan: plan.title });
        }
        addMessage("companion", text, "remind");
        bumpUnread();
        pushNotification(state.companion.name + " 提醒你", text);
      }
    });
  }

  function tick() {
    var now = new Date();
    var today = dateStr(now);
    if (state.schedule.date !== today) {
      generateDailySchedule(today);
      renderFootTip();
    }
    var curMin = now.getHours() * 60 + now.getMinutes();
    var pending = state.schedule.items.filter(function (it) { return !it.sent && it.timeMin <= curMin; });
    if (pending.length) {
      fireScheduled(pending[0]); // 每轮最多补发一条，避免一次性轰炸
      save();
    }
    checkPlanReminders(now);
    checkAnniversaries(now);
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
    if (isToday) {
      label = (years && years > 0) ? "第 " + years + " 年 · 就是今天 🎉" : "就是今天 🎉";
    } else if (days === 1) {
      label = "就是明天";
    } else {
      label = "还有 " + days + " 天";
    }
    return { isToday: isToday, days: days, years: years, label: label };
  }

  function renderAnniversaries() {
    annivListEl.innerHTML = "";
    var has = state.anniversaries.length > 0;
    annivEmptyEl.hidden = has;
    var items = state.anniversaries.slice().map(function (a) {
      return { a: a, info: annivInfo(a) };
    }).sort(function (x, y) {
      if (x.info.days !== y.info.days) return x.info.days - y.info.days;
      return (x.a.title || "").localeCompare(y.a.title || "");
    });
    items.forEach(function (x) {
      annivListEl.appendChild(buildAnnivItem(x.a, x.info));
    });
  }

  function buildAnnivItem(a, info) {
    var item = el("div", "anniv-item" + (info.isToday ? " today" : ""));
    var emoji = el("span", "anniv-emoji", a.emoji || "🎂");
    var body = el("div", "anniv-body");
    var title = el("div", "anniv-title", a.title);
    var count = el("div", "anniv-count", info.label);
    body.appendChild(title);
    body.appendChild(count);
    item.appendChild(emoji);
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

  function annivDateValue(month, day, startYear) {
    var y = startYear || new Date().getFullYear();
    return y + "-" + pad(month) + "-" + pad(day);
  }

  function renderAnnivEmojiGrid() {
    var grid = $("annivEmojiGrid");
    grid.innerHTML = "";
    ANNIV_EMOJIS.forEach(function (e) {
      var b = el("button", "emoji-opt" + (e === annivEmojiSel ? " active" : ""), e);
      b.type = "button";
      b.addEventListener("click", function () {
        annivEmojiSel = e;
        renderAnnivEmojiGrid();
      });
      grid.appendChild(b);
    });
  }

  function saveAnniv() {
    var title = $("annivTitle").value.trim();
    if (!title) { toast("请填写纪念日名称"); return; }
    var val = $("annivDate").value;
    if (!val) { toast("请选择日期"); return; }
    var parts = val.split("-");
    var month = parseInt(parts[1], 10);
    var day = parseInt(parts[2], 10);
    var year = parseInt(parts[0], 10);
    if (editingAnnivId) {
      var a = state.anniversaries.find(function (x) { return x.id === editingAnnivId; });
      if (a) {
        a.title = title; a.month = month; a.day = day; a.startYear = year; a.emoji = annivEmojiSel;
      }
    } else {
      state.anniversaries.push({
        id: uid(), title: title, month: month, day: day, startYear: year, emoji: annivEmojiSel
      });
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
        var text = "今天是「" + a.title + "」" +
          (years && years > 0 ? "第 " + years + " 周年" : "纪念日") +
          "，记得给自己一份仪式感 🎉";
        addMessage("companion", text, "remind");
        bumpUnread();
        pushNotification(state.companion.name + " 提醒你", text);
        renderAnniversaries();
      }
    });
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
    var label = pt.phase === "focus" ? "专注中 🍅" : pt.phase === "short" ? "短休息 ☕" : "长休息 🌿";
    $("pomoPhase").textContent = label;
    var color = pt.phase === "focus" ? "var(--accent)" : pt.phase === "short" ? "var(--green)" : "var(--amber)";
    $("pomoProgress").style.stroke = color;
    $("pomoToggle").textContent = pt.running ? "暂停" : (pt.started ? "继续" : "开始");
    $("pomoStats").textContent = "今日 " + state.pomodoro.todayCount + " 个 · 累计 " + state.pomodoro.total + " 个";
  }

  function updatePomoHeader() {
    var btn = $("pomoBtn");
    var pt = state.pomoTimer;
    if (pt.running) {
      btn.classList.add("pomo-active");
      btn.title = "番茄钟进行中 · " + fmtPomo(remainingSec());
    } else {
      btn.classList.remove("pomo-active");
      btn.title = "陪伴番茄钟";
    }
  }

  var audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (AC) audioCtx = new AC();
      } catch (e) { /* 忽略 */ }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      try { audioCtx.resume(); } catch (e) { /* 忽略 */ }
    }
  }
  function chime() {
    try {
      if (!audioCtx) return;
      var now = audioCtx.currentTime;
      [523.25, 659.25, 783.99].forEach(function (f, i) {
        var o = audioCtx.createOscillator();
        var g = audioCtx.createGain();
        o.type = "sine";
        o.frequency.value = f;
        var t = now + i * 0.13;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
        o.connect(g);
        g.connect(audioCtx.destination);
        o.start(t);
        o.stop(t + 0.4);
      });
    } catch (e) { /* 忽略 */ }
  }

  function togglePomo() {
    ensureAudio();
    var pt = state.pomoTimer;
    if (pt.running) {
      pt.remaining = remainingSec();
      pt.running = false;
      pt.endAt = null;
    } else {
      if (!pt.started) {
        pt.remaining = pomoDuration();
        pt.started = true;
        if (pt.phase === "focus") {
          var min = state.pomodoro.focus;
          addMessage("companion", fill(pick(POOL.pomoStart), { min: min, name: state.companion.name }), "system");
          bumpUnread();
        }
      }
      pt.running = true;
      pt.endAt = Date.now() + pt.remaining * 1000;
    }
    save();
    renderPomo();
    updatePomoHeader();
  }

  function resetPomo() {
    var pt = state.pomoTimer;
    pt.running = false;
    pt.endAt = null;
    pt.phase = "focus";
    pt.remaining = state.pomodoro.focus * 60;
    pt.started = false;
    pt.cycleCount = 0;
    save();
    renderPomo();
    updatePomoHeader();
  }

  function skipPomo() {
    var pt = state.pomoTimer;
    var p = state.pomodoro;
    if (pt.phase === "focus") {
      if (pt.cycleCount >= p.longEvery) { pt.phase = "long"; pt.cycleCount = 0; }
      else { pt.phase = "short"; }
    } else {
      pt.phase = "focus";
    }
    pt.remaining = pomoDuration();
    pt.started = false;
    pt.running = false;
    pt.endAt = null;
    save();
    renderPomo();
    updatePomoHeader();
  }

  function completePomoPhase() {
    var pt = state.pomoTimer;
    var p = state.pomodoro;
    var wasFocus = pt.phase === "focus";
    if (wasFocus) {
      p.total++;
      if (p.today !== dateStr(new Date())) { p.today = dateStr(new Date()); p.todayCount = 0; }
      p.todayCount++;
      pt.cycleCount++;
      var rest = (pt.cycleCount >= p.longEvery) ? p.long : p.short;
      var text = fill(pick(POOL.pomoFocusDone), { min: rest, name: state.companion.name });
      addMessage("companion", text, "encourage");
      bumpUnread();
      pushNotification(state.companion.name + " · 番茄完成", text);
      chime();

      if (pt.cycleCount >= p.longEvery) { pt.phase = "long"; pt.cycleCount = 0; }
      else { pt.phase = "short"; }
      pt.remaining = pomoDuration();
      pt.started = false;
      pt.running = true; // 自动进入休息
      pt.endAt = Date.now() + pt.remaining * 1000;
      addMessage("companion", "休息 " + rest + " 分钟吧，起来活动一下 ☕", "system");
      bumpUnread();
    } else {
      pt.phase = "focus";
      pt.remaining = p.focus * 60;
      pt.started = false;
      pt.running = false;
      pt.endAt = null;
      var t2 = fill(pick(POOL.pomoBreakDone), { name: state.companion.name });
      addMessage("companion", t2, "encourage");
      bumpUnread();
      pushNotification(state.companion.name + " · 休息结束", "准备开始下一个专注吧");
      chime();
    }
    save();
    renderPomo();
    updatePomoHeader();
  }

  function tickPomo() {
    var pt = state.pomoTimer;
    var p = state.pomodoro;
    var today = dateStr(new Date());
    if (p.today !== today) { p.today = today; p.todayCount = 0; }
    if (pt.running && pt.endAt && Date.now() >= pt.endAt) {
      completePomoPhase();
    }
    renderPomo();
    updatePomoHeader();
  }

  function openPomodoro() {
    $("pomoFocus").value = state.pomodoro.focus;
    $("pomoShort").value = state.pomodoro.short;
    $("pomoLong").value = state.pomodoro.long;
    $("pomoEvery").value = state.pomodoro.longEvery;
    renderPomo();
    $("pomodoroOverlay").hidden = false;
  }

  function bindPomoSettings() {
    var cfg = [
      ["pomoFocus", "focus", 1, 120],
      ["pomoShort", "short", 1, 60],
      ["pomoLong", "long", 1, 60],
      ["pomoEvery", "longEvery", 1, 12]
    ];
    cfg.forEach(function (c) {
      $(c[0]).addEventListener("change", function () {
        var v = parseInt(this.value, 10);
        if (isNaN(v)) { this.value = state.pomodoro[c[1]]; return; }
        v = Math.max(c[2], Math.min(c[3], v));
        this.value = v;
        state.pomodoro[c[1]] = v;
        if (c[1] !== "longEvery") {
          var pt = state.pomoTimer;
          if (!pt.running && !pt.started) pt.remaining = pomoDuration();
        }
        save();
        renderPomo();
      });
    });
  }

  /* ---------------- 伙伴回复 ---------------- */
  function companionRespond(userText) {
    var t = userText.toLowerCase();
    var map = { name: state.companion.name, plan: "" };
    var active = activePlans();
    if (active.length) map.plan = active[0].title;

    var pool = POOL.fallback;
    if (/谢谢|感谢|辛苦|爱你|棒|厉害|么么|love|thanks|❤/.test(t)) pool = POOL.thanks;
    else if (/累|烦|难过|伤心|哭|emo|崩溃|压力|焦虑|不想|糟糕/.test(t)) pool = POOL.tired;
    else if (/完成|做完|搞定|结束|done|打卡|搞完/.test(t)) pool = POOL.done;
    else if (/计划|任务|目标|安排|todo/.test(t)) pool = POOL.plan;
    else if (/早|早安|早上好|下午好|晚上好|你好|hello|hi|在吗|晚安/.test(t)) pool = POOL.greet;
    else if (/夸|加油|鼓励/.test(t)) pool = POOL.encourage;

    if (pool === POOL.done && !map.plan) {
      return pick(["太棒了，为你开心 🎉", "真厉害，说到做到！", "完成的感觉真好，继续保持！"]);
    }
    return fill(pick(pool), map);
  }

  function sendMessage(text) {
    text = (text || "").trim();
    if (!text) return;
    messageInput.value = "";
    addMessage("user", text);

    var typing = showTyping();
    setTimeout(function () {
      removeTyping();
      var reply = companionRespond(text);
      addMessage("companion", reply, "encourage");
      bumpUnread();
      pushNotification(state.companion.name + " 回复你", reply);
    }, 900 + Math.random() * 700);
  }

  /* ---------------- 快捷回复 ---------------- */
  function renderQuickReplies() {
    quickRepliesEl.innerHTML = "";
    QUICK_REPLIES.forEach(function (q) {
      var b = el("button", "quick-reply", q);
      b.type = "button";
      b.addEventListener("click", function () { sendMessage(q); });
      quickRepliesEl.appendChild(b);
    });
  }

  /* ---------------- Toast ---------------- */
  var toastTimer = null;
  function toast(text) {
    toastEl.textContent = text;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 2600);
  }

  /* ---------------- 侧栏（移动端） ---------------- */
  function toggleSidebar(open) {
    var sb = $("sidebar");
    var isOpen = sb.classList.contains("open");
    if (open === undefined) open = !isOpen;
    sb.classList.toggle("open", open);
  }

  /* ---------------- 事件绑定 ---------------- */
  function bindEvents() {
    composerForm.addEventListener("submit", function (e) {
      e.preventDefault();
      sendMessage(messageInput.value);
    });

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
      b.addEventListener("click", function () {
        prioritySel = b.dataset.priority;
        renderPriorityPick();
      });
    });

    $("openSettings").addEventListener("click", openSettings);
    $("companionAvatar").addEventListener("click", openSettings);
    $("settingsSave").addEventListener("click", saveSettings);

    document.querySelectorAll("#freqPick .priority").forEach(function (b) {
      b.addEventListener("click", function () {
        freqSel = b.dataset.freq;
        renderFreqPick();
      });
    });

    $("avatarUploadBtn").addEventListener("click", function () { $("avatarUpload").click(); });
    $("avatarUpload").addEventListener("change", function () {
      var file = this.files && this.files[0];
      if (!file) return;
      if (!/^image\//.test(file.type)) { toast("请选择图片文件"); return; }
      resizeImage(file, 320).then(function (dataUrl) {
        state.companion.avatar = { type: "image", value: dataUrl };
        emojiSel = "";
        renderEmojiGrid();
        toast("头像已更新，保存后生效");
      }).catch(function () {
        toast("图片读取失败，请重试");
      });
      this.value = "";
    });
    $("avatarResetBtn").addEventListener("click", function () {
      state.companion.avatar = { type: "emoji", value: "🐻" };
      emojiSel = "🐻";
      renderEmojiGrid();
      toast("已恢复默认头像，保存后生效");
    });

    $("notifyBtn").addEventListener("click", requestNotify);
    $("themeBtn").addEventListener("click", function () {
      state.settings.theme = state.settings.theme === "dark" ? "light" : "dark";
      applyTheme();
      save();
    });

    // 纪念日
    $("addAnnivBtn").addEventListener("click", function () { openAnnivModal(null); });
    $("annivSave").addEventListener("click", saveAnniv);
    $("annivDelete").addEventListener("click", deleteAnniv);

    // 番茄钟
    $("pomoBtn").addEventListener("click", function () { ensureAudio(); openPomodoro(); });
    $("pomoToggle").addEventListener("click", togglePomo);
    $("pomoReset").addEventListener("click", resetPomo);
    $("pomoSkip").addEventListener("click", skipPomo);
    bindPomoSettings();

    $("sidebarOpen").addEventListener("click", function () { toggleSidebar(true); });
    $("sidebarClose").addEventListener("click", function () { toggleSidebar(false); });

    // 关闭弹窗
    document.querySelectorAll("[data-close]").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-close");
        $(id).hidden = true;
      });
    });
    document.querySelectorAll(".overlay").forEach(function (o) {
      o.addEventListener("click", function (e) {
        if (e.target === o) o.hidden = true;
      });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        document.querySelectorAll(".overlay").forEach(function (o) { o.hidden = true; });
        toggleSidebar(false);
      }
    });
  }

  /* ---------------- 初始化 ---------------- */
  function init() {
    bindEvents();
    applyTheme();
    updateCompanionUI();
    updateNotifyBtn();
    renderQuickReplies();
    renderPlans();
    renderAnniversaries();
    renderAllMessages();

    // 番茄钟剩余时间归一化（防止时长设置变化后不一致）
    if (!state.pomoTimer.started && !state.pomoTimer.running) {
      state.pomoTimer.remaining = pomoDuration();
    }
    renderPomo();
    updatePomoHeader();

    if (!state.seen) {
      state.seen = true;
      var c = state.companion.name;
      addMessage("companion", "你好呀，我是" + c + " 👋 以后我就是你的计划搭子啦。", "encourage");
      addMessage("companion", "每天我都会在不定的时候来找你，给你加油打气，也会盯着你的计划、提醒你别偷懒～", "encourage");
      addMessage("companion", "左侧可以添加计划、置顶纪念日，右上角的 🍅 是陪伴番茄钟，我们一起加油吧！", "system");
      save();
    }

    var today = dateStr(new Date());
    if (state.schedule.date !== today) {
      generateDailySchedule(today);
      save();
    }
    renderFootTip();

    setInterval(tick, 25000);
    tick(); // 立即执行一次，处理跨天与补发

    setInterval(tickPomo, 500);
    tickPomo();
  }

  init();
})();
