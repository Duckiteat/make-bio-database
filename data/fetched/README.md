# 수신함 — 외부 원본 사본 (UniProt · ChEBI)

`node dbtool.mjs augment fetch` 가 받은 응답, 또는 사람이 `RETRIEVAL_TASKS.md` 대로 받아 둔 파일. 해석만 하고 실행하지 않으며, 받은 그대로 둔다(고치지 않음).

| 디렉터리 | 파일 이름 | 내용 |
|---|---|---|
| `uniprot/` | `{번호}.json` · `.fasta` · `.txt` | UniProtKB 항목 (`https://rest.uniprot.org/uniprotkb/{번호}.json`) |
| `uniprot-search/` | `{D…}.json` | 유전자·종 검색 결과 |
| `chebi/` | `CHEBI_{번호}.json` | ChEBI 항목 — API 응답 그대로, 또는 간이 JSON `{"id":"CHEBI:…","name":"…","formula":"…","charge":0,"inchikey":"…","synonyms":[]}` |
| `europepmc/` | `MED-{PMID}.json` | 문헌 초록 (Europe PMC REST `search?query=EXT_ID:{PMID} AND SRC:MED&resultType=core&format=json`) — 정성 관찰의 원문 구절(`quote`)과 대조, 관찰 `provenance.sha256` 이 이 파일 |
| `chebi-search/` | `{D…}.json` | 이름 검색 결과 — API 응답 그대로, 또는 `{"results":[{"id":"CHEBI:…","name":"…"}]}` |

파일을 둔 뒤 `node dbtool.mjs augment build` (확인 + 관문 미리 보기) → `augment apply` (병합 + CHANGES.md). 패치의 외부 ID `note` 가 이 파일의 경로와 sha256 을 가리킨다.
