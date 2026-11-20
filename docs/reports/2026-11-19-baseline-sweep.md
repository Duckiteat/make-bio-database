# 기초시험 일괄 실행 — 시나리오 43 개 (2026-11-19)

- 모드: `baseline` · 코어: 커밋 4065932 · 데이터 sha256:a363a74dc8cf6173
- 대상: `examples/scenarios/subjects.json` 그대로 (세포 상태 → `fate --report`, 경로 → `simulate --rate`, 확률 → `fate --ensemble 50`)
- 실행마다 원본 출력: `docs/reports/2026-11-19-baseline-sweep/` (`*-fate.md` 과정 보고서 · `*-ensemble.md` 앙상블 · `*-run.md` 경로·실패 출력)
- 상수는 전부 가상(hypothetical) — 결과는 기전이 그 값에서 어떻게 흐르는지만 말한다. 사전 등록된 5 개 외에는 탐색 실행이라 검증 결론을 낼 수 없다.
- 판정(맞음·틀림·보이지 못함·무효)은 inspect 모드의 `evidence` 일 — 여기서는 하지 않았다.

## 1. 운명 (세포 상태) — 무결성 PASS

| 시나리오 | 시작 | 결과 | 예측 대비 |
|---|---|---|---|
| fate-effector-il12 | D000174 | 효과기 CD8 T 도달 2.00 h | 일치 |
| fate-effector-pulse-long | D000174 | 효과기 CD8 T 도달 2.00 h | 일치 |
| fate-effector-pulse-short | D000174 | 시작 상태에 머묾 (signal_insufficient) | 일치 |
| fate-effector-glucose-withheld | D000174 | 분화 정지 (resource_exhaustion) | 일치 |
| fate-memory-il15 | D000174 | 기억 전구 도달 6.82 h | 일치 |
| fate-memory-fa-withheld | D000174 | 시작 상태에 머묾 (resource_exhaustion) | 일치 |
| fate-mixed-optimal | D000174 | 효과기 도달 2.01 h | 일치 |
| fate-mixed-glucose-withheld | D000174 | 기억 전구 도달 21.67 h | 일치 |
| mhc-dc-maturation-lps | D000202 | 성숙 수지상 세포 도달 0.84 h (Δ 60·30·15 s 같음) | 일치 |
| mhc-dc-immature-baseline | D000202 | 시작 상태에 머묾 | 일치 |
| mhc-dc-empty-start | D000202 | 시작 상태에 머묾 | 일치 |
| mhc-dc-lps-pulse-short | D000202 | 시작 상태에 머묾 | 일치 |
| mhc-dc-antigen-withheld | D000202 | 시작 상태에 머묾 (kinetic_stall) | 일치 |
| mhc-dc-antigen-surge-stress | D000202 | 분화 정지 (resource_exhaustion) | 일치 |
| mhc-dc-cathepsin-null | D000202 | 시작 상태에 머묾 (resource_exhaustion) | 일치 |
| mhc-dc-hladm-null | D000202 | 시작 상태에 머묾 (resource_exhaustion) | 일치 |
| **mhc-dc-mature-antigen** | D000202 | **미결정** | **다름** — 예측 성숙 수지상 세포 |
| telomere-hayflick | D000210 | 복제 노화 도달 1880.95 h | 일치 |
| telomere-law-isolation | D000210 | 복제 노화 도달 1800.00 h | 일치 |
| telomere-sharp-threshold | D000210 | 복제 노화 도달 1885.39 h | 일치 |
| telomere-mitogen-withheld | D000210 | 시작 상태에 머묾 | 일치 |
| telomere-telomerase | D000210 | 시작 상태에 머묾 (kinetic_stall) | 일치 |
| lps-tnf-validation | D000212 | 미결정 (사전 등록 없음 — 탐색) | 일치 |

## 2. 사전 등록된 검증 시나리오 (규약 확인 PASS — 등록 해시 일치)

| 시나리오 | 등록 | 결과 | 무결성 |
|---|---|---|---|
| mhc-i-b2m-validation | #1 | 시작 상태에 머묾 · 예측 일치 | PASS 14/14 |
| mhc-ii-hladm-validation | #3 | 시작 상태에 머묾 · 예측 일치 | PASS 14/14 |
| telomere-telomerase-validation | #4 | 시작 상태에 머묾 (kinetic_stall) · **예측과 다름** | PASS 14/14 |
| mhc-i-tapasin-validation | #2 | 시작 상태에 머묾 · 예측과 다름 | **FAIL 13/14** — 맥락 선언: requirement 의 대상이 시작 상태(D000202) |
| telomere-quiescence-validation | #5 | 시작 상태에 머묾 · 예측(복제 노화)과 다름 | **FAIL 13/14** — 맥락 선언 "일반 상황" 인데 전이 신호(D000211)가 켜짐 |

