# 크로스워드 머지 (TypeScript + React + Vite)

10×10 판 위에서 **머지**와 **가로세로 낱말 퍼즐**을 동시에 합니다.
정답 칸에 맞는 알파벳을 만들어 올리면 그 글자는 **고정**되어 더 이상 옮기거나 합칠 수 없어요.

## 실행
```bash
npm install
npm run dev        # 개발 서버 (터미널에 나온 localhost 주소를 브라우저로)
npm test           # 규칙/퍼즐 데이터 테스트
npm run build      # 타입체크 + 빌드 → dist/
```
Vercel: GitHub에 올려 Import → Deploy (Vite 자동 인식).

## 게임 규칙
- 위: 10×10 판. 흰 칸 = 정답 칸(번호는 단어 시작), 어두운 칸 = 머지 작업 공간.
- 아래: 가로/세로 문제. 문제를 누르면 판에서 그 단어 칸이 표시돼요. 고정된 글자는 문제 옆 칸에 채워집니다.
- A부터 Z까지 **한 체인**: 같은 글자 2개를 합치면 다음 글자 (A+A=B … Y+Y=Z). Z는 마지막이라 더 합쳐지지 않아요.
- **생성기 버튼 4개** (A / H / L / W): 누르면 해당 글자 1개가 판에 나와요 (AP -1). 글자·개수·비용은 `src/game/config.ts`의 `GENERATORS`에서 바꿔요.
- **AP**: 최대 100, 1분에 1개 자동 충전. **AP 충전 버튼**을 누르면 대가 없이 즉시 100까지 차요.
- **AP 총 사용량**: AP 바 옆에 지금까지 쓴 AP의 누적 합계가 표시돼요 (충전해도 줄지 않음).
- 더블클릭 생성은 꺼져 있어요 (`SPAWN_RULES`가 비어 있음).
- 정답 글자가 정답 칸에 들어가면 고정 → 이동/머지 불가.
- 모든 정답 칸이 고정되면 CLEAR! 연출 → 다음 스테이지(새 퍼즐이 자동 생성됨). 총 30스테이지, 다 깨면 새 퍼즐로 처음부터.

## 폴더 구조
```
src/
  game/        순수 TypeScript (React·브라우저 의존 없음)
    config.ts    판 크기, AP, 알파벳 체인, 더블클릭 생성 규칙
    puzzle.ts    퍼즐 정의 → 칸/번호 자동 계산
    words.ts     크로스워드 단어장 (영어 힌트 + 한글 뜻) ← 단어 추가는 여기
    crosswordGen.ts  가로세로 퍼즐 자동 생성기 (시드 기반, 같은 시드 = 같은 퍼즐)
    stages.ts    스테이지별 난이도(단어 수·길이·글자) + 퍼즐 생성/캐시
    random.ts    시드 난수
    rules.ts     머지/이동/고정 판정/생성/저장데이터 검증
    ap.ts        AP 충전/소모
  storage/     저장소 (로컬 / 서버 교체 가능)
  api/         fetch 기반 REST 클라이언트
  hooks/useGame.ts   상태·타이머·액션을 React에 연결
  components/  Board(드래그/더블탭), Tile, ClueList, LetterGuide, ApBar
```

## 퍼즐 자동 생성 (스테이지 1~30)
퍼즐은 미리 만들어 두지 않고, 스테이지에 들어갈 때 생성해요.
`(런 시드, 스테이지)`로 결정되므로 같은 시드면 누구에게나 같은 퍼즐이에요. (멀티플레이에서는 시드만 공유하면 됨)

| 스테이지 | 단어 수 | 단어 길이 | 쓰이는 글자 |
|---|---|---|---|
| 1~4 | 5~6 | 3~4 | A~T |
| 5~8 | 6~7 | 3~5 | A~T |
| 9~12 | 7~8 | 3~5 | A~X |
| 13~18 | 8~10 | 3~6 | A~X |
| 19~24 | 10~11 | 3~6 | A~Z |
| 25~30 | 11~13 | 3~7 | A~Z |

난이도 곡선은 `src/game/stages.ts`의 `stageSpec()`에서 바꾸세요. 스테이지 수는 `config.ts`의 `STAGE_COUNT`.
생성기는 스테이지당 평균 약 45ms(최대 약 100ms)예요. `npm test`가 30스테이지 × 여러 시드를 만들어서
"판 위에 우연히 붙은 가짜 단어가 없는지", "난이도 조건을 지키는지", "같은 시드면 같은 퍼즐인지"를 검사해요.

## 밸런스 → `src/game/config.ts`
AP 최대/충전 속도/비용, 시작 글자 수(`START_ITEMS`), 체인 구성, 생성 시작 단계(`SPAWN_FROM_LEVEL`).

## 앱으로 만들기 (Capacitor) / 서버 연동
이전 프로젝트와 같아요: `npm i @capacitor/android` → `npm run build` → `npx cap add android` → `npx cap sync`.
서버는 `.env`의 `VITE_API_BASE_URL` + `src/storage/remoteRepository.ts`.

## 더블클릭으로 바로 하는 단일 HTML 파일 만들기
```bash
npm run build:single      # → dist-single/index.html (파일 하나로 완결)
```
만들어진 `index.html`을 더블클릭하면 브라우저에서 바로 실행돼요. 서버·설치가 필요 없고, 파일 하나만 전달하면 됩니다.
(구글 폰트만 인터넷이 있을 때 적용되고, 오프라인이면 기본 글꼴로 보여요. 진행 상황은 브라우저에 저장돼요.)
