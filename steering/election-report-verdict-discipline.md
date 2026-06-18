---
tldr: 검증 큐 판정은 fact(검증가능 관측)와 claim(과잉해석)을 분리. 숫자가 실제로 변했으면 debunked(거짓) 아님→disputed. confirmed는 부정선거 단정이라 금지. 주의: 선관위 투·개표 API 검증절차(data.go.kr)와 홈페이지 실시간 표출값은 별개 계통—API로 표출값 증감 설명 금지(범주오류). 마감값이 올랐다내렸다 증감은 의심 정황.
tags: [votatis-admin, mcp, verdict, election, persona5]
last_retrieved: 2026-06-19
retrieval_count: 2
---

# 선거 제보 판정 규율 (votatis-admin MCP)

`record_verdict` 로 검증 제보를 판정할 때 반복 적용하는 규율. 페르소나5: 근거 없는 판정 금지, 주장과 사실 분리, 과잉해석 차단.

## 상태 선택 기준

- **confirmed**: claim이 사실로 확인된 경우. 단, 도구가 강제하듯 **부정선거 단정 금지** — 확인 범위(status_scope)·확인 항목(confirmed_scope)을 좁게 명시. 함부로 쓰지 않는다.
- **disputed**: 관측된 데이터(숫자 변동 등)는 실재하나 그 **해석(=조작·왜곡 주장)이 입증되지 않고 양성 설명이 있는** 경우. 선거 제보 다수가 여기 해당.
- **debunked**: claim의 **사실 관측 자체가 거짓**일 때만. 숫자가 실제로 변했으면 debunked가 아니다(해석만 틀린 거면 disputed).
- **corrected**: 일부 사실이나 정정 필요.

confirmed/disputed/debunked/corrected 는 method·evidence_links(1+)·public_summary·risk_level·not_confirmed(1+) 필수. evidence_links는 **절대 날조 금지**, 실제 출처만(없으면 WebSearch로 확보 후 기록).

## 도메인 사실: '고무줄 투표수'(투표자수 변동) 클래스

⚠️ **실수 회피(중요)**: 선관위 **투·개표정보 API/공공데이터(data.go.kr/data/15000900)의 사후 검증 절차(통상 2개월 내)** 와, **홈페이지 실시간 투표진행상황 표출값**은 **별개 계통**이다. API 검증 절차로 홈페이지 표출값 증감을 설명하면 안 된다(범주 오류). 제보 캡처는 보통 홈페이지 표출 화면이다.
- 마감된 투표자수가 홈페이지 표출에서 **올랐다 내려가는 증감(±)** 자체는 양성 설명이 부족한 **의심 정황** → 일방 증가는 아니지만 "정상"임을 입증하지도 못한다.
- 따라서: **fact(표출값 변동)는 인정**하되 claim(의도적 전산조작·원천무효)도 직접 증거 없으면 not_confirmed → **disputed**. 양 방향(조작 단정/정상 단정) 모두 근거 없이 단정 금지.
- missing_evidence에 "선관위의 홈페이지 표출·정정 로직 및 변동 시점·사유 공식 해명"을 반드시 남긴다.

## 절차

1. `get_report`+`analyze_report`+`view_attachment`(전 인덱스)로 본문·출처·첨부·EXIF 확인. analyze_report는 보조신호일 뿐 판정근거 아님.
2. 첨부와 본문의 내적 모순도 점검(예: 본문 "경남 4,991"인데 표상 4,991은 경북).
3. 근거 링크는 WebSearch로 실제 확보.
4. 공개·비가역 행위이므로 record_verdict 전 사용자에게 payload 확인 1회.

연관: [[admin-mcp-origin-gate]], [[github-issues-validation-queue-deprecated]]
