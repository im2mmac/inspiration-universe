import { UniverseAudio } from "./audio-engine.js";
import { WristCamera } from "./camera.js";
import { ArtField } from "./art-particles.js";
import { catalog } from "./items.js";
import { layerCode } from "./audio-engine.js";
import { SONGS } from "./music-catalog.js";

/* ────────────────────────────────────────────────────────────
   화면 설계 (75인치 16:9 기준, 모든 값은 무대 크기에 대한 비율)
   - 위 10~58%: 영감이 다가와 머무는 낚시 구역
   - 59~89%: 우주인 세 명이 서는 구역 (키 = 화면 높이의 30% ≈ 28cm)
   - 89~100%: 공동 수집 15칸 (한 칸 ≈ 화면 너비의 4.6% ≈ 7.6cm)
   - 그물 고리 지름 ≈ 화면 너비의 8.5% (≈ 14cm)
   ──────────────────────────────────────────────────────────── */
const LAYOUT = {
  vanish: [.5, .34],
  field: { left: .08, right: .92, top: .11, bottom: .52 },
  trayTop: .885,
  feet: .9,
  astronaut: .30,
  hoop: .043,
  lanes: [[.5], [.32, .68], [.2, .5, .8]],
};
const PLAYERS = [
  { label: "1", suit: "red", color: "#ff7a68", light: "#ffc2b5" },
  { label: "2", suit: "yellow", color: "#ffd45e", light: "#fff0b8" },
  { label: "3", suit: "blue", color: "#6daeff", light: "#c4dcff" },
];
const ROLE_TINT = { base: "#8fe6ff", melody: "#ffd98a", texture: "#e2bcff" };
const HAND = [.92, .7];
const BEAT_MS = 60000 / 150;
const APPROACH_MS = 5200;
const HOVER_MS = 7600;
const HOLD_RELEASE_MS = 1000;
const DWELL_CATCH_MS = 900;
const ERASE_MS = 900;            // 왼손 지우개를 내 칸에 대고 문지르는 시간
const LIMIT = 15;
const EMPTY_RESET_MS = 15000;   // 모두 떠난 뒤 이만큼 지나면 다시 빈 우주로
const REVIEW_RESET_MS = 40000;  // 완성 장면을 들은 뒤 새 우주로

const byId = id => document.getElementById(id);
const stage = byId("stage");
const floaters = byId("floaters");
const slots = byId("slots");
const actorsLayer = byId("actors");
const fx = byId("fx");
const starsCanvas = byId("stars");
const artField = new ArtField(byId("art"));
const audio = new UniverseAudio();
const tracker = new WristCamera(byId("camera-feed"), moveTracked);

const selected = new Set();
const slotsList = Array.from({ length: LIMIT }, () => null);
const onScreen = [];
const particles = [];
const flights = [];
const actors = PLAYERS.map(() => ({ present: false, x: .5, tx: .5, lean: 0, hop: 0, seen: 0, el: null }));
const nets = PLAYERS.map(() => ({
  x: .5, y: .45, tx: .5, ty: .45, closed: false, closedAt: -1e9, grip: 0, swish: 0,
  hover: null, hoverSince: 0, slot: null, slotSince: 0, hasHand: false, caught: 0,
}));
// 왼손을 펴면 나타나는 지우개
const erasers = PLAYERS.map(() => ({ x: .5, y: .8, tx: .5, ty: .8, on: false, fade: 0, slot: null, rub: 0, lx: 0, ly: 0, used: 0 }));
let state = "idle";
let selectedPlayer = 0;
let lastSpawn = 0;
let session = 0;
let cameraActive = false;
let presenceSince = 0;
let emptySince = 0;
let reviewSince = 0;
let beatOrigin = performance.now();
let lastBeat = -1;
let beatPulse = 0;
let warp = 0;
let size = { w: 1, h: 1, dpr: 1 };

/* ── 유틸 ───────────────────────────────────────────── */
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const px = (x, y) => [x * size.w, y * size.h];

function status(message) { byId("status").textContent = message; }
function hint(message) {
  const el = byId("hint");
  el.textContent = message;
  el.classList.toggle("show", !!message);
}

function resize() {
  const rect = stage.getBoundingClientRect();
  const dpr = stage.classList.contains("lite") ? 1 : Math.min(1.5, window.devicePixelRatio || 1);
  size = { w: rect.width, h: rect.height, dpr };
  for (const canvas of [fx, starsCanvas]) {
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
  }
  artField.lite = stage.classList.contains("lite");
  artField.resize(rect.width, rect.height, dpr);
}

/* ── 재료 표시 ──────────────────────────────────────── */
function textSize(text) {
  const len = [...text].length;
  const wide = /[぀-ヿ一-鿿가-힣]/.test(text) ? 1 : .62;
  return clamp(3.7 - Math.max(0, len * wide - 5) * .17, 2.15, 3.7);
}

function face(text, script, cls) {
  const span = document.createElement("span");
  span.className = "face " + cls;
  span.lang = { ko: "ko", ja: "ja", zh: "zh", latin: "en" }[script] || "ko";
  span.style.setProperty("--size", textSize(text) + "cqw");
  span.textContent = text;
  return span;
}

function itemBody(item) {
  const body = document.createElement("span");
  body.className = "body";
  if (item.kind === "image") {
    const image = new Image();
    image.src = "./assets/" + item.image + ".webp";
    image.alt = "";
    image.draggable = false;
    body.append(image);
    return body;
  }
  const card = document.createElement("span");
  card.className = "card";
  if (item.motion === "wave") {
    const front = face(item.name, item.script, "front");
    front.textContent = "";
    [...item.name].forEach((char, i) => {
      const letter = document.createElement("i");
      letter.textContent = char;
      letter.style.setProperty("--i", i);
      front.append(letter);
    });
    card.append(front);
  } else card.append(face(item.name, item.script, "front"));
  if (item.back) card.append(face(item.back, item.backScript, "back"));
  body.append(card);
  return body;
}

function thumbnail(item) {
  if (item.kind === "image") {
    const image = new Image();
    image.src = "./assets/" + item.image + ".webp";
    image.alt = item.name;
    image.draggable = false;
    return image;
  }
  const span = document.createElement("span");
  span.className = "slot-word";
  span.textContent = item.name;
  if ([...item.name].length > 5) span.classList.add("long");
  return span;
}

/* ── 상태 ──────────────────────────────────────────── */
/* ── 완성작 공유: 고른 영감 목록을 주소에 담아 QR로 보여 준다 ──
   휴대폰에서 song.html이 같은 목록으로 음악을 다시 만들어 내려받게 한다 (서버 업로드 없음). */
const PUBLIC_SITE = "https://im2mmac.github.io/inspiration-universe/";
function shareUrl() {
  const base = new URL("./song.html", location.protocol === "https:" ? location.href : PUBLIC_SITE);
  // v3: 영감 번호.관람객.악기 줄 — 휴대폰에서 같은 층으로 다시 만든다
  const code = slotsList.map(item => item ? [item.seed.toString(36), item.player, layerCode(item.layer || "")].filter(part => part !== "").join(".") : "").join("-");
  base.hash = "v3." + audio.take.toString(36) + "~" + code;
  return base.href;
}

function drawQr() {
  const box = byId("qr");
  if (!box) return;
  const url = shareUrl();
  box.dataset.url = url;
  if (!globalThis.qrcode) { box.textContent = url; return; }
  const qr = globalThis.qrcode(0, "M");
  qr.addData(url);
  qr.make();
  box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
}

function setState(next) {
  if (next === "review") drawQr();
  state = next;
  stage.dataset.state = next;
  byId("tray").hidden = next === "idle";
  byId("finish").hidden = next !== "review";
}

function activeRole() {
  return selected.size < 4 ? "base" : selected.size < 10 ? "melody" : "texture";
}

