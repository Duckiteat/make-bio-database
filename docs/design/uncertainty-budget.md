# 불확도 예산 칸 · 실험실 자료에서 기준 만들기 — 설계 초안 (논의 중)

> 상태: **구현됨 2026-11-18 (DEC-0061 · DEC-0062)** — 형식은 SCHEMA §8H/§8P "불확도 예산". 아래 §2 초안과 다른 점: `dof` 는 넣지 않음(쓰는 곳이 생길 때 — RULE-0462) · B 형 출처는 `cite { db, id }` · 출처 없는 B 형은 경고 + D3.obs_bare. 형식(SCHEMA)은 아직 바꾸지 않았다. 결정이 나면 DEC 로 남기고 ASY-08 의 남은 일(불확도 예산 칸 · 추적성 칸)로 구현한다(RULE-0261 — 계약 · 정규화 · 사법부 · 시험이 함께).
> 출발점: `docs/reports/2026-11-18-labnote-nadh-a340-limits.md` — 실험 노트 하나를 지금 형식에 넣어 보니 해상도 sd 가 실제 불확도를 수백 배 작게 잡았다.

## 1. 지금 형식과 모자란 곳

지금: `uncertainty { kind: measurement|biological|combined, model, sd, basis?: reported|resolution }` + `replicates` + `replicate_type` + `calibration`.

| 모자란 곳 | 결과 |
|---|---|
| sd 가 숫자 하나 — 어디서 왔는지 모름 | 효소 농도 10 % 와 판독 잡음 1 % 가 섞여 어느 쪽을 줄여야 하는지 못 봄 |
| 반복으로 주는 오차와 안 주는 오차가 안 갈림 | 원액 순도 5 % 오차도 √n 으로 나눠 과신 |
| 해상도 sd 가 유일한 성분이 될 수 있음 | 유효 숫자를 과장한 원문이 매우 정밀해 보임 (지금은 D3.obs_bare 로 판정에서 빼서 막고 있음) |
| 같은 원액·같은 표준곡선을 공유한 값들이 독립으로 보임 | 여러 값 합의(ASY-16)에서 근거를 이중으로 셈 |

## 2. 제안 — `uncertainty.budget` (선택 칸)

```jsonc
"uncertainty": {
  "kind": "combined", "model": "normal",
  "sd": 0.68,                      // 합성 표준 불확도 — budget 이 있으면 계산값과 같아야 함 (사법부 검사)
  "basis": "budget",               // 새 값: reported | resolution | budget
  "budget": [
    { "source": "readout",            "effect": "random",     "type": "A", "u_rel": 0.02,  "dof": 4,  "from": "반복 판독 5 회" },
    { "source": "calibration",        "effect": "systematic", "type": "A", "u_rel": 0.015, "dof": 3,  "from": "표준곡선 적합 잔차" },
    { "source": "reference_material", "effect": "systematic", "type": "B", "u_rel": 0.03,  "shared": "NADH-lot-2026-10", "from": "제조사 순도 규격 (출처 필요)" },
    { "source": "volumetric",         "effect": "random",     "type": "B", "u_rel": 0.006, "from": "피펫 규격 (출처 필요)" },
    { "source": "propagated",         "effect": "systematic", "type": "B", "u_rel": 0.10,  "ref": "O……(효소 농도 관찰)" },
    { "source": "resolution",         "effect": "random",     "type": "B", "u": 0.0003 }
  ]
}
```

| 칸 | 뜻 | 근거 |
|---|---|---|
| `source` | 성분 종류 — readout · calibration · reference_material · volumetric · matrix · repeatability · resolution · propagated · other (어휘 표) | GUM §4 · 이 노트의 L1–L8 |
| `effect` | **random**(반복으로 줄어듦) · **systematic**(같은 원액·곡선이면 반복해도 그대로) | 이 설계의 핵심 |
| `type` | A(이 자료의 반복에서 통계로) · B(규격·문헌·판단에서) | GUM 4.2 · 4.3 |
| `u` 또는 `u_rel` | 표준 불확도(값과 같은 단위) 또는 상대값 — 하나만 | |
| `dof` | 자유도 — 합성 자유도(Welch–Satterthwaite)와 확장 불확도 k 에 | GUM G.4 |
| `shared` | 공유 열쇠(원액 로트 · 표준곡선 번호) — 같은 열쇠를 가진 값끼리는 그 성분이 상관 → 합의에서 독립으로 세지 않음 | ASY-16 · 같은 측정 깃발 |
| `ref` | 전파된 양의 관찰 번호 | |
| `from` | 이 성분을 어떻게 얻었나 (B 형은 출처 필수 — 아래 규칙 3) | RULE-0494 |

