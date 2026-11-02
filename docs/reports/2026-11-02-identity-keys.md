# 인식키 배정표 — 자리와 작업마다 어떤 열쇠를 쥐어 주나 (2026-11-02, 초안)

> STG-12(자리별 담당과 권한 재검토)의 첫 단계 — 저장소의 자리 189 곳 전부와 쓰는 작업 23 가지에 열쇠를 배정한 **초안**이다. 결정은 사용자가 한다.
> 바탕: `docs/reports/2026-11-02-write-ownership.md`(등급 L0–L6 · 이름 붙은 구역 · 인식키 · L5 두 열쇠). 근거 자료: 저장 지도의 writer 칸, 서기 함수와 그 구역, 그 함수를 부르는 코드(정적 검색), 명령 장부(모드별 명령), 문지기 모드 쓰기 자리.
> 칸: 범위 · 이유 · 영향 · 확인.

## 1. 한눈에

| 범위 | 이유 | 영향 | 확인 |
|---|---|---|---|
| 자리 189 → 등급 7 · 구역 39 · 열쇠 약 50 | 위치마다 담당 하나, 고유 권한(사용자 제안) | L6 11 · L5 10 · L4 8 · L3 13 · L2 144 · L1 3 | 부록 A(자리 전부) |
| 열쇠는 네 갈래: **세션**(AI 손 쓰기) · **판정**(사법부) · **기록**(서기 담당) · **도구·생성기**(기록 열쇠를 빌려 씀) | 판단과 기록을 가르기 위해 | L5 는 판정 열쇠 + 기록 열쇠 둘이 다 있어야 | §2 · §4 |
| 열쇠 = 모듈 경로 + 진입점 + 그 코드의 해시 (예: `dbtool.mjs#merge` @ sha256) | 이름만이면 아무 코드나 댈 수 있음 · 파일 하나가 여러 일을 함 | 코드가 바뀌면 해시가 바뀌어 기록에서 드러남(도장의 issuer 와 같은 꼴) | §5 |
| 빈틈 11 (그중 바로 고칠 것 1: 없앤 `rebuild/draft/**` 권한이 남음) | 표를 만들며 찾음 | §6 | 장부 · 코드 원문 |

## 2. 열쇠 목록

| 갈래 | 열쇠 | 무엇 | 지금 그 일을 하는 코드 |
|---|---|---|---|
| 세션 | `session:author` · `session:collector` · `session:baseline` · `session:develop` · `session:field` · `session:inspect` | AI 가 손으로 쓰는 자리(문지기) — 모드 하나 | `rebuild/rules/modes.json` gate |
| 세션 | `human` | 사용자 — L6 와 권한 · 형식 변환 승인 | — |
| 판정 | `judicial.gate` | 병합 관문 봉인 | `judicial/judicial.js#gate` |
| 판정 | `judicial.validate` | 저장소 검증(형식 변환 뒤 등) | `judicial/judicial.js#validate` |
| 판정 | `judicial.protocol` · `judicial.dictionary_audit` · `judicial.assay_audit` · `judicial.assumption_audit` | 추가 전용 장부마다 제안 검사 · 봉인 | `judicial/protocol.js` · `dictionary_audit.js` · `assay_audit.js` · `assumption_audit.js` |
| 판정 | `judicial.attest` · `judicial.acceptance` · `judicial.trend` | 증명 · 승인 · 추세 도장 발급 | `judicial/attestation.js` · `identity.js` · `acceptance.js` · `trend.js` |
| 판정 | `judicial.transition_audit` | 전환 기록 검사 | `judicial/transition_audit.js` |
| 판정 | `rules.check` · `state.check` · `status --check` · `textbook --check` | 장부 · 계획 · 생성물이 맞는지 | `rebuild/rules.mjs` · `state.mjs` · `status.mjs` · `dbtool.mjs` |
| 기록 | `clerk.merge` | db · 패치 · 델타 기록 (병합 · 첫 봉인) | `clerk.mjs` commitMerge · sealGenesis |
| 기록 | `clerk.migration` | 형식 변환 | commitMigration |
| 기록 | `clerk.prereg` · `clerk.dictionary` · `clerk.assays` · `clerk.assumptions` | 추가 전용 장부마다 | registerPrereg · appendDictionary · appendAssays · appendAssumptions |
| 기록 | `clerk.attest` | 도장 등록부 | appendAttestations |
| 기록 | `clerk.fetch` | 원본 수신함 · 받기 기록 · 받기 할 일 | fetchToInbox · postToInbox · appendFetchLog · writeRetrievalTasks |
| 기록 | `clerk.handoff` · `clerk.transition` | 수집 후보 · 전환 기록 | appendHandoff · appendTransition |
| 기록 | `clerk.ledger` · `clerk.state` | 규칙 장부 · 계획 기록 | writeLedger · writeState |
| 기록 | `clerk.gen` · `clerk.derived` | 관리 · 계획 · 중심 문서 / 교과서 부록 · 한계 문서 · CHANGES 행 | writeStatus · writePlanFile · writeHubDoc / writeDerived · insertChangesRow |
| 기록 | `clerk.report` · `clerk.receipt` · `clerk.draft` | 보고서 · 영수증 · 저장소 밖 초안 | writeReport · appendReceipt · publishReceipt · writeReceiptDoc · writeDraft · writeDraftText |
| 도구 | `tool.rules` → `clerk.ledger` · `clerk.draft` | 규칙 장부 고치기 · 규칙 한 번에 | `rebuild/rules.mjs` |
| 도구 | `tool.plan` → `clerk.state` | 계획 고치기 | `rebuild/plan.mjs` |
| 도구 | `tool.probe` → `tool.rules` · `tool.plan` · `clerk.draft` | 탐침 고치기(이동만) | `rebuild/probe.mjs` |
| 도구 | `tool.regen` → `gen.textbook` · `gen.status` | 생성 문서 한 번에 | `rebuild/regen.mjs` |
| 도구 | `tool.permissions` (읽기만) | 설정 ↔ 권한 장부 대조 | `rebuild/permissions.mjs` |
| 생성기 | `gen.status` → `clerk.gen` · `gen.textbook` · `gen.limitations` → `clerk.derived` · `gen.retrieval` → `clerk.fetch` · `gen.build` | 생성물마다 | `rebuild/status.mjs` · `render.mjs` · `dbtool.mjs#textbook` · `#limitations` · `#augment plan` · `engine/rust/build.sh` |
| 지키는 장치 | `gate` → `clerk.receipt` · `clerk.draft` | 문지기 · 영수증 | `rebuild/gate.mjs` |
| 명령 | `dbtool.mjs#<명령>` · `mcp#<도구>` | 한 파일의 명령마다 따로 — 아래 §5 | `dbtool.mjs` · `mcp/clerk.mjs` |

