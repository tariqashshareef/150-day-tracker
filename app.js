"use strict";

window.__errors = [];
addEventListener("error", (e) => window.__errors.push(String(e.message)));
addEventListener("unhandledrejection", (e) => window.__errors.push(String(e.reason)));

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* ----------------------------------------------------------------- time */

const START = "2026-10-20";   // day 1; day 150 is 18 march 2027
const TOTAL = 150;
const ROLL_HOUR = 5;          // you sleep around 2am: until 5am it is still yesterday
const params = new URLSearchParams(location.search);
const SIM = /^\d{4}-\d{2}-\d{2}$/.test(params.get("today") || "") ? params.get("today") : null; // ?today=2026-11-12 pretends it is that day
const KEY = "d150.v1" + (SIM ? ".sim" : "");
const THEME_KEY = "d150.theme";

const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const utc = (s) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
const dayNo = (s) => Math.round((utc(s) - utc(START)) / 864e5) + 1;
const dateOf = (n) => { const [y, m, d] = START.split("-").map(Number); return ymd(new Date(y, m - 1, d + n - 1)); };
const END = dateOf(TOTAL);
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const todayStr = () => SIM || ymd(new Date(Date.now() - ROLL_HOUR * 36e5));

const MONTH_E = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MON3 = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_J = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];
const WEEK_J = ["日", "月", "火", "水", "木", "金", "土"];
const WEEK_E = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // monday first
const longDate = (s) => { const d = parse(s); return `${WEEK_E[d.getDay()]} ${d.getDate()} ${MON3[d.getMonth()]} ${d.getFullYear()}`; };
const shortDate = (s) => { const d = parse(s); return `${d.getDate()} ${MON3[d.getMonth()]}`; };

/* the day number, written as a number in kanji, and how it is read */
const DIG = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
const YOMI = ["", "いち", "に", "さん", "よん", "ご", "ろく", "なな", "はち", "きゅう"];
function numeral(n) {
  const h = Math.floor(n / 100), t = Math.floor((n % 100) / 10), o = n % 10;
  return (h ? (h > 1 ? DIG[h] : "") + "百" : "") + (t ? (t > 1 ? DIG[t] : "") + "十" : "") + DIG[o];
}
function numeralYomi(n) {
  const h = Math.floor(n / 100), t = Math.floor((n % 100) / 10), o = n % 10;
  return (h ? (h > 1 ? YOMI[h] : "") + "ひゃく" : "") + (t ? (t > 1 ? YOMI[t] : "") + "じゅう" : "") + YOMI[o];
}

let today = todayStr();

/* ----------------------------------------------------------------- the five parts of a day */

const has = (e, k) => e[k] !== undefined && e[k] !== null;
const DOMAINS = [
  { id: "data",  name: "data",     ch: "数", yomi: "すう",   keys: ["hours"],
    score: (e) => (e.hours > 0 ? 1 : 0) },
  { id: "gym",   name: "gym",      ch: "鍛", yomi: "たん",   keys: ["gym", "diet", "supps"],
    score: (e) => ((e.diet ? 1 : 0) + (e.supps ? 1 : 0)) / 2 },
  { id: "jp",    name: "japanese", ch: "語", yomi: "ご",     keys: ["anki", "lesson", "input", "output"],
    score: (e) => ((e.anki > 0 ? 1 : 0) + (e.lesson ? 1 : 0) + (e.input ? 1 : 0) + (e.output ? 1 : 0)) / 4 },
  { id: "piano", name: "piano",    ch: "音", yomi: "おと",   keys: ["piano"],
    score: (e) => (e.piano ? 1 : 0) },
  { id: "sleep", name: "sleep",    ch: "眠", yomi: "ねむり", keys: ["sleep"],
    score: (e) => (e.sleep ? 1 : 0) },
];

const FORM = [
  { d: "data", fields: [
    { k: "hours", t: "num", label: "hours spent", unit: "h", step: 0.5, max: 24, dec: true },
    { k: "topics", t: "text", label: "topics worked", ph: "what did you work on?" },
  ] },
  { d: "gym", fields: [
    { k: "gym", t: "pick", label: "session today", opts: [["push", "push"], ["pull", "pull"], ["legs", "legs+abs"], ["rest", "rest"]] },
    { k: "diet", t: "yn", label: "adhered to diet" },
    { k: "supps", t: "yn", label: "adhered to supplements" },
  ] },
  { d: "jp", fields: [
    { k: "anki", t: "num", label: "anki, words studied", unit: "", step: 5, max: 9999, dec: false },
    { k: "lesson", t: "yn", label: "lesson today" },
    { k: "input", t: "yn", label: "input today" },
    { k: "output", t: "yn", label: "output today" },
  ] },
  { d: "piano", fields: [
    { k: "piano", t: "yn", label: "session today" },
    { k: "pianoNote", t: "text", label: "worked on", ph: "pieces, passages, technique" },
  ] },
  { d: "sleep", fields: [
    { k: "sleep", t: "yn", label: "ready to sleep by 2am" },
  ] },
];
const FIELD = Object.fromEntries(FORM.flatMap((s) => s.fields).map((f) => [f.k, f]));

