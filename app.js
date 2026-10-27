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
    tone: (e) => (e.hours >= 5 ? "high" : e.hours > 0 ? "mid" : "low") },
  { id: "gym",   name: "gym",      ch: "鍛", yomi: "たん",   keys: ["gym", "diet", "supps"],
    tone: (e) => { const n = 1 + (e.diet ? 1 : 0) + (e.supps ? 1 : 0); return n === 3 ? "high" : "mid"; } },   // any session counts, rest included
  { id: "jp",    name: "japanese", ch: "語", yomi: "ご",     keys: ["anki", "lesson", "io"],
    tone: (e) => { const n = (e.anki > 0 ? 1 : 0) + (e.lesson ? 1 : 0) + (e.io ? 1 : 0); return n === 0 ? "low" : n === 3 && e.anki >= 50 ? "high" : "mid"; } },
  { id: "piano", name: "piano",    ch: "音", yomi: "おと",   keys: ["piano"],
    tone: (e) => (e.piano ? "high" : "low") },
  { id: "sleep", name: "sleep",    ch: "眠", yomi: "ねむり", keys: ["sleep"],
    tone: (e) => (e.sleep ? "high" : "low") },
];

const FORM = [
  { d: "data", fields: [
    { k: "hours", t: "num", label: "hours spent?", unit: "h", step: 0.5, max: 24, dec: true },
    { k: "topics", t: "text", label: "worked on?", ph: "projects, resume, certs, apps..." },
  ] },
  { d: "gym", fields: [
    { k: "gym", t: "pick", label: "session today?", opts: [["push", "push"], ["pull", "pull"], ["legs", "legs+abs"], ["rest", "rest"]] },
    { k: "diet", t: "yn", label: "adhered to diet?" },
    { k: "supps", t: "yn", label: "adhered to supplements?" },
  ] },
  { d: "jp", fields: [
    { k: "anki", t: "num", label: "anki vocab studied?", unit: "", step: 10, max: 9999, dec: false },
    { k: "lesson", t: "yn", label: "lesson today?" },
    { k: "io", t: "yn", label: "input/output today?" },
    { k: "jpNote", t: "text", label: "studied?", ph: "phonetics, anime..." },
  ] },
  { d: "piano", fields: [
    { k: "piano", t: "yn", label: "session today?" },
    { k: "pianoNote", t: "text", label: "worked on?", ph: "music theory, sight-reading, practice..." },
  ] },
  { d: "sleep", fields: [
    { k: "sleep", t: "yn", label: "ready to sleep by 2am?" },
  ] },
];
const FIELD = Object.fromEntries(FORM.flatMap((s) => s.fields).map((f) => [f.k, f]));

/* how far one part of one day got: none, part (some answered), or all answered and then high / mid / low */
function dstate(e, d) {
  const answered = d.keys.filter((k) => has(e, k)).length;
  const complete = answered === d.keys.length;
  let tone = "none";
  if (complete) tone = d.tone(e);   // high, mid, or low (nothing)
  else if (answered) tone = "part";
  return { answered, total: d.keys.length, complete, tone };
}

function statusOf(date) {
  const e = db.entries[date] || {};
  const per = DOMAINS.map((d) => dstate(e, d));
  return { per, complete: per.every((p) => p.complete), touched: per.some((p) => p.answered > 0) };
}

/* ----------------------------------------------------------------- storage: this phone only */

/* input and output used to be two questions; they are one now */
function migrate(o) {
  for (const e of Object.values(o.entries)) {
    if (!e || typeof e !== "object" || !("input" in e || "output" in e)) continue;
    if (!("io" in e) && (typeof e.input === "boolean" || typeof e.output === "boolean")) e.io = !!(e.input || e.output);
    delete e.input; delete e.output;
  }
  // v2, the day test mode went away: the first launch clears every day logged ahead of its time. only test mode allowed that,
  // so real days are never touched (they are all today or earlier), and it runs once.
  if (!(o.v >= 2)) {
    let dropped = 0;
    for (const date of Object.keys(o.entries)) if (date > today) { delete o.entries[date]; dropped++; }
    if (dropped) o.exported = null;
    o.v = 2;
  }
  return o;
}
function loadDb() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const o = JSON.parse(raw); if (o && typeof o.entries === "object" && o.entries) return migrate(o); }
  } catch (e) { /* unreadable: start clean */ }
  return { v: 2, entries: {}, exported: null };
}
let db = loadDb();
let saveTimer = 0, dirty = false;

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { return false; }
  queueCopy();
  return true;
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
addEventListener("pagehide", () => { flush(); writeCopy(); });

/* the native app also keeps a copy of the log as a plain file in its Documents folder after every change. with file sharing on
   (ios-native/prepare.sh) that folder shows in Files > On My iPhone > 150 days. it covers the web storage being cleared, it is
   a file you can copy anywhere, and history/ keeps one file per day. it goes when the app is deleted, so exports still matter. */
const nativeFS = () => window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem;
const COPY_FILE = "150-days-latest.json";
let copyReady = false, copyTimer = 0, copyAt = null, copyFailed = false;
async function writeCopy() {
  clearTimeout(copyTimer);
  const fs = nativeFS();
  if (!fs || !copyReady || !Object.keys(db.entries).length) return;   // never replace the copy with an empty log
  const data = JSON.stringify(db, null, 1);
  try {
    await fs.writeFile({ path: COPY_FILE, data, directory: "DOCUMENTS", encoding: "utf8" });
    await fs.writeFile({ path: `history/150-days-${today}.json`, data, directory: "DOCUMENTS", encoding: "utf8", recursive: true });
    copyAt = new Date(); copyFailed = false;
  } catch (err) { copyFailed = true; }
  paintCopyInfo();
}
function queueCopy() {
  if (!nativeFS()) return;
  clearTimeout(copyTimer);
  copyTimer = setTimeout(writeCopy, 1200);
}
/* on launch: if the web storage came up empty but a copy is there, take it back */
async function restoreCopy() {
  const fs = nativeFS();
  if (fs && !Object.keys(db.entries).length) {
    try {
      const r = await fs.readFile({ path: COPY_FILE, directory: "DOCUMENTS", encoding: "utf8" });
      const o = JSON.parse(r.data);
      if (!Object.keys(db.entries).length && o && typeof o.entries === "object" && o.entries && adoptEntries(o)) {
        if (typeof o.exported === "string") db.exported = o.exported;
        persist(); paintAllCells(); paintSummary(); paintDay(); setStatus("ok", "restored");
      }
    } catch (err) { /* no copy yet, which is normal on a first launch */ }
  }
  copyReady = true;
  queueCopy();
}
function paintCopyInfo() {
  const el = $("#copyInfo");
  if (!el) return;
  const t = copyAt ? copyAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase() : "";
  el.textContent = copyFailed ? "couldn't save the copy on this phone."
    : `a copy saves itself after every change${t ? `, last at ${t}` : ""}. find it in Files > On My iPhone > 150 days.`;
}

