"use strict";

// ====== 定数 ======
const STORAGE_KEY = "habit-tracker:v1";

const EMOJIS = ["🏃", "💧", "📖", "🧘", "💪", "🛏️", "🍎", "✍️", "🎸", "🧹", "💊", "🌅"];
const COLORS = ["#6c5ce7", "#00b894", "#e17055", "#0984e3", "#e84393", "#fdcb6e", "#636e72"];

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

// ====== 状態 ======
let habits = loadHabits();
let editingHabitId = null;   // 編集中の習慣ID（nullなら新規追加）
let calendarHabitId = null;  // カレンダー表示中の習慣ID
let calendarMonth = null;    // カレンダー表示中の月（Date、1日固定）

// ====== ユーティリティ ======
function todayStr() {
  return dateToStr(new Date());
}

// タイムゾーンのずれを避けるためローカル時刻ベースで YYYY-MM-DD を作る
function dateToStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function loadHabits() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveHabits() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
}

function getHabit(id) {
  return habits.find((h) => h.id === id);
}

// 今日（未達成なら昨日）から遡って連続日数を数える
function currentStreak(habit) {
  const done = new Set(habit.doneDates);
  let d = new Date();
  if (!done.has(dateToStr(d))) d = addDays(d, -1);
  let streak = 0;
  while (done.has(dateToStr(d))) {
    streak++;
    d = addDays(d, -1);
  }
  return streak;
}

function bestStreak(habit) {
  const dates = [...habit.doneDates].sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const s of dates) {
    if (prev !== null && s === dateToStr(addDays(new Date(prev + "T00:00:00"), 1))) {
      run++;
    } else {
      run = 1;
    }
    best = Math.max(best, run);
    prev = s;
  }
  return best;
}

// ====== 描画 ======
function render() {
  renderTodayLabel();
  renderSummary();
  renderHabitList();
}

function renderTodayLabel() {
  const now = new Date();
  document.getElementById("today-label").textContent =
    `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日（${WEEKDAY_LABELS[now.getDay()]}）`;
}

function renderSummary() {
  const today = todayStr();
  const doneToday = habits.filter((h) => h.doneDates.includes(today)).length;
  const maxStreak = habits.reduce((m, h) => Math.max(m, bestStreak(h)), 0);
  const total = habits.reduce((sum, h) => sum + h.doneDates.length, 0);

  document.getElementById("summary-done").textContent = `${doneToday}/${habits.length}`;
  document.getElementById("summary-streak").textContent = String(maxStreak);
  document.getElementById("summary-total").textContent = String(total);
}

function renderHabitList() {
  const list = document.getElementById("habit-list");
  const empty = document.getElementById("empty-message");
  list.innerHTML = "";
  empty.classList.toggle("hidden", habits.length > 0);

  const today = todayStr();

  for (const habit of habits) {
    const card = document.createElement("article");
    card.className = "habit-card";
    card.style.setProperty("--habit-color", habit.color);

    const doneToday = habit.doneDates.includes(today);
    const streak = currentStreak(habit);

    const row = document.createElement("div");
    row.className = "habit-row";

    const emoji = document.createElement("span");
    emoji.className = "habit-emoji";
    emoji.textContent = habit.emoji;

    const info = document.createElement("div");
    info.className = "habit-info";
    info.title = "タップしてカレンダーを表示";
    const name = document.createElement("div");
    name.className = "habit-name";
    name.textContent = habit.name;
    const streakEl = document.createElement("div");
    streakEl.className = "habit-streak";
    streakEl.textContent = streak > 0 ? `🔥 ${streak}日連続` : "今日から始めよう";
    info.append(name, streakEl);
    info.addEventListener("click", () => openCalendar(habit.id));

    const check = document.createElement("button");
    check.type = "button";
    check.className = "check-btn" + (doneToday ? " done" : "");
    check.textContent = doneToday ? "✓" : "";
    check.setAttribute("aria-label", `${habit.name}を${doneToday ? "未達成に戻す" : "達成にする"}`);
    check.addEventListener("click", () => toggleToday(habit.id));

    row.append(emoji, info, check);
    card.append(row, buildWeekStrip(habit));
    list.append(card);
  }
}

// 直近7日の達成状況ストリップ
function buildWeekStrip(habit) {
  const strip = document.createElement("div");
  strip.className = "week-strip";
  const done = new Set(habit.doneDates);

  for (let i = 6; i >= 0; i--) {
    const d = addDays(new Date(), -i);
    const cell = document.createElement("div");
    cell.className = "week-day";
    const label = document.createElement("span");
    label.textContent = i === 0 ? "今日" : WEEKDAY_LABELS[d.getDay()];
    const dot = document.createElement("div");
    dot.className = "week-dot" + (done.has(dateToStr(d)) ? " done" : "");
    cell.append(label, dot);
    strip.append(cell);
  }
  return strip;
}

// ====== 操作 ======
function toggleToday(id) {
  const habit = getHabit(id);
  if (!habit) return;
  const today = todayStr();
  const idx = habit.doneDates.indexOf(today);
  if (idx >= 0) {
    habit.doneDates.splice(idx, 1);
  } else {
    habit.doneDates.push(today);
  }
  saveHabits();
  render();
}