/* how far one part of one day got: none, part (some answered), or all answered and then high / mid / low */
function dstate(e, d) {
  const answered = d.keys.filter((k) => has(e, k)).length;
  const complete = answered === d.keys.length;
  let tone = "none", score = null;
  if (complete) { score = d.score(e); tone = score >= 1 ? "high" : score >= 0.5 ? "mid" : "low"; }
  else if (answered) tone = "part";
  return { answered, total: d.keys.length, complete, tone, score };
}

function statusOf(date) {
  const e = db.entries[date] || {};
  const per = DOMAINS.map((d) => dstate(e, d));
  return { per, complete: per.every((p) => p.complete), touched: per.some((p) => p.answered > 0) };
}

/* ----------------------------------------------------------------- storage: this phone only */

function loadDb() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const o = JSON.parse(raw); if (o && typeof o.entries === "object" && o.entries) return o; }
  } catch (e) { /* unreadable: start clean */ }
  return { v: 1, entries: {}, exported: null };
}
let db = loadDb();
let saveTimer = 0, dirty = false;

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); return true; } catch (e) { return false; }
}
function setStatus(level, text) {
  const s = $("#saveStatus");
  s.dataset.level = level;
  $("span", s).textContent = text;
}
function flush() {
  clearTimeout(saveTimer);
  if (!dirty) return;
  dirty = false;
  const ok = persist();
  setStatus(ok ? "ok" : "error", ok ? "saved" : "can't save here");
}
function queueSave() {
  dirty = true;
  setStatus("busy", "saving");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 350);
}
addEventListener("pagehide", flush);

/* ----------------------------------------------------------------- state */

const state = { sel: null, focus: null };
const cells = new Map();     // date -> button in the months
const fieldEls = new Map();  // key -> field element in the form
let secEls = [];

const wide = () => matchMedia("(min-width: 1121px)").matches;
const editable = (date) => date <= today;

/* ----------------------------------------------------------------- theme */

