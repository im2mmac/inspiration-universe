// 영감의 우주 음악 엔진: 낚은 영감 하나가 Suno 곡의 악기 한 줄(스템)이 되어 쌓인다.
// - 첫 영감을 낚을 때 바탕 곡 하나를 고른다 (바로 앞 회차와 다른 곡).
// - 낚으면 그 악기가 지금 위치에 맞춰 바로 재생되기 시작해, 필터가 열리며 다음 박까지 차오른다.
// - 놓아주면 필터가 닫히며 한 마디에 걸쳐 멀어진다.
// - 바탕 곡의 악기가 우선이고, 다른 곡의 드럼·퍼커션(음 높이 없음)과
//   화음이 맞는 곡의 선율 악기, 이미 울리는 악기의 메아리 버전이 섞여 든다.
import { BPM, COMPATIBLE, INSTRUMENTS, KIND, LAYERS, MAIN_SONGS, MIX_MELODIES, NATURAL_SOUNDS, SONGS, STEM_GAIN, stemUrl } from "./music-catalog.js";

const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const MASTER = .85;
const LAST_KEY = "inspiration-universe-last-song";
const ROTATION_KEY = "inspiration-universe-played-songs";
let playedSongs = [];
const BORROW_RHYTHM_LIMIT = 2;   // 다른 곡 리듬은 동시에 두 줄까지
const ECHO_LEVEL = .3;

const songIndex = take => take > 0 ? (take - 1) % MAIN_SONGS.length : 0;
const songOf = layer => SONGS.find(song => song.id === layer.split("/")[0]);
const stemOf = layer => layer.split("/")[1].replace(/~e$/, "");

// 저장된 QR과 곡 전환에서도 조성이 다른 선율을 차단한다.
function compatibleLayer(layer, take) {
  if (!layer || !LAYERS.includes(layer.replace(/~e$/, ""))) return false;
  const base = MAIN_SONGS[songIndex(take)];
  const song = songOf(layer);
  return song.id === "nature" || (KIND[stemOf(layer)] === "rhythm" && song.bpm === base.bpm) || song.id === base.id ||
    (song.key === base.key && (COMPATIBLE[base.id] || []).includes(song.id));
}

function lastSong() {
  try { return Number(localStorage.getItem(LAST_KEY)) || 0; } catch { return 0; }
}

// take는 바탕 곡 번호(1부터). 이름은 예전 코드와 맞추려고 그대로 둔다.
export function nextArrangement(previous = lastSong(), inspiration = null) {
  const played = readPlayedSongs();
  const remaining = MAIN_SONGS.map((song, i) => ({ id: song.id, take: i + 1 }))
    .filter(song => !played.includes(song.id));
  const pool = remaining.length ? remaining : MAIN_SONGS.map((song, i) => ({ id: song.id, take: i + 1 }));
  const eligible = pool.map(song => song.take).filter(n => n !== lastSong());
  const preferred = eligible.filter(n => n !== previous);
  const choices = preferred.length ? preferred : eligible;
  if (!choices.length) return MAIN_SONGS.map((_, i) => i + 1).find(take => take !== previous) || 1;
  const last = lastSong();
  const previousSong = last > 0 ? MAIN_SONGS[songIndex(last)] : null;
  const contrasting = previousSong
    ? choices.filter(take => (MAIN_SONGS[take - 1].bpm < 110) !== (previousSong.bpm < 110))
    : [];
  const tempoChoices = contrasting.length ? contrasting : choices;
  const matching = tempoChoices.filter(take => inspiration?.mood?.includes(MAIN_SONGS[take - 1].mood));
  const candidates = matching.length ? matching : tempoChoices;
  const offset = inspiration?.seed || 0;
  return candidates[(Math.floor(Math.random() * candidates.length) + offset) % candidates.length] || 1;
}

function readPlayedSongs() {
  try {
    const saved = JSON.parse(localStorage.getItem(ROTATION_KEY) || "[]");
    if (Array.isArray(saved)) playedSongs = [...new Set(saved.filter(id => MAIN_SONGS.some(song => song.id === id)))];
  } catch {}
  return playedSongs;
}