/* ----------------------------------------------------------------- state */

const state = { sel: null, focus: null };
const cells = new Map();     // date -> button in the months
const fieldEls = new Map();  // key -> field element in the form
let secEls = [];

const wide = () => matchMedia("(min-width: 1121px)").matches;
const editable = (date) => date <= today;   // days that haven't come yet are locked

/* the page never zooms: not by pinching, not by double-tapping, not for any input */
["gesturestart", "gesturechange", "gestureend"].forEach((t) => document.addEventListener(t, (e) => e.preventDefault(), { passive: false }));
document.addEventListener("dblclick", (e) => e.preventDefault());

/* a quick second tap would zoom the page on iOS. pinching still works. a quick second tap on a button still presses it */
let lastTap = 0, lastTapX = 0, lastTapY = 0;
document.addEventListener("touchend", (e) => {
  if (e.touches.length || e.changedTouches.length !== 1) return;
  const t = e.changedTouches[0], quick = e.timeStamp - lastTap < 350 && Math.hypot(t.clientX - lastTapX, t.clientY - lastTapY) < 40;
  lastTap = e.timeStamp; lastTapX = t.clientX; lastTapY = t.clientY;
  if (!quick || e.target.closest("input, textarea, select, #form, .sheet")) return;
  e.preventDefault();
  const press = e.target.closest("button, label, a, .cell");
  if (press) press.click();
  lastTap = 0;
}, { passive: false });

/* ----------------------------------------------------------------- feel: sound and touch */

// everything is synthesized, so there are no audio files. the speaker button in the header turns sound and touch off together.
const FEEL_KEY = "d150.feel";
const feel = { on: true, ctx: null, buf: null, label: null, until: 0, madeAt: 0, stale: false, tries: 0, gesture: false };
try { feel.on = localStorage.getItem(FEEL_KEY) !== "off"; } catch (e) { /* default on */ }

/* the audio context heals itself. on iOS a context can stay silent after the ring/silent switch or the volume changed, or after
   the app was in the background, and only a fresh one brings the sound back (which is why reopening the app fixed it). a new
   context can only start from a tap, so it is swapped in on the first tap after it went stale, sat idle for a while, or would
   not resume. the old one is closed a little later so a sound still ringing out isn't cut off. */
["pointerdown", "touchstart", "touchend", "click", "keydown"].forEach((t) =>
  addEventListener(t, () => { feel.gesture = true; setTimeout(() => { feel.gesture = false; }, 0); }, true));
document.addEventListener("visibilitychange", () => { if (!document.hidden) feel.stale = true; });
addEventListener("pageshow", () => { feel.stale = true; });
function newCtx() {
  const C = window.AudioContext || window.webkitAudioContext;
  if (!C) return null;
  const old = feel.ctx;
  feel.ctx = new C();
  feel.buf = null; feel.stale = false; feel.tries = 0; feel.madeAt = performance.now();
  if (old) setTimeout(() => { try { Promise.resolve(old.close()).catch(() => {}); } catch (e) { /* already closed */ } }, 2500);
  return feel.ctx;
}
function ac(span = 0.2) {   // span: how many seconds the sound about to be made will last
  const now = performance.now();
  let c = feel.ctx;
  if (!c || c.state === "closed") c = newCtx();
  else if (feel.gesture && now - feel.madeAt > 300) {
    const idle = now > feel.until + 1200;
    if (feel.stale || idle || (c.state !== "running" && feel.tries >= 1)) c = newCtx();
  }
  if (!c) return null;
  if (c.state !== "running") { feel.tries++; c.resume().catch(() => { feel.stale = true; }); } else feel.tries = 0;
  feel.until = Math.max(feel.until, now + span * 1000);
  return c;
}
function blip(f0, f1, d, { type = "sine", gain = 0.12, at = 0 } = {}) {
  const c = feel.on && ac(at + d + 0.03);
  if (!c) return;
  const t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + d);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g).connect(c.destination);
  o.start(t); o.stop(t + d + 0.03);
}
function hiss(d, f0, f1, { gain = 0.05, at = 0 } = {}) {
  const c = feel.on && ac(at + d + 0.03);
  if (!c) return;
  if (!feel.buf) {
    feel.buf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const ch = feel.buf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  }
  const t = c.currentTime + at, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = feel.buf; f.type = "bandpass"; f.Q.value = 0.9;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + d);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + d * 0.35);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  src.connect(f).connect(g).connect(c.destination);
  src.start(t); src.stop(t + d + 0.03);
}
// a wooden tok, like a temple block: a round sine body with a faint downward chirp, a woody overtone and a tiny click, softened by a low-pass
function wood(f, d = 0.14, gain = 0.1, at = 0) {
  const c = feel.on && ac(at + d + 0.03);
  if (!c) return;
  const t = c.currentTime + at, out = c.createGain(), lp = c.createBiquadFilter();
  lp.type = "lowpass"; lp.frequency.value = 3000; lp.Q.value = 0.5;
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(gain, t + 0.003);
  out.gain.exponentialRampToValueAtTime(0.0001, t + d);
  out.connect(lp); lp.connect(c.destination);
  const body = c.createOscillator();
  body.type = "sine"; body.frequency.setValueAtTime(f * 1.07, t); body.frequency.exponentialRampToValueAtTime(f, t + 0.035);
  const over = c.createOscillator(), og = c.createGain();
  over.type = "sine"; over.frequency.value = f * 2.45;
  og.gain.setValueAtTime(0.28, t); og.gain.exponentialRampToValueAtTime(0.0001, t + d * 0.45);
  body.connect(out); over.connect(og).connect(out);
  body.start(t); body.stop(t + d + 0.03); over.start(t); over.stop(t + d * 0.5 + 0.03);
  hiss(0.012, 1500, 1900, { gain: gain * 0.45, at });
}

