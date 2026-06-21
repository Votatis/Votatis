---
id: "0018"
title: 증분·버전 기반 export (dirty flag + ack, full 모드 유지)
status: in-review   # not-started | in-progress | in-review | completed
created: 2026-06-21
updated: 2026-06-22
related:
  - "specs/completed/0011-d1-markdown-export-pipeline.md (확장 대상)"
---

# 증분·버전 기반 export (dirty flag + ack)

## 1. 배경 / 문제
현재 `/admin/export` 는 검증완료(PUBLISHABLE) **전체**를 매번 반환하고, `export-data.ts` 는 매번 모든 `.md` + `index.json` 을 다시 쓴다(spec 0011). 레코드가 늘면 매 export 가 전부 재작성이라 낭비다.

원하는 것:
1. 서버에서 변경된 레코드만 골라 **증분 export**(변경분만 갱신).
2. 필요 시 **전체 강제 export**(리셋)도 유지.
3. 버전 기반 idempotency: 로컬에 **같은 버전이면 skip**, 없거나 버전이 다르면 full 내용 받기.

> 증거 이미지의 로컬 다운로드(`data/assets`)·archive 로컬 서빙은 **이번 범위에서 제외**한다. 이미지는 기존대로 R2 public 도메인에서 로드(spec 0011/0016, `NEXT_PUBLIC_R2_PUBLIC_URL`).

## 2. 목표 (Goals)
1. 변경 추적: 레코드 변경 시 서버가 dirty 표시, export 성공 후 resolve → 변경분만 export.
2. export 모드 2종: `incremental`(기본, dirty만) / `full`(전체, 리셋).
3. 버전 기반 idempotency: 로컬에 동일 `version`(=updated_at)이고 `.md` 가 있으면 재작성 skip.

## 3. 비목표 (Non-Goals)
- **증거 이미지 로컬화**(`data/assets` 다운로드, archive 로컬 이미지 서빙) — 제외. R2 public 그대로.
- 비공개로 내려간 레코드의 `.md` **자동 GC**(고아 파일 정리) — 추후.
- CDN 캐시 무효화.
- 백엔드 election enum 등 0017 범위.

## 4. 요구사항
### 데이터 / 서버
1. `reports` 에 `export_dirty` 컬럼 추가: `integer NOT NULL DEFAULT 1`(1=export 필요). drizzle migration → `wrangler d1 migrations apply`.
2. 레코드를 변경하는 모든 경로(생성, 관리자 PATCH/판정)에서 `export_dirty=1` 로 set.
3. `GET /admin/export?mode=incremental|full` (기본 incremental):
   - incremental: `status ∈ PUBLISHABLE AND export_dirty=1` 만 반환.
   - full: `status ∈ PUBLISHABLE` 전체(dirty 무관).
   - 응답 레코드에 `version`(= `updated_at`) 포함(이미 PublicRecord 에 있음).
4. `POST /admin/export/ack` body `{ ids: string[] }`: 해당 id 들의 `export_dirty=0` 으로 resolve. (export-data 가 로컬 기록 **성공 후** 호출 — 실패 시 dirty 유지되어 다음에 재시도.)

### export-data.ts (스크립트)
5. `EXPORT_MODE=incremental|full`(기본 incremental). `mode` 를 쿼리로 전달.
6. 각 레코드: 로컬 `index.json` 의 동일 id `version` 과 비교 — version 같고 `.md` 가 존재하면 **skip**, 아니면 `.md` 재작성.
7. `index.json` 슬림 요약에 `version`(updated_at) 필드 추가(증분 비교용).
8. 로컬 기록 성공 후 응답에 온 id 들로 `/admin/export/ack` 호출 → 서버 dirty 해제(incremental·full 둘 다 ack: export 후 dirty 가 남지 않게). full 은 index 전체 재작성(고아 제거), incremental 은 기존 index 에 변경분 병합.

## 5. 설계 개요
```
[D1 reports]                       [export-data.ts]                       [build/frontend]
 export_dirty=1 ──GET /admin/       per record:                            변경 없음
  (변경 시 set)    export?mode=       - version(updated_at) 비교              (이미지는 R2 그대로)
                   incremental ──▶    - 같고 .md 있으면 skip
                   (dirty만)          - 다르면 .md + index 갱신
                   POST /admin/      ◀── ack(ids) ── 로컬 기록 성공 후
                   export/ack         (export_dirty=0)
 full 모드: dirty 무관 전체 + ack 생략(리셋)
```

- **version**: `updated_at`(ISO 문자열). 별도 컬럼 없이 변경 감지. 로컬 index.json 에 저장해 비교.
- **dirty flag**: `export_dirty` 컬럼. 변경 시 1, ack 시 0. incremental 응답의 필터.
- 기존 슬림 index / `.md` 상세(0011) 구조 유지, `version` 만 추가. 프론트·이미지 경로 변경 없음.

## 6. 완료 조건 (Acceptance Criteria)
- [ ] `reports.export_dirty` 컬럼 + 마이그레이션 적용. 생성·PATCH·판정 시 1로 set.
- [ ] `GET /admin/export?mode=incremental` 는 dirty PUBLISHABLE 만, `?mode=full` 은 PUBLISHABLE 전체 반환(테스트).
- [ ] `POST /admin/export/ack {ids}` 가 해당 레코드 dirty 를 0 으로(테스트).
- [ ] export-data incremental: 변경된 레코드만 `.md` 재작성, 미변경 skip, 종료 시 ack 로 서버 dirty 해제.
- [ ] export-data full: PUBLISHABLE 전체 대상으로 index 재작성(고아 제거), version 동일·`.md` 존재 시 파일 재작성 skip, ack 로 dirty 해제.
- [ ] index.json 슬림 요약에 `version` 포함.
- [ ] `pnpm -r typecheck` · 테스트 통과.

## 7. 미해결 질문 / 리스크
- **ack 실패**: 로컬 기록 후 ack 가 실패하면 dirty 유지 → 다음 incremental 에 다시 포함(중복 작성이지만 idempotent, 무해).
- **기존 행 default=1**: 마이그레이션 후 첫 incremental 이 사실상 full 1회(의도된 동작).
- **고아 `.md`**: 레코드가 비공개로 바뀌면 옛 `.md` 가 `data/{선거}` 에 남는다. 이번 비목표(prune 추후).

## Changelog
- 2026-06-21: 최초 작성
- 2026-06-22: 이미지 로컬화(data/assets·archive 로컬 서빙) 범위 제외 — 이미지는 R2 그대로. 증분·버전 export 에 집중(요청: 채팅).
- 2026-06-22: 구현 완료 — reports.export_dirty 컬럼+마이그레이션(0003), 생성/PATCH 시 dirty=1, GET /admin/export?mode=incremental|full, POST /admin/export/ack, export-data 증분/버전skip/병합/ack(EXPORT_MODE), index.json version 필드. 테스트 2건 추가(총 51) 통과, 운영 마이그레이션·배포 후 incremental→ack→재incremental 0건 사이클 검증. in-review 이동.
