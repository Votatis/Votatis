# data/ — 공개 데이터 (검증 완료 레코드)

검증을 통과한 제보만 이곳에 마크다운으로 공개된다. D1(비공개)에서 검증 완료된 레코드를
`pnpm --filter votatis-intake-api export:data` 로 내보내 생성한다(spec 0011).

- `{election-slug}/{id}.md` — 사람이 읽는 공개본(YAML frontmatter + 본문). PRD §7 스키마.
- `index.json` — 빌드타임 인덱스의 단일 원천(프론트 정적 빌드가 소비). md 와 함께 생성됨.

> 미검증/검토중 제보는 여기에 들어오지 않는다(PRD 원칙1: 검증 우선). 개인정보(submitter·exif)는 제외된다.
>
> 운영 D1 대상 export 실행 + GitHub 커밋/배포는 자격증명이 필요 → `loops/HUMAN.md` 참고.
