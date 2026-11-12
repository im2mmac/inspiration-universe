import { cueOptions, cueUrl, preferences, setPreference } from "../sound-options.js";
import { SunoLoops, loadSunoPack, selectedSunoPack, selectSunoPack, sunoCatalog } from "../suno-audio.js";
import { UniverseAudio, arrangementName, nextArrangement } from "../audio-engine.js";
import { inspirationSound } from "../inspiration-audio.js";
import { catalog } from "../items.js";

const host = document.querySelector("#cue-controls");
const tracks = [...document.querySelectorAll("audio")];
const audition = new Audio();
const selected = preferences();
let stopSuno = () => {};
let stopInspirations = () => {};

function stopTracks() {
  for (const track of tracks) track.pause();
}

for (const track of tracks) {
  track.addEventListener("play", () => {
    audition.pause();
    stopSuno();
    stopInspirations();
    for (const other of tracks) if (other !== track) other.pause();
  });
}

for (const [kind, option] of Object.entries(cueOptions)) {
  const row = document.createElement("div");
  row.className = "cue-row";
  const label = document.createElement("label");
  label.textContent = option.title;
  const select = document.createElement("select");
  select.id = "cue-" + kind;
  label.htmlFor = select.id;
  option.sounds.forEach((name, index) => select.add(new Option(name, index)));
  select.value = selected[kind];

  const play = document.createElement("button");
  play.type = "button";
  play.textContent = "듣기";
  play.setAttribute("aria-label", option.title + " 효과음 듣기");
  const download = document.createElement("a");
  download.textContent = "저장";
  download.download = "";
  const update = () => {
    download.href = cueUrl(kind, Number(select.value)).href;
  };
  update();

  select.addEventListener("change", () => {
    setPreference(kind, Number(select.value));
    update();
    document.querySelector("#cue-status").textContent = option.title + " 소리를 " + select.selectedOptions[0].text + "으로 선택했어요.";
  });
  play.addEventListener("click", async () => {
    stopTracks();
    stopSuno();
    stopInspirations();
    audition.src = download.href;
    try { await audition.play(); } catch {
      document.querySelector("#cue-status").textContent = "효과음을 재생할 수 없어요. 저장 링크로도 들을 수 있어요.";
    }
  });
  row.append(label, select, play, download);
  host.append(row);
}

async function setupSuno() {
  const packs = await sunoCatalog();
  if (!packs.length) return;
  const section = document.querySelector("#suno-check");
  const select = document.querySelector("#suno-pack");
  const transport = document.querySelector("#suno-play");
  const field = document.querySelector("#suno-tracks");
  const status = document.querySelector("#suno-status");
  let pack = selectedSunoPack(packs);
  let context;
  let mix;

  function applyTracks(at = context?.currentTime, immediate = false) {
    if (!mix) return;
    const levels = Object.fromEntries(Array.from(field.querySelectorAll("input"), input =>
      [input.value, input.checked ? .68 : 0]
    ));
    mix.setLevels(levels, at, immediate);
  }

  function showTracks() {
    const legend = field.querySelector("legend");
    const labels = pack.tracks.map((track, index) => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = track.id;
      input.checked = index === 0;
      label.append(input, " " + track.label);
      return label;
    });
    field.replaceChildren(legend, ...labels);
  }

  stopSuno = () => {
    if (!context) return;
    mix?.stop();
    void context.close().catch(() => {});
    context = null;
    mix = null;
    transport.textContent = "듣기";
    transport.disabled = false;
    select.disabled = false;
  };

  packs.forEach(option => select.add(new Option(option.label, option.id)));
  select.value = pack.id;
  select.addEventListener("change", () => {
    stopSuno();
    stopInspirations();
    pack = packs.find(option => option.id === select.value);
    selectSunoPack(pack.id);
    showTracks();
    status.textContent = "";
  });
  field.addEventListener("change", () => applyTracks());
  transport.addEventListener("click", async () => {
    if (context) {
      stopSuno();
      return;
    }
    stopTracks();
    audition.pause();
    stopInspirations();
    const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Audio) {
      status.textContent = "이 브라우저에서는 레이어를 재생할 수 없어요.";
      return;
    }
    const listening = new Audio();
    context = listening;
    transport.disabled = true;
    select.disabled = true;
    status.textContent = "";
    try {
      const [tracks] = await Promise.all([loadSunoPack(listening, pack), listening.resume()]);
      if (context !== listening) return;
      const output = listening.createDynamicsCompressor();
      output.connect(listening.destination);
      mix = new SunoLoops(listening, output, tracks);
      const startAt = listening.currentTime + .03;
      mix.start(startAt);
      applyTracks(startAt, true);
      transport.textContent = "정지";
    } catch {
      if (context !== listening) return;
      stopSuno();
      status.textContent = "레이어를 재생할 수 없어요.";
    } finally {
      if (context === listening) {
        transport.disabled = false;
        select.disabled = false;
      }
    }
  });
  showTracks();
  section.hidden = false;
}