const isDark = () => document.documentElement.dataset.theme === "dark";
function setTheme(theme, remember = true) {
  document.documentElement.dataset.theme = theme === "dark" ? "dark" : "light";
  if (remember) { try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* private window: just don't remember */ } }
  const bar = $('meta[name="theme-color"]');
  if (bar) bar.setAttribute("content", isDark() ? "#121214" : "#f4ede0");
  $$(".mode").forEach((b) => { b.title = isDark() ? "back to daylight" : "night mode"; });
}
$$(".mode").forEach((b) => b.addEventListener("click", () => setTheme(isDark() ? "light" : "dark")));

/* ----------------------------------------------------------------- the months */

const jitter = (n, k) => ((n * 31 + k * 17) % 5) - 2; // a hand never draws five strokes the same height

function buildMonths() {
  const first = parse(START), last = parse(END);
  let y = first.getFullYear(), m = first.getMonth();
  let html = "";
  for (;;) {
    const dim = new Date(y, m + 1, 0).getDate();
    const from = y === first.getFullYear() && m === first.getMonth() ? first.getDate() : 1;
    const to = y === last.getFullYear() && m === last.getMonth() ? last.getDate() : dim;
    const lead = (new Date(y, m, from).getDay() + 6) % 7;
    let body = "";
    for (let i = 0; i < lead; i++) body += `<span class="cell blank"></span>`;
    for (let d = from; d <= to; d++) {
      const date = `${y}-${pad(m + 1)}-${pad(d)}`, n = dayNo(date);
      const ticks = DOMAINS.map((dm, k) => `<i data-d="${dm.id}" data-t="none" style="--j:${jitter(n, k)}"></i>`).join("");
      body += `<button class="cell" type="button" data-date="${date}" aria-label="day ${n}, ${longDate(date)}"><span class="dn">${d}</span><span class="ticks">${ticks}</span></button>`;
    }
    html += `<section class="month"><h3><span class="mj">${MONTH_J[m]}</span><span class="me">${MONTH_E[m]} ${y}</span></h3>` +
      `<div class="wk">${WEEK_ORDER.map((i) => `<span>${WEEK_J[i]}</span>`).join("")}</div><div class="grid">${body}</div></section>`;
    if (y === last.getFullYear() && m === last.getMonth()) break;
    if (++m > 11) { m = 0; y++; }
  }
  $("#months").innerHTML = html;
  $$(".cell[data-date]").forEach((c) => cells.set(c.dataset.date, c));
}

function paintCell(date) {
  const el = cells.get(date);
  if (!el) return;
  const st = statusOf(date);
  const ticks = $$(".ticks i", el);
  st.per.forEach((p, k) => { ticks[k].dataset.t = p.tone; });
  el.classList.toggle("today", date === today);
  el.classList.toggle("future", date > today);
  el.classList.toggle("sel", date === state.sel);
}
const paintAllCells = () => cells.forEach((_, date) => paintCell(date));

$("#months").addEventListener("click", (e) => {
  const cell = e.target.closest(".cell[data-date]");
  if (!cell) return;
  selectDay(cell.dataset.date);
  openDayPage();
});

/* ----------------------------------------------------------------- the overview numbers */

const fmtH = (x) => String(Math.round(x * 10) / 10);
const compact = (n) => (n >= 10000 ? Math.round(n / 1000) + "k" : n >= 1000 ? String(Math.round(n / 100) / 10).replace(/\.0$/, "") + "k" : String(n));
const pct = ([y, n]) => (n ? `${Math.round((100 * y) / n)}%` : "–");
const tally = (arr, v) => { if (v === undefined || v === null) return; arr[1]++; if (v) arr[0]++; };

function words(text) { return (text || "").split(/[,;\n]+/).map((t) => t.trim().toLowerCase()).filter((t) => t && t.length <= 40); }
function bump(map, text) { for (const w of words(text)) map.set(w, (map.get(w) || 0) + 1); }
const mostUsed = (map, n) => [...map].sort((a, b) => b[1] - a[1]).slice(0, n).map(([w]) => w);

function aggregate() {
  const tn = dayNo(today), last = clamp(tn, 0, TOTAL);
  const a = {
    tn, last, complete: 0, part: 0, missed: 0, upcoming: 0,
    hours: 0, hoursDays: 0, bestHours: 0,
    gym: { push: 0, pull: 0, legs: 0, rest: 0 }, diet: [0, 0], supps: [0, 0],
    anki: 0, ankiDays: 0, bestAnki: 0, lesson: [0, 0], input: [0, 0], output: [0, 0],
    piano: [0, 0], sleep: [0, 0], topics: new Map(), pieces: new Map(), streak: 0, best: 0,
  };
  const flags = [];
  for (let n = 1; n <= TOTAL; n++) {
    if (n > last) { a.upcoming++; continue; }
    const date = dateOf(n), e = db.entries[date] || {}, st = statusOf(date);
    flags.push(st.complete);
    if (st.complete) a.complete++;
    else if (st.touched) a.part++;
    else if (n < tn) a.missed++;
    else a.upcoming++;
    if (has(e, "hours")) { a.hours += e.hours; if (e.hours > 0) a.hoursDays++; a.bestHours = Math.max(a.bestHours, e.hours); }
    if (e.gym) a.gym[e.gym]++;
    tally(a.diet, e.diet); tally(a.supps, e.supps);
    if (has(e, "anki")) { a.anki += e.anki; if (e.anki > 0) a.ankiDays++; a.bestAnki = Math.max(a.bestAnki, e.anki); }
    tally(a.lesson, e.lesson); tally(a.input, e.input); tally(a.output, e.output);
    tally(a.piano, e.piano); tally(a.sleep, e.sleep);
    bump(a.topics, e.topics); bump(a.pieces, e.pianoNote);
  }
  let i = flags.length - 1;
  if (tn >= 1 && tn <= TOTAL && !flags[i]) i--;  // today isn't over: it can't break the run yet
  while (i >= 0 && flags[i]) { a.streak++; i--; }
  let cur = 0;
  for (const f of flags) { cur = f ? cur + 1 : 0; a.best = Math.max(a.best, cur); }
  return a;
}

function factRows(a, focus) {
  const of = ([y, n]) => (n ? `${y} <small>of ${n}</small>` : "–");
  const days = (n) => `${n} <small>${n === 1 ? "day" : "days"}</small>`;
  const list = (map) => { const t = mostUsed(map, 3); return t.length ? esc(t.join(", ")) : "–"; };
  switch (focus) {
    case "data": return [
      ["total", `${fmtH(a.hours)} <small>hours</small>`],
      ["days worked", `${a.hoursDays} <small>of ${a.last}</small>`],
      ["average, on days worked", a.hoursDays ? `${fmtH(a.hours / a.hoursDays)} <small>hours</small>` : "–"],
      ["longest day", a.bestHours ? `${fmtH(a.bestHours)} <small>hours</small>` : "–"],
      ["most worked on", list(a.topics)],
    ];
    case "gym": {
      const g = a.gym, lifts = g.push + g.pull + g.legs;
      return [
        ["lifting days", days(lifts)],
        ["push · pull · legs+abs", `${g.push} · ${g.pull} · ${g.legs}`],
        ["rest days", days(g.rest)],
        ["diet", `${pct(a.diet)} <small>${a.diet[1] ? `· ${a.diet[0]} of ${a.diet[1]}` : ""}</small>`],
        ["supplements", `${pct(a.supps)} <small>${a.supps[1] ? `· ${a.supps[0]} of ${a.supps[1]}` : ""}</small>`],
      ];
    }
    case "jp": return [
      ["words studied", `${a.anki.toLocaleString("en-US")}`],
      ["days on anki", `${a.ankiDays} <small>of ${a.last}</small>`],
      ["average, on days studied", a.ankiDays ? `${Math.round(a.anki / a.ankiDays)} <small>words</small>` : "–"],
      ["best day", a.bestAnki ? `${a.bestAnki} <small>words</small>` : "–"],
      ["lesson", `${pct(a.lesson)} <small>of days</small>`],
      ["input", `${pct(a.input)} <small>of days</small>`],
      ["output", `${pct(a.output)} <small>of days</small>`],
    ];
    case "piano": return [
      ["days played", of(a.piano)],
      ["share of days", pct(a.piano)],
      ["most worked on", list(a.pieces)],
    ];
    case "sleep": return [
      ["ready by 2am", of(a.sleep)],
      ["share of nights", pct(a.sleep)],
    ];
    default: return [
      ["days complete", a.last ? `${a.complete} <small>of ${a.last}</small>` : "–"],
      ["partly logged", days(a.part)],
      ["nothing logged", days(a.missed)],
      ["streak", `${days(a.streak)} <small>· best ${a.best}</small>`],
      ["ends", longDate(END)],
    ];
  }
}

function paintFacts(animate) {
  const a = aggregate();
  const d = DOMAINS.find((x) => x.id === state.focus);
  $("#factsLabel").textContent = d ? d.name : "overall";
  const box = $("#facts");
  if (animate) box.dataset.anim = "1"; else delete box.dataset.anim;
  box.innerHTML = factRows(a, state.focus).map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
}

const shown = new WeakMap();
function setNum(el, to) {
  const from = shown.get(el);
  shown.set(el, to);
  if (from === undefined || from === to || matchMedia("(prefers-reduced-motion: reduce)").matches) { el.textContent = to; return; }
  cancelAnimationFrame(el._raf);
  const started = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - started) / 1100);
    el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
    if (k < 1) el._raf = requestAnimationFrame(step);
  };
  el._raf = requestAnimationFrame(step);
}

