# TASK-003 — 사람 TCA 회로 효소 kcat·Km (종류 K)

먼저 `workspace/START-HERE.md` 를 읽어라.

**대상**: 한계 **L000038** · 경로 `D000148`(시트르산 회로).

**임무(묶음 하나)**: 시트르산 회로 효소들의 **사람(9606)·미토콘드리아 기질 kcat·Km** 을 수집해라.
단, **일부는 이미 채워져 있다**(O000001–O000026 에 oxdecarb·hydrate·condense·isomerize 등). 그러니:

1. 먼저 **아직 kinetics 가 없는 규칙을 확인**해라:
   ```bash
   node dbtool.mjs mechanism 시트르산회로     # 단계·규칙 목록
   node dbtool.mjs context D000148            # 경로의 규칙·관찰
   ```
2. kcat·Km 이 **없는** 효소 단계에 대해서만 사람 실측값을 찾아라(이미 있는 건 건너뛴다 — 중복 수집 금지).

**각 후보에 반드시**: 효소·규칙(D…/rule/…) · kcat(s⁻¹)·Km(M) · 종(9606)·조건·측정 방법 · 불확도·반복 수 ·
출처(DOI/PMID)+**원문 인용구** · "채움 가능? 빠진 것". 다른 종 값이면 "사람 아님"으로 따로.

**반환**: `workspace/handoff/HANDOFF-tca-enzyme-kinetics.md` 표(collected) + 3~5줄 판정(어느 효소가 채울 수 있고
어느 게 사람 값이 없나).
