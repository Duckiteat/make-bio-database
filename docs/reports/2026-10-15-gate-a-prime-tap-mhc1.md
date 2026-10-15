# 관문 A′ 보고서 — MHC I 적재 차단 (build-plan 10, 2026-10-15)

판정 수준: **탐색 실행 — 결론 아님.** 0 층 구조 지지 + 모의 판정 맞음이지만, 사전 등록된 규약 아래의 검증이 아니다(이유는 아래 ④).

| Scope | Why | Impact | Verification |
|---|---|---|---|
| 정성 관찰 O000019 (de la Salle H et al., 1994, Science · DOI 10.1126/science.7517574 · PMID 7517574) | MHC I 적재 차단을 원 논문 관찰로 시험하는 첫 수직 한 줄 | 교란 knockout D000189(펩타이드 적재 복합체 — TAP1·TAP2 가 구성 요소) → 읽을 거리 D000191\|plasma_membrane(표면 펩타이드–MHC I) · 기대 decrease · 종 9606 | 원문 초록 사본 `data/fetched/europepmc/MED-7517574.json` (sha256 47e853b8…), 인용 구절이 초록에 그대로 있음 |
| ① 0 층 판정 (`qualgraph`) | 엔진 전 구조 걸러내기 | **구조 지지** — 경로 D000189 → 적재(peptide_loading) → D000191 소포체 → 소포체 이탈 → 골지 → 세포막 표면 전달, 부호 + (교란 − × + = 감소) | 반대 부호 경로 없음 |
| ② 모의 판정 (`observe`) | 대조군 대비 방향 | 대조군 `mhc-dc-immature-baseline-hypothetical.json`(상태 D000202) 대 교란군: 표면 MHC I 차이 −22,880 분자, 분해능 1.00(수치 오차 + 분자 1 개) → **맞음 (탐색)** | 교란 차이 검사 통과(교란 외에는 대조군과 같음) · 상수는 가상(hypothetical) |
| ③ 우연 기준선 | 맞힌 것이 우연 이상인가 | 판정 1 건 · 맞음 1 · 우연으로 맞힐 확률 1/3 — 한 건으로는 우연과 가를 수 없다 | 포아송 이항 |
| ④ 결론을 막는 것 | 지어내지 않음 | 초록에 표면 class I 을 잰 세포 유형·대조 세포가 없다 → 규약의 `matched_experiment.system.cell` 을 세울 수 없음. 모델은 수지상 세포(D000202)라 판정에 맥락 이전(V8)도 낀다 | 한계 L000107 (Observation_Gap) 등록 · `limitations --detect` 후보 0 |

## 다음에 필요한 것 (사용자에게)
- 원문 방법·그림 설명(DOI 10.1126/science.7517574)에서 표면 class I 을 잰 세포 유형과 대조군. 받으면: 그 세포를 condition.cell 에 적은 새 관찰(O+1) + O000019 철회 표시 → 그 세포 유형의 시나리오로 규약 선언 → `register` → `observe` (결론 판정).
- 판정 건수: 우연 기준선(1/3)과 가르려면 독립 실험(experiment)이 다른 정성 관찰이 더 필요하다 — 맞음 k 건 중 우연 확률이 α = 0.05 아래가 되려면 기대가 방향인 주장 3 건이 모두 맞아야 한다 ((1/3)³ ≈ 0.037).

## 재현
```
node dbtool.mjs qualgraph O000019
node dbtool.mjs observe O000019 --state D000202 --scenario examples/scenarios/mhc-dc-immature-baseline-hypothetical.json
```