검증 결론(일치·불일치)은 inspect 모드에서 우연 기준선과 함께 낸다. FAIL 인 둘은 실패로 보고한다 (RULE-0184) — 등록된 시나리오라 고치면 등록이 깨진다.

## 3. 확률 — 앙상블 50 궤적 (궤적 하나로 결론 금지, RULE-0176)

| 시나리오 | 끝 상태 비율 (95% Wilson) | 도달 시각 (평균 ± sd · 10–90%) | 결정론 대비 |
|---|---|---|---|
| mhc-dc-maturation-stochastic | 성숙 50/50 (92.9–100%) | 0.83 ± 0.01 h · 0.81–0.84 h | 결정론 0.83 h 와 같음 |
| stochastic-mixed-optimal | 효과기 50/50 (92.9–100%) | 2.01 ± 0.02 h · 1.98–2.04 h | 결정론 2.01 h 와 같음 |
| telomere-stochastic-attrition | 복제 노화 49/50 (89.5–99.6%) · 미결정 1/50 | 1896 ± 201 h · 1681–2182 h | 결정론 1880.95 h |
| stochastic-birth-death | 상태 없음 50/50 | 표지 D000165 평균 37.6 · Fano 0.91 (포아송 ≈ 1) | 결정론 끝 상태 없음 |

모든 앙상블: 궤적별 원장·재생·음수 PASS 50/50 · seed 재현 PASS.

## 4. 경로 (`simulate --rate`, 60 s, Δt 0.001 s)

| 시나리오 | 경로 | 결과 | 비고 |
|---|---|---|---|
| camp-competition | D000051 | ATP 0.05 s · GTP 0.1 s 에 고갈 | 시작량 기본값 (농도 공백, RULE-0081) |
| gtp-exhaustion | D000051 | GTP 0.002 s 고갈 | 공급 없음 — 의도된 고갈 (결과, RULE-0134) |
| gtp-regeneration | D000051 | 60 s 까지 정지 없음 (최고 2.66e4 바퀴/s) | AUDIT_CONCENTRATION 2 · **AUDIT_MASS (DOMAIN_CONFLICT) S000003** |
| lps | D000102 | 10.98 s 정지 — 중간물 고갈 (피로인산) | — |
| tca-acetylcoa-exhaustion | D000148 | 60 s 까지 정지 없음 (8.1e-9 바퀴/s) | 아세틸-CoA 1000 → 990 |
| tca-nad-exhaustion | D000148 | 60 s 까지 정지 없음 | NAD⁺ 변화 없음 |
| tca-co2-equilibrium | D000148 | 60 s 까지 정지 없음 (0.50 바퀴/s) | — |
| tca-measured-kinetics | D000148 | 60 s 까지 정지 없음 (26.6 바퀴/s) | — |

## 5. 실행이 판정되지 않은 것

| 시나리오 | 증상 | 태그 가정 | 갈 곳 |
|---|---|---|---|
| mhc-i-b2m-null | rc=1 · 원자료 계약 위반 `$.facts[0].kind = "excluded"` ∉ 스키마 열거 | ENGINE_DEFECT 또는 COMPILER_DEFECT (스키마와 산출이 어긋남) | develop |
| mhc-i-tap-null | 같음 | 같음 | develop |
| mhc-dc-plc-from-components | 무결성 FAIL 11/12 — requirement 의 대상이 시작 상태 | 시나리오 선언 | 사용자 결정 |

## 6. 공통 감사·한계

- MHC 계 전부: AUDIT_RESOURCE 6 (D000181 · D000184–D000188, 소비만) — 열린 한계 L000074 · L000075 · L000078 · L000080 범위.
- lps-tnf-validation: AUDIT_RESOURCE 10 · AUDIT_CONCENTRATION 1 · AUDIT_SCHEMA 1.
- stochastic-birth-death: AUDIT_CONCENTRATION 20 · AUDIT_RESOURCE 2.
- 끝 감사 목록이 비어 있지 않은 실행은 결과보다 감사를 먼저 읽는다 (RULE-0455). 아무것도 고치지 않았다.