## 3. 구역 39 — 등급 · 열쇠 · 규칙

| 등급 | 구역 | 자리 수 | 쓰는 열쇠 | 판정 열쇠 | 요청할 수 있는 이 | 지킬 규칙 |
|---|---|---|---|---|---|---|
| L6 | `guard:gate` | 1 | human | — | 사용자 | 자기 검사 장치 — 장부로도 못 엶 |
| L6 | `guard:receipts` | 1 | gate | — | — (훅이 자동) | 사슬로 덧붙이기만 · 손으로 고치면 문지기가 막음 |
| L6 | `guard:self-tests` | 8 | session:develop | human(바꿀 때마다 확인) | 사용자 요청 develop | 느슨하게 고치지 않음 — 바꿀 때마다 사람 확인 |
| L6 | `guard:settings` | 1 | human | tool.permissions(대조) | 사용자 | 권한 장부와 같아야(RULE-0521) |
| L5 | `attest:registry` | 1 | clerk.attest | judicial.attest · judicial.acceptance | session:inspect (dbtool attest · accept · trend) | 도장마다 digest · 증거 재확인 |
| L5 | `data:assays` | 1 | clerk.assays | judicial.assay_audit | session:author (dbtool assay add) | 추가만 · 사슬 · 봉인 |
| L5 | `data:assumptions` | 1 | clerk.assumptions | judicial.assumption_audit | session:author · baseline (dbtool assume) | 추가만 · 봉인 |
| L5 | `data:db` | 3 | clerk.merge | judicial.gate | session:author (dbtool merge · mcp merge · augment) | 관문 봉인과 같은 db 일 때만 · 패치 기록 · 델타 사슬 |
| L5 | `data:dictionary` | 1 | clerk.dictionary | judicial.dictionary_audit | session:develop (dbtool dictionary) | 추가만 · 봉인 |
| L5 | `data:prereg` | 1 | clerk.prereg | judicial.protocol | session:baseline (dbtool register) | 추가만 · 봉인 |
| L5 | `evidence:fetched` | 2 | clerk.fetch | (판정 없음 — 받은 그대로 + 받기 기록 사슬) | session:author (augment fetch · mcp fetch_*) | 원본 그대로 · FETCH_LOG 사슬 |
| L4 | `ledger:changes` | 1 | session:<모드> (+ dbtool insertChangesRow) | (없음) | 코드를 바꾼 모드 | 맨 위 한 행 · 행을 고치거나 지우지 않음 — 지금은 기계 검사 없음 |
| L4 | `ledger:plan` | 1 | tool.plan | state.check | 모든 모드 | 변경 묶음 · 왜 · 걸어온 길은 덧붙이기만 |
| L4 | `ledger:rebuild-history` | 3 | (없음 — 재건 때 만든 기록) | rebuild 시험 | develop | 분류 장부 · 은퇴 기록 — 고치지 않음 |
| L4 | `ledger:rules` | 1 | tool.rules | rules.check | session:develop · inspect | 변경 묶음 · 왜 · 봉인(RULE-0519) |
| L4 | `ledger:storage-map` | 1 | (없음 — 지금 손) | textbook --check | develop | 새 파일마다 분류 · 담당 칸(재검토 뒤) |
| L4 | `ledger:transitions` | 1 | clerk.transition | judicial.transition_audit | 모든 모드 (dbtool transition) | 추가만 · 검사 통과 |
| L3 | `gen:build` | 3 | gen.build (build.sh) | — | develop · field | 빌드 산출물 |
| L3 | `gen:derived` | 2 | gen.retrieval | — | session:author | 생성물 |
| L3 | `gen:hub` | 3 | gen.status (render) | status --check | — (생성기) | 장부에서 생성 |
| L3 | `gen:status` | 4 | gen.status | status --check | — (생성기) | 손으로 고치지 않음 |
| L3 | `gen:textbook` | 1 | gen.textbook | textbook --check | session:author · develop (regen) | 생성물 — 쓰기는 확인(ask) |
| L2 | `code:compiler` | 7 | session:develop | — | develop | 시험 |
| L2 | `code:config` | 2 | session:develop | — | develop | 시험 |
| L2 | `code:core` | 6 | session:develop | — | develop | 시험 · 형식이면 SCHEMA |
| L2 | `code:engine` | 15 | session:develop · field | — | develop · field | 행정부 순수 — governance ② · 시험 |
| L2 | `code:judicial` | 30 | session:develop | — | develop | 사법부는 쓰지·실행하지 않음 — governance ③ |
| L2 | `code:legislative` | 3 | session:develop | — | develop | 쓰기 코드는 서기만 — governance ① |
| L2 | `code:mcp` | 4 | session:develop | — | develop | 시험 |
| L2 | `code:migration` | 3 | session:develop | human(형식 변환 승인) · judicial.validate | 사용자 요청 develop | 변환은 서기 commitMigration 이 봉인과 함께 |
| L2 | `code:schema` | 2 | session:develop · field | — | develop · field(ffi) | 계약 — 시험 |
| L2 | `code:tests` | 41 | session:develop · field | — | develop · field | 래칫(FLOOR) 내리지 않음 |
| L2 | `code:tools` | 15 | session:develop | — | develop | 시험 |
| L2 | `doc:history` | 3 | human | — | 사용자 | 이력 — 고치지 않음 |
| L2 | `doc:report` | 1 | session:<모드> | — | author · baseline · inspect · develop(지금 전부) | 쓴 뒤 고치지 않음(이력) — 지금은 기계 검사 없음 |
| L2 | `doc:scenario` | 4 | session:baseline · develop | — | baseline · field · develop | 합성 예시는 여기만(RULE-0112) |
| L2 | `doc:spec` | 8 | session:develop · field | — | develop · field | 분류된 줄은 이어 쓰기 |
| L1 | `handoff` | 1 | clerk.handoff | (통합가가 1차 출처로 재확인) | session:collector · author | 후보 — 추가만, 사실 아님 |
| L1 | `work:<모드> (지금 없음 — 공용)` | 2 | session:<모드> | — | 모드마다 따로(재검토 뒤) | 작업 기록 — 사실 아님 |

