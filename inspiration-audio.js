const sounds = {
  depth: ["낮은 북", "심연의 어둠", "Weltschmerz", "Claroscuro", "Memento mori", "사막을 담은 스노볼", "유리 속 산불", "말랑한 행성"],
  water: ["물방울", "호수의 반짝임", "거친 파도", "물방울", "비를 키우는 화분", "빈 수영장", "접히는 바다", "마지막 파도", "거품 기차"],
  glass: ["유리의 떨림", "유리잔 속 소용돌이", "수면에 비친 나", "镜花水月", "유리 해파리", "얼음 나비", "물속의 보름달", "나침반 달걀", "金継ぎ"],
  paper: ["종이 마찰", "부치지 못한 편지", "종이배", "Aus dem Rahmen fallen", "Tabula rasa", "종이배 잠수함", "그림자를 접는 가위", "우주 택배 상자", "Negative space"],
  wood: ["나뭇결 타격", "가 보지 않은 길", "빈 의자", "Dejar huella", "侘び寂び", "별을 깎는 연필깎이", "도토리 잠수복", "木漏れ日", "留白", "Gestalt"],
  rail: ["레일의 딸깍임", "밤기차", "도시의 맥박", "Punto de fuga", "바람을 감는 실패", "부유하는 버스 정류장", "브롬톤 자전거", "Zeitgeist", "어둠을 깨우는 새벽"],
  air: ["나뭇잎과 바람", "아득한 우주", "안개", "손끝의 바람", "흐릿한 수평선", "숨결", "Fernweh", "Liminal space", "息をのむ", "구름 그림자", "若隐若现", "意境"],
  tin: ["얇은 금속판", "양철 지붕과 빗방울", "불타는 노을", "낯선 행성", "Disonancia cognitiva", "폭풍 찻잔", "주름진 번개", "깨어나는 로봇 화석"],
  bell: ["작은 종", "새벽종", "새벽빛", "야광별", "共鸣", "Per aspera ad astra", "달빛을 담은 우체통", "연기를 삼킨 종", "一期一会", "画龙点睛"],
  pixel: ["8비트 픽셀음", "무한의 스크롤", "편의점 불빛", "잠든 알람", "灵光一闪", "신호를 먹는 고양이", "젤리 신호등", "네온 산호", "번역하는 앵무새"],
  scan: ["스캐너 파동", "고요한 궤도", "사그라든 별", "서버실의 여름", "Pareidolia", "버섯 위성", "해초 라디오", "전파를 줍는 까마귀", "Awe", "恍如隔世", "In the blink of an eye"],
  spring: ["스프링 울림", "환희의 물결", "Desasosiego", "Catarsis", "스프링 달팽이", "자석을 문 강아지", "회전목마 물고기", "Counterpoint"],
  rubber: ["말랑한 튕김", "미열", "달콤한 귤", "A flor de piel", "스케이트 타는 문어", "구름 운동화", "버블 램프 아귀", "양말 괴물", "소용돌이 귤", "달 표면 마카롱"],
  seeds: ["씨앗 셰이커", "흩날리는 벚꽃", "창밖의 계절", "Carpe diem", "거꾸로 자라는 당근", "우산 쓴 선인장", "무중력 팝콘", "별가루 탬버린", "씨앗 캡슐"],
  vinyl: ["레코드 마찰", "Nachbild", "余韻", "The uncanny", "얼음 레코드", "노을을 삼킨 카세트", "기억을 굽는 토스터", "Ars longa, vita brevis", "그리운 목소리", "비 냄새"],
  relay: ["전기 접점", "끊긴 신호", "Augenblick", "In medias res", "빛이 새는 지퍼", "연결이 끊긴 행성", "心流", "Gesamtkunstwerk"],
  felt: ["부드러운 손 타격", "낡은 피아노", "가로등", "달팽이 자국", "間", "もののあはれ", "Añoranza", "Let it sink in", "Amor fati", "커피 위의 섬", "양말 한 짝", "Sub rosa"],
  frost: ["잎사귀의 사각임", "첫눈", "별이 숨은 자리", "빛의 먼지", "푸른 시간", "心ここにあらず", "물을 걷는 불씨"],
};

const originalCues = { bell: "catch-5", glass: "layer-5" };
const recorded = new Set(["depth", "water", "wood", "seeds", "air", "felt", "frost"]);
const swingDelay = [0, .024, .055, .03];
const phrases = {
  base: [[2, 10], [4, 13], [6, 12], [3, 14]],
  melody: [[6, 13], [7, 12], [5, 14], [6, 11]],
  texture: [[10], [13], [7], [14]],
};
const assigned = new Map();
for (const [family, [, ...names]] of Object.entries(sounds)) {
  for (const name of names) assigned.set(name, family);
}

