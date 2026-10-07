# 글자 머지 (TypeScript + React + Vite)

## 실행
```bash
npm install
npm run dev        # 개발 서버
npm test           # 게임 규칙 테스트 (vitest)
npm run build      # 타입체크 + 빌드 → dist/
```

## Vercel 배포
GitHub에 올린 뒤 Vercel에서 Import 하면 Vite로 자동 인식됩니다. (Build: `npm run build`, Output: `dist`)
CLI는 `npx vercel --prod`.

## 폴더 구조 — "규칙 / 저장 / 화면"을 분리해 둠
```
src/
  game/        순수 TypeScript (React·브라우저 의존 없음)
    config.ts    판 크기, AP, 체인(a~g, ㄱ~ㅅ, ㅏ~ㅛ, 1~6), 더블클릭 생성 규칙
    rules.ts     머지/이동/교환, 생성, 저장데이터 검증
    ap.ts        AP 충전/소모
    rules.test.ts
  storage/     저장소 (인터페이스 + 구현 교체 가능)
    repository.ts        GameRepository 인터페이스
    localRepository.ts   localStorage 저장 (기본)
    remoteRepository.ts  서버 저장 예시 (GET/PUT /game)
  api/client.ts  fetch 기반 REST 클라이언트
  hooks/useGame.ts  상태·타이머·액션을 React에 연결
  components/   Board(드래그/더블탭), Tile, ApBar, Legend
```

## 규칙 바꾸기 → `src/game/config.ts`
- 체인 글자: `CHAINS`
- 더블클릭 생성: `SPAWN_RULES` (체인/시작 단계/나오는 아이템 목록)
- AP 최대/충전 속도/비용, 판 크기, 더블클릭 시 원본 소멸 여부(`CONSUME_SOURCE`)

## 앱으로 만들기 (Capacitor)
```bash
npm install @capacitor/android @capacitor/ios
npm run build
npx cap add android      # iOS는 npx cap add ios (Mac + Xcode 필요)
npx cap sync
npx cap open android
```
- 코드를 고칠 때마다 `npm run build && npx cap sync`
- `capacitor.config.ts`의 `appId`는 스토어 등록 전에 본인 것으로 변경
- 앱에서는 localStorage가 OS에 의해 지워질 수 있으니, 출시 전 `@capacitor/preferences`로
  `GameRepository`를 하나 더 구현해 교체하세요 (UI/규칙 수정 불필요).

## 서버 연동
1. `.env`에 `VITE_API_BASE_URL` 설정 → 자동으로 `RemoteGameRepository` 사용
2. 서버 API 스펙에 맞게 `remoteRepository.ts` 수정
3. 치팅 방지를 위해 AP·생성 같은 규칙은 서버에서도 검증 필요.
   `src/game/`이 순수 TS라서 Node 서버에서 그대로 import 해서 쓸 수 있습니다.
4. 저장 요청이 너무 잦으면 `RemoteGameRepository.save`에 디바운스를 추가하세요.

## React Native로 갈 때
`src/game/`, `src/storage/`, `src/api/`는 그대로 재사용하고 `components/`, `hooks/useGame.ts`의
화면 부분만 RN 컴포넌트로 바꾸면 됩니다.
