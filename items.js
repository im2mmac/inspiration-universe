// 영감의 우주 재료 목록: 단어와 구절 100개, 3D 이미지 50종.
// role은 audio-engine.js가 읽는 음악 역할이다 (B=base, M=melody, T=texture).
// 음악 쪽에서 역할을 바꿀 때는 이 파일의 글자 하나만 고치면 된다.
// back이 있는 단어는 Y축으로 돌면서 앞뒤 언어가 바뀐다.

const R = { B: "base", M: "melody", T: "texture" };

// [앞면, 역할, 뒷면(번역), 뜻풀이]
const words = [
  ["심연의 어둠", "B"], ["호수의 반짝임", "M"], ["물속의 보름달", "M"], ["첫눈", "T"],
  ["거친 파도", "B"], ["밤기차", "B"], ["부치지 못한 편지", "M"], ["양철 지붕과 빗방울", "T"],
  ["어둠을 깨우는 새벽", "M"], ["비 냄새", "T", "雨の匂い"], ["별이 숨은 자리", "T"], ["미열", "T"],
  ["불타는 노을", "B"], ["유리잔 속 소용돌이", "T"], ["새벽빛", "M", "Luz de madrugada"], ["물방울", "M"],
  ["흩날리는 벚꽃", "T"], ["빈 의자", "B"], ["고요한 궤도", "B", "Silent Orbit"], ["가 보지 않은 길", "M"],
  ["편의점 불빛", "T"], ["손끝의 바람", "T"], ["환희의 물결", "M"], ["아득한 우주", "B"],
  ["가로등", "M"], ["안개", "B"], ["도시의 맥박", "B"], ["구름 그림자", "B"],
  ["낯선 행성", "T"], ["잠든 알람", "T"], ["종이배", "M"], ["낡은 피아노", "M"],
  ["사그라든 별", "B"], ["창밖의 계절", "M"], ["그리운 목소리", "M"], ["달팽이 자국", "T"],
  ["빈 수영장", "B"], ["수면에 비친 나", "M"], ["무한의 스크롤", "T"], ["달콤한 귤", "M"],
  ["야광별", "T"], ["빛의 먼지", "T", "Poussière de lumière"], ["새벽종", "M"], ["흐릿한 수평선", "B"],
  ["서버실의 여름", "T"], ["숨결", "B"], ["끊긴 신호", "T"], ["양말 한 짝", "T"],
  ["마지막 파도", "B", "La última ola"], ["푸른 시간", "B"],

  ["Fernweh", "T", "먼 곳을 향한 마음", "먼 곳으로 떠나고 싶은 마음"],
  ["Augenblick", "T", "찰나"], ["Nachbild", "T", "잔상"],
  ["Weltschmerz", "B", "세상의 비애", "세상의 현실에서 느끼는 비애"],
  ["Zeitgeist", "B", "시대정신"], ["Gestalt", "M", "전체로 보이는 형상", "하나의 전체로 지각되는 형상"],
  ["Gesamtkunstwerk", "M", "종합예술작품", "여러 예술을 결합한 종합예술작품"],
  ["Aus dem Rahmen fallen", "T", "틀에서 벗어나다"],
  ["Añoranza", "M", "그리움"], ["Desasosiego", "T", "마음의 동요"],
  ["Claroscuro", "B", "빛과 어둠의 대비", "빛과 어둠의 대비를 살린 명암법"],
  ["Punto de fuga", "B", "소실점"], ["Catarsis", "M", "감정의 정화", "카타르시스, 감정의 정화"],
  ["Disonancia cognitiva", "T", "인지 부조화", "믿음이나 행동이 서로 어긋날 때의 불편함"],
  ["A flor de piel", "M", "살갗까지 차오른 감정", "감정이 겉으로 드러날 만큼 예민한"],
  ["Dejar huella", "B", "흔적을 남기다"],
  ["留白", "B", "여백을 남기다"], ["意境", "M", "작품의 정취", "작품이 자아내는 정취와 세계"],
  ["共鸣", "T", "공명", "공명, 마음이 함께 울림"], ["心流", "M", "깊은 몰입", "시간을 잊을 만큼 깊은 몰입"],
  ["镜花水月", "M", "닿지 않는 환영", "거울 속 꽃과 물에 비친 달, 손에 닿지 않는 환영"],
  ["若隐若现", "T", "보일 듯 말 듯"], ["灵光一闪", "T", "영감이 번뜩이다"],
  ["画龙点睛", "M", "화룡점정", "마지막 한 획으로 생기를 더하다"],
  ["恍如隔世", "B", "한 세상이 지난 듯", "마치 한 세상이 지난 듯하다"],
  ["木漏れ日", "M", "나뭇잎 사이 햇살", "나뭇잎 사이로 비치는 햇살"], ["余韻", "T", "여운"],
  ["間", "B", "사이의 쉼", "소리와 소리, 움직임과 움직임 사이의 쉼"],
  ["もののあはれ", "M", "애틋한 정취", "사물과 순간에서 느끼는 애틋한 정취"],
  ["侘び寂び", "B", "소박함의 아름다움", "소박함과 세월의 흔적에서 느끼는 아름다움"],
  ["金継ぎ", "M", "금빛 이음", "깨진 도자기를 이어 이음매를 금빛으로 드러내는 기법"],
  ["息をのむ", "T", "숨을 삼키다", "놀라거나 감탄해 숨을 삼키다"], ["心ここにあらず", "T", "마음이 딴 데"],
  ["一期一会", "M", "일생 한 번의 만남", "일생에 한 번뿐인 만남"],
  ["Negative space", "B", "여백", "대상 주위와 사이의 여백"],
  ["Counterpoint", "M", "대위법", "독립적인 선율들이 함께 흐르는 기법"],
  ["Pareidolia", "T", "구름 속의 얼굴", "사물에서 익숙한 형상을 알아보는 현상"],
  ["Liminal space", "B", "사이 공간", "한 상태에서 다른 곳으로 넘어가는 사이 공간"],
  ["The uncanny", "T", "낯선 익숙함", "익숙한 것이 낯설고 섬뜩하게 느껴지는 감각"],
  ["Awe", "B", "경외감"], ["In the blink of an eye", "T", "눈 깜짝할 사이"],
  ["Let it sink in", "B", "천천히 스며들게", "천천히 실감할 시간을 가져 봐"],
  ["Carpe diem", "M", "오늘을 붙잡아라"], ["Memento mori", "B", "죽음을 기억하라"],
  ["Per aspera ad astra", "M", "역경을 지나 별로"],
  ["Ars longa, vita brevis", "M", "예술은 길고 인생은 짧다"],
  ["In medias res", "T", "이야기의 한복판으로"], ["Tabula rasa", "B", "백지", "아직 아무것도 쓰이지 않은 백지"],
  ["Amor fati", "M", "운명애", "자신의 운명에 대한 사랑"],
  ["Sub rosa", "T", "장미 아래의 비밀", "비밀리에, 글자 그대로는 ‘장미 아래에서’"],
];

