# 번호 사전

> 생성물 — `node rebuild/status.mjs --write`(응답이 끝날 때 훅이 돌림). 손으로 고치지 않는다. 읽기 점검용이며 다른 코드가 읽지 않는다.

원본: `rebuild/index/namespaces.jsonl` (이름공간 54) · 예외 `rebuild/index/exceptions.jsonl` (3). 참조 색인은 저장하지 않고 계산한다.

## 이름공간

토큰 = 저장소에 나온 수 · 고유 · 파일 / 정의 = 정의된 수 · 가리켜졌는데 정의 안 됨

| 이름공간 | 상태 | 모양 | 형식 | 발급 | 자리 | 토큰 | 정의 |
|---|---|---|---|---|---|---|---|
| `term` | active | token | `model.ID_RE.T` | legislative merge (meta.next.T) | `data/db.json#terms` | 1221 · 212 · 24 | 210 · 없음 2 |
| `sense` | active | token | `model.ID_RE.D` | legislative merge (meta.next.D) | `data/db.json#senses` | 10326 · 214 · 224 | 212 · 없음 2 |
| `step` | active | token | `model.ID_RE.S` | legislative merge (meta.next.S) | `data/db.json#steps` | 662 · 58 · 52 | 57 · 없음 1 |
| `limitation` | active | token | `model.ID_RE.L` | legislative merge (meta.next.L) | `data/db.json#limitations` | 2639 · 126 · 159 | 124 · 없음 2 |
| `observation` | active | token | `model.ID_RE.O` | legislative merge (meta.next.O) | `data/db.json#observations` | 766 · 34 · 83 | 28 · 없음 6 |
| `value` | active | token | `^V\d{6}$` | legislative foldValues (meta.next.V) | `data/db.json#values` | 85 · 72 · 6 | 68 · 없음 4 |
| `assumption` | active | token | `^A\d{6}$` | clerk appendAssumptions (seq) | `data/assumptions.jsonl` | 2072 · 363 · 39 | 360 · 없음 3 |
| `temp_id` | active | token | `^[TDSLOA]\+[A-Za-z0-9_]+$` | patch author (patch-local) | `patch files (merge assigns real id)` | 1845 · 505 · 94 | — |
| `sub_ref` | active | composite | `^D\d{6}/(site\|rule\|desc\|obs)/[A-Za-z0-9_]+$` | sense owner key | `data/db.json#senses.*.site\|rule\|desc\|obs` | — | — |
| `bundle_key` | active | composite | `^D\d{6}(\\|[a-z0-9_]+:[A-Za-z0-9_]+)*\\|[a-z_]+$` | derived (not issued) | `computed from sense+site+location` | — | — |
| `event` | active | chain | `^[1-9]\d*$` | clerk (seq, prev, root) | `data/log/events.jsonl` | — | — |
| `preregistration` | active | chain | `^[1-9]\d*$` | clerk (seq, prev, root) | `data/preregistrations.jsonl` | — | — |
| `dictionary_entry` | active | chain | `^[1-9]\d*$` | clerk (seq, prev, root) | `data/dictionary.jsonl` | — | — |
| `fetch_log` | active | chain | `^[1-9]\d*$` | clerk (seq, prev, root) | `data/fetched/*/FETCH_LOG.jsonl` | — | — |
| `attestation` | active | chain | `^[0-9a-f]{64}$` | judicial attestation (digest) | `attestations/registry.json` | — | — |
| `patch_record` | active | file | `^\d{8}-\d{6}-.+\.json$` | clerk commitMerge | `data/patches/` | — | — |
| `vocab_token` | active | vocab | `—` | human (vocab.js, user request) | `vocab.js` | — | — |
| `audit_code` | active | token | `^AUDIT_[A-Z_]+$` | judicial (code literal) | `judicial/*.js` | 314 · 10 · 35 | 10 · 없음 0 |
| `criterion` | active | token | `^(S[0-4]\|D[0-4]\|T\|I)\.[a-z_]+$` | judicial/reliability.js CRITERIA | `judicial/reliability.js#CRITERIA` | 196 · 22 · 10 | 20 · 없음 2 |
| `task` | active | token | `^TASK-\d{3}$` | integrator | `workspace/tasks/` | 361 · 6 · 37 | 5 · 없음 1 |
| `ledger_unit` | active | token | `^U\d{4,}$` | classification (rebuild PLAN §5) | `rebuild/ledger/*.jsonl` | 10021 · 7281 · 9 | — |
| `scheduled_task` | external | token | `^trig_[A-Za-z0-9]+$` | claude.ai | `claude.ai scheduled tasks` | 8 · 1 · 5 | — |
| `inbox_file` | active | token | `^(MED\|PMC)-\d+$` | clerk fetchToInbox (file stem) | `data/fetched/europepmc/` | 29 · 10 · 10 | — |
| `rule` | active | token | `^RULE-\d{4}$` | rebuild 5 단계 (규칙 장부) | `rebuild/rules/rules.jsonl` | 3105 · 518 · 48 | 518 · 없음 0 |
| `decision` | active | token | `^DEC-\d{4}$` | rebuild 6c (계획 기록 — 결정, 순번) | `rebuild/state/plans.jsonl` | 579 · 35 · 17 | 157 · 없음 2 |
| `change` | active | token | `^CHG-\d{4}$` | 계산 — CHANGES.md 의 행을 아래(가장 오래된 행)부터 센 순번. 행은 맨 위에 더하기만 하므로 번호가 바뀌지 않는다 | `CHANGES.md` | 94 · 40 · 2 | 239 · 없음 0 |
| `code_head` | active | file | `^code:[\w./-]+\.m?js$` | — (파일 경로) | `코드 파일 맨 위 주석 (계약·이유)` | — | — |
| `plan_item` | active | token | `^PLAN-(?:\d{3}[ap]?\|H\d{2})$` | rebuild 6c (계획 기록 — 원래 순번에서 계산: 12A→a · 50′→p · (보류)→H) | `rebuild/state/plans.jsonl` | 941 · 90 · 7 | 157 · 없음 3 |
| `plan_stage` | active | token | `^STG-\d{2}[a-z]?p{0,3}$` | rebuild 6c (계획 기록 — 재건 단계 순번에서: 5a→05a · 0′→00p · 5b″→05bpp) | `rebuild/state/plans.jsonl` | 343 · 23 · 8 | 157 · 없음 0 |
| `plan_direction` | active | token | `^DIR-\d{4}$` | rebuild 6c (계획 기록 — 나아갈 방향, 순번) | `rebuild/state/plans.jsonl` | 40 · 9 · 6 | 157 · 없음 1 |
| `test` | planned | token | `^TEST-\d{4}$` | (planned) | `(planned)` | 0 · 0 · 0 | — |
| `switch` | planned | token | `^SW-\d{4}$` | (planned) | `(planned)` | 0 · 0 · 0 | — |
| `formula` | active | token | `^EQ-\d{4}$` | rebuild 6d (수식 기록) | `rebuild/rules/formulas.jsonl` | 25 · 13 · 6 | 13 · 없음 0 |
| `environment` | planned | token | `^E\d{6}$` | (planned) | `(planned)` | 0 · 0 · 0 | — |
| `feature_legacy` | legacy | token | `^F\d{6}$` | none (FEATURES.md 초안) | `FEATURES.md (구현 안 됨)` | 16 · 5 · 2 | — |
| `hypothesis_legacy` | legacy | token | `^H\d{6}$` | none (FEATURES.md 초안) | `FEATURES.md (구현 안 됨)` | 8 · 2 · 3 | — |
| `ext_uniprot` | external | token | `vocab.xrefs.UniProt.pattern` | UniProt | `data/db.json#senses.*.xrefs` | 1249 · 55 · 33 | — |
| `ext_chebi` | external | token | `vocab.xrefs.ChEBI.pattern` | ChEBI | `data/db.json#senses.*.xrefs` | — | — |
| `ext_pubchem` | external | token | `vocab.xrefs.PubChem.pattern` | PubChem | `data/db.json#senses.*.xrefs` | — | — |
| `ext_pdb` | external | token | `vocab.xrefs.PDB.pattern` | PDB | `data/db.json#senses.*.xrefs` | — | — |
| `ext_ec` | external | token | `vocab.xrefs.EC.pattern` | EC | `data/db.json#senses.*.xrefs` | — | — |
| `ext_go` | external | token | `vocab.xrefs.GO.pattern` | GO | `data/db.json#senses.*.xrefs` | — | — |
| `ext_reactome` | external | token | `vocab.xrefs.Reactome.pattern` | Reactome | `data/db.json#senses.*.xrefs` | — | — |
| `ext_kegg` | external | token | `vocab.xrefs.KEGG.pattern` | KEGG | `data/db.json#senses.*.xrefs` | — | — |
| `ext_ncbigene` | external | token | `vocab.xrefs.NCBIGene.pattern` | NCBIGene | `data/db.json#senses.*.xrefs` | — | — |
| `ext_cl` | external | token | `vocab.xrefs.CL.pattern` | CL | `data/db.json#senses.*.xrefs` | — | — |
| `ext_interpro` | external | token | `vocab.xrefs.InterPro.pattern` | InterPro | `data/db.json#senses.*.xrefs` | — | — |
| `ext_pmid` | external | token | `vocab.xrefs.PMID.pattern` | PMID | `data/db.json#senses.*.xrefs` | — | — |
| `ext_doi` | external | token | `vocab.xrefs.DOI.pattern` | DOI | `data/db.json#senses.*.xrefs` | — | — |
| `ext_pmc` | external | token | `^PMC\d+$` | PubMed Central | `evidence.sources / inbox` | 21 · 5 · 9 | — |
| `fp_inchikey` | active | composite | `vocab.fingerprints.InChIKey.pattern` | tool (computed) | `data/db.json#senses.*.fingerprint` | — | — |
| `fp_seq_sha256` | active | composite | `vocab.fingerprints.SEQ_SHA256.pattern` | tool (computed) | `data/db.json#senses.*.fingerprint` | — | — |
| `fp_complex` | active | composite | `vocab.fingerprints.COMPLEX.pattern` | tool (computed) | `data/db.json#senses.*.fingerprint` | — | — |
| `ext_taxon` | external | vocab | `^\d+$` | NCBI Taxonomy | `vocab.taxa` | — | — |

