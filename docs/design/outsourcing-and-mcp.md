# 외주화와 MCP 분리 — 무엇을 밖에 맡기고, 무엇을 안에 두나 (설계, 2026-10-23)

> 사용자 결정(2026-10-23): 전문 받기를 맡을 에이전트를 사용자가 따로 만든다. 외주화가 가능한 부분은 전체적으로 외주화한다. 이 문서는 그 경계를 정한다.
> 근거 문서: `docs/PROMPTS.md` §3·§3′(다른 AI·수집가·통합가), `work-verification.md`(자기 보고 불인정), `tripartite-governance.md`, `direction.md` §5(자동화 궤적), `post-build-directions.md` §1(MCP 분해 네 제약), `structure-realignment.md`(7부).

## 0. 한 줄 원칙

**만드는 일은 외주화하고, 판정하는 일과 쓰는 일은 안에 둔다.** 밖에서 온 것은 모두 신뢰하지 않는 입력이다. 그런 입력이 들어오는 문은 셋뿐이다 — **수신함**(`data/fetched/`, 원본 그대로), **핸드오프**(`workspace/handoff/`, 후보), **관문**(패치·원장 추가, 봉인 뒤 서기). 문을 지나면서 안쪽이 독립으로 다시 확인한다. 이 규칙이 있어서 외주화가 안전하다(direction §5: "검증 척추가 자동화를 안전하게 만든다").

## 1. 왜 지금

| 무엇 | 근거 |
|---|---|
| 정량 수집이 매번 "전문 필요"에서 멈췄다 | TNF mRNA(TASK-001), IκBα, 텔로미어(TASK-004) 셋 다. 수신함이 초록만 받기 때문이다. IκBα 후보 8편 중 공개 전문(XML) 1편, PMC 무료 열람 4편이 있었는데 읽지 않았다. 그중 O'Dea 2007(PMC2673708, 공개)에는 "free IκB half-lives 5–10 min"(생쥐 MEF)이 있었다 |
| 사람과 통합가의 시간이 병목이다 | 자동결정률 임계 아래에서는 사실마다 사람이나 Opus가 확인한다(direction §1). 수집·받기·초안을 밖에 맡겨야 통합가가 판정에만 쓴다 |
| 실행 기록을 도구가 써야 한다 | work-verification 의 남은 일: "실행 테이프는 도구 런타임이 써야 하고, 하네스 기록은 best-effort". MCP 도구는 자기 호출을 스스로 기록할 수 있어서 이 공백이 닫힌다 |

## 2. 세 층

| 층 | 무엇 | 외주화 | 이유 |
|---|---|---|---|
| **권위** | 사법부 판정, 관문·봉인, 서기 쓰기, 증명 도장, 사전 등록, 가정·사전 원장 추가, 결함 태그 선택, 규칙 변경 | **안 함** | 이것이 시스템의 신뢰 그 자체다. 밖에 주면 "검사하는 쪽"이 사라진다 |
| **순수 계산** | 컴파일, 엔진 실행, 앙상블·스윕, 보고서 렌더 | **가능** (서비스로) | 결정론이라 안쪽이 표본을 다시 돌려 비트로 대조할 수 있다(post-build §1 ④: 바이트가 아니라 IR + seed) |
| **생산** | 문헌 검색, 전문 받기, 후보 수집, 초안(시나리오·패치·영어 사전), 적대적 검토, 외부 도구 재현 | **함** | 결과가 모두 "후보"다. 문 셋 중 하나를 지나야 들어온다 |

## 3. 외주화 지도

