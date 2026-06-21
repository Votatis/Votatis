---
tldr: 정적(SSG) 페이지의 목록을 클라이언트 useEffect 로 채우면 초기 HTML 에 '불러오는 중'이 박히고, 배포 전파 중 stale 청크/캐시로 클라 JS 가 안 돌면 로딩에서 영구 멈춘다. 빌드타임에 아는 데이터는 서버 컴포넌트가 prop 으로 주입해 SSG HTML 에 직접 담아라(상호작용 필터는 그대로 client 컴포넌트 유지).
tags: [pitfall, frontend, nextjs, ssg, hydration, archive]
last_retrieved: 2026-06-21
retrieval_count: 1
---

## 규칙 / 교훈
빌드타임에 이미 아는 데이터(예: 공개 아카이브 목록 = archive.generated.json)는 **서버 컴포넌트(page.tsx)가 prop 으로 주입**해 SSG HTML 에 직접 렌더한다. 클라이언트에서 useEffect 로 불러오지 않는다.

### 함정
- 목록을 `"use client"` 컴포넌트의 `useEffect` 로 채우면, 초기 HTML 에는 로딩 상태("불러오는 중…")가 박혀 나간다.
- 배포 전파 중 HTML/청크 해시 불일치, 브라우저·CDN 캐시, JS 로드 실패 등으로 **클라 JS 가 안 돌면 로딩 화면에서 영구 멈춘다**(데이터가 정적인데도). curl 로는 HTML 의 로딩 텍스트만 보이고, 실제로 "왜 빌드된 게 안 나오냐"로 나타난다.

### 해결 패턴 (archive 적용 예)
- `app/archive/page.tsx`(서버): `allSummaries()` 를 읽어 `<ArchiveClient initial={...} />` 로 주입.
- `ArchiveClient`(client): `initial` prop 으로 즉시 렌더(`useState`/`useEffect` 로딩 제거), 필터·정렬 상호작용만 client state 로 유지.
- 결과: 첫 응답 HTML 에 목록이 들어가 JS 의존·로딩 플래시 없음.

상세 페이지처럼 풀데이터가 필요하면 빌드타임 .md 파싱([[frontend-buildtime-md-parse]]) 또는 런타임 API 로. 런타임에만 아는 데이터(새로 승인됐지만 미빌드)는 어쩔 수 없이 client fetch.

연관: [[frontend-buildtime-md-parse]], [[nextjs-static-export-dynamic-routes]].
