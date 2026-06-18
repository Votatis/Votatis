---
tldr: wrangler v3 `r2 object put` 은 --remote 인자가 없다(기본이 원격, --local 만 존재). `r2 object list` 서브커맨드 자체가 없어 버킷 전수 나열은 불가(get/put/delete만) — 객체 열거는 D1 attachments.r2_key가 원천이거나 CF API/S3 클라이언트로. 증거 원본을 운영 R2 에 올릴 땐 키를 D1 attachments.r2_key 와 정확히 일치시켜야 admin 증거 스트리밍이 찾는다.
tags: [pitfall, cloudflare, r2, wrangler, intake-api]
last_retrieved: 2026-06-19
retrieval_count: 1
---

## 함정 1 — `--remote` 없음
intake-api 에 핀된 wrangler v3 에서 `wrangler r2 object put <bucket>/<key>` 은 **기본이 원격 R2** 다.
`--remote` 를 붙이면 `✘ Unknown argument: remote` (yargs validation error)로 13개가 통째로 실패한다.
로컬 대상일 때만 `--local`. (배포용 deploy 와 헷갈리지 말 것 — deploy 는 또 다름 [[wrangler-deploy-env]])

## 함정 3 — `r2 object list` 가 없음
wrangler v3 `r2 object` 는 get/put/delete 만 있고 **list 서브커맨드가 없다**(`✘ Unknown arguments: list, <bucket>`).
즉 버킷 객체를 CLI로 전수 나열할 수 없다. 결과:
- 어떤 증거가 있는지의 **원천은 D1 `reports.attachments[].r2_key`** 다. 삭제·검증은 여기서 키를 뽑아 `r2 object delete "votatis-evidence/<key>"` 로 1개씩.
- D1 미참조 orphan 객체(과거 시드 업로드 잔여 등)는 CLI로는 못 찾는다 → 버킷 전수 정리는 **Cloudflare API(`/accounts/<id>/r2/buckets/<b>/objects`)나 S3 호환 클라이언트**로 나열해야.

## 함정 2 — 키가 정확히 일치해야 스트리밍이 찾는다
admin 증거 스트리밍은 `env.EVIDENCE_BUCKET.get(att.r2_key)` 로 가져온다. 따라서 R2 에 올리는 객체 키가
D1 `reports.attachments[].r2_key` 와 **바이트 단위로 동일**해야 한다(공백·한글 포함). 우리 키 형식은
`<election>/<submission_id>/<filename>` (예: `제9회 전국동시지방선거/<id>/<file>.webp`). 키에 공백/한글이 있어도
정상이니, `wrangler r2 object put "votatis-evidence/<key>" --file=... --content-type=image/webp` 처럼 따옴표로 감싼다.

## 증거 원본 이관 절차(예시 시드)
1. 공개 출처(예: `pub-<hash>.r2.dev/<key>`)에서 내려받아 **sha256·size 를 메타와 대조**(무결성).
2. 운영 R2 에 동일 r2_key 로 put(`set -a; . ./.env; set +a; export CLOUDFLARE_*=$CF_*` 후 반복).
3. D1 `attachments` 에 `{filename,r2_key,sha256,mime,size}` 기록(시드 SQL).
4. 검증: 공개 `GET /reports/{id}` 첨부 메타 + admin `GET /admin/reports/{id}/attachments/{idx}` 바이트 sha256 일치.
