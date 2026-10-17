# workspace/SOURCES.md — 1차 출처 지도 (수집가·통합가)

> 어디서·어떻게·무슨 식별자로 떼오나. **TASK-002 교훈**에서 나왔다: 수집가가 웹 검색 스니펫으로 인용했더니
> "~7 min half-life" 인용이 1차 출처(초록)에 없어 검증 불가였다. 그래서 규칙 둘:

## 규칙 (깨면 안 됨)

1. **인용·값은 지정 1차 출처 API가 반환한 내용에서만** 뽑는다. **웹 검색 스니펫·2차 리뷰·블로그를 값·인용
   근거로 쓰지 마라.** 못 찾으면 `not_found`, 접근 안 되면 `unreadable` — 지어내거나 스니펫으로 메우지 않는다.
2. **계정 필요 출처는 수집가가 손대지 않는다**(통합가 전용). 자격증명은 저장소·핸드오프·수집가에 **평문으로
   절대 남기지 않는다** — SHA256 로만 쓴다.

## 출처 표

| 데이터 | 출처 | 식별자 | 접근 | 누가 | 받는 법 |
|---|---|---|---|---|---|
| 문헌·반감기·정성 관찰 | **Europe PMC REST** | PMID | 무료·무인증 | **수집가** | `GET https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:<PMID>%20AND%20SRC:MED&resultType=core&format=json` → `title`·`abstractText` 에서 인용 |
| 단백질·유전자 정체성 | **UniProt REST** | accession(P…·Q…) | 무료·무인증 | **수집가** | `GET https://rest.uniprot.org/uniprotkb/<accession>.json` |
| 효소 kinetics (kcat·Km) | **BRENDA** | EC 번호 + UniProt | **계정 필요** | **통합가 전용** | SOAP · 자격증명은 SHA256 로만 · **수집가·저장소에 금지** |
| 반응·열역학 | Rhea / ChEBI | RHEA:·CHEBI: | 무료 | 수집가/통합가 | REST (정확한 엔드포인트는 통합가가 확인 후 SOURCES 갱신) |
| 농도·부피·수치 | BioNumbers | BNID | 무료 | 수집가/통합가 | 웹 (엔드포인트 통합가 확인) |

- **지금 수집가가 쓸 수 있는 확정 출처는 Europe PMC(PMID)·UniProt 둘**이다(둘 다 무료·무인증, 위 URL 검증됨).
  나머지는 엔드포인트를 통합가가 확인해 이 표를 갱신하기 전까지 "통합가 필요"로 표시한다.

## 수집가 절차 (한 과제)

1. 과제(`workspace/tasks/TASK-…`)의 대상·종을 읽는다.
2. 후보를 **Europe PMC/UniProt 에서 fetch** 한다(과제가 BRENDA 등 계정 출처를 요구하면 "통합가 필요"로 표시하고 멈춤).
3. **반환된 JSON 에서** 값·단위·종·세포·조건·인용구를 뽑는다. 초록에 값이 없으면 "초록에 없음(전문 필요)"로
   표시 — 스니펫으로 지어내지 않는다.
4. `workspace/handoff/<주제>.jsonl` 에 한 줄 한 후보로 기록(상태 collected). `source.db`·`source.id`·`quote` 는
   그 fetch 한 출처 그대로.
5. 통합가가 `verify-collection` → 1차 출처 재확인 → 통과분만 패치. (수집가는 apply·commit·push·규칙 수정 금지.)
