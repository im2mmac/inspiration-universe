// 영감의 우주 음악 재료: Suno로 만든 열 곡을 악기별(스템)로 나눈 것. 모두 150 BPM.
// 곡마다 악기가 꽉 찬 16마디 구간을 최대 세 군데 골라 이어 붙였다 (곡이 진행되며 구간이 바뀐다).
// 2번(149)과 3번(74×2)은 음 높이를 유지한 채 150으로 늘렸다. 4번은 원래 16마디 루프다.
// x1~x4는 기존 150 BPM 준비본의 8마디(12.8초) 악기 루프를 사용한다.
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
    "title": "카트리지 히스",
    "mood": "groove",
    "seconds": 12.8,
    "format": "wav",
    "stems": [
      "Bass",
      "Drums",
      "Keyboard",
      "Percussion",
      "Synth"
    ]
  },
  {
    "id": "x2",
    "title": "고정 루프",
    "mood": "groove",
    "seconds": 12.8,
    "format": "wav",
    "stems": [
      "Bass",
      "Drums",
      "Keyboard",
      "Percussion",
      "Synth"
    ]
  },
  {
    "id": "x3",
    "title": "잔향 루프",
    "mood": "dream",
    "seconds": 12.8,
    "format": "wav",
    "stems": [
      "Bass",
      "Drums",
      "Percussion",
      "Synth"
    ]
  },
  {
    "id": "x4",
    "title": "손끝의 리듬",
    "mood": "love",
    "seconds": 12.8,
    "format": "wav",
    "stems": [
      "Guitar",
      "Keyboard",
      "Synth"
    ]
  }
];

// 원본 10곡 모두 바탕 곡 후보로 사용한다.
export const MAIN_SONGS = SONGS;

// 악기마다 들리는 크기를 고르게 맞추는 값 (활성 구간 기준 -26dB에 맞춤, 0.6~2.5배)
export const STEM_GAIN = {"s1/Choir": 2.32, "s1/Bass": 1.08, "s1/Brass": 2.5, "s1/Drums": 1.38, "s1/Guitar": 1.91, "s1/Other": 2.5, "s1/Percussion": 1.0, "s1/Strings": 1.08, "s1/Synth": 1.82, "s1/Woodwinds": 1.91, "s10/Bass": 1.57, "s10/Drums": 0.6, "s10/Guitar": 1.15, "s10/Keyboard": 1.97, "s10/Percussion": 1.7, "s10/Synth": 1.97, "s2/Bass": 2.5, "s2/Brass": 2.43, "s2/Percussion": 2.5, "s2/Strings": 1.24, "s2/Woodwinds": 0.84, "s3/Bass": 0.6, "s3/Drums": 0.6, "s3/Guitar": 2.24, "s3/Keyboard": 0.92, "s3/Percussion": 1.4, "s3/Synth": 1.1, "s4/Bass": 1.16, "s4/Drums": 0.6, "s4/Keyboard": 1.8, "s4/Synth": 1.23, "s5/Bass": 1.16, "s5/Brass": 2.5, "s5/Drums": 0.65, "s5/Guitar": 2.5, "s5/Keyboard": 2.02, "s5/Percussion": 1.62, "s5/Strings": 0.73, "s5/Synth": 2.5, "s5/Woodwinds": 1.55, "x1/Drums": 0.63, "x1/Percussion": 1.98, "x2/Drums": 0.71, "x2/Percussion": 1.55, "x3/Drums": 0.79, "x3/Percussion": 1.41, "x1/Bass": 0.89, "x1/Keyboard": 0.94, "x1/Synth": 1.0, "x2/Bass": 0.89, "x2/Keyboard": 1.19, "x2/Synth": 1.12, "x3/Bass": 1.0, "x3/Synth": 1.0, "x4/Guitar": 0.79, "x4/Keyboard": 1.78, "x4/Synth": 1.78};

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
// 이미 발급한 QR의 악기 번호를 보존하고 새 악기는 뒤에 추가한다.
const originalLayers = ["s1/Drums", "s1/Bass", "s1/Percussion", "s1/Guitar", "s1/Strings", "s1/Brass", "s1/Woodwinds", "s1/Synth", "s1/Choir", "s1/Other", "s2/Bass", "s2/Percussion", "s2/Strings", "s2/Brass", "s2/Woodwinds", "s3/Drums", "s3/Bass", "s3/Percussion", "s3/Keyboard", "s3/Guitar", "s3/Synth", "s4/Drums", "s4/Bass", "s4/Keyboard", "s4/Synth", "s5/Drums", "s5/Bass", "s5/Percussion", "s5/Keyboard", "s5/Guitar", "s5/Strings", "s5/Brass", "s5/Woodwinds", "s5/Synth", "s10/Drums", "s10/Bass", "s10/Percussion", "s10/Keyboard", "s10/Guitar", "s10/Synth", "x1/Drums", "x1/Percussion", "x2/Drums", "x2/Percussion", "x3/Drums", "x3/Percussion"];
export const LAYERS = [...originalLayers, ...SONGS.flatMap(song => song.stems.map(stem => song.id + "/" + stem)).filter(layer => !originalLayers.includes(layer))];

export function stemUrl(layer) {
  const song = SONGS.find(song => song.id === layer.split("/")[0]);
  return new URL("./assets/music/" + layer + "." + (song?.format || "m4a"), import.meta.url);
}