/* ── 우주인 ────────────────────────────────────────── */
function ensureActor(player) {
  const actor = actors[player];
  if (actor.el) return actor;
  const el = document.createElement("div");
  el.className = "actor arrive";
  el.style.setProperty("--player", PLAYERS[player].color);
  el.style.setProperty("--light", PLAYERS[player].light);
  el.innerHTML = '<i class="beam"></i><i class="ground"></i><img class="suit" alt="" draggable="false" src="./assets/astronaut/' +
    PLAYERS[player].suit + '.webp"><b class="tag">' + PLAYERS[player].label + "</b>";
  actorsLayer.append(el);
  actor.el = el;
  setTimeout(() => el.classList.remove("arrive"), 1100);
  return actor;
}

function join(player) {
  const actor = actors[player];
  if (actor.present) return;
  actor.present = true;
  actor.seen = performance.now();
  const lane = laneFor(player);
  actor.x = actor.tx = lane;
  ensureActor(player);
  const net = nets[player];
  net.x = net.tx = clamp(lane + .06, .05, .95);
  net.y = net.ty = .42;
  layoutLanes();
}

function leave(player) {
  const actor = actors[player];
  if (!actor.present) return;
  actor.present = false;
  const el = actor.el;
  actor.el = null;
  if (el) {
    el.classList.add("leave");
    setTimeout(() => el.remove(), 700);
  }
  layoutLanes();
}

function present() { return actors.map((a, i) => a.present ? i : -1).filter(i => i >= 0); }

function laneFor(player) {
  const list = [...new Set([...present(), player])].sort((a, b) => a - b);
  return LAYOUT.lanes[list.length - 1][list.indexOf(player)];
}

function layoutLanes() {
  if (cameraActive) return;
  const list = present();
  list.forEach((player, index) => { actors[player].tx = LAYOUT.lanes[list.length - 1][index]; });
}

function astronautSize() {
  const h = LAYOUT.astronaut * size.h;
  return { h, w: h * .75 };
}

function handPoint(player) {
  const actor = actors[player];
  const { w, h } = astronautSize();
  const lean = actor.lean * Math.PI / 180;
  const ox = (HAND[0] - .5) * w;
  const oy = -(1 - HAND[1]) * h;
  const rx = ox * Math.cos(lean) - oy * Math.sin(lean);
  const ry = ox * Math.sin(lean) + oy * Math.cos(lean);
  return [(actor.x * size.w + rx) / size.w, (LAYOUT.feet * size.h - actor.hop * h * .06 + ry) / size.h];
}

/* ── 영감 생성과 이동 ──────────────────────────────── */
function pickSpot() {
  const { left, right, top, bottom } = LAYOUT.field;
  let best = null;
  let bestScore = -1;
  for (let i = 0; i < 18; i += 1) {
    const spot = [lerp(left, right, Math.random()), lerp(top, bottom, Math.random())];
    const score = Math.min(1, ...onScreen.map(f => Math.hypot((f.dest[0] - spot[0]) * 1.78, f.dest[1] - spot[1])));
    if (score > bestScore) { best = spot; bestScore = score; }
  }
  return best;
}

function spawn(time, initial = false) {
  const role = state === "idle" ? null : activeRole();
  const busy = new Set(onScreen.map(f => f.item.seed));
  let pool = catalog.filter(item => !selected.has(item.seed) && !busy.has(item.seed) && (!role || item.role === role));
  if (!pool.length) return;
  // 단어와 이미지가 번갈아 보이도록 화면에 적은 쪽을 우선한다.
  const images = onScreen.filter(f => f.item.kind === "image").length;
  const want = images * 2 < onScreen.length ? "image" : Math.random() < .55 ? "word" : "image";
  const kind = pool.filter(item => item.kind === want);
  if (kind.length) pool = kind;
  // 바탕 곡 분위기에 어울리는 영감이 먼저 떠오른다. 처음엔 거의 다, 쌓일수록 다양하게.
  const mood = SONGS.find(song => song.id === audio.base)?.mood;
  let fit = mood ? pool.filter(item => item.mood?.includes(mood)) : [];
  // 그 역할에 어울리는 영감이 너무 적으면(예: 리듬 곡의 base) 역할을 넓혀서 분위기를 우선한다.
  if (mood && fit.length < 3) {
    fit = catalog.filter(item => !selected.has(item.seed) && !busy.has(item.seed) && item.mood?.includes(mood));
  }
  const lean = selected.size < 4 ? .9 : selected.size < 10 ? .7 : .5;
  if (fit.length && Math.random() < lean) pool = fit;
  const item = pool[Math.floor(Math.random() * pool.length)];
  const button = document.createElement("button");
  button.type = "button";
  button.className = "item " + item.kind + " m-" + item.motion;
  button.tabIndex = -1;
  button.style.setProperty("--tint", ROLE_TINT[item.role]);
  button.setAttribute("aria-label", item.name + (item.back ? " (" + item.back + ")" : "") + " 낚기");
  button.innerHTML = '<span class="star"></span><span class="halo"></span>';
  button.append(itemBody(item));
  const angle = Math.random() * Math.PI * 2;
  const floater = {
    button, item, born: time - (initial ? APPROACH_MS * (.55 + Math.random() * .4) : 0),
    from: [LAYOUT.vanish[0] + Math.cos(angle) * .05, LAYOUT.vanish[1] + Math.sin(angle) * .035],
    dest: pickSpot(), x: .5, y: .34, scale: .1, ready: false, phase: Math.random() * 6.28, leaving: 0,
  };
  button.addEventListener("click", event => {
    if (cameraActive) return;
    event.stopPropagation();
    grabAt(selectedPlayer, floater);
  });
  floaters.append(button);
  // 긴 구절이 화면 밖으로 나가지 않게 도착 위치를 너비에 맞춘다.
  const half = button.querySelector(".body").offsetWidth / Math.max(1, size.w) / 2;
  floater.dest[0] = clamp(floater.dest[0], half + .02, 1 - half - .02);
  onScreen.push(floater);
}

function removeFloater(index) {
  onScreen[index].button.remove();
  onScreen.splice(index, 1);
}

function clearFloaters() {
  for (const f of onScreen) {
    f.leaving = performance.now();
    f.ready = false;
    f.button.classList.remove("ready", "aimed");
  }
}

