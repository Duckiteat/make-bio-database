# 과정 분석 보고서 — 확률 층 시험 — 출생–사멸 (해석해가 있는 계, 가상)

## 1. 요약 (Executive Summary)

| 항목 | 내용 |
|---|---|
| 시작 상태 · 후보 | 활성화된 CD8 T 세포 → 효과기 CD8 T 세포, 기억 전구 CD8 T 세포 |
| 신호 (선언된 일정) | 없음 |
| 결과 | **미결정** · 예측 과 일치 |
| 결정 시점 | — |
| 무결성 | **PASS** (11/11 확인) |
| 확률 실행 | seed 20261009 · 궤적 0 — **궤적 하나는 결론이 아니다**: 운명 비율·도달 시각 분포는 앙상블(`fate --ensemble N`)로 판정. 결정 탐침 없음 |
| 상수 | **가상 값 (hypothetical)** — 결과는 기전이 그 값에서 어떻게 흐르는지를 말할 뿐, 실제 세포의 시각을 예측하지 않는다 |

## 2. 단계별 전개 (Phase-wise Evolution)

### 2.1 변곡점

| 시각 | 종류 | 내용 |
|---|---|---|
| 0.02 h | departure | 시작 상태 활성화된 CD8 T 세포 를 벗어남 (서명 문턱 넘음) |

### 2.2 시계열

| t | T-bet@핵질 | Eomes@핵질 | T-bet/Eomes | 목표 거리 | 상태 | 적분 단계 |
|---|---|---|---|---|---|---|
| 0.25 h | 6 (2.371/h) | 0 (0/h) | 6.00e+12 | — | 전이 중 | 1 |
| 0.50 h | 14 (0.9542/h) | 0 (0/h) | 1.40e+13 | — | 전이 중 | 1 |
| 1.00 h | 24 (0.4722/h) | 0 (0/h) | 2.40e+13 | — | 전이 중 | 1 |
| 1.50 h | 31 (0.2638/h) | 0 (0/h) | 3.10e+13 | — | 전이 중 | 2 |
| 2.00 h | 48 (0.232/h) | 0 (0/h) | 4.80e+13 | — | 전이 중 | 4 |

표지 칸: 분자 수 (log10 변화 속도 /h).

### 2.3 구간 [기간 | 주된 원인 | 우세 표지 | 대사 비용]

| 구간 | 기간 | 주된 원인 | 우세 표지 | 대사 비용 |
|---|---|---|---|---|
| 전이 (결정 전) · 신호 없음 | 0.00 h – 2.00 h (2.00 h) | — | T-bet@핵질 (문턱의 48배); 가장 크게 변함 T-bet Δln +3.87 | — |

## 3. 무결성 증명서 (Integrity Certificate)

| 확인 | 결과 | 근거 |
|---|---|---|
| 원자료 계약 — definition-db/ffi/fate-raw.schema.json (형·필드·배열 길이·묶음 참조) | PASS | 위반 없음 |
| IR·기호 도함수 — 엔진이 먹은 IR = 조정자 IR, 법칙 충실도·자동미분 대비 도함수 ≤ 1e-14, 유한차분 교차 ≤ 1e-6 | PASS | 속도 2.11e-16 · 도함수 0 · 배율 0 · 유한차분 2.11e-11 (6 항목, 상태점 6) |
| 부분 구조 원장 ΣIn = ΣOut — 매 관찰 격자 단계 (120 단계) 상대 ≤ 1e-14 | PASS | 최대 0 @ 0.02 h, 중앙값 0 |
| 저장소 재생 — 모든 묶음 = 시작 + Σ 화학량 × 규칙 진행량 (규칙 밖 변경 없음), 매 단계 ≤ 1e-14 | PASS | 최대 0 @ 0.02 h |
| 신호 = 선언된 일정 (경계 조건) — 매 단계 | PASS | 불일치 0 / 0 |
| 시계 — 기록 시각 = 정수 산술로 다시 센 관찰 격자 (엔진과 독립) | PASS | 120 기록 = 120 격자 · 끝 = t_end |
| 결정론 — 같은 입력으로 다시 돌린 궤적 해시가 같음 | PASS | 2b8ec52b8c10b5f4 = 2b8ec52b8c10b5f4 |
| 음수 저장소 없음 | PASS | 없음 |
| 매개변수 출처 — 쓰인 상수가 모두 해시된 입력(데이터·시나리오)의 값 그대로 | PASS | 시나리오 2 · 데이터 0 · 시나리오는 hypothetical (가상 값) |
| 엔진 감사에 AUDIT_MASS 없음 | PASS | 없음 |
| 상수 등급 — 쓰인 상수가 문턱(parameter) 이상, 가상 값은 hypothetical 선언 아래에서만 | PASS | 문턱 parameter · 시나리오는 hypothetical (가상 값 허용) · 상수 2 (hypothetical 2) |

입력 해시 — 데이터 sha256:a363a74dc8cf6173 · 시나리오 sha256:fdc4fe0dbc6cdf0b · 궤적 sha256:2b8ec52b8c10b5f4