// one bell voice: the note, a fifth above it at half strength and its octave at a third, ringing together
const bell = (f, d, gain, at = 0) => {
  blip(f, f, d, { gain, at });
  blip(f * 1.5, f * 1.5, d * 0.8, { gain: gain * 0.55, at });
  blip(f * 2, f * 2, d * 0.55, { gain: gain * 0.35, at });
};
const sfx = {
  yes()    { wood(587.3, 0.14, 0.12); },    // D5   the toks sit on a Japanese pentatonic scale (D E F A B-flat), so repeats don't drone
  no()     { wood(349.2, 0.16, 0.12); },    // F4
  pick()   { wood(466.2, 0.14, 0.11); },    // B-flat 4
  clear()  { wood(293.7, 0.1, 0.08); },     // D4
  up()     { wood(659.3, 0.09, 0.07); },    // E5
  down()   { wood(440, 0.09, 0.07); },      // A4
  tick()   { wood(880, 0.07, 0.06); },      // A5
  swish()  { hiss(0.24, 450, 2000, { gain: 0.04 }); },                                                           // a page turning
  part()   { blip(784, 784, 0.4, { gain: 0.08 }); blip(1175, 1175, 0.55, { gain: 0.07, at: 0.09 }); },          // a part of the day is done
  wrap()   { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => bell(f, 0.55, 0.07, i * 0.09));                                  // C E G C, rising, each note struck like the closing bell
             blip(150, 48, 0.26, { gain: 0.3, at: 0.3 }); hiss(0.08, 300, 90, { gain: 0.1, at: 0.3 });                                        // the hanko lands on the last note
             bell(1046.5, 1.1, 0.07, 0.3); },
  wrapPerfect() {
    [523.25, 659.25, 783.99, 2093].forEach((f, i) => bell(f, 0.55, 0.07, i * 0.09));                    // C E G, then the last note an octave higher (C7 where an ordinary day has C6)
    blip(150, 48, 0.26, { gain: 0.3, at: 0.3 }); hiss(0.08, 300, 90, { gain: 0.1, at: 0.3 });           // the hanko lands, as on any day
    bell(2093, 1.1, 0.07, 0.3);
  },
  streak() { [1319, 1568, 1976, 2637].forEach((f, i) => blip(f, f, 0.45, { gain: 0.045, at: i * 0.07 })); },     // a run of sparkles
};
const play = (name) => { if (feel.on) { try { sfx[name](); } catch (e) { /* no audio here */ } } };

// touch: Android vibrates; on iOS 17.4+ toggling a hidden switch control makes the phone tick
function hap(n = 1) {
  if (!feel.on) return;
  if (document.activeElement && document.activeElement.matches && document.activeElement.matches("input, textarea")) return;   // never disturb typing
  const H = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics;   // the native app's own haptic engine
  if (H) {
    try { if (n >= 3) H.notification({ type: "SUCCESS" }); else H.impact({ style: n === 2 ? "MEDIUM" : "LIGHT" }); } catch (e) { /* none */ }
    return;
  }
  try {
    if (navigator.vibrate) { navigator.vibrate(n === 1 ? 8 : [10, 40, 18]); return; }
    if (!feel.label) {
      feel.label = document.createElement("label");
      feel.label.setAttribute("aria-hidden", "true");
      feel.label.style.display = "none";
      const input = document.createElement("input");
      input.type = "checkbox"; input.setAttribute("switch", "");
      feel.label.append(input);
      document.head.append(feel.label);
    }
    feel.label.click();
    for (let k = 1; k < n; k++) setTimeout(() => feel.label.click(), k * 75);
  } catch (e) { /* no haptics here */ }
}
const cue = (name, n = 1) => { play(name); hap(n); };

function paintFeel() {
  const b = $("#feelBtn");
  b.toggleAttribute("data-off", !feel.on);
  b.title = `sound and touch: ${feel.on ? "on" : "off"}`;
}
$("#feelBtn").addEventListener("click", () => {
  feel.on = !feel.on;
  try { localStorage.setItem(FEEL_KEY, feel.on ? "on" : "off"); } catch (e) { /* not remembered */ }
  paintFeel();
  if (feel.on) cue("tick");
});

/* ----------------------------------------------------------------- theme */