function updateFloater(f, time) {
  const age = time - f.born;
  const p = clamp(age / APPROACH_MS, 0, 1);
  // 원근: z가 7에서 1로 다가오며 크기 = 1/z
  const z = lerp(7, 1, ease(p) * .4 + p * .6);
  let scale = 1 / z;
  const depth = (scale - 1 / 7) / (1 - 1 / 7);
  let x = f.from[0] + (f.dest[0] - f.from[0]) * depth;
  let y = f.from[1] + (f.dest[1] - f.from[1]) * depth;
  const hover = Math.max(0, age - APPROACH_MS);
  const calm = smooth(.55, 1, depth);
  x += Math.sin(time / 1700 + f.phase) * .006 * calm;
  y += Math.sin(time / 1210 + f.phase * 1.7) * .01 * calm;
  let opacity = smooth(0, .25, depth) * .65 + smooth(.25, .6, depth) * .35;
  if (f.leaving) {
    const t = clamp((time - f.leaving) / 900, 0, 1);
    scale *= 1 + t * .7;
    x += (x - .5) * t * .35;
    y += (y - LAYOUT.vanish[1]) * t * .35;
    opacity *= 1 - t;
    if (t >= 1) return false;
  } else if (hover > HOVER_MS) {
    f.leaving = time;
  }
  f.x = x; f.y = y; f.scale = scale;
  const reveal = smooth(.12, .42, depth);
  const s = f.button.style;
  s.setProperty("--x", (x * 100).toFixed(3) + "%");
  s.setProperty("--y", (y * 100).toFixed(3) + "%");
  s.setProperty("--s", scale.toFixed(4));
  s.setProperty("--o", opacity.toFixed(3));
  s.setProperty("--reveal", reveal.toFixed(3));
  s.setProperty("--calm", calm.toFixed(3));

  // 접근 효과: 멀 때 크게 움직이고, 낚을 거리에서는 읽기 좋게 잦아든다.
  const t = time + f.phase * 1000;
  let rx = 0, ry = 0, rz = 0, glow = 1;
  const wild = 1 - calm;
  switch (f.item.motion) {
    case "twinkle": {
      const flicker = Math.sin(t / 97) * Math.sin(t / 233 + 1.3) * Math.sin(t / 61);
      glow = 1 - wild * .55 * Math.max(0, flicker) - .12 * calm * (.5 + .5 * Math.sin(t / 420));
      rz = Math.sin(t / 1300) * 3;
      break;
    }
    case "spin": rz = wild * wild * 540 * (1 - depth) + Math.sin(t / 900) * 4 * calm; break;
    case "wave": rz = Math.sin(t / 1100) * (6 * wild + 2); s.setProperty("--amp", (.28 * wild + .07).toFixed(3) + "em"); break;
    case "drift": rx = 72 * wild * wild; rz = Math.sin(t / 1400) * 5; break;
    case "flip": {
      // 다가올 때는 빠르게, 머물 때는 한 면을 읽을 시간을 준 뒤 Y축으로 넘긴다.
      const period = lerp(1150, 2900, calm);
      const turn = lerp(.55, .3, calm);
      const cycle = Math.floor(t / period);
      const within = (t % period) / period;
      ry = (cycle + ease(clamp((within - (1 - turn)) / turn, 0, 1))) * 180;
      rz = Math.sin(t / 1600) * 3 * calm;
      break;
    }
    case "tumble":
      ry = Math.sin(t / 1000) * (16 + 40 * wild);
      rz = Math.sin(t / 1450) * (7 + 10 * wild) + wild * wild * 160;
      rx = Math.sin(t / 1250) * 8;
      break;
  }
  s.setProperty("--rx", rx.toFixed(1) + "deg");
  s.setProperty("--ry", ry.toFixed(1) + "deg");
  s.setProperty("--rz", rz.toFixed(1) + "deg");
  s.setProperty("--glow", glow.toFixed(3));

  const ready = state === "active" && !f.leaving && depth > .9;
  if (ready !== f.ready) {
    f.ready = ready;
    f.button.classList.toggle("ready", ready);
    f.button.tabIndex = ready ? 0 : -1;
  }
  return true;
}

function radiusOf(f) {
  const el = f.button.querySelector(".body");
  return Math.max(el.offsetWidth, el.offsetHeight) * f.scale * .5;
}

/* ── 그물, 낚기, 놓아주기 ─────────────────────────── */
function hoopRadius() { return LAYOUT.hoop * size.w; }

function targetOf(player) {
  const net = nets[player];
  const [nx, ny] = px(net.x, net.y);
  let best = null;
  let bestD = Infinity;
  for (const f of onScreen) {
    if (!f.ready) continue;
    const [fx_, fy] = px(f.x, f.y);
    const d = Math.hypot(fx_ - nx, fy - ny);
    if (d < hoopRadius() + radiusOf(f) * .55 && d < bestD) { best = f; bestD = d; }
  }
  return best;
}

function grabAt(player, floater) {
  if (state !== "active") return;
  if (!actors[player].present) join(player);
  const net = nets[player];
  net.x = net.tx = floater.x;
  net.y = net.ty = floater.y;
  catchItem(floater, player);
}

function catchItem(floater, player) {
  if (state !== "active" || !floater.ready || selected.has(floater.item.seed) || selected.size >= LIMIT) return false;
  const index = onScreen.indexOf(floater);
  const slot = slotsList.indexOf(null);
  if (index < 0 || slot < 0) return false;
  const item = { ...floater.item, player, slot, id: ++session, joinAt: nextBeat() };
  const previousRole = activeRole();
  selected.add(item.seed);
  slotsList[slot] = item;
  nets[player].swish = 1;
  nets[player].caught += 1;
  actors[player].hop = 1;
  const change = audio.capture(item);
  burst(floater.x, floater.y, PLAYERS[player].color, ROLE_TINT[item.role]);
  fly(floater, slot, player);
  removeFloater(index);
  warp = 1;
  drawTray(slot);
  drawLayers();
  if (change?.switched) {
    // 바탕을 놓아준 뒤 새로 낚으면 음악의 바탕 곡이 바뀐다
    warp = 1.6;
    status(PLAYERS[player].label + "번 · " + item.name + " · 음악의 바탕이 ‘" + change.switched + "’(으)로 바뀌었어요");
  } else status(PLAYERS[player].label + "번 · " + item.name + " · " + (item.soundLabel || "새 악기") + " 합류" + (item.anchor ? " · 이 영감이 음악의 바탕이에요" : ""));
  hint("");
  if (selected.size === LIMIT) {
    clearFloaters();
    setState("review");
    reviewSince = performance.now();
    status("15개가 모였어요. 함께 들어보세요. 왼손을 펴서 지우개로 내 칸을 문지르면 영감을 놓아줄 수 있어요.");
  } else if (previousRole !== activeRole()) clearFloaters();
  return true;
}

function release(index, player) {
  const item = slotsList[index];
  if (!item || state === "idle" || state === "ascend") return;
  if (item.player !== player) {
    status(PLAYERS[item.player].label + "번 관람객의 칸이에요.");
    return;
  }
  const rect = slots.children[index].getBoundingClientRect();
  const bounds = stage.getBoundingClientRect();
  const x = (rect.left + rect.width / 2 - bounds.left) / bounds.width;
  const y = (rect.top + rect.height / 2 - bounds.top) / bounds.height;
  for (let i = 0; i < 26; i += 1) {
    const a = -Math.PI / 2 + (Math.random() - .5) * 1.4;
    const v = 2 + Math.random() * 5;
    particles.push({ x: x * size.w, y: y * size.h, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, life: 1, decay: .012 + Math.random() * .01, size: 2 + Math.random() * 3, color: PLAYERS[player].light, drag: .985 });
  }
  const previousRole = activeRole();
  selected.delete(item.seed);
  slotsList[index] = null;
  audio.release(item);
  drawTray();
  drawLayers();
  if (state === "review") setState("active");
  if (previousRole !== activeRole()) clearFloaters();
  status("‘" + item.name + "’이 우주로 돌아갔어요.");
}

/* ── 연출: 파티클, 날아가는 아이템, 잔상 ───────────── */
function burst(x, y, color, tint) {
  const [cx, cy] = px(x, y);
  particles.push({ ring: true, x: cx, y: cy, r: hoopRadius() * .6, life: 1, decay: .03, color });
  for (let i = 0; i < 46; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const v = 2 + Math.random() * 9;
    particles.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, decay: .014 + Math.random() * .02, size: 1.5 + Math.random() * 3.5, color: i % 3 ? color : tint, drag: .93 });
  }
}

function fly(floater, slot, player) {
  const ghost = floater.button.querySelector(".body").cloneNode(true);
  ghost.classList.add("flying");
  ghost.style.setProperty("--player", PLAYERS[player].color);
  stage.append(ghost);
  const from = px(floater.x, floater.y);
  const target = slots.children[slot].getBoundingClientRect();
  const bounds = stage.getBoundingClientRect();
  const to = [target.left - bounds.left + target.width / 2, target.top - bounds.top + target.height / 2];
  const startScale = floater.scale;
  const endScale = Math.min(1, target.width / Math.max(1, ghost.offsetWidth) * .8);
  flights.push({ el: ghost, from, to, born: performance.now(), startScale, endScale, color: PLAYERS[player].color, slot });
}

function nextBeat() {
  return performance.now() + audio.nextJoinDelay() * 1000;
}