let ensoLen = 0;
function paintSummary() {
  const a = aggregate();
  ensoLen = ensoLen || $("#ensoArc").getTotalLength();
  const arc = (frac) => ensoLen * (0.04 + 0.92 * frac);   // the circle is never quite closed, like an enso
  // the gap stays 1000 (more than the whole circle) so the dash grows without ever splitting into dots mid-transition
  $("#ensoArc").style.strokeDasharray = `${a.complete ? arc(a.complete / TOTAL) : 0}px 1000px`;
  $("#ensoTime").style.strokeDasharray = `${a.last ? arc(a.last / TOTAL) : 0}px 1000px`;
  $("#enso").toggleAttribute("data-empty", !a.complete);
  setNum($("#ensoNum"), a.complete);

  if (a.tn < 1) {
    $("#verdictLabel").textContent = "begins";
    $("#verdict").textContent = a.tn === 0 ? "tomorrow" : `in ${1 - a.tn} days`;
    $("#subline").textContent = longDate(START);
  } else if (a.tn > TOTAL) {
    $("#verdictLabel").textContent = "finished";
    $("#verdict").textContent = `${a.complete} of ${TOTAL}`;
    $("#subline").textContent = "days complete";
  } else {
    $("#verdictLabel").textContent = "today";
    $("#verdict").textContent = `day ${a.tn}`;
    $("#subline").textContent = `${a.complete} complete · ${a.tn === TOTAL ? "last day" : `${TOTAL - a.tn} left`}`;
  }

  const nums = {
    data: a.hours >= 100 ? String(Math.round(a.hours)) : fmtH(a.hours),
    gym: String(a.gym.push + a.gym.pull + a.gym.legs),
    jp: compact(a.anki),
    piano: String(a.piano[0]),
    sleep: String(a.sleep[0]),
  };
  $$(".stat").forEach((s) => { $(".n", s).textContent = nums[s.dataset.focus]; });

  const seg = { high: a.complete, mid: a.part, low: a.missed, unknown: a.upcoming };
  const label = { high: "complete", mid: "partly logged", low: "nothing logged", unknown: "still to come" };
  for (const t of Object.keys(seg)) { const el = $(`#coverage [data-tone="${t}"]`); el.style.flexGrow = seg[t]; el.title = `${seg[t]} ${label[t]}`; }

  paintFacts(false);
  paintBackupNudge();
}
let summaryTimer = 0;
const queueSummary = () => { clearTimeout(summaryTimer); summaryTimer = setTimeout(paintSummary, 160); };