const isDark = () => document.documentElement.dataset.theme === "dark";
function setTheme(theme, remember = true) {
  document.documentElement.dataset.theme = theme === "dark" ? "dark" : "light";
  if (remember) { try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* private window: just don't remember */ } }
  const SB = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.StatusBar;   // native app: clock and battery in the right colour
  if (SB) { try { SB.setStyle({ style: isDark() ? "DARK" : "LIGHT" }); } catch (e) { /* none */ } }
  const bar = $('meta[name="theme-color"]');
  if (bar) bar.setAttribute("content", isDark() ? "#121214" : "#f4ede0");
  $$(".mode:not(#feelBtn)").forEach((b) => { b.title = isDark() ? "back to daylight" : "night mode"; });
}
/* day and night swap in a single frame under a veil of the old paper that fades away: smooth, and nothing repaints while it fades */
function switchTheme(next) {
  const root = document.documentElement;
  const veil = document.createElement("div");
  veil.className = "veil";
  veil.style.background = getComputedStyle(root).backgroundColor;
  document.body.append(veil);
  root.classList.add("switching");
  setTheme(next);
  void veil.offsetWidth;
  setTimeout(() => {
    root.classList.remove("switching");
    veil.style.transition = "opacity .6s cubic-bezier(.22, .61, .2, 1)";
    veil.style.opacity = "0";
    setTimeout(() => veil.remove(), 750);
  }, 50);
}
$$(".mode:not(#feelBtn)").forEach((b) => b.addEventListener("click", () => { cue("tick"); switchTheme(isDark() ? "light" : "dark"); }));

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
const pctOf = (x, y) => Math.round((100 * x) / y);
const LIFTS = ["push", "pull", "legs"];

function words(text) { return (text || "").split(/[,;\n]+/).map((t) => t.trim().toLowerCase()).filter((t) => t && t.length <= 40); }
function bump(map, text) { for (const w of words(text)) map.set(w, (map.get(w) || 0) + 1); }
const mostUsed = (map, n) => [...map].sort((a, b) => b[1] - a[1]).slice(0, n).map(([w]) => w);

function aggregate() {
  const tn = dayNo(today), last = clamp(tn, 0, TOTAL);
  const a = {
    tn, last, span: { hours: 0, anki: 0, diet: 0, supps: 0, lesson: 0, io: 0, piano: 0, sleep: 0 }, complete: 0, perfect: 0, part: 0, none: 0, upcoming: 0,
    hours: 0, hoursDays: 0,
    lift: [0, 0, 0], liftPlan: 0, diet: 0, supps: 0,
    anki: 0, ankiDays: 0, lesson: 0, io: 0, piano: 0, sleep: 0, streak: 0,
  };
  const perfectAt = [];
  // a part with nothing in it, or answered with nothing done, is empty
  const empty = (p) => p.tone === "none" || p.tone === "low";
  for (let n = 1; n <= TOTAL; n++) {
    const date = dateOf(n), e = db.entries[date], E = e || {};
    if (n > last) { a.upcoming++; continue; }
    const st = statusOf(date);
    // each percentage is out of the days that are over, plus today once that question has an answer (today doesn't count against you while it is still going)
    for (const k in a.span) if (n < tn || has(E, k)) a.span[k]++;
    if ((n < tn || has(E, "gym")) && (n - 1) % 4 < 3) a.liftPlan++;   // the plan: push, pull, legs+abs, rest, then again, from day 1
    // whole days: perfect is all five parts fully green; none is a day with nothing in it; partial is everything in between
    const perfect = st.per.every((p) => p.tone === "high");
    perfectAt[n] = perfect;
    if (st.complete) a.complete++;
    if (perfect) a.perfect++;
    else if (st.per.every(empty)) { if (st.touched || n < tn) a.none++; else a.upcoming++; }
    else a.part++;
    if (has(E, "hours")) { a.hours += E.hours; if (E.hours > 0) a.hoursDays++; }
    if (LIFTS.includes(E.gym)) a.lift[LIFTS.indexOf(E.gym)]++;
    if (E.diet) a.diet++;
    if (E.supps) a.supps++;
    if (has(E, "anki")) { a.anki += E.anki; if (E.anki > 0) a.ankiDays++; }
    if (E.lesson) a.lesson++;
    if (E.io) a.io++;
    if (E.piano) a.piano++;
    if (E.sleep) a.sleep++;
  }
  // the streak is the run of perfect days that reaches the current day (today may still be in progress)
  let i = clamp(tn, 1, TOTAL);
  if (i === tn && !perfectAt[i]) i--;
  while (i >= 1 && perfectAt[i]) { a.streak++; i--; }
  return a;
}

function factRows(a, focus) {
  const S = a.span;   // per question: the days so far that its percentage is out of
  const one = (n, word) => (n === 1 ? word : word + "s");
  const amt = (text, v, word) => `${text} <small>${one(v, word)}</small>`;
  // "A/B (X% of days)": how many of the days so far
  const ratio = (x, y, unit) => (y ? `${x}/${y} <small>(${pctOf(x, y)}% of ${unit})</small>` : "–");
  // "N% (X/Y days)", "N% (X/Y completed)" or "N% (X/Y sessions)": how often, out of the days so far
  const rate = (x, y, tail) => (y ? `${pctOf(x, y)}% <small>(${x}/${y} ${y === 1 && tail.endsWith("s") ? tail.slice(0, -1) : tail})</small>` : "–");
  const avgH = a.hoursDays ? Math.round((a.hours / a.hoursDays) * 10) / 10 : 0;
  const avgW = a.ankiDays ? Math.round(a.anki / a.ankiDays) : 0;
  switch (focus) {
    case "data": return [
      ["days worked", ratio(a.hoursDays, S.hours, "days")],
      ["total hours worked", amt(fmtH(a.hours), Math.round(a.hours * 10) / 10, "hour")],
      ["average hrs, on days worked", a.hoursDays ? amt(fmtH(avgH), avgH, "hour") : "–"],
    ];
    case "gym": return [
      ["lift days", ratio(a.lift[0] + a.lift[1] + a.lift[2], a.liftPlan, "days")],
      ["p · p · l+a", a.lift.join(" · ")],
      ["diet adherence", rate(a.diet, S.diet, "days")],
      ["supplement adherence", rate(a.supps, S.supps, "days")],
    ];
    case "jp": return [
      ["days studied", ratio(a.ankiDays, S.anki, "days")],
      ["vocab studied", amt(a.anki.toLocaleString("en-US"), a.anki, "word")],
      ["avg words, on days studied", a.ankiDays ? amt(String(avgW), avgW, "word") : "–"],
      ["lessons", rate(a.lesson, S.lesson, "completed")],
      ["input/output", rate(a.io, S.io, "sessions")],
    ];
    case "piano": return [
      ["days practiced", ratio(a.piano, S.piano, "days")],
    ];
    case "sleep": return [
      ["nights on time", ratio(a.sleep, S.sleep, "nights")],
    ];
    default: return [];
  }
}

/* tapping a stat swaps one panel for another of a different height. the layout snaps at once, then the calendar slides to
   its new place (a transform, so the compositor does it) while the new panel is revealed by a clip on the same timing:
   nothing is laid out frame by frame. the old panel stays on top as a ghost, fading and clipping away. */
const SWAP = { duration: 520, easing: "cubic-bezier(.22, .61, .2, 1)" };   // the same curve as --ink-ease
function paintFacts(animate) {
  const d = DOMAINS.find((x) => x.id === state.focus);
  const wrap = $("#tallyWrap"), months = $("#months");
  const mode = d ? "facts" : "tally";   // the two panels take turns
  const swap = animate && wrap.animate && !matchMedia("(prefers-reduced-motion: reduce)").matches;
  let ghost = null, h0 = 0, top0 = 0;
  if (swap) {
    $$(".ghost", wrap).forEach((g) => g.remove());
    months.getAnimations().forEach((an) => an.cancel());
    h0 = wrap.offsetHeight; top0 = months.getBoundingClientRect().top;
    ghost = $(wrap.dataset.mode === "facts" ? ".pane-facts" : ".pane-tally", wrap).cloneNode(true);
    ghost.classList.add("ghost");
    ghost.querySelectorAll("[id]").forEach((e) => e.removeAttribute("id"));
    ghost.querySelectorAll("[data-anim]").forEach((e) => e.removeAttribute("data-anim"));   // the ghost shows the old rows as they were
  }
  wrap.dataset.mode = mode;
  if (d) {
    $("#factsLabel").textContent = d.name;
    const box = $("#facts");
    if (animate) box.dataset.anim = "1"; else delete box.dataset.anim;
    box.innerHTML = factRows(aggregate(), state.focus).map(([k, v], i) => `<div style="--i:${i}"><dt>${k}</dt><dd>${v}</dd></div>`).join("");
  }
  if (!swap) return;
  wrap.append(ghost);
  const h1 = wrap.offsetHeight, delta = top0 - months.getBoundingClientRect().top;
  const clip = (below) => `inset(-30px -30px ${below}px -30px)`;   // the negative insets leave the streak's glints unclipped
  if (delta) months.animate([{ transform: `translateY(${delta}px)` }, { transform: "none" }], SWAP);
  const pane = $(mode === "facts" ? ".pane-facts:not(.ghost)" : ".pane-tally:not(.ghost)", wrap);
  if (h1 > h0) pane.animate([{ clipPath: clip(h1 - h0) }, { clipPath: clip(0) }], SWAP);
  if (mode === "tally") pane.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: "ease-out" });   // the facts fade in row by row already
  ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, easing: "ease-out", fill: "forwards" });
  if (h0 > h1) ghost.animate([{ clipPath: clip(0) }, { clipPath: clip(h0 - h1) }], { ...SWAP, fill: "forwards" });
  Promise.all(ghost.getAnimations().map((an) => an.finished)).then(() => ghost.remove(), () => ghost.remove());
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