// [번호, 이름, 역할]
const images = [
  ["01", "달빛을 담은 우체통", "M"], ["02", "버섯 위성", "T"], ["03", "유리 해파리", "M"],
  ["04", "폭풍 찻잔", "T"], ["05", "스케이트 타는 문어", "T"], ["06", "별을 깎는 연필깎이", "M"],
  ["07", "사막을 담은 스노볼", "B"], ["08", "구름 운동화", "M"], ["09", "버블 램프 아귀", "B"],
  ["10", "비를 키우는 화분", "M"], ["11", "얼음 레코드", "M"], ["12", "신호를 먹는 고양이", "T"],
  ["13", "브롬톤 자전거", "B"], ["14", "접히는 바다", "B"], ["15", "거꾸로 자라는 당근", "T"],
  ["16", "빛이 새는 지퍼", "T"], ["17", "나침반 달걀", "M"], ["18", "우주 택배 상자", "B"],
  ["19", "스프링 달팽이", "T"], ["20", "젤리 신호등", "T"], ["21", "유리 속 산불", "B"],
  ["22", "우산 쓴 선인장", "M"], ["23", "노을을 삼킨 카세트", "M"], ["24", "전파를 줍는 까마귀", "T"],
  ["25", "부유하는 버스 정류장", "B"], ["26", "주름진 번개", "T"], ["27", "물을 걷는 불씨", "M"],
  ["28", "종이배 잠수함", "B"], ["29", "기억을 굽는 토스터", "M"], ["30", "거품 기차", "M"],
  ["31", "해초 라디오", "T"], ["32", "자석을 문 강아지", "T"], ["33", "말랑한 행성", "B"],
  ["34", "네온 산호", "T"], ["35", "무중력 팝콘", "T"], ["36", "그림자를 접는 가위", "B"],
  ["37", "도토리 잠수복", "B"], ["38", "번역하는 앵무새", "M"], ["39", "바람을 감는 실패", "M"],
  ["40", "커피 위의 섬", "B"], ["41", "별가루 탬버린", "T"], ["42", "소용돌이 귤", "M"],
  ["43", "깨어나는 로봇 화석", "B"], ["44", "씨앗 캡슐", "M"], ["45", "양말 괴물", "T"],
  ["46", "얼음 나비", "M"], ["47", "회전목마 물고기", "M"], ["48", "연기를 삼킨 종", "B"],
  ["49", "달 표면 마카롱", "M"], ["50", "연결이 끊긴 행성", "B"],
];