// 낚은 영감은 별가루가 되어 우주 배경에 성운처럼 떠 있는다 (art-particles.js)
function drawLayers() {
  const bounds = stage.getBoundingClientRect();
  artField.sync(slotsList.filter(Boolean), {
    colors: PLAYERS.map(p => p.color),
    tints: ROLE_TINT,
    origin(item) {
      const cell = slots.children[item.slot];
      if (!cell) return [.5, .95];
      const r = cell.getBoundingClientRect();
      return [(r.left + r.width / 2 - bounds.left) / bounds.width, (r.top + r.height / 2 - bounds.top) / bounds.height];
    },
  });
}

function drawTray(fresh = -1) {
  byId("count").textContent = String(selected.size).padStart(2, "0");
  slots.replaceChildren(...slotsList.map((item, index) => {
    const cell = document.createElement(item ? "button" : "span");
    cell.className = "slot " + (item ? "filled" : "empty") + (index === fresh ? " fresh" : "") + (item?.anchor ? " anchor" : "");
    cell.dataset.slot = index;
    if (item) {
      cell.type = "button";
      cell.style.setProperty("--player", PLAYERS[item.player].color);
      cell.style.setProperty("--tint", ROLE_TINT[item.role]);
      cell.setAttribute("aria-label", PLAYERS[item.player].label + "번 관람객의 " + item.name + " 놓아주기");
      cell.title = item.name + (item.back ? " · " + item.back : "") + (item.soundLabel ? " · " + item.soundLabel : "");
      cell.append(thumbnail(item));
      const mark = document.createElement("b");
      mark.textContent = PLAYERS[item.player].label;
      cell.append(mark);
      cell.addEventListener("click", () => release(index, cameraActive ? item.player : selectedPlayer));
    }
    return cell;
  }));
}

/* ── 그리기: 별, 그물, 파티클 ──────────────────────── */
const stars = Array.from({ length: 240 }, () => newStar(true));
function newStar(anywhere) {
  return { x: (Math.random() - .5) * 2, y: (Math.random() - .5) * 2, z: anywhere ? Math.random() : 1, hue: Math.random() };
}