let ensoLen = 0, shownStreak = null, loud = false;   // loud: this repaint follows something you just logged
function paintSummary() {
  const a = aggregate();
  ensoLen = ensoLen || $("#ensoArc").getTotalLength();
  // linear: exactly as full as the share of days. the round caps reach 6 past each end of the dash, so it is trimmed and shifted to match
  const len = (n) => ensoLen * clamp(n / TOTAL, 0, 1);
  $("#ensoArc").style.strokeDasharray = `${Math.max(0.01, len(a.complete) - 12)}px 1000px`;
  $("#ensoTime").style.strokeDasharray = `${len(a.last)}px 1000px`;
  $("#enso").toggleAttribute("data-empty", !a.complete);
  setNum($("#ensoNum"), a.complete);

  // the date being logged, written large like the leaf of a day calendar
  const ld = parse(dateOf(clamp(a.tn, 1, TOTAL)));
  $("#verdictLabel").innerHTML = `<span class="wj">${WEEK_J[ld.getDay()]}</span>${WEEK_E[ld.getDay()]}`;
  $("#verdict").innerHTML = `<span class="dd">${ld.getDate()}</span><span class="mm">${MON3[ld.getMonth()]}</span><span class="yr">${ld.getFullYear()}</span>`;


  $("#tPerfect").textContent = a.perfect; $("#tPartial").textContent = a.part;
  $("#tNone").textContent = a.none; $("#tStreak").textContent = a.streak;
  if (loud && shownStreak !== null && a.streak > shownStreak) { cue("streak", 2); burst(); }
  loud = false; shownStreak = a.streak;
  $("#streakBox").toggleAttribute("data-on", a.streak > 0);
  const seg = { high: a.perfect, mid: a.part, low: a.none, unknown: a.upcoming };
  const label = { high: "perfect", mid: "partial", low: "none", unknown: "still to come" };
  for (const t of Object.keys(seg)) { const el = $(`#coverage [data-tone="${t}"]`); el.style.flexGrow = seg[t]; el.title = `${seg[t]} ${label[t]}`; }

  paintFacts(false);
  paintBackupNudge();
}
let summaryTimer = 0;
const queueSummary = () => { clearTimeout(summaryTimer); summaryTimer = setTimeout(paintSummary, 160); };

$("#stats").addEventListener("click", (e) => {
  const b = e.target.closest(".stat");
  if (!b) return;
  cue("tick");
  state.focus = state.focus === b.dataset.focus ? null : b.dataset.focus;
  applyFocus(true);
});
function applyFocus(animate) {
  $$(".stat").forEach((s) => s.classList.toggle("on", s.dataset.focus === state.focus));
  const m = $("#months");
  if (state.focus) m.dataset.focus = state.focus; else delete m.dataset.focus;
  paintFacts(animate);
}

function burst() {
  const n = $(".stnum");
  n.classList.remove("pop"); void n.offsetWidth; n.classList.add("pop");
}

/* sparkles and torn flakes of gold leaf around the streak */
function buildGlint() {
  // [x%, y%, size px, delay s, drift x px, drift y px, period s]; positions are within a box a little wider than the number
  const stars = [[22, 22, 7, 0, -7, -6, 4.2], [78, 10, 5, 1.1, 8, -5, 3.6], [50, -4, 6, 2.3, -3, -8, 5], [92, 62, 6, 0.7, 9, 4, 4.4],
                 [8, 84, 5, 1.9, -8, 5, 3.9], [64, 96, 4, 3, 5, 7, 4.8], [40, 52, 4, 2.6, 6, -6, 3.4]];
  const flakes = [[28, 38, 3, 0.2, 20, 4, 11, 6.2], [70, 28, 2.5, 1.3, 70, -5, 12, 5.4], [56, 68, 3, 2.1, 140, 6, 10, 6.8], [88, 48, 2, 0.9, 200, 5, 13, 5.8],
                  [30, 78, 2.5, 2.4, 40, -4, 11, 6.4], [78, 86, 2, 1.6, 100, 3, 9, 5.2], [12, 50, 2, 0.5, 160, -6, 12, 7], [48, 14, 2.5, 3.1, 60, 3, 12, 6]];
  $("#glint").innerHTML =
    stars.map(([x, y, sz, d, dx, dy, p]) => `<em class="star" style="--x:${x}%;--y:${y}%;--s:${sz}px;--d:${d}s;--dx:${dx}px;--dy:${dy}px;--p:${p}s"></em>`).join("") +
    flakes.map(([x, y, sz, d, r, dx, dy, p]) => `<em class="flake" style="--x:${x}%;--y:${y}%;--s:${sz}px;--d:${d}s;--r:${r}deg;--dx:${dx}px;--dy:${dy}px;--p:${p}s"></em>`).join("");
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
  loud = true;
  const { complete, was, newlyDone } = paintSections(true);
  if (complete && !was) celebrate();
  else if (newlyDone) cue("part", 2);
  paintCell(state.sel);
  queueSummary();
}

