## 1. 목적

분산되어 사라지는 증거와 제보를 하나의 검증 가능한 데이터베이스로 모은다. 단발성이 아니라 누구든 기여하고 이어서 유지보수할 수 있게 설계한다.

핵심은 기술이 아니라 신뢰도다. "이게 확인된 사실인지, 단순 주장인지, 반박된 건지"를 명확히 구분하는 것이 이 프로젝트의 존재 이유다. 검증 상태 구분이 없으면 아카이브는 음모론 덤프와 다를 게 없다.

## 2. 설계 원칙

1. 검증 우선. 미검증 데이터와 사실확인 데이터를 절대 같은 무게로 표시하지 않는다.
2. 출처 추적. 모든 레코드는 출처와 시점을 갖는다. 출처 없는 항목은 등록 불가.
3. 무결성 증명. 첨부파일은 해시로 봉인한다. 사후 변조 여부를 누구나 확인 가능하게.
4. 중립 서술. 주장과 사실을 문장 차원에서 분리한다. 단정 금지, 라벨로 표현.
5. 개방 기여. 데이터 포맷과 검증 절차를 공개한다. 특정 개인 종속 금지.
6. 최소 노출. 개인 실명, 사생활 정보는 최소화한다. 정정과 삭제 경로를 처음부터 둔다.

## 3. v1 범위

- 제보 접수 API - Cloudflare Worker / R2
- 검증 Queue - Cloudflare D1 (관리자 페이지 UI)
- 검증 및 승격 - 관리자 페이지 (내부 도구)
- 공개 데이터 배포 - GitHub 레포 / 정적 사이트
- 벡터/시맨틱 검색

## 4. 시스템 아키텍쳐

```
[제보자/크롤러]
      |
      v
[웹앱 / API]  
      |  (EXIF 추출, Turnstile)
      v
[Cloudflare Worker]  --첨부파일-->  [R2 스토리지]
      |  (정규화 + 해시 + 무결성 검증)
      v
[Cloudflare D1]   <-- 검증 큐 (미검증 상태)
      |
      v
[관리자 페이지]   <-- 팀원 검수 도구
      |  (검증/거절/보완 판단)
      |  (AI 분석, 자동 태깅)
      v
[D1 기록] 상태 업데이트 (confirmed/disputed/debunked)
      |
      v
[공개 배포]  검증 완료 데이터만
      |  (GitHub 레포 커밋 + 정적 사이트 재빌드)
      v
[GitHub Pages: 정적 사이트 + 클라이언트 검색]
```

역할 분리:

Worker는 수집과 정규화만 담당. 판단하지 않는다.
검증 판단은 사람이 관리자 페이지에서 한다.
공개 레포에는 검증 통과 데이터만 들어간다.
D1은 제보부터 검증까지 전 과정 기록. 공개되지 않음.

## 5. 데이터 수집 흐름

1. 웹 앱에서 제보자가 위치, 유형, 상세, 출처, 첨부 입력 (4단계 마법사)
   - EXIF 자동 추출, 클라이언트 WebP 최적화
   - Turnstile 검증
2. API(`POST /submissions` → presigned R2 업로드 → `/finalize`)로 접수
   - 첨부 magic bytes 검증, SHA-256 해시
   - D1에 미검증(unverified) 상태로 기록
3. 관리자 페이지에서 대기 중인 제보 목록 조회
   - 출처 원본 접근 가능 여부 확인
   - AI 분석/자동 태깅, 합성 식별
   - 승인/보완/거절 판단
4. 검증 완료 항목을 공개 레포에 커밋 (자체 스크립트 또는 수동)
   - 마크다운 변환, YAML 프런트매터 작성
   - GitHub 커밋 → 정적 사이트 재빌드

## 6. 검증 워크플로우 (관리자 페이지)

**기본 검증 단계:**
1. 출처 확인: archive.org 등으로 원본 스냅샷 확보
2. 사실 검증: 관계자 발표/보도자료로 교차 확인
3. 정보 보호: 개인 식별 정보 마스킹, 미성년자 보호
4. 근거 링크: 검증 근거 URL 및 캡처 기록
5. 문장 교정: 단정 → "~로 보도됨", "~가 확인됨" 등 라벨 문장으로 통일
6. 상태 판정:
   - **confirmed**: 1차/2차 출처 확인 완료
   - **disputed**: 반박 증거 확인됨 (양쪽 모두 기록)
   - **debunked**: 명백히 거짓 판정
   - **corrected**: 초기 정보 수정됨 (수정 이유 기록)

