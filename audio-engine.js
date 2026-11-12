import { cueOptions, cueUrl, preferences } from "./sound-options.js";
import { InspirationLayers, loadInspirationSamples } from "./inspiration-audio.js";
import { SunoLoops, loadSunoPack, selectedSunoPack, sunoBpm, sunoCatalog, sunoLoopSeconds } from "./suno-audio.js";

const beatLength = 60 / sunoBpm;
const stepLength = beatLength / 4;
const introSteps = 16;
const masterLevel = .82;

function mixBus(context, level = masterLevel) {
  const input = context.createGain();
  const compressor = context.createDynamicsCompressor();
  const output = context.createGain();
  compressor.threshold.value = -17;
  compressor.ratio.value = 2.8;
  output.gain.value = level;
  input.connect(compressor).connect(output);
  return { input, output };
}

async function decoded(context, url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Audio asset " + response.status);
  return context.decodeAudioData(await response.arrayBuffer());
}

export class UniverseAudio {
  constructor() {
    this.cues = new Map();
    this.entries = [];
    this.queue = [];
    this.muted = false;
    this.origin = null;
  }

  async start() {
    if (!this.context) this.initialize();
    await Promise.all([this.context.resume(), this.ready]);
    if (this.timer || this.closed) return;
    this.timer = setInterval(() => this.schedule(), 23);
    this.schedule();
  }

  initialize() {
    const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Audio) throw new Error("AudioContext unavailable");
    this.context = new Audio();
    this.bus = mixBus(this.context, this.muted ? 0 : masterLevel);
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 256;
    this.levels = new Uint8Array(this.analyser.frequencyBinCount);
    this.bus.output.connect(this.analyser).connect(this.context.destination);
    const cueLoads = Object.keys(cueOptions).flatMap(kind => Array.from({ length: 5 }, async (_, index) => {
      this.cues.set(kind + index, await decoded(this.context, cueUrl(kind, index)));
    }));
    this.layersReady = loadInspirationSamples(this.context).then(samples => {
      this.layers = new InspirationLayers(this.context, this.bus.input, samples);
    });
    this.ready = Promise.allSettled([...cueLoads, this.layersReady, this.prepareBed()]);
  }

  async prepareBed() {
    const [beat, melody] = await Promise.all([
      decoded(this.context, new URL("./assets/audio/foundation-beat.wav", import.meta.url)),
      this.prepareMelody(),
    ]);
    this.bed = new SunoLoops(this.context, this.bus.input, [
      { id: "foundation-beat", buffer: beat, bed: .52 },
      melody,
    ]);
  }

  async prepareMelody() {
    const pack = selectedSunoPack(await sunoCatalog());
    const melody = pack?.tracks.find(track => track.role === "melody");
    if (melody) {
      try {
        const [track] = await loadSunoPack(this.context, { ...pack, tracks: [{ ...melody, bed: .68 }] });
        return track;
      } catch {}
    }
    const buffer = await decoded(this.context, new URL("./assets/audio/foundation-melody.wav", import.meta.url));
    return { id: "foundation-melody", buffer, bed: .68 };
  }

  beat() {
    if (this.origin === null) return null;
    const beats = Math.max(0, (this.context.currentTime - this.origin) / beatLength);
    return { phase: beats % 1 };
  }

  nextJoinDelay() {
    if (this.origin === null) return introSteps * stepLength;
    const position = Math.max(introSteps, this.index, (this.context.currentTime - this.origin) / stepLength);
    const at = this.origin + Math.ceil(position / 4) * beatLength;
    return Math.max(0, at - this.context.currentTime);
  }

  playCue(kind, at = this.context?.currentTime) {
    const buffer = this.cues.get(kind + preferences()[kind]);
    if (!buffer || !this.context) return;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    gain.gain.value = kind === "layer" ? .05 : .08;
    source.connect(gain).connect(this.bus.input);
    source.start(at);
    source.onended = () => { source.disconnect(); gain.disconnect(); };
  }

  capture(item) {
    this.playCue("catch");
    if (this.layers) this.layers.cue(item, this.context.currentTime);
    else void this.layersReady?.then(() => {
      if (!this.closed && this.queue.some(change => change.item.id === item.id)) {
        this.layers.cue(item, this.context.currentTime);
      }
    });
    this.queue.push({ type: "add", item });
    if (this.timer && this.origin === null) this.schedule();
  }

  release(item) {
    this.playCue("release");
    this.layers?.cue(item, this.context.currentTime, true);
    this.queue.push({ type: "remove", item });
  }

  clear() {
    this.entries = [];
    this.queue = [];
    this.bed?.stop();
    this.origin = null;
    this.layers?.sync([], this.context.currentTime);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.context) this.bus.output.gain.setTargetAtTime(this.muted ? 0 : masterLevel, this.context.currentTime, .04);
    return this.muted;
  }

  schedule() {
    const context = this.context;
    if (context.state !== "running") return;
    if (this.origin === null) {
      if (!this.queue.some(change => change.type === "add")) return;
      this.origin = context.currentTime + .035;
      this.next = this.origin;
      this.index = 0;
      this.bed?.start(this.origin);
    }
    if (this.next < context.currentTime) {
      this.index = Math.ceil((context.currentTime - this.origin) / stepLength);
      this.next = this.origin + this.index * stepLength;
    }
    while (this.next < context.currentTime + .09) {
      if (this.index >= introSteps && this.index % 4 === 0 && this.queue.length) {
        const previous = this.entries;
        const next = new Map(previous.map(item => [item.id, item]));
        for (const { type, item } of this.queue) {
          if (type === "add") next.set(item.id, item);
          else next.delete(item.id);
        }
        this.entries = [...next.values()];
        this.queue = [];
        this.layers.sync(this.entries, this.next, this.index);
        const previousIds = new Set(previous.map(item => item.id));
        if (this.entries.some(item => !previousIds.has(item.id))) this.playCue("layer", this.next);
      }
      this.layers.schedule(this.index, this.next);
      this.index += 1;
      this.next = this.origin + this.index * stepLength;
    }
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
    clearInterval(this.timer);
    this.bed?.stop();
    if (this.context) await this.context.close();
  }

  async render(items) {
    if (!this.context) this.initialize();
    await this.ready;
    const Offline = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
    const rate = 44100;
    const context = new Offline(2, Math.round(rate * sunoLoopSeconds), rate);
    const bus = mixBus(context, .92);
    bus.output.connect(context.destination);
    if (this.bed) new SunoLoops(context, bus.input, this.bed.tracks).start(0);
    const layers = new InspirationLayers(context, bus.input, this.layers.buffers);
    layers.sync(items, 0);
    for (let step = introSteps; step < 128; step += 1) layers.schedule(step, step * stepLength);
    bus.output.gain.setValueAtTime(.92, sunoLoopSeconds - .012);
    bus.output.gain.linearRampToValueAtTime(0, sunoLoopSeconds);
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
