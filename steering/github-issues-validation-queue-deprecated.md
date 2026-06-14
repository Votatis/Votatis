---
tldr: GitHub Issues 검증 큐 완전 폐기. 모든 검증/저장은 Cloudflare D1로만 처리. 관리자 페이지 UI에서 검수. GitHub 레포는 공개 데이터 배포용으로만 사용.
tags: [decision, architecture, github, d1, deprecated]
last_retrieved: 2026-06-14
retrieval_count: 0
---

## 결정

GitHub Issues를 검증 큐 및 검증 중 데이터 저장소로 사용하지 않기로 확정.

## 왜

- GitHub Issues는 팀 내부 도구로 불편함 (액세스 제어, 자동화 한계, 스키마 강제 어려움)
- D1 + 관리자 페이지가 검증 프로세스 전담하는 것이 운영 편의성과 데이터 일관성 측면에서 우월
- GitHub 레포는 **검증 통과 데이터만 최종 배포**하는 용도로 명확히 분리

## 적용

### 코드 변경
- intake-api finalize: D1 `reports` 테이블에만 INSERT (GitHub Issue 생성 로직 제거됨)
- 검증 판정: 관리자 페이지에서 D1 상태 업데이트 (`confirmed`/`disputed`/`debunked`)
- 공개 배포: D1 검증 완료 데이터 → 자체 스크립트로 GitHub 마크다운 변환 후 커밋

### 문서 정리
- MVP-PRD: GitHub Issues 참조 제거 (✅ 2026-06-14)
- 스펙 0001/0004: 역사 기록 유지 (폐기된 설계 문서)
- 스펙 0006: "GitHub Issues 대체" 컨텍스트 유지
- 개발 가이드: D1 스키마 및 관리자 페이지 검증 프로세스 중심으로

### GitHub 대외 역할 (앞으로)
- Issue Template: 불필요 (웹앱 + API로 접수)
- Pull Request: 공개 데이터 배포 자동화 (관리자 페이지 → GitHub 커밋)
- Organization: 없음 (fork 구조 유지, 검증 큐는 내부만)