function paintSections(announce = false) {
  const st = statusOf(state.sel);
  let newlyDone = 0;
  DOMAINS.forEach((d, i) => {
    const sec = secEls[i], p = st.per[i];
    const next = p.complete ? "done" : p.answered ? "part" : "none";
    if (announce && next === "done" && sec.dataset.state !== "done") {
      newlyDone++;
      sec.classList.remove("pop"); void sec.offsetWidth; sec.classList.add("pop");   // the kanji gives a little pop
    }
    sec.dataset.state = next;
    $(".sec-prog", sec).textContent = p.complete ? "logged" : p.total > 1 && p.answered ? `${p.answered} / ${p.total}` : "";
  });
  const was = document.body.classList.contains("complete");
  document.body.classList.toggle("complete", st.complete);
  return { complete: st.complete, was, newlyDone };
}

/* the whole day wrapped up: a calendar leaf drops in, the hanko lands on it with a rising jingle, then it flies up to its place on the page */
const ceremonyAt = {};
let wrapTimers = [], wrapFly = null;
function wrapEnd(scrollUp) {
  wrapTimers.forEach(clearTimeout); wrapTimers = [];
  if (wrapFly) { wrapFly.cancel(); wrapFly = null; }
  fxStop();
  const w = $("#wrap");
  w.hidden = true; w.className = "wrap";
  document.body.classList.remove("celebrating");
  document.body.classList.add("settle");
  setTimeout(() => document.body.classList.remove("settle"), 500);
  if (scrollUp) $("#dayScroll").scrollTo({ top: 0, behavior: "smooth" });
}

/* flakes of gold and vermilion, all drawn on one canvas (a single layer instead of a hundred and fifty) */
const fx = { cv: null, cx: null, parts: [], raf: 0, last: 0, t: 0, w: 0, h: 0 };
const FLAKE = [[0.08, 0.12], [0.62, 0], [1, 0.38], [0.78, 1], [0.14, 0.82]];   // an irregular torn flake, in unit size
function fxStart() {
  fx.cv = fx.cv || $("#wrapCanvas");
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  fx.w = innerWidth; fx.h = Math.max(innerHeight, parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--app-h")) || 0);
  fx.cv.width = Math.round(fx.w * dpr); fx.cv.height = Math.round(fx.h * dpr);
  fx.cx = fx.cv.getContext("2d");
  fx.cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  fx.parts = []; fx.t = 0; fx.last = performance.now();
  cancelAnimationFrame(fx.raf);
  fx.raf = requestAnimationFrame(fxLoop);
}
function fxStop() {
  cancelAnimationFrame(fx.raf);
  fx.parts = [];
  if (fx.cx) fx.cx.clearRect(0, 0, fx.w, fx.h);
}
function fxPalette() {
  const shu = getComputedStyle(document.documentElement).getPropertyValue("--shu").trim() || "#a11d22";
  return ["#f0c24a", "#e3b64b", "#d9a42f", "#fff2b0", "#c8932a", shu];
}
function fxBurst(x, y, n) {
  const pal = fxPalette();
  for (let i = 0; i < n; i++) {
    const ang = Math.random() * Math.PI * 2, sp = 140 + Math.random() * 460;
    fx.parts.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 120, g: 760, drag: 1.6, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 12,
      s: 4 + Math.random() * 7, c: pal[Math.floor(Math.random() * pal.length)], life: 1.1 + Math.random() * 0.8, age: 0, t0: 0, sway: 0 });
  }
}
function fxRain(n) {
  const pal = fxPalette();
  for (let i = 0; i < n; i++) {
    fx.parts.push({ x: Math.random() * fx.w, y: -20 - Math.random() * 60, vx: 0, vy: 170 + Math.random() * 150, g: 120, drag: 0.1, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 9,
      s: 5 + Math.random() * 7, c: pal[Math.floor(Math.random() * pal.length)], life: 2.5, age: 0, t0: fx.t + 0.1 + Math.random() * 0.9, sway: 2 + Math.random() * 3 });
  }
}
function fxLoop(now) {
  const dt = Math.min(0.034, (now - fx.last) / 1000);
  fx.last = now; fx.t += dt;
  const cx = fx.cx;
  cx.clearRect(0, 0, fx.w, fx.h);
  fx.parts = fx.parts.filter((p) => p.age < p.life);
  for (const p of fx.parts) {
    if (fx.t < p.t0) continue;
    p.age += dt;
    p.vy += p.g * dt;
    p.vx *= 1 - Math.min(1, p.drag * dt); p.vy *= 1 - Math.min(1, p.drag * dt * 0.4);
    p.x += p.vx * dt + (p.sway ? Math.sin(p.age * p.sway * 2) * 22 * dt : 0); p.y += p.vy * dt; p.rot += p.vr * dt;
    const fade = p.age > p.life * 0.7 ? 1 - (p.age - p.life * 0.7) / (p.life * 0.3) : 1;
    cx.globalAlpha = Math.max(0, Math.min(1, p.age * 10) * fade);
    cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.fillStyle = p.c;
    cx.beginPath();
    FLAKE.forEach(([u, v], i) => { const px = (u - 0.5) * p.s * 1.6, py = (v - 0.5) * p.s * 1.6; if (i) cx.lineTo(px, py); else cx.moveTo(px, py); });
    cx.closePath(); cx.fill(); cx.restore();
  }
  cx.globalAlpha = 1;
  if (fx.parts.length || fx.t < 0.8) fx.raf = requestAnimationFrame(fxLoop);
}