$("#stats").addEventListener("click", (e) => {
  const b = e.target.closest(".stat");
  if (!b) return;
  state.focus = state.focus === b.dataset.focus ? null : b.dataset.focus;
  applyFocus(true);
});
function applyFocus(animate) {
  $$(".stat").forEach((s) => s.classList.toggle("on", s.dataset.focus === state.focus));
  const m = $("#months");
  if (state.focus) m.dataset.focus = state.focus; else delete m.dataset.focus;
  paintFacts(animate);
}

/* ----------------------------------------------------------------- the day form */

function strokeSvg(ch, i) {
  const list = (window.STROKES || {})[ch];
  if (!list) return `<text x="54" y="82" text-anchor="middle" style="--d:0s">${esc(ch)}</text>`;
  const per = Math.min(0.32, Math.max(0.1, 1.9 / list.length)), step = per * 0.85;
  return list.map((d, k) => `<path d="${d}" style="--d:${(0.15 + k * step).toFixed(2)}s;--t:${per.toFixed(2)}s"/>`).join("");
}

function fieldHTML(f) {
  const id = `f-${f.k}`;
  switch (f.t) {
    case "num": return `<div class="fld row" data-k="${f.k}" data-t="num"><label class="fl" for="${id}">${f.label}</label>` +
      `<div class="stepper"><button class="step" type="button" data-dir="-1" aria-label="less"><svg viewBox="0 0 24 24"><path d="M6 12h12"/></svg></button>` +
      `<input class="num" id="${id}" type="text" inputmode="${f.dec ? "decimal" : "numeric"}" autocomplete="off" placeholder="–">` +
      `<button class="step" type="button" data-dir="1" aria-label="more"><svg viewBox="0 0 24 24"><path d="M12 6v12M6 12h12"/></svg></button>` +
      `<span class="unit">${f.unit || ""}</span></div></div>`;
    case "pick": return `<div class="fld stack" data-k="${f.k}" data-t="pick"><span class="fl">${f.label}</span><div class="chips" role="group" aria-label="${f.label}">` +
      f.opts.map(([v, l]) => `<button class="chip" type="button" data-v="${v}" aria-pressed="false">${l}</button>`).join("") + `</div></div>`;
    case "yn": return `<div class="fld row" data-k="${f.k}" data-t="yn"><span class="fl">${f.label}</span><div class="chips" role="group" aria-label="${f.label}">` +
      `<button class="chip" type="button" data-v="yes" aria-pressed="false">yes</button><button class="chip" type="button" data-v="no" aria-pressed="false">no</button></div></div>`;
    default: return `<div class="fld stack" data-k="${f.k}" data-t="text"><label class="fl" for="${id}">${f.label}</label>` +
      `<textarea class="ruled" id="${id}" rows="2" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="${esc(f.ph)}"></textarea><div class="sugg"></div></div>`;
  }
}

function buildForm() {
  $("#form").innerHTML = FORM.map((sec) => {
    const d = DOMAINS.find((x) => x.id === sec.d);
    return `<section class="sec" data-d="${d.id}" data-state="none"><div class="sec-head">` +
      `<svg class="sec-kanji" viewBox="0 0 109 109" aria-hidden="true"><g class="ink">${strokeSvg(d.ch)}</g></svg>` +
      `<div class="sec-title"><span class="label">${d.name}</span><span class="yomi">${d.yomi}</span></div><span class="sec-prog"></span></div>` +
      sec.fields.map(fieldHTML).join("") + `</section>`;
  }).join("");
  secEls = $$(".sec", $("#form"));
  $$(".fld", $("#form")).forEach((el) => fieldEls.set(el.dataset.k, el));
  // each stroke's dash is its own length, so the animation draws it from end to end
  $$(".sec-kanji path").forEach((p) => p.style.setProperty("--L", p.getTotalLength().toFixed(1)));

  // the kanji for each part is brushed in the first time it comes into view
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((list) => list.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
    }), { root: $("#dayScroll"), threshold: 0.3 });
    secEls.forEach((s) => io.observe(s));
  } else secEls.forEach((s) => s.classList.add("in"));
}

