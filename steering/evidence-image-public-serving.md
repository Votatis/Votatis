---
tldr: 공개 아카이브 증거 이미지 경로 2가지 — (1) R2 public 도메인 직접(NEXT_PUBLIC_R2_PUBLIC_URL + r2_key) (2) Worker 스트리밍(GET /reports/{id}/attachments/{idx}, PUBLISHABLE 상태 게이트). 갤러리는 env 있으면 (1), 없으면 (2) 폴백. ⚠️R2 public 접근(pub-*.r2.dev)이 켜지면 버킷 객체는 상태 무관 전부 공개 — (2)의 게이트가 무의미해진다. r2_key는 한글·공백 포함이라 세그먼트별 encodeURIComponent(슬래시 유지).
tags: [decision, r2, frontend, intake-api, privacy, archive]
last_retrieved: 2026-06-20
retrieval_count: 1
---

## 규칙 / 교훈
공개 아카이브 record 페이지의 증거 이미지 노출(spec 0016)은 두 경로가 있다.

1. **R2 public 도메인 직접 로드** — `${NEXT_PUBLIC_R2_PUBLIC_URL}/${r2_key}`. 공개 API(`GET /reports/{id}`)가 `attachments[].r2_key`를 노출하므로 프론트가 바로 `<img>`로 로드. 빠르고(엣지 캐시) Worker 호출·비용 없음. 주소는 env라 커스텀 도메인으로 교체 가능.
2. **Worker 스트리밍 폴백** — `GET /reports/{id}/attachments/{idx}`(plain Hono, OpenAPI 비노출). `getPublicAttachment`가 **PUBLISHABLE 상태만** 통과(미검증·검토중·pending 증거 비공개), ACAO:* + 공개 캐시. env 미설정 시 갤러리가 이 경로로 폴백.

### 함정·주의
- ⚠️ **R2 public 접근이 켜져 있으면(`pub-<hash>.r2.dev`) 버킷의 모든 객체가 상태와 무관하게 공개**된다. 즉 경로 (2)의 PUBLISHABLE 게이트는 (1)을 쓰는 순간 사실상 우회된다. 미검증 증거까지 비공개로 막으려면 R2 public 접근을 끄고 Worker 스트리밍만 쓰거나, 게시 시점에 별도 공개 버킷으로 복사해야 한다. 현재 운영은 r2.dev 직접 로드(의도된 선택).
- `r2_key`는 `제9회 전국동시지방선거/<id>/01.webp`처럼 **한글·공백 포함** → URL 만들 때 `key.split("/").map(encodeURIComponent).join("/")`(슬래시 유지). 통째로 encodeURIComponent 하면 슬래시까지 깨지고, 미인코딩이면 공백/한글로 404.
- 갤러리(`AttachmentGallery.tsx`)는 라이트박스 때문에 `"use client"`. ArchiveDetail(서버 렌더)에서 임포트해 사용.

연관: [[frontend-pages-deploy]], [[r2-object-put-evidence-upload]], [[hono-raw-response-skips-cors-header]], [[report-status-enum-locations]].