function celebrate() {
  const date = state.sel, now = Date.now();
  if (ceremonyAt[date] && now - ceremonyAt[date] < 60000) { stampIn(); return; }   // this one was just celebrated
  ceremonyAt[date] = now;
  const perfect = statusOf(date).per.every((p) => p.tone === "high");
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) { stampIn(); cue(perfect ? "wrapPerfect" : "wrap", 2); return; }
  const d = parse(date), n = dayNo(date), a = aggregate();
  $("#leafTop").innerHTML = `<span class="wj">${WEEK_J[d.getDay()]}</span>${WEEK_E[d.getDay()]}`;
  $("#leafDate").innerHTML = `<b class="dd">${d.getDate()}</b><span class="mm">${MON3[d.getMonth()]}</span><span class="yr">${d.getFullYear()}</span>`;
  $("#leafDay").textContent = `day ${n} of ${TOTAL}`;
  const inRow = date === dateOf(clamp(a.tn, 1, TOTAL)) && a.streak > 1;
  $("#leafNote").innerHTML = perfect
    ? `<span class="gold big">perfect</span>${inRow ? `<span class="gold">${a.streak} in a row</span>` : ""}`
    : "logged";
  const w = $("#wrap");
  wrapEnd(false);
  document.body.classList.remove("settle");
  w.hidden = false;
  if (perfect) w.classList.add("perfect");
  document.body.classList.add("celebrating");
  void w.offsetWidth;
  fxStart();
  w.classList.add("go");
  cue(perfect ? "wrapPerfect" : "wrap", perfect ? 9 : 5);
  wrapTimers.push(setTimeout(() => {   // the hanko has landed: flakes burst from it, and on a perfect day more rain from the top
    const r = $("#wrapSeal").getBoundingClientRect();
    fxBurst(r.left + r.width / 2, r.top + r.height / 2, perfect ? 90 : 34);
    if (perfect) fxRain(80);
  }, 300));
  const hold = perfect ? 3500 : 2300;
  wrapTimers.push(setTimeout(() => { w.classList.add("lift"); $("#dayScroll").scrollTo({ top: 0, behavior: "smooth" }); }, hold));
  wrapTimers.push(setTimeout(() => {
    const seal = $("#wrapSeal"), to = $("#stamp").getBoundingClientRect(), from = seal.getBoundingClientRect();
    const dx = to.left + to.width / 2 - (from.left + from.width / 2), dy = to.top + to.height / 2 - (from.top + from.height / 2);
    w.classList.add("out");   // the veil fades while the hanko flies up to its place
    wrapFly = seal.animate(
      [{ transform: "translate(0, 0) scale(1) rotate(-4deg)" }, { transform: `translate(${dx}px, ${dy}px) scale(${to.width / seal.offsetWidth}) rotate(5deg)` }],
      { duration: 540, easing: "cubic-bezier(.5, 0, .2, 1)", fill: "forwards" });
    wrapFly.onfinish = () => wrapEnd(false);
  }, hold + 600));
}
$("#wrap").addEventListener("click", () => { if (!wrapFly) wrapEnd(true); });   // a tap skips it

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
  form.classList.add("quiet");   // chips take their saved state without drawing their underlines
  setTimeout(() => form.classList.remove("quiet"), 90);
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
    cue(already ? "clear" : v === "yes" ? "yes" : v === "no" ? "no" : "pick");
    setVal(k, already ? null : v === "yes" ? true : v === "no" ? false : v);   // tap again to clear
    $$(".chip", fld).forEach((c) => c.setAttribute("aria-pressed", String(matchChip(entry()[k], c.dataset.v))));
    return;
  }
  const step = e.target.closest(".step");
  if (step) {
    const cur = entry()[k], dir = Number(step.dataset.dir);
    const v = clamp(Math.round(((cur || 0) + dir * f.step) * 100) / 100, 0, f.max);
    cue(dir > 0 ? "up" : "down");
    setVal(k, v);
    const box = $("input", fld);
    box.value = String(v);
    box.classList.remove("bump"); void box.offsetWidth; box.classList.add("bump");
    return;
  }
  const sg = e.target.closest(".sugg button");
  if (sg) {
    const ta = $("textarea", fld), base = ta.value.replace(/[\s,;]+$/, "");
    ta.value = base ? `${base}, ${sg.dataset.s}` : sg.dataset.s;
    cue("tick");
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
  if (e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest(".sugg")) return;   // moving onto a suggestion: leave it be
  const k = fld.dataset.k;
  if (e.target.matches(".num")) e.target.value = has(entry(), k) ? String(entry()[k]) : "";
  else if (e.target.matches("textarea")) paintSugg(k);
});
form.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.matches(".num")) e.target.blur(); });

/* ----------------------------------------------------------------- the day page */

/* once every stroke of a drawing has finished, the ink dries: the cheap filter used while drawing is swapped for the full one */
document.addEventListener("animationend", (e) => {
  if (e.animationName !== "draw" && e.animationName !== "soak-text") return;
  const g = e.target.closest && e.target.closest(".ink");
  if (g && g.getAnimations({ subtree: true }).every((a) => a.playState !== "running")) g.classList.add("done");
}, true);

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
  if (n >= 1 && n <= TOTAL) { selectDay(dateOf(n)); cue("swish"); }
}
$("#prevDay").addEventListener("click", () => stepDay(-1));
$("#nextDay").addEventListener("click", () => stepDay(1));

/* on a phone the day is a page laid over the days. the "days" button closes it, and so does dragging in from the left edge */
function openDayPage() {
  if (wide() || document.body.classList.contains("has-day")) return;
  document.body.classList.add("has-day");
  cue("swish");
}
/* leaving the day page takes the keyboard with it (the page slides away but the box under your finger keeps focus otherwise) */
function dropKeyboard() {
  const el = document.activeElement;
  if (el && el.matches && el.matches("input, textarea")) el.blur();
  const K = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Keyboard;
  try { if (K && K.hide) Promise.resolve(K.hide()).catch(() => {}); } catch (err) { /* the blur above is enough in a browser */ }
}
function closeDayPage() {
  if (wide() || !document.body.classList.contains("has-day")) return;
  dropKeyboard();
  document.body.classList.remove("has-day");
  cue("swish");
}
$("#toDays").addEventListener("click", closeDayPage);

