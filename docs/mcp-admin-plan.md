# MCP 기획 — Votatis 검증 관리 MCP (`votatis-admin-mcp`)

> Goal 002 산출물. 관리(검증) 과정을 AI(Claude Code/Codex)로 구동하기 위한 MCP 서버 설계.

## 1. 목적 & 대상 사용자

검증 관리자가 **AI 에이전트(Claude Code 또는 Codex)에게 자연어로 검증 작업을 시키는** 통로를 만든다.
"3번 제보 증거 보여줘 → 분석 신호 알려줘 → 출처 2개로 confirmed 처리해" 같은 흐름을 AI가 도구 호출로 수행한다.

**1순위 대상 = `docs/PERSONA.md` 페르소나 5(내부 검증 관리자 "정한울")**. 핵심 규율을 도구 설계에 그대로 박는다:

- **빠른 통과가 아니라 엄격한 판정을 쉽게.** 판정 도구는 근거(검증 방법 + 출처 링크)를 **필수**로 요구한다.
- **확증편향 방지.** "우리 편" 자료라도 근거가 약하면 통과 못 하도록, 판정 도구가 근거 없는 confirmed/debunked류를 거부한다(MCP 선검증 + API 재검증, 이중 방어).
- **AI는 보조 신호.** 분석 결과는 "참고용(non-authoritative)"으로 명시하고, **자동 판정하지 않는다.** 최종 판정은 사람이 도구로 명시적으로 기록.
- **일관성·추적성.** 모든 판정은 검증 방법·근거 링크·검토자와 함께 기록된다(기존 API가 `verification_reviewed_at` 등 기록).

## 2. 아키텍처 — "얇은 래퍼"

```
[AI: Claude Code / Codex]
      │  (MCP, stdio, JSON-RPC)
      ▼
[votatis-admin-mcp]  ── Bearer ADMIN_TOKEN ──▶  [intake-api 관리자 API (HTTP)]
  (도구 = 관리자 API 호출 + 페르소나5 가드레일)        /admin/*  (spec 0008)
                                                         │
                                                         ▼
                                                   [Cloudflare D1 / R2]
```

- **검증 로직은 intake-api가 단일 출처.** MCP는 로직을 재구현하지 않고 `/admin/*`를 호출만 한다(근거 필수·상태 전이 규칙은 API가 강제). MCP는 그 위에 **AI 친화적 도구 description + 선검증 가드레일**만 얹는다.
- **전송: stdio.** 로컬 AI 클라이언트(Claude Code/Codex)가 추가 인프라 없이 즉시 붙는다. (원격 호스팅은 향후 — §6)
- **구현: Node + `@modelcontextprotocol/sdk`** (공식). `apps/admin-mcp/`(모노레포 규칙).

## 3. 설정 / 인증

환경변수(클라이언트의 MCP 설정에서 주입):

| 변수 | 의미 | 예 |
|------|------|----|
| `VOTATIS_API_URL` | intake-api 베이스 URL | `http://localhost:8787` / 배포 URL |
| `VOTATIS_ADMIN_TOKEN` | 관리자 Bearer 토큰(spec 0008) | 로컬 `dev-admin-token` / 운영 시크릿 |

토큰 미설정 시 서버는 기동하되 도구 호출이 "인증 설정 필요" 에러를 반환한다.

## 4. 도구 (Tools)

| 도구 | 호출 대상 | 입력 | 출력 | 페르소나5 가드레일 |
|------|-----------|------|------|------------------|
| `health` | GET /health, POST /admin/session | — | API 연결성 + 토큰 유효 여부 | 첫 호출로 설정 확인 |
| `list_review_queue` | GET /admin/reports | status?, q?, election?, sido?, sigungu?, tag?, limit?, offset? | 큐 항목 + 상태별 카운트 | 미검증/검토중 우선 파악 |
| `get_report` | GET /admin/reports/{id} | id | 내부 필드 포함 상세(제보자 익명ID·exif 포함) | 원본 메타까지 검토 |
| `analyze_report` | POST /admin/reports/{id}/analyze | id | 보조 신호(태그 추천·신뢰도·합성 위험·요약) | **"보조 신호, 판정 근거 아님" 라벨** |
| `view_attachment` | GET /admin/reports/{id}/attachments/{idx} | id, index | 이미지 콘텐츠(AI가 직접 열람) | 원본 대조 |
| `record_verdict` | PATCH /admin/reports/{id} | id, status, method?, evidence_links?[], notes?, tags?[], rebuttals?[], reviewer? | 갱신된 상세 | **judged(confirmed/disputed/debunked/corrected)면 method+evidence_links≥1 필수 — MCP가 선검증 후 호출, 누락 시 호출 안 하고 거부** |
| `list_publishable` | GET /admin/export | — | 공개 배포 대상(검증완료) 레코드 | 공개 전 점검 |
| `get_stats` | GET /stats | — | 상태/선거/일자별 집계 | 큐 현황 파악 |

도구 description에는 페르소나 5 규율을 자연어로 명시해 AI의 오용(근거 없는 자동 판정)을 억제한다.

## 5. 비목표
- 검증 로직(근거 필수·상태 전이) 재구현 — intake-api가 단일 출처.
- 제보 접수/수정(공개 쓰기) 노출 — 관리자 검증 전용.
- 멤버별 계정/권한 — 공유 토큰 MVP(향후).

## 6. 향후
- 원격 MCP(Workers + Agents SDK)로 호스팅해 팀 공용화.
- 이미지 픽셀 단위 합성 탐지 도구, 감사 로그 조회 도구.

## 7. 산출물
- 본 기획 → `apps/admin-mcp/` 구현(스펙 0014) → `docs/mcp-usage.md`(Claude Code/Codex 등록·사용법).
