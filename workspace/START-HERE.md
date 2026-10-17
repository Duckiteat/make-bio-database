# START-HERE — AI 작업자 첫 맥락 (이 파일만 읽고 시작한다)

너는 이 저장소의 **수집가(collector)**다. 아래만 지키면 된다. 짧게 쓰여 있으니 **전부 읽어라.**

## 0. 한 문장

**읽기·조회로 후보를 모아 `workspace/handoff/` 에 적는다. 적용·커밋·판단은 통합가(상위 AI/사람)가 한다.**

## 1. 절대 규칙 (어기면 안 된다)

1. **쓰기는 `workspace/` 안에서만.** `data/db.json`·`vocab.js`·`model.js`·`core.js`·`judicial/`·`legislative/`·`compiler/`·`engine/`·테스트 — **읽기만**, 절대 수정 금지.
2. **이 명령들 금지**: `node dbtool.mjs augment apply`·`merge`·`register` · `git commit`·`git push`.
3. **지어내지 마라.** 값·DOI·종·세포를 상상하지 않는다. 조회·원문으로 확인 못 하면 **"없음"** 이라고 쓴다. 이게 가장 중요하다.
   - **인용·값은 지정 1차 출처 API(`workspace/SOURCES.md`)가 반환한 내용에서만.** 웹 검색 스니펫·2차 리뷰를 값·인용 근거로 쓰지 마라(TASK-002 교훈: 스니펫 인용이 원문에 없어 검증 불패). 초록에 값이 없으면 "전문 필요"로 표시. 계정 필요 출처(BRENDA 등)는 손대지 말고 "통합가 필요"로.
4. **큰 파일 통째로 읽지 마라.** `data/db.json`(675KB)·`CHANGES.md`·`limitations.md` — 아래 조회 명령으로 필요한 줄만.

## 2. 쓸 명령 (이게 전부)

```bash
node dbtool.mjs status                 # 규모 한 줄 (개념·정의항·규칙·관찰 수)
node dbtool.mjs map <이름>              # 이미 있나 — 번호(D…) 찾기 (없으면 비슷한 이름 제안)
node dbtool.mjs context D000144         # 그 정의항의 부위·규칙·관찰
# 관찰 기록 전부 한 줄씩 (id | 종류 | 용도 | 출처):
node -e 'const d=require("./data/db.json");for(const[id,o]of Object.entries(d.observations))console.log(id,"|",o.kind||"정량","|",o.use,"|",JSON.stringify(o.provenance||o.source||o.evidence||{}).slice(0,90))'
```

막히면 `docs/RUNBOOK.md` §2·§3 을 본다. 그 외 설명서는 안 읽어도 된다.

## 3. 할 일

1. `workspace/tasks/` 에서 **네 과제 하나**를 읽는다(통합가가 적어 둔다).
2. 위 명령·문헌으로 후보를 모은다. **각 후보에 반드시**:
   값·단위 · 종·세포·측정 시각·불확도 · 출처(DOI/PMID)+원문 인용 · 현재 use · "규약 가능? 빠진 것".
3. `workspace/handoff/HANDOFF-<주제>.md` 에 **아래 표로** 적는다(틀: `workspace/handoff/HANDOFF-template.md`). 상태는 `collected`.
4. 표 아래 3~5줄 판정: 가장 가까운 후보 / 전부 막혔다면 공통으로 빠진 것.

```
| # | 대상(D…·O…) | 값·단위 | 종·세포·시각·불확도 | 출처+인용 | 현재 use | 규약 가능? 빠진 것 | 상태 |
```

5. **기계 검증용 JSONL도 함께** 낸다 — `workspace/handoff/<주제>.jsonl`, 한 줄 한 후보:
   `{"outcome":"...","target":"...","value":...,"unit":"...","species":...,"source":{"db":"DOI|PMID","id":"..."},"quote":"...","use":"estimation|validation","reuse":{"ref":"O…"}}`
   `outcome` ∈ `not_searched|not_found|unreadable|read_no_value|read_value|ambiguous|reused`.
   **값(value)을 적으면 반드시 source + quote 가 있어야** 한다(없으면 검증기가 거부). 못 찾았으면 `not_found`,
   접근 못 하면 `unreadable` — 값 칸을 비운다. 통합가가 `node dbtool.mjs verify-collection <그 .jsonl>` 로
   판정한다(네가 "완료"라 적어도 무시된다 — 판정기가 정함). 값 후보는 통합가 1차 출처 재확인 전까지 PASS 안 됨.

## 4. 기억할 것

- **네가 적은 건 전부 "후보"다.** 통합가가 1차 출처로 다시 확인한 뒤에만 진짜 데이터가 된다. 그러니 **정확한 수집**이 네 일이지, 판단·적용이 아니다.
- 데이터는 못 믿을 값이 하나 들어가면 전체가 무너진다. **확실한 것만, 없으면 "없음".**

## 5. 어느 모델이 무엇을 (등급별)

- **Sonnet 급**: 문헌에서 값 추출 + 출처 대조 + 후보 선별까지.
- **더 낮은 급(Haiku 등)**: 기계적 수집만 — 관찰 나열·필드 확인·grep·표 채우기. 판단("규약 가능?")은 자신 없으면 "통합가 판단 필요"로 남긴다.
- 어느 급이든 **절대 규칙(§1)은 같다.** 안전은 네 똑똑함이 아니라 구조(관문·권한·격리)가 지킨다 — 그러니 규칙만 지키면 어떤 모델이 와도 저장소를 망칠 수 없다.
