import { UniverseAudio } from "./audio-engine.js";
import { WristCamera } from "./camera.js";
import { catalog } from "./items.js";

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
const BEAT_MS = 60000 / 92;
const APPROACH_MS = 5200;
const HOVER_MS = 7600;
const HOLD_RELEASE_MS = 1000;
const DWELL_CATCH_MS = 900;
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
  const dpr = Math.min(1.5, window.devicePixelRatio || 1);
  size = { w: rect.width, h: rect.height, dpr };
  for (const canvas of [fx, starsCanvas]) {
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
  }
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
function setState(next) {
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
  const item = { ...floater.item, player, id: ++session, joinAt: nextBeat() };
  const previousRole = activeRole();
  selected.add(item.seed);
  slotsList[slot] = item;
  nets[player].swish = 1;
  nets[player].caught += 1;
  actors[player].hop = 1;
  audio.capture(item);
  burst(floater.x, floater.y, PLAYERS[player].color, ROLE_TINT[item.role]);
  fly(floater, slot, player);
  removeFloater(index);
  warp = 1;
  drawTray(slot);
  drawLayers();
  status(PLAYERS[player].label + "번 · ‘" + item.name + "’을 낚았어요.");
  hint("");
  if (selected.size === LIMIT) {
    clearFloaters();
    setState("review");
    reviewSince = performance.now();
    status("15개가 모였어요. 함께 들어보세요. 자기 칸을 꽉 쥐면 영감을 놓아줄 수 있어요.");
  } else if (previousRole !== activeRole()) clearFloaters();
  return true;
}

function release(index, player) {
  const item = slotsList[index];
  if (!item || state === "idle") return;
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
  const now = performance.now();
  if (audio.beat()) return now + audio.nextJoinDelay() * 1000;
  return beatOrigin + Math.ceil((now - beatOrigin) / BEAT_MS) * BEAT_MS;
}

function drawLayers() {
  const items = slotsList.filter(Boolean);
  byId("art-layers").replaceChildren(...items.map((item, index) => {
    const ghost = document.createElement("span");
    const angle = index * 2.39996 + item.seed * .07;
    const radius = .2 + (index % 4) * .045;
    ghost.className = "art-layer " + item.kind;
    ghost.style.setProperty("--x", (50 + 100 * radius * Math.cos(angle)) + "%");
    ghost.style.setProperty("--y", (36 + 100 * radius * .56 * Math.sin(angle)) + "%");
    ghost.style.setProperty("--turn", (item.seed % 9 * 9 - 36) + "deg");
    ghost.style.setProperty("--player", PLAYERS[item.player].color);
    ghost.style.setProperty("--tint", ROLE_TINT[item.role]);
    ghost.style.setProperty("--delay", Math.max(0, item.joinAt - performance.now()) + "ms");
    if (item.kind === "image") {
      const image = new Image();
      image.src = "./assets/" + item.image + ".webp";
      image.alt = "";
      ghost.append(image);
    } else ghost.textContent = item.name;
    return ghost;
  }));
}

function drawTray(fresh = -1) {
  byId("count").textContent = String(selected.size).padStart(2, "0");
  slots.replaceChildren(...slotsList.map((item, index) => {
    const cell = document.createElement(item ? "button" : "span");
    cell.className = "slot " + (item ? "filled" : "empty") + (index === fresh ? " fresh" : "");
    cell.dataset.slot = index;
    if (item) {
      cell.type = "button";
      cell.style.setProperty("--player", PLAYERS[item.player].color);
      cell.style.setProperty("--tint", ROLE_TINT[item.role]);
      cell.setAttribute("aria-label", PLAYERS[item.player].label + "번 관람객의 " + item.name + " 놓아주기");
      cell.title = item.name + (item.back ? " · " + item.back : "");
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
  if (state !== "idle") for (const player of present()) drawNet(ctx, player, time);
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
    if (!pose) {
      if (actor.present && now - actor.seen > 2000) leave(player);
      net.closed = false;
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
    const follow = cameraActive ? .32 : .55;
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
  for (const [i, el] of trayCells.entries()) {
    if (!present().some(p => nets[p].slot === i)) { el.classList.remove("holding"); el.style.removeProperty("--hold"); }
  }
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
function frame(time) {
  const dt = Math.min(50, time - lastTime);
  lastTime = time;
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
  stage.style.setProperty("--energy", Math.min(.85, audio.energy() * 2).toFixed(2));
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
  if (state === "idle" || !cameraActive) { emptySince = 0; return; }
  if (present().length) emptySince = 0;
  else if (!emptySince) emptySince = time;
  else if (time - emptySince > EMPTY_RESET_MS) { emptySince = 0; resetToIdle(); return; }
  if (state === "review" && time - reviewSince > REVIEW_RESET_MS) {
    const people = present();
    startRound();
    if (cameraActive) for (const player of people) join(player);
  }
}

/* ── 이벤트 ───────────────────────────────────────── */
function pointer(event) {
  const rect = stage.getBoundingClientRect();
  return [(event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height];
}

byId("again").addEventListener("click", startRound);
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
    status(error.name === "NotAllowedError" ? "카메라 권한을 허용하거나 화면을 눌러 마우스로 참여하세요." : "카메라를 켤 수 없어요. 화면을 눌러 마우스로 참여하세요.");
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