// 미리 고르거나 불러온 곡은 제외하고, 실제 소리가 시작된 곡만 순환에 기록한다.
function recordPlayedSong(take) {
  const id = MAIN_SONGS[songIndex(take)].id;
  const played = readPlayedSongs();
  if (played.length === MAIN_SONGS.length && lastSong() !== take) playedSongs = [id];
  else if (!played.includes(id)) playedSongs = [...played, id];
  try {
    localStorage.setItem(ROTATION_KEY, JSON.stringify(playedSongs));
    localStorage.setItem(LAST_KEY, String(take));
  } catch {}
}

export function arrangementName(take) {
  return MAIN_SONGS[songIndex(take)]?.title || MAIN_SONGS[0].title;
}

export function layerLabel(layer, base) {
  if (!layer) return "";
  const song = songOf(layer);
  const name = INSTRUMENTS[stemOf(layer)] || stemOf(layer);
  const echo = layer.endsWith("~e") ? " 메아리" : "";
  return (song && song.id !== base ? song.title + " " : "") + name + echo;
}

// QR 주소용 짧은 코드
export function layerCode(layer) {
  const index = LAYERS.indexOf(layer.replace(/~e$/, ""));
  return index < 0 ? "" : index.toString(36) + (layer.endsWith("~e") ? "e" : "");
}
export function layerFromCode(code) {
  const match = /^([0-9a-z]{1,2})(e?)$/.exec(code || "");
  const layer = match && LAYERS[parseInt(match[1], 36)];
  return layer ? layer + (match[2] ? "~e" : "") : null;
}

// 영감 하나에 어떤 악기 줄을 붙일지 정한다. 같은 상황이면 같은 결과가 나온다.
// heard: 이번 회차에 이미 울렸던 악기(놓아준 것 포함). 아직 안 나온 악기를 먼저 고르고,
// 방금 놓아준 악기는 다른 선택지가 하나도 없을 때만 다시 쓴다.
export function chooseLayer(item, active, take, heard = [], rejected = null) {
  const base = MAIN_SONGS[songIndex(take)];
  const rejectedLayers = rejected instanceof Set ? rejected : new Set(rejected ? [rejected.replace(/~e$/, "")] : []);
  const allowed = layer => !rejectedLayers.has(layer.replace(/~e$/, ""));
  const natural = NATURAL_SOUNDS[item.name];
  if (!item.replaceMelody && natural && allowed(natural) && !active.includes(natural)) return natural;
  const used = new Set(active);
  const seen = new Set(heard);
  const recent = heard[heard.length - 1];
  const pickFrom = (list, allowSeen) => {
    const free = list.filter(layer => allowed(layer) && !used.has(layer) && (allowSeen ? layer !== recent : !seen.has(layer)));
    return free.length ? free[(item.seed * 7 + active.length + heard.length) % free.length] : null;
  };
  const own = kinds => base.stems.filter(stem => kinds.includes(KIND[stem])).map(stem => base.id + "/" + stem);
  const borrowedRhythm = SONGS.filter(song => song !== base && song.bpm === base.bpm)
    .flatMap(song => song.stems.filter(stem => KIND[stem] === "rhythm").map(stem => song.id + "/" + stem));
  const friendIds = MIX_MELODIES ? MAIN_SONGS.filter(song => song !== base).map(song => song.id) : (COMPATIBLE[base.id] || []);
  const friendly = friendIds.flatMap(id => {
    const song = SONGS.find(s => s.id === id);
    return song.stems.filter(stem => KIND[stem] !== "rhythm" && KIND[stem] !== "low").map(stem => song.id + "/" + stem);
  });
  const echoes = active.filter(layer => !layer.endsWith("~e") && songOf(layer) === base && KIND[stemOf(layer)] !== "rhythm" && KIND[stemOf(layer)] !== "low")
    .map(layer => layer + "~e");
  const borrowing = active.filter(layer => songOf(layer) !== base && KIND[stemOf(layer)] === "rhythm").length;
  const rhythmOk = borrowing < BORROW_RHYTHM_LIMIT ? borrowedRhythm : [];

  const plans = {
    base: [own(["low", "rhythm"]), own(["harmony"]), rhythmOk, own(["lead"])],
    melody: [own(["harmony", "lead"]), friendly, own(["low", "rhythm"]), echoes, rhythmOk],
    texture: [rhythmOk, friendly, own(["lead", "harmony"]), echoes, own(["low", "rhythm"])],
  };
  const tiers = plans[item.role] || plans.texture;
  if (item.replaceMelody) {
    // 멜로디 교체는 다른 실제 선율로만: 리듬이나 같은 원음의 메아리로 대체하지 않는다.
    const melodies = [...own(["harmony", "lead"]), ...friendly];
    return pickFrom(melodies, false) || pickFrom(melodies, true) || null;
  }
  const everything = [...own(["low", "rhythm", "harmony", "lead"]), ...friendly, ...rhythmOk, ...echoes];
  if (rejected && item.role === "melody") {
    const melodies = [...own(["harmony", "lead"]), ...friendly, ...echoes];
    const replacement = pickFrom(melodies, false) || pickFrom(melodies, true);
    if (replacement) return replacement;
  }
  // 1) 역할에 맞으면서 아직 안 나온 악기 → 2) 어디서든 아직 안 나온 악기 → 3) 방금 놓은 것만 빼고 다시
  for (const allowSeen of [false, true]) {
    for (const list of tiers) {
      const layer = pickFrom(list, allowSeen);
      if (layer) return layer;
    }
    const layer = pickFrom(everything, allowSeen);
    if (layer) return layer;
  }
  const free = everything.filter(layer => allowed(layer) && !used.has(layer));
  if (free.length) return free[0];
  // 재료가 모두 사용 중이어도 방금 지운 원음은 메아리로 되살리지 않는다.
  const alternatives = own(["harmony", "lead", "low", "rhythm"]).filter(allowed);
  return alternatives.length ? alternatives[item.seed % alternatives.length] + "~e" : null;
}