**관리자 페이지 기능:**
- 대기 중인 제보 목록 (시간순, 지역별, 태그별 필터)
- 원본 첨부/스크린샷 인라인 표시
- AI 분석 결과 제시 (신뢰도, 관련 키워드)
- 판정 선택 → D1 상태 업데이트 → 공개 배포 큐 진입
- 감시 대상/의심 제보 플래그 (재검증 추적)

## 7. 데이터 스키마

레코드는 공개 레포에 `/data/{election}/{id}.md` 한 건당 한 파일. YAML frontmatter + 마크다운 본문.

스키마는 더욱 구체화 필요.

### 레코드 예시

```yaml
---
id: "local8-2026-0001"
election: "제8회 전국동시지방선거"
title: "OO 개표소 투표지 부족 신고"
summary: "투표 종료 전 일부 사전투표지 소진 보고. 사실확인 완료."
status: "confirmed" # unverified | reviewing | confirmed | disputed | debunked | corrected
tags: ["투표지부족", "사전투표", "개표소"]
counting_unit: "OO구 제3개표소"
region:
  sido: "경기도"
  sigungu: "성남시 분당구"
  eup_myeon_dong: null
occurred_at: "2026-06-03T16:20:00+09:00"
collected_at: "2026-06-03T22:10:00+09:00"
sources:
  - url: "https://example.com/report"
    type: "news" # news | official | social | submitter | crawler
    captured_at: "2026-06-03T22:08:00+09:00"
    archive_url: "https://web.archive.org/..."
attachments:
  - filename: "ballot_shortage.jpg"
    r2_key: "local8-2026/0001/ballot_shortage.jpg"
    sha256: "9f86d0818..."
    mime: "image/jpeg"
    size: 482113
verification:
  reviewer: "reviewer-a1"
  method: "원본 영상 대조, 선관위 공지 교차확인"
  evidence_links:
    - "https://example.com/nec-notice"
  reviewed_at: "2026-06-04T09:00:00+09:00"
  notes: "수량 정확치는 미확정. 부족 사실 자체는 확인."
rebuttals:
  - text: "선관위는 예비 투표지로 즉시 보충했다고 발표."
    source_url: "https://example.com/nec-statement"
related: ["local8-2026-0002"]
submitter: "anon-7c3" # 익명화 ID. 실명/연락처 비저장
license: "CC-BY-4.0"
---
본문 (마크다운). 시간순 경위, 근거, 한계 명시.
```

### 필드 원칙

status 와 verification 은 필수. 출처 없으면 등록 불가.
occurred_at 과 collected_at 분리. 발생 시점과 수집 시점은 다르다.
region 은 개표단위보다 잘게. 시도/시군구/읍면동 3단.
rebuttals 는 비워두지 않기를 권장. 반론 부재 자체도 기록 가치.
submitter 는 익명 해시. 실명, 전화, 이메일은 저장하지 않는다.

## 8. 제보 웹앱 Form → D1 스키마 매핑

웹앱의 4단계 제보 마법사는 PRD §7 데이터 스키마와 1:1로 대응된다.

**단계별 입력:**
1. **위치 + 유형**: region(시도/시군구/읍면동), counting_unit, tags
2. **상세 내용**: title, summary, occurred_at, 내용
3. **출처 + 첨부**: sources(URL 배열, archive.org 자동 캡처), attachments(R2 키 + SHA-256)
4. **검증 정책 동의**: status=unverified, submitter=익명해시, license=CC-BY-4.0

API 응답:
- `POST /submissions/{id}/finalize` 완료 시 D1 `reports` 테이블에 INSERT
- 응답: `{ report_id, collected_at, attachments }`
- 제보자에게 접수번호와 검증 예상 기간 표시

**D1 → GitHub 마크다운 변환 (공개 배포):**

검증 완료(confirmed/disputed/debunked/corrected) 항목을 GitHub 레포의 마크다운으로 변환·커밋하는 배포 파이프라인.