## 4. 작업 23 — 요청 · 판정 · 기록 열쇠

| # | 작업 | 요청 열쇠 | 판정 열쇠 | 기록 열쇠 | 구역 |
|---|---|---|---|---|---|
| 1 | 패치 병합 | `session:author` (`dbtool.mjs#merge` · `mcp#merge`) | `judicial.gate` (봉인) | `clerk.merge` | L5 `data:db` |
| 2 | 자동 보강 적용 | `session:author` (`#augment apply`) | `judicial.gate` | `clerk.merge` (+ 받기는 `clerk.fetch`) | L5 `data:db` |
| 3 | 형식 변환 | `human` 승인 + `session:develop` | `judicial.validate` | `clerk.migration` | L5 `data:db` |
| 4 | 사전 등록 | `session:baseline` (`#register`) | `judicial.protocol` | `clerk.prereg` | L5 `data:prereg` |
| 5 | 사전 항목 | `session:develop` (`#dictionary`) | `judicial.dictionary_audit` | `clerk.dictionary` | L5 `data:dictionary` |
| 6 | 측정법 추가 | `session:author` (`#assay add`) | `judicial.assay_audit` | `clerk.assays` | L5 `data:assays` |
| 7 | 가정 추가 | `session:author` · `baseline` (`#assume`) | `judicial.assumption_audit` | `clerk.assumptions` | L5 `data:assumptions` |
| 8 | 증명 도장 | `session:inspect` (`#attest`) | `judicial.attest` | `clerk.attest` | L5 `attest:registry` |
| 9 | 승인 도장 | `session:inspect` + `human`(통합가) (`#accept`) | `judicial.acceptance` | `clerk.attest` | L5 `attest:registry` |
| 10 | 추세 도장 | `session:inspect` · `author` (`#trend`) | `judicial.trend` | `clerk.attest` (+ `clerk.fetch`) | L5 `attest:registry` |
| 11 | 원본 받기 | `session:author` (`#augment fetch` · `mcp#fetch_*`) | 없음 — 받은 그대로 + 받기 기록 사슬 | `clerk.fetch` | L5 `evidence:fetched` |
| 12 | 수집 후보 | `session:collector` (`mcp#put_handoff`) | 통합가가 1차 출처로 재확인 | `clerk.handoff` | L1 `handoff` |
| 13 | 전환 기록 | 모든 세션 (`#transition`) | `judicial.transition_audit` | `clerk.transition` | L4 `ledger:transitions` |
| 14 | 규칙 장부 | `session:develop` · `inspect` | `rules.check` (+ 변이 — 규칙 한 번에) | `tool.rules` → `clerk.ledger` | L4 `ledger:rules` |
| 15 | 계획 | 모든 세션 | `state.check` | `tool.plan` → `clerk.state` | L4 `ledger:plan` |
| 16 | 권한 바꾸기 | `human` 결정 | `tool.permissions` 대조 · `rules.check` | `tool.rules` (권한 장부) + `human` 이 설정 | L4 `ledger:rules` · L6 `guard:settings` |
| 17 | 저장 지도 분류 | `session:develop` | `textbook --check` | 없음 — 지금 손 (새 `tool.storage-map` 필요) | L4 `ledger:storage-map` |
| 18 | CHANGES 한 행 | 코드를 바꾼 세션 | 없음 | 손 · `clerk.derived`(insertChangesRow) | L4 `ledger:changes` |
| 19 | 생성 문서 | `tool.regen` · 각 명령 | `status --check` · `textbook --check` | `gen.*` → `clerk.gen` · `clerk.derived` | L3 `gen:*` |
| 20 | 보고서 | 각 세션 | 없음 | 손 · `clerk.report` | L2 `doc:report` |
| 21 | 코드 · 시험 고치기 | `session:develop` (사용자 요청) · `field`(engine · tests) | finish 시험 + 커밋 문(문지기) | 손 | L2 `code:*` |
| 22 | 넘김 문서 · 작업 메모 | 각 세션 | 없음 | 손 | L1 `work:<모드>` (새) |
| 23 | 영수증 | `gate` (훅) | 사슬 | `clerk.receipt` | L6 `guard:receipts` |

## 5. 열쇠의 모양과 검증

