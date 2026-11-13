// 영감의 우주 음악 재료: Suno로 만든 여섯 곡을 악기별(스템)로 나눈 것. 모두 150 BPM.
// 곡마다 악기가 꽉 찬 16마디 구간을 최대 세 군데 골라 이어 붙였다 (곡이 진행되며 구간이 바뀐다).
// 2번(149)과 3번(74×2)은 음 높이를 유지한 채 150으로 늘렸다. 4번은 원래 16마디 루프다.
// extra: 폴더의 추가 루프에서 꺼낸 8마디 드럼·퍼커션. 바탕 곡으로는 쓰지 않고 섞여 드는 리듬으로만 쓴다.
export const BPM = 150;

export const SONGS = [
  {
    "id": "s1",
    "title": "우주 시네마틱",
    "key": "G minor",
    "mood": "space",
    "seconds": 76.8,
    "stems": [
      "Drums",
      "Bass",
      "Percussion",
      "Guitar",
      "Strings",
      "Brass",
      "Woodwinds",
      "Synth",
      "Choir",
      "Other"
    ]
  },
  {
    "id": "s2",
    "title": "여름 바닷가 오케스트라",
    "key": "E♭ major",
    "mood": "sea",
    "seconds": 76.8,
    "stems": [
      "Bass",
      "Percussion",
      "Strings",
      "Brass",
      "Woodwinds"
    ]
  },
  {
    "id": "s3",
    "title": "물속의 꿈",
    "key": "C major",
    "mood": "dream",
    "seconds": 76.8,
    "stems": [
      "Drums",
      "Bass",
      "Percussion",
      "Keyboard",
      "Guitar",
      "Synth"
    ]
  },
  {
    "id": "s4",
    "title": "별빛 그루브",
    "key": "C minor",
    "mood": "groove",
    "seconds": 25.6,
    "stems": [
      "Drums",
      "Bass",
      "Keyboard",
      "Synth"
    ]
  },
  {
    "id": "s5",
    "title": "설레는 첫사랑",
    "key": "G major",
    "mood": "love",
    "seconds": 76.8,
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
    "id": "s10",
    "title": "기쁨의 원",
    "key": "G major",
    "mood": "joy",
    "seconds": 25.6,
    "stems": [
      "Drums",
      "Bass",
      "Percussion",
      "Keyboard",
      "Guitar",
      "Synth"
    ]
  },
  {
    "id": "x1",
    "title": "카트리지 히스 리듬",
    "seconds": 12.8,
    "stems": [
      "Drums",
      "Percussion"
    ],
    "extra": true
  },
  {
    "id": "x2",
    "title": "고정 루프 리듬",
    "seconds": 12.8,
    "stems": [
      "Drums",
      "Percussion"
    ],
    "extra": true
  },
  {
    "id": "x3",
    "title": "잔향 루프 리듬",
    "seconds": 12.8,
    "stems": [
      "Drums",
      "Percussion"
    ],
    "extra": true
  }
];

// 바탕 곡으로 고를 수 있는 곡 (추가 리듬 제외)
export const MAIN_SONGS = SONGS.filter(song => !song.extra);

// 악기마다 들리는 크기를 고르게 맞추는 값 (활성 구간 기준 -26dB에 맞춤, 0.6~2.5배)
export const STEM_GAIN = {"s1/Choir": 2.32, "s1/Bass": 1.08, "s1/Brass": 2.5, "s1/Drums": 1.38, "s1/Guitar": 1.91, "s1/Other": 2.5, "s1/Percussion": 1.0, "s1/Strings": 1.08, "s1/Synth": 1.82, "s1/Woodwinds": 1.91, "s10/Bass": 1.57, "s10/Drums": 0.6, "s10/Guitar": 1.15, "s10/Keyboard": 1.97, "s10/Percussion": 1.7, "s10/Synth": 1.97, "s2/Bass": 2.5, "s2/Brass": 2.43, "s2/Percussion": 2.5, "s2/Strings": 1.24, "s2/Woodwinds": 0.84, "s3/Bass": 0.6, "s3/Drums": 0.6, "s3/Guitar": 2.24, "s3/Keyboard": 0.92, "s3/Percussion": 1.4, "s3/Synth": 1.1, "s4/Bass": 1.16, "s4/Drums": 0.6, "s4/Keyboard": 1.8, "s4/Synth": 1.23, "s5/Bass": 1.16, "s5/Brass": 2.5, "s5/Drums": 0.65, "s5/Guitar": 2.5, "s5/Keyboard": 2.02, "s5/Percussion": 1.62, "s5/Strings": 0.73, "s5/Synth": 2.5, "s5/Woodwinds": 1.55, "x1/Drums": 0.6, "x1/Percussion": 2.5, "x2/Drums": 0.6, "x2/Percussion": 2.5, "x3/Drums": 0.68, "x3/Percussion": 1.22};

// true면 다른 곡의 선율·화음 악기도 마구 섞인다 (템포는 같고 조성은 다르다). 들어 보니 완성곡이 탁해져서 끔.
// 들어 보고 탁하면 false로 바꾸면 화음이 맞는 곡(COMPATIBLE)끼리만 섞인다.
export const MIX_MELODIES = false;

export const COMPATIBLE = { s5: ["s10"], s10: ["s5"] };

export const INSTRUMENTS = {
  Drums: "드럼", Bass: "베이스", Percussion: "퍼커션", Keyboard: "건반", Guitar: "기타",
  Strings: "현악", Brass: "금관", Woodwinds: "목관", Synth: "신스", Choir: "코러스", Other: "사운드",
};

// 악기 성격: 리듬(음 높이 없음), 낮은 소리, 화음, 선율
export const KIND = {
  Drums: "rhythm", Percussion: "rhythm", Bass: "low",
  Keyboard: "harmony", Strings: "harmony", Synth: "harmony", Guitar: "harmony", Other: "harmony",
  Brass: "lead", Woodwinds: "lead", Choir: "lead",
};

// QR 주소에 담기 위한 전체 층 목록 (순서를 바꾸면 기존 QR이 어긋나니 끝에만 추가할 것)
export const LAYERS = SONGS.flatMap(song => song.stems.map(stem => song.id + "/" + stem));

export function stemUrl(layer) {
  return new URL("./assets/music/" + layer + ".m4a", import.meta.url);
}
