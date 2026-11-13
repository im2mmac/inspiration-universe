// 영감의 우주 음악 재료: Suno로 만든 여섯 곡을 악기별(스템)로 나눠 150 BPM, 16마디(25.6초) 루프로 맞춘 것.
// 곡마다 악기가 가장 꽉 찬 16마디를 골라 잘랐다. 2번(149)과 3번(74×2)은 음 높이를 유지한 채 150으로 늘렸다.
// gain은 곡 전체 음량을 고르게 맞추는 값, compatible은 선율까지 섞어도 화음이 맞는 곡이다.
export const BPM = 150;
export const LOOP_BARS = 16;
export const LOOP_SECONDS = LOOP_BARS * 4 * 60 / BPM;

export const SONGS = [
  {
    "id": "s1", "mood": "space",
    "title": "우주 시네마틱",
    "key": "G minor",
    "gain": 0.955,
    "stems": [
      "Drums",
      "Bass",
      "Percussion",
      "Guitar",
      "Strings",
      "Brass",
      "Woodwinds",
      "Synth"
    ]
  },
  {
    "id": "s2", "mood": "sea",
    "title": "여름 바닷가 오케스트라",
    "key": "E♭ major",
    "gain": 1.641,
    "stems": [
      "Bass",
      "Strings",
      "Brass",
      "Woodwinds"
    ]
  },
  {
    "id": "s3", "mood": "dream",
    "title": "물속의 꿈",
    "key": "C major",
    "gain": 0.871,
    "stems": [
      "Drums",
      "Bass",
      "Percussion",
      "Keyboard",
      "Synth"
    ]
  },
  {
    "id": "s4", "mood": "groove",
    "title": "별빛 그루브",
    "key": "C minor",
    "gain": 1.245,
    "stems": [
      "Drums",
      "Bass",
      "Keyboard",
      "Synth"
    ]
  },
  {
    "id": "s5", "mood": "love",
    "title": "설레는 첫사랑",
    "key": "G major",
    "gain": 1.012,
    "stems": [
      "Drums",
      "Bass",
      "Percussion",
      "Keyboard",
      "Guitar",
      "Strings",
      "Brass",
      "Synth"
    ]
  },
  {
    "id": "s10", "mood": "joy",
    "title": "기쁨의 원",
    "key": "G major",
    "gain": 1.035,
    "stems": [
      "Drums",
      "Percussion",
      "Keyboard",
      "Guitar",
      "Synth"
    ]
  }
];

// 악기마다 들리는 크기를 고르게 맞추는 값 (활성 구간 기준 -26dB에 맞춤, 0.6~2.5배)
export const STEM_GAIN = {"s1/Bass": 0.77, "s1/Brass": 2.34, "s1/Drums": 1.17, "s1/Guitar": 1.53, "s1/Percussion": 0.86, "s1/Strings": 1.01, "s1/Synth": 1.66, "s1/Woodwinds": 1.58, "s10/Drums": 0.6, "s10/Guitar": 1.15, "s10/Keyboard": 1.97, "s10/Percussion": 1.7, "s10/Synth": 1.97, "s2/Bass": 2.09, "s2/Brass": 2.48, "s2/Strings": 1.19, "s2/Woodwinds": 0.69, "s3/Bass": 0.6, "s3/Drums": 0.6, "s3/Keyboard": 0.86, "s3/Percussion": 1.29, "s3/Synth": 1.0, "s4/Bass": 1.16, "s4/Drums": 0.6, "s4/Keyboard": 1.8, "s4/Synth": 1.23, "s5/Bass": 1.22, "s5/Brass": 2.48, "s5/Drums": 0.64, "s5/Guitar": 2.5, "s5/Keyboard": 1.91, "s5/Percussion": 1.8, "s5/Strings": 0.73, "s5/Synth": 2.34};

// true면 다른 곡의 선율·화음 악기도 마구 섞인다 (템포는 같고 조성은 다르다).
// 들어 보고 탁하면 false로 바꾸면 화음이 맞는 곡(COMPATIBLE)끼리만 섞인다.
export const MIX_MELODIES = true;

export const COMPATIBLE = { s5: ["s10"], s10: ["s5"] };

export const INSTRUMENTS = {
  Drums: "드럼", Bass: "베이스", Percussion: "퍼커션", Keyboard: "건반", Guitar: "기타",
  Strings: "현악", Brass: "금관", Woodwinds: "목관", Synth: "신스",
};

// 악기 성격: 리듬(음 높이 없음), 낮은 소리, 화음, 선율
export const KIND = {
  Drums: "rhythm", Percussion: "rhythm", Bass: "low",
  Keyboard: "harmony", Strings: "harmony", Synth: "harmony", Guitar: "harmony",
  Brass: "lead", Woodwinds: "lead",
};

// QR 주소에 담기 위한 전체 층 목록 (순서를 바꾸면 기존 QR이 어긋나니 끝에만 추가할 것)
export const LAYERS = SONGS.flatMap(song => song.stems.map(stem => song.id + "/" + stem));

export function stemUrl(layer) {
  return new URL("./assets/music/" + layer + ".m4a", import.meta.url);
}