| 범위 | 이유 | 영향 | 확인 |
|---|---|---|---|
| **열쇠 = 모듈 경로 + 진입점 + 코드 sha256** | `dbtool.mjs` 한 파일이 서기 쓰기 함수 14 개를 부른다(병합 · 도장 · 받기 · 생성물 …). 파일 단위 열쇠면 dbtool 이 모든 열쇠를 쥔다 | 명령마다 열쇠: `dbtool.mjs#merge` · `#attest` · `#accept` … `mcp/clerk.mjs` 도구도 마찬가지 | 정적 검색: 진입점 안에서만 그 서기 함수를 부르는가 |
| **L5 두 열쇠** | 판정과 기록을 한 열쇠가 다 하면 스스로를 통과시킬 수 있음 | 기록 열쇠는 판정 열쇠의 봉인을 받아야만 씀(지금도 병합 · 장부 추가는 이 꼴). 원본 받기(11)만 판정 대신 받기 기록 사슬 | 봉인 없이 쓰면 서기가 거부 |
| **표 한 장** | 담당이 흩어져도 누가 무엇을 쥐는지는 한곳에 | 저장 지도에 칸(등급 · 구역 · 쓰는 열쇠 · 판정 열쇠)을 더하거나 새 장부 | 열린 질문 |
| **검증 세 겹** | 실행 중 호출자 확인은 쉽게 속음 | ① 정적 시험: 구역의 서기 함수를 부르는 코드 = 표의 열쇠 모듈 ② 기록: 쓸 때마다 열쇠 + 코드 해시를 사건에 ③ 문지기: 손 쓰기는 세션 열쇠 | 변이 시험 |
| **비밀은 쓰지 않음** | 컨테이너 안 비밀은 AI 도 읽고, 저장소에 둘 수 없음(RULE-0518) | 열쇠는 비밀이 아니라 등록된 이름 + 검증 | — |

## 6. 표를 만들며 찾은 빈틈

| # | 범위 | 이유 | 영향 | 확인 |
|---|---|---|---|---|
| G1 | **없앤 `rebuild/draft/**`가 공용 쓰기 권한에 남음** (PERM-0014 · modes.json) | 폴더는 없앴는데 권한은 그대로 — 쓰면 rebuild 시험이 거부하는 자리를 문지기는 허용 | **고침 (§9)** — 권한을 줄이는 쪽 | `rebuild/rules/permissions.jsonl:14` |
| G2 | `dbtool.mjs`가 서기 쓰기 14 가지를 부름 | 파일 하나가 여러 열쇠 | 열쇠는 명령 단위(§5) | 정적 검색 |
| G3 | CHANGES · 보고서는 "고치지 않음"인데 기계 검사가 없음 | 손 쓰기 | L4 `ledger:changes` 로 — 덧붙이기만 검사 | — |
| G4 | 저장 지도는 장부급인데 도구 · 봉인이 없음 | 탐침도 못 고침 | `tool.storage-map` | — |
| G5 | 증거 구역에 `tests/fixtures/`가 같이 있음 | 증거와 시험 고정 파일이 한 구역 | `evidence:fetched` 와 `code:tests` 로 나눔 | clerk ZONES |
| G6 | 보고서 구역은 금지 목록 방식 | 허용 목록이 아니라 넓음 | `doc:report` 허용 목록으로 | clerk ZONES |
| G7 | author 문지기 쓰기에 `attestations/**` (도장은 inspect 일) | 설정 deny 가 손 편집을 막아 실제로는 도구로만 | 문지기 표도 좁힘 | modes.json |
| G8 | 생성물 `limitations.md`가 author 손 쓰기 목록에 이름으로 | 생성물은 생성기만 | `gen:derived` 로 | modes.json |
| G9 | develop 손 쓰기 `**` (PERM-0017 ⚠) | L3 · L4 를 손으로 쓸 수 있음 | L1 · L2 로 좁힘 | 권한 장부 |
| G10 | 모드 작업 자리가 없음 | 넘김 문서가 `workspace/` 맨 위에 | `work:<모드>` | — |
| G11 | 자기 검사 시험(governance · rebuild · gate · permissions · 변이 · 추적)을 develop 이 자유롭게 고침 | 2026-11-01 에도 예외를 더함(정당했지만 확인 없이) | L6 — 바꿀 때마다 사람 확인 | git 기록 |

## 7. 결정할 것 (재검토 세션에서)

| # | 질문 | 제안 |
|---|---|---|
| 1 | 등급 일곱 · 구역 39 · 열쇠 이름이 이대로 되는가 | 이 표를 출발점으로 하나씩 |
| 2 | 표를 저장 지도에 넣나, 새 장부로 하나 | 저장 지도 넓힘 — 자리 목록이 이미 있음 |
| 3 | 열쇠를 명령 단위로 할 때 dbtool 을 나누나 | 나누지 않고 진입점 열쇠만 — 파일 쪼개기는 따로 |
| 4 | L6 자기 검사 시험은 "바꿀 때마다 사람 확인"으로 하나 | 예 — 설정 ask 와 문지기에 |
| 5 | G1 을 지금 고치나 | 예 — 권한을 줄이는 쪽, 재검토와 무관 |

## 8. 비용 — 효율은 얼마나 줄고 토큰은 얼마나 느나 (추정)

근거: 2026-10-30 ~ 11-01 세션 영수증(도구 호출 490), 지금 파일 크기, 지난 3 일 새 코드 파일 수(14). 구현 뒤 다음 세션들의 영수증으로 다시 재서 이 추정과 맞대 본다.

| 범위 | 이유 | 영향 | 확인 |
|---|---|---|---|
| **평소 작업 — 도구 호출 · 토큰 +1–3 %** | 새 파일마다 칸 넷(약 100 토큰) · 탐침 한 번에 한 줄(약 50 토큰, 하루 30 번이면 약 1.5 천) · 정적 검사 실패 세션당 1–2 번 × 약 5 호출 | 줄어드는 헤맴(이번 세션 3 건 × 약 5 호출 ≈ 15)과 상쇄되어 **거의 0 ± 3 %** | 구현 뒤 영수증 |
| **기계 시간 — 사전 검사 +1 초 이내, 쓰기마다 거의 0** | 코드 해시는 파일 셋에 0.1 초 · 정적 검사는 governance 시험과 같은 방식 | 전체 시험(약 126 초)에는 거의 영향 없음 | 사전 검사 시간 |
| **사용자 확인 몇 번** | L6 자기 검사 시험을 바꿀 때마다 확인(이번 세션 4–5 번 고침) | 토큰이 아니라 사용자 시간 | — |
| **저장 지도 119 KB → 약 136 KB (+14 %)** | 칸 넷 × 189 곳 | 전체를 읽지 않으면 토큰과 무관 | 파일 크기 |
| **한 번 드는 비용 — 이게 진짜 비용** | 재검토(결정 5 · 189 곳 확인) 세션 하나 + 구현(표 칸 · 정적 검사 · 서기 담당별 분리 · 문지기 좁히기 · 저장 지도 도구) 세션 하나–둘 | 도구 호출 약 300–500 | 계획 STG-12 |

