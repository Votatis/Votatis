# 브랜치·커밋 협업 전략

우리가 브랜치를 따고, 커밋을 쓰고, PR을 올리고 머지하는 방식을 한곳에 정리한 문서다.
**사람과 AI 에이전트(Claude)가 모두 이 규칙을 따른다.** 우리는 회사가 아니라 **개인들이 모인 집단**이므로, 무거운 절차 대신 "가장 널리 쓰이는 단순한 흐름 + 신뢰"를 택한다.

- 스펙 주도 개발(`specs/`) 흐름과 steering 지식 관리 정책은 여기서 다루지 않는다 → `CLAUDE.md`의 해당 절을 따른다.
- 이 문서는 **무엇을/어떻게**만 다룬다. 운영 정책의 단일 출처는 `CLAUDE.md`이고, 이 문서는 그 상세 설명이다.

## 1. 원칙

1. **main은 항상 배포 가능 상태**를 유지한다. 깨진 코드를 main에 직접 올리지 않는다.
2. **작업은 토픽 브랜치에서.** main에 직접 push하지 않고, 모든 변경은 PR을 통해 들어온다.
3. **작은 PR을 자주.** 리뷰 가능한 크기로 쪼갠다. 큰 덩어리 하나보다 작은 여러 개가 낫다.
4. **신뢰 기반 리뷰.** 우리는 소규모이므로 절차로 옥죄지 않는다. 다만 main 머지는 최소 한 번 사람의 눈을 거친다.
5. **히스토리는 추적 가능하게.** 커밋·브랜치·PR 제목에서 "무엇이 왜 바뀌었나"가 한글로 읽혀야 한다.

## 2. 브랜치 전략 (GitHub Flow)

main 하나를 중심으로, 짧게 사는 토픽 브랜치를 따서 작업하고 PR로 되돌린다. (Git Flow의 develop/release 다중 브랜치는 쓰지 않는다 — 개인 협업엔 과함.)

```
main ──●────────●────────●──────────●──→  (항상 배포 가능)
        \      /          \        /
  feat/x ●──●─●            ●──●──●─●   ← 토픽 브랜치
         작업·커밋   PR→리뷰→머지   머지 후 브랜치 삭제
```

흐름:

1. 최신 main에서 토픽 브랜치를 딴다.
2. 그 브랜치에서 작업하고 커밋한다(§4).
3. 원격으로 push하고 **PR을 연다**(§5).
4. 리뷰를 받고 **Merge commit으로 main에 머지**한다.
5. 머지된 브랜치는 삭제한다.

## 3. 브랜치 네이밍

형식: `<type>/<짧은-설명>` — 스펙과 연동되면 `<type>/<spec-id>-<이름>`.

| type | 용도 | 예시 |
|------|------|------|
| `feat/` | 새 기능 | `feat/0015-admin-auth-accounts`, `feat/mvp-01` |
| `fix/` | 버그 수정 | `fix/member-delete-cors` |
| `refactor/` | 동작 불변 구조 변경 | `refactor/intake-api-src-layering` |
| `docs/` | 문서만 | `docs/branch-commit-strategy` |
| `chore/` | 설정·빌드·유지보수 | `chore/cf-env-wrapper` |
| `init/` | 초기 부트스트랩 | `init/system` |

규칙:

- 소문자 **kebab-case**, 짧고 식별 가능하게.
- 스펙 번호가 있으면 브랜치에 넣어 추적성을 높인다(`feat/0015-...`).
- 토픽 브랜치는 **짧게 살린다.** 머지되면 지운다(로컬·원격 모두).
- `main`은 보호 대상, `backup/...`은 임시 백업 용도로만.

## 4. 커밋 컨벤션

형식: `<type>(<scope>): <한글 설명> (spec: <id>)`

scope와 spec 꼬리표는 선택이지만, 해당하면 붙인다.

### type

