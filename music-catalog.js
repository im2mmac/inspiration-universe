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
      "Keyboard",
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
      "Keyboard",
      "Strings",
      "Brass",
      "Woodwinds",
      "Synth"
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
