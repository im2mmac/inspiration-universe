export const sunoBpm = 150;
export const sunoLoopSeconds = 8 * 4 * 60 / sunoBpm;

const assetRoot = new URL("./assets/suno/", import.meta.url);
const selectionKey = "inspiration-universe-suno-pack";
const slug = /^[a-z0-9-]+$/;
let catalogRequest;

export function sunoCatalog() {
  catalogRequest ??= fetch(new URL("catalog.json", assetRoot))
    .then(response => response.ok ? response.json() : [])
    .then(packs => Array.isArray(packs) ? packs.filter(pack =>
      slug.test(pack.id) && Array.isArray(pack.tracks) && pack.tracks.length &&
      pack.tracks.every(track => slug.test(track.id))
    ) : [])
    .catch(() => []);
  return catalogRequest;
}

export function selectedSunoPack(packs) {
  let saved;
  try { saved = localStorage.getItem(selectionKey); } catch {}
  return packs.find(pack => pack.id === saved) || packs[0];
}

export function selectSunoPack(id) {
  try { localStorage.setItem(selectionKey, id); } catch {}
}

export async function loadSunoPack(context, pack) {
  return Promise.all(pack.tracks.map(async track => {
    const url = new URL(pack.id + "/" + track.id + ".wav", assetRoot);
    const response = await fetch(url);
    if (!response.ok) throw new Error("Audio asset " + response.status);
    const buffer = await context.decodeAudioData(await response.arrayBuffer());
    if (Math.abs(buffer.duration - sunoLoopSeconds) > .01) throw new Error("Unexpected loop duration");
    return { ...track, buffer };
  }));
}

export class SunoLoops {
  constructor(context, output, tracks) {
    this.context = context;
    this.output = output;
    this.tracks = tracks;
    this.layers = new Map();
  }

  start(at) {
    for (const track of this.tracks) {
      const source = this.context.createBufferSource();
      source.buffer = track.buffer;
      source.loop = true;
      source.loopEnd = sunoLoopSeconds;
      const level = this.context.createGain();
      level.gain.value = track.bed;
      source.connect(level).connect(this.output);
      source.start(at);
      this.layers.set(track.id, { source, gain: level.gain });
    }
  }

  pick(role, items) {
    const counts = new Map();
    for (const item of items) counts.set(item.stemId, (counts.get(item.stemId) ?? 0) + 1);
    const candidates = this.tracks.filter(track => track.role === role);
    return candidates.reduce((best, track) =>
      (counts.get(track.id) ?? 0) < (counts.get(best.id) ?? 0) ? track : best, candidates[0]
    )?.id;
  }

  arrange(items, at, immediate = false) {
    const players = new Set(items.map(item => item.player));
    const levels = {};
    for (const track of this.tracks) {
      const count = items.filter(item => item.stemId === track.id).length;
      const active = count ? .76 + Math.min(count - 1, 3) * .06 : 0;
      const spaceForOthers = players.size > 1 && track.role === "base" ? .78 : 1;
      levels[track.id] = Math.max(track.bed, active * spaceForOthers);
    }
    this.setLevels(levels, at, immediate);
  }

  setLevels(levels, at, immediate = false) {
    for (const [id, { gain }] of this.layers) {
      gain.cancelScheduledValues(at);
      if (immediate) gain.setValueAtTime(levels[id] ?? 0, at);
      else gain.setTargetAtTime(levels[id] ?? 0, at, .045);
    }
  }

  stop() {
    for (const { source } of this.layers.values()) source.stop();
    this.layers.clear();
  }
}