**싸게 유지하는 조건**: ① 표를 CLAUDE.md 에 넣지 않는다(매 턴 읽혀 매 턴 수천 토큰 — "열쇠는 탐침으로" 한 줄만) ② 표 전체를 읽지 않고 탐침으로 그 자리 것만 ③ 열쇠를 외우게 하지 않는다 — 틀리면 정적 검사가 알린다.

## 9. 바로 고친 것 — G1 (2026-11-02)

| 범위 | 이유 | 영향 | 확인 |
|---|---|---|---|
| 공용 쓰기 권한에서 `rebuild/draft/**`를 거둠 — `rebuild/rules/modes.json` gate common · 권한 장부 PERM-0014(장부 도구, 이유와 봉인) | 폴더는 없앴는데 문지기는 허용하고 rebuild 시험은 거부하던 자리. 권한을 줄이는 쪽이라 재검토와 무관(사용자 결정 "수정하자 바로") | 이제 문지기도 그 자리에 쓰기를 막는다 | permissions 시험 · 전체 시험 |

## 부록 A. 자리 189 곳 전부 (초안)

> 저장 지도(`docs/textbook/storage-map.json`)의 자리마다. "지금 쓰는 이"는 저장 지도의 writer 칸 원문. 분류 규칙은 경로 패턴 — 재검토에서 하나씩 확인한다.

