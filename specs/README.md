# Specs — 스펙 인덱스

스펙 주도 개발의 스펙 목록. 스펙은 상태별 디렉터리로 분류하며, 상태 전환은 파일 이동으로 표현한다.

```
specs/
  not-started/   # 작성됐지만 구현 전
  in-progress/   # 구현 중
  in-review/     # 구현·검증 완료, 검토 대기
  completed/     # 검토 통과
```

이 표는 **인덱스**다. 스펙을 추가·이동·삭제하면 즉시 맞춘다. 값은 각 스펙 frontmatter와 일치시킨다.

| ID | 제목 | 상태 | 생성일 | 갱신일 | 파일 |
|----|------|------|--------|--------|------|
| 0001 | 제보 수집 API | completed | 2026-06-09 | 2026-06-10 | completed/0001-report-intake-api.md |
| 0002 | 개발환경 GitHub Issue 시뮬레이션 | completed | 2026-06-09 | 2026-06-09 | completed/0002-dev-github-issue-simulation.md |
| 0003 | 제보 웹앱 (임시) | completed | 2026-06-09 | 2026-06-10 | completed/0003-report-web-app.md |
| 0004 | 제보 플로우 (4단계 마법사) | completed | 2026-06-10 | 2026-06-10 | completed/0004-report-flow-wizard.md |
| 0005 | 랜딩 페이지 + 제보 페이지 분리 | completed | 2026-06-10 | 2026-06-10 | completed/0005-landing-page.md |
| 0006 | D1 기반 제보 저장 + 정식 조회 API (Hono + OpenAPI + Zod) | completed | 2026-06-10 | 2026-06-10 | completed/0006-d1-report-store-api.md |
| 0007 | frontend(Next.js) apps/frontend 통합 + 제보 기능 이식 + SSG, apps/web 폐기 | completed | 2026-06-10 | 2026-06-10 | completed/0007-frontend-monorepo-ssg-migration.md |
| 0008 | 관리자 검증 API + 인증 (검증 큐 / 상태 판정 / 증거 열람) | completed | 2026-06-14 | 2026-06-14 | completed/0008-admin-verification-api.md |
| 0009 | 관리자 콘솔 API 연동 (로그인 / 검토 큐 / 증거 검수 / 대시보드) | completed | 2026-06-14 | 2026-06-14 | completed/0009-admin-console-wiring.md |
| 0010 | 공개 아카이브 / 검색 / 통계 정적 연동 | completed | 2026-06-14 | 2026-06-14 | completed/0010-public-archive-search-stats.md |
| 0011 | D1 → GitHub 마크다운 export + 빌드타임 공개 인덱스 | completed | 2026-06-14 | 2026-06-14 | completed/0011-d1-markdown-export-pipeline.md |
| 0012 | AI 분석 백엔드 (자동 태깅 / 신뢰도 / 합성 위험) — 보조 신호 | completed | 2026-06-14 | 2026-06-14 | completed/0012-ai-analysis-backend.md |
| 0013 | intake-api src 디렉터리 재구성 + 레이어 리팩터링 (동작 불변) | completed | 2026-06-14 | 2026-06-14 | completed/0013-intake-api-src-restructure.md |
| 0014 | 검증 관리 MCP 서버 (votatis-admin-mcp) — 관리자 API 래퍼 | completed | 2026-06-14 | 2026-06-14 | completed/0014-admin-mcp-server.md |
| 0015 | 관리자 인증 — 루트 계정 + 회원관리 + JWT(access/refresh) | in-review | 2026-06-14 | 2026-06-14 | in-review/0015-admin-auth-accounts.md |
