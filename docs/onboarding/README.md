# 🚀 Votatis 온보딩 — 여기서 시작하세요

이 프로젝트를 **처음 보는 사람**이 "무엇을, 어떻게, 어디서부터" 작업하면 되는지
순서대로 알려주는 입문 가이드입니다. 어려운 말은 최대한 풀어 썼습니다.

## 이 프로젝트가 한 줄로 뭐냐면

> **"검증 가능한 제보 아카이브"** — 선거 관련 제보를 출처와 함께 모으고,
> 사람이 검증한 결과(사실확인 / 의심 / 반박 등)를 **상태 라벨과 함께** 공개하는 사이트입니다.

핵심은 기술이 아니라 **신뢰도**입니다. "이게 확인된 사실인지, 단순 주장인지,
반박된 건지"를 명확히 구분하는 것이 이 프로젝트의 존재 이유예요.
(자세한 배경은 [`docs/MVP-PRD.md`](../MVP-PRD.md)와 [`docs/PERSONA.md`](../PERSONA.md))

## 📚 읽는 순서

번호대로 읽으면 됩니다. 30분이면 전체 그림이 잡힙니다.

| 순서 | 문서 | 무엇을 알게 되나 |
|------|------|------------------|
| 1 | [01-tech-stack.md](01-tech-stack.md) | **개발 스택** — 어떤 기술로 만들어졌나 |
| 2 | [02-architecture.md](02-architecture.md) | **시스템 구조** — 제보가 들어와서 공개되기까지 어떻게 흐르나 |
| 3 | [03-whats-built.md](03-whats-built.md) | **구현 현황** — 지금까지 무엇이 만들어졌나 |
| 4 | [04-spec-driven-development.md](04-spec-driven-development.md) | **스펙 주도 개발** — 새 기능을 만드는 정해진 방법 |
| 5 | [05-steering.md](05-steering.md) | **steering** — 프로젝트의 "실수 노트"가 하는 일 |
| 6 | [06-getting-started.md](06-getting-started.md) | **첫 작업** — 환경 세팅부터 첫 PR까지 실제로 해보기 |

## ⚡ 30초 요약 (급한 사람용)

- **모노레포**입니다. 코드는 전부 `apps/<이름>/` 아래에 있어요.
  - `apps/intake-api` — 백엔드 (Cloudflare Worker, 제보 수집·검증 API)
  - `apps/frontend` — 웹사이트 (Next.js, 제보 페이지 + 공개 아카이브)
  - `apps/admin-mcp` — AI가 검증을 도와주는 도구 (MCP 서버)
- **일하는 방법은 정해져 있습니다.**
  1. 새 기능은 [스펙](04-spec-driven-development.md)을 먼저 쓰고 → 구현 → 리뷰.
  2. 작업하다 배운 교훈은 [steering](05-steering.md)에 기록.
  3. 코드는 [토픽 브랜치](../branch-commit-strategy.md)에서 → PR → 사람이 머지.
- **명령어 치트시트:**
  ```bash
  pnpm install        # 처음 1회 (의존성 설치)
  pnpm -r typecheck   # 전체 타입 검사
  pnpm -r test        # 전체 테스트
  ```

## 🧭 길 잃었을 때

- 프로젝트 전역 규칙(필수 정책)은 루트 [`CLAUDE.md`](../../CLAUDE.md)에 있습니다.
- 협업/브랜치/커밋 규칙은 [`docs/branch-commit-strategy.md`](../branch-commit-strategy.md).
- 과거에 밟은 지뢰(반복하면 안 되는 실수)는 [`steering/`](../../steering/) 폴더.