const entry = () => db.entries[state.sel] || {};

function setVal(k, v) {
  const date = state.sel;
  if (!editable(date)) return;
  const e = db.entries[date] || (db.entries[date] = {});
  if (v === null || v === undefined || v === "") delete e[k]; else e[k] = v;
  if (!Object.keys(e).length) delete db.entries[date];
  queueSave();
  afterEdit();
}

function afterEdit() {
  const { complete, was } = paintSections();
  if (complete && !was) stampIn();
  paintCell(state.sel);
  queueSummary();
}

function paintSections() {
  const st = statusOf(state.sel);
  DOMAINS.forEach((d, i) => {
    const sec = secEls[i], p = st.per[i];
    sec.dataset.state = p.complete ? "done" : p.answered ? "part" : "none";
    $(".sec-prog", sec).textContent = p.complete ? "logged" : p.total > 1 && p.answered ? `${p.answered} / ${p.total}` : "";
  });
  const was = document.body.classList.contains("complete");
  document.body.classList.toggle("complete", st.complete);
  return { complete: st.complete, was };
}

function stampIn() {
  document.body.classList.remove("stamping");
  void document.body.offsetWidth; // restart the stamp animation
  document.body.classList.add("stamping");
}

const matchChip = (val, v) => (v === "yes" ? val === true : v === "no" ? val === false : val === v);
const autosize = (ta) => { ta.style.height = "auto"; ta.style.height = Math.max(2, Math.ceil(ta.scrollHeight / 34)) * 34 + "px"; };

function suggestions(key, current) {
  const counts = new Map();
  for (const [date, e] of Object.entries(db.entries)) if (date !== state.sel) bump(counts, e[key]);
  const have = new Set(words(current));
  return [...counts].filter(([w]) => !have.has(w)).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([w]) => w);
}
function paintSugg(k) {
  const el = fieldEls.get(k), box = $(".sugg", el), ta = $("textarea", el);
  box.innerHTML = suggestions(k, ta.value).map((w) => `<button type="button" data-s="${esc(w)}">${esc(w)}</button>`).join("");
}

function paintFields() {
  const e = entry();
  for (const [k, el] of fieldEls) {
    const t = el.dataset.t;
    if (t === "num") {
      const inp = $("input", el);
      if (document.activeElement !== inp) inp.value = has(e, k) ? String(e[k]) : "";
    } else if (t === "text") {
      const ta = $("textarea", el);
      if (document.activeElement !== ta) { ta.value = e[k] || ""; autosize(ta); }
      paintSugg(k);
    } else {
      $$(".chip", el).forEach((c) => c.setAttribute("aria-pressed", String(matchChip(e[k], c.dataset.v))));
    }
  }
  const locked = !editable(state.sel);
  $("#form").toggleAttribute("data-locked", locked);
  $$("input, textarea, button", $("#form")).forEach((x) => { x.disabled = locked; });
  $("#dayNote").textContent = locked ? "this day hasn't come yet." : "";
}

function parseNum(raw, f) {
  const s = raw.replace(",", ".").replace(/[^0-9.]/g, "");
  if (s === "" || s === ".") return null;
  const x = parseFloat(s);
  if (isNaN(x)) return null;
  return clamp(f.dec ? Math.round(x * 100) / 100 : Math.round(x), 0, f.max);
}

const form = $("#form");
form.addEventListener("click", (e) => {
  const fld = e.target.closest(".fld");
  if (!fld) return;
  const k = fld.dataset.k, f = FIELD[k];
  const chip = e.target.closest(".chip");
  if (chip) {
    const v = chip.dataset.v, cur = entry()[k];
    const already = matchChip(cur, v);
    setVal(k, already ? null : v === "yes" ? true : v === "no" ? false : v);   // tap again to clear
    $$(".chip", fld).forEach((c) => c.setAttribute("aria-pressed", String(matchChip(entry()[k], c.dataset.v))));
    return;
  }
  const step = e.target.closest(".step");
  if (step) {
    const cur = entry()[k], dir = Number(step.dataset.dir);
    const v = clamp(Math.round(((cur || 0) + dir * f.step) * 100) / 100, 0, f.max);
    setVal(k, v);
    $("input", fld).value = String(v);
    return;
  }
  const sg = e.target.closest(".sugg button");
  if (sg) {
    const ta = $("textarea", fld), base = ta.value.replace(/[\s,;]+$/, "");
    ta.value = base ? `${base}, ${sg.dataset.s}` : sg.dataset.s;
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    paintSugg(k);
  }
});
form.addEventListener("input", (e) => {
  const fld = e.target.closest(".fld");
  if (!fld) return;
  const k = fld.dataset.k;
  if (e.target.matches(".num")) setVal(k, parseNum(e.target.value, FIELD[k]));
  else if (e.target.matches("textarea")) { setVal(k, e.target.value.replace(/\s+$/, "")); autosize(e.target); }
});
form.addEventListener("focusout", (e) => {
  const fld = e.target.closest(".fld");
  if (!fld) return;
  const k = fld.dataset.k;
  if (e.target.matches(".num")) e.target.value = has(entry(), k) ? String(entry()[k]) : "";
  else if (e.target.matches("textarea")) paintSugg(k);
});
form.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.matches(".num")) e.target.blur(); });

