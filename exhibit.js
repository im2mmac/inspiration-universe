import { UniverseAudio } from "./audio-engine.js";
import { WristCamera } from "./camera.js";

const catalog = [
  ["심연의 어둠", "base"], ["아득한 우주", "base"], ["안개", "base"], ["밤기차", "base"],
  ["숨결", "base"], ["브롬톤 자전거", "base", "bicycle"], ["접히는 바다", "base", "wave"],
  ["호수의 반짝임", "melody"], ["물속의 보름달", "melody"], ["그리운 목소리", "melody"],
  ["새벽빛", "melody"], ["Luz de madrugada", "melody"], ["물방울", "melody"],
  ["유리 해파리", "melody", "jelly"], ["달빛을 담은 우체통", "melody", "mailbox"],
  ["얼음 레코드", "melody", "record"], ["첫눈", "texture"], ["미열", "texture"],
  ["Fernweh", "texture"], ["共鸣", "texture"], ["야광별", "texture"], ["여운", "texture"],
  ["신호를 먹는 고양이", "texture", "cat"], ["버섯 위성", "texture", "mushroom"],
].map(([name, role, image], seed) => ({ name, role, image, seed }));

const palette = ["#a1f9ec", "#f3cd83", "#e4b6fd"];
const suits = ["teal", "gold", "violet"];
const spots = [[.16,.26],[.31,.20],[.47,.29],[.67,.21],[.84,.32],[.22,.45],[.39,.48],[.61,.47],[.79,.49]];
const byId = id => document.getElementById(id);
const stage = byId("stage");
const floaters = byId("floaters");
const slots = byId("slots");
const audio = new UniverseAudio();
const selected = new Set();
const slotsList = Array.from({ length: 15 }, () => null);
const participants = new Set();
const onScreen = [];
const tracker = new WristCamera(byId("camera-feed"), moveTracked);
const poses = Array(3).fill(null);
const holds = Array(3).fill(null);
let state = "idle";
let selectedPlayer = 0;
let lastSpawn = 0;
let session = 0;
let keyboardEvent = false;
let cameraActive = false;

function status(message) {
  byId("status").textContent = message;
}

function thumbnail(item) {
  if (!item.image) return document.createTextNode(item.name);
  const image = new Image();
  image.src = "./assets/" + item.image + ".webp";
  image.alt = item.name;
  image.draggable = false;
  return image;
}

function slotText(item) {
  if (item.image) return thumbnail(item);
  const span = document.createElement("span");
  span.textContent = item.name.length > 3 ? item.name.slice(0, 3) + "…" : item.name;
  return span;
}

function setState(next) {
  state = next;
  stage.dataset.state = next;
  byId("opening").hidden = next !== "idle";
  byId("tray").hidden = next === "idle";
  byId("finish").hidden = next !== "review";
}

function drawLayers() {
  byId("art-layers").replaceChildren(...slotsList.filter(Boolean).map((item, index) => {
    const ring = document.createElement("span");
    const angle = index * 2.39 + item.seed * .11;
    const radius = .17 + (index % 5) * .025;
    ring.className = "art-layer" + (item.image ? "" : " textures");
    ring.style.setProperty("--x", (50 + 100 * radius * Math.cos(angle)) + "%");
    ring.style.setProperty("--y", (41 + 64 * radius * Math.sin(angle)) + "%");
    ring.style.setProperty("--turn", (item.seed % 7 * 11 - 30) + "deg");
    ring.style.setProperty("--player", palette[item.player]);
    if (item.image) ring.append(thumbnail(item));
    return ring;
  }));
}

function drawTray() {
  drawLayers();
  byId("count").textContent = String(selected.size).padStart(2, "0");
  const cells = slotsList.map((item, index) => {
    const cell = document.createElement(item ? "button" : "span");
    cell.className = "slot " + (item ? "filled" : "empty");
    cell.dataset.slot = index;
    if (item) {
      cell.type = "button";
      cell.style.setProperty("--player", palette[item.player]);
      cell.setAttribute("aria-label", (item.player + 1) + "번 관람객의 " + item.name + " 놓아주기");
      cell.title = item.name;
      cell.append(slotText(item));
      cell.addEventListener("click", () => release(index, selectedPlayer));
    }
    return cell;
  });
  slots.replaceChildren(...cells);
}