function drawStars(dt) {
  const ctx = starsCanvas.getContext("2d");
  const { w, h, dpr } = size;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const [vx, vy] = px(...LAYOUT.vanish);
  const speed = (.000035 + warp * .00055 + beatPulse * .00004) * dt;
  for (const star of stars) {
    const pz = star.z;
    star.z -= speed;
    if (star.z <= .02) Object.assign(star, newStar(false));
    const sx = vx + star.x / star.z * w * .5;
    const sy = vy + star.y / star.z * h * .5;
    if (sx < -20 || sx > w + 20 || sy < -20 || sy > h + 20) { Object.assign(star, newStar(false)); continue; }
    const near = 1 - star.z;
    const r = .3 + near * near * 2.1;
    const alpha = smooth(0, .35, near) * .85;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = star.hue < .7 ? "#eaf2ff" : star.hue < .85 ? "#ffe4b0" : "#cfe0ff";
    if (warp > .15) {
      const ox = vx + star.x / pz * w * .5;
      const oy = vy + star.y / pz * h * .5;
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = r;
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(sx, sy); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawNet(ctx, player, time) {
  const net = nets[player];
  const color = PLAYERS[player].color;
  const light = PLAYERS[player].light;
  const [hx, hy] = px(...handPoint(player));
  const [nx, ny] = px(net.x, net.y);
  const R = hoopRadius() * (1 - net.swish * .18) * (net.closed ? .93 : 1);
  const angle = Math.atan2(ny - hy, nx - hx);
  const rimX = nx - Math.cos(angle) * R * .95;
  const rimY = ny - Math.sin(angle) * R * .78;

  // 자루: 나무색 막대에 선수 색 손잡이
  ctx.lineCap = "round";
  ctx.strokeStyle = "#2a1a10aa";
  ctx.lineWidth = size.w * .0062;
  ctx.beginPath(); ctx.moveTo(hx, hy + 3); ctx.lineTo(rimX, rimY + 3); ctx.stroke();
  const pole = ctx.createLinearGradient(hx, hy, rimX, rimY);
  pole.addColorStop(0, "#8a5a33"); pole.addColorStop(1, "#d9a066");
  ctx.strokeStyle = pole;
  ctx.lineWidth = size.w * .0042;
  ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(rimX, rimY); ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = size.w * .0058;
  ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(lerp(hx, rimX, .16), lerp(hy, rimY, .16)); ctx.stroke();

  ctx.save();
  ctx.translate(nx, ny);
  ctx.rotate(angle + Math.PI / 2 + Math.sin(net.swish * Math.PI) * .5);
  const ry = R * .82;
  // 그물 주머니: 고리 뒤로 늘어진 반투명 망
  ctx.save();
  ctx.beginPath(); ctx.ellipse(0, 0, R, ry, 0, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = "#ffffff12";
  ctx.fill();
  ctx.strokeStyle = "#f4ead0" + (net.closed ? "88" : "55");
  ctx.lineWidth = 1;
  const step = R / 4.2;
  for (let k = -R * 2; k <= R * 2; k += step) {
    ctx.beginPath(); ctx.moveTo(k - R, -R); ctx.lineTo(k + R, R); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(k + R, -R); ctx.lineTo(k - R, R); ctx.stroke();
  }
  ctx.restore();
  // 고리: 금빛 테 + 선수 색 빛
  const aimed = net.hover && net.hover.ready;
  ctx.shadowColor = color;
  ctx.shadowBlur = aimed ? 26 : 12;
  ctx.strokeStyle = aimed ? light : "#f2d08d";
  ctx.lineWidth = size.w * (aimed ? .0034 : .0026);
  ctx.beginPath(); ctx.ellipse(0, 0, R, ry, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = color;
  ctx.lineWidth = size.w * .0014;
  ctx.setLineDash([R * .22, R * .16]);
  ctx.lineDashOffset = -time / 40;
  ctx.beginPath(); ctx.ellipse(0, 0, R * 1.14, ry * 1.14, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // 머무르기 진행 표시 (손 인식이 없을 때 낚기, 칸 놓아주기)
  const progress = net.progress || 0;
  if (progress > 0) {
    ctx.strokeStyle = light;
    ctx.lineWidth = size.w * .004;
    ctx.beginPath();
    ctx.arc(nx, ny, R * 1.32, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
    ctx.stroke();
  }
}

function drawFx(time, dt) {
  const ctx = fx.getContext("2d");
  const { w, h, dpr } = size;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.globalCompositeOperation = "lighter";
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.life -= p.decay * dt / 16.7;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    ctx.globalAlpha = Math.min(1, p.life * 1.3);
    if (p.ring) {
      p.r += dt * .45;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3 * p.life;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
      continue;
    }
    p.vx *= p.drag; p.vy = p.vy * p.drag + .05;
    p.x += p.vx * dt / 16.7; p.y += p.vy * dt / 16.7;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (.4 + p.life * .6), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  if (state !== "idle") for (const player of present()) { drawNet(ctx, player, time); drawEraser(ctx, player, time); }
}

function updateFlights(time) {
  for (let i = flights.length - 1; i >= 0; i -= 1) {
    const f = flights[i];
    const t = clamp((time - f.born) / 820, 0, 1);
    const e = ease(t);
    const lift = Math.sin(t * Math.PI) * size.h * .12;
    const x = lerp(f.from[0], f.to[0], e);
    const y = lerp(f.from[1], f.to[1], e) - lift;
    f.el.style.transform = "translate(" + x + "px," + y + "px) translate(-50%,-50%) scale(" + lerp(f.startScale, f.endScale, e) + ") rotate(" + (t * 360) + "deg)";
    f.el.style.opacity = String(1 - smooth(.85, 1, t));
    if (Math.random() < .8) particles.push({ x, y, vx: (Math.random() - .5), vy: (Math.random() - .5), life: .8, decay: .03, size: 2.2, color: f.color, drag: .96 });
    if (t >= 1) {
      f.el.remove();
      flights.splice(i, 1);
      slots.children[f.slot]?.classList.add("landed");
    }
  }
}

/* ── 입력: 카메라 ──────────────────────────────────── */
function moveTracked(tracked, error) {
  if (error) {
    cameraActive = false;
    byId("camera").setAttribute("aria-pressed", "false");
    stage.classList.remove("camera-on");
    status("카메라 인식이 멈췄어요. 화면을 눌러 계속 낚을 수 있어요.");
    return;
  }
  const now = performance.now();
  const someone = tracked.some(Boolean);
  if (state === "idle") {
    // 시작 화면 없이, 사람이 잠깐 머물면 바로 우주인이 나타난다.
    presenceSince = someone ? presenceSince || now : 0;
    if (someone && now - presenceSince > 700) { presenceSince = 0; begin(); }
    return;
  }
  tracked.forEach((pose, player) => {
    const actor = actors[player];
    const net = nets[player];
    const eraser = erasers[player];
    if (!pose) {
      if (actor.present && now - actor.seen > 2000) leave(player);
      net.closed = false;
      eraser.on = false;
      return;
    }
    actor.seen = now;
    if (!actor.present) join(player);
    actor.tx = clamp(lerp(.12, .88, (pose.x - .12) / .76), .1, .9);
    const point = pose.palm || pose.wrist;
    net.hasHand = pose.grip !== null && pose.grip !== undefined;
    if (point) {
      // 어깨 기준 상대 위치로 그물을 움직여, 작은 동작으로도 화면 위쪽까지 닿게 한다.
      const rx = (point[0] - pose.shoulder[0]) * (4 / 3) / pose.span;
      const ry = (point[1] - pose.shoulder[1]) / pose.span;
      net.tx = clamp(actor.tx + .05 + rx * .14, .03, .97);
      net.ty = clamp(.44 + ry * .2, .07, .96);
    }
    if (net.hasHand) {
      net.grip = pose.grip;
      if (pose.closed && !net.closed) net.closedAt = now;
      net.closed = !!pose.closed;
    } else net.closed = false;
    // 왼손을 펴면 지우개가 나타나 왼손을 따라간다.
    const open = pose.leftPalm && pose.leftGrip !== null && pose.leftGrip < .4;
    if (open) {
      const rx = (pose.leftPalm[0] - pose.leftShoulder[0]) * (4 / 3) / pose.span;
      const ry = (pose.leftPalm[1] - pose.leftShoulder[1]) / pose.span;
      const tx = clamp(actor.tx - .05 + rx * .14, .03, .97);
      const ty = clamp(.44 + ry * .2, .07, .97);
      if (!eraser.on) { eraser.x = tx; eraser.y = ty; }
      eraser.tx = tx; eraser.ty = ty;
    }
    eraser.on = !!open;
  });
  separateActors();
}

function separateActors() {
  const list = present().sort((a, b) => actors[a].tx - actors[b].tx);
  for (let pass = 0; pass < 3; pass += 1) {
    for (let i = 1; i < list.length; i += 1) {
      const a = actors[list[i - 1]], b = actors[list[i]];
      const gap = .2 - (b.tx - a.tx);
      if (gap > 0) { a.tx -= gap / 2; b.tx += gap / 2; }
    }
  }
  for (const p of list) actors[p].tx = clamp(actors[p].tx, .1, .9);
}

/* ── 매 프레임 판정 ────────────────────────────────── */
function interact(time) {
  if (state === "idle") return;
  const trayCells = [...slots.children];
  const bounds = stage.getBoundingClientRect();
  for (const player of present()) {
    const net = nets[player];
    if (!cameraActive && player !== selectedPlayer) {
      // 마우스 시연에서 쉬고 있는 관람객의 그물은 자기 우주인 앞으로 돌아온다.
      net.tx = clamp(actors[player].x + .07, .05, .95);
      net.ty = .5;
      net.closed = false;
    }
    // 크게 움직일수록 빨리 따라붙고, 거의 멈춰 있을 때만 떨림을 걸러 낸다 (지연 감소).
    const gap = Math.hypot(net.tx - net.x, (net.ty - net.y) * .56);
    const follow = cameraActive ? clamp(.45 + gap * 9, .45, .9) : .6;
    net.x = lerp(net.x, net.tx, follow);
    net.y = lerp(net.y, net.ty, follow);
    net.swish = Math.max(0, net.swish - .045);
    net.progress = 0;

    // 낚기
    const target = targetOf(player);
    if (target !== net.hover) { net.hover = target; net.hoverSince = time; }
    for (const f of onScreen) if (f.aimBy === player && f !== target) { f.aimBy = null; f.button.classList.remove("aimed"); }
    if (target) {
      target.aimBy = player;
      target.button.classList.add("aimed");
      target.button.style.setProperty("--player", PLAYERS[player].color);
      const grabbed = net.closed && time - net.closedAt < 320;
      const dwell = cameraActive && !net.hasHand;
      if (grabbed) catchItem(target, player);
      else if (dwell) {
        net.progress = clamp((time - net.hoverSince) / DWELL_CATCH_MS, 0, 1);
        if (net.progress >= 1) catchItem(target, player);
      } else if (cameraActive && net.caught === 0) hint("손을 꽉 쥐어 낚아요!");
    }

    // 놓아주기: 자기 칸 위에서 주먹을 쥔 채 머무른다 (손 인식이 없으면 머무르기만)
    if (!cameraActive) continue;
    const x = bounds.left + net.x * bounds.width;
    const y = bounds.top + net.y * bounds.height;
    const index = trayCells.findIndex((el, i) => {
      if (slotsList[i]?.player !== player) return false;
      const r = el.getBoundingClientRect();
      return x >= r.left - 6 && x <= r.right + 6 && y >= r.top - 10 && y <= r.bottom + 10;
    });
    const holding = index >= 0 && (net.closed || !net.hasHand);
    if (!holding) { net.slot = null; continue; }
    if (net.slot !== index) { net.slot = index; net.slotSince = time; }
    const progress = clamp((time - net.slotSince) / HOLD_RELEASE_MS, 0, 1);
    net.progress = progress;
    trayCells[index].style.setProperty("--hold", progress);
    trayCells[index].classList.add("holding");
    if (progress >= 1) { release(index, player); net.slot = null; }
  }
  if (cameraActive) for (const player of present()) erase(player, time, trayCells, bounds);
  for (const [i, el] of trayCells.entries()) {
    if (!present().some(p => nets[p].slot === i || erasers[p].slot === i)) { el.classList.remove("holding"); el.style.removeProperty("--hold"); }
  }
}

// 지우개를 내 칸에 대고 있으면(문지를수록 빨리) 그 영감을 놓아준다.
function erase(player, time, trayCells, bounds) {
  const eraser = erasers[player];
  const dt = Math.min(50, time - (eraser.last || time));
  eraser.last = time;
  eraser.fade = clamp(eraser.fade + (eraser.on ? dt : -dt) / 220, 0, 1);
  if (!eraser.on) { eraser.slot = null; eraser.rub = 0; return; }
  eraser.x = lerp(eraser.x, eraser.tx, .35);
  eraser.y = lerp(eraser.y, eraser.ty, .35);
  const moved = Math.hypot((eraser.x - eraser.lx) * size.w, (eraser.y - eraser.ly) * size.h);
  eraser.lx = eraser.x; eraser.ly = eraser.y;
  const x = bounds.left + eraser.x * bounds.width;
  const y = bounds.top + eraser.y * bounds.height;
  const index = trayCells.findIndex((el, i) => {
    if (slotsList[i]?.player !== player) return false;
    const r = el.getBoundingClientRect();
    return x >= r.left - 10 && x <= r.right + 10 && y >= r.top - 14 && y <= r.bottom + 14;
  });
  if (index < 0) { eraser.slot = null; eraser.rub = 0; return; }
  if (eraser.slot !== index) { eraser.slot = index; eraser.rub = 0; }
  eraser.rub += dt / ERASE_MS + Math.min(moved, 40) / 900;
  const progress = clamp(eraser.rub, 0, 1);
  trayCells[index].style.setProperty("--hold", progress);
  trayCells[index].classList.add("holding");
  if (moved > 2 && Math.random() < .6) {
    particles.push({ x: eraser.x * size.w, y: eraser.y * size.h, vx: (Math.random() - .5) * 3, vy: -Math.random() * 2.5, life: .9, decay: .03, size: 2 + Math.random() * 2, color: "#ffd9e6", drag: .95 });
  }
  if (progress >= 1) {
    release(index, player);
    eraser.slot = null; eraser.rub = 0; eraser.used += 1;
  }
}

function drawEraser(ctx, player, time) {
  const eraser = erasers[player];
  if (eraser.fade <= 0) return;
  const [x, y] = px(eraser.x, eraser.y);
  const w = size.w * .05, h = w * .55;
  const scrub = eraser.slot !== null ? Math.sin(time / 45) * .12 : 0;
  ctx.save();
  ctx.globalAlpha = eraser.fade;
  ctx.translate(x, y);
  ctx.rotate(-.35 + scrub);
  ctx.shadowColor = PLAYERS[player].color;
  ctx.shadowBlur = eraser.slot !== null ? 28 : 14;
  const r = h * .28;
  const round = (x0, y0, ww, hh) => {
    ctx.beginPath();
    ctx.moveTo(x0 + r, y0); ctx.lineTo(x0 + ww - r, y0); ctx.quadraticCurveTo(x0 + ww, y0, x0 + ww, y0 + r);
    ctx.lineTo(x0 + ww, y0 + hh - r); ctx.quadraticCurveTo(x0 + ww, y0 + hh, x0 + ww - r, y0 + hh);
    ctx.lineTo(x0 + r, y0 + hh); ctx.quadraticCurveTo(x0, y0 + hh, x0, y0 + hh - r);
    ctx.lineTo(x0, y0 + r); ctx.quadraticCurveTo(x0, y0, x0 + r, y0); ctx.closePath();
  };
  // 분홍 고무 + 선수 색 슬리브 + 금빛 테
  round(-w / 2, -h / 2, w, h);
  const body = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  body.addColorStop(0, "#ffe3ec"); body.addColorStop(1, "#f6a9c1");
  ctx.fillStyle = body; ctx.fill();
  ctx.shadowBlur = 0;
  ctx.save(); ctx.clip();
  ctx.fillStyle = PLAYERS[player].color;
  ctx.fillRect(w * .02, -h / 2, w * .48, h);
  ctx.fillStyle = "#ffffff55";
  ctx.fillRect(-w / 2, -h / 2, w, h * .22);
  ctx.restore();
  round(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = "#f2d08d"; ctx.lineWidth = size.w * .0018; ctx.stroke();
  ctx.restore();
}

function updateActors(time) {
  for (const player of present()) {
    const actor = actors[player];
    if (!actor.el) continue;
    actor.x = lerp(actor.x, actor.tx, cameraActive ? .18 : .12);
    const net = nets[player];
    const reach = clamp((net.x - actor.x) * 40, -9, 9);
    actor.lean = lerp(actor.lean, reach, .1);
    actor.hop = Math.max(0, actor.hop - .04);
    const bob = Math.sin(time / 520 + player * 2) * .5 + .5;
    const s = actor.el.style;
    s.setProperty("--x", (actor.x * 100).toFixed(2) + "%");
    s.setProperty("--lean", actor.lean.toFixed(2) + "deg");
    s.setProperty("--bob", (bob * .012 + Math.sin(actor.hop * Math.PI) * .07).toFixed(4));
    s.setProperty("--squash", (1 - Math.sin(actor.hop * Math.PI) * .05).toFixed(3));
  }
}

function beatTick(time) {
  const beat = audio.beat?.();
  let phase;
  if (beat && typeof beat.phase === "number") phase = beat.phase;
  else phase = ((time - beatOrigin) % BEAT_MS) / BEAT_MS;
  const index = Math.floor((time - beatOrigin) / BEAT_MS);
  if (index !== lastBeat) lastBeat = index;
  beatPulse = Math.pow(1 - phase, 3);
  stage.style.setProperty("--beat", beatPulse.toFixed(3));
}

let lastTime = performance.now();
// 화면이 버거우면(초당 45프레임 아래가 2초 이상) 자동으로 가벼운 모드로 바꾼다.
let frameAvg = 16.7;
let slowSince = 0;
function watchPerformance(time, raw) {
  frameAvg = frameAvg * .95 + raw * .05;
  if (!stage.classList.contains("lite")) {
    if (frameAvg > 22) { slowSince ||= time; if (time - slowSince > 2000) { stage.classList.add("lite"); stars.length = 110; resize(); } }
    else slowSince = 0;
  }
  const panel = byId("perf");
  if (panel && !panel.hidden) {
    const cam = tracker.stats || {};
    panel.textContent = "화면 " + Math.round(1000 / frameAvg) + "fps" + (stage.classList.contains("lite") ? " (가벼운 모드)" : "") +
      " · 카메라 " + Math.round(cam.fps || 0) + "fps · 인식 " + Math.round(cam.detectMs || 0) + "ms · " + (cam.delegate || "-");
  }
}

function frame(time) {
  const raw = time - lastTime;
  const dt = Math.min(50, raw);
  lastTime = time;
  watchPerformance(time, Math.min(200, raw));
  const limit = state === "idle" ? 7 : state === "active" ? 6 : 0;
  const live = onScreen.filter(f => !f.leaving).length;
  if (live < limit && time - lastSpawn > 650) {
    spawn(time);
    lastSpawn = time;
  }
  for (let i = onScreen.length - 1; i >= 0; i -= 1) if (!updateFloater(onScreen[i], time)) removeFloater(i);
  beatTick(time);
  interact(time);
  updateActors(time);
  updateFlights(time);
  housekeeping(time);
  warp = Math.max(0, warp - dt * .0016);
  drawStars(dt);
  drawFx(time, dt);
  const energy = Math.min(.85, audio.energy() * 2);
  artField.draw(time, { energy, beat: beatPulse, state });
  stage.style.setProperty("--energy", energy.toFixed(2));
  requestAnimationFrame(frame);
}

/* ── 라운드 ───────────────────────────────────────── */
function startRound() {
  for (let i = onScreen.length - 1; i >= 0; i -= 1) removeFloater(i);
  setState("active");
  selected.clear();
  slotsList.fill(null);
  for (const player of present()) leave(player);
  for (const net of nets) Object.assign(net, { closed: false, caught: 0, hover: null, slot: null });
  audio.clear();
  beatOrigin = performance.now();
  if (!cameraActive) join(selectedPlayer);
  drawTray();
  drawLayers();
  for (let i = 0; i < 4; i += 1) spawn(performance.now(), true);
  status(cameraActive ? "오른손으로 그물을 움직이고, 손을 꽉 쥐어 영감을 낚으세요." : "마우스로 그물을 움직이고 클릭해서 낚으세요. 내 칸을 누르면 놓아줍니다.");
}

function selectPlayer(player) {
  selectedPlayer = player;
  for (const button of byId("players").querySelectorAll("button")) button.setAttribute("aria-pressed", String(Number(button.dataset.player) === player));
  if (state !== "idle" && !cameraActive) join(player);
}

function wakeAudio() {
  audio.start().catch(() => status("소리를 켜려면 화면을 한 번 눌러 주세요."));
}

function begin() {
  wakeAudio();
  startRound();
}

function resetToIdle() {
  for (const player of present()) leave(player);
  clearFloaters();
  selected.clear();
  slotsList.fill(null);
  audio.clear();
  drawTray();
  drawLayers();
  hint("");
  setState("idle");
  status("빈 우주로 돌아왔어요. 카메라 앞에 서면 다시 시작해요.");
}

// 사람이 모두 떠나거나 완성 장면이 끝나면 저절로 처음으로 돌아간다.
function housekeeping(time) {
  if (state === "review" && time - reviewSince > REVIEW_RESET_MS) { ascend(); return; }
  if (state === "idle" || state === "ascend" || !cameraActive) { emptySince = 0; return; }
  if (present().length) emptySince = 0;
  else if (!emptySince) emptySince = time;
  else if (time - emptySince > EMPTY_RESET_MS) {
    emptySince = 0;
    if (state === "review") ascend(); else resetToIdle();
  }
}

/* ── 엔딩: 15개 영감이 하늘로 올라가 별자리가 되고, 그날의 하늘에 남는다 ── */
const SKY_KEY = "inspiration-universe-sky-" + new Date().toLocaleDateString("sv");
let constellations = [];
try { constellations = JSON.parse(localStorage.getItem(SKY_KEY) || "[]"); } catch {}

function saveSky() {
  try { localStorage.setItem(SKY_KEY, JSON.stringify(constellations.slice(-60))); } catch {}
}

// 별자리 한 개의 자리와 모양: 기존 별자리와 겹치지 않는 하늘 위쪽에 둔다.
function planConstellation(items) {
  let center = [.5, .3];
  let best = -1;
  for (let i = 0; i < 40; i += 1) {
    const c = [.14 + Math.random() * .72, .1 + Math.random() * .38];
    const room = Math.min(1, ...constellations.slice(-24).map(k => Math.hypot((k.c[0] - c[0]) * 1.78, k.c[1] - c[1])));
    if (room > best) { best = room; center = c; }
  }
  // 영감 목록으로 정해지는 난수: 같은 조합이면 같은 모양
  let seed = items.reduce((a, item) => (a * 31 + item.seed + 7) % 2147483647, 17);
  const rand = () => (seed = seed * 48271 % 2147483647) / 2147483647;
  const rx = .1 + rand() * .035, ry = .1 + rand() * .04;
  const points = [];
  for (const item of items) {
    let best = null, bestGap = -1;
    for (let t = 0; t < 24; t += 1) {
      const a = rand() * Math.PI * 2, r = Math.sqrt(rand());
      const q = [center[0] + Math.cos(a) * rx * r, center[1] + Math.sin(a) * ry * r];
      const gap = Math.min(1, ...points.map(o => Math.hypot((o[0] - q[0]) * 1.78, o[1] - q[1])));
      if (gap > bestGap) { best = q; bestGap = gap; }
      if (gap > .05) break;
    }
    points.push([+best[0].toFixed(4), +clamp(best[1], .05, .62).toFixed(4), item.player]);
  }
  // 가까운 별끼리 잇는 최소 신장 트리: 실제 별자리처럼 가지가 갈라진다
  const edges = [];
  const linked = new Set([0]);
  while (linked.size < points.length) {
    let pick = null, bestD = Infinity;
    for (const i of linked) points.forEach((q, j) => {
      if (linked.has(j)) return;
      const d = Math.hypot((points[i][0] - q[0]) * 1.78, points[i][1] - q[1]);
      if (d < bestD) { bestD = d; pick = [i, j]; }
    });
    linked.add(pick[1]);
    edges.push(pick);
  }
  const now = new Date();
  const label = (now.getMonth() + 1) + "월 " + now.getDate() + "일 " + now.toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" }) + "의 별자리";
  return { c: center, p: points, e: edges, label, t: now.getTime() };
}

function constellationSvg(k, fresh) {
  const ns = "http://www.w3.org/2000/svg";
  const g = document.createElementNS(ns, "g");
  g.setAttribute("class", "constellation" + (fresh ? " fresh" : ""));
  const edges = k.e || k.p.slice(1).map((_, i) => [i, i + 1]);
  edges.forEach(([a, b], n) => {
    const line = document.createElementNS(ns, "path");
    line.setAttribute("d", "M" + (k.p[a][0] * 1600).toFixed(1) + " " + (k.p[a][1] * 900).toFixed(1) + "L" + (k.p[b][0] * 1600).toFixed(1) + " " + (k.p[b][1] * 900).toFixed(1));
    line.setAttribute("pathLength", "1");
    line.style.setProperty("--n", n);
    g.append(line);
  });
  k.p.forEach(([x, y, player], i) => {
    const star = document.createElementNS(ns, "circle");
    star.setAttribute("cx", (x * 1600).toFixed(1));
    star.setAttribute("cy", (y * 900).toFixed(1));
    star.setAttribute("r", i === 0 ? "5" : (2.2 + (i * 7 % 5) * .45).toFixed(1));
    star.style.setProperty("--player", PLAYERS[player]?.color || "#fff");
    star.style.setProperty("--i", i);
    g.append(star);
  });
  const text = document.createElementNS(ns, "text");
  const top = Math.min(...k.p.map(p => p[1]));
  text.setAttribute("x", (k.c[0] * 1600).toFixed(1));
  text.setAttribute("y", (Math.max(.04, top - .025) * 900).toFixed(1));
  text.textContent = k.label;
  g.append(text);
  return g;
}

function drawSky() {
  const svg = byId("sky-constellations");
  if (!svg) return;
  const list = constellations.slice(-40);
  svg.replaceChildren(...list.map((k, i) => {
    const g = constellationSvg(k, false);
    g.style.setProperty("--age", (list.length - 1 - i) / Math.max(1, list.length));
    return g;
  }));
}

function ascend() {
  if (state !== "review") return;
  const items = slotsList.filter(Boolean);
  if (!items.length) { resetToIdle(); return; }
  const people = present();
  setState("ascend");
  hint("");
  status("우리의 음악이 별자리가 되어 하늘에 남았어요.");
  const k = planConstellation(items);
  const bounds = stage.getBoundingClientRect();
  const cells = [...slots.children];
  items.forEach((item, i) => {
    const cell = cells[slotsList.indexOf(item)];
    if (!cell) return;
    const r = cell.getBoundingClientRect();
    const ghost = (cell.querySelector("img, .slot-word") || cell).cloneNode(true);
    ghost.className = "rising";
    ghost.style.setProperty("--player", PLAYERS[item.player].color);
    stage.append(ghost);
    const from = [r.left - bounds.left + r.width / 2, r.top - bounds.top + r.height / 2];
    const to = [k.p[i][0] * bounds.width, k.p[i][1] * bounds.height];
    ghost.style.left = from[0] + "px";
    ghost.style.top = from[1] + "px";
    ghost.style.width = r.width * .8 + "px";
    const lift = -bounds.height * (.12 + Math.random() * .08);
    ghost.animate([
      { transform: "translate(-50%,-50%) scale(1)", opacity: 1 },
      { transform: `translate(calc(-50% + ${(to[0] - from[0]) * .5}px), calc(-50% + ${(to[1] - from[1]) * .5 + lift}px)) scale(.6) rotate(140deg)`, opacity: 1, offset: .55 },
      { transform: `translate(calc(-50% + ${to[0] - from[0]}px), calc(-50% + ${to[1] - from[1]}px)) scale(.06) rotate(300deg)`, opacity: 0 },
    ], { duration: 2300, delay: i * 140, easing: "cubic-bezier(.5,0,.3,1)", fill: "both" }).finished.then(() => {
      ghost.remove();
      for (let n = 0; n < 14; n += 1) {
        const a = Math.random() * Math.PI * 2, v = 1 + Math.random() * 4;
        particles.push({ x: to[0], y: to[1], vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, decay: .03, size: 1.5 + Math.random() * 2, color: PLAYERS[item.player].light, drag: .92 });
      }
    });
  });
  // 영감이 모두 자리를 잡으면 선이 이어지고 이름이 붙는다.
  const settle = 2300 + items.length * 140;
  setTimeout(() => {
    constellations.push(k);
    saveSky();
    drawSky();
    const svg = byId("sky-constellations");
    svg.lastChild?.classList.add("fresh");
  }, settle - 200);
  setTimeout(() => {
    if (state !== "ascend") return;
    if (cameraActive && people.some(p => actors[p].present)) {
      startRound();
      for (const player of people) join(player);
      status("앞선 별자리 아래에서 새 우주가 시작돼요.");
    } else resetToIdle();
  }, settle + 3600);
}

/* ── 이벤트 ───────────────────────────────────────── */
function pointer(event) {
  const rect = stage.getBoundingClientRect();
  return [(event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height];
}

byId("again").addEventListener("click", () => { if (state === "review") ascend(); else startRound(); });
drawSky();
byId("players").addEventListener("click", event => {
  const button = event.target.closest("button[data-player]");
  if (button) selectPlayer(Number(button.dataset.player));
});
stage.addEventListener("pointermove", event => {
  if (state === "idle" || cameraActive) return;
  const [x, y] = pointer(event);
  nets[selectedPlayer].tx = x;
  nets[selectedPlayer].ty = y;
});
stage.addEventListener("pointerdown", event => {
  wakeAudio();
  if (state === "idle" && !cameraActive) { begin(); return; }
  if (state !== "active" || cameraActive || event.target.closest("button")) return;
  const net = nets[selectedPlayer];
  [net.tx, net.ty] = pointer(event);
  net.x = net.tx; net.y = net.ty;
  net.closed = true;
  net.closedAt = performance.now();
  net.swish = .6;
});
window.addEventListener("pointerup", () => { if (!cameraActive) nets[selectedPlayer].closed = false; });
document.addEventListener("keydown", event => {
  if (["1", "2", "3"].includes(event.key) && !event.repeat) selectPlayer(Number(event.key) - 1);
  if (event.key === "v" || event.key === "V") stage.classList.toggle("show-camera");
  if (event.key === "f" || event.key === "F") byId("perf").hidden = !byId("perf").hidden;
  if (event.key === "l" || event.key === "L") { stage.classList.toggle("lite"); resize(); }
  // 운영용: Shift + C 로 오늘 쌓인 별자리를 모두 지운다.
  if (event.key === "C" && event.shiftKey) { constellations = []; saveSky(); drawSky(); status("오늘의 별자리를 비웠어요."); }
  if (event.key === " " && state === "active" && !cameraActive) {
    event.preventDefault();
    const net = nets[selectedPlayer];
    net.closed = true; net.closedAt = performance.now(); net.swish = .6;
    setTimeout(() => { net.closed = false; }, 200);
  }
});
byId("mute").addEventListener("click", () => {
  const muted = audio.toggleMute();
  byId("mute").setAttribute("aria-pressed", String(muted));
  byId("mute").textContent = muted ? "소리 켜기" : "소리 끄기";
});
byId("fullscreen").hidden = !stage.requestFullscreen;
byId("fullscreen").addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await stage.requestFullscreen();
  } catch { status("이 브라우저에서 전체 화면을 열 수 없어요."); }
});
byId("camera").addEventListener("click", async () => {
  const button = byId("camera");
  if (cameraActive) {
    tracker.stop();
    cameraActive = false;
    stage.classList.remove("camera-on");
    button.setAttribute("aria-pressed", "false");
    status("카메라를 껐어요. 화면을 눌러 마우스로 참여하세요.");
    return;
  }
  await startCamera();
});

async function startCamera() {
  const button = byId("camera");
  button.disabled = true;
  status("카메라와 손 인식 모델을 준비하고 있어요.");
  try {
    audio.start().catch(() => {});
    await tracker.start();
    cameraActive = true;
    stage.classList.add("camera-on");
    for (const player of present()) leave(player);
    button.setAttribute("aria-pressed", "true");
    if (state !== "idle") resetToIdle();
    status(tracker.mode === "hand"
      ? "카메라 준비 완료. 앞에 서면 우주인이 나타나요. (V: 카메라 미리보기)"
      : "손 모델을 불러오지 못해, 그물을 영감 위에 잠시 머무르면 낚이도록 바꿨어요.");
  } catch (error) {
    // 원인별로 다르게 알려 준다. 화면을 누르면 마우스로 참여할 수 있다.
    const reasons = {
      NotAllowedError: "카메라 권한이 막혀 있어요. 주소창 왼쪽에서 카메라를 허용하거나, 윈도우 설정 → 개인 정보 → 카메라를 켜 주세요.",
      NotFoundError: "연결된 웹캠을 찾지 못했어요. 웹캠 연결을 확인해 주세요.",
      NotReadableError: "다른 프로그램(줌, OBS, 카메라 앱 등)이 웹캠을 쓰고 있거나 윈도우가 막고 있어요. 그 프로그램을 닫아 주세요.",
      OverconstrainedError: "웹캠이 요청한 화면 크기를 지원하지 않아요.",
      ModelLoadError: "웹캠은 켜졌지만 손 인식 모델을 못 받았어요. 인터넷 연결을 확인하거나 vendor/models 파일을 받아 두세요.",
      SecurityError: "이 주소에서는 카메라를 쓸 수 없어요. https 주소나 127.0.0.1 로 열어 주세요.",
    };
    status((reasons[error.name] || "카메라를 켤 수 없어요 (" + error.name + ": " + error.message + ").") + " 화면을 눌러 마우스로도 참여할 수 있어요.");
    console.error("[영감의 우주] 카메라 오류", error);
  } finally { button.disabled = false; }
}
byId("save").addEventListener("click", async () => {
  const button = byId("save");
  button.disabled = true;
  try {
    const url = URL.createObjectURL(await audio.render(slotsList.filter(Boolean)));
    const link = document.createElement("a");
    link.href = url;
    link.download = "영감의-우주-앙상블.wav";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 15000);
    status("완성한 합주를 WAV로 저장했어요.");
  } catch { status("음원 저장에 문제가 생겼어요. 다시 시도해 주세요."); }
  finally { button.disabled = false; }
});
// 우주 유영: 매 바퀴마다 다른 지점으로 빨려 들어가도록 확대 중심을 바꾼다.
for (const layer of stage.querySelectorAll(".sky i")) {
  const aim = () => {
    layer.style.setProperty("--ox", (25 + Math.random() * 50).toFixed(1) + "%");
    layer.style.setProperty("--oy", (25 + Math.random() * 40).toFixed(1) + "%");
  };
  aim();
  layer.addEventListener("animationiteration", aim);
}
// assets/space-flight.mp4 가 있으면 (예: Higgsfield로 만든 우주 비행 영상) 사진 대신 영상을 배경으로 쓴다.
{
  const video = byId("sky-video");
  video.addEventListener("loadeddata", () => { stage.classList.add("has-video"); video.play().catch(() => {}); });
  video.addEventListener("error", () => stage.classList.remove("has-video"));
  video.src = "./assets/space-flight.mp4";
}
window.addEventListener("pagehide", () => tracker.stop());
new ResizeObserver(resize).observe(stage);
resize();
setState("idle");
drawTray();
for (let i = 0; i < 5; i += 1) spawn(performance.now(), true);
requestAnimationFrame(frame);
// 전시 PC에서는 페이지가 열리면 바로 카메라와 소리를 켠다 (권한을 한 번 허용해 두면 다음부터 묻지 않는다).
wakeAudio();
if (new URLSearchParams(location.search).get("camera") !== "off") startCamera();
// 점검용: 주소에 ?debug=1 을 붙이면 콘솔에서 가짜 관람객 입력을 넣어 볼 수 있다.
if (new URLSearchParams(location.search).get("debug") === "1") {
  window.__universe = {
    moveTracked, slotsList,
    fakeCamera(on = true) { cameraActive = on; stage.classList.toggle("camera-on", on); },
    fill() {
      catalog.slice(0, LIMIT).forEach((base, i) => {
        const item = { ...base, seed: base.seed * 7 % catalog.length, player: i % 3, slot: i, id: ++session, joinAt: 0 };
        Object.assign(item, catalog[item.seed], { player: i % 3, slot: i });
        slotsList[i] = item; selected.add(item.seed);
      });
      drawTray(); drawLayers(); clearFloaters(); setState("review");
    },
  };
}
