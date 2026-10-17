# HANDOFF — TASK-002 사람 유리 IκBα 기저 분해 반감기 (2026-10-17)

> 대상: 한계 **L000025** · 규칙 `D000086/rule/basal_turnover` (Kinetic_Gap, 요구: half_life). 수집가 기록(상태 collected).
> 기계 검증용 `workspace/handoff/ikba-halflife.jsonl` → `verify-collection` 결과 **REVIEW_REQUIRED (5건, 구조 통과)**.

## 후보 표

| # | 반감기 | 종·세포·조건·측정 | 불확도 | 출처+인용 | 사람? | 상태 |
|---|---|---|---|---|---|---|
| 1 | ≤10 min (상한) | 사람 IκBα 전이유전자 · **생쥐** nfkb-null 세포 · CHX chase | 없음(상한 표현) | Mathes et al., EMBO J 2008, PMID 18401342 · "shows a remarkably short half-life of 10 min or less" | 아니오(세포 생쥐) | collected · 모호 |
| 2 | ~7 min | 사람 IκBα 전이유전자 · **생쥐** nfkb3KO MEF(유리형) · CHX chase, 2회 통합 적합 | SD 없음 | Truhlar et al., J Mol Biol 2008, PMID 18511071 · "WT IκBα was degraded with a half-life of ~7 min" | 아니오(세포 생쥐) | collected · 값 후보 |
| 3 | 5–10 min (범위) | **생쥐** MEF(nfkb1/rela/crel 결손) · IκB 계열(IκBα 전용 아님) | 없음·방법 미기재 | O'Dea et al., Mol Syst Biol 2007, PMID 17486138 · "Half-lives for free IκB proteins were determined to be 5–10 min" | 아니오 | collected · 모호 |
| 4 | <15 min | **생쥐** 3T3 · GFP-IκBα 절편(210–317) · CHX chase, n=3 | SD | Fortmann et al., J Mol Biol 2015, PMID 26191773 · "the fusion protein showed a half-life of less than 15 minutes" | 아니오·절편 | collected · 전장 아님 |
| 5 | — | **사람** 세포(HeLa·HEK293·THP-1·U937 등) 유리 IκBα | — | 웹 검색 결과에 없음 | — | **없음** |

## 참고 리드 (수집했으나 1차 확인 전이라 후보 표에 넣지 않음)

- eLife 부록 그림의 "free IκBα ~5 min, CHX chase, NF-κB 결손 세포" — 원 논문·세포종 식별 못 함. 값만 보고 출처 없음.
- Pando & Verma 2000(J Biol Chem): "bound IκB 가 unstimulated 세포에서 free 보다 5배 길다" 는 O'Dea 2007 의 인용문. 원문 미확인.
- "bound 형은 IKK 인산화 없이 >12 h" (Truhlar 2008 리뷰 인용) — 결합형 값이며 기저 유리형 아님.
- 2010년대 바이오센서 ~35 min 은 TNFα 자극 후 분해 값. 기저 유리형 아님 — 넣으면 안 됨.

## 판정