function drawPeople() {
  const players = [...participants];
  const fallback = [[.48], [.30,.67], [.21,.48,.75]][Math.max(0, players.length - 1)];
  byId("actors").replaceChildren(...players.map((player, index) => {
    const holder = document.createElement("div");
    holder.dataset.actor = player;
    holder.dataset.left = fallback[index];
    holder.style.setProperty("--player", palette[player]);
    const picture = new Image();
    picture.className = "avatar";
    picture.alt = "";
    picture.src = "./assets/" + suits[player] + ".webp";
    picture.addEventListener("load", () => placeNet(player, poses[player]?.wrist), { once: true });
    const line = document.createElement("i");
    line.className = "net-handle";
    const head = document.createElement("i");
    head.className = "net-head";
    holder.append(picture, line, head);
    return holder;
  }));
  for (const player of players) placeNet(player, poses[player]?.wrist);
}

function placeNet(player, target) {
  const element = byId("actors").querySelector('[data-actor="' + player + '"]');
  if (!element) return;
  const x = poses[player]?.x ?? Number(element.dataset.left);
  const [nx, ny] = target || [Math.min(.93, x + .11), .49];
  const holder = element.style;
  holder.setProperty("--left", x * 100 + "%");
  const avatar = element.querySelector(".avatar");
  const ratio = avatar.naturalWidth && avatar.naturalHeight ? avatar.naturalWidth / avatar.naturalHeight : .7;
  const spriteWidth = Math.min(avatar.clientWidth, avatar.clientHeight * ratio);
  const spriteHeight = spriteWidth / ratio;
  const handX = [.93, .93, .91][player];
  const handY = [.36, .29, .20][player];
  const hx = x + spriteWidth * (handX - .5) / Math.max(1, stage.clientWidth);
  const hy = .895 - spriteHeight * (1 - handY) / Math.max(1, stage.clientHeight);
  const net = element.querySelector(".net-head");
  net.style.setProperty("--x", nx * 100 + "%");
  net.style.setProperty("--y", ny * 100 + "%");
  const line = element.querySelector(".net-handle");
  const dx = (nx - hx) * stage.clientWidth;
  const dy = (ny - hy) * stage.clientHeight;
  line.style.setProperty("--x", hx * 100 + "%");
  line.style.setProperty("--y", hy * 100 + "%");
  line.style.setProperty("--length", Math.hypot(dx, dy) + "px");
  line.style.setProperty("--angle", Math.atan2(dy, dx) + "rad");
}

function activeRole() {
  return selected.size < 4 ? "base" : selected.size < 10 ? "melody" : "texture";
}

function removeFloater(index) {
  onScreen[index].button.remove();
  onScreen.splice(index, 1);
}

function clearFloaters() {
  while (onScreen.length) removeFloater(onScreen.length - 1);
}

function spawn(time, initial = false) {
  const role = state === "idle" ? null : activeRole();
  const available = catalog.filter(item => (!role || item.role === role) && !selected.has(item.seed) && !onScreen.some(f => f.item.seed === item.seed));
  if (!available.length) return;
  const item = available[Math.floor(Math.random() * available.length)];
  const freeSpots = spots.filter((_, index) => !onScreen.some(f => f.spot === index));
  const destination = freeSpots[Math.floor(Math.random() * freeSpots.length)] || spots[0];
  const spot = spots.indexOf(destination);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "item";
  button.tabIndex = -1;
  button.setAttribute("aria-label", item.name + " 낚기");
  button.append(thumbnail(item));
  const floater = { button, item, born: time - (initial ? 1900 : 0), destination, spot, ready: false };
  button.addEventListener("click", () => {
    catchItem(floater, selectedPlayer);
    if (keyboardEvent) byId("players").querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true });
  });
  floaters.append(button);
  onScreen.push(floater);
}

