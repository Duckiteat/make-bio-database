# 핸드오프 템플릿 — 수집가 → 통합가 (복사해서 `HANDOFF-<주제>.md` 로 쓴다)

> **이 파일은 수집·검증 상태를 담는 작업 큐이자 기록이다.** 신뢰 저장소(db.json)가 아니다 — 수신함처럼
> **해석·수집만**, 적용은 통합가가 패치로 한다. 더 싼 모델(수집가)이 여기에 후보를 모으고, 통합가(Opus/사람)가
> 1차 출처로 검증해 패치로 적용한다. 설계: `docs/PROMPTS.md`(수집가·통합가 두 역할) · `docs/RUNBOOK.md` §2.
> (수신함 `data/fetched/` 는 쓰기 보호다 — 원본 대조는 `augment plan→fetch→build→apply` 고리로만. 이 핸드오프
> 파일은 그 밖의 작업 큐라 AI 작업자 전용 공간 `workspace/handoff/` 에 둔다 — `workspace/README.md`.)

## 역할 분리 (깨면 안 되는 선)

- **수집가 (Sonnet 등 — 싼 모델):** 읽기·조회·분석·문헌 수집만. 후보를 아래 표에 `collected` 로 넘긴다
  (서브에이전트면 **파일에 쓰지 말고 반환**, 상주 세션이면 이 표에 append). **금지**: `augment apply`·`merge`·
  `register` · `git commit`·`git push` · 규칙·코드 파일(vocab·model·core·judicial·legislative) 수정 · db.json
  직접 편집 · 남의 행 수정.
- **통합가 (Opus/사람):** 각 후보를 **1차 출처(PMC 전문·UniProt 큐레이션)로 직접 재확인**(수집가 값은 전부
  "후보"다 — 베끼지 않는다). 통과분만 패치 → `validate` → `augment apply` → 커밋. 상태를 바꾼다.

## 후보 표

| # | 대상(D…/rule·O…) | 측정량·값·단위 | 종·세포·시각·불확도 | 출처(DOI/PMID)·원문 인용 | 현재 use | 규약 가능? 빠진 것 | 상태 |
|---|---|---|---|---|---|---|---|
| 1 | | | | | estimation | | collected |

상태 흐름: `collected`(수집가) → `verified`/`rejected`(통합가, 사유) → `applied`(통합가, 패치 번호·커밋).

## 판정 메모 (수집가가 표 아래에 남김)

- 규약을 세울 수 있는 후보가 있나? 가장 가까운 것·빠진 것.
- 전부 막혔다면 공통으로 빠진 것(use=validation 부재·음성 대조 부재·측정 시각 부재 등) → 그 공백 자체가
  통합가가 한계로 등록할 데이터.
