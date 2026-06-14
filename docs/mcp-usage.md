# Votatis 검증 관리 MCP — 사용 가이드 (`votatis-admin-mcp`)

이 문서를 AI(Claude Code 또는 Codex)에게 그대로 먹이면 Votatis 검증 관리 MCP를 등록·사용할 수 있다.
이 MCP는 intake-api 관리자 API를 감싸, **검증 큐 확인 → 증거·보조분석 검토 → 근거와 함께 판정**을 도구로 수행한다.
설계 기준은 `docs/PERSONA.md` 페르소나 5(내부 검증 관리자): **근거 없는 판정 금지, AI 분석은 보조 신호일 뿐**.

---

## 0. 사전 준비

1. **intake-api 가 떠 있어야 한다.**
   - 로컬: `pnpm --filter votatis-intake-api dev`  → `http://localhost:8787` (관리자 토큰 기본값 `dev-admin-token`)
   - 운영: 배포 URL + `wrangler secret put ADMIN_TOKEN` 로 넣은 운영 토큰 (`loops/HUMAN.md` 참고)
2. **MCP 서버 빌드** (최초 1회/코드 변경 시):
   ```bash
   pnpm install
   pnpm --filter votatis-admin-mcp build      # → apps/admin-mcp/dist/index.js
   ```
   빌드가 잘 됐는지: `pnpm --filter votatis-admin-mcp smoke` (도구 8종 노출 확인)

> 경로 표기: 아래 예시의 `/ABS/PATH/Votatis` 를 이 레포의 **절대 경로**로 바꾼다(`pwd` 로 확인).

---

## 1. 환경변수

| 변수 | 의미 | 로컬 예 |
|------|------|--------|
| `VOTATIS_API_URL` | intake-api 베이스 URL | `http://localhost:8787` |
| `VOTATIS_ADMIN_TOKEN` | 관리자 Bearer 토큰 | `dev-admin-token` |

---

## 2. 등록 — Claude Code

### 방법 A) 프로젝트 `.mcp.json` (레포 루트에 두면 팀 공유)
```json
{
  "mcpServers": {
    "votatis-admin": {
      "command": "node",
      "args": ["/ABS/PATH/Votatis/apps/admin-mcp/dist/index.js"],
      "env": {
        "VOTATIS_API_URL": "http://localhost:8787",
        "VOTATIS_ADMIN_TOKEN": "dev-admin-token"
      }
    }
  }
}
```

### 방법 B) CLI
```bash
claude mcp add votatis-admin \
  --env VOTATIS_API_URL=http://localhost:8787 \
  --env VOTATIS_ADMIN_TOKEN=dev-admin-token \
  -- node /ABS/PATH/Votatis/apps/admin-mcp/dist/index.js
```
등록 후 Claude Code에서 `/mcp` 로 `votatis-admin` 연결과 도구 8종을 확인한다.

---

## 3. 등록 — Codex

`~/.codex/config.toml` 에 추가:
```toml
[mcp_servers.votatis-admin]
command = "node"
args = ["/ABS/PATH/Votatis/apps/admin-mcp/dist/index.js"]
env = { VOTATIS_API_URL = "http://localhost:8787", VOTATIS_ADMIN_TOKEN = "dev-admin-token" }
```
Codex 재시작 후 도구가 노출된다.

> 빌드 없이 쓰고 싶으면 `command="pnpm"`, `args=["--dir","/ABS/PATH/Votatis/apps/admin-mcp","exec","tsx","src/index.ts"]` 로 대체 가능(느림). 운영은 빌드본 권장.

---

## 4. 도구 (8종)

| 도구 | 용도 |
|------|------|
| `health` | API 연결성 + 토큰 유효성 확인 (가장 먼저) |
| `list_review_queue` | 검토 큐 목록 + 상태별 카운트 (필터: status, q, election, sido, sigungu, tag, limit, offset) |
| `get_report` | 제보 상세(제보자 익명ID·EXIF·출처·첨부 해시·검증 이력) |
| `analyze_report` | 보조 분석 신호(태그 추천·신뢰도·합성 위험·요약) — ⚠️ 보조용, 판정 근거 아님 |
| `view_attachment` | 증거 첨부 이미지 직접 열람 (id, index) |
| `record_verdict` | 판정/갱신 (status + method + evidence_links + notes + tags + rebuttals) |
| `list_publishable` | 공개 배포 가능(검증완료) 레코드 목록 |
| `get_stats` | 상태/선거/일자별 집계 |

---

## 5. 판정 규칙 (페르소나 5 — 반드시 지킬 것)

- `confirmed`/`disputed`/`debunked`/`corrected` 판정에는 **검증 방법(method)과 근거 링크(evidence_links 1개 이상)가 필수**다. 없으면 `record_verdict` 가 호출 자체를 거부한다(intake-api 도 재차 거부).
- **AI 분석(`analyze_report`)은 보조 신호일 뿐**, 그것만으로 판정하지 말 것. 사람이 출처·원본(`view_attachment`)으로 교차검증한다.
- "우리 편"으로 보이는 자료일수록 **더 엄격히** 본다(확증편향 방지).
- 반박/이견이 있으면 `rebuttals` 에 양측을 함께 기록한다.

---

## 6. 전형적 흐름 (AI에게 이렇게 시키면 된다)

```
1) "votatis-admin health 로 연결 확인해줘."
2) "검토 큐에서 미검증(unverified) 제보 목록 보여줘."          → list_review_queue(status=unverified)
3) "report <id> 상세랑 첨부 이미지, 보조 분석 신호 보여줘."     → get_report / view_attachment / analyze_report
4) "출처 2개(<url1>,<url2>)로 교차확인됐어. method='선관위 공지 교차확인',
    근거 링크 그 두 개로 confirmed 처리하고, 태그에 '개표소' 추가해줘."
                                                              → record_verdict(status=confirmed, method=..., evidence_links=[...], tags=[...])
5) "공개 배포 대상 목록과 통계 보여줘."                          → list_publishable / get_stats
```
근거를 안 주고 "그냥 confirmed 처리해"라고 하면 도구가 거부한다 — 이는 의도된 가드레일이다.

---

## 7. 트러블슈팅

- **도구가 안 보임**: 빌드했는지(`dist/index.js` 존재), 경로가 절대경로인지 확인. `pnpm --filter votatis-admin-mcp smoke` 로 단독 검증.
- **"VOTATIS_ADMIN_TOKEN 미설정"**: MCP 설정의 `env` 에 토큰 누락. 로컬은 `dev-admin-token`.
- **HTTP 401**: 토큰 불일치(운영 토큰 확인). **HTTP 403**: intake-api `ALLOWED_ORIGIN`/CORS — MCP는 서버-서버 호출이라 보통 무관하나, 운영 URL/토큰을 다시 확인.
- **연결되는데 큐가 비었음**: 실제 미검증 제보가 없을 수 있음(`get_stats` 로 확인).
- **운영 대상**: `VOTATIS_API_URL`=배포 URL, `VOTATIS_ADMIN_TOKEN`=운영 시크릿으로 교체.
