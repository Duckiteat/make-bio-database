# 수집 시스템 디벨롭 — 새 세션에 붙여 넣는 글

> 점검 모드에서 읽기만으로 모은 지도다. 아래 "붙여 넣기" 블록을 새 세션 첫 메시지로 쓴다. 외부 저장소 항목은 이름·설명·라이선스만 확인했고 코드는 열어 보지 않았다 — 쓰기 전에 직접 확인한다.

## 붙여 넣기

```
develop 모드로 연다 (node rebuild/gate.mjs open develop). 범위는 하나: 값 수집 시스템의 "검색 계층"을 만든다.
엔진 파일은 다른 세션이 하는 중이라 건드리지 않는다.

배경
- 목적: 사람 값 속도 상수(kcat·Km·반감기)를 1차 출처에서 찾아 후보로 모으고, 기존 판정기로 거른다 (PLAN-078).
- 지금 상태: 받는 쪽은 10-25 이후 거의 그대로, 거르는 쪽만 커졌다. 병목은 검색이다.
  Europe PMC 초록 검색으로는 사람 효소 상수가 거의 안 잡힌다. 10-25 수집(TASK-003)은 15칸 중 값 2개.
  수집가가 제안한 개선(어휘 확장 · BRENDA · 전문 접근)은 한 번도 적용되지 않았다 (docs/reports/2026-11-01-data-integrity.md §9).
- 열린 속도 상수 한계 27건. 시트르산 회로는 8단계 중 4개만 채워짐.

먼저 읽을 것 (이 순서)
1. workspace/SOURCES.md  2. workspace/tasks/TASK-003, 005  3. docs/design/outsourcing-and-mcp.md §2~5
4. docs/design/work-verification.md  5. node rebuild/read.mjs --bundle PLAN-078,ASY-12,ASY-13,ASY-16 --depth 1
6. docs/reports/2026-10-16-kinetics-sourcing.md · kinetics-brenda.md

이미 있는 것 (다시 만들지 않는다)
- 받는 문 mcp/fetch.mjs: resolve_access · fetch_abstract · fetch_fulltext(공개 전문 OA만) · resolve_doi · brenda_kinetics. 받기 기록(FETCH_LOG)은 추가 전용.
- 수신함 inbox.js, data/fetched/{europepmc,uniprot,chebi,rhea,brenda,consensus}, workspace/handoff/*.jsonl
- 판정: judicial/collection_audit.js(PASS·REVIEW·REJECTED), identity.js, trend.js, verifier.js
- 초안: legislative/augment_draft.js, dbtool augment(plan→fetch→build→apply), mcp/clerk.mjs(put_handoff·validate_patch·merge)

빠진 것 (만들 후보 — 사용자가 고른다)
A. 검색 계층: PMID 한 건 조회가 아니라 효소·종·파라미터로 찾는 질의 (Europe PMC 질의 확장 + UniProt 큐레이션 + SABIO-RK 등 무료·무인증 원천 추가)
B. 전문에서 숫자 후보 뽑기 보조: OA 전문 XML의 표·방법 문장에서 후보 + 인용구. 후보만 내고 확정은 판정기.
C. 구독 논문용 사람 투입 문: 사용자가 PDF·본문을 주면 수신함으로 받는 길 (data/fetched/RETRIEVAL_TASKS.md 의 수동 형식이 이미 비슷한 역할)
D. BRENDA 는 계정이 환경 변수에 없어 코드로 못 푼다 — 사용자 일.

지킬 것
- 결과는 전부 후보. 1차 출처 재확인한 것만 패치 (RULE-0305 · 0276). 값은 원문 식별자로 대조 (RULE-0266). 다른 종 값을 사람 값으로 쓰지 않는다.
- 웹 검색 결과를 저장하지 않는다 (RULE-0095). 스니펫을 값·인용 근거로 쓰지 않는다 (SOURCES.md 규칙 1).
- 계정·토큰을 채팅·저장소·기록에 남기지 않는다 (RULE-0518). 로그인·유료 우회·저작권 침해 경로는 쓰지 않는다 (fetch.mjs 원칙).
- 새 도구가 서기의 쓰기 함수를 부르면 권한 표(L6)를 넓혀야 한다 — 그건 사용자 커밋이 필요하다. 표에 이미 있는 모듈만 쓴다 (NEXT-2026-11-02.md §3).
- 외부 코드는 가져와 읽고, 필요한 부분만 이 저장소 방식(규칙·시험)으로 다시 쓴다. 통째로 들이지 않는다.

끝내기 전: node rebuild/gate.mjs finish develop 따로, 그다음 git commit. push 는 finish develop --full 뒤, 그리고 git fetch --unshallow 후 전체 시험 한 번.
```