// ====== 追加/編集ダイアログ ======
const habitDialog = document.getElementById("habit-dialog");
const habitForm = document.getElementById("habit-form");

function openHabitDialog(habit) {
  editingHabitId = habit ? habit.id : null;
  document.getElementById("dialog-title").textContent = habit ? "習慣を編集" : "習慣を追加";
  document.getElementById("habit-name").value = habit ? habit.name : "";
  buildPicker("emoji-picker", EMOJIS, habit ? habit.emoji : EMOJIS[0], "emoji-option", (el, v) => {
    el.textContent = v;
  });
  buildPicker("color-picker", COLORS, habit ? habit.color : COLORS[0], "color-option", (el, v) => {
    el.style.background = v;
  });
  habitDialog.classList.remove("hidden");
  document.getElementById("habit-name").focus();
}

function buildPicker(containerId, values, selected, className, decorate) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  for (const v of values) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = className + (v === selected ? " selected" : "");
    btn.dataset.value = v;
    btn.setAttribute("role", "radio");
    btn.setAttribute("aria-checked", String(v === selected));
    decorate(btn, v);
    btn.addEventListener("click", () => {
      for (const sib of container.children) {
        sib.classList.remove("selected");
        sib.setAttribute("aria-checked", "false");
      }
      btn.classList.add("selected");
      btn.setAttribute("aria-checked", "true");
    });
    container.append(btn);
  }
}

function pickedValue(containerId) {
  const el = document.querySelector(`#${containerId} .selected`);
  return el ? el.dataset.value : null;
}

habitForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("habit-name").value.trim();
  if (!name) return;
  const emoji = pickedValue("emoji-picker") || EMOJIS[0];
  const color = pickedValue("color-picker") || COLORS[0];

  if (editingHabitId) {
    const habit = getHabit(editingHabitId);
    if (habit) Object.assign(habit, { name, emoji, color });
  } else {
    habits.push({
      id: crypto.randomUUID(),
      name,
      emoji,
      color,
      createdAt: todayStr(),
      doneDates: [],
    });
  }
  saveHabits();
  habitDialog.classList.add("hidden");
  render();
});

document.getElementById("add-habit-btn").addEventListener("click", () => openHabitDialog(null));
document.getElementById("cancel-btn").addEventListener("click", () => habitDialog.classList.add("hidden"));

// ====== カレンダーダイアログ ======
const calendarDialog = document.getElementById("calendar-dialog");

function openCalendar(id) {
  calendarHabitId = id;
  const now = new Date();
  calendarMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  renderCalendar();
  calendarDialog.classList.remove("hidden");
}

function renderCalendar() {
  const habit = getHabit(calendarHabitId);
  if (!habit) return;

  const dialog = calendarDialog.querySelector(".dialog");
  dialog.style.setProperty("--habit-color", habit.color);

  const y = calendarMonth.getFullYear();
  const m = calendarMonth.getMonth();
  document.getElementById("calendar-title").textContent = `${habit.emoji} ${habit.name} — ${y}年${m + 1}月`;

  const grid = document.getElementById("calendar-grid");
  grid.innerHTML = "";

  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const done = new Set(habit.doneDates);
  const today = todayStr();
  let monthCount = 0;

  for (let i = 0; i < firstDay; i++) {
    grid.append(document.createElement("div"));
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dStr = dateToStr(new Date(y, m, day));
    const cell = document.createElement("div");
    cell.className = "cal-day";
    cell.textContent = String(day);
    if (done.has(dStr)) {
      cell.classList.add("done");
      monthCount++;
    }
    if (dStr === today) cell.classList.add("today");
    if (dStr > today) cell.classList.add("future");
    grid.append(cell);
  }

  document.getElementById("cal-streak").textContent = `🔥 現在 ${currentStreak(habit)}日連続（最長 ${bestStreak(habit)}日）`;
  document.getElementById("cal-month-count").textContent = `この月: ${monthCount}日達成`;
}

document.getElementById("cal-prev").addEventListener("click", () => {
  calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1);
  renderCalendar();
});

document.getElementById("cal-next").addEventListener("click", () => {
  calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
  renderCalendar();
});

document.getElementById("calendar-close-btn").addEventListener("click", () => {
  calendarDialog.classList.add("hidden");
});

document.getElementById("edit-habit-btn").addEventListener("click", () => {
  const habit = getHabit(calendarHabitId);
  calendarDialog.classList.add("hidden");
  if (habit) openHabitDialog(habit);
});

document.getElementById("delete-habit-btn").addEventListener("click", () => {
  const habit = getHabit(calendarHabitId);
  if (!habit) return;
  if (!confirm(`「${habit.name}」を削除しますか？記録もすべて消えます。`)) return;
  habits = habits.filter((h) => h.id !== calendarHabitId);
  saveHabits();
  calendarDialog.classList.add("hidden");
  render();
});

// オーバーレイの外側タップで閉じる
for (const overlay of [habitDialog, calendarDialog]) {
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.classList.add("hidden");
  });
}

// ====== 起動 ======
render();