export function inspirationSound(item) {
  const seed = item.seed;
  const family = assigned.get(item.name) || Object.keys(sounds)[seed % Object.keys(sounds).length];
  const code = (seed * 71 + 13) % 256;
  const natural = recorded.has(family);
  const tuning = seed * 37 % 150;
  const rate = natural ? .96 + tuning * .0006 : .85 + tuning * .0022;
  const pair = [code % 16, 16 + Math.floor(code / 16)];
  return {
    family, label: sounds[family][0], rate, natural,
    echo: .085 + (seed * 13 % 41) * .003,
    pattern: [...pair, 32 + (code % 13), 48 + (code * 3 % 16)],
  };
}

export async function loadInspirationSamples(context) {
  const buffers = new Map();
  await Promise.allSettled(Object.keys(sounds).map(async family => {
    const file = originalCues[family] ? "fx/" + originalCues[family] : "voices/" + family;
    const url = new URL("./assets/" + file + ".wav", import.meta.url);
    const response = await fetch(url);
    if (!response.ok) throw new Error("Audio asset " + response.status);
    buffers.set(family, await context.decodeAudioData(await response.arrayBuffer()));
  }));
  return buffers;
}

export class InspirationLayers {
  constructor(context, output, buffers, take = 0) {
    this.context = context;
    this.output = output;
    this.buffers = buffers;
    this.voices = new Map();
    this.take = take;
    this.groups = {};
  }

  hit(sound, output, at, level, rate = sound.rate) {
    const buffer = this.buffers.get(sound.family);
    if (!buffer) return;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    gain.gain.value = level;
    source.connect(gain).connect(output);
    source.start(at);
    source.onended = () => { source.disconnect(); gain.disconnect(); };
  }

  cue(item, at, release = false) {
    const sound = inspirationSound(item);
    const rate = sound.natural ? sound.rate : sound.rate * (release ? .76 : 1.08);
    this.hit(sound, this.output, at, release ? .12 : .32, rate);
    if (!release) this.hit(sound, this.output, at + sound.echo, sound.natural ? .07 : .12, sound.rate * (sound.natural ? .98 : .84));
  }

  sync(items, at, step = null) {
    const ids = new Set(items.map(item => item.id));
    for (const [id, voice] of this.voices) {
      if (ids.has(id)) continue;
      voice.gain.gain.cancelScheduledValues(at);
      voice.gain.gain.setTargetAtTime(0, at, .032);
      if (step !== null) setTimeout(() => voice.gain.disconnect(), 250);
      this.voices.delete(id);
    }
    const level = (this.take ? .38 : .46) / Math.sqrt(1 + Math.max(0, items.length - 1) * .14);
    for (const item of items) {
      let voice = this.voices.get(item.id);
      if (!voice) {
        const sound = inspirationSound(item);
        const offset = ((item.slot ?? 0) * 5) % 16;
        const strengths = item.role === "texture" ? [.74, .38] : [.87, .62];
        const pulses = new Map(sound.pattern.map((pulse, index) =>
          [pulse - pulse % 16 + (pulse + offset) % 16, strengths[index % 2]]
        ));
        const gain = this.context.createGain();
        gain.gain.value = level;
        gain.connect(this.output);
        voice = {
          sound, pulses, gain, role: item.role, seed: item.seed,
          timing: item.seed % 7 * .002, minStep: step === null ? 0 : step + 4,
        };
        this.voices.set(item.id, voice);
        if (step !== null) this.hit(sound, gain, at, this.take ? .72 : .88);
      }
      voice.gain.gain.setTargetAtTime(level, at, .04);
    }
    if (this.take) {
      this.groups = { base: [], melody: [], texture: [] };
      for (const voice of this.voices.values()) this.groups[voice.role]?.push(voice);
    }
  }

  schedule(step, at) {
    if (this.take) {
      const bar = Math.floor(step / 16);
      for (const [role, group] of Object.entries(this.groups)) {
        if (!group.length) continue;
        const index = (bar + this.take) % group.length;
        this.playPhrase(group[index], step, at, bar);
        if (role === "base" && group.length > 1 && step % 16 >= 8) {
          this.playPhrase(group[(index + 1) % group.length], step, at, bar, .55);
        }
      }
      return;
    }
    for (const voice of this.voices.values()) {
      const strength = voice.pulses.get(step % 64);
      if (strength && step >= voice.minStep) {
        const playedAt = at + swingDelay[step % 4] + voice.timing;
        this.hit(voice.sound, voice.gain, playedAt, strength);
      }
    }
  }

  playPhrase(voice, step, at, bar, answer = 1) {
    if (step < voice.minStep) return;
    const pattern = phrases[voice.role][(voice.seed + this.take + Math.floor(bar / 2)) % 4];
    const offset = bar % 4 === 3 ? 1 : 0;
    const position = pattern.indexOf(step % 16 - offset);
    if (position < 0) return;
    const pulse = position === 0 ? .9 : .58;
    const color = voice.sound.natural ? 1 : .72;
    const timing = swingDelay[step % 4] + voice.timing;
    this.hit(voice.sound, voice.gain, at + timing, answer * pulse * color);
  }
}
