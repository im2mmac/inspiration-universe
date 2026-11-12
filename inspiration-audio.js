const sounds = {
  depth: ["낮은 북", "심연의 어둠", "Weltschmerz", "Claroscuro", "Memento mori", "사막을 담은 스노볼", "유리 속 산불", "말랑한 행성"],
  water: ["물방울", "호수의 반짝임", "거친 파도", "물방울", "비를 키우는 화분", "水", "빈 수영장", "접히는 바다", "마지막 파도", "거품 기차"],
  glass: ["유리의 떨림", "유리잔 속 소용돌이", "수면에 비친 나", "镜花水月", "유리 해파리", "얼음 나비", "물속의 보름달", "나침반 달걀", "金継ぎ"],
  paper: ["종이 마찰", "부치지 못한 편지", "종이배", "Aus dem Rahmen fallen", "Tabula rasa", "종이배 잠수함", "그림자를 접는 가위", "우주 택배 상자", "Negative space"],
  wood: ["나뭇결 타격", "가 보지 않은 길", "빈 의자", "Dejar huella", "侘び寂び", "별을 깎는 연필깎이", "도토리 잠수복", "木漏れ日", "留白", "Gestalt"],
  rail: ["레일의 딸깍임", "밤기차", "도시의 맥박", "Punto de fuga", "바람을 감는 실패", "부유하는 버스 정류장", "브롬톤 자전거", "Zeitgeist", "어둠을 깨우는 새벽"],
  air: ["숨결과 바람", "아득한 우주", "안개", "손끝의 바람", "흐릿한 수평선", "숨결", "Fernweh", "Liminal space", "息をのむ", "구름 그림자", "若隐若现", "意境"],
  tin: ["얇은 금속판", "양철 지붕과 빗방울", "불타는 노을", "낯선 행성", "Disonancia cognitiva", "폭풍 찻잔", "주름진 번개", "깨어나는 로봇 화석"],
  bell: ["작은 종", "새벽종", "새벽빛", "야광별", "共鸣", "Per aspera ad astra", "달빛을 담은 우체통", "연기를 삼킨 종", "一期一会", "画龙点睛"],
  pixel: ["8비트 픽셀음", "무한의 스크롤", "편의점 불빛", "잠든 알람", "灵光一闪", "신호를 먹는 고양이", "젤리 신호등", "네온 산호", "번역하는 앵무새"],
  scan: ["스캐너 파동", "고요한 궤도", "사그라든 별", "서버실의 여름", "Pareidolia", "버섯 위성", "해초 라디오", "전파를 줍는 까마귀", "Awe", "恍如隔世", "In the blink of an eye"],
  spring: ["스프링 울림", "환희의 물결", "Desasosiego", "Catarsis", "스프링 달팽이", "자석을 문 강아지", "회전목마 물고기", "Counterpoint"],
  rubber: ["말랑한 튕김", "미열", "달콤한 귤", "A flor de piel", "스케이트 타는 문어", "구름 운동화", "버블 램프 아귀", "양말 괴물", "소용돌이 귤", "달 표면 마카롱"],
  seeds: ["씨앗 셰이커", "흩날리는 벚꽃", "창밖의 계절", "Carpe diem", "거꾸로 자라는 당근", "우산 쓴 선인장", "무중력 팝콘", "별가루 탬버린", "씨앗 캡슐"],
  vinyl: ["레코드 마찰", "Nachbild", "余韻", "The uncanny", "얼음 레코드", "노을을 삼킨 카세트", "기억을 굽는 토스터", "Ars longa, vita brevis", "그리운 목소리", "비 냄새"],
  relay: ["전기 접점", "끊긴 신호", "Augenblick", "In medias res", "빛이 새는 지퍼", "연결이 끊긴 행성", "心流", "Gesamtkunstwerk"],
  felt: ["펠트 타격", "낡은 피아노", "가로등", "달팽이 자국", "間", "もののあはれ", "Añoranza", "Let it sink in", "Amor fati", "커피 위의 섬", "양말 한 짝", "Sub rosa"],
  frost: ["서리의 사각임", "첫눈", "별이 숨은 자리", "빛의 먼지", "푸른 시간", "心ここにあらず", "물을 걷는 불씨"],
};

const originalCues = { water: "catch-1", wood: "catch-2", bell: "catch-5", glass: "layer-5" };
const assigned = new Map();
for (const [family, [, ...names]] of Object.entries(sounds)) {
  for (const name of names) assigned.set(name, family);
}

export function inspirationSound(item) {
  const seed = item.seed;
  const family = assigned.get(item.name) || Object.keys(sounds)[seed % Object.keys(sounds).length];
  const code = (seed * 71 + 13) % 256;
  const rate = .85 + (seed * 37 % 150) * .0022;
  const pair = [code % 16, 16 + Math.floor(code / 16)];
  return {
    family, label: sounds[family][0], rate,
    echo: .085 + (seed * 13 % 41) * .003,
    pattern: item.role === "texture"
      ? pair.map(step => step + 16)
      : [...pair, 32 + (code % 13), 48 + (code * 3 % 16)],
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
  constructor(context, output, buffers) {
    this.context = context;
    this.output = output;
    this.buffers = buffers;
    this.voices = new Map();
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
    this.hit(sound, this.output, at, release ? .13 : .34, sound.rate * (release ? .76 : 1.08));
    if (!release) this.hit(sound, this.output, at + sound.echo, .12, sound.rate * .84);
  }

  sync(items, at, step = null) {
    const ids = new Set(items.map(item => item.id));
    for (const [id, voice] of this.voices) {
      if (ids.has(id)) continue;
      voice.gain.gain.cancelScheduledValues(at);
      voice.gain.gain.setTargetAtTime(0, at, .032);
      setTimeout(() => voice.gain.disconnect(), 250);
      this.voices.delete(id);
    }
    const level = .46 / Math.sqrt(1 + Math.max(0, items.length - 1) * .14);
    for (const item of items) {
      let voice = this.voices.get(item.id);
      if (!voice) {
        const sound = inspirationSound(item);
        const offset = ((item.slot ?? 0) * 5) % 16;
        const pulses = new Map(sound.pattern.map((pulse, index) =>
          [pulse - pulse % 16 + (pulse + offset) % 16, index % 2 === 0 ? .87 : .62]
        ));
        const gain = this.context.createGain();
        gain.gain.value = level;
        gain.connect(this.output);
        voice = { sound, pulses, gain, minStep: step === null ? 0 : step + 4 };
        this.voices.set(item.id, voice);
        if (step !== null) this.hit(sound, gain, at, .88);
      }
      voice.gain.gain.setTargetAtTime(level, at, .04);
    }
  }

  schedule(step, at) {
    for (const voice of this.voices.values()) {
      const strength = voice.pulses.get(step % 64);
      if (strength && step >= voice.minStep) this.hit(voice.sound, voice.gain, at, strength);
    }
  }
}
