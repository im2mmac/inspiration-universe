// 영감의 우주 음악 엔진: 낚은 영감 하나가 Suno 곡의 악기 한 줄(스템)이 되어 쌓인다.
// - 첫 영감을 낚을 때 바탕 곡 하나를 고른다 (바로 앞 회차와 다른 곡).
// - 낚으면 그 악기가 지금 위치에 맞춰 바로 재생되기 시작해, 필터가 열리며 다음 박까지 차오른다.
// - 놓아주면 필터가 닫히며 한 마디에 걸쳐 멀어진다.
// - 바탕 곡의 악기가 우선이고, 다른 곡의 드럼·퍼커션(음 높이 없음)과
//   화음이 맞는 곡의 선율 악기, 이미 울리는 악기의 메아리 버전이 섞여 든다.
import { BPM, COMPATIBLE, INSTRUMENTS, KIND, LAYERS, LOOP_SECONDS, SONGS, stemUrl } from "./music-catalog.js";

const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const MASTER = .85;
const LAST_KEY = "inspiration-universe-last-song";
const BORROW_RHYTHM_LIMIT = 2;   // 다른 곡 리듬은 동시에 두 줄까지
const ECHO_LEVEL = .5;

const songIndex = take => take > 0 ? (take - 1) % SONGS.length : 0;
const songOf = layer => SONGS.find(song => song.id === layer.split("/")[0]);
const stemOf = layer => layer.split("/")[1].replace(/~e$/, "");

function lastSong() {
  try { return Number(localStorage.getItem(LAST_KEY)) || 0; } catch { return 0; }
}

// take는 바탕 곡 번호(1부터). 이름은 예전 코드와 맞추려고 그대로 둔다.
export function nextArrangement(previous = lastSong()) {
  const choices = SONGS.map((_, i) => i + 1).filter(n => n !== previous);
  return choices[Math.floor(Math.random() * choices.length)] || 1;
}