| 일 | 맡길 곳 | 들어오는 문 | 안쪽 확인 |
|---|---|---|---|
| **전문 받기** | 전문 에이전트(사용자가 만듦, §5) | 수신함 | 수신함 sha256 · 받기 기록 · 인용–전문 자동 대조(§6 ①) |
| 문헌 검색·후보 수집 | 수집가(싼 모델) | 핸드오프 `.jsonl` | `verify-collection`(구조·출처·근거 없는 값) → 통합가가 1차 출처로 재확인 |
| 정성 관찰 후보 | 수집가 | 핸드오프 | 인용이 수신함 원문과 글자 그대로 같은지(지금 초록, §6 ① 뒤 전문) |
| 외부 DB 원본(UniProt·ChEBI·Rhea·BRENDA) | 받기 고리 `augment plan → fetch` | 수신함 | 신원 판정(`judicial/identity.js`) · 도장 |
| 시나리오 초안 | 수집가·초안 에이전트 | 핸드오프(초안) | 가정은 번호로만(49) · `register` 구조 판정 · 첫 장면 기원 |
| 영어 사전 초안 | 번역 에이전트 | `dictionary add` | `dictionary_audit`(렌더 모호·xref) |
| 패치 초안 | 저장소를 읽는 에이전트만 | 관문 | `validate` · `patchPolicy` · 정제 점검. 저장소 밖 AI 에게는 맡기지 않는다(PROMPTS §3) |
| 적대적 검토 | 다른 AI | 대화 → 거부 시험 | 결론은 주지 않고 코드만 준다(PROMPTS §3) |
| 대량 실행(앙상블·스윕·입력 귀속) | 계산 서비스 | 원자료(해시 붙음) | 표본을 다시 돌려 비트 대조 · 사법부 감사 |
| 외부 재현(38, SBML·SED-ML) | 외부 도구(COPASI 등) | 보고서 | 같은 궤적이 나오는지 사법부가 대조 |
| **판정·쓰기·결함 태그·규칙** | — | — | 안에 둔다 |

## 4. MCP 분리

### 4.1 두 묶음, 시기가 다르다

post-build §1 은 MCP 분해를 "적분장(27–37) 이후"로 두었다. 그 문서가 다룬 것은 **계산 쪽**(엔진·컴파일러·검증기)이다. **수집 쪽**은 엔진 솔기와 무관하고 지금 병목이므로 먼저 한다.

| 묶음 | 시기 | 서버 |
|---|---|---|
| **수집 쪽** | **지금** | `fetch` · `query` · `handoff` |
| 통합가 전용 | 수집 쪽과 함께, 권한 분리 | `integrate` |
| 계산 쪽 | 엔진 경계(56) 뒤, 본격 분해는 27–37 뒤 | `compile` · `run` · `verify` · `report` |

### 4.2 수집 쪽 서버

| 서버 | 도구 | 하는 일 | 쓰기 |
|---|---|---|---|
| `fetch` | `resolve_access(pmid)` · `fetch_fulltext(pmcid)` · `fetch_abstract(pmid)` · `fetch_record(db, id)` | 공개 여부 판정(OA·PMC 무료 열람·유료) → 공개 전문은 원본 XML 을 수신함에, 그 밖은 받지 않고 상태만 | 서기 `fetchToInbox`(증거 구역)만. **받기 기록**(URL·시각·HTTP 상태·sha256)을 도구가 남긴다 |
| `query` | `map` · `context` · `mechanism` · `limitations` · `coverage` · `origin` · `assume_uses` · `qualgraph` | 읽기 전용 조회 — 지금 dbtool 명령을 JSON 으로 | 없음 |
| `handoff` | `submit_candidates(jsonl)` · `audit(handoff)` | 후보를 핸드오프에 붙이고 `verify-collection` 판정을 돌려준다 | `workspace/handoff/` 만 |

### 4.3 통합가 전용 (권한으로 막음)

`integrate` 서버: `apply_patch` · `register` · `assume_add` · `dictionary_add` · `attest`. 수집 쪽 에이전트의 설정에는 **이 서버가 아예 없다** — 신뢰가 아니라 구조로 막는다(PROMPTS §3′ B 의 설정 거부와 같은 생각). 통합가가 1차 출처 재확인을 끝낸 것만 이 서버로 들어간다.

### 4.4 지금 명령의 분류

| 분류 | 명령 |
|---|---|
| 읽기 (→ `query`) | status · map · audit · vocab · context · mechanism · pattern · resolution · grade · origin · qualgraph · retraction · evidence · limitations(--check·--detect·--coverage) · assume · assume uses · dictionary · log · prompt · report · textbook --check |
| 결정론 계산 (→ 나중에 `run`·`verify`) | simulate · fate · observe · compare · audit-run · augment build · verify-collection · verify-run |
| 받기 (→ `fetch`) | augment fetch |
| 권위 쓰기 (→ `integrate`) | merge · augment apply · register · assume add · dictionary add · attest · trend --write · limitations --write · textbook --write |

### 4.5 계산 쪽 서버의 전제 (지금 막힌 것)