/* ----------------------------------------------------------------- the day page */

/* the day number, drawn one stroke at a time from KanjiVG stroke-order data */
function drawHero() {
  const n = dayNo(state.sel), chars = [...numeral(n)];
  const hero = $("#hero"), cell = 109;
  const room = (hero.clientWidth || 320) - (innerWidth <= 600 ? 76 : 0); // on a phone, leave the stamp its corner
  const size = Math.max(56, Math.min(hero.clientHeight || 172, Math.floor(room / chars.length)));
  const lists = chars.map((ch) => (window.STROKES || {})[ch] || null);
  const total = lists.reduce((sum, l) => sum + (l ? l.length : 1), 0);
  const per = Math.min(0.5, Math.max(0.2, 2.6 / total)), step = per * 0.85;
  let k = 0, body = "";
  chars.forEach((ch, i) => {
    if (!lists[i]) { body += `<text x="${i * cell + cell / 2}" y="86" text-anchor="middle" style="--d:${(k++ * step).toFixed(2)}s">${esc(ch)}</text>`; return; }
    for (const d of lists[i]) body += `<path d="${d}" transform="translate(${i * cell} 0)" style="--d:${(k++ * step).toFixed(2)}s;--t:${per.toFixed(2)}s"/>`;
  });
  hero.innerHTML = `<svg viewBox="0 0 ${chars.length * cell} ${cell}" width="${chars.length * size}" height="${size}" role="img" aria-label="day ${n}"><g class="ink">${body}</g></svg>`;
  $$("#hero path").forEach((p) => p.style.setProperty("--L", p.getTotalLength().toFixed(1)));
  $("#furi").innerHTML = `<span>${numeralYomi(n)}</span><span class="fn">day ${n} of ${TOTAL}</span>`;
  document.body.classList.remove("stamping");
  if (statusOf(state.sel).complete) stampIn();
}
$("#replay").addEventListener("click", drawHero);

function paintDay() {
  const date = state.sel, n = dayNo(date), d = parse(date);
  const ahead = Math.round((utc(date) - utc(today)) / 864e5);
  const rel = ahead === 1 ? " · tomorrow" : ahead > 1 ? ` · in ${ahead} days` : "";
  $("#dateLine").innerHTML = `<span class="wj">${WEEK_J[d.getDay()]}</span>${longDate(date)}${rel}`;
  $("#prevDay").disabled = n <= 1;
  $("#nextDay").disabled = n >= TOTAL;
  paintFields();
  paintSections();
  drawHero();
}

function selectDay(date) {
  state.sel = date;
  $$(".cell.sel").forEach((c) => c.classList.remove("sel"));
  const c = cells.get(date);
  if (c) c.classList.add("sel");
  paintDay();
  $("#dayScroll").scrollTop = 0;
}
function stepDay(by) {
  const n = dayNo(state.sel) + by;
  if (n >= 1 && n <= TOTAL) selectDay(dateOf(n));
}
$("#prevDay").addEventListener("click", () => stepDay(-1));
$("#nextDay").addEventListener("click", () => stepDay(1));

/* on a phone the day is a page laid over the days; the phone's own back gesture closes it */
function openDayPage() {
  if (wide() || document.body.classList.contains("has-day")) return;
  document.body.classList.add("has-day");
  history.pushState({ day: true }, "");
}
function closeDayPage() {
  if (wide()) return;
  document.body.classList.remove("has-day");
}
$("#toDays").addEventListener("click", () => {
  if (history.state && history.state.day) {
    history.back();
    setTimeout(() => { if (document.body.classList.contains("has-day")) closeDayPage(); }, 250); // if nothing handled it
  } else closeDayPage();
});
addEventListener("popstate", () => { if (!wide()) closeDayPage(); });

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { closeBackup(); return; }
  if (e.target.closest("input, textarea") || !$("#backupSheet").hidden) return;
  if (e.key === "ArrowLeft") stepDay(-1);
  else if (e.key === "ArrowRight") stepDay(1);
});