## 미등록 번호 모양 (0 이어야 함)

없음

## 겹침 (0 이어야 함)

없음

## 가리켜졌는데 정의되지 않은 번호 (지운 번호·시험용 가짜 번호·다음 번호 포함 — 정보)

- `term`: T000211 · T999999
- `sense`: D000213 · D999999
- `step`: S000058
- `limitation`: L000125 · L999999
- `observation`: O000029 · O000999 · O900001 · O900002 · O900003 · O999999
- `value`: V000069 · V900000 · V999998 · V999999
- `assumption`: A000500 · A000999 · A999999
- `criterion`: D3.asserted · S3.doi
- `task`: TASK-009
- `decision`: DEC-0098 · DEC-0099
- `plan_item`: PLAN-997 · PLAN-998 · PLAN-999
- `plan_direction`: DIR-0099

## 같은 번호 형식을 코드에 따로 적은 곳 (5·9 단계에서 하나로)

- compiler/perturb.js:29 /^D\d{6}$/
- dbtool.mjs:469 /^O\d{6}$/
- dbtool.mjs:476 /^O\d{6}$/
- dbtool.mjs:616 /^O\d{6}$/
- dbtool.mjs:720 /^O\d{6}$/
- dbtool.mjs:733 /^O\d{6}$/
- dbtool.mjs:740 /^O\d{6}$/
- dbtool.mjs:740 /^O\d{6}$/
- judicial/acceptance.js:49 /^O\d{6}$/
- judicial/assumption_audit.js:16 /^A\d{6}$/
- judicial/judicial.js:228 /^[TDS]\d{6}$/
- mcp/clerk.mjs:50 /^O\d{6}$/
- mcp/query.mjs:61 /^A\d{6}$/
- model.js:44 /^T\d{6}$/
- model.js:44 /^D\d{6}$/
- model.js:44 /^S\d{6}$/
- model.js:44 /^L\d{6}$/
- model.js:44 /^O\d{6}$/

## 이름공간 표 형식 오류

없음
