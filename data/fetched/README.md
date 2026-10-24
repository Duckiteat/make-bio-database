# 수신함 — 외부 원본 사본 (UniProt · ChEBI)

`node dbtool.mjs augment fetch` 가 받은 응답, 또는 사람이 `RETRIEVAL_TASKS.md` 대로 받아 둔 파일. 해석만 하고 실행하지 않으며, 받은 그대로 둔다(고치지 않음).

| 디렉터리 | 파일 이름 | 내용 |
|---|---|---|
| `uniprot/` | `{번호}.json` · `.fasta` · `.txt` | UniProtKB 항목 (`https://rest.uniprot.org/uniprotkb/{번호}.json`) |
| `uniprot-search/` | `{D…}.json` | 유전자·종 검색 결과 |
| `chebi/` | `CHEBI_{번호}.json` | ChEBI 항목 — API 응답 그대로, 또는 간이 JSON `{"id":"CHEBI:…","name":"…","formula":"…","charge":0,"inchikey":"…","synonyms":[]}` |
| `europepmc/` | `MED-{PMID}.json` | 문헌 초록 (Europe PMC REST `search?query=EXT_ID:{PMID} AND SRC:MED&resultType=core&format=json`) — 정성 관찰의 원문 구절(`quote`)과 대조, 관찰 `provenance.sha256` 이 이 파일 |
| `europepmc/` | `PMC-{번호}.xml` | **공개 전문(OA)만** — Europe PMC `{PMCID}/fullTextXML` 원본 그대로 (`mcp/fetch.mjs fetch_fulltext`). PMC 무료 열람(OA 아님)·유료는 받지 않는다(저작권) |
| `europepmc/` | `DOI-{정리한 DOI}.json` | DOI 로 찾은 Europe PMC 검색 기록 (`mcp/fetch.mjs resolve_doi`) — PubMed 기록이 있으면 같은 논문의 `MED-{PMID}.json` 도 받는다. 신뢰 지표 S 의 출처 상태(학술지·원고·철회)를 읽는 곳 |
| `<원천>/` | `FETCH_LOG.jsonl` | 받기 기록 — 받기마다 한 사건, 추가만 하는 사슬 `seq·at·url·file·ok·bytes·sha256·error?·cached?·prev·root` (첫 prev = sha256('fetchlog\n')). `validate` 가 사슬과 '받은 뒤 파일이 그대로인가'를 본다 |
| `chebi-search/` | `{D…}.json` | 이름 검색 결과 — API 응답 그대로, 또는 `{"results":[{"id":"CHEBI:…","name":"…"}]}` |

파일을 둔 뒤 `node dbtool.mjs augment build` (확인 + 관문 미리 보기) → `augment apply` (병합 + CHANGES.md). 패치의 외부 ID `note` 가 이 파일의 경로와 sha256 을 가리킨다.