- **대상**: status가 검증 완료 상태이고 아직 공개되지 않은 D1 `reports` 행
- **변환**: D1 행 → §7 스키마의 YAML 프런트매터 + 본문 마크다운
  - 프런트매터: id, election, status, region(시도/시군구/읍면동), counting_unit, occurred_at, collected_at, tags, sources, attachments, rebuttals, license
  - 본문: title, summary, 검증 근거, 반박 기록
  - 첨부는 R2 키/공개 URL로 기록 (원본 바이너리는 레포에 넣지 않음)
  - 개인 식별 정보 마스킹 적용, submitter는 익명 해시만
- **출력 경로**: `/data/{election}/{id}.md`
- **실행**: 관리자 페이지의 "공개" 액션 또는 배치 스크립트(자체 스크립트/GitHub Action)
  - GitHub 커밋 push → 정적 사이트 재빌드 트리거
  - D1에 published 상태/공개 시각 기록 (재배포·갱신 추적)
- **갱신**: 이미 공개된 항목의 status가 바뀌면(예: confirmed→corrected) 같은 경로 파일을 덮어쓰는 멱등 커밋

## 9. 검색과 인덱싱

- v1: 클라이언트 키워드 검색. 수천 건이면 충분히 현실적.

빌드 시 /data/\*.md 를 파싱해 검색 인덱스 JSON 생성 (제목, 요약, 태그, 지역, 선거, status)
라이브러리: Pagefind 또는 MiniSearch. 정적 사이트에 적합.
필터: 선거, status, 지역, 태그, 기간

- v2: 벡터 검색. 임베딩 API만 서버(Worker)에서 호출. 벡터는 Cloudflare Vectorize 또는 사전 생성 후 클라이언트 적재. 데이터 축적 후 도입

## 10. 구현 현황 및 계획

**완료 (MVP 범위):**
- ✅ 제보 수집 API (Cloudflare Worker, presigned R2 업로드)
- ✅ 웹앱 기본 프로토타입 (Next.js SSG, 4단계 제보 마법사)
- ✅ D1 스키마 및 입력 로직

**개발 중 (v1):**
- 🔄 관리자 페이지 (제보 목록 조회, 검증 판정, 상태 업데이트)
- 🔄 AI 분석 백엔드 (제출 내용 분석, 태그 추천, 신뢰도 평가)
- 🔄 공개 데이터 배포 (D1 → GitHub 마크다운 변환 스크립트, §8 참조)
- 🔄 정적 사이트 (검색/필터, 아카이브 뷰)

**계획 (v1 이후):**
- 벡터 검색 (Cloudflare Vectorize)

## 11. 웹 기획

**공개 웹사이트 (정적 사이트):**
1. 랜딩 페이지: 프로젝트 목표, 검증 원칙, 파이프라인 설명
2. 제보 페이지 (`/report`): 마법사 UI (4단계)
   - 위치 선택 (행정동 자동완성)
   - 사건 유형 (칩 선택)
   - 상세 내용, 출처 URL, 첨부 파일
   - Turnstile 검증 후 제출
3. 아카이브 페이지 (`/archive`): 검증 완료 데이터 열람
   - 검색 (키워드, 선거, 지역, 상태 필터)
   - 상세 뷰 (출처, 검증 근거, 반박 기록)
4. 통계 페이지 (`/stats`): 제보/검증 현황 대시보드

**관리자 페이지 (별도 인증):**
1. 검증 큐: 미검증 제보 목록
2. 상세 검증 뷰: 원본 첨부, AI 분석, 검증 메모
3. 대시보드: 검증 속도, 팀원 활동

## 12. 추가 결정사항

**관리 및 운영:**
- 관리자 페이지 접근 제어 (팀원 초대, 권한 레벨)
- D1 검증 큐의 보관 기한 (거절 항목 언제 삭제할지)
- AI 분석 결과의 검토/거부 프로세스

**공개 데이터:**
- 출범 전 법률 검토 (저작권, 초상권, GDPR 등)
- 공개 데이터 라이선스 (CC-BY-4.0 등)
- 제보자 신원 검증 필요 여부 및 방법
- 개인 식별 정보 마스킹 규칙 정립

**향후 확장:**
- 일반 사용자의 의견 작성 기능 (댓글, 반박, 추가 근거)
- 대량 제보 처리 (크롤러 API, 배치 수집)
- 다국어 지원
- 오프라인 검증 도구 (모바일 앱, 로컬 검수 단말)
