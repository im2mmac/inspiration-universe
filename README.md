# 영감의 우주

휴대폰에서 확인할 수 있는 사운드 체크와, 브라우저에서 영감을 낚고 놓아주는 전시 체험판이다.

- 루트는 체험판이다. 우주로 들어간 뒤 글자나 이미지를 누르거나 키보드로 선택해 낚는다. 하단에서 자신이 낚은 칸을 누르면 놓아준다. 1~3번 버튼으로 관람객을 바꿔 합주를 시연할 수 있다.
- `sound/`에서 영감별 효과음과 합주 레이어를 150 BPM으로 비교할 수 있다. 이전 92 BPM 시안도 들을 수 있다.
- 체험판의 카메라는 MediaPipe Pose로 관람객 위치(최대 3명)를, Hand Landmarker로 오른손 쥐기를 읽는다. 그물을 영감에 대고 **손을 꽉 쥐면** 낚인다. 손 모델을 못 불러오면 그물을 잠시 머무르게 하는 방식으로 바뀐다. 카메라 원본은 저장하거나 전송하지 않는다.
- 놓아주기: 카메라에서는 **왼손을 펴면 지우개**가 나타난다. 지우개로 자기 칸을 문지르면(대고 있으면 약 1초, 문지르면 더 빨리) 영감이 우주로 돌아간다. 오른손 그물을 자기 칸에 대고 주먹을 1초 쥐어도 된다. 마우스에서는 자기 칸을 누른다.
- 키보드: 1·2·3 관람객 전환(마우스 시연), 스페이스 낚기, V 카메라 미리보기(설치 점검용).
- 15개가 차면 현재 합주를 8마디 WAV로 저장할 수 있다. 영상 인코딩과 공동 QR 공유는 후속 검증 범위다.

## 화면 구성 (75인치 16:9 기준)

| 구역 | 화면 비율 | 75인치 실제 크기 |
| --- | --- | --- |
| 영감이 머무는 낚시 구역 | 위 11~56% | — |
| 우주인 (레드·옐로·블루) | 키 30%, 발 위치 90% | 약 28cm |
| 그물 고리 지름 | 너비 8.6% | 약 14cm |
| 낚을 수 있는 글자 크기 | 너비 2.2~3.7% | 약 4~6cm |
| 공동 수집 15칸 | 아래 11.5% | 한 칸 약 7.5cm |

- 영감은 화면 중앙의 소실점에서 별빛 한 점으로 나타나 원근감 있게 커진다. 한국어 단어는 반짝임·회전·물결·눕혀서 일어서기 중 하나로, 외국어 단어는 Y축으로 돌며 원어와 한국어 뜻이 번갈아 보인다. 3D 이미지는 흔들리며 다가온다. 낚을 거리가 되면 움직임이 잦아들고 금빛 고리가 생긴다.
- 재료 목록과 음악 역할(base·melody·texture)은 `items.js`에 있다. 화면 스타일은 `exhibit.css`, 사운드 체크 페이지 스타일은 `site.css`.
- `inspiration-audio.js`에서 영감별 음색과 리듬을 정한다. 첫 낚기에 일정한 카혼 박과 멜로디가 시작되고, 한 마디 뒤 첫 영감의 리듬이 합류한다. 이후 영감은 다음 박부터 얹히며 각 파트의 약박에는 약한 스윙이 있다. 로컬 수노 WAV가 있으면 고른 곡의 멜로디를 쓰고, 공개 버전은 하프 멜로디를 쓴다.

## 전시 운영

- 시작 화면은 없다. 페이지를 열면 우주가 흐르고 카메라가 켜진다. 사람이 웹캠에 잡히면 우주인이 나타나 바로 낚을 수 있다.
- 모두 떠나고 15초가 지나거나, 15칸 완성 후 40초가 지나면 저절로 새 우주로 돌아간다.
- 전시 PC 크롬 실행 예: `chrome --kiosk --autoplay-policy=no-user-gesture-required http://127.0.0.1:8000/` (카메라 권한은 처음 한 번 허용)
- 카메라 없이 마우스로 시연: 주소 끝에 `?camera=off`를 붙이고 화면을 클릭한다.

## 완성작 공유 (QR)

15칸이 차면 왼쪽에 "우리의 음악이 완성되었어요"와 QR이 뜬다. QR에는 고른 영감 목록만 담긴 `song.html` 주소(GitHub Pages)가 들어 있고, 휴대폰이 그 목록으로 같은 합주를 다시 만들어 WAV로 저장한다. 서버 업로드가 없어서 전시 PC는 인터넷 없이도 되지만, 관람객 휴대폰은 인터넷이 필요하다. QR 라이브러리: `vendor/qrcode.js` (qrcode-generator, MIT).

## 배경 영상

`assets/space-flight.mp4`가 있으면 사진 대신 그 영상을 배경으로 반복 재생한다 (예: Higgsfield 등으로 만든 우주 비행 영상). 없으면 NASA 사진 네 겹이 번갈아 확대되며 계속 우주 안으로 들어가는 연출이 나온다.

## 인터넷 없이 실행

`vendor/mediapipe/`에 MediaPipe 라이브러리가 들어 있다. 모델 파일은 전시 PC에서 `vendor/models/download-models.ps1`을 한 번 실행해 받아 둔다. 파일이 있으면 로컬 것을, 없으면 인터넷에서 불러온다.

## 로컬 확인

프로젝트 디렉터리에서 `python -m http.server 8000 --bind 127.0.0.1`을 실행하고 `http://127.0.0.1:8000/`를 연다. `sound/`의 세 음원과 체험판 포획·놓아주기·음원 저장을 확인한다.

## 배포

GitHub Pages의 공개 소스를 `main` 브랜치 루트로 설정한다. 이 프로젝트에 필요한 파일을 커밋하고 푸시하면 같은 주소에 반영된다. 샘플을 바꿀 때는 사운드 페이지의 시안 번호도 갱신한다.

## 우주 사진

NASA, ESA, CSA, STScI. [Cosmic Cliffs](https://science.nasa.gov/asset/webb/cosmic-cliffs-in-the-carina-nebula-nircam-image/) · [Webb’s First Deep Field](https://science.nasa.gov/asset/webb/webbs-first-deep-field-unveiled-nircam-image/)

## 소리 자료

액션 효과음은 낚기, 레이어 합류, 놓아주기 각 5종이다. 사운드 체크에서 선택하면 같은 브라우저의 체험판에 적용된다. 우주인 캐릭터와 3D 이미지는 팀 뮤직스케이프 제작 이미지에서 잘라 쓴다. 체험판의 하프 실녹음은 Versilian Studios의 [VSCO 2 Community Edition](https://versilian-studios.com/vsco-community/)에서 가져왔다. CC0 라이선스.

카혼, 클라베스, 셰이커는 [Versilian Community Sample Library](https://github.com/sgossner/VCSL)의 녹음을 썼다. 물방울은 vfrattaroli의 [eau qui coule](https://freesound.org/people/vfrattaroli/sounds/843505/), 바람과 나뭇잎은 TimOut789의 [WindyLeaves](https://freesound.org/people/TimOut789/sounds/751869/)에서 짧게 잘랐다. 모두 CC0.