1. **사람(9606) 세포에서 측정한 유리 IκBα 반감기는 찾지 못했다** (웹 검색 한정 — 커버리지 보장 아님, 통합가 재검색 필요). 가장 가까운 값은 **사람 IκBα 전이유전자를 생쥐 세포에서 잰 ~7 min(#2)·≤10 min(#1)** 으로, 사람 단백질이지만 세포가 생쥐라 사람 칸에는 못 쓴다 (통합가가 "사람 단백질·생쥐 세포" 를 어떻게 둘지 정할 것).
2. 공통으로 빠진 것: 사람 세포 측정, SD/n 이 있는 단일 값, 조건(유리 vs 결합) 명시. #2 는 SD 없이 두 실험 통합 적합이라 불확도가 없다.
3. 채움 가능성: 사람 값이 나오기 전까지 L000025 는 open 유지 권고. 다음 리드는 O'Dea 2007 전문 Figure 2C/S2 의 세포종 확인과 Pando & Verma 2000 원문.

---

## 통합가 검증 (Opus, 2026-10-17)

게이트: `verify-collection --check-sources` → **REVIEW_REQUIRED** (REJECTED 없음 — 값마다 출처+인용 있어 근거
없는 값 아님; 모두 1차 출처 재확인 필요). PMID 는 수신함에 없어 error→review(정상).

**독립 재확인 (1차 출처 — Europe PMC REST, sanctioned 출처):**
- **#2 Truhlar 2008 (PMID 18511071)**: 논문 **실재 확인** — "Pre-folding IκBα alters control of NF-κB signaling",
  J Mol Biol 380(1), 2008. 출처 날조 아님. **그러나 인용문 "WT IκBα … half-life of ~7 min" 이 초록에 없다** —
  본문(유료)에 있을 수 있으나 **접근 가능 출처로는 검증 불가**(꼼수 #5 영역: 날조 단정 아니나 미검증). MeSH 는
  Mice·Humans 둘 다(결정적 아님). → **값으로 승격 불가**(전문 접근 전까지).

**판정:**
- 후보 #1~#4 는 전부 **생쥐(10090) 세포**(또는 절편·IκB 계열)라 사람 규칙 `D000086` 에 **쓸 수 없다** — 수집가가
  종을 바르게 표시함(사람 단백질·생쥐 세포). #2 인용은 위처럼 미검증까지 겹침.
- 사람(9606) 값 = **not_found**(수집가 정직). 커버리지(정말 없나)는 자동 불가 → 통합가 재검색/사람(RETRIEVAL).
- **결론: 넣을 사람 값 없음 → L000025 open 유지, db 변경 없음.** 상태 collected → **verified(통합가): 사용 불가·공백 확정.**

**수집가 평가:** 격리 준수(workspace 만 씀)·종 정직 표시·not_found 정직·리드 제공 — 규율 지킴. 유일한 과다주장
(#2 인용을 검증된 듯 제시)을 **게이트가 아니라 통합가 1차 출처 재확인이 잡았다** — 설계대로(결과 재-도출이 과정
검증을 대신한다).

---

## 재수집 — SOURCES 가이드 적용 (2026-10-17)

> 근거: `workspace/SOURCES.md` 규칙 1 — 인용·값은 Europe PMC(PMID)·UniProt 이 반환한 내용에서만. 웹 검색 스니펫·2차 리뷰 금지.
> 기계 기록: `workspace/handoff/ikba-halflife-sources.jsonl` (8행) → `verify-collection` **PASS** (자동 조건 충족; 과학적 진실·승인 아님).
> 위 원본 표(collected)의 값 행은 **철회**한다. 이전 `ikba-halflife.jsonl` 은 기록으로 남긴다.

### 철회 사유

- #2 "~7 min" 인용은 Europe PMC 초록(PMID 18511071)에 없다. 이전 수집이 쓴 출처는 웹 요약이었다.
- #1 "≤10 min" 과 #3 "5–10 min" 도 초록에 없다. 검색 스니펫·2차 인용에서 왔다.
- #4 "<15 min" 은 GFP 절편 값이라 전장 유리 IκBα 가 아니다.
- 사람 세포 값은 여전히 없다.

### 초록 확인 결과 (Europe PMC, 읽고 값 없음 = `read_no_value`)

| PMID | 논문 | 초록에서 확인한 것 | 반감기 수치 | 상태 |
|---|---|---|---|---|
| 18401342 | Mathes 2008, EMBO J | 유리형 분해는 PEST 의존·IKK 비의존 | 없음 | 전문 필요 |
| 18511071 | Truhlar 2008, J Mol Biol | 유리형은 프로테아좀 의존·유비퀴틴 비의존 분해 | 없음 (~7 min 은 초록에 없음) | 전문 필요 |
| 17486138 | O'Dea 2007, Mol Syst Biol | "newly measured in vivo degradation rate constants" 주장 | 없음 | 전문 필요 |
| 26191773 | Fortmann 2015, J Mol Biol | 11 aa 유비퀴틴 비의존 degron, 짧은 반감기 | 없음 | 전문 필요 |
| 8978697 | Scherer 1996, EMBO J | 기저 turnover 는 ankyrin 핵심 도메인 의존 | 없음 | 전문 필요 |
| 10764587 | 2000, J Mol Biol | 휴지 세포에서 유리 IκBα turnover 는 S293 의존 | 없음 | 전문 필요 |
| 20055496 | 2010 리뷰, Biochemistry | "quantitative protein half-life measurements" 언급 | 없음 | 리뷰 — 원 논문 추적 |

### 검색 (Europe PMC 검색어 3개, 초록 기준)

- `IkappaBalpha AND half-life AND (free OR unbound)` — 128건 중 위 목록 외 관련 반감기 수치 없음
- `"IkappaB alpha" AND "half-life" AND (HeLa OR HEK293 OR human OR THP-1 OR U937 OR Jurkat)` — 사람 세포 측정 없음
- `IkappaBalpha degradation rate constant free bound NF-kappaB in vivo` — 수치 없음

### 판정

1. **사람(9606) 세포에서 측정한 유리 IκBα 반감기는 초록 수준에서 찾지 못했다.** 이번에 확인된 수치는 0건이다.
2. 반감기 숫자가 실제로 들어 있을 가능성이 있는 논문은 **전문이 필요하다**: 18511071 (Truhlar 2008, PMC 열람 가능 확인), 17486138 (O'Dea 2007, 속도 상수 측정), 18401342 (Mathes 2008, 전문 "~8 h vs ~10 min" 언급), 8978697 (Scherer 1996, 세포 종 확인 필요).
3. 통합가에게 넘기는 리드: O'Dea 2007 의 측정 세포와 방법, 그리고 Mathes 2008 의 "~10 min" 이 사람 세포인지 생쥐 세포인지. 둘 다 전문에서만 확인된다.
4. L000025 는 open 유지 권고. db 변경 없음.
