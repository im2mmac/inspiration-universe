import { cueOptions, cueUrl, preferences } from "./sound-options.js";

const beat = 60 / 92;
const stepLength = beat / 2;
const chords = [[50, 57, 60, 65], [46, 57, 62, 65], [41, 53, 57, 60], [43, 55, 58, 62]];

function frequency(note) {
  return 440 * 2 ** ((note - 69) / 12);
}

function mixBus(context, gain = .76) {
  const input = context.createGain();
  const compression = context.createDynamicsCompressor();
  const output = context.createGain();
  compression.threshold.value = -16;
  compression.ratio.value = 2.5;
  output.gain.value = gain;
  input.connect(compression).connect(output);
  return { input, output };
}

function shape(context, output, at, level, attack, seconds) {
  const gain = context.createGain();
  gain.gain.setValueAtTime(.0001, at);
  gain.gain.exponentialRampToValueAtTime(Math.max(level, .0002), at + attack);
  gain.gain.exponentialRampToValueAtTime(.0001, at + seconds);
  gain.connect(output);
  return gain;
}

function resonance(context, output, at, note, level, seconds, attack = .065) {
  const envelope = shape(context, output, at, level, attack, seconds);
  for (const [ratio, weight] of [[1, 1], [2.006, .12], [3.01, .04]]) {
    const oscillator = context.createOscillator();
    const part = context.createGain();
    oscillator.frequency.value = frequency(note) * ratio;
    part.gain.value = weight;
    oscillator.connect(part).connect(envelope);
    oscillator.start(at);
    oscillator.stop(at + seconds + .02);
  }
}

function pluck(context, output, instruments, at, note, level, seconds) {
  const base = note < 57 ? 45 : 69;
  const buffer = instruments.get(base);
  if (!buffer) {
    resonance(context, output, at, note, level * .65, seconds, .02);
    return;
  }
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = 2 ** ((note - base) / 12);
  const envelope = shape(context, output, at, level, .014, seconds);
  source.connect(envelope);
  source.start(at);
  source.stop(at + seconds + .02);
}

function arrange(context, bus, instruments, entries, index, at) {
  const place = index % 8;
  const bar = Math.floor(index / 8);
  const chord = chords[bar % chords.length];
  const low = entries.find(item => item.role === "base");
  const melody = entries.filter(item => item.role === "melody");
  const texture = entries.filter(item => item.role === "texture");
  const answered = entries.some(item => low && item.player !== low.player);
  const breath = [0, .014, .003, .025, 0, .019, .008, .018][place];

  if (place === 0 && low) {
    resonance(context, bus, at, chord[0] - 12, .079, answered ? 1.55 : 2.46, .23);
    pluck(context, bus, instruments, at + .025, chord[0], .22, 2.5);
  }
  if (place === 4 && entries.length) {
    pluck(context, bus, instruments, at + breath, chord[1], .11, 1.8);
  }
  if (melody.length && [1, 3, 6].includes(place)) {
    const lead = melody[(bar + Math.floor(place / 3)) % Math.min(melody.length, 3)];
    const bend = (lead.seed + (low?.seed ?? 0) + bar + place) % 3;
    pluck(context, bus, instruments, at + breath, chord[bend + 1] + (place === 6 ? 12 : 0), place === 1 ? .32 : .23, place === 6 ? 2.6 : 1.7);
  }
  if (texture.length && place === 0) {
    const voicing = texture[(bar + texture.length - 1) % texture.length];
    const pitch = chord[voicing.seed % 3 + 1] + 12;
    resonance(context, bus, at + .11, pitch, .027, 2.6, .64);
  }
  if (texture.length > 1 && place === 5 && bar % 2 === 0) {
    pluck(context, bus, instruments, at + .028, chord[2] + 12, .14, 2.9);
  }
}

async function decoded(context, url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Audio asset " + response.status);
  return context.decodeAudioData(await response.arrayBuffer());
}