| 등급 | 구역 | 자리 | 쓰는 열쇠 (제안) | 판정 열쇠 (L5) | 지금 쓰는 이 |
|---|---|---|---|---|---|
| L6 | `guard:gate` | `rebuild/gate.mjs` | human | — | 사람·AI |
| L6 | `guard:receipts` | `workspace/receipts/*` | gate | — | rebuild/gate.mjs 훅만 — 세션 동안은 저장소 밖(liveRoot)에 쌓고, git commit |
| L6 | `guard:self-tests` | `tests/affected.mjs` | session:develop | human(바꿀 때마다 확인) | 사람·AI |
| L6 | `guard:self-tests` | `tests/gate.test.mjs` | session:develop | human(바꿀 때마다 확인) | 사람·AI |
| L6 | `guard:self-tests` | `tests/governance.test.mjs` | session:develop | human(바꿀 때마다 확인) | 사람·AI |
| L6 | `guard:self-tests` | `tests/mutation/run.mjs` | session:develop | human(바꿀 때마다 확인) | 사람·AI |
| L6 | `guard:self-tests` | `tests/permissions.test.mjs` | session:develop | human(바꿀 때마다 확인) | 사람·AI |
| L6 | `guard:self-tests` | `tests/rebuild.test.mjs` | session:develop | human(바꿀 때마다 확인) | 사람·AI |
| L6 | `guard:self-tests` | `tests/snapshot.mjs` | session:develop | human(바꿀 때마다 확인) | 사람·AI |
| L6 | `guard:self-tests` | `tests/trace.mjs` | session:develop | human(바꿀 때마다 확인) | 사람·AI |
| L6 | `guard:settings` | `.claude/settings.json` | human | tool.permissions(대조) | 사람·AI (사용자 요청 시) |
| L5 | `attest:registry` | `attestations/registry.json` | clerk.attest | judicial.attest · judicial.acceptance | 입법 서기만 (appendAttestations — 사법부 도장, 재검증 뒤) |
| L5 | `data:assays` | `data/assays.jsonl` | clerk.assays | judicial.assay_audit | 입법 서기 appendAssays (구역 registry) — judicial/assay_audit.js c |
| L5 | `data:assumptions` | `data/assumptions.jsonl` | clerk.assumptions | judicial.assumption_audit | 입법 서기 appendAssumptions (구역 registry) — judicial/assumption_ |
| L5 | `data:db` | `data/db.json` | clerk.merge | judicial.gate | node dbtool.mjs merge (core.js merge → gate 통과 시) |
| L5 | `data:db` | `data/log/*` | clerk.merge | judicial.gate | 입법 서기 (dbtool log --genesis 한 번, 이후 merge·augment apply 마다 추 |
| L5 | `data:db` | `data/patches/*.json` | clerk.merge | judicial.gate | node dbtool.mjs merge (--dry 가 아닐 때) |
| L5 | `data:dictionary` | `data/dictionary.jsonl` | clerk.dictionary | judicial.dictionary_audit | 입법 서기 appendDictionary (구역 registry) — judicial/dictionary_a |
| L5 | `data:prereg` | `data/preregistrations.jsonl` | clerk.prereg | judicial.protocol | 입법 서기 (node dbtool.mjs register — 규약 구조 판정 봉인 뒤, 추가만) |
| L5 | `evidence:fetched` | `data/fetched/*/*` | clerk.fetch | (판정 없음 — 받은 그대로 + 받기 기록 사슬) | 입법 서기 fetchToInbox (curl) 또는 사람(수동 수집) |
| L5 | `evidence:fetched` | `data/fetched/consensus/*/*` | clerk.fetch | (판정 없음 — 받은 그대로 + 받기 기록 사슬) | 입법 서기 fetchToInbox (dbtool trend --fetch) 또는 사람(수동 수집) |
| L4 | `ledger:changes` | `CHANGES.md` | session:<모드> (+ dbtool insertChangesRow) | (없음) | 사람·AI (코드·형식·어휘·문서 구조를 바꾸는 커밋마다 한 행) |
| L4 | `ledger:plan` | `rebuild/state/*` | tool.plan | state.check | 입법 서기 writeState 만 (rebuild/plan.mjs apply — 검사 통과 뒤). plan- |
| L4 | `ledger:rebuild-history` | `rebuild/archive/*` | (없음 — 재건 때 만든 기록) | rebuild 시험 | 재건 (사용자가 은퇴를 정할 때) |
| L4 | `ledger:rebuild-history` | `rebuild/index/*` | (없음 — 재건 때 만든 기록) | rebuild 시험 | 사람·AI (손으로, 형식 검사) |
| L4 | `ledger:rebuild-history` | `rebuild/ledger/*` | (없음 — 재건 때 만든 기록) | rebuild 시험 | 분류 작업 (PLAN §5) |
| L4 | `ledger:rules` | `rebuild/rules/*` | tool.rules | rules.check | 장부 고치기 도구 rebuild/rules.mjs apply 만 (.jsonl 여섯 — 서기 ledger 구 |
| L4 | `ledger:storage-map` | `docs/textbook/storage-map.json` | (없음 — 지금 손) | textbook --check | 사람·AI (파일을 더하거나 옮길 때 함께) |
| L4 | `ledger:transitions` | `workspace/transitions.jsonl` | clerk.transition | judicial.transition_audit | node dbtool.mjs transition <기록.json> (입법 서기 appendTransition |
| L3 | `gen:build` | `engine/rust/pkg/fate_core.wasm` | gen.build (build.sh) | — | engine/rust/build.sh |
| L3 | `gen:build` | `engine/rust/pkg/fate_core.wasm.json` | gen.build (build.sh) | — | engine/rust/build.sh |
| L3 | `gen:build` | `index.html` | gen.build (build.sh) | — | cp viewer.html index.html |
| L3 | `gen:derived` | `data/fetched/RETRIEVAL_TASKS.md` | gen.retrieval | — | 입법 서기 (node dbtool.mjs augment plan --write \| fetch) |
| L3 | `gen:derived` | `limitations.md` | gen.limitations | limitations --check | node dbtool.mjs limitations --write |
| L3 | `gen:hub` | `.claude/skills/*/SKILL.md` | gen.status (render) | status --check | rebuild/status.mjs --write (입법 서기 writeHubDoc) |
| L3 | `gen:hub` | `CLAUDE.md` | gen.status (render) | status --check | rebuild/status.mjs --write (입법 서기 writeHubDoc) — 원본 rebuild/ |
| L3 | `gen:hub` | `docs/modes/*` | gen.status (render) | status --check | rebuild/status.mjs --write (입법 서기 writeHubDoc) |
| L3 | `gen:status` | `docs/plan/*.md` | gen.status | status --check | rebuild/status.mjs --write (입법 서기 writePlanFile) — 원본 rebuil |
| L3 | `gen:status` | `docs/plan/decisions/*.md` | gen.status | status --check | rebuild/status.mjs --write (writePlanFile) |
| L3 | `gen:status` | `docs/plan/items/*.md` | gen.status | status --check | rebuild/status.mjs --write (writePlanFile) |
| L3 | `gen:status` | `rebuild/status/*` | gen.status | status --check | rebuild/status.mjs --write (입법 서기 writeStatus) |
| L3 | `gen:textbook` | `docs/textbook/90-부록-자동생성.md` | gen.textbook | textbook --check | node dbtool.mjs textbook --write |
| L2 | `code:compiler` | `compiler/assumptions.js` | session:develop | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:compiler` | `compiler/ir_builder.js` | session:develop | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:compiler` | `compiler/obs_operator.js` | session:develop | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:compiler` | `compiler/perturb.js` | session:develop | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:compiler` | `compiler/rate_ir.js` | session:develop | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:compiler` | `compiler/sparse_lu.js` | session:develop | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:compiler` | `compiler/tape.js` | session:develop | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:config` | `.github/workflows/check.yml` | session:develop | — | 사람·AI |
| L2 | `code:config` | `.gitignore` | session:develop | — | 사람·AI |
| L2 | `code:core` | `core.js` | session:develop | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:core` | `dictionary.js` | session:develop | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:core` | `inbox.js` | session:develop | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:core` | `model.js` | session:develop | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:core` | `scenarios.js` | session:develop | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:core` | `vocab.js` | session:develop | — | 사람이 검토 후 (AI 는 사용자 요청이 있을 때만) |
| L2 | `code:engine` | `engine/coupling.js` | session:develop · field | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:engine` | `engine/fate_engine.js` | session:develop · field | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:engine` | `engine/fate_rust.js` | session:develop · field | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:engine` | `engine/probe_pool.js` | session:develop · field | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:engine` | `engine/probe_worker.js` | session:develop · field | — | 사람·AI |
| L2 | `code:engine` | `engine/rng.js` | session:develop · field | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:engine` | `engine/rust/.gitignore` | session:develop · field | — | 사람·AI |
| L2 | `code:engine` | `engine/rust/Cargo.lock` | session:develop · field | — | cargo |
| L2 | `code:engine` | `engine/rust/Cargo.toml` | session:develop · field | — | 사람·AI |
| L2 | `code:engine` | `engine/rust/build.sh` | session:develop · field | — | 사람·AI |
| L2 | `code:engine` | `engine/rust/src/bin/fate_cli.rs` | session:develop · field | — | 사람·AI |
| L2 | `code:engine` | `engine/rust/src/engine.rs` | session:develop · field | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:engine` | `engine/rust/src/lib.rs` | session:develop · field | — | 사람·AI |
| L2 | `code:engine` | `engine/rust/src/rng.rs` | session:develop · field | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:engine` | `engine/rust/src/tape.rs` | session:develop · field | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:judicial` | `judicial/acceptance.js` | session:develop | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:judicial` | `judicial/assay_audit.js` | session:develop | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:judicial` | `judicial/assumption_audit.js` | session:develop | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:judicial` | `judicial/attestation.js` | session:develop | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:judicial` | `judicial/collection_audit.js` | session:develop | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:judicial` | `judicial/compare.js` | session:develop | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:judicial` | `judicial/contract.js` | session:develop | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:judicial` | `judicial/dependency.js` | session:develop | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:judicial` | `judicial/derivative.js` | session:develop | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:judicial` | `judicial/dictionary_audit.js` | session:develop | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:judicial` | `judicial/evidence_report.js` | session:develop | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:judicial` | `judicial/fate_audit.js` | session:develop | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:judicial` | `judicial/fault.js` | session:develop | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:judicial` | `judicial/identity.js` | session:develop | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:judicial` | `judicial/judicial.js` | session:develop | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:judicial` | `judicial/log_audit.js` | session:develop | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:judicial` | `judicial/obs_compare.js` | session:develop | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:judicial` | `judicial/perturb_audit.js` | session:develop | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:judicial` | `judicial/process_report.js` | session:develop | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:judicial` | `judicial/protocol.js` | session:develop | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:judicial` | `judicial/qual_compare.js` | session:develop | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:judicial` | `judicial/qual_graph.js` | session:develop | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:judicial` | `judicial/reliability.js` | session:develop | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:judicial` | `judicial/scene_origin.js` | session:develop | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:judicial` | `judicial/stats.js` | session:develop | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:judicial` | `judicial/stiffness.js` | session:develop | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:judicial` | `judicial/stoch_audit.js` | session:develop | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:judicial` | `judicial/transition_audit.js` | session:develop | — | 사람·AI (사용자 요청 시) |
| L2 | `code:judicial` | `judicial/trend.js` | session:develop | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:judicial` | `judicial/verifier.js` | session:develop | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:legislative` | `legislative/augment_draft.js` | session:develop | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:legislative` | `legislative/clerk.mjs` | session:develop | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:legislative` | `legislative/legislative.js` | session:develop | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:mcp` | `mcp/clerk.mjs` | session:develop | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:mcp` | `mcp/fetch.mjs` | session:develop | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:mcp` | `mcp/protocol.mjs` | session:develop | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:mcp` | `mcp/query.mjs` | session:develop | — | 사람·AI (사용자 요청 시, 테스트 필수) |
| L2 | `code:migration` | `migrations/*.mjs` | session:develop | human(형식 변환 승인) · judicial.validate | 형식을 올릴 때 한 번 |
| L2 | `code:migration` | `migrations/002-id-map.json` | session:develop | human(형식 변환 승인) · judicial.validate | migration 002 |
| L2 | `code:migration` | `migrations/010-v10-to-v12-values.js` | session:develop | human(형식 변환 승인) · judicial.validate | 사람·AI (형식을 바꿀 때) |
| L2 | `code:schema` | `schemas/ffi/*.schema.json` | session:develop · field | — | 사람·AI (엔진 출력 형식을 바꿀 때, 테스트 필수) |
| L2 | `code:schema` | `schemas/obs/*.schema.json` | session:develop · field | — | 사람·AI (관찰 형식을 바꿀 때, 테스트 필수) |
| L2 | `code:tests` | `tests/acceptance.test.mjs` | session:develop · field | — | 사람·AI |
| L2 | `code:tests` | `tests/affected.test.mjs` | session:develop · field | — | 사람·AI |
| L2 | `code:tests` | `tests/assays.test.mjs` | session:develop · field | — | 사람·AI |
| L2 | `code:tests` | `tests/assumptions.test.mjs` | session:develop · field | — | 사람·AI |
| L2 | `code:tests` | `tests/bench_engine.js` | session:develop · field | — | 사람·AI |
| L2 | `code:tests` | `tests/bench_index.js` | session:develop · field | — | 사람·AI |
| L2 | `code:tests` | `tests/collection_audit.test.mjs` | session:develop · field | — | 사람·AI |
| L2 | `code:tests` | `tests/conservation.test.mjs` | session:develop · field | — | 사람·AI |
| L2 | `code:tests` | `tests/dictionary.test.mjs` | session:develop · field | — | 사람·AI |
| L2 | `code:tests` | `tests/dictionary_seal.test.mjs` | session:develop · field | — | 사람·AI |
| L2 | `code:tests` | `tests/dose_slope.test.mjs` | session:develop · field | — | 사람·AI |
| L2 | `code:tests` | `tests/enforcement_gaps.test.mjs` | session:develop · field | — | 사람·AI (변이 시험이 놓친 규칙마다) |
| L2 | `code:tests` | `tests/fate_suite.js` | session:develop · field | — | 사람·AI |
| L2 | `code:tests` | `tests/fixtures/FLOOR.json` | session:develop · field | — | 사람·AI (올리는 것은 자유, 내리려면 그 커밋이 눈에 보여야 한다) |
| L2 | `code:tests` | `tests/fixtures/augment/*/*` | session:develop · field | — | 사람·AI |
| L2 | `code:tests` | `tests/fixtures/augment/README.md` | session:develop · field | — | 사람·AI |
| L2 | `code:tests` | `tests/fixtures/brenda/km-sample.xml` | session:develop · field | — | 사람·AI |
| L2 | `code:tests` | `tests/fixtures/rejections/*.json` | session:develop · field | — | 사람·AI (새 방어 규칙을 더할 때 함께) |
| L2 | `code:tests` | `tests/gap_schema.test.mjs` | session:develop · field | — | 사람·AI |
| L2 | `code:tests` | `tests/mcp.test.mjs` | session:develop · field | — | 사람·AI |
| L2 | `code:tests` | `tests/mhc.test.mjs` | session:develop · field | — | 사람·AI |
| L2 | `code:tests` | `tests/observations.test.mjs` | session:develop · field | — | 사람·AI |
| L2 | `code:tests` | `tests/perturb.test.mjs` | session:develop · field | — | 사람·AI |
| L2 | `code:tests` | `tests/probe.test.mjs` | session:develop · field | — | 사람·AI |
| L2 | `code:tests` | `tests/protocol.test.mjs` | session:develop · field | — | 사람·AI |
| L2 | `code:tests` | `tests/qual_compare.test.mjs` | session:develop · field | — | 사람·AI |
| L2 | `code:tests` | `tests/qual_graph.test.mjs` | session:develop · field | — | 사람·AI |
| L2 | `code:tests` | `tests/qualitative.test.mjs` | session:develop · field | — | 사람·AI |
| L2 | `code:tests` | `tests/real-records.json` | session:develop · field | — | 사람·AI (실제 번호가 꼭 필요할 때만, 이유와 함께) |
| L2 | `code:tests` | `tests/real_records.test.mjs` | session:develop · field | — | 사람·AI |
| L2 | `code:tests` | `tests/rejections.test.mjs` | session:develop · field | — | 사람·AI |
| L2 | `code:tests` | `tests/reliability_criteria.test.mjs` | session:develop · field | — | 사람·AI |
| L2 | `code:tests` | `tests/retraction_propagation.test.mjs` | session:develop · field | — | 사람·AI |
| L2 | `code:tests` | `tests/rules.test.mjs` | session:develop · field | — | 사람·AI (규칙을 바꿀 때 거부 테스트 추가) |
| L2 | `code:tests` | `tests/runbook.test.mjs` | session:develop · field | — | 사람·AI |
| L2 | `code:tests` | `tests/rust_engine.test.mjs` | session:develop · field | — | 사람·AI |
| L2 | `code:tests` | `tests/stats.test.mjs` | session:develop · field | — | 사람·AI |
| L2 | `code:tests` | `tests/stochastic.test.mjs` | session:develop · field | — | 사람·AI |
| L2 | `code:tests` | `tests/telomere.test.mjs` | session:develop · field | — | 사람·AI |
| L2 | `code:tests` | `tests/transitions.test.mjs` | session:develop · field | — | 사람·AI |
| L2 | `code:tests` | `tests/values.test.mjs` | session:develop · field | — | 사람·AI |
| L2 | `code:tools` | `dbtool.mjs` | session:develop | — | 사람·AI |
| L2 | `code:tools` | `orchestrator.js` | session:develop | — | 사람·AI |
| L2 | `code:tools` | `rebuild/index.mjs` | session:develop | — | 사람·AI |
| L2 | `code:tools` | `rebuild/permissions.mjs` | session:develop | — | 사람·AI |
| L2 | `code:tools` | `rebuild/plan-import.mjs` | session:develop | — | 사람·AI |
| L2 | `code:tools` | `rebuild/plan.mjs` | session:develop | — | 사람·AI |
| L2 | `code:tools` | `rebuild/precheck.mjs` | session:develop | — | 사람·AI |
| L2 | `code:tools` | `rebuild/probe.mjs` | session:develop | — | 사람·AI |
| L2 | `code:tools` | `rebuild/read.mjs` | session:develop | — | 사람·AI |
| L2 | `code:tools` | `rebuild/regen.mjs` | session:develop | — | 사람·AI |
| L2 | `code:tools` | `rebuild/render.mjs` | session:develop | — | 사람·AI |
| L2 | `code:tools` | `rebuild/rules.mjs` | session:develop | — | 사람·AI |
| L2 | `code:tools` | `rebuild/state.mjs` | session:develop | — | 사람·AI |
| L2 | `code:tools` | `rebuild/status.mjs` | session:develop | — | 사람·AI |
| L2 | `code:tools` | `viewer.html` | session:develop | — | 사람·AI |
| L2 | `doc:history` | `DESIGN-v4.md` | human | — | (동결) |
| L2 | `doc:history` | `FEATURES.md` | human | — | (대부분 동결) |
| L2 | `doc:history` | `docs/design/*.md` | human | — | 사람·AI (설계 제안) |
| L2 | `doc:report` | `docs/reports/*.md` | session:<모드> | — | 입법 서기 writeReport (구역 report) |
| L2 | `doc:scenario` | `examples/*.json` | session:baseline · develop | — | 사람·AI |
| L2 | `doc:scenario` | `examples/observations/*.json` | session:baseline · develop | — | 사람·AI |
| L2 | `doc:scenario` | `examples/scenarios/*.json` | session:baseline · develop | — | 사람·AI |
| L2 | `doc:scenario` | `examples/scenarios/subjects.json` | session:baseline · develop | — | 사람·AI (시나리오를 더할 때 같은 커밋) |
| L2 | `doc:spec` | `README.md` | session:develop · field | — | 사람·AI |
| L2 | `doc:spec` | `SCHEMA.md` | session:develop · field | — | 사람·AI (형식·규칙이 바뀔 때 + 변경 기록) |
| L2 | `doc:spec` | `data/fetched/README.md` | session:develop | — | 사람·AI |
| L2 | `doc:spec` | `docs/PROMPTS.md` | session:develop · field | — | 사람·AI |
| L2 | `doc:spec` | `docs/RUNBOOK.md` | session:develop · field | — | 사람·AI (명령·숫자가 바뀌면 같은 커밋에서) |
| L2 | `doc:spec` | `docs/design/scaling-limits.md` | session:develop · field | — | 사람·AI (측정과 함께) |
| L2 | `doc:spec` | `docs/project-overview.md` | session:develop · field | — | 사람·AI (상태가 바뀌면 같은 커밋에서) |
| L2 | `doc:spec` | `docs/textbook/*.md` | session:develop · field | — | 사람·AI (코드·형식을 바꿀 때 해당 장도) |
| L1 | `handoff` | `workspace/handoff/*` | clerk.handoff | (통합가가 1차 출처로 재확인) | 작업자(collected 행) · 통합가(검증·상태) |
| L1 | `work:<모드> (지금 없음 — 공용)` | `workspace/*` | session:<모드> | — | 작업자(Sonnet 등, workspace/ 안에서만) · 통합가(Opus/사람) |
| L1 | `work:<모드> (지금 없음 — 공용)` | `workspace/tasks/*` | session:<모드> | — | 통합가(Opus/사람) |
