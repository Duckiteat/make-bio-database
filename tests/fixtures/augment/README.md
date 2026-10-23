# 자동 보강 시험 자료 (합성)

합성 시험 자료 — 실제 UniProt·ChEBI 값이 아님 (서열·지문은 가짜). tests/rules.test.mjs 의 자동 보강 시험 전용, data/db.json 에 들어가지 않는다.

수신함 `data/fetched/` 와 같은 배치(uniprot/ · chebi/ · chebi-search/). 각 파일이 확인 단계의 한 경로(검증·거부·모호·화학식 불일치·중복)를 시험한다.