function spark(x, y, player) {
  const shell = document.createElement("span");
  shell.className = "echo";
  for (let i = 0; i < 10; i += 1) {
    const point = document.createElement("i");
    const radius = 18 + 25 * Math.random();
    const angle = i * Math.PI / 5;
    point.style.setProperty("--player", palette[player]);
    point.style.setProperty("--x", x * 100 + "%");
    point.style.setProperty("--y", y * 100 + "%");
    point.style.setProperty("--dx", Math.cos(angle) * radius + "px");
    point.style.setProperty("--dy", Math.sin(angle) * radius + "px");
    shell.append(point);
  }
  byId("effects").append(shell);
  setTimeout(() => shell.remove(), 1400);
}

function catchItem(floater, player) {
  if (state !== "active" || !floater.ready || selected.has(floater.item.seed) || selected.size >= 15) return;
  const index = onScreen.indexOf(floater);
  if (index < 0) return;
  const slot = slotsList.indexOf(null);
  if (slot < 0) return;
  const item = { ...floater.item, player, id: ++session };
  const previousRole = activeRole();
  selected.add(item.seed);
  slotsList[slot] = item;
  if (!participants.has(player)) {
    participants.add(player);
    drawPeople();
  }
  audio.capture(item);
  spark(floater.x, floater.y, player);
  removeFloater(index);
  drawTray();
  status((player + 1) + "번 · " + item.name + "을 낚았어요.");
  if (selected.size === 15) {
    clearFloaters();
    setState("review");
    status("완성된 합주를 들어보세요. 자기 칸을 선택해 영감을 놓아줄 수도 있어요.");
  } else if (previousRole !== activeRole()) clearFloaters();
}

function release(index, player) {
  const item = slotsList[index];
  if (!item || state === "idle") return;
  if (item.player !== player) {
    status((item.player + 1) + "번 관람객의 칸이에요. 해당 관람객을 선택해 놓아주세요.");
    return;
  }
  const rect = slots.children[index].getBoundingClientRect();
  const bounds = stage.getBoundingClientRect();
  spark((rect.left + rect.width / 2 - bounds.left) / bounds.width, (rect.top - bounds.top) / bounds.height, player);
  const previousRole = activeRole();
  selected.delete(item.seed);
  slotsList[index] = null;
  audio.release(item);
  drawTray();
  if (state === "review") setState("active");
  if (previousRole !== activeRole()) clearFloaters();
  status(item.name + "이 우주로 돌아갔어요.");
}