export class UniverseAudio {
  constructor() {
    this.instruments = new Map();
    this.cues = new Map();
    this.entries = [];
    this.queue = [];
    this.muted = false;
  }

  async start() {
    if (this.context) {
      await this.context.resume();
      return;
    }
    const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Audio) throw new Error("AudioContext unavailable");
    const context = new Audio();
    this.context = context;
    this.bus = mixBus(context, this.muted ? .0001 : .76);
    this.analyser = context.createAnalyser();
    this.analyser.fftSize = 256;
    this.levels = new Uint8Array(this.analyser.frequencyBinCount);
    this.bus.output.connect(this.analyser).connect(context.destination);
    this.index = 0;
    this.next = context.currentTime + .09;
    const instrumentLoads = [[45, "a2"], [69, "a4"]].map(async ([note, name]) => {
      const url = new URL("./assets/instruments/" + name + ".wav", import.meta.url);
      this.instruments.set(note, await decoded(context, url));
    });
    const cueLoads = Object.keys(cueOptions).flatMap(kind => Array.from({ length: 5 }, async (_, index) => {
      this.cues.set(kind + index, await decoded(context, cueUrl(kind, index)));
    }));
    this.ready = Promise.allSettled([...instrumentLoads, ...cueLoads]);
    await context.resume();
    this.timer = setInterval(() => this.schedule(), 23);
  }

  playCue(kind, time = this.context?.currentTime) {
    if (!this.context) return;
    const variant = preferences()[kind];
    const buffer = this.cues.get(kind + variant);
    if (!buffer) {
      resonance(this.context, this.bus.input, time, { catch: 77, layer: 69, release: 55 }[kind], .065, .34, .018);
      return;
    }
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    gain.gain.value = kind === "layer" ? .36 : .52;
    source.connect(gain).connect(this.bus.input);
    source.start(time);
  }

  capture(item) {
    this.playCue("catch");
    this.queue.push({ type: "add", item });
  }

  release(item) {
    this.playCue("release");
    this.queue.push({ type: "remove", item });
  }

  clear() {
    this.entries = [];
    this.queue = [];
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.context) this.bus.output.gain.setTargetAtTime(this.muted ? .0001 : .76, this.context.currentTime, .04);
    return this.muted;
  }

  schedule() {
    const context = this.context;
    if (context.state !== "running") return;
    if (this.next < context.currentTime - stepLength) {
      const lost = Math.ceil((context.currentTime - this.next) / stepLength);
      this.index += lost;
      this.next += lost * stepLength;
    }
    while (this.next < context.currentTime + .12) {
      const step = this.index;
      if (step % 2 === 0 && this.queue.length) {
        const pending = [];
        let joined = false;
        for (const change of this.queue) {
          if (change.type === "add") {
            this.entries.push(change.item);
            joined = true;
          } else if (step % 8 === 0) {
            this.entries = this.entries.filter(item => item.id !== change.item.id);
          } else pending.push(change);
        }
        this.queue = pending;
        if (joined) this.playCue("layer", this.next);
      }
      arrange(context, this.bus.input, this.instruments, this.entries, step, this.next);
      this.index += 1;
      this.next += stepLength;
    }
  }

  energy() {
    if (!this.analyser || this.muted) return 0;
    this.analyser.getByteFrequencyData(this.levels);
    let total = 0;
    for (let i = 1; i <= 15; i += 1) total += this.levels[i];
    return total / (15 * 255);
  }

  async render(items) {
    await this.ready;
    const Offline = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
    const rate = 44100;
    const length = Math.ceil(rate * (8 * beat * 4 + 2.6));
    const context = new Offline(2, length, rate);
    const bus = mixBus(context, .92);
    bus.output.connect(context.destination);
    for (let step = 0; step < 64; step += 1) arrange(context, bus.input, this.instruments, items, step, step * stepLength + .02);
    const buffer = await context.startRendering();
    return toWav(buffer);
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
