# 명령 · 판정 · 시험

> 생성물 — `node rebuild/status.mjs --write`(응답이 끝날 때 훅이 돌림). 손으로 고치지 않는다. 읽기 점검용이며 다른 코드가 읽지 않는다.

## dbtool 명령 (머리 주석에 적혔나)

| 명령 | 머리 주석 |
|---|---|
| `status` | 적힘 |
| `validate` | 적힘 |
| `merge` | 적힘 |
| `report` | 적힘 |
| `map` | 적힘 |
| `audit` | 적힘 |
| `vocab` | 적힘 |
| `context` | 적힘 |
| `mechanism` | 적힘 |
| `limitations` | 적힘 |
| `pattern` | 적힘 |
| `textbook` | 적힘 |
| `resolution` | 적힘 |
| `audit-run` | 적힘 |
| `simulate` | 적힘 |
| `augment` | 적힘 |
| `grade` | 적힘 |
| `origin` | **빠짐** |
| `assume` | **빠짐** |
| `dictionary` | **빠짐** |
| `register` | **빠짐** |
| `qualgraph` | **빠짐** |
| `retraction` | **빠짐** |
| `evidence` | **빠짐** |
| `verify-collection` | **빠짐** |
| `verify-run` | **빠짐** |
| `log` | **빠짐** |
| `attest` | 적힘 |
| `accept` | **빠짐** |
| `trend` | 적힘 |
| `compare` | 적힘 |
| `fate` | 적힘 |
| `observe` | 적힘 |
| `prompt` | 적힘 |
| `transition` | 적힘 |

## MCP 도구

| 서버 | 수 | 도구 |
|---|---|---|
| `mcp/clerk.mjs` | 10 | put_handoff · validate_patch · merge · augment_apply · register · assume_add · dictionary_add · accept · attest · write_derived |
| `mcp/fetch.mjs` | 5 | resolve_access · fetch_abstract · fetch_fulltext · resolve_doi · brenda_kinetics |
| `mcp/query.mjs` | 12 | summary · map · context · mechanism · pattern · limitations · origin · assume_uses · qualgraph · retraction · inbox · verify_collection |

## 판정 거부 자리 (E( — 규칙 번호 없이 문장만)

| 파일 | 자리 |
|---|---|
| `judicial/assumption_audit.js` | 22 |
| `judicial/contract.js` | 9 |
| `judicial/judicial.js` | 426 |

## 시험

| 파일 | 시험 |
|---|---|
| `tests/acceptance.test.mjs` | 9 |
| `tests/assumptions.test.mjs` | 8 |
| `tests/collection_audit.test.mjs` | 13 |
| `tests/conservation.test.mjs` | 3 |
| `tests/dictionary.test.mjs` | 8 |
| `tests/dictionary_seal.test.mjs` | 4 |
| `tests/dose_slope.test.mjs` | 6 |
| `tests/enforcement_gaps.test.mjs` | 26 |
| `tests/gap_schema.test.mjs` | 3 |
| `tests/governance.test.mjs` | 21 |
| `tests/mcp.test.mjs` | 12 |
| `tests/mhc.test.mjs` | 11 |
| `tests/observations.test.mjs` | 6 |
| `tests/perturb.test.mjs` | 4 |
| `tests/protocol.test.mjs` | 3 |
| `tests/qual_compare.test.mjs` | 7 |
| `tests/qual_graph.test.mjs` | 8 |
| `tests/qualitative.test.mjs` | 9 |
| `tests/rebuild.test.mjs` | 15 |
| `tests/rejections.test.mjs` | 3 |
| `tests/reliability_criteria.test.mjs` | 12 |
| `tests/retraction_propagation.test.mjs` | 4 |
| `tests/rules.test.mjs` | 149 |
| `tests/runbook.test.mjs` | 5 |
| `tests/rust_engine.test.mjs` | 8 |
| `tests/stats.test.mjs` | 6 |
| `tests/stochastic.test.mjs` | 6 |
| `tests/telomere.test.mjs` | 7 |
| `tests/transitions.test.mjs` | 2 |
| `tests/values.test.mjs` | 4 |

거부 말뭉치: 25