function pointer(event) {
  const rect = stage.getBoundingClientRect();
  return [(event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height];
}

function moveTracked(tracked, error) {
  if (error) {
    cameraActive = false;
    byId("camera").setAttribute("aria-pressed", "false");
    status("카메라 인식이 멈췄어요. 화면을 눌러 계속 낚을 수 있어요.");
    return;
  }
  if (state === "idle") return;
  let changed = false;
  tracked.forEach((pose, player) => {
    if (!pose) return;
    poses[player] = pose;
    if (!participants.has(player)) {
      participants.add(player);
      changed = true;
    }
  });
  if (changed) drawPeople();
  for (let player = 0; player < tracked.length; player += 1) {
    const wrist = tracked[player]?.wrist;
    if (!wrist) { holds[player] = null; continue; }
    placeNet(player, wrist);
    const closest = onScreen.filter(item => item.ready)
      .find(item => Math.hypot((item.x - wrist[0]) * stage.clientWidth, (item.y - wrist[1]) * stage.clientHeight) < Math.max(21, stage.clientWidth * .032));
    if (closest) catchItem(closest, player);
    const bounds = stage.getBoundingClientRect();
    const x = bounds.left + wrist[0] * bounds.width;
    const y = bounds.top + wrist[1] * bounds.height;
    const cell = [...slots.children].find((el, index) => {
      const rect = el.getBoundingClientRect();
      return slotsList[index]?.player === player && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    });
    if (!cell) { holds[player] = null; continue; }
    const index = Number(cell.dataset.slot);
    const now = performance.now();
    if (holds[player]?.index !== index) holds[player] = { index, time: now };
    if (now - holds[player].time > 820) {
      release(index, player);
      holds[player] = null;
    }
  }
}

function selectPlayer(player) {
  selectedPlayer = player;
  for (const button of byId("players").querySelectorAll("button")) button.setAttribute("aria-pressed", String(Number(button.dataset.player) === player));
  if (state !== "idle" && !participants.has(player)) {
    participants.add(player);
    drawPeople();
  }
}

function startRound() {
  clearFloaters();
  setState("active");
  selected.clear();
  slotsList.fill(null);
  participants.clear();
  poses.fill(null);
  holds.fill(null);
  audio.clear();
  selectPlayer(0);
  drawTray();
  for (let i = 0; i < 4; i += 1) spawn(performance.now(), true);
  status(cameraActive ? "오른손으로 그물을 움직여 영감을 낚으세요." : "가까이 오는 영감을 눌러 낚으세요. 내 칸을 누르면 놓아줍니다.");
}

function frame(time) {
  const limit = state === "idle" ? 6 : state === "active" ? 5 : 0;
  if (onScreen.length < limit && time - lastSpawn > 520) {
    spawn(time);
    lastSpawn = time;
  }
  for (let index = onScreen.length - 1; index >= 0; index -= 1) {
    const item = onScreen[index];
    const age = time - item.born;
    if (age > 9900 && document.activeElement !== item.button) {
      removeFloater(index);
      continue;
    }
    const depth = Math.min(1, Math.max(0, age / 3800));
    const [endX, endY] = item.destination;
    item.x = .5 + (endX - .5) * (.36 + .64 * depth);
    item.y = .34 + (endY - .34) * (.38 + .62 * depth) + Math.sin(time / 1070 + item.spot) * .009;
    item.button.style.setProperty("--x", item.x * 100 + "%");
    item.button.style.setProperty("--y", item.y * 100 + "%");
    item.button.style.setProperty("--depth", .35 + depth * .67);
    item.button.style.setProperty("--opacity", .25 + depth * .75);
    const ready = state === "active" && age >= 1380;
    if (ready !== item.ready) {
      item.ready = ready;
      item.button.classList.toggle("ready", ready);
      item.button.tabIndex = ready ? 0 : -1;
    }
  }
  stage.style.setProperty("--energy", Math.min(.85, audio.energy() * 2).toFixed(2));
  requestAnimationFrame(frame);
}

byId("start").addEventListener("click", async () => {
  try {
    await audio.start();
    startRound();
  } catch { status("소리를 켤 수 없어요. 브라우저에서 다시 시도해 주세요."); }
});
byId("again").addEventListener("click", startRound);
byId("players").addEventListener("click", event => {
  const button = event.target.closest("button[data-player]");
  if (button) selectPlayer(Number(button.dataset.player));
});
stage.addEventListener("pointermove", event => {
  if (state === "active" && !cameraActive) placeNet(selectedPlayer, pointer(event));
});
document.addEventListener("keydown", event => {
  keyboardEvent = true;
  if (["1", "2", "3"].includes(event.key) && !event.repeat) selectPlayer(Number(event.key) - 1);
});
document.addEventListener("pointerdown", () => { keyboardEvent = false; });
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
    poses.fill(null);
    drawPeople();
    button.setAttribute("aria-pressed", "false");
    status("카메라를 껐어요. 화면을 눌러 영감을 낚으세요.");
    return;
  }
  button.disabled = true;
  status("카메라와 손 추적 모델을 준비하고 있어요.");
  try {
    await tracker.start();
    cameraActive = true;
    button.setAttribute("aria-pressed", "true");
    status(state === "idle" ? "카메라가 준비됐어요. 우주로 들어가세요." : "오른손을 움직여 영감을 낚으세요.");
  } catch (error) {
    status(error.name === "NotAllowedError" ? "카메라 권한을 확인하거나 화면을 눌러 참여하세요." : "카메라를 켤 수 없어요. 화면을 눌러 참여하세요.");
  } finally { button.disabled = false; }
});
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
setState("idle");
requestAnimationFrame(frame);