모의 실험 규약: 없음 — 탐색 실행 (검증 결론을 낼 수 없음)

**판정: PASS.** 이 실행의 모든 상태 변화는 데이터베이스의 규칙(신호 → 대사 공급 규칙 → 대사물 → 전사 인자 합성·분해)과 위 해시의 입력만으로 만들어졌다. 매 관찰 격자 단계에서 부분 구조 원장과 저장소 재생이 상대 1e-14 안에서 맞았고, 신호는 선언된 일정 그대로였다. 이 증명서는 계산의 무결성을 증명할 뿐, 가상 상수의 생물학적 타당성을 증명하지 않는다.

## 4. 인과 추적 (Post-mortem / Causal Trace)

- 목표 상태가 정해지지 않음 (구동된 전이가 없음) — 인과 추적 생략

### 예측과의 차이

- 없음 — 예측(구동된 전이의 목표)과 관찰이 같다

## 5. 기술 부록 (Technical Appendix)

| 지표 | 값 |
|---|---|
| 상수 등급 (신뢰 지표) | 문턱 parameter · 시나리오는 hypothetical (가상 값 허용) · 상수 2 (hypothetical 2) |
| 관찰 격자 Δ · 기간 | 60 s · 2.00 h (120 단계) |
| 부분 구조 원장 편차 (최대 · 끝) | 0 · 0 (허용 1e-14) |
| 저장소 재생 편차 (최대) | 0 |
| 결합 적분 (Rodas3) | rtol 0.000001 · atol 0.01 분자 · 받아들인 단계 248 · 거부 0 (음수 0) · 최소 단계 강제 0 · h 0.181–60 s · Δ 당 1–6 단계 |
| 혼성 확률 층 | hybrid: ssa (modified next reaction) · tau-leap (Cao) · rodas3 · 끝 방식 결정론 0 · 도약 0 · SSA 2 · SSA 발화 94 (막힘 0) · 도약 발화 0 (음수로 되돌림 0) · 분할 전환 0 · 난수 96 |
| 결정 탐침 | 0 (라운드 0, 동시 1 — 결과는 동시 수와 무관) |
| 부분 구조별 (시작 → 끝, 소실) | 니코틴아마이드 뉴클레오타이드 부분 0 → 0 (0)<br>아데노신 부분 0 → 0 (0)<br>인산기 단위 0 → 0 (0)<br>탄소 골격 단위 0 → 0 (0)<br>조효소 A 부분 0 → 0 (0)<br>플라빈 부분 0 → 0 (0) |
| 속도 상수 없음 (적용 안 함) | D000170/rule/aerobic_glycolysis, D000172/rule/palmitoyl_oxidation, D000171/rule/pyruvate_reduction, D000173/rule/atp_hydrolysis_load, D000148/rule/lumped_oxidation, D000157/rule/nad_regen, D000158/rule/fad_regen, D000166/rule/synthesis, D000166/rule/turnover, D000168/rule/export, D000160/rule/efflux |
| 힐 상수 없음 (배율 1) | D000163/rule/glycolysis_induction, D000165/rule/glycolysis_maintenance, D000164/rule/fao_induction, D000166/rule/fao_maintenance, D000163/rule/tbet_induction, D000165/rule/tbet_autoactivation, D000166/rule/tbet_antagonism, D000167/rule/tbet_licensing, D000134/rule/eomes_licensing, D000163/rule/eomes_repression, D000165/rule/eomes_antagonism, D000166/rule/eomes_autoactivation |
| 엔진 감사 | [AUDIT_CONCENTRATION] D000046|cytosol<br>[AUDIT_CONCENTRATION] D000144|cytosol<br>[AUDIT_CONCENTRATION] D000033|cytosol<br>[AUDIT_CONCENTRATION] D000037|cytosol<br>[AUDIT_CONCENTRATION] D000167|cytosol<br>[AUDIT_CONCENTRATION] D000145|cytosol<br>[AUDIT_CONCENTRATION] D000032|cytosol<br>[AUDIT_CONCENTRATION] D000169|mito_matrix<br>[AUDIT_CONCENTRATION] D000135|mito_matrix<br>[AUDIT_CONCENTRATION] D000144|mito_matrix<br>[AUDIT_CONCENTRATION] D000146|mito_matrix<br>[AUDIT_CONCENTRATION] D000134|mito_matrix<br>[AUDIT_CONCENTRATION] D000145|mito_matrix<br>[AUDIT_CONCENTRATION] D000147|mito_matrix<br>[AUDIT_CONCENTRATION] D000168|cytosol<br>[AUDIT_CONCENTRATION] D000160|mito_matrix<br>[AUDIT_CONCENTRATION] D000163|extracellular<br>[AUDIT_CONCENTRATION] D000164|extracellular<br>[AUDIT_CONCENTRATION] D000165|nucleoplasm<br>[AUDIT_CONCENTRATION] D000166|nucleoplasm<br>[AUDIT_RESOURCE] D000046|cytosol<br>[AUDIT_RESOURCE] D000169|mito_matrix |
