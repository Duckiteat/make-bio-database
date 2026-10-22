# TASK-004 — 사람 텔로미어 정량 측정 (종류 H, 정량 검증)

먼저 `workspace/START-HERE.md` 와 `workspace/SOURCES.md` 를 읽어라.

**왜 이 과제**: 지금 데이터베이스에 **정량 검증(use: validation) 관찰이 0 건**이다(`node dbtool.mjs limitations --coverage` 로 확인 — 6/6 측정량이 "정량 사각"). 엔진의 숫자 예측을 현실 숫자로 반박할 길이 아직 없다. 이 과제는 **첫 정량 검증값**을 모은다. 텔로미어를 고른 이유: 이미 **정성으로 검증된 축**이다(O000027, Bodnar 1998 — telomerase 차단 → 길이 감소). 같은 축을 정량으로 끌어올리면 가장 성공 가능성이 높다.

**대상 모델**: 섬유아세포 텔로미어 — 정의항 `D000210`·`D000211` (있으면 `map 텔로미어`·`context D000210` 로 확인). 시나리오 `examples/scenarios/telomere-*.json`.

**임무(묶음 하나)**: **사람(9606) 섬유아세포**의 아래 **정량** 중 하나 이상을, 조건·불확도와 함께 수집해라:
1. **텔로미어 길이** (kb 또는 bp) — 특정 세포·계대에서.
2. **소실률** (bp / 세포 분열, bp/PD).
3. **복제 수명** (노화까지 population doublings — Hayflick 한계).
4. (있으면) telomerase 재도입 시 길이·수명의 **배수 변화**(fold-change).

**반드시 1차 출처 API(Europe PMC[PMID])가 반환한 초록에서만** — 웹 스니펫·2차 리뷰 금지(TASK-002 교훈). 초록에 숫자가 없으면 "전문 필요"로, 지어내지 마라. BioNumbers 는 엔드포인트 미확정이라 "통합가 필요"로 표시.

**각 후보에 반드시**: 값·단위(SI 로 환산 가능하게 원값+단위) · 종(9606)·세포주·계대·조건 · 측정 방법(TRF·qPCR·Q-FISH 등) · 불확도(sd·범위)·반복/표본 수 · 출처(PMID)+**원문 인용구** · "검증용으로 쓸 수 있나? 빠진 것".

**좋은 출발 PMID**(초록 확인용, 값이 거기 있는지는 네가 판정): Bodnar 1998(PMID 9454332 부근) · Harley 1990(텔로미어 길이 vs 나이·계대) · Allsopp 1992(섬유아세포 복제 수명 vs 텔로미어 길이). 검색어 예: `telomere length fibroblast kb passage`, `telomere shortening rate base pairs per division human`, `replicative lifespan population doublings telomere`.

**반환**:
- `workspace/handoff/HANDOFF-telomere-quantitative.md` — 후보 표(상태 collected) + 3~5줄 판정(가장 검증에 가까운 후보 / 공통으로 빠진 것).
- `workspace/handoff/telomere-quantitative.jsonl` — 기계 검증용, 한 줄 한 후보(START-HERE §3 계약). 값 적으면 반드시 source+quote. 못 찾으면 `not_found`, 접근 못 하면 `unreadable`.

**통합가(상위 AI)가 할 일(네 몫 아님)**: `verify-collection` → Europe PMC 1차 출처 재확인 → 측정량 종류(amount·ratio·event_time 등) 매핑 → 사전 등록 규약으로 패치. 너는 **정확한 수집**만 — 적용·판정·커밋 금지.