// 바탕 곡이 바뀔 때 남아 있는 악기를 새 곡의 같은 악기(없으면 같은 성격의 악기)로 옮긴다.
export function mapLayer(layer, fromTake, toTake, taken = new Set()) {
  const from = MAIN_SONGS[songIndex(fromTake)], to = MAIN_SONGS[songIndex(toTake)];
  const echo = layer.endsWith("~e");
  const song = songOf(layer), stem = stemOf(layer);
  const kind = KIND[stem];
  if (song.id === "nature" && !taken.has(layer)) return layer;
  const friends = MIX_MELODIES ? MAIN_SONGS.map(s => s.id) : (COMPATIBLE[to.id] || []);
  // 다른 곡에서 온 리듬, 새 곡과 화음이 맞는 곡의 악기는 그대로 둔다
  if (song !== from && ((kind === "rhythm" && song.bpm === to.bpm) || song === to || friends.includes(song.id)) && !taken.has(layer)) return layer;
  const options = [
    to.stems.filter(s => s === stem),
    to.stems.filter(s => KIND[s] === kind),
    to.stems.filter(s => KIND[s] !== "rhythm"),
    to.stems,
  ];
  for (const list of options) {
    const free = list.map(s => to.id + "/" + s + (echo ? "~e" : "")).filter(l => !taken.has(l));
    if (free.length) return free[0];
  }
  // 새 곡에 남는 악기가 없으면: 새 곡 선율의 메아리 → 다른 곡의 같은 성격 악기
  const echoes = to.stems.filter(s => KIND[s] !== "rhythm" && KIND[s] !== "low").map(s => to.id + "/" + s + "~e").filter(l => !taken.has(l));
  if (echoes.length) return echoes[0];
  const elsewhere = LAYERS.filter(l => KIND[stemOf(l)] === kind && compatibleLayer(l, toTake) && !taken.has(l));
  return elsewhere[0] || to.id + "/" + to.stems[0] + "~e";
}