// 분위기: 바탕 곡과 어울리는 영감이 먼저 떠오르게 할 때 쓴다.
// space 우주 · sea 바다와 여름 · dream 몽환 · groove 리듬과 도시 · love 설렘과 그리움 · joy 즐거움
const moods = { "심연의 어둠": "space dream", "호수의 반짝임": "sea dream", "물속의 보름달": "sea dream space", "첫눈": "love dream", "거친 파도": "sea space", "밤기차": "groove love", "부치지 못한 편지": "love", "양철 지붕과 빗방울": "joy dream", "어둠을 깨우는 새벽": "space love", "비 냄새": "dream love", "별이 숨은 자리": "space", "미열": "love", "불타는 노을": "sea love", "유리잔 속 소용돌이": "dream groove", "새벽빛": "space love", "물방울": "sea dream", "흩날리는 벚꽃": "love joy", "빈 의자": "love dream", "고요한 궤도": "space", "가 보지 않은 길": "space sea", "편의점 불빛": "groove", "손끝의 바람": "sea love", "환희의 물결": "joy sea", "아득한 우주": "space", "가로등": "groove love", "안개": "dream", "도시의 맥박": "groove", "구름 그림자": "sea dream", "낯선 행성": "space groove", "잠든 알람": "dream", "종이배": "sea joy", "낡은 피아노": "love", "사그라든 별": "space", "창밖의 계절": "love sea", "그리운 목소리": "love", "달팽이 자국": "joy dream", "빈 수영장": "dream sea", "수면에 비친 나": "dream", "무한의 스크롤": "groove", "달콤한 귤": "joy sea", "야광별": "space dream", "빛의 먼지": "space dream", "새벽종": "space joy", "흐릿한 수평선": "sea dream", "서버실의 여름": "groove", "숨결": "dream love", "끊긴 신호": "groove space", "양말 한 짝": "joy", "마지막 파도": "sea", "푸른 시간": "dream space", "Fernweh": "sea space", "Augenblick": "love", "Nachbild": "dream", "Weltschmerz": "space", "Zeitgeist": "groove", "Gestalt": "groove", "Gesamtkunstwerk": "joy", "Aus dem Rahmen fallen": "groove joy", "Añoranza": "love", "Desasosiego": "dream", "Claroscuro": "space", "Punto de fuga": "space", "Catarsis": "space joy", "Disonancia cognitiva": "groove", "A flor de piel": "love", "Dejar huella": "love sea", "留白": "dream", "意境": "dream space", "共鸣": "joy love", "心流": "groove", "镜花水月": "dream sea", "若隐若现": "dream", "灵光一闪": "space groove", "画龙点睛": "joy", "恍如隔世": "space", "木漏れ日": "sea love", "余韻": "love dream", "間": "dream", "もののあはれ": "love", "侘び寂び": "dream", "金継ぎ": "love", "息をのむ": "space", "心ここにあらず": "dream love", "一期一会": "love joy", "Negative space": "space", "Counterpoint": "groove joy", "Pareidolia": "dream", "Liminal space": "dream space", "The uncanny": "groove", "Awe": "space", "In the blink of an eye": "groove love", "Let it sink in": "dream", "Carpe diem": "joy", "Memento mori": "space", "Per aspera ad astra": "space", "Ars longa, vita brevis": "space love", "In medias res": "groove", "Tabula rasa": "dream", "Amor fati": "love joy", "Sub rosa": "love", "달빛을 담은 우체통": "love dream", "버섯 위성": "space joy", "유리 해파리": "sea dream", "폭풍 찻잔": "sea", "스케이트 타는 문어": "joy sea", "별을 깎는 연필깎이": "space joy", "사막을 담은 스노볼": "dream", "구름 운동화": "joy sea", "버블 램프 아귀": "sea dream", "비를 키우는 화분": "love dream", "얼음 레코드": "groove", "신호를 먹는 고양이": "groove joy", "브롬톤 자전거": "sea joy", "접히는 바다": "sea", "거꾸로 자라는 당근": "joy", "빛이 새는 지퍼": "space groove", "나침반 달걀": "space", "우주 택배 상자": "space joy", "스프링 달팽이": "joy", "젤리 신호등": "groove joy", "유리 속 산불": "space", "우산 쓴 선인장": "joy love", "노을을 삼킨 카세트": "groove love", "전파를 줍는 까마귀": "groove space", "부유하는 버스 정류장": "space dream", "주름진 번개": "groove", "물을 걷는 불씨": "dream", "종이배 잠수함": "sea", "기억을 굽는 토스터": "love", "거품 기차": "sea joy", "해초 라디오": "sea groove", "자석을 문 강아지": "joy", "말랑한 행성": "space joy", "네온 산호": "groove sea", "무중력 팝콘": "joy space", "그림자를 접는 가위": "dream", "도토리 잠수복": "sea joy", "번역하는 앵무새": "joy", "바람을 감는 실패": "sea love", "커피 위의 섬": "sea love", "별가루 탬버린": "joy space", "소용돌이 귤": "joy", "깨어나는 로봇 화석": "space groove", "씨앗 캡슐": "space love", "양말 괴물": "joy", "얼음 나비": "dream love", "회전목마 물고기": "joy sea", "연기를 삼킨 종": "dream", "달 표면 마카롱": "space joy", "연결이 끊긴 행성": "space" };

// 한국어 단어에 돌아가며 붙는 접근 효과. 번역이 있는 단어는 항상 flip.
const motions = ["twinkle", "spin", "wave", "drift"];

const script = text => /[぀-ヿ]/.test(text) ? "ja" : /[一-鿿]/.test(text) ? "zh" : /[가-힣]/.test(text) ? "ko" : "latin";

export const catalog = [
  ...words.map(([name, role, back, meaning], index) => ({
    kind: "word", name, role: R[role], back: back || null, meaning: meaning || back || null,
    script: script(name), backScript: back ? script(back) : null,
    motion: back ? "flip" : motions[index % motions.length],
  })),
  ...images.map(([number, name, role]) => ({
    kind: "image", name, role: R[role], image: "items/" + number, motion: "tumble",
  })),
].map((item, seed) => ({ ...item, seed, mood: (moods[item.name] || "").split(" ").filter(Boolean) }));