| type | 의미 | 실제 예시 |
|------|------|-----------|
| `feat` | 새 기능 | `feat(admin): 회원 생성을 별도 페이지(/admin/members/new)로 분리 (spec: 0015-admin-auth-accounts)` |
| `fix` | 버그·결함 수정 | `fix(admin): 회원 삭제 CORS 허용 + 회원 UI 레이아웃 100%` |
| `refactor` | 동작 불변 구조 변경 | `refactor(intake-api): src 레이어 구조로 재구성 (spec 0013, 동작 불변)` |
| `docs` | 문서 변경 | `docs/spec: 관리자 인증 spec-review 통과 + MVP-PRD 보완 (spec: 0015-admin-auth-accounts)` |
| `chore` | 설정·빌드·잡일 | `chore: .env의 CF_* → wrangler CLOUDFLARE_* 매핑 래퍼(scripts/cf-env.sh)` |
| `ops` | 배포·운영 작업 | `ops: 관리자 인증(spec 0015) 운영 배포 완료 + HUMAN 닫힘` |
| `steering` | steering 지식 갱신 | `steering: wrangler-deploy-env 회수 +1 (cf-env.sh로 시크릿 등록 적용)` |

### scope

변경이 집중된 앱/영역을 괄호로 표기한다(선택). 예: `admin`, `intake-api`, `frontend`, `admin-mcp`. 여러 영역에 걸치면 생략 가능.

### 규칙

- **1커밋 = 1논리 변경.** 무관한 변경을 한 커밋에 섞지 않는다.
- 설명은 **한글**로, 요약형(무엇을 했는지)으로. 마침표 없이 간결하게.
- 관련 스펙이 있으면 `(spec: 0015-admin-auth-accounts)` 또는 `(spec 0015)` 꼬리표를 붙인다.
- 기능 동작·구조가 바뀌면 해당 스펙의 `## Changelog`에도 한 줄 남긴다(→ `CLAUDE.md` 스펙 Changelog 정책).

## 5. PR 워크플로우

1. 토픽 브랜치를 push한다.
2. **PR을 연다.** PR 제목은 커밋 컨벤션과 같은 포맷(`type(scope): 한글 설명`).
3. PR 본문에 **무엇을 / 왜** 적는다. 관련 스펙·이슈를 링크한다.
4. 최소 한 명의 리뷰를 받는다(소규모이니 한 명이면 충분).
5. **Merge commit으로 main에 머지**한다 — squash가 아니라 머지 커밋을 만들어 PR의 개별 커밋 히스토리를 보존한다.
6. 머지 후 브랜치를 삭제한다.

원칙: **main 직접 push 금지.** 모든 변경은 PR을 거친다. 작은 PR을 권장한다.

## 6. AI 에이전트(Claude) 규칙

AI도 위 규칙을 그대로 따른다. 추가로 권한 경계를 명시한다.

- AI는 **브랜치 생성 · 커밋 · push · PR 생성**까지 할 수 있다 — 단, **사용자가 명시적으로 요청할 때만.** 요청 없이 자동으로 push하거나 PR을 만들지 않는다.
- **main 머지는 절대 AI가 하지 않는다.** 머지는 항상 사람이 리뷰 후 직접 수행한다.
- 현재 작업이 main 브랜치에서 시작됐다면, 커밋/push 전에 먼저 토픽 브랜치를 만든다.
- 커밋 메시지 꼬리표(예: `Co-Authored-By: …`)는 harness 정책을 따른다 — 본문 컨벤션과 충돌하지 않는다.
- PR 관련 도구 함정은 steering을 참고한다 — 예: `gh pr edit`이 deprecated GraphQL로 실패하면 `gh api -X PATCH`로 우회(`steering/gh-pr-edit-projectcards-bug.md`).

## 7. 빠른 참조 (치트시트)

| 단계 | 명령 | 비고 |
|------|------|------|
| 브랜치 따기 | `git switch -c feat/0015-admin-auth-accounts main` | 최신 main에서 |
| 커밋 | `git commit -m "feat(admin): 회원관리 추가 (spec: 0015-...)"` | 1커밋=1변경 |
| push | `git push -u origin feat/0015-admin-auth-accounts` | 토픽 브랜치만 |
| PR 생성 | `gh pr create --title "feat(admin): ..." --body "..."` | 제목=커밋 포맷 |
| 머지 | (PR에서 **Merge commit**) | **사람만** |
| 정리 | `git branch -d <branch>` + 원격 삭제 | 머지 후 |

> 핵심 한 줄: **토픽 브랜치에서 작업 → 컨벤션대로 커밋 → PR → 사람이 Merge commit으로 머지 → 브랜치 삭제.**