post-build §1 의 네 제약(굵은 솔기만 · 데이터 중력 · 내부 stdio · 바이트 대신 해시) 그대로다. 그 전에 **엔진 경계(56)** 를 고쳐야 한다 — 지금 운명 엔진은 IR 을 못 받으면 스스로 조립하고 db 를 읽는다. 이대로 `run` 서버로 떼면 엔진이 db 전체를 받아야 해서 "IR 만 주고받는다"가 깨진다.

## 5. 전문 에이전트 명세 (사용자가 만들 것)

| 항목 | 내용 |
|---|---|
| 입력 | 과제 목록: PMID(또는 PMCID) · 무엇을 찾나(한계 L… 의 needs, 측정량·단위·종·세포) |
| 1. 공개 여부 | Europe PMC 조회 — `isOpenAccess`·`inPMC`·`pmcid` |
| 2. 공개 전문(OA=Y) | `fullTextXML` 원본을 수신함 `data/fetched/europepmc/PMC-<id>.xml` 에 (서기 받기 고리) |
| 3. PMC 무료 열람(OA=N, inPMC=Y) | **본문을 저장하지 않는다**(저작권). 읽고 찾은 문장만 인용으로, 원본은 sha256 만 |
| 4. 유료 | 받지 않는다. `RETRIEVAL_TASKS.md` 후보로 남겨 사람이 받아 올린다. **로그인이 필요한 곳(학교 계정 등)은 쓰지 않는다** |
| 출력 | 핸드오프 `.jsonl` 후보 — 값·단위·종·세포·불확도·반복 수 · 출처(PMID·PMCID) · **원문 인용 + 위치**(XML 절·표·그림 번호) · 접근 상태(OA·free·paywalled) · 받기 기록 |
| 금지 | db·원장·패치 쓰기 · 커밋 · 값 추정·환산(원문 숫자 그대로) · 그림에서 눈으로 읽은 값을 원문 숫자로 적기(적으면 "그림 전사"로 표시) |
| 성공 판정 | 에이전트의 보고가 아니라 **수신함 파일 + 받기 기록 + 인용–전문 자동 대조** |

## 6. 우리 쪽이 지금 할 일 (받는 쪽)

| # | 일 | 왜 | 끝나는 조건 |
|---|---|---|---|
| ① | **전문 수신함 형식 + 인용–전문 자동 대조** | 에이전트 출력이 들어올 자리. work-verification "#5 내용 진실"(인용이 원문에 있나)이 전문이 없어 미구현이었다 | `PMC-<id>.xml` 형식 · `verify-collection` 이 인용을 전문 본문(태그 제거·공백 정규화)과 대조 — 없으면 REJECTED, 전문 없음이면 REVIEW · 거부 시험 |
| ② | **정량 판정의 맥락 이전 표시** | 전문에서 나올 값은 대부분 생쥐 세포다. 정성 경로에만 있고 정량 경로(`observeFate`)에는 없다 | 정량 판정에 `context_transfer` · 시험 |
| ③ | 받기 기록 형식 | 도구가 쓰는 실행 기록(work-verification #10) | 수신함 옆 `data/fetched/<원천>/FETCH_LOG.jsonl`(추가 전용 사슬) · 사법부 대조 |

**보류(사용자 결정 2026-10-23)**: 7부의 50(판정 원장)·51(입력 귀속)·52(측정법)·53(원인 분류)·54–57, 종 정책(가·나·다), 시계열 측정 유형. 전문 고리가 생긴 뒤 다시 연다. 다시 열 때 순서는 종 정책 → 시계열 → 52 → 50·51 을 추천한다(정량 후보가 실제로 들어오기 시작하면 이 순서로 막히기 때문이다).

## 7. 열린 것

- **종 정책**: 생쥐 측정을 검증용으로 허용하고 맥락 이전을 표시할지(추천 (나)) — ② 가 그 전제다.
- MCP 서버 구현 자리 — 저장소 안(`mcp/`)에 둘지, 사용자가 만드는 에이전트 쪽에 둘지. 권위 서버(`integrate`)는 반드시 저장소 안이다.
- 외부 계산 서비스의 비용과 위치 — post-build §1 ②(데이터 중력)에 따라 엔진·컴파일러·검증기는 함께 둔다.