## 밖에서 가져다 쓸 후보 (GitHub 검색 결과 — 코드는 열어 보지 않음)

세션의 GitHub 접근은 이 저장소 하나로 제한되어 있어 검색만 했다. 각 저장소는 `add_repo` 로 붙인 뒤 읽는다. 별 수·최근 푸시는 2026-11-02 검색 시점 값.

| 저장소 | 별 · 라이선스 · 최근 푸시 | 설명(검색 결과) | 쓸 곳 | 먼저 확인할 것 |
|---|---|---|---|---|
| `genomoncology/biomcp` | 671 · MIT · 11-02 | 생의학 MCP | A 검색 계층의 참고 — 질의 방식, 원천 구성 | 어떤 원천을 쓰는지, 로그인·유료 의존 여부 |
| `openags/paper-search-mcp` | 2979 · MIT · 10-02 | 여러 원천에서 논문 검색·다운로드 MCP, CLI | A·C — 원천 어댑터 구조 참고 | **다운로드 원천에 불법 사본 사이트가 있는지.** 있으면 그 부분은 쓰지 않는다 (저작권·로그인 금지) |
| `jannisborn/paperscraper` | 547 · MIT · 10-14 | PubMed·arXiv·bioRxiv 등 서지 메타데이터 도구 | A — 메타데이터·초록 수집 | 전문 접근은 하지 않는 도구인지, 호출 간격 예의 |
| `sysbiolux/WILDkCAT` | 11 · MIT · 11-02 | 대사 모델용 kcat 추출·검색·예측 | 속도 상수 수집 — BRENDA·SABIO-RK 조회 로직 참고 | 예측값(모델 추정)을 실측과 섞지 않는 구조인지. 예측값은 이 저장소에서 실측이 아니다 |
| `freiburgermsu/BiGG_SABIO` | 2 · MIT · 2022 | SABIO-RK 에서 반응 속도 자료를 받는 모듈 | SABIO-RK 접근 코드 참고 | 오래됨 — API 가 바뀌었을 수 있다. 엔드포인트는 공식 문서로 재확인 |
| `Dianel555/paper-search-mcp-nodejs` | 190 · MIT · 09-20 | 위와 같은 종류의 Node 구현 | 위 항목과 비교용 | 위와 같음 |

제외한 것: 책·논문 불법 사본 사이트를 묶는 도구(예: libgen 계열 MCP). 이 저장소는 로그인·유료 우회·저작권 침해 경로를 쓰지 않는다. 라이선스가 없는 소형 저장소(`no-license`)도 코드를 들이지 않고 아이디어만 본다.

## 공식 API (코드가 아니라 문서로 확인할 원천)

| 원천 | 이 환경 접속 | 계정 | 메모 |
|---|---|---|---|
| Europe PMC REST | 확인됨(200) | 불필요 | 이미 사용 중. 전문은 OA 만 |
| UniProt REST | 확인됨(200) | 불필요 | 이미 사용 중. 효소 kcat·Km 큐레이션 필드가 있어 후보 원천 |
| PMC / NCBI E-utilities | 사이트 301 만 확인 | 불필요(키 권장) | 엔드포인트와 속도 제한은 문서로 재확인 |
| SABIO-RK | 미확인 | 불필요(공개 REST) | 속도 상수 수집의 주 후보. 접속·이용 조건 확인 필요 |
| BRENDA | 미확인 | **필요 — 환경 변수에 없음** | 사용자 일 (RULE-0518) |
| BioNumbers | 미확인 | 불필요 | 농도·부피. 2차 정리 값이라 1차 원문 재확인 필수 |