### 사법부 검사 (제안)

1. `basis: budget` 이면 `sd = √Σ u²` (상관 없음 가정; `shared` 끼리는 한 관찰 안에서는 더함) — 원문 자리수(`reported`)와 함께 검사.
2. **해상도는 성분일 뿐 바닥이 아니다**: budget 이 resolution 하나뿐이면 `basis: budget` 을 받지 않음(그건 지금의 `resolution` 과 같음 — 등급이 그대로 D3.obs_bare).
3. **B 형 성분은 출처가 있어야** 판정에 들어간다 — 출처 없는 B 형(에이전트·작성자 추정)은 저장은 하되 `assumed` 로 드러나고 등급을 올리지 않음.
4. 판정에서 평균의 불확도 = √(Σ random² / n + Σ systematic²) — systematic 은 반복 수로 나누지 않음 (지금 resolution 을 나누지 않는 것과 같은 원리를 일반화).
5. budget 이 없는 옛 관찰은 그대로 받음 (선택 칸 — 이관 없음, RULE-0470 점진).

## 3. 실험실 자료 → 기준(standard) 만들기 — 길

지금 막는 것: 관찰·측정법의 출처는 DOI · PMID · ISBN · URL 뿐 (RULE-0115 · 0291 · 0344) — 실험실 원자료는 들어올 문이 없다. 그런데 최종 목표(DEC-0043)가 "GMP 아래서 만든 자료를 담고 판정하는 그릇" 이므로, 실험실 자료의 문(ASY-10)은 원래 계획에 있다.

| 단계 | 무엇 | 계획 | 실험실 자료가 많으면 |
|---|---|---|---|
| ① 문 | 출처 종류 `LAB` — 원자료 파일(sha256) · 측정 시각 · 분석자(가명) · 기기 · 원액 로트 · 검토자. 문헌과 다른 등급 | ASY-10 (일부를 앞당김) | 들어올 수 있게 됨 |
| ② 예산 | 위 §2 — 원자료에서 A 형 성분을 직접 계산 | ASY-08 | 추정(B)을 측정(A)으로 바꿈 |
| ③ 검증 | 반복성 · 중간 정밀도(날·사람·로트를 바꿔) · 직선성 · 검출·정량 한계 | ASY-09 (ICH Q2) | **여기가 자료 양이 필요한 곳** |
| ④ 기준값 | 독립 실행들의 가중 합의 + 흩어짐 검정(χ²/자유도) — 계산, 저장 안 함 | ASY-16 | 실험실 고유의 기준값 ± 불확도 |

어려운 곳은 코드가 아니라 **원자료**다 — 이번 노트에는 흡광도 원값 · 반복 · 원액 로트가 없어서 ②③을 못 한다. 그래서 자료를 모으기 전에 **한 번의 측정마다 남길 최소 기록표**를 먼저 정하는 게 순서다 (§4 질문 3).

## 4. 결정 (DEC-0061 · 2026-11-18)

| 질문 | 답 | 이 초안에 미치는 것 |
|---|---|---|
| 실험실 자료를 출처로 받나 | **측정법 검증 재료로만** | §3 ① 문(LAB 출처)은 열지 않음 — 실험실 자료는 ASY-09 검증과 §2 의 A 형 성분 계산에만. 출처 규칙(RULE-0115 · 0291 · 0344) 그대로 |
| `effect` 필수? | **필수** | 사법부: budget 의 성분마다 random/systematic 이 없으면 거부 |
| 기록표부터? | **먼저 만든다** | `docs/templates/nadh-a340/` (v0.1) |
| 기준의 뜻 | **셋 다** — 실험실 고유 기준값 · SOP · 자료 형식 표준, **GMP · NCS 에 맞춰**, 나중에 **LIMS 연동** | 기록표 칸에 영어 열쇠(LIMS) · ALCOA+ 원칙. NCS 요건 대조는 남음 |

## 5. 다음

1. 기록표 v0.1 을 실험실에 주고 한 회분을 받아 본다 — 빠진 칸을 찾는다.
2. 받은 자료로 §2 형식을 시험(구현 전 손계산) → 형식 확정 → 계약·정규화·사법부·시험 (ASY-08 남은 일).
3. NCS 해당 능력단위 · GMP 기록 요건과 기록표 대조 (조사 — 출처 있는 문서로).
