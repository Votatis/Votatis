# HUMAN — 사람 개입이 필요한 일

Goal 001(`docs/goals/001.md`) 자율 수행 중, **에이전트 혼자 끝낼 수 없는 일**을 여기에 모은다.
권한·자원·법적 책임이 물리적으로 필요한 항목만 적는다(설계 판단은 에이전트가 직접 함).

해결되면 항목을 `[닫힘]`으로 바꾸고 처리 결과를 남긴다.

---

## [열림] 운영 ADMIN_TOKEN 시크릿 발급
- 무엇이/왜 필요한가: 관리자 검증 콘솔(spec 0008/0009)은 공유 토큰 Bearer 인증을 쓴다. 로컬/개발은 `dev-admin-token`(wrangler.jsonc vars)이지만, 운영은 추측 불가한 강한 토큰이 필요하다.
- 막힌 작업: 운영 환경에서 관리자 로그인.
- 사람이 해줘야 할 구체적 액션: `cd apps/intake-api && wrangler secret put ADMIN_TOKEN` (강한 랜덤값 입력). 프론트는 그 값을 로그인 화면에 입력해 보관(localStorage). 멤버별 계정/권한은 향후 과제.
- (해결되면) 이어서 진행할 것: 운영 검증 워크플로우 가동.

## [열림] D1 → 공개 데이터(/data) export 실행 + GitHub 커밋 + 정적 사이트 재빌드
- 무엇이/왜 필요한가: 검증 완료 레코드를 공개하려면 운영 D1을 대상으로 `export:data`를 돌려 `data/*.md`+`index.json`을 생성하고, GitHub에 커밋한 뒤 정적 사이트(Cloudflare Pages)를 재빌드해야 한다(spec 0011). 운영 D1 접근·R2 자격증명·GitHub 푸시 권한·Pages 배포가 필요.
- 막힌 작업: 공개 아카이브/검색/통계에 실제 데이터 노출(현재 빈 인덱스).
- 사람이 해줘야 할 구체적 액션:
  1. 운영 API 기동/배포 후 `API_URL=<배포URL> ADMIN_TOKEN=<운영토큰> pnpm --filter votatis-intake-api export:data`
  2. 생성된 repo `data/` 를 커밋·푸시 (origin: 3dulev/Votatis)
  3. Cloudflare Pages 재빌드(`wrangler pages deploy out --branch=main`) — 프론트 build가 data/index.json을 인덱싱
- (해결되면) 이어서 진행할 것: 공개 페이지가 검증 데이터로 채워짐. 이후 정기 export 자동화(CI) 검토.

## [열림] (선택) Workers AI 바인딩 — 검증 보조 분석 증강
- 무엇이/왜 필요한가: 검증 보조 분석(spec 0012)은 바인딩 없이 휴리스틱으로 동작하지만, `env.AI`(Workers AI) 바인딩이 있으면 텍스트 모델로 요약/태그를 보강한다. 필수는 아니며 품질 향상용.
- 막힌 작업: AI 증강(없어도 휴리스틱은 정상 동작).
- 사람이 해줘야 할 구체적 액션: `apps/intake-api/wrangler.jsonc`에 `"ai": { "binding": "AI" }` 추가하고 Cloudflare 계정에서 Workers AI 활성화 후 배포. (요금·한도 확인)
- (해결되면) 이어서 진행할 것: `/admin/reports/{id}/analyze` 가 `source: "heuristic+ai"` 로 응답.

