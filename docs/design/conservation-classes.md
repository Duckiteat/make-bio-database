# 보존 분류 — 왜 비보존인가 (오차 3채널의 기저)

> 모든 정량 양을 **보존(conserved)** 과 **비보존(non_conserved)** 으로 가르고, **왜 비보존인지(원인)** 를
> 통제 어휘로 못박는다. 이것은 오차 관리 3채널 doctrine(build-plan 20–25)의 **기저 원리**다 — 산문이 아니라
> 데이터로 둬, 지금은 참조되고 나중 적분장(27–37)이 코드로 분기할 수 있게 한다.
> 기원: 2026-10-16 토의 — "희소 텐서 고정소수점 파이프라인" 제안 → float 가 봉인을 깨지 않음을 확인 → 비보존을
> '정확히' 표현하려는 시도가 범주 오류임을 짚음 → **표현(고정소수점) 대신 분류·원인을 기저에 깔자**로 귀결.

## 1. 정의 — 표현 독립

> **보존 class = 보존 법칙이 존재한다(대조 가능, 목표 오차 0).**
> **비보존 class = 보존 법칙이 없다(정확한 참조 없음, 예산으로만).**

이 정의는 **표현에 독립**이다. 같은 "보존" 양이라도 정수 원장에선 정확-0(질량이 따로 없음), Rodas3 float
엔진에선 상대 1e-14 수지 감사로 근사된다 — 표현은 달라도 **"보존 법칙이 있나"** 는 같다. 그러니 class 는
숫자 표현이 아니라 **법칙의 유무**를 가리킨다.

중요: "보존"은 양이 **변하지 않는다**는 뜻이 아니다. 반응이 분자를 만들고 없애도, **수지(ΣIn=ΣOut)** 라는
대조 법칙이 있으면 보존 class 다.

## 2. 왜 고정소수점이 비보존의 답이 아닌가

제안됐던 "모든 정량을 10²⁰ BigInt 고정소수점으로"는 **범주 오류**다:

- **봉인은 float 로 안 깨진다.** SHA256 봉인은 정준 직렬화 데이터·판결을 해시하지 float 중간값을 해시하지
  않는다. 보존량은 정수 원장이라 구조상 정확하고, float 는 '정답 없는' 비보존 채널에만 산다. 백엔드 비트동일은
  별도 보증(고정 IR 테이프·FMA 금지·확률 경로 정수 초월함수 — build-plan 20·21).
- **거짓 정밀도.** 비보존은 *정확한 참조가 없음* 으로 정의된다. 유효숫자 2·σ 20%인 상수를 10²⁰ 자리로 적어도
  진실해지지 않는다. doctrine 이 비보존을 예산으로 추적하는 건 바로 그래서다.
- **속도·패러다임.** 뻣뻣한 Rodas3(야코비안 LU·exp/log/MM/Hill)는 실수 반복법이다. BigInt 고정소수점으로
  밀면 수십~수백 배 느려지고(LPS 벽 L000113 악화), 비트정확+정확도를 동시에 못 지킨다. 또 "두 코드 경로를
  섞지 않음"(build-plan 24) 규칙 위반.

→ **비보존의 올바른 취급은 더 좋은 숫자 표현이 아니라 — 예산(못 없애는 오차를 추적) + 격리(보존 장부·생물
상수에 안 섞기) + 정직(정확한 척 안 하기).**

## 3. 분류와 원인 (통제 어휘)

`vocab.conservationClasses`(2) · `vocab.conservationReasons`(7). 사전 register 로도 노출(16A — 병기·관문).

| class | reason | 뜻 |
|---|---|---|
| conserved | `substance_count` | 분자·부분구조 카운트 (질량 수지로 보존) |
| non_conserved | `rate_derivative` | 속도·도함수 (1/s, 보존 법칙 없음) |
| non_conserved | `intensive_potential` | 세기 변수 (ΔG·pH·온도 — 카운트 아님) |
| non_conserved | `derived_scaled` | 유도·환산 (농도 = 카운트 × cinv, 비율) |
| non_conserved | `sensitivity` | 민감도 (야코비안 ∂rate/∂N — 실체 아님) |
| non_conserved | `emergent_time` | 창발 시각 (event_time — 참조 없음) |
| non_conserved | `measured_parameter` | 측정·설정 입력 (kcat·Km·Kd·반감기·부피) |

observable 종에 부여(`vocab.observables[*].conservation`): amount=보존/substance_count · concentration·fraction
=비보존/derived_scaled · event_time=비보존/emergent_time · volume·kinetic_constant=비보존/measured_parameter.
내부 양(관찰 아님): rate=rate_derivative · ΔG=intensive_potential · 야코비안=sensitivity.

## 4. 왜 지금 박나 — 나중 적분장의 참조점

지금은 **데이터·원리**로만 둔다(강제 장치 미리 안 지음 — doctrine 규율). 이득은 **참조 가능성**:

- 나중 적분장(27–37)이 "이 양은 `conserved` → 정수 경로(i64 카운트), `non_conserved` → float+예산"을 **코드로
  분기**할 수 있다. 데이터가 쌓인 뒤 분류를 되짚지 않아도 되게, 미리 깔아 둔다.
- `NUMERICAL` fault 라우팅이 class 를 읽어 "보존 양의 오차 = 결함(0이어야)·비보존 = 예산"을 판정(나중).
- "두 코드 경로 안 섞음"이 **검사 가능**해진다(보존 양이 float LU 경로로 새면 깃발 — TIER-C).
- 보고서가 "이 결론은 보존(정확) vs 비보존(예산 ±x) 위에 선다"를 말한다.

## 5. 경계 (지금 vs TIER-C)

- **지금(작고 세다)**: class·reason 통제 어휘 + observable 분류 + 사전 register + 이 문서 + 일관성 시험. 반경 작음.
- **나중(장 엔진과 함께, TIER-C 27–37)**: 기계적 강제(보존 양이 float 경로로 새면 거부, NUMERICAL 라우팅이
  class 참조). 가장 세게 무는 곳에서 켠다 — 빈 강제 장치를 미리 짓지 않는다.

## 6. 지문

- **표현이 아니라 분류가 기저다.** float 가 봉인을 깬다는 오진에서 출발했지만, 결론은 "비보존을 더 정밀히
  적자"가 아니라 "**비보존을 비보존으로 정직하게 분류하고 예산으로 두자**"였다. 범주를 바로잡은 것이 알맹이다.
- **지금 데이터로 박아 나중 코드가 참조한다.** 분류를 미리 깔면 적분장이 생길 때 되짚지 않는다 — 신뢰 기반을
  수치 층에까지 민 것(`abstraction-boundary.md`·북극성과 같은 말).
