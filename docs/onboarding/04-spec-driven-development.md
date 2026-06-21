# 4. 스펙 주도 개발 — 새 기능을 만드는 정해진 방법

이 프로젝트의 모든 기능 작업은 `specs/` 폴더의 **스펙 문서**로 관리됩니다.
머릿속으로 바로 코딩하지 않습니다. "무엇을, 왜, 어떻게, 완료 조건은?"을 적은
스펙을 먼저 만들고, 그걸 보고 구현한 뒤, 스펙대로 됐는지 검토합니다.

## 스펙의 4가지 상태 = 4개의 폴더

스펙은 **폴더 위치**로 진행 상태를 표현합니다. 상태가 바뀌면 **파일을 옮깁니다.**

```
specs/
  not-started/   ← 1. 스펙은 썼지만 아직 구현 전
  in-progress/   ← 2. 구현 중
  in-review/     ← 3. 구현 끝, 검토 대기
  completed/     ← 4. 검토 통과 ✅
```

전체 목록은 [`specs/README.md`](../../specs/README.md) 인덱스 표에서 관리합니다.
스펙을 추가·이동·삭제하면 **이 표도 즉시 맞춰야** 합니다.

## 작업 흐름 (3개의 스킬)

Claude Code에는 스펙용 **스킬(slash command)** 3개가 있습니다.
사람이 손으로 해도 되지만, 보통 이 스킬들이 흐름을 도와줍니다.

```
 ┌────────────────┐   ┌────────────────┐   ┌────────────────┐
 │  /spec-create  │──▶│ /spec-implement│──▶│  /spec-review  │
 └────────────────┘   └────────────────┘   └────────────────┘
   스펙 작성            구현                   검토
   → not-started/      → in-progress/        → 통과 시 completed/
                         구현·검증 후
                         in-review/ 로 이동
```

### 1) `/spec-create` — 스펙 작성
- 새 기능/작업의 설계 문서를 `specs/not-started/` 아래에 만듭니다.
- 트리거: "스펙 만들어줘", "spec-create", 새 기능을 스펙 주도로 시작할 때.

### 2) `/spec-implement` — 구현
- `specs/not-started/`의 스펙을 `in-progress/`로 옮기고 코드로 구현합니다.
- 구현·검증이 끝나면 스펙을 **`in-review/`로 옮기고** `/spec-review`에 넘깁니다.
- 트리거: "이 스펙대로 만들어", "spec-implement", 특정 스펙 번호 지목.

### 3) `/spec-review` — 검토
- `in-review/` 스펙의 구현이 완료 조건을 충족하는지 검토합니다.
- **통과하면** 스펙을 `completed/`로 옮깁니다. (통과해야만 이동)
- 트리거: "스펙대로 됐는지 확인", "spec-review".

> 📌 워크플로우 세부 규칙은 steering이 아니라 각 스킬의 `SKILL.md` 본문에 있습니다
> ([steering/spec-workflow-rules-go-in-skill](../../steering/spec-workflow-rules-go-in-skill.md)).

## 스펙 문서의 모양 (frontmatter)

각 스펙 파일 맨 위에는 메타데이터가 있습니다. 예:

```markdown
---
id: "0008"
title: 관리자 검증 API + 인증
status: completed   # not-started | in-progress | in-review | completed
created: 2026-06-14
updated: 2026-06-19
---
```

본문에는 보통: 목적 / 배경 / 범위 / 설계 개요 / 완료 조건 / **Changelog**가 들어갑니다.
실제 예시는 [`specs/completed/0008-admin-verification-api.md`](../../specs/completed/0008-admin-verification-api.md)를 펼쳐 보세요.

## ✍️ 스펙 Changelog (꼭 지키는 규칙)

채팅으로 특정 수정을 요청받아 작업했고, 그게 **기능 동작이나 구조를 바꿨다면**,
관련 스펙 파일의 `## Changelog`에 **한 줄** 기록합니다.

- **기록함**: 기능 추가/변경/제거, 스택 교체, 아키텍처·데이터 스키마 변경.
- **기록 안 함**: 단순 버그·오타 수정, 동작 그대로인 리팩터링.
- **형식**: `- YYYY-MM-DD: <무엇이 어떻게 바뀌었나> (요청: 채팅)` + frontmatter `updated`도 갱신.
- 마땅한 스펙이 없으면 **임의로 만들지 말고** "새로 만들지" 먼저 물어봅니다.

## 한눈 요약
1. 스펙 먼저(`not-started`) → 2. 구현(`in-progress`) → 3. 검증 후 `in-review` →
4. 리뷰 통과 시 `completed`. 5. 동작 바뀌면 Changelog 한 줄 + 인덱스 동기화.

## 다음 → [05-steering.md](05-steering.md): 작업하다 배운 교훈을 남기는 "실수 노트"
