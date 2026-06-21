# 3. 구현 현황 — 지금까지 무엇이 만들어졌나

> 한 줄: **제보 → 검증 → 공개**의 한 바퀴(MVP)가 전부 돌아갑니다.
> 스펙 **0001번부터 0016번까지 전부 `completed`** 상태예요.

가장 정확한 최신 목록은 항상 [`specs/README.md`](../../specs/README.md)의 인덱스 표입니다.
아래는 그걸 "기능 묶음"으로 풀어 쓴 버전입니다.

## 기능별로 보는 구현 현황

### 📥 제보 수집
- **제보 수집 API** — 첨부 업로드(R2) + 해시 봉인 (spec 0001, 0006)
- **제보 웹앱 / 4단계 마법사** — 제보자가 단계별로 작성 (spec 0003, 0004)
- **랜딩 페이지 + 제보 페이지 분리** (spec 0005)

### 🗄️ 저장 & API
- **D1 기반 저장 + 공개 조회 API** (Hono + OpenAPI + Zod) (spec 0006)
- **frontend 모노레포 통합 + SSG 마이그레이션** — 옛 `apps/web` 폐기 (spec 0007)
- **intake-api `src` 레이어 구조 리팩터링** (동작 불변) (spec 0013)

### ✅ 검증 (관리자)
- **관리자 검증 API + 인증** — 검토 큐 / 상태 판정 / 증거 열람 (spec 0008)
- **관리자 콘솔 연동** — 로그인 / 검토 큐 / 증거 검수 / 대시보드 (spec 0009)
- **관리자 인증 고도화** — 루트 계정 + 회원관리 + JWT(access/refresh) (spec 0015)
- **관리자 UX 개선 + 검토 피드백 스키마 + 예시 시드** (spec 0016)
- **검증 관리 MCP 서버**(`votatis-admin-mcp`) — AI용 관리자 API 래퍼 (spec 0014)
- **AI 분석 백엔드** — 자동 태깅 / 신뢰도 / 합성 위험 (보조 신호) (spec 0012)

### 🌐 공개
- **공개 아카이브 / 검색 / 통계** 정적 연동 (spec 0010)
- **D1 → GitHub 마크다운 export + 빌드타임 공개 인덱스** (spec 0011)

## 최근 이 세션에서 추가된 것 (참고)
- 검증 상태에 **`suspected`(의심)** 추가 (spec 0008 갱신)
- 공개 아카이브 레코드에 **증거 이미지 썸네일 + 클릭 확대(라이트박스)** (spec 0016)
- 증거 이미지를 **R2 public 도메인에서 직접 로드**(env로 주소 교체 가능) (spec 0016)

## ⚠️ "과거의 흔적" 주의 (헷갈리지 마세요)
초기 스펙엔 GitHub Issues를 검증 큐로 쓰던 흔적이 있는데, **지금은 전부 폐기**됐습니다.
- 모든 검증/저장은 **Cloudflare D1**로만. GitHub 레포는 **공개 데이터 배포용**으로만 씁니다.
- 근거: [steering/github-issues-validation-queue-deprecated](../../steering/github-issues-validation-queue-deprecated.md)

## 지금 진행 중인 것
- `specs/in-progress/`, `specs/in-review/`, `specs/not-started/` 폴더가 비어 있으면
  **현재 대기 중인 미완료 스펙이 없다**는 뜻입니다(이 글 작성 시점엔 모두 `completed`).
- 새 작업을 시작하려면 [04-spec-driven-development.md](04-spec-driven-development.md)대로 스펙부터 만드세요.

## 다음 → [04-spec-driven-development.md](04-spec-driven-development.md): 새 기능 만드는 정해진 방법