export function arrangementName(take) {
  return SONGS[songIndex(take)]?.title || SONGS[0].title;
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
export function chooseLayer(item, active, take, heard = []) {
  const base = SONGS[songIndex(take)];
  const used = new Set(active);
  const seen = new Set(heard);
  const recent = heard[heard.length - 1];
  const pickFrom = (list, allowSeen) => {
    const free = list.filter(layer => !used.has(layer) && (allowSeen ? layer !== recent : !seen.has(layer)));
    return free.length ? free[(item.seed * 7 + active.length + heard.length) % free.length] : null;
  };
  const own = kinds => base.stems.filter(stem => kinds.includes(KIND[stem])).map(stem => base.id + "/" + stem);
  const borrowedRhythm = SONGS.filter(song => song !== base)
    .flatMap(song => song.stems.filter(stem => KIND[stem] === "rhythm").map(stem => song.id + "/" + stem));
  const friendly = (COMPATIBLE[base.id] || []).flatMap(id => {
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
  const everything = [...own(["low", "rhythm", "harmony", "lead"]), ...friendly, ...borrowedRhythm, ...echoes];
  // 1) 역할에 맞으면서 아직 안 나온 악기 → 2) 어디서든 아직 안 나온 악기 → 3) 방금 놓은 것만 빼고 다시
  for (const allowSeen of [false, true]) {
    for (const list of tiers) {
      const layer = pickFrom(list, allowSeen);
      if (layer) return layer;
    }
    const layer = pickFrom(everything, allowSeen);
    if (layer) return layer;
  }
  const free = everything.filter(layer => !used.has(layer));
  return free[0] || base.id + "/" + base.stems[item.seed % base.stems.length] + "~e";
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
async function loadStem(context, layer) {
  const key = layer.replace(/~e$/, "");
  if (!buffers.has(key)) {
    buffers.set(key, fetch(stemUrl(key))
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
  const borrowed = song.id !== base;
  let level = song.gain * (borrowed ? .82 : 1);
  source.connect(filter);
  let last = filter;
  if (layer.endsWith("~e")) {
    // 메아리: 점8분음표(0.3초) 딜레이, 높은 대역만, 좌우로 퍼지게
    const high = context.createBiquadFilter();
    high.type = "highpass";
    high.frequency.value = 600;
    const delay = context.createDelay(1);
    delay.delayTime.value = BEAT * .75;
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
  source.start(when, offset % LOOP_SECONDS);
  return { source, filter, gain, level, layer };
}

export class UniverseAudio {
  constructor({ take } = {}) {
    this.take = take ?? nextArrangement();
    this.fixedTake = take !== undefined;
    this.voices = new Map();   // item.id → voice
    this.active = [];          // 지금 울리는 층 (선택 순서)
    this.heard = [];           // 이번 회차에 울렸던 층 (놓아준 것 포함)
    this.muted = false;
    this.origin = null;
  }

  get base() { return SONGS[songIndex(this.take)].id; }

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
    const base = SONGS[songIndex(take)];
    const list = [...base.stems.map(stem => base.id + "/" + stem)];
    for (const song of SONGS) if (song !== base) for (const stem of song.stems) if (KIND[stem] === "rhythm") list.push(song.id + "/" + stem);
    for (const id of COMPATIBLE[base.id] || []) for (const stem of SONGS.find(s => s.id === id).stems) list.push(id + "/" + stem);
    for (const layer of list) loadStem(this.context, layer).catch(() => {});
  }

  position(at) { return this.origin === null ? 0 : at - this.origin; }

  nextBeatTime(at = this.context.currentTime) {
    if (this.origin === null) return at;
    return this.origin + Math.ceil((at - this.origin + .02) / BEAT) * BEAT;
  }

  beat() {
    if (this.origin === null || !this.context) return null;
    const beats = Math.max(0, (this.context.currentTime - this.origin) / BEAT);
    return { bar: Math.floor(beats / 4), beat: Math.floor(beats % 4), phase: beats % 1 };
  }

  nextJoinDelay() {
    if (!this.context || this.origin === null) return .35;
    return Math.max(.25, this.nextBeatTime() - this.context.currentTime);
  }

  // 낚기: 층을 정하고 바로 차오르게 한다. item.layer, item.soundLabel을 채운다.
  capture(item) {
    if (!this.context) this.initialize();
    const layer = item.layer || chooseLayer(item, this.active, this.take, this.heard);
    item.layer = layer;
    item.soundLabel = layerLabel(layer, this.base);
    this.active.push(layer);
    this.heard = [...this.heard.filter(h => h !== layer), layer];
    const context = this.context;
    void loadStem(context, layer).then(buffer => {
      if (!this.active.includes(layer) || this.voices.has(item.id) || this.closed) return;
      const now = context.currentTime + .03;
      if (this.origin === null) this.origin = now;
      try { localStorage.setItem(LAST_KEY, String(this.take)); } catch {}
      const v = voice(context, this.bus.input, buffer, layer, this.base, now, this.position(now));
      const arrive = Math.max(now + .35, this.nextBeatTime(now + .2));
      v.filter.frequency.setValueAtTime(700, now);
      v.filter.frequency.exponentialRampToValueAtTime(20000, arrive);
      v.gain.gain.setValueAtTime(0, now);
      v.gain.gain.linearRampToValueAtTime(v.level, arrive);
      this.voices.set(item.id, v);
    }).catch(() => {});
  }

  // 놓아주기: 필터가 닫히며 한 마디 동안 멀어진다
  release(item) {
    const index = this.active.indexOf(item.layer);
    if (index >= 0) this.active.splice(index, 1);
    // 방금 놓아준 악기를 기록 맨 뒤로: 다음 낚기에서 가장 늦게 다시 고른다
    if (item.layer) this.heard = [...this.heard.filter(h => h !== item.layer), item.layer];
    const v = this.voices.get(item.id);
    this.voices.delete(item.id);
    if (!v || !this.context) return;
    const now = this.context.currentTime;
    const end = now + BAR;
    v.filter.frequency.cancelScheduledValues(now);
    v.filter.frequency.setValueAtTime(v.filter.frequency.value, now);
    v.filter.frequency.exponentialRampToValueAtTime(260, end);
    v.gain.gain.cancelScheduledValues(now);
    v.gain.gain.setValueAtTime(v.gain.gain.value, now);
    v.gain.gain.linearRampToValueAtTime(0, end);
    v.source.stop(end + .05);
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
      if (!item.layer) item.layer = chooseLayer(item, active, this.take);
      active.push(item.layer);
    }
    const rate = 44100;
    const enter = 2 * BAR;
    const seconds = ordered.length * enter + 12 * BAR + 2 * BAR;
    const Offline = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
    const decoder = new Offline(2, rate, rate);
    const context = new Offline(2, Math.round(rate * seconds), rate);
    const bus = mixBus(context, .8);
    bus.output.connect(context.destination);
    const loaded = await Promise.all(ordered.map(item => loadStem(decoder, item.layer).catch(() => null)));
    ordered.forEach((item, i) => {
      if (!loaded[i]) return;
      const at = i * enter;
      const v = voice(context, bus.input, loaded[i], item.layer, this.base, at, at);
      v.filter.frequency.setValueAtTime(700, at);
      v.filter.frequency.exponentialRampToValueAtTime(20000, at + BEAT);
      v.gain.gain.setValueAtTime(0, at);
      v.gain.gain.linearRampToValueAtTime(v.level, at + BEAT);
    });
    bus.output.gain.setValueAtTime(.8, seconds - 2 * BAR);
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
