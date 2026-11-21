# 흩어진 계획 전수 정리 — 장부 밖 문서의 "할 일 · 순서 · 정할 것" 을 모두 찾아 분류 (READ-ONLY)

> 2026-11-21 · develop 모드 · 조사와 문서화만 — 계획 장부 · 문서 · 코드는 바꾸지 않았다.
> 앞선 두 조사의 셋째: `project-management-system-audit.md`(구조) · `project-roadmap-audit.md`(계획 장부 168 작업). 이 문서는 **장부 밖** 에 적힌 계획을 다룬다.
> 표기: **[사실]** 문서 · 장부 · 코드에서 확인 · **[추론]** 분석자 판단 · **UNKNOWN** 판단 불가.

---

## 0. 한눈에

| 무엇 | 값 [사실] | 뜻 [추론] |
|---|---|---|
| 훑은 문서 | 마크다운 125 개 (생성물 `docs/plan/` · `rebuild/status/` · 영수증 · 수신함 · 기초시험 실행 결과 47 · 이 세 조사 보고서는 뺌) | |
| "앞으로 할 일" 꼴의 제목 | 227 곳 / 98 문서 (다음 · 남은 · 열린 · 제안 · 순서 · 단계 · 정할 것 · 방아쇠 · 보류 · 한계 …) | |
| 계획 장부가 이름으로 가리키는 문서 | 98 중 **50** (사건 · 전환 기록까지 치면 56) | 나머지 **42** 문서의 계획은 장부 · 전환 기록과 기계로 이어지지 않음 |
| 장부와 별개인 로드맵 · 단계표 | **7** (엔진 이식 · 적분장 단계 · 적분장 전체 순서 · 사전 단계 · 특징/가설 층 · 포스트-빌드 · 계획 정돈 제안) | 대부분 장부의 뿌리이거나 끝난 역사, 둘은 장부 밖에 살아 있음 |
| 장부 밖에만 있는 할 일 (4 장) | **34 묶음** | 장부 번호가 없거나, 번호는 있는데 이 문서들이 근거로 쓰인 것을 장부가 모름 |
| 결정 대기 (5 장) | **17 곳 · 약 40 질문** — 장부의 open 에 들어간 것은 그중 일부 | 결정 대기 목록이 문서마다 흩어짐 |
| 전환 기록의 열린 질문 | 11 기록 · **40 질문** — 처리 상태 칸 없음 | |
| 한계 등록부 | 127 · 열림 114 | 데이터 쪽 할 일의 가장 큰 목록, 계획 장부와 따로 |

가장 중요한 발견 셋 [사실]:

1. **계획 정돈 제안서(2026-11-02 `plan-triage.md`) 가 적용되지 않았다.** 순서 밖 51 작업을 "넣음 15 · 닫기 6 · 보류 21 · 사용자 결정 7" 로 나눈 제안인데, 장부 · 사건에 흔적이 없다(장부가 이 문서를 가리키지 않음, 사건 0). 51 개는 지금도 그대로 순서 밖이다.
2. **잃어버린 갱신 위험(PLAN-081)이 순서 밖에 있다.** 구조 분석(10-25 R3) · 정돈 제안 모두 "세션을 병렬로 돌리는 지금" 먼저 하라고 적었는데 대기 · 순서 없음. 지금은 여러 세션이 동시에 돌고 있다.
3. **장부에 없는 실행 계획이 문서에 살아 있다** — 수집 계층의 순서(`sabio_kinetics` 도구 → 합치기 → 인용 대조 → 이중 입력, 11-03 두 보고서), 가설 층 4–6 단계(FEATURES), 텔로미어 2 단계(10-16), 11/20–21 의 작업 조율 · D000051 세로 뚫기 결정들.

---

## 1. 찾은 방법