function mixBus(context, level = MASTER) {
  const input = context.createGain();
  const compressor = context.createDynamicsCompressor();
  const output = context.createGain();
  compressor.threshold.value = -14;
  compressor.knee.value = 8;
  compressor.ratio.value = 3;
  compressor.attack.value = .01;
  compressor.release.value = .25;
  output.gain.value = level;
  input.connect(compressor).connect(output);
  return { input, output };
}

const buffers = new Map();
async function loadStem(context, layer, bpm = BPM) {
  const stem = layer.replace(/~e$/, "");
  const key = stem + "@" + bpm;
  if (!buffers.has(key)) {
    buffers.set(key, fetch(stemUrl(stem, bpm))
      .then(response => { if (!response.ok) throw new Error("Audio " + response.status); return response.arrayBuffer(); })
      .then(data => context.decodeAudioData(data))
      .catch(error => { buffers.delete(key); throw error; }));
  }
  return buffers.get(key);
}

// 악기 한 줄: 루프 재생 → 필터 → 음량 (메아리 버전은 딜레이와 높은 대역만)
function voice(context, output, buffer, layer, base, when, offset) {
  const song = songOf(layer);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 20000;
  filter.Q.value = .7;
  const gain = context.createGain();
  gain.gain.value = 0;
  const baseSong = SONGS.find(song => song.id === base);
  const beat = 60 / (baseSong?.bpm || BPM);
  const borrowed = song.id !== base;
  // 악기마다 고르게 맞춘 음량 (곡 믹스 비율 대신 각 악기가 들리도록)
  let level = .8 * (STEM_GAIN[layer.replace(/~e$/, "")] ?? 1) * (borrowed ? .85 : 1);
  if (song.id === "nature") level *= .65;
  source.connect(filter);
  let last = filter;
  if (layer.endsWith("~e")) {
    // 메아리: 점8분음표(0.3초) 딜레이, 높은 대역만, 좌우로 퍼지게
    const high = context.createBiquadFilter();
    high.type = "highpass";
    high.frequency.value = 600;
    const delay = context.createDelay(1);
    delay.delayTime.value = beat * .75;
    const feedback = context.createGain();
    feedback.gain.value = .38;
    const pan = context.createStereoPanner ? context.createStereoPanner() : context.createGain();
    if (pan.pan) pan.pan.value = (Math.random() < .5 ? -1 : 1) * .55;
    filter.connect(high).connect(delay);
    delay.connect(feedback).connect(delay);
    delay.connect(pan);
    last = pan;
    level *= ECHO_LEVEL;
  }
  last.connect(gain).connect(output);
  const loopSeconds = Math.min(buffer.duration, song.id === "nature" ? 32 * beat : (song.seconds || buffer.duration));
  source.loopEnd = loopSeconds;
  source.start(when, song.id === "nature" ? 0 : offset % loopSeconds);
  const kind = layer.endsWith("~e") ? "echo" : KIND[layer.split("/")[1]];
  return { source, filter, gain, level, layer, kind, born: when, weight: 1 };
}

function balanceVoices(voices, at, fresh = null, beat = BEAT) {
  const BEAT = beat, BAR = beat * 4;
    const pitched = [...voices.values()]
      .filter(v => v.kind === "harmony" || v.kind === "lead" || v.kind === "echo")
      .sort((a, b) => b.born - a.born);
    const keep = new Set(pitched.slice(0, 2));
    const natural = [...voices.values()].filter(v => v.kind === "nature").sort((a, b) => b.born - a.born);
    const naturalFront = new Set(natural.slice(0, 2));
    for (const v of voices.values()) {
      const back = ((v.kind === "harmony" || v.kind === "lead" || v.kind === "echo") && !keep.has(v)) || (v.kind === "nature" && !naturalFront.has(v));
      const weight = back ? .18 : 1;
      const tone = back ? 1800 : 20000;
      if (v !== fresh) {
        v.gain.gain.cancelScheduledValues(at);
        v.filter.frequency.cancelScheduledValues(at);
      }
      if (v === fresh) {
        // 들어온 순간부터 두 마디는 조금 크게, 그다음 제자리로
        v.gain.gain.linearRampToValueAtTime(v.level * 1.18, at + .08);
        v.gain.gain.setValueAtTime(v.level * 1.18, at + 2 * BAR);
        v.gain.gain.linearRampToValueAtTime(v.level * weight, at + 2 * BAR + BEAT);
      } else {
        v.gain.gain.cancelScheduledValues(at);
        v.gain.gain.setTargetAtTime(v.level * weight, at, .35);
        v.filter.frequency.cancelScheduledValues(at);
        v.filter.frequency.setTargetAtTime(tone, at, .35);
      }
      // 새 악기가 들어오는 두 마디 동안 나머지는 살짝 물러나 자리를 내준다
      if (fresh && v !== fresh) {
        const space = v.kind === "rhythm" || v.kind === "low" ? .85 : .5;
        v.gain.gain.setTargetAtTime(v.level * weight * space, at, .12);
        v.gain.gain.setTargetAtTime(v.level * weight, at + 2 * BAR, .5);
      }
      v.weight = weight;
    }
}

