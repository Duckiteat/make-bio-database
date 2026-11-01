# PLAN-016a — 사전·번역기 (표현 층 1급화)

> 생성물 — 원본 `rebuild/state/plans.jsonl` · `rebuild/state/plan-log.jsonl` 에서 (`node rebuild/status.mjs --write`). 손으로 고치지 않는다 — 바꾸려면 `node rebuild/plan.mjs apply`. 계획: [구현 계획 — 검증 · 저장 · 적분 엔진 (작업 단위 목록)](../build.md) · [순서](../ORDER.md)

- **계획 · 부**: build 16A · 2부 — 보고서 · 저장 확장
- **작업**: **사전·번역기 (표현 층 1급화)** — 흩어진 사전(`vocab.js`)·번역기(`core.js`)·뷰(`viewer.html`)를 하나의 검증된 사전 + 단일 번역기로 승격. 두 레지스터(R1 통제어=조회 번역·R2 추론 서술=원문 통과), **번역기는 lookup 하지 infer 하지 않음**. 사전 항목 `{key(영어 불변)·label_en/ko·meaning_en/ko·xref·aliases·since}`, 언어 정책(중심부 영어=외부 온톨로지 대조로 검증, 서술은 한글/병기). 권위는 정준 텍스트(사전=자체 JSONL 후보), SQL 은 파생(16). 가 스키마·보고서 렌더러(12)가 이 위에 얹힘. 설계: `dictionary-and-translation.md`
- **자리**: `vocab.js` · `core.js` · `viewer.html`=`index.html` · `dbtool.mjs` · `schemas/`
- **끝나는 조건**: R1 왕복(기계→사람→기계 동일) · R2 통과(바이트 동일, 생성 아님) · 미등록 토큰 거부 픽스처 · 이관은 점진(일괄 금지)
- **상태**: ◐ 진행 2026-10-16

## 결과 (날짜별)

- `2026-10-16` `e1c7869`: 설계 확정(B) → **1단계 뼈대 착수(A)**: `dictionary.js`(조회·렌더·번역, 읽기 전용) + `data/dictionary.jsonl`(gap 타입 8 씨앗, en 라벨·의미·xref) + `tests/dictionary.test.mjs` 방어 4종(R1 왕복·R2 통과·미등록 거부·병합 형태). vocab(ko 권위)+overlay(en) 병합, 공유 기계 불변. **남음: 입법 구역·sha 봉인 배선 · 통제 토큰 register 확장(faultChannels·observables·expect) · core.js 질의 표현기 통합 · 가 스키마 구조 필드 · 영속 색인(문턱) · CLI/뷰어 표면.**

  <details><summary>고쳐 쓰기 전 글</summary>

설계 확정(B) — 코드 착수 전

</details>
- `2026-10-23` `6ff12c8`: <br>2026-10-23 ②: register 확장 — 닫는 방법(`closureMethods`)·판정 수준(`judgmentLevels`)을 vocab 통제 토큰 + en overlay 로, 증거 보고서가 문구를 사전에서 조회하고 판정 결과에 토큰 키를 싣는다. **faultChannels 보류**: 표가 `judicial/fault.js` 에 있어, core.js 질의 표현기를 사전 뒤로 모으면 행정→사법 우회로가 생김 — 표를 vocab 으로 옮길지(사법 규칙 변경) 결정 필요
- `2026-10-23` `2532ef8`: <br>2026-10-23 ③: **표·로직 분리**(사용자 결정 A) — 토큰 → 사람말 표 13개(결함 채널 포함)를 vocab 으로, 모듈은 보기만. 사전 신원을 register/key 로(키 충돌 match). 사전은 vocab 만 읽음(governance ⑮) → core.js 통합의 장애 제거. **남음: core.js 질의 표현기 통합 · 입법 구역·sha 봉인 · 가 스키마 구조 필드 · CLI/뷰어 표면**
- `2026-10-23` `ed3aac2`: <br>2026-10-23 ④: **core.js 질의 표현기 통합** — 번역 함수 4개가 라벨러를 주입받음(기본 vocab 한글, 뷰어 불변), CLI `--audience en\|both` 가 사전 라벨러 주입, 영어 없는 토큰은 '[en 미등록]'. **남음: 입법 구역·sha 봉인 · 가 스키마 구조 필드 · 뷰어 청중 · 외부 대조 필요한 표(종·위치·세포·조직)의 overlay**
- `2026-10-23` `83b0fad`: <br>2026-10-23 ⑤: **사전 봉인** — `data/dictionary.jsonl` 을 추가만 하는 사슬로(변환 011, 109 사건), 새 항목은 `judicial/dictionary_audit` 통과 + 봉인 → 서기만, 고치기는 revises, validate 가 사슬·덮임 판정. **남음: 가 스키마 구조 필드 · 뷰어 청중 · 외부 대조 필요한 표의 overlay**
- `2026-10-23` `7cee50f`: <br>2026-10-23 ⑥: **가 스키마** — 한계에 symptom·downstream_blocked·resolution_trigger·prohibited_bypasses(저장만), 재검토 후보는 `--detect` 의 별도 절(관문 불간섭), 첫 적용 L000113. **남음: 뷰어 청중 · 외부 대조 필요한 표(종·위치·세포·조직)의 overlay · 기존 한계에 구조 필드 채우기(닿을 때, 일괄 금지)**

## 걸어온 길

- `2026-10-16` `2de0ac0` 계획에 들어옴 (☐ 대기) — 사전·번역기 설계 확정 (표현 층 1급화, build-plan 16A)
- `2026-10-16` `e1c7869` 상태 ☐ 2026-10-16 → ◐ 2026-10-16 — 사전·번역기 1단계 뼈대 (build-plan 16A, A)
- `2026-10-16` `e1c7869` 결과 고쳐 씀 — 사전·번역기 1단계 뼈대 (build-plan 16A, A)
- `2026-10-23` `6ff12c8` 결과 덧붙음 — 16A 사전 — 닫는 방법·판정 수준을 통제 토큰으로, 보고서가 사전 조회
- `2026-10-23` `2532ef8` 결과 덧붙음 — 16A 표·로직 분리 — 사람말 표를 vocab 으로, 사전 이름공간
- `2026-10-23` `ed3aac2` 결과 덧붙음 — 16A core.js 번역 함수 — 라벨러 주입 (--audience)
- `2026-10-23` `83b0fad` 결과 덧붙음 — 16A 사전 봉인 — 추가만 하는 사슬 + 사법부 검사 + 서기 쓰기
- `2026-10-23` `7cee50f` 결과 덧붙음 — 16A 가 스키마 — 한계 구조 필드 + 재검토 후보

## 닿는 결정

- [DEC-0004](../decisions/DEC-0004.md) 2026-10-15 북극성 — 살아 있는 생명체의 기전 연구, 자원 먼저 장 나중
- [DEC-0007](../decisions/DEC-0007.md) 2026-10-16 보존 분류를 기저 데이터로 — 범용 BigInt 고정소수점은 반려
- [DEC-0029](../decisions/DEC-0029.md) 2026-10-22 우선순위 — 데이터 먼저 · 공간 관찰이 공간 엔진보다 먼저 · 2부는 가독성·검증부터