| 단계 | 무엇 |
|---|---|
| 범위 | `git ls-files '*.md'` 에서 생성물 · 영수증 · 수신함 · 시험 · 기초시험 실행 결과(`docs/reports/2026-11-19-baseline-sweep/` 47) · 이 조사 보고서 셋을 뺀 125 문서 |
| 찾기 | 제목(# – ####)에 계획 낱말이 든 곳 227 → 문서 98 |
| 장부 대조 | 문서 이름이 `plans.jsonl` · `plan-log.jsonl` · `transitions.jsonl` 에 나오는 횟수 (부록 A) |
| 읽기 | 그 절의 본문을 읽고, 적힌 작업이 장부의 어느 번호인지 · 그 번호의 지금 상태를 장부에서 확인 |
| 하지 않은 것 | 본문 속 문단(제목 아닌 곳)의 할 일 전부 — 제목이 없는 할 일은 빠졌을 수 있다 (12 장) |

---

## 2. 분류 틀

### 2.1 출처 일곱

| 기호 | 출처 | 예 |
|---|---|---|
| **S1** | 계획 장부 (기준) | `plans.jsonl` — 이 문서의 대조 기준 |
| **S2** | 설계 문서의 로드맵 · 단계표 · 열린 것 | `docs/design/*` · `DESIGN-v4.md` · `FEATURES.md` · `SCHEMA.md` |
| **S3** | 보고서의 제안 · 다음 · 정할 것 | `docs/reports/*` |
| **S4** | 세션 인계 | `workspace/NEXT-*` · `WORKORDER-*` · `handoff/NEXT-*` · `transitions.jsonl` · HANDOFF 리드 |
| **S5** | 미구현 · 진화 후보 목록 | `README.md` "아직 안 된 것" · 교과서 8.5 · `project-overview.md` "다음" |
| **S6** | 한계 등록부 | `db.json#limitations` → `limitations.md` (127) |
| **S7** | 의도적으로 계획 밖 | `post-build-directions.md` (DEC-0008) |

### 2.2 장부 반영 상태 다섯

| 기호 | 뜻 |
|---|---|
| **반영** | 장부 작업 · 결정 · 방향 · 열린 질문 번호가 있고 그 문서를 근거로 가리킴 |
| **번호만** | 같은 일이 장부 번호로 있으나, 장부는 이 문서를 모름 (근거 연결 없음) |
| **밖** | 장부에 해당 번호가 없음 |
| **끝남** | 문서 안에서 결과까지 적힌 역사 (장부 밖에서 진행 · 완료) |
| **의도 밖** | 계획에 넣지 않기로 결정됨 |

### 2.3 성격 다섯

기계(develop) · 데이터(author) · 측정(assay) · 운영(관리 · 권한) · 결정(사용자)

---

## 3. 출처별 전수표

### 3.1 S2 — 설계 문서 (21 + 루트 4)

| 문서 · 절 | 계획 내용 [사실] | 장부 대조 | 상태 | 성격 |
|---|---|---|---|---|
| `integral-field-engine.md` §9 단계 0–5 · §16 전체 진행 순서 A′ · S1–S3 · A · B · C · D · E · F | 검증 → 엔진, 관문 포함. build 계획의 **원본 설계**(DEC-0001 "근거 설계 §1–17") | 반영 — build 1–5 부 · 4 부(PLAN-027–036) · 관문 A′(PLAN-010 ☑) · 관문 D(PLAN-030 ☐) | 앞쪽 ☑, D–F 대기 · 보류(DEC-0028) | 기계 |
| `engine-port-roadmap.md` §2 단계 0 · 0.5 · 1 · 1.5 · 2 · 3 · 4 | Rust/WASM · 기호 야코비안 · 탐침 병렬 · 희소 LU · 혼성 확률 · 관찰 포트 | **장부가 이 문서를 모름** (0) | **끝남** — 단계마다 "결과 (2026-10-09)" 절, "4 단계 완료" | 기계 |
| `observation-port.md` | 관찰 포트 — "4 단계에서 구현 — 완료" | 장부 0 | 끝남 | 기계 |
| `direction.md` §3 우선순위 귀결 1–6 | 데이터 먼저 · 공간 관찰이 공간 엔진보다 먼저 · 2 부는 가독성 · 규모는 ~1 만 senses 에서 · 7 부 · 구조 평가 뒤 순서 | 반영 — DIR-0001 · 0002 · 0003 · DEC-0028 · 0029 · 0030 (장부 18 회) | 방향 열림 | 운영 |
| `dictionary-and-translation.md` §10 · §11 단계 1–4 | 뼈대 → 가 스키마 필드 → 점진 이관 → (규모) SQLite · 뷰어 조각 | 반영 — PLAN-016a ◐(10-16) · 016 · 019 | 진행 표시 한 달 넘음 | 기계 |
| `FEATURES.md` §10 구현 순서 1–6 · §11 정할 것 | 특징 레코드 · 화면 · 데이터 채움 · **가설 층 + 규칙 엔진** · 서열 · 구조 도구 · 규칙 기반 모델 내보내기 | 1–3 은 v4 에서 구현(README). **4–6 은 밖** — 번호 사전에 F · H 이름공간이 legacy | 밖 (DOCUMENTED) | 기계 |
| `DESIGN-v4.md` §7 구현 순서 · §8 정할 것 | v4 형식 변환 · 위치 어휘 범위 · PKA 소단위 분리 | 장부 1 | §7 끝남 (v4 구현) · §8 두 질문 결론 UNKNOWN | 결정 |
| `format-v12.md` §9 정할 것 1–5 | 값 불변 · recorded_at 봉인 · 맥락 번호 · kinetics 모양만 · 정성 출처 필수 (모두 추천 "예") | 장부 0 (사건 1) | v12 구현됨 — 채택 여부 기록 UNKNOWN [추론: 채택] | 결정 |
| `scaling-limits.md` §4 방아쇠 | 정의항 10 만 · 패치 10 초 · 도장 30 만 · 뷰어 20 MB — 넷 중 하나면 쪼개기 | 번호만 — PLAN-015–019 (정돈 제안이 "보류, 다시 열 조건" 으로 연결) | 조건 대기 (지금 203 · 0.1 s · 341 · 0.5 MB) | 기계 |
| `rules-regulation-tests.md` §5 후보 · §6 기준 세 층 · §8 순서 67 · 68 · 69 | 생화학 타당성 기준 B0 · B1 · B2 | 반영 — PLAN-067 ☐ · 068 ☐ (순서 밖) · 069 ☑ | 067 · 068 대기 | 기계 · 데이터 |
| `structure-realignment.md` §10 순서 · §12 열린 것 3 | 7 부 구조 재편 / 귀속 기본 배율 · 정량 귀속 · **판정 원장에 사람 결정 구별** | §10 반영(DEC-0012 · 7 부) · **§12 의 셋은 장부 open 에 없음** | §12 밖 | 결정 · 운영 |
| `substrate-axis.md` §5 순서 ①–③ | 코드(develop) → 이관(author) → 수집 도구 | 장부 0 · 전환 기록 #5 | ① 끝남 · ② 전환 기록 #5 에서 대기 · ③ 밖 | 기계 · 데이터 |
| `tca-validation-protocol.md` §7 기계 쪽 일 · §9 바닥 1–5 · §10 한계 | 경로 엔진(80) · 다기질 법칙(83) · ΔG°′ 등급 정책 · 몬테카를로 입력 · 우연 기준선(84) / **사람 속도 상수 15 개 없음** · 열역학 추정 등급 · 효소 양 · 검증 독립성 | 번호만 — 080 ◐ · 083 ☐ · 084 ☐ (둘 다 순서 밖) · 데이터 15 상수는 078 | 대기 | 기계 · 데이터 · 결정 |
| `uncertainty-budget.md` §5 다음 1–3 | 기록표 v0.1 을 실험실에 · 형식 시험 · NCS · GMP 대조 | 반영 — ASY-08 ◐ | 진행 | 측정 |
| `outsourcing-and-mcp.md` §4.7 · §6 ①–③ · §7 열린 것 | 전문 수신함 + 인용 대조 · 정량 맥락 이전 · 받기 기록 / 보류: 7 부 50–57 | 반영 (장부 3) | ① ③ 끝남(`inbox.js` · FETCH_LOG) · ② `context_transfer` 는 정성 판정에만 있음(코드) · 50–57 순서 밖 | 기계 |
| `conservation-classes.md` §4 | 나중 적분장의 참조점 | 장부 1 | 설계 근거 | 기계 |
| `abstraction-boundary.md` · `authority-and-comprehension.md` · `hybrid-multiscale-engine.md` · `cell-fate-engine.md` · `tripartite-governance.md` · `work-verification.md` · `post-build-directions.md` | 원칙 · 설계 (할 일 표 없음 또는 S7) | — | — | — |
| `SCHEMA.md` §8P 측정법 장부 | 측정법 장부 형식 (ASY-00) | 반영 | 코드 있음 · 항목 0 | 측정 |

### 3.2 S3 — 보고서 (52 중 할 일 절이 있는 45)

| 보고서 · 절 | 계획 내용 [사실] | 장부 대조 | 상태 | 성격 |
|---|---|---|---|---|
| **10-15 관문 A′ · MHC I** "다음에 필요한 것" | 사용자에게 원문 요청 | 반영 (PLAN-010) | 끝남 | 데이터 |
| 10-15 MHC I 정성 묶음 "다음" | 정성 관찰 더 | 번호만 (PLAN-012a ◐) | 진행 표시 10-15 | 데이터 |
| 10-16 시트르산 생성효소 상수 · BRENDA · 속도 상수 출처 · TCA 실측 §7 | 사람 kcat 희소 · 다음 지점 | 반영 1 / 0 | PLAN-078 로 이어짐 [추론] | 데이터 |
| 10-16 MHC II 정성 "실측 속도 상수 — 보류" | 정량 보류 | 장부 0 | 보류 (사유: 출처) | 데이터 |
| **10-16 텔로미어 염색체별 §6 다음(2 단계) — 열린 결정** | 2a 커밋 가능 버전(손상 → p53 배선 · 시나리오) · 2b 46 개 확장 + 사전 등록 · 성능 확인 | **밖** (장부 0) | UNKNOWN (진행 기록 없음) | 데이터 · 기계 · 결정 |
| 10-16 검증 세트 MHC · MHC I β2m · 텔로미어 §7 "얻은 것 · 다음 · 바닥" | 검증 세트 늘리기 · 정량 검증 | 반영 1–2 | 이어짐 (DIR-0002) | 데이터 |
| 10-17 작업 검증 §6 다음 | 받기 고리 ↔ 출처 해석(DOI) · 해시 사슬 런타임 emit · 인용–원문 자동 대조 | 장부 0 | 일부 끝남 (인용 대조 · 받기 기록) · 런타임 emit UNKNOWN | 기계 |
| 10-22 Phase 0 조사 | 현실 닻 진단 | 반영 (DEC-0011) | 진단 | — |
| 10-23 제약 · 시험 목록 §18 CI | 목록 | 0 | 기록 | — |
| 10-23 텔로미어 정지 §4 남는 것 | 남은 검증 | 반영 1 | UNKNOWN | 데이터 |
| **10-25 구조 분석 §4 R1–R7** | R1 실측 유입(78) · R2 엔진 하나로(80) · **R3 쓰기의 비교 후 교체(81)** · R4 판정 날짜(82) · R5 MM 기질 수(83) · R6 우연 기준선(84) · R7 공간 층 지위 | 반영 (장부 9) | 78 ☐ · 80 ◐ · **81–84 ☐ 모두 순서 밖** · R7 은 P3–P5 지움(DEC-0032) | 기계 |
| 10-25 연산 효율 §4 | 형식 배열 · 도장 재검증 병렬 · 칸당 계산 : 바이트 | 번호만 (PLAN-086 ☐ 순서 밖) | 정돈 제안 "보류" | 기계 |
| 10-25 신뢰 · 검증 기준 §9 이유 미정 3 · 빈 곳 | S3.unconfirmed 기한 · T.scope · 등급 순번 / I 축 · 용도별 인정 | 번호만 — 071 ☐ (순서 34) · 072 ☑ · 073 ☑ | **이유 미정 셋은 결정 기록 없음** | 결정 |
| 10-25 구조 평가 §6 | 77 → 78 → 52 → 71 → 79 | 반영 (DEC-0030 · DIR-0001) | 진행 | 운영 |
| 10-25 TCA 해상도 §2 크기 검증 의존 순서 1–5 | 검증 대상 정하기 → 엔진(80) → 다기질(83) → 가역성 ΔG°′ → 상수 넷 + 효소 농도 | 번호만 (장부 0) | 080 ◐ · 083 ☐ · **1(대상 고르기)은 결정 대기** | 결정 · 기계 · 데이터 |
| **10-25 결함이 많은 까닭 §4 P1–P6** | 통합 경로 없는 층 금지 · 대체에 제거 기한 · 규칙 = 집행 지점 + 거부 시험 · 기본값 사용 수를 1 급 지표로 · 바깥 기준 시험 비율 · 데이터 : 구조 비율 | 장부 0 — 일부는 규칙 장부(RULE)로 들어갔을 수 있음 | UNKNOWN (규칙 장부 대조 필요) | 운영 |
| 11-01 자료 무결성 §7 순서 · §8 열린 질문 · §9.1 이행 | ASY-11–16 | 반영 (DEC-0046, 장부 9) | 진행 · 대기 | 측정 |
| 11-01 엔진 해부 1 · 2 §5 · §7 | 개념 한계 K1–K7 · 계획과의 연결 | 반영 (장부 4 · 2) | 이어짐 | 기계 |
| 11-01 작업 자동화 §6 · §8.4 · §10 | STG-11a–f · 대화 밖으로 옮기기(조건부) | 반영 (STG-11 · open) | 11f ◐ · §10 open | 운영 |
| 11-02 승인 묶음 §5 만들 것 · §6 열린 질문 | 승인 묶음 도구 | 반영 (STG-12) | 끝남 · STG-12a 보류 | 운영 |
| 11-02 권한 개관 §7 남은 일 · **§8 결정할 것 1–5** | L6 보호 · field 구멍 · 문지기가 권한 표 읽기 · 자기 검사 시험 except · 서명 태그 검증기 | 반영 (장부 2) — 결정 결과 일부 STG-12 결과 | §8 의 4 · 5 는 "보류 · 필요할 때" | 결정 · 운영 |
| 11-02 인간뇌 충분도 §3 · §5 | 부족한 점 P1–P10 → 계획 등록 | 반영 (DEC-0050 · 0051) | 등록됨 (P9 뺌) | — |
| 11-02 엔진 입문 Q&A §8 · **§10 레슨 5 고치는 순서 (결정은 사용자)** | 고치는 순서 + 사용자 결정 3 | 반영 (장부 2) | **결정 3 의 결과 UNKNOWN** | 결정 |
| 11-02 열쇠 이름 **§7 결정할 것 1–5** | 등급 일곱 · 구역 39 · 표 자리 · dbtool 나누기 · L6 자기 검사 · G1 | 반영 (open "권한 등급 일곱 …") | 열림 | 결정 |
| 11-02 L6 시험 나누기 **§6 결정할 것 1–3** | 전체 분리 C / 작은 것 B · 옛 규칙 대조 · 예외 목록 | 반영 1 | UNKNOWN | 결정 |
| **11-02 계획 정돈 제안 §1–§5** | 순서 밖 51 → A 넣음 15 · B 닫기 6 · C 보류 21 · D 결정 7 + 적용 시 순서 | **밖 — 미적용** (장부 0 · 사건 0) | 대기 | 운영 · 결정 |
| 11-02 PLAN-021 조사 §5 단계 S1–S4 | 정수 초월 함수 · FMA 금지 | 번호만 (PLAN-021 ☑ 11-02) | 끝남 | 기계 |
| 11-02 보고 지침 조사 §7 | PLAN-040 등 | 반영 (장부 3) | 등록 | 운영 |
| 11-02 실행 기록 설계 §6 단계 · §8.3 빈 곳 · 아이디어 | 계산 기록부 R0–R3 · 주장 장부 | §6 반영 (PLAN-089–091) · **§8.3 은 초안 — 밖** | 대기 | 기계 |
| 11-02 쓰기 소유 §7 열린 질문 | 권한 등급 | 반영 (open) | 열림 | 결정 |
| **11-03 수집 자료 구조 §4 S1–S6 · §6.1** | S1 기질 칸 · S2 효소 형태 · 조건 · S3 후보 계약 v2 · S4 힌트 후보 · S5 수신함 색인 · S6 값 선택 기준 · 도구는 S1–S4 뒤 | **밖** (장부 0) | S1 끝남(기질 축, 전환 #5) · **S2–S6 대기 · 결정 필요(S3)** | 데이터 · 기계 |
| **11-03 수집 검색 계층 §7 순서 1–6** | **`sabio_kinetics` 도구** → 후보 합치기 → 사용자 결정(SABIO 약관 · BRENDA 계정 · Unpaywall) → 인용 대조(ASY-12) → 이중 입력(ASY-13) → 5 칸 확정 | **밖** (장부 0) — 4 · 5 만 ASY 번호 | 도구 없음 (`mcp/fetch.mjs` 에 sabio 0) · 결정 대기 | 기계 · 데이터 · 결정 |
| 11-18 실험 노트 NADH §3 · §4 | ASY-08 남은 일 (추적성 · 불확도 예산 칸) | 반영 (장부 2) | ASY-08 ◐ | 측정 |
| 11-18 불확도 예산 해설 §6 하지 않은 것 · 남은 것 | 자유도 · 상관 · `shared` 이중 계산 · 추적성 사슬 판정 · lognormal | **밖** (조건부 — "쓰는 곳이 생길 때") | 조건 대기 | 측정 |
| 11-19 기초시험 일괄 §6 | 공통 감사 · 한계 | 전환 기록 #7 | 넘김 | — |
| 11-19 경로 해부 | cAMP 출처 0 | 전환 기록 #8 | 넘김 | 데이터 |
| 11-19 두 엔진 차이 §4 사람이 정할 일 | 시작량 의미 | 반영 (DEC-0063) | 결정됨 | 결정 |
| 11-20 작업 조율 셋 (설명 · 흐름 · 가상 실행) | F1–F13 · PLAN-105 제안 · 4 층 연결 | 가상 실행만 반영 (DEC-0065 · open F1) · **F6 · PLAN-105 · 흐름 문서 §6.2 정정은 밖** | 결정 대기 | 운영 · 결정 |
| 11-21 부족한 것 지도 | 다섯 층 · E1–E5 · 세로 뚫기 ①–⑥ · 정할 것 3 | **밖** (장부 0) | 결정 대기 | 전부 |
| `mhc-dc-maturation-lps-fate.md` §2 단계별 전개 | 운명 해석 | 0 | 기록 | — |
| `collection-system-develop-brief.md` | 수집 체계 디벨롭 요약 | 0 | UNKNOWN (이번에 본문을 읽지 않음) | — |

### 3.3 S4 — 세션 인계

| 인계 | 할 일 [사실] | 장부 대조 | 상태 |
|---|---|---|---|
| `handoff/NEXT-2026-10-23.md` | 후보 6: 기원 없는 입력 484 줄이기 · 보고서 그림 12(SVG) · 운명 보고서 의존 지문 · 뷰어 audience + en 사전 · 무료 정성 관찰 · TASK-004 재개 조건 | 번호만 — 2 부(PLAN-012 · 013 · 016a ◐) / **기원 없는 입력 484 는 밖** | "다음 세션에 사용자와 고른다" — 고른 기록 없음 |
| `handoff/NEXT-2026-10-25.md` 다음 순서 1–5 | 77 저장소 연결(사용자) · 74–76 ☑ · 78 · 52 → I 축 · 79 | 반영 | 77 은 여전히 사용자 손 |
| `NEXT-2026-11-01.md` · `NEXT-2026-11-02.md` | 사용자가 정한 다음 일 · 엔진 후보 · 남은 넘김 | 장부 0 | `NEXT-2026-11-19` 가 대신함 (각 문서 머리) |
| **`NEXT-2026-11-19.md` §2 ①–④** | ① 속도 엔진 시나리오 8 개에 숨은 시작량 적기 ② 숨은 기본값 지우기 ③ 운명 엔진 암묵 0 (35 시나리오 538 개, 사전 등록 5) ④ PLAN-080 본체 | 번호만 — PLAN-080 · DEC-0063 | ①–③ 은 080 의 앞 단계로 글에만 [추론] |
| **`WORKORDER-2026-11-02-engine.md` §4 1–7 · §9** | **1 계획 나누기 (사용자 허락 대기)** · 2 PLAN-021 ☑ · 3 PLAN-080 · 4 사법부 요청 대기 ①–③ · 5 PLAN-089 R0 · **6 미확인 확인 ①–③** · 7 정보 작성으로 넘길 일 | 장부 0 | **1 의 허락 기록 없음** · 4 의 ② ③ · 6 의 셋 · 7 의 지침 출처 확인은 UNKNOWN |
| `transitions.jsonl` #1–#11 | 열린 질문 40 (#1 9 · #2 4 · #3 2 · #4 5 · #5 5 · #6 2 · #7 2 · #8 3 · #9 3 · #10 1 · #11 4 — #11 은 다른 브랜치) | 장부 0 | **처리 상태 없음** — #10 은 PR #15 로 끝남 [사실], 나머지 UNKNOWN |
| `handoff/HANDOFF-tnf-mrna-halflife.md` 추적 리드 1–3 | 1 차 논문 찾기 (리뷰 참고문헌 · PubMed · 전사체 데이터셋) | TASK-001 | 사람 손 대기 |
| `handoff/HANDOFF-telomere-quantitative.md` ⑥ 보류 | 유료 전문 | L000116 | 보류 |
| `START-HERE.md` §3 할 일 | 수집가 절차 | 장부 7 | 절차 |

### 3.4 S5 — 미구현 · 진화 후보 목록

| 목록 | 내용 [사실] | 장부 대조 | 비고 |
|---|---|---|---|
| `README.md` "아직 안 된 것" | 속도 상수 · 관찰 기록 · 농도 · 부피 · 추세 신선도(L000085) · 역할별 지문(L000086) · 가설 층 · 3 차원 구조 · 수송 단계 예시 · 저장 방식(20 만 정의항 벽) | 일부 번호 (078 · 015–019) | **숫자가 낡음** (kinetics 2 건 → 지금 4, 관찰 15 → 28) |
| 교과서 8.5 다음 진화의 후보 | 반응 속도 데이터 · 면적 농도(L000017) · Gs 해리(L000015 · 18) · 유비퀴틴 사슬 · 세포당 분자 수 · 공급 · 분해 속도 · 서열 길이 — 모두 한계 번호 | 한계 등록부 | 장부 밖, 한계 체계 안 |
| `project-overview.md` "다음" | 현실 검증 한 건 → 등급 코퍼스 → 치료 영역 모델 → 규제급 보고서 | DIR-0002 와 같은 뜻 | 바깥용 |

### 3.5 S6 — 한계 등록부 [사실]

| 종류 | 열림 / 전체 |
|---|---|
| Kinetic_Gap | 27 / 27 |
| Structural_Gap | 35 / 39 |
| Observation_Gap | 16 / 16 |
| Concentration_Gap | 14 / 14 |
| Regulatory_Gap | 12 / 12 |
| Resource_Gap | 6 / 6 |
| Identity_Gap | 3 / 12 |
| Consensus_Gap | 1 / 1 |
| **합** | **114 / 127** |

한계는 "무엇을 모르는가" 의 데이터이고 계획 작업이 아니다(교과서 8 장). 다만 PLAN-078 · ASY · D000051 지도의 할 일 대부분이 이 번호들을 닫는 일이다 [추론]. 계획 장부와 한계 사이의 연결은 작업 글 속 번호뿐 [사실].

### 3.6 S7 — 의도적으로 계획 밖

| 문서 | 내용 | 근거 |
|---|---|---|
| `post-build-directions.md` §1 엔진을 효율별로 분해해 MCP 로 · §2 상업 · 지원 · 커리어 | "활성 작업 항목이 아니다 — build 계획과 섞지 않는다" | DEC-0008 · §1 은 실행 MCP(PLAN-094 ☑)로 일부 앞당겨짐 |
| 인공간뇌 요구 정의 (P9) | 계획에서 뺌 | DEC-0051 |
| 양자역학 | 범위 밖 | DEC-0044 |

---

## 4. 장부 밖에만 있는 할 일 (34 묶음)

장부 번호가 **없는** 것만. 번호가 있는 일은 3 장 표의 "번호만" 으로 표시했다.

| # | 할 일 | 출처 | 성격 | 막는 것 · 조건 |
|---|---|---|---|---|
| X1 | **계획 정돈 제안 적용** (순서 밖 51 → 넣음 · 닫기 · 보류 · 결정) | 11-02 plan-triage | 운영 · 결정 | 사용자 결정 7 |
| X2 | 가설 층 + 규칙 엔진 (특징 4 단계) | FEATURES §10 4 | 기계 | — |
| X3 | 서열 · 구조 도구 연동 (지문 · 모티프 스캔) | FEATURES §10 5 | 기계 | 구조 측정법 보류(ASY-06) |
| X4 | 규칙 기반 모델 내보내기 | FEATURES §10 6 | 기계 | PLAN-038 과 겹칠 수 있음 |
| X5 | 텔로미어 2a 커밋 가능 버전 (손상 → p53 배선) | 10-16 telomere trail §6 | 데이터 · 기계 | 열린 결정 |
| X6 | 텔로미어 2b 46 개 확장 + 사전 등록 검증 | 〃 | 데이터 | 성능 확인 |
| X7 | 해시 사슬 테이프 런타임 emit | 10-17 work-verification §6 | 기계 | harness 의존 |
| X8 | 판정 원장에 사람 결정 구별해 남기기 | structure-realignment §12 | 운영 | 지금 신호는 `--allow-warnings` 하나 |
| X9 | 귀속 기본 배율 값 · 정량 귀속(TOST) | structure-realignment §12 | 기계 · 결정 | 정량 검증 관찰 0 |
| X10 | 결함 방지 만드는 규칙 P1–P6 (규칙 장부 반영 여부 확인부터) | 10-25 why-so-many-defects §4 | 운영 | UNKNOWN |
| X11 | 신뢰 기준의 이유 미정 셋 (S3.unconfirmed 기한 · T.scope · 등급 순번) | 10-25 reliability §9 | 결정 | 기준 변경은 사용자 결정 |
| X12 | TCA 크기 검증 대상 하나 고르기 | 10-25 tca-resolution §2 1 | 결정 | — |
| X13 | 열역학 추정값(ΔG°′ D2)의 등급 정책 | tca-validation-protocol §7 · §9 2 | 결정 | — |
| X14 | 몬테카를로 입력 앙상블 (불확도 전파) | tca-validation-protocol §7 | 기계 | — |
| X15 | 효소 양 — 단백체 보충 파일 받기 도구 · 평행 효소 배정 규칙 | tca-validation-protocol §9 4 | 기계 · 데이터 | L000120 |
| X16 | 수집 S2 효소 형태 · 조건 확장 | 11-03 dataset-fit §4 | 데이터 · 기계 | §6 에서 축소 |
| X17 | 수집 S3 후보 계약 v2 | 〃 | 기계 | 결정 필요 |
| X18 | 수집 S4 힌트 후보 (`secondary`) | 〃 | 기계 | — |
| X19 | 수집 S5 수신함 색인 (생성물) | 〃 | 기계 | 선행 없음 |
| X20 | 수집 S6 규칙 값 선택 기준 | 〃 | 데이터 · 결정 | ASY-16 과 함께 |
| X21 | **`sabio_kinetics` 수집 도구** | 11-03 search-layer §7 1 | 기계 | S1–S4 뒤 (dataset-fit 제안) |
| X22 | 후보 합치기 보기 (독립 출처 수 · 단백질 불일치) | 〃 2 | 기계 | ASY-16 준비 |
| X23 | SABIO 약관 · BRENDA 계정 · Unpaywall 주소 결정 | 〃 3 | 결정 | RULE-0024 (다른 로그인 금지) 와 대조 필요 |
| X24 | 불확도 예산의 미룬 다섯 (자유도 · 상관 · `shared` · 추적성 사슬 · lognormal) | 11-18 explained §6 | 측정 | 쓰는 곳이 생길 때 |
| X25 | 기원 없는 입력 484 줄이기 (`origin --all`) | handoff/NEXT-10-23 | 데이터 | — |
| X26 | 속도 엔진 시나리오 숨은 시작량 · 숨은 기본값 · 운명 엔진 암묵 0 538 | NEXT-11-19 ①–③ | 기계 · 데이터 | PLAN-080 의 앞 단계 (번호는 080) |
| X27 | **계획 나누기 (엔진 항목이 3 · 4 · 6 · 7 부에 흩어짐, 큰 항목 쪼개기)** | WORKORDER §4 1 | 운영 · 결정 | "사용자 허락 대기" |
| X28 | 미확인 확인 셋 (2A 확률 N² vs N(N−1)/2 · JS/Rust 확률 분기 · FMA) | WORKORDER §4 6 | 기계 | ① 은 PLAN-096 · 전환 #6 에서 고쳐짐 [사실], ② ③ UNKNOWN |
| X29 | 못 연 지침 출처 확인 (COPE · ASME V&V 40 · FDA 원문) | WORKORDER §4 7 | 데이터 | PLAN-040 의 전제 |
| X30 | 전환 기록 열린 질문 40 의 처리 | transitions #1–#11 | 운영 | 처리 상태 칸 없음 |
| X31 | 작업 조율 F6 승인 PR 권한 · PLAN-105 MCP 연결 · 흐름 문서 §6.2 정정 | 11-20 셋 · 11-21 audit | 운영 · 결정 | — |
| X32 | D000051 세로 뚫기 · 첫 실험 고르기 · E1–E5 | 11-21 gap-map | 전부 | 사용자 결정 |
| X33 | 앞선 전수조사의 충돌 넷 처리 (accept 승인자 기본값 · 낡은 문서 숫자 · 예약 작업 PR · 문서 오류) | project-management-system-audit §9.2 | 운영 · 결정 | — |
| X34 | 로드맵 관리 기능 R1–R9 | project-roadmap-audit §7 | 운영 | R1 · R2 는 형식 변경 |

---

## 5. 결정 대기 모음

| 출처 | 질문 | 장부 open 에 있나 |
|---|---|---|
| DESIGN-v4 §8 | 위치 어휘 범위 방식 · PKA 소단위 분리 시기 | 없음 (결론 UNKNOWN) |
| FEATURES §11 | 특징 · 가설 층 정할 것 | 없음 |
| format-v12 §9 | 다섯 (추천 "예") | 없음 (구현으로 보아 채택 [추론]) |
| structure-realignment §12 | 셋 | 없음 |
| reliability-criteria §9 | 이유 미정 셋 | 없음 |
| tca-resolution · tca-protocol | 검증 대상 · ΔG°′ 등급 정책 | 없음 |
| telomere trail §6 | 2 단계 열린 결정 | 없음 |
| 권한 개관 §8 | 다섯 (1–3 의 처리는 STG-12 결과와 대조 필요 · 4 보류 · 5 필요할 때) | 일부 |
| 엔진 입문 §10 | 사용자 결정 3 | 없음 (결과 UNKNOWN) |
| 열쇠 이름 §7 | 다섯 | **있음** (open "권한 등급 일곱 …") |
| L6 시험 나누기 §6 | 셋 | 없음 |
| 계획 정돈 제안 §4 | D 일곱 (050p · 066 · 070 · 070p · 016a · 013 · STG-06) | 없음 |
| 수집 검색 계층 §7 3 | SABIO 약관 · BRENDA 계정 · Unpaywall | 없음 |
| 수집 자료 구조 §4 S3 | 후보 계약 v2 | 없음 |
| WORKORDER §4 1 | 계획 나누기 허락 | 없음 |
| handoff/NEXT-10-23 | 후보 여섯 중 고르기 | 없음 |
| 11-20 · 21 이 세션 문서 | F1(open 있음) · F6 · PLAN-105 · 세로 뚫기 · 첫 실험 · E1 담당 · 충돌 넷 · R5/R3/R6 먼저 할지 · 순서 밖 51 | F1 만 있음 |
| 장부 open (이미 있음) | main 병합 시점 · 기록 묶기 · 대화 밖으로 · 권한 등급 · 온도/pH · **사람 승인의 git 서명** · PLAN-101(낡음) · F1 | 있음 (8) |

→ **결정 대기는 장부 open 8 + 문서에만 있는 약 40**. 같은 질문이 두 곳에 있는 경우: "사람 승인의 증명" (assay open · DEC-0064 가 · 권한 개관 §8 5 · structure-realignment §12) [사실].

---

## 6. 끝난 로드맵 (역사로 남은 것)

| 문서 | 끝난 것 | 장부와의 관계 |
|---|---|---|
| `engine-port-roadmap.md` | 0 – 4 단계 전부 (10-09) | 장부가 모름 — 장부(10-15 시작) 이전의 엔진 로드맵 [추론] |
| `observation-port.md` | 관찰 포트 | 〃 |
| `DESIGN-v4.md` §7 | v4 변환 | 장부 이전 |
| `plan021-survey.md` §5 | S1–S4 | PLAN-021 ☑ |
| `integral-field-engine.md` §16 A′ · S1 · A | 1 부 | PLAN-001–010 ☑ |
| `STG-12-README.md` | L6 묶음 1 · 2 · 3a | STG-12 ☑ |

---

## 7. 겹침 · 어긋남

| 무엇 | 사실 | 분류 |
|---|---|---|
| 같은 "다음 순서" 가 다섯 곳 | direction §3 · structure-evaluation §6 · handoff/NEXT-10-25 · DIR-0001 · DEC-0030 (77 → 78 → 52 → 71 → 79) | 겹침 — 장부(DIR-0001)가 기준 |
| 순서 밖 51 의 처리 | 장부: 순서 밖 / 정돈 제안: 넣음 · 닫기 · 보류 · 결정 | 어긋남 (제안 미적용) |
| PLAN-081 의 급함 | 구조 분석 R3 · 정돈 제안 A(맨 앞) / 장부: 대기 · 순서 없음 | 어긋남 |
| 진행 표시 ◐ 와 문서의 "다음" | PLAN-012 · 013 · 016a ◐(10-16) / 정돈 제안: 012 닫기 → 065, 013 · 016a "상시" 결정 | 어긋남 |
| PLAN-052 측정법 어휘 | 장부 대기(순서 밖) / 정돈 제안: ASY-00 으로 닫기 / ASY-00 끝나는 조건: "PLAN-052 ☑" | 순환 의존 꼴 — 한쪽이 닫혀야 다른 쪽이 끝남 |
| README "아직 안 된 것" 숫자 | kinetics 2 · 관찰 15 / 실제 4 · 28 | 낡음 |
| `NEXT-*` 셋 · WORKORDER · 전환 기록 | 같은 "다음 일" 을 각자 | 겹침 — STG-11f 가 NEXT 형식을 정했으나 WORKORDER · 전환 기록과의 관계는 글로만 |
| 사람 승인의 증명 | 네 곳에서 각자 (5 장) | 겹침 |

---

## 8. 제안 [추론 — 적용하지 않음]

| 차례 | 무엇 | 까닭 |
|---|---|---|
| 1 | **X1 계획 정돈 제안을 다시 열어 사용자가 결정** — 3 주 전 제안이라 그 사이 바뀐 것(PLAN-080 진행 · 9 부 · DEC-0063–0065)을 반영해 다시 맞춘 뒤 | 순서 밖 51 · PLAN-081 · 낡은 ◐ 가 한 번에 정리됨 |
| 2 | 4 장 X1–X34 를 하나씩 "장부에 넣음 / 한계로 / 닫음 / 결정 대기(open)" 로 분류 | 장부 밖 할 일을 0 으로 |
| 3 | 5 장 결정 대기 약 40 을 장부 open 으로 옮길지 결정 | 결정 대기 목록을 한 곳에 |
| 4 | 전환 기록 열린 질문 40 의 처리 상태를 셈 (조사만) | X30 |
| 5 | 로드맵 기능 R5(한 장) · R6(결정 대기 목록) 에 이 문서의 출처 일곱을 입력으로 | 다시 흩어지지 않게 |

---

## 9. 확인하지 못한 것 (UNKNOWN)

| 무엇 | 왜 |
|---|---|
| 제목이 없는 본문 속 할 일 | 제목만 찾았다 — 본문 문단 전수는 하지 않음 |
| `collection-system-develop-brief.md` 의 할 일 | 본문을 읽지 않음 |
| 결함 방지 규칙 P1–P6 이 규칙 장부에 들어갔는지 | 규칙 장부 536 과 대조하지 않음 |
| 엔진 입문 §10 사용자 결정 3 · L6 시험 나누기 결정 · DESIGN-v4 §8 의 결론 | 기록을 찾지 못함 |
| 전환 기록 #1–#9 · #11 의 열린 질문이 처리됐는지 | 처리 상태 칸 없음 |
| WORKORDER §4 4 · 6 의 남은 항목 | 뒤 기록 없음 |

---

## 부록 A. 할 일 절이 있는 문서와 장부 대조 (98)

> 숫자 = 그 문서 이름이 `plans.jsonl` · `plan-log.jsonl` · `transitions.jsonl` 에 나오는 횟수. 0 · 0 · 0 이면 장부가 그 문서를 모른다.

| plans | log | 전환 | 문서 |
|---|---|---|---|
| 1 | 1 | 0 | `.claude/skills/author/SKILL.md` |
| 1 | 1 | 0 | `.claude/skills/baseline/SKILL.md` |
| 1 | 1 | 0 | `.claude/skills/develop/SKILL.md` |
| 1 | 1 | 0 | `.claude/skills/inspect/SKILL.md` |
| 1 | 1 | 0 | `DESIGN-v4.md` |
| 1 | 1 | 0 | `FEATURES.md` |
| 7 | 5 | 0 | `README.md` |
| 7 | 8 | 0 | `SCHEMA.md` |
| 5 | 5 | 0 | `docs/PROMPTS.md` |
| 5 | 5 | 0 | `docs/RUNBOOK.md` |
| 0 | 0 | 0 | `docs/design/abstraction-boundary.md` |
| 0 | 0 | 0 | `docs/design/authority-and-comprehension.md` |
| 1 | 0 | 0 | `docs/design/conservation-classes.md` |
| 3 | 2 | 0 | `docs/design/dictionary-and-translation.md` |
| 18 | 8 | 0 | `docs/design/direction.md` |
| 0 | 0 | 0 | `docs/design/engine-port-roadmap.md` |
| 0 | 1 | 0 | `docs/design/format-v12.md` |
| 2 | 2 | 0 | `docs/design/integral-field-engine.md` |
| 0 | 0 | 0 | `docs/design/observation-port.md` |
| 3 | 2 | 0 | `docs/design/outsourcing-and-mcp.md` |
| 1 | 0 | 0 | `docs/design/post-build-directions.md` |
| 2 | 1 | 0 | `docs/design/rules-regulation-tests.md` |
| 0 | 0 | 0 | `docs/design/scaling-limits.md` |
| 1 | 0 | 0 | `docs/design/structure-realignment.md` |
| 0 | 0 | 1 | `docs/design/substrate-axis.md` |
| 0 | 0 | 0 | `docs/design/tca-validation-protocol.md` |
| 2 | 0 | 0 | `docs/design/uncertainty-budget.md` |
| 13 | 22 | 9 | `docs/modes/author.md` |
| 9 | 8 | 2 | `docs/modes/baseline.md` |
| 11 | 26 | 9 | `docs/modes/develop.md` |
| 9 | 9 | 0 | `docs/modes/inspect.md` |
| 0 | 0 | 0 | `docs/project-overview.md` |
| 2 | 1 | 0 | `docs/reports/2026-10-15-gate-a-prime-tap-mhc1.md` |
| 0 | 1 | 0 | `docs/reports/2026-10-15-mhc1-qualitative-batch.md` |
| 0 | 0 | 0 | `docs/reports/2026-10-16-cs-kinetics-detail.md` |
| 1 | 1 | 0 | `docs/reports/2026-10-16-evidence-tca-measured-kinetics.md` |
| 0 | 0 | 0 | `docs/reports/2026-10-16-kinetics-brenda.md` |
| 0 | 0 | 0 | `docs/reports/2026-10-16-mhc2-qualitative.md` |
| 0 | 0 | 0 | `docs/reports/2026-10-16-telomere-per-chromosome-design-trail.md` |
| 0 | 0 | 0 | `docs/reports/2026-10-16-validation-mhc-i-b2m.md` |
| 2 | 1 | 0 | `docs/reports/2026-10-16-validation-set-mhc.md` |
| 1 | 1 | 0 | `docs/reports/2026-10-16-validation-telomere.md` |
| 0 | 0 | 0 | `docs/reports/2026-10-17-work-verification.md` |
| 2 | 0 | 0 | `docs/reports/2026-10-22-phase0-reality-validation-audit.md` |
| 0 | 0 | 0 | `docs/reports/2026-10-23-constraints-tests-inventory.md` |
| 1 | 1 | 0 | `docs/reports/2026-10-23-validation-telomere-quiescence.md` |
| 9 | 8 | 1 | `docs/reports/2026-10-25-architecture-analysis.md` |
| 0 | 0 | 0 | `docs/reports/2026-10-25-compute-efficiency.md` |
| 0 | 0 | 0 | `docs/reports/2026-10-25-reliability-verification-criteria.md` |
| 2 | 0 | 0 | `docs/reports/2026-10-25-structure-evaluation.md` |
| 0 | 0 | 0 | `docs/reports/2026-10-25-tca-resolution.md` |
| 0 | 0 | 0 | `docs/reports/2026-10-25-why-so-many-defects.md` |
| 9 | 10 | 0 | `docs/reports/2026-11-01-data-integrity.md` |
| 2 | 1 | 0 | `docs/reports/2026-11-01-engine-teardown-2.md` |
| 4 | 3 | 0 | `docs/reports/2026-11-01-engine-teardown.md` |
| 9 | 13 | 0 | `docs/reports/2026-11-01-work-automation.md` |
| 1 | 1 | 0 | `docs/reports/2026-11-02-approval-bundle.md` |
| 2 | 3 | 0 | `docs/reports/2026-11-02-authority-overview.md` |
| 5 | 3 | 0 | `docs/reports/2026-11-02-brain-source-sufficiency.md` |
| 2 | 2 | 0 | `docs/reports/2026-11-02-engine-primer-qa.md` |
| 1 | 3 | 0 | `docs/reports/2026-11-02-identity-keys.md` |
| 1 | 1 | 0 | `docs/reports/2026-11-02-l6-test-split.md` |
| 0 | 0 | 0 | `docs/reports/2026-11-02-plan-triage.md` |
| 0 | 0 | 0 | `docs/reports/2026-11-02-plan021-survey.md` |
| 3 | 2 | 0 | `docs/reports/2026-11-02-reporting-guidelines-survey.md` |
| 3 | 2 | 0 | `docs/reports/2026-11-02-run-record-design.md` |
| 3 | 1 | 0 | `docs/reports/2026-11-02-write-ownership.md` |
| 0 | 0 | 0 | `docs/reports/2026-11-03-collection-dataset-structure-fit.md` |
| 0 | 0 | 0 | `docs/reports/2026-11-03-collection-search-layer-assessment.md` |
| 2 | 1 | 0 | `docs/reports/2026-11-18-labnote-nadh-a340-limits.md` |
| 0 | 0 | 0 | `docs/reports/2026-11-18-uncertainty-budget-explained.md` |
| 0 | 0 | 1 | `docs/reports/2026-11-19-baseline-sweep.md` |
| 0 | 0 | 1 | `docs/reports/2026-11-19-pathway-walkthrough.md` |
| 2 | 1 | 0 | `docs/reports/2026-11-19-two-engine-gap.md` |
| 0 | 0 | 0 | `docs/reports/2026-11-20-orchestration-explained.md` |
| 0 | 0 | 0 | `docs/reports/2026-11-20-orchestration-modules-flow.md` |
| 2 | 1 | 0 | `docs/reports/2026-11-20-orchestration-tabletop.md` |
| 0 | 0 | 0 | `docs/reports/2026-11-21-gap-map-and-direction.md` |
| 0 | 0 | 0 | `docs/reports/mhc-dc-maturation-lps-fate.md` |
| 0 | 0 | 0 | `docs/textbook/01-원칙과-구조.md` |
| 0 | 0 | 0 | `docs/textbook/02-저장-위치와-방식.md` |
| 0 | 0 | 0 | `docs/textbook/03-데이터-모델.md` |
| 0 | 0 | 1 | `docs/textbook/04-알고리즘.md` |
| 0 | 0 | 0 | `docs/textbook/06-출력-해석.md` |
| 0 | 0 | 0 | `docs/textbook/07-AI-작업-절차.md` |
| 0 | 0 | 0 | `docs/textbook/08-한계와-진화.md` |
| 0 | 0 | 0 | `docs/textbook/90-부록-자동생성.md` |
| 3 | 3 | 1 | `limitations.md` |
| 0 | 0 | 0 | `workspace/NEXT-2026-11-01.md` |
| 0 | 0 | 0 | `workspace/NEXT-2026-11-02.md` |
| 0 | 0 | 0 | `workspace/NEXT-2026-11-19.md` |
| 7 | 4 | 0 | `workspace/START-HERE.md` |
| 1 | 1 | 0 | `workspace/STG-12-README.md` |
| 0 | 0 | 0 | `workspace/WORKORDER-2026-11-02-engine.md` |
| 0 | 0 | 0 | `workspace/handoff/HANDOFF-telomere-quantitative.md` |
| 0 | 0 | 0 | `workspace/handoff/HANDOFF-tnf-mrna-halflife.md` |
| 0 | 0 | 0 | `workspace/handoff/NEXT-2026-10-23.md` |
| 0 | 0 | 0 | `workspace/handoff/NEXT-2026-10-25.md` |
