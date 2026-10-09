# 삼권 분립과 격리 (Tripartite Governance & Isolation)

> 지위: 현재 아키텍처의 규칙. 이 규칙을 어기는 변경은 무결성 규약 위반으로 취급한다. 강제는 `tests/governance.test.mjs` 가 한다.

## 0. 세 권력과 공유 층

| 층 | 파일 | 권한 | 금지 |
|---|---|---|---|
| 공유 (헌법) | `vocab.js`, `model.js` | 형식·어휘·정규화·색인·참조 해석·부분 구조 셈·속도 법칙 정의(힐·SAT_K·NA·VOL)·규칙 표기 | 시뮬레이션·판정·쓰기 |
| 행정 (Executive) | `core.js`, `engine/*` | 읽기·질의·시뮬레이션. 규칙과 초기 상태의 **순수 함수** — 원자료만 낸다 | 자기 코드·db.json 수정, 파일 쓰기, 검사·승인, `'verified'` 선언, 감사 코드(`AUDIT_*`) 발행 |
| 입법 (Legislative) | `legislative/legislative.js`, `legislative/augment_draft.js`, `legislative/clerk.mjs` | 데이터 정의·수정: merge(패치 → 새 db), 패치 초안(보강·리팩터링). **파일 쓰기는 서기(clerk.mjs)만** | 스스로 검사·시뮬레이션 |
| 사법 (Judicial) | `judicial/*` | 검증·증명: validate·관문·Patch Report·정제 점검·한계 상태·감사·사후 분석·독립 질량 검증·신원 확인·증명 도장·보고서 | 데이터·엔진 수정, 엔진 실행, 파일 쓰기 |
| 조정 | `orchestrator.js`, `dbtool.mjs` | 행정 실행 → 원자료 → 사법 판정, 쓰기가 필요하면 서기 호출 | 판정·쓰기 코드를 직접 갖는 것 |

생물 논리(규칙·화학량·문턱)는 전부 데이터(`data/db.json`, 패치)에 있고 엔진은 그것을 일반 매개변수로 읽는다. 엔진 코드에 분자·위치 이름이 없다(이전 규칙 그대로).

## 1. 쓰기 권한 분리 (Legislative Clerk)

- 저장소에서 파일을 쓰는 코드는 `legislative/clerk.mjs` 와 일회성 `migrations/` 뿐이다. `dbtool.mjs` 에도 쓰기 코드가 없다.
- 서기의 쓰기는 판결에 묶인다.

| 쓰는 곳 | 조건 |
|---|---|
| `data/db.json`, `data/patches/` | 사법부 관문 봉인(`judicial/attestation.js sealVerdict`)이 통과이고, 봉인에 적힌 db sha256 이 쓰려는 db 와 같을 것. 판결을 다른 db 에 재사용할 수 없다. |
| `attestations/registry.json` | 도장마다 digest 와 증거 재확인(`verifyStamp`)을 다시 통과할 것 |
| `limitations.md`, 교과서 부록, `data/fetched/RETRIEVAL_TASKS.md`, `CHANGES.md` 한 행 | 정해진 위치에만. 내용은 다른 모듈이 계산한다. |
| 사용자가 지정한 보고서(`fate --report`) | 데이터·코드·증명 위치는 거부 |
| 패치 초안·리팩터링 제안 | 저장소 밖(임시 폴더)에만 |
| 수신함 받기(curl) | `data/fetched/` 에 원본 그대로 |

## 2. 검증 논리 격리

- **속도 시뮬레이션** (`core.simulateRate`) 이 내는 원자료:
  - 사실(`facts`), 사용한 속도 상수(`kinUsed`), 단계별 첫 발화 시각(`firstFire`)
  - 기록점마다 상태 N 과 누적 원장의 사본(`series[].ledger`)
  - 저장소 통계, 음수 관찰, 강성 비율, 끝 시점 정·역 흐름
  - 정지 관찰(창 진행량, `death`·`lastTurn`·`zeroAt`)
- **`judicial.auditRate`** 가 이 원자료로 다음을 판정한다:
  - 국소 수지(첫 발화)
  - 전역 실체·부분 구조 수지 — 기록점마다 model 의 `entityTally`·`moietyOf` 로 **독립 재계산**
  - 적분 안정성, 결합 평형
  - 자원 순환 분류, 사후 분석, 속도 상수 공백
- **운명 엔진** (`engine/fate_engine.js`) 이 내는 원자료:
  - 궤적, 기록점마다 N·LO·규칙별 누적 진행량(double-double)
  - 사건, 결정 탐침 결과, 사실
