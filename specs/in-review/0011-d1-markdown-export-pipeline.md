---
id: "0011"
title: D1 → GitHub 마크다운 export + 빌드타임 공개 인덱스
status: in-review
created: 2026-06-14
updated: 2026-06-14
related:
  - "docs/MVP-PRD.md §4 아키텍처 / §7 데이터 스키마 / §8 D1→GitHub 변환 / §9 검색·인덱싱 / §10 v1"
  - "docs/PERSONA.md — 검증 통과 데이터만 공개(절제·신뢰)"
  - "specs/in-review/0008-admin-verification-api.md (검증 상태가 export 대상 결정)"
  - "docs/goals/001.md"
---

# D1 → GitHub 마크다운 export + 빌드타임 공개 인덱스

## 1. 배경 / 문제

PRD §4/§9의 공개 surface는 **정적 사이트 + 클라이언트 검색**이고, 그 원천은 GitHub 레포의 `/data/{election}/{id}.md`(검증 통과 데이터만)다. 현재 이 파이프라인이 없다: D1의 검증 완료 레코드를 마크다운으로 내보내는 스크립트도, 그것을 빌드 시 인덱싱하는 로직도 없다. 공개 아카이브/검색/통계가 전부 "데이터 소스 없음" 빈 상태인 근본 원인.

## 2. 목표 (Goals)

1. **마크다운 변환(순수 함수)**: 공개 레코드 → PRD §7 스키마의 YAML frontmatter + 본문 마크다운. `submitter`·`exif` 등 개인정보·내부필드는 **제외**. 단위 테스트.
2. **export 대상 추출**: `GET /admin/export`(인증) — 검증 완료(`confirmed|disputed|debunked|corrected`) 레코드를 공개 필드로 반환. 미검증/검토중은 공개하지 않는다(PRD 원칙1).
3. **writer 스크립트**: `/admin/export`를 호출해 `data/{election}/{id}.md`(사람용 공개본) + `data/index.json`(빌드용 기계 인덱스)을 함께 생성. 운영 D1 대상 실행은 CF 자격증명 필요 → 사람 몫(HUMAN.md), 로직·계약은 본 스펙에서 완성.
4. **빌드타임 인덱스**: 프론트 빌드 전 `data/index.json` → `apps/frontend/src/data/archive.generated.json`(없으면 빈 배열). 정적 아카이브/검색/통계(0010)가 이걸 읽는다.

## 3. 비목표
- 공개 페이지 UI 연동 — 0010.
- 실제 GitHub 커밋/푸시 자동화(운영) — 스크립트는 파일을 쓰고, 커밋·푸시·배포 트리거는 사람/CI(HUMAN.md).
- 벡터/시맨틱 검색(v2).
- 마크다운을 다시 파싱해 인덱스를 만드는 round-trip — 견고성을 위해 인덱스는 같은 export 원천에서 직접 생성(아래 §4 주).

## 4. 설계

### 마크다운 (`apps/intake-api/src/export-md.ts`)
- `recordToMarkdown(pub)`: YAML frontmatter(id, election, title, summary, status, tags, counting 없음→region 3단, occurred_at, collected_at, sources[], attachments[](filename·r2_key·sha256·mime·size), verification{reviewer,method,evidence_links,reviewed_at,notes}, rebuttals[], related[], license) + 본문(summary/body). **submitter·exif·consent 비공개**.
- `recordRelPath(pub)`: `data/{election-slug}/{id}.md`. election은 안전 슬러그.

### export 추출 (`/admin/export`)
- admin 인증. `adminExport(env)` → 검증완료 상태만, `toPublicReport` 형태 배열.

### writer (`apps/intake-api/scripts/export-data.ts`, tsx)
- env: `API_URL`(기본 http://localhost:8787), `ADMIN_TOKEN`, `OUT_DIR`(기본 repo `data`).
- `/admin/export` GET → 각 레코드 md 파일 기록 + `index.json`(공개 레코드 전체 배열) 기록. 디렉터리 없으면 생성.

> **인덱스 주**: PRD §9는 "md 파싱→인덱스"지만, 같은 export 호출에서 `index.json`을 직접 써서 YAML round-trip 취약성을 없앤다. md는 사람용 공개본, index.json은 빌드용 — 둘 다 D1이 단일 원천.

### 빌드 인덱스 (`apps/frontend/scripts/build-archive-index.mjs`)
- repo `data/index.json` 읽어 `src/data/archive.generated.json`로 복사(+ 카테고리 파생: tags[0]를 CATEGORY_FULL과 매칭). 파일 없으면 `[]`. `prebuild`(또는 build 전 단계)에 연결 → 빌드 항상 성공.

## 5. 완료 조건 (Acceptance Criteria)
- [x] `recordToMarkdown`이 PRD §7 형태의 YAML frontmatter+본문을 만들고 `submitter`/`exif`가 없음(test).
- [x] `GET /admin/export`가 검증완료 레코드만 공개필드로 반환, 미검증 제외, 미인증 401(test).
- [x] `export-data.ts`가 export 응답으로 md 파일들 + `index.json`을 OUT_DIR에 기록(로컬 dev API 상대 실행 가능; 운영은 HUMAN.md).
- [x] `build-archive-index` 가 data 유무와 무관하게 `archive.generated.json`을 만들어 `pnpm --filter votatis-frontend build`가 성공.
- [x] `pnpm --filter votatis-intake-api test`·`pnpm -r typecheck` 통과.

## 6. 미해결 / 리스크
- 운영 D1 대상 export 실행 + GitHub 커밋/Pages 재빌드는 CF/GitHub 자격증명 필요 → HUMAN.md.
- 대량(수만 건) 시 index.json 단일 파일 한계 → 추후 분할/페이지네이션.

## Changelog
- 2026-06-14: 최초 작성 (Goal 001 자율 수행)
- 2026-06-14: 구현 완료 — export-md(순수 변환)+/admin/export+export-data.ts(md+index.json)+frontend build-archive-index. 테스트 34건(2건 추가) 통과, static build 성공. in-review 이동.