const edge = $("#edge");
let drag = null;
edge.addEventListener("pointerdown", (e) => {
  if (!document.body.classList.contains("has-day")) return;
  drag = { id: e.pointerId, x: e.clientX, dx: 0, v: 0, last: e.clientX, lastT: performance.now() };
  try { edge.setPointerCapture(e.pointerId); } catch (err) { /* fine without */ }
  $("#day").style.transition = "none";
});
edge.addEventListener("pointermove", (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const now = performance.now();
  drag.v = (e.clientX - drag.last) / Math.max(1, now - drag.lastT);   // px per ms, for flicks
  drag.last = e.clientX; drag.lastT = now;
  drag.dx = Math.max(0, e.clientX - drag.x);
  if (drag.dx > 12 && !drag.kb) { drag.kb = true; dropKeyboard(); }     // the keyboard goes as soon as the page starts to move
  $("#day").style.transform = `translateX(${drag.dx}px)`;               // the page follows your finger
});
function endDrag() {
  if (!drag) return;
  const page = $("#day"), go = drag.dx > page.offsetWidth * 0.3 || (drag.v > 0.5 && drag.dx > 24);
  drag = null;
  page.style.transition = "transform .38s cubic-bezier(.22, .61, .2, 1)";
  page.style.transform = go ? "translateX(105%)" : "translateX(0)";
  if (go) { dropKeyboard(); cue("swish"); }
  setTimeout(() => {
    if (go) document.body.classList.remove("has-day");
    page.style.transition = ""; page.style.transform = "";
  }, 400);
}
edge.addEventListener("pointerup", endDrag);
edge.addEventListener("pointercancel", endDrag);

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

/* coming back after a while, land on the day to log so you can start straight away */
let hiddenAt = 0;
function goToLogDay() {
  selectDay(dateOf(clamp(dayNo(today), 1, TOTAL)));
  if (!wide()) document.body.classList.add("has-day");
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { hiddenAt = Date.now(); flush(); writeCopy(); return; }
  refreshToday();
  if (hiddenAt && Date.now() - hiddenAt > 10 * 60 * 1000) { closeBackup(); goToLogDay(); }
});

/* ----------------------------------------------------------------- backup */

const needsBackup = () => Object.keys(db.entries).length >= 5 && (!db.exported || Date.now() - Date.parse(db.exported) > 14 * 864e5);
function paintBackupNudge() { $("#backupBtn").classList.toggle("nudge", needsBackup()); }
function backupInfo() {
  const n = Object.keys(db.entries).length;
  $("#backupInfo").textContent = `${n} ${n === 1 ? "day" : "days"} logged · last export ${db.exported ? shortDate(ymd(new Date(db.exported))) : "never"}`;
}
function openBackup() { cue("swish"); backupInfo(); paintCopyInfo(); $("#backupMsg").textContent = ""; $("#backupSheet").hidden = false; }
function closeBackup() {
  const sheet = $("#backupSheet");
  if (sheet.hidden) return;
  sheet.hidden = true;
  cue("swish");
}
$("#backupBtn").addEventListener("click", openBackup);
$("#backupClose").addEventListener("click", closeBackup);
$("#backupSheet").addEventListener("click", (e) => { if (e.target.id === "backupSheet") closeBackup(); });

$("#exportBtn").addEventListener("click", async () => {
  const name = `150-days-${today}.json`;
  const blob = new Blob([JSON.stringify(db, null, 1)], { type: "application/json" });
  const file = new File([blob], name, { type: "application/json" });
  const msg = $("#backupMsg");
  try {
    const cap = window.Capacitor && window.Capacitor.Plugins, FS = cap && cap.Filesystem, SH = cap && cap.Share;
    if (FS && SH) {   // the native app: write the file, then open the iOS share sheet on it
      const saved = await FS.writeFile({ path: name, data: JSON.stringify(db, null, 1), directory: "CACHE", encoding: "utf8" });
      await SH.share({ title: "150 days", url: saved.uri });
    } else if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: "150 days" });
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
  for (const k of ["diet", "supps", "lesson", "io", "piano", "sleep"]) if (typeof e[k] === "boolean") out[k] = e[k];
  if (!("io" in out) && (typeof e.input === "boolean" || typeof e.output === "boolean")) out.io = !!(e.input || e.output);
  if (["push", "pull", "legs", "rest"].includes(e.gym)) out.gym = e.gym;
  for (const k of ["topics", "pianoNote", "jpNote"]) if (typeof e[k] === "string" && e[k].trim()) out[k] = e[k].slice(0, 2000);
  return out;
}
/* takes the days of a backup into the log: only real dates inside the 150 days, none that haven't come yet, only fields this app writes */
function adoptEntries(o) {
  let n = 0;
  for (const [date, e] of Object.entries(o.entries)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const num = dayNo(date);
    if (num < 1 || num > TOTAL || date > today || !e || typeof e !== "object") continue;   // days that haven't come yet can't be restored
    const c = clean(e);
    if (Object.keys(c).length) { db.entries[date] = c; n++; }
  }
  return n;
}
$("#importFile").addEventListener("change", async (ev) => {
  const file = ev.target.files[0], msg = $("#backupMsg");
  ev.target.value = "";
  if (!file) return;
  try {
    const o = JSON.parse(await file.text());
    if (!o || typeof o.entries !== "object" || !o.entries) throw new Error("not a backup");
    const n = adoptEntries(o);
    persist(); paintAllCells(); paintSummary(); paintDay(); backupInfo();
    msg.textContent = `restored ${n} ${n === 1 ? "day" : "days"}.`;
  } catch (err) {
    msg.textContent = "that isn't a 150 days backup.";
  }
});

/* ----------------------------------------------------------------- start */

/* the app is exactly as tall as the page area the browser gives it (on an iPhone that is shorter than the screen) */
function fitHeight() {
  document.documentElement.style.setProperty("--app-h", innerHeight + "px");
}
addEventListener("resize", fitHeight);
addEventListener("orientationchange", () => setTimeout(fitHeight, 200));

function boot() {
  fitHeight();
  setTheme(isDark() ? "dark" : "light", false);
  // does the page run under the phone's status bar? only then does it need the wash behind the bar's text
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top,0px)";
  document.body.append(probe);
  if (parseFloat(getComputedStyle(probe).paddingTop) > 0) document.documentElement.classList.add("under-bar");
  probe.remove();
  buildMonths();
  buildForm();
  buildGlint();
  paintFeel();
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
  // stay hidden until the type is in, then settle in; the strokes start drawing once it shows
  const reveal = () => setTimeout(() => document.documentElement.classList.add("show"), 30);
  const fonts = document.fonts && document.fonts.load
    ? Promise.all([document.fonts.load('500 16px "Shippori Mincho"'), document.fonts.load('600 16px "Shippori Mincho"')]) : Promise.resolve();
  Promise.race([fonts, new Promise((r) => setTimeout(r, 1500))]).then(reveal, reveal);
  restoreCopy();
}
boot();

if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
  addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => { /* no offline cache; the app still works online */ }));
}