export class UniverseAudio {
  constructor({ take } = {}) {
    this.take = take ?? nextArrangement();
    this.fixedTake = take !== undefined;
    this.voices = new Map();   // item.id → voice
    this.active = [];          // 지금 울리는 층 (선택 순서)
    this.heard = [];           // 이번 회차에 울렸던 층 (놓아준 것 포함)
    this.items = new Map();    // item.id → item (바탕이 바뀔 때 악기를 옮기려고)
    this.rejected = new Set();      // 현재 곡에서 지운 모든 원음과 메아리를 제외
    this.replaceMelody = false;
    this.anchor = null;        // 이 회차 음악의 바탕이 된 영감 (처음 낚은 것)
    this.vacant = false;       // 바탕을 놓아줘서 다음 낚기에 곡이 바뀌어야 함
    this.muted = false;
    this.origin = null;
  }

  get base() { return MAIN_SONGS[songIndex(this.take)].id; }
  get bpm() { return MAIN_SONGS[songIndex(this.take)].bpm || BPM; }
  get beatLength() { return 60 / this.bpm; }
  get barLength() { return this.beatLength * 4; }

  async start() {
    if (!this.context) this.initialize();
    await this.context.resume();
  }

  initialize() {
    const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Audio) throw new Error("AudioContext unavailable");
    this.context = new Audio({ latencyHint: "interactive" });
    this.bus = mixBus(this.context, this.muted ? 0 : MASTER);
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 256;
    this.levels = new Uint8Array(this.analyser.frequencyBinCount);
    this.bus.output.connect(this.analyser).connect(this.context.destination);
    this.prefetch(this.take);
  }

  // 바탕 곡과 다른 곡의 리듬을 미리 받아 둔다
  prefetch(take) {
    const base = MAIN_SONGS[songIndex(take)];
    const list = [...base.stems.map(stem => base.id + "/" + stem)];
    for (const song of SONGS) if (song !== base && song.bpm === base.bpm) for (const stem of song.stems) if (KIND[stem] === "rhythm") list.push(song.id + "/" + stem);
    const friends = MIX_MELODIES ? MAIN_SONGS.filter(s => s !== base).map(s => s.id) : (COMPATIBLE[base.id] || []);
    for (const id of friends) for (const stem of SONGS.find(s => s.id === id).stems) list.push(id + "/" + stem);
    for (const layer of list) loadStem(this.context, layer, base.bpm).catch(() => {});
  }

  position(at) { return this.origin === null ? 0 : at - this.origin; }

  nextBeatTime(at = this.context.currentTime) {
    if (this.origin === null) return at;
    return this.origin + Math.ceil((at - this.origin + .02) / this.beatLength) * this.beatLength;
  }

  beat() {
    if (this.origin === null || !this.context) return null;
    const beats = Math.max(0, (this.context.currentTime - this.origin) / this.beatLength);
    return { bar: Math.floor(beats / 4), beat: Math.floor(beats % 4), phase: beats % 1 };
  }

  nextJoinDelay() {
    if (!this.context || this.origin === null) return .35;
    return Math.max(.25, this.nextBeatTime() - this.context.currentTime);
  }

  // 낚기: 층을 정하고 바로 차오르게 한다. item.layer, item.soundLabel을 채운다.
  capture(item) {
    if (!this.context) this.initialize();
    let switched = null;
    if (this.anchor === null) {
      // 바탕을 놓아준 뒤 새로 낚으면 바탕 곡 자체가 바뀐다
      if (this.vacant && !this.fixedTake) switched = this.switchSong(item);
      else if (!this.fixedTake && this.items.size === 0) {
        this.take = nextArrangement(lastSong(), item);
        this.prefetch(this.take);
      }
      this.anchor = item.id;
      this.vacant = false;
      item.anchor = true;
    }
    const candidate = this.replaceMelody ? { ...item, role: "melody", replaceMelody: true } : item;
    const reusable = !this.replaceMelody && compatibleLayer(item.layer, this.take) &&
      !this.rejected.has(item.layer.replace(/~e$/, ""));
    let layer = reusable ? item.layer : chooseLayer(candidate, this.active, this.take, this.heard, this.rejected);
    // 이 곡의 대체 재료까지 모두 지웠다면 다른 곡으로 넘어간다.
    if (!layer) {
      switched = this.switchSong(item, candidate.replaceMelody);
      layer = this.reservedMelody || chooseLayer(candidate, this.active, this.take, this.heard, this.rejected);
    }
    this.replaceMelody = false;
    item.layer = layer;
    item.soundLabel = layerLabel(layer, this.base);
    this.items.set(item.id, item);
    this.active.push(layer);
    this.heard = [...this.heard.filter(h => h !== layer), layer];
    this.startVoice(item, layer);
    return { switched, song: arrangementName(this.take) };
  }

  startVoice(item, layer, at = null) {
    const context = this.context;
    const bpm = this.bpm;
    void loadStem(context, layer, bpm).then(buffer => {
      if (bpm !== this.bpm || item.layer !== layer || !this.items.has(item.id) || this.voices.has(item.id) || this.closed) return;
      const requested = Math.max(context.currentTime + .03, at ?? 0);
      const now = layer.startsWith("nature/") ? this.nextBeatTime(requested) : requested;
      if (this.origin === null) this.origin = now;
      if (!this.fixedTake) recordPlayedSong(this.take);
      const v = voice(context, this.bus.input, buffer, layer, this.base, now, this.position(now));
      const arrive = at ? now + this.beatLength : Math.max(now + .35, this.nextBeatTime(now + .2));
      v.filter.frequency.setValueAtTime(700, now);
      v.filter.frequency.exponentialRampToValueAtTime(20000, arrive);
      v.gain.gain.setValueAtTime(0, now);
      v.gain.gain.linearRampToValueAtTime(v.level, arrive);
      this.voices.set(item.id, v);
      this.rebalance(arrive, v);
      setTimeout(() => {
        if (this.voices.get(item.id) === v && !this.closed) this.onLayerState?.(item, "playing");
      }, Math.max(0, (arrive - context.currentTime) * 1000));
    }).catch(() => {
      if (this.items.get(item.id) === item && item.layer === layer && !this.closed) this.onLayerState?.(item, "error");
    });
  }

  // 새로 들어온 악기가 들리게: 두 마디 동안 앞으로 나오고,
  // 선율·화음 악기는 최근 두 줄만 또렷하게, 오래된 것은 뒤로 물러난다 (리듬·베이스는 그대로).
  rebalance(at, fresh = null) {
    balanceVoices(this.voices, at, fresh, this.beatLength);
  }

  // 바탕 곡을 다른 곡으로 바꾸고, 남은 악기를 새 곡의 악기로 다음 마디에 갈아 끼운다
  switchSong(item, reserveMelody = false) {
    const from = this.take;
    this.take = nextArrangement(this.take, item);
    if (this.take === from) this.take = from % MAIN_SONGS.length + 1;
    this.rejected.clear();
    this.prefetch(this.take);
    this.heard = [];
    const now = this.context.currentTime;
    const bar = this.origin === null ? now + .3 : this.origin + Math.ceil((now - this.origin + .3) / this.barLength) * this.barLength;
    // 다른 곡에서 온 악기는 그대로 두고(먼저 자리 확보), 이전 바탕 곡의 악기만 새 곡으로 옮긴다
    const fromId = MAIN_SONGS[songIndex(from)].id;
    const others = [...this.items].filter(([, other]) => other !== item);
    const toId = MAIN_SONGS[songIndex(this.take)].id;
    const stays = layer => !layer.startsWith(fromId + "/") && !layer.startsWith("nature/") && compatibleLayer(layer, this.take);
    const taken = new Set(others.filter(([, o]) => stays(o.layer)).map(([, o]) => o.layer));
    this.reservedMelody = reserveMelody ? chooseLayer({ ...item, replaceMelody: true }, [], this.take) : null;
    if (this.reservedMelody) taken.add(this.reservedMelody);
    const moved = [];
    for (const [id, other] of others) {
      const next = stays(other.layer) && other.layer !== this.reservedMelody ? other.layer : mapLayer(other.layer, from, this.take, taken);
      taken.add(next);
      moved.push([id, other, next]);
    }
    this.active = moved.map(([, , next]) => next);
    for (const [id, other, next] of moved) {
      if (next === other.layer && !next.startsWith("nature/")) { this.heard.push(next); continue; }
      const old = this.voices.get(id);
      if (old) {
        // 이전 곡의 악기는 다음 마디 직전에 필터가 닫히며 빠진다
        old.filter.frequency.cancelScheduledValues(now);
        old.filter.frequency.setValueAtTime(old.filter.frequency.value, now);
        old.filter.frequency.exponentialRampToValueAtTime(400, bar);
        old.gain.gain.cancelScheduledValues(now);
        old.gain.gain.setValueAtTime(old.gain.gain.value, Math.max(now, bar - this.beatLength));
        old.gain.gain.linearRampToValueAtTime(0, bar + .05);
        old.source.stop(bar + .1);
        this.voices.delete(id);
      }
      other.layer = next;
      other.soundLabel = layerLabel(next, this.base);
      this.heard.push(next);
      this.startVoice(other, next, bar);
    }
    return arrangementName(this.take);
  }

  // 놓아주기: 필터가 닫히며 한 마디 동안 멀어진다
  release(item) {
    if (item.layer) {
      this.rejected.add(item.layer.replace(/~e$/, ""));
      const kind = KIND[stemOf(item.layer)];
      this.replaceMelody ||= kind === "harmony" || kind === "lead";
    }
    const index = this.active.indexOf(item.layer);
    if (index >= 0) this.active.splice(index, 1);
    // 방금 놓아준 악기를 기록 맨 뒤로: 다음 낚기에서 가장 늦게 다시 고른다
    if (item.layer) this.heard = [...this.heard.filter(h => h !== item.layer), item.layer];
    this.items.delete(item.id);
    // 바탕을 놓아주면 다음에 낚는 영감이 새 바탕이 되고, 곡이 바뀐다
    if (item.id === this.anchor) { this.anchor = null; this.vacant = true; }
    const v = this.voices.get(item.id);
    this.voices.delete(item.id);
    if (!v || !this.context) return;
    const now = this.context.currentTime;
    const end = now + this.barLength;
    v.filter.frequency.cancelScheduledValues(now);
    v.filter.frequency.setValueAtTime(v.filter.frequency.value, now);
    v.filter.frequency.exponentialRampToValueAtTime(260, end);
    v.gain.gain.cancelScheduledValues(now);
    v.gain.gain.setValueAtTime(v.gain.gain.value, now);
    v.gain.gain.linearRampToValueAtTime(0, end);
    v.source.stop(end + .05);
    // 물러나 있던 선율이 다시 앞으로
    this.rebalance(now + this.beatLength);
  }

  clear() {
    const now = this.context?.currentTime ?? 0;
    for (const v of this.voices.values()) {
      v.gain.gain.cancelScheduledValues(now);
      v.gain.gain.setTargetAtTime(0, now, .12);
      v.source.stop(now + .8);
    }
    this.voices.clear();
    this.active = [];
    this.heard = [];
    this.items.clear();
    this.rejected = new Set();
    this.replaceMelody = false;
    this.anchor = null;
    this.vacant = false;
    this.origin = null;
    if (!this.fixedTake) {
      this.take = nextArrangement(this.take);
      if (this.context) this.prefetch(this.take);
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.context) this.bus.output.gain.setTargetAtTime(this.muted ? 0 : MASTER, this.context.currentTime, .04);
    return this.muted;
  }

  energy() {
    if (!this.analyser || this.muted) return 0;
    this.analyser.getByteFrequencyData(this.levels);
    let total = 0;
    for (let i = 1; i <= 15; i += 1) total += this.levels[i];
    return total / (15 * 255);
  }

  async close() {
    this.closed = true;
    if (this.context) await this.context.close();
  }

  // 받아 가는 음악: 고른 순서대로 두 마디마다 한 줄씩 들어오고, 다 모인 뒤 12마디를 함께 연주한 다음 잦아든다.
  async render(items) {
    const ordered = [...items].sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));
    const active = [];
    for (const item of ordered) {
      if (!compatibleLayer(item.layer, this.take)) item.layer = chooseLayer(item, active, this.take);
      active.push(item.layer);
    }
    const rate = 48000;
    const enter = 2 * this.barLength;
    const seconds = ordered.length * enter + 12 * this.barLength + 2 * this.barLength;
    const Offline = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
    const decoder = new Offline(2, rate, rate);
    const context = new Offline(2, Math.round(rate * seconds), rate);
    const bus = mixBus(context, .76);
    bus.output.connect(context.destination);
    const loaded = await Promise.all(ordered.map(item => loadStem(decoder, item.layer, this.bpm).catch(() => null)));
    const renderedVoices = new Map();
    ordered.forEach((item, i) => {
      if (!loaded[i]) return;
      const at = i * enter;
      const v = voice(context, bus.input, loaded[i], item.layer, this.base, at, at);
      v.filter.frequency.setValueAtTime(700, at);
      v.filter.frequency.exponentialRampToValueAtTime(20000, at + this.beatLength);
      v.gain.gain.setValueAtTime(0, at);
      v.gain.gain.linearRampToValueAtTime(v.level, at + this.beatLength);
      renderedVoices.set(item.id ?? i, v);
      balanceVoices(renderedVoices, at + this.beatLength, v, this.beatLength);
    });
    bus.output.gain.setValueAtTime(.76, seconds - 2 * this.barLength);
    bus.output.gain.linearRampToValueAtTime(0, seconds);
    return toWav(await context.startRendering());
  }
}

function toWav(audio) {
  const channels = 2;
  const bytes = audio.length * channels * 2;
  const output = new DataView(new ArrayBuffer(44 + bytes));
  const put = (offset, text) => {
    for (let i = 0; i < text.length; i += 1) output.setUint8(offset + i, text.charCodeAt(i));
  };
  put(0, "RIFF"); output.setUint32(4, 36 + bytes, true); put(8, "WAVE");
  put(12, "fmt "); output.setUint32(16, 16, true); output.setUint16(20, 1, true);
  output.setUint16(22, channels, true); output.setUint32(24, audio.sampleRate, true);
  output.setUint32(28, audio.sampleRate * channels * 2, true);
  output.setUint16(32, channels * 2, true); output.setUint16(34, 16, true);
  put(36, "data"); output.setUint32(40, bytes, true);
  const source = [audio.getChannelData(0), audio.getChannelData(1)];
  let position = 44;
  for (let i = 0; i < audio.length; i += 1) {
    for (const channel of source) {
      const sample = Math.max(-1, Math.min(1, channel[i]));
      output.setInt16(position, sample * (sample < 0 ? 32768 : 32767), true);
      position += 2;
    }
  }
  return new Blob([output.buffer], { type: "audio/wav" });
}