- **`judicial/verifier.js`** 는 엔진의 장부를 믿지 않고, 데이터베이스 규칙에서 화학량을 다시 세운다. 판정 항목:
  - ① 화학량 대조
  - ② 재생: (N + LO) − (N₀ + Σ S·X) = 0
  - ③ 부분 구조 원장 ≤ 1e-14 (상대)
  - ④ 규칙 밖 부분 구조
  - ⑤ 음수
- **`judicial/fate_audit.js`** 가 판결된 보기를 만든다. 들어가는 것:
  - 감사, 분화 정지, 사후 분석, 소비만 되는 저장소
  - 궤적 해시
  - 표지 거리·조절 배율(같은 법칙을 다시 계산)
- **보고서·비교**:
  - `judicial/process_report.js` 는 판결된 보기만 읽는다.
  - `judicial/compare.js` 는 조정자가 돌린 두 변형의 원자료로 판정만 한다.
- **신원 확인** (`judicial/identity.js`): 과제·해석·확인을 맡는다. 받기는 서기가, 패치 초안은 `legislative/augment_draft.js` 가 한다.

## 3. 증명 등록부 (Attestation Registry)

- `'verified'` 는 데이터의 자기 선언이 아니라 외부 도장이다.
- **도장의 필드**:
  - `subject {sense, field: xref|fingerprint, ns, value}`
  - `claim: verified`
  - `evidence {kind, key, file, sha256}`
  - `checks`
  - `issuer {module, code_sha256}`
  - `issued_at`
  - `digest = sha256(정준 JSON(나머지))`
- **검증**: 셋을 모두 통과해야 한다.
  - digest 재계산 — 변조를 잡는다.
  - 증거 파일의 sha256 일치.
  - 같은 확인 재실행 — 그 외부 ID 를 asserted 로 되돌린 사본에서 신원 판결이 verified 를 내야 한다. 위조(값을 바꾸고 digest 를 다시 계산한 도장)는 여기서 걸린다.
- **validate 와의 관계**:
  - `validate(db, { attestations })` 는 status `verified` 인 외부 ID·지문마다 유효한 도장 열쇠를 요구한다. 없으면 오류다.
  - 등록부를 넘기지 않는 호출(브라우저 보기)은 경고로 알린다.
- **흐름**: `augment apply` 순서는 다음과 같다.
  1. 판결
  2. 도장 발급
  3. 입법 초안
  4. 관문(새 도장 포함)
  5. 서기가 db·기록·등록부·CHANGES·파생 문서를 쓴다.
- **명령**: `node dbtool.mjs attest` 가 등록부 전체를 재검증한다 (CI).

## 4. 떼어 내기 (Tear-away) — 수치 결합점 등록부

- v9 엔진이 쓰는 생물 사실이 아닌 수치 선택은 `engine/coupling.js REGISTRY` 한곳에 모인다:
  - 포화 정칙화 `saturation_K`
  - `explicit_fraction`
  - 충격 문턱
  - 관문 K_up/K_down/M/W
  - 결정 탐침 horizon/coarse
  - 뉴턴 허용 오차·반복
- 엔진은 `COUPLING.resolve(scenario, params)` 의 결과만 읽는다. 해석 순서는 시나리오 → 데이터(params) → 기본값이다.
- 데이터 층으로 옮길 때는 조정자가 `simulateFate(db, id, { coupling: params })` 로 넘기면 되고, 엔진 코드는 바뀌지 않는다.
- 시험(⑥)이 엔진에 기본값이 박혀 있지 않은지 본다.

## 5. 되먹임은 읽기 전용

1. 사법부가 오류를 찾는다 — 감사·관문 거부·증명서 FAIL.
2. 보고서를 낸다 — 판결·교정 제안(텍스트)·리팩터링 초안(입법부가 판결로 쓴 임시 파일).
3. 에이전트가 읽는다.
4. 에이전트가 새 패치를 쓴다.
5. 체계가 다시 검증한다.

사법부는 엔진·데이터를 고치지 않는다(`refineCheck` 는 issues 만, 패치는 `legislative.draftRefactor`).

## 6. 문서화된 예외

- `engine/hmse.js`·`engine/devs_scheduler.js` 의 실행 전 조건 검사(잘못된 입력에 대한 예외)는 판정이 아니라 함수의 정의역 검사다. 이 검사들은 감사 코드를 내지 않는다.
- `core.mapText` 는 외부 ID 의 status 를 **표시**한다(읽기). 선언하지는 않는다.
- `viewer.html` 은 브라우저 안에서만 병합(입법 함수)하고 관문(사법 함수)을 보여 준다. 저장은 사용자가 내려받아 한다. 저장소 파일을 쓰지 않는다.
- 결정 탐침(신호 철회 시험)은 엔진 안의 실험이다. 결과는 원자료(탐침별 통과 여부·시각)이고, 판정은 보고서가 한다.