let resizeTimer = 0;
addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => state.sel && drawHero(), 250); });

/* the day rolls over at 5am; coming back to the app the next morning should land on the new day */
function refreshToday() {
  const t = todayStr();
  if (t === today) return;
  const old = today, followed = state.sel === old;
  today = t;
  paintCell(old); paintCell(t);
  paintSummary();
  if (followed && dayNo(t) >= 1 && dayNo(t) <= TOTAL) selectDay(t); else paintFields();
}
document.addEventListener("visibilitychange", () => { if (document.hidden) flush(); else refreshToday(); });

/* ----------------------------------------------------------------- backup */

const needsBackup = () => Object.keys(db.entries).length >= 5 && (!db.exported || Date.now() - Date.parse(db.exported) > 14 * 864e5);
function paintBackupNudge() { $("#backupBtn").classList.toggle("nudge", needsBackup()); }
function backupInfo() {
  const n = Object.keys(db.entries).length;
  $("#backupInfo").textContent = `${n} ${n === 1 ? "day" : "days"} logged · last export ${db.exported ? shortDate(ymd(new Date(db.exported))) : "never"}`;
}
function openBackup() { backupInfo(); $("#backupMsg").textContent = ""; $("#backupSheet").hidden = false; }
function closeBackup() { $("#backupSheet").hidden = true; }
$("#backupBtn").addEventListener("click", openBackup);
$("#backupClose").addEventListener("click", closeBackup);
$("#backupSheet").addEventListener("click", (e) => { if (e.target.id === "backupSheet") closeBackup(); });

$("#exportBtn").addEventListener("click", async () => {
  const name = `150-days-${today}.json`;
  const blob = new Blob([JSON.stringify(db, null, 1)], { type: "application/json" });
  const file = new File([blob], name, { type: "application/json" });
  const msg = $("#backupMsg");
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: "150 days" });
    else {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = name;
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }
    db.exported = new Date().toISOString();
    persist(); backupInfo(); paintBackupNudge();
    msg.textContent = "exported.";
  } catch (err) {
    msg.textContent = err && err.name === "AbortError" ? "" : "couldn't export here.";
  }
});

/* a backup file is only trusted for what this app writes */
function clean(e) {
  const out = {};
  if (typeof e.hours === "number" && isFinite(e.hours)) out.hours = clamp(e.hours, 0, 24);
  if (typeof e.anki === "number" && isFinite(e.anki)) out.anki = clamp(Math.round(e.anki), 0, 9999);
  for (const k of ["diet", "supps", "lesson", "input", "output", "piano", "sleep"]) if (typeof e[k] === "boolean") out[k] = e[k];
  if (["push", "pull", "legs", "rest"].includes(e.gym)) out.gym = e.gym;
  for (const k of ["topics", "pianoNote"]) if (typeof e[k] === "string" && e[k].trim()) out[k] = e[k].slice(0, 2000);
  return out;
}
$("#importFile").addEventListener("change", async (ev) => {
  const file = ev.target.files[0], msg = $("#backupMsg");
  ev.target.value = "";
  if (!file) return;
  try {
    const o = JSON.parse(await file.text());
    if (!o || typeof o.entries !== "object" || !o.entries) throw new Error("not a backup");
    let n = 0;
    for (const [date, e] of Object.entries(o.entries)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const num = dayNo(date);
      if (num < 1 || num > TOTAL || !e || typeof e !== "object") continue;
      const c = clean(e);
      if (Object.keys(c).length) { db.entries[date] = c; n++; }
    }
    persist(); paintAllCells(); paintSummary(); paintDay(); backupInfo();
    msg.textContent = `restored ${n} ${n === 1 ? "day" : "days"}.`;
  } catch (err) {
    msg.textContent = "that isn't a 150 days backup.";
  }
});

/* ----------------------------------------------------------------- start */

function boot() {
  setTheme(isDark() ? "dark" : "light", false);
  // does the page run under the phone's status bar? only then does it need the wash behind the bar's text
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top,0px)";
  document.body.append(probe);
  if (parseFloat(getComputedStyle(probe).paddingTop) > 0) document.documentElement.classList.add("under-bar");
  probe.remove();
  buildMonths();
  buildForm();
  const n = clamp(dayNo(today), 1, TOTAL);
  state.sel = dateOf(n);
  paintAllCells();
  applyFocus(false);
  paintSummary();
  selectDay(state.sel);
  // transitions start only now, so the page doesn't slide in on launch
  requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.add("ready")));
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if (!persist()) setStatus("error", "can't save here");
  else setStatus("ok", "saved");
}
boot();

if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
  addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => { /* no offline cache; the app still works online */ }));
}
