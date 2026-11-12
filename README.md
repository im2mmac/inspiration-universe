# 영감의 우주

휴대폰에서 확인할 수 있는 사운드 체크와, 브라우저에서 영감을 낚고 놓아주는 전시 체험판이다.

- 루트는 체험판이다. 우주로 들어간 뒤 글자나 이미지를 누르거나 키보드로 선택해 낚는다. 하단에서 자신이 낚은 칸을 누르면 놓아준다. 1~3번 버튼으로 관람객을 바꿔 합주를 시연할 수 있다.
- `sound/`는 92 BPM의 사운드 시안 세 개를 비교하는 페이지다.
- 체험판의 카메라는 MediaPipe 모델을 불러온 뒤 브라우저에서 오른손 위치를 읽는다. 모델을 불러오려면 인터넷과 카메라 권한이 필요하다. 카메라 원본은 전시 페이지가 저장하거나 전송하지 않는다.
- 15개가 차면 현재 합주를 8마디 WAV로 저장할 수 있다. 영상 인코딩과 공동 QR 공유는 후속 검증 범위다.

## 로컬 확인

프로젝트 디렉터리에서 `python -m http.server 8000 --bind 127.0.0.1`을 실행하고 `http://127.0.0.1:8000/`를 연다. `sound/`의 세 음원과 체험판 포획·놓아주기·음원 저장을 확인한다.

## 배포

GitHub Pages의 공개 소스를 `main` 브랜치 루트로 설정한다. 이 프로젝트에 필요한 파일을 커밋하고 푸시하면 같은 주소에 반영된다. 샘플을 바꿀 때는 사운드 페이지의 시안 번호도 갱신한다.

## 우주 사진

NASA, ESA, CSA, STScI. [Cosmic Cliffs](https://science.nasa.gov/asset/webb/cosmic-cliffs-in-the-carina-nebula-nircam-image/) · [Webb’s First Deep Field](https://science.nasa.gov/asset/webb/webbs-first-deep-field-unveiled-nircam-image/)

## 소리 자료

액션 효과음은 낚기, 레이어 합류, 놓아주기 각 5종이다. 사운드 체크에서 선택하면 같은 브라우저의 체험판에 적용된다. 체험판의 하프 실녹음은 Versilian Studios의 [VSCO 2 Community Edition](https://versilian-studios.com/vsco-community/)에서 가져왔다. CC0 라이선스.