void setupSuno();

const inspirationSelect = document.querySelector("#inspiration-select");
const catchButton = document.querySelector("#inspiration-catch");
const stopButton = document.querySelector("#inspiration-stop");
const inspirationList = document.querySelector("#inspiration-layers");
const inspirationStatus = document.querySelector("#inspiration-status");
const caught = new Map();
const layerLimit = 15;
let inspirationAudio;
let nextId = 0;
let lastTake = 0;

for (const item of catalog) {
  inspirationSelect.add(new Option(item.name + " · " + inspirationSound(item).label, item.seed));
}

function drawCaught() {
  inspirationList.replaceChildren(...Array.from(caught.values(), item => {
    const row = document.createElement("li");
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = item.name + " ×";
    remove.setAttribute("aria-label", item.name + " 놓아주기");
    remove.addEventListener("click", () => {
      inspirationAudio.release(item);
      caught.delete(item.seed);
      drawCaught();
      inspirationStatus.textContent = item.name + " · 레이어 " + caught.size + "개";
    });
    row.append(remove);
    return row;
  }));
  for (const option of inspirationSelect.options) option.disabled = caught.has(Number(option.value));
  const available = Array.from(inspirationSelect.options).find(option => !option.disabled);
  if (inspirationSelect.selectedOptions[0]?.disabled && available) inspirationSelect.value = available.value;
  catchButton.disabled = caught.size >= layerLimit;
}

stopInspirations = () => {
  if (!inspirationAudio) return;
  void inspirationAudio.close().catch(() => {});
  inspirationAudio = null;
  caught.clear();
  drawCaught();
  stopButton.hidden = true;
  inspirationStatus.textContent = "";
};

stopButton.addEventListener("click", () => stopInspirations());

catchButton.addEventListener("click", async () => {
  const source = catalog[Number(inspirationSelect.value)];
  if (!source || caught.has(source.seed) || caught.size >= layerLimit) return;
  stopTracks();
  audition.pause();
  stopSuno();
  const engine = inspirationAudio ??= new UniverseAudio({ take: nextArrangement(lastTake || undefined) });
  catchButton.disabled = true;
  stopButton.hidden = false;
  try {
    await engine.start();
    if (engine !== inspirationAudio) return;
    lastTake = engine.take;
    const slots = new Set(Array.from(caught.values(), item => item.slot));
    const slot = Array.from({ length: layerLimit }, (_, index) => index).find(index => !slots.has(index));
    const item = { ...source, slot, id: ++nextId };
    caught.set(item.seed, item);
    engine.capture(item);
    drawCaught();
    inspirationStatus.textContent = arrangementName(engine.take) + " · " + inspirationSound(item).label + " 합류 · 레이어 " + caught.size + "개";
  } catch {
    if (engine !== inspirationAudio) return;
    stopInspirations();
    inspirationStatus.textContent = "소리를 켤 수 없어요. 다시 시도해 주세요.";
  }
});
